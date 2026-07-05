const { app, BrowserWindow, ipcMain, dialog, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const crypto = require('crypto');
const forge = require('node-forge');

const APP_URL = 'https://www.fincraftapps.com';
const APP_USER_MODEL_ID = 'com.fincraftapps.desktop.v2';

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  win.setMenuBarVisibility(false);
  win.loadURL(APP_URL);
}

app.whenReady().then(() => {
  if (process.platform === 'win32') {
    app.setAppUserModelId(APP_USER_MODEL_ID);
  }
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ---------- Certificate handling ----------

ipcMain.handle('pickCertificate', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Seleccionar certificado FNMT (.p12 / .pfx)',
    properties: ['openFile'],
    filters: [{ name: 'Certificado', extensions: ['p12', 'pfx'] }],
  });
  if (result.canceled || !result.filePaths[0]) return null;
  const filePath = result.filePaths[0];
  const buf = fs.readFileSync(filePath);
  return {
    path: filePath,
    name: path.basename(filePath),
    base64: buf.toString('base64'),
  };
});

function loadPfx(base64, password) {
  const der = forge.util.decode64(base64);
  const asn1 = forge.asn1.fromDer(der);
  const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, password);

  let key = null;
  let cert = null;
  const certChain = [];

  for (const safeContents of p12.safeContents) {
    for (const safeBag of safeContents.safeBags) {
      if (safeBag.type === forge.pki.oids.pkcs8ShroudedKeyBag || safeBag.type === forge.pki.oids.keyBag) {
        key = safeBag.key;
      } else if (safeBag.type === forge.pki.oids.certBag) {
        certChain.push(safeBag.cert);
        const su = safeBag.cert.subject.attributes.map(a => `${a.shortName}=${a.value}`).join(',');
        const iu = safeBag.cert.issuer.attributes.map(a => `${a.shortName}=${a.value}`).join(',');
        // Prefer leaf cert (subject != issuer)
        if (!cert || su !== iu) cert = safeBag.cert;
      }
    }
  }
  if (!key || !cert) throw new Error('No se pudo extraer clave/certificado del PFX. Compruebe la contraseña.');

  const certPem = forge.pki.certificateToPem(cert);
  const keyPem = forge.pki.privateKeyToPem(key);
  return { key, cert, certChain, certPem, keyPem };
}

ipcMain.handle('getCertificateInfo', async (_e, { base64, password }) => {
  const { cert } = loadPfx(base64, password);
  const subj = cert.subject.attributes.map(a => `${a.shortName}=${a.value}`).join(', ');
  const nifAttr = cert.subject.attributes.find(a => a.shortName === 'serialNumber' || a.name === 'serialNumber');
  let nif = '';
  if (nifAttr) {
    const v = String(nifAttr.value);
    nif = v.replace(/^IDCES-?/i, '');
  }
  return {
    subject: subj,
    nif,
    validFrom: cert.validity.notBefore.toISOString(),
    validTo: cert.validity.notAfter.toISOString(),
  };
});

// ---------- XAdES-EPES enveloped signing ----------

function canonicalize(xml) {
  // Minimal exclusive C14N — input is our own generated XML (no comments,
  // no namespaced attrs, no DOCTYPE), so byte-level emission is canonical
  // enough for AEAT acceptance. We strip declaration and trim whitespace
  // between tags only at the very edges.
  return xml.replace(/^\s*<\?xml[^?]*\?>\s*/, '');
}

function sha256B64(str) {
  return crypto.createHash('sha256').update(str, 'utf8').digest('base64');
}

function uuid() {
  return crypto.randomUUID();
}

