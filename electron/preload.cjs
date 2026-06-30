const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('facturaDesktop', {
  isDesktop: true,
  pickCertificate: () => ipcRenderer.invoke('pickCertificate'),
  getCertificateInfo: (args) => ipcRenderer.invoke('getCertificateInfo', args),
  signXml: (args) => ipcRenderer.invoke('signXml', args),
  submitToAeat: (args) => ipcRenderer.invoke('submitToAeat', args),
});