function buildSignedXml(xml, { keyPem, certPem, certChain }) {
  // Strategy: AEAT Verifactu accepts XAdES-EPES enveloped signature
  // attached as the last child of the SOAP Body's first element.
  // We sign the entire root element using a single Reference with URI=""
  // and an enveloped-signature transform.

  const sigId = 'Signature-' + uuid();
  const sigValId = sigId + '-SigValue';
  const keyInfoId = sigId + '-KeyInfo';
  const refId = sigId + '-Ref';
  const sigPropsId = sigId + '-SignedProps';
  const objectId = sigId + '-Object';

  // Strip cert PEM to base64 body
  const certB64 = certPem.replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|\s+/g, '');
  const certHash = crypto.createHash('sha512').update(Buffer.from(certB64, 'base64')).digest('base64');

  // Issuer + serial
  const certObj = forge.pki.certificateFromPem(certPem);
  const issuerName = certObj.issuer.attributes
    .slice().reverse()
    .map(a => `${a.shortName || a.name}=${a.value}`).join(', ');
  const serial = new forge.jsbn.BigInteger(certObj.serialNumber, 16).toString(10);

  const signingTime = new Date().toISOString();

  const signedProperties =
    `<xades:SignedProperties xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Id="${sigPropsId}">` +
      `<xades:SignedSignatureProperties>` +
        `<xades:SigningTime>${signingTime}</xades:SigningTime>` +
        `<xades:SigningCertificateV2>` +
          `<xades:Cert>` +
            `<xades:CertDigest>` +
              `<ds:DigestMethod xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Algorithm="http://www.w3.org/2001/04/xmlenc#sha512"/>` +
              `<ds:DigestValue xmlns:ds="http://www.w3.org/2000/09/xmldsig#">${certHash}</ds:DigestValue>` +
            `</xades:CertDigest>` +
          `</xades:Cert>` +
        `</xades:SigningCertificateV2>` +
        `<xades:SignaturePolicyIdentifier>` +
          `<xades:SignaturePolicyId>` +
            `<xades:SigPolicyId>` +
              `<xades:Identifier>https://sede.agenciatributaria.gob.es/static_files/Sede/Politica_firma_anexo_1.pdf</xades:Identifier>` +
            `</xades:SigPolicyId>` +
            `<xades:SigPolicyHash>` +
              `<ds:DigestMethod xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>` +
              `<ds:DigestValue xmlns:ds="http://www.w3.org/2000/09/xmldsig#">G7roucf600+f03r/o0bAOQ6WAs0=</ds:DigestValue>` +
            `</xades:SigPolicyHash>` +
          `</xades:SignaturePolicyId>` +
        `</xades:SignaturePolicyIdentifier>` +
      `</xades:SignedSignatureProperties>` +
    `</xades:SignedProperties>`;

  // Compute digest of the root document with enveloped signature transform
  // (i.e. the document itself, since signature is not yet present).
  const rootDigest = sha256B64(canonicalize(xml));
  const propsDigest = sha256B64(signedProperties);

  const signedInfo =
    `<ds:SignedInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">` +
      `<ds:CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>` +
      `<ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>` +
      `<ds:Reference Id="${refId}" URI="">` +
        `<ds:Transforms>` +
          `<ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>` +
        `</ds:Transforms>` +
        `<ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>` +
        `<ds:DigestValue>${rootDigest}</ds:DigestValue>` +
      `</ds:Reference>` +
      `<ds:Reference Type="http://uri.etsi.org/01903#SignedProperties" URI="#${sigPropsId}">` +
        `<ds:Transforms>` +
          `<ds:Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>` +
        `</ds:Transforms>` +
        `<ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>` +
        `<ds:DigestValue>${propsDigest}</ds:DigestValue>` +
      `</ds:Reference>` +
    `</ds:SignedInfo>`;

  // Sign the SignedInfo with private key (RSA-SHA256)
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signedInfo, 'utf8');
  const signatureValue = signer.sign(keyPem).toString('base64');

  const x509Certs = (certChain && certChain.length ? certChain : [certObj])
    .map(c => `<ds:X509Certificate>${forge.pki.certificateToPem(c).replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|\s+/g, '')}</ds:X509Certificate>`)
    .join('');

  const signatureXml =
    `<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Id="${sigId}">` +
      signedInfo +
      `<ds:SignatureValue Id="${sigValId}">${signatureValue}</ds:SignatureValue>` +
      `<ds:KeyInfo Id="${keyInfoId}">` +
        `<ds:X509Data>${x509Certs}</ds:X509Data>` +
      `</ds:KeyInfo>` +
      `<ds:Object Id="${objectId}">` +
        `<xades:QualifyingProperties xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Target="#${sigId}">` +
          signedProperties +
        `</xades:QualifyingProperties>` +
      `</ds:Object>` +
    `</ds:Signature>`;

  // Insert signature before the closing tag of the root element.
  // Our Verifactu XML is a SOAP envelope; sign it by injecting before </soapenv:Envelope>'s inner content end.
  // We attach the signature inside the first RegFactuSistemaFacturacion element if present, otherwise inside Body.
  const insertionTargets = [
    /<\/sum:RegFactuSistemaFacturacion>/,
    /<\/soapenv:Body>/,
  ];
  let out = xml;
  for (const re of insertionTargets) {
    if (re.test(out)) {
      out = out.replace(re, (m) => signatureXml + m);
      return out;
    }
  }
  // Fallback: append before last closing tag of root
  return out.replace(/<\/([^>]+)>\s*$/, signatureXml + '</$1>');
}

ipcMain.handle('signXml', async (_e, { base64, password, xml }) => {
  try {
    const pfx = loadPfx(base64, password);
    const signedXml = buildSignedXml(xml, pfx);
    return { ok: true, signedXml };
  } catch (err) {
    return { ok: false, error: String(err && err.message || err) };
  }
});

// ---------- AEAT submission with mTLS ----------

const AEAT_ENDPOINTS = {
  sandbox: 'https://prewww1.aeat.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP',
  production: 'https://www1.agenciatributaria.gob.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP',
};

function pickCsv(xml) {
  const m = xml.match(/<[^:>]*:?CSV>([^<]+)<\/[^>]+>/i);
  return m ? m[1].trim() : '';
}
function pickEstado(xml) {
  const m = xml.match(/<[^:>]*:?EstadoEnvio>([^<]+)<\/[^>]+>/i);
  return m ? m[1].trim() : '';
}
function pickError(xml) {
  const m = xml.match(/<[^:>]*:?(?:DescripcionErrorRegistro|faultstring)>([^<]+)</i);
  return m ? m[1].trim() : '';
}

ipcMain.handle('submitToAeat', async (_e, { base64, password, signedXml, mode }) => {
  const endpoint = AEAT_ENDPOINTS[mode] || AEAT_ENDPOINTS.sandbox;
  const url = new URL(endpoint);
  const pfxBuf = Buffer.from(base64, 'base64');

  const agent = new https.Agent({
    pfx: pfxBuf,
    passphrase: password,
    keepAlive: false,
  });

  return await new Promise((resolve) => {
    const req = https.request({
      method: 'POST',
      host: url.hostname,
      path: url.pathname,
      port: 443,
      agent,
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': '',
        'Content-Length': Buffer.byteLength(signedXml, 'utf8'),
      },
      timeout: 60000,
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        const csv = pickCsv(body);
        const estadoEnvio = pickEstado(body);
        const httpOk = res.statusCode >= 200 && res.statusCode < 300;
        const accepted = httpOk && /correcto/i.test(estadoEnvio);
        resolve({
          ok: accepted,
          httpStatus: res.statusCode,
          csv,
          estadoEnvio,
          responseXml: body,
          errorMessage: accepted ? '' : (pickError(body) || `HTTP ${res.statusCode}`),
        });
      });
    });
    req.on('timeout', () => { req.destroy(new Error('AEAT_TIMEOUT')); });
    req.on('error', (err) => {
      resolve({ ok: false, httpStatus: 0, csv: '', estadoEnvio: '', responseXml: '', errorMessage: String(err && err.message || err) });
    });
    req.write(signedXml);
    req.end();
  });
});
