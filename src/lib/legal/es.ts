import { LEGAL_INFO as I } from "./company";
import type { LegalBundle } from "./types";

export const legalEs: LegalBundle = {
  privacy: {
    title: "Política de Privacidad",
    intro: `En ${I.company} ("nosotros", el "Responsable") nos tomamos en serio la protección de sus datos personales. Esta Política explica qué datos tratamos a través de la aplicación ${I.appName}, con qué fines y qué derechos le asisten, de conformidad con el Reglamento (UE) 2016/679 (RGPD) y la Ley Orgánica 3/2018 (LOPDGDD).`,
    sections: [
      {
        heading: "1. Responsable del tratamiento",
        body: [
          `Titular: ${I.company}`,
          `NIF/CIF: ${I.nif}`,
          `Domicilio: ${I.address}`,
          `Correo de contacto: ${I.email}`,
          `Sitio web: ${I.website}`,
        ],
      },
      {
        heading: "2. Datos que tratamos",
        body: [
          "Datos de cuenta: correo electrónico e identificador de usuario, y datos de su proveedor de identidad si accede con Google.",
          "Datos de empresa que usted introduce: razón social, NIF, dirección, cuentas bancarias.",
          "Datos de sus clientes y de facturación que usted introduce para emitir documentos (facturas y proformas).",
          "Datos técnicos: registros de inicio de sesión, fecha y hora de acceso, y datos estrictamente necesarios para la seguridad.",
          "Si conecta una cuenta de correo (p. ej. Gmail) para el envío de facturas, almacenamos de forma cifrada los tokens de autorización necesarios para ese envío.",
          "Identificador analítico anónimo: si acepta las cookies analíticas, almacenamos en su navegador un identificador anónimo aleatorio para contar las visitas y distinguir las visitas nuevas de las recurrentes. No está vinculado a su nombre, correo ni dirección IP, y se elimina al retirar el consentimiento o borrar el navegador.",
        ],
      },
      {
        heading: "3. Finalidades y bases jurídicas",
        body: [
          "Prestar el servicio de gestión y emisión de facturas (ejecución del contrato, art. 6.1.b RGPD).",
          "Gestionar su cuenta, suscripción y acceso (ejecución del contrato).",
          "Cumplir obligaciones legales, incluida la normativa de facturación y, en su caso, la remisión de registros a la AEAT (Verifactu) (obligación legal, art. 6.1.c RGPD).",
          "Garantizar la seguridad del servicio y prevenir el fraude (interés legítimo, art. 6.1.f RGPD).",
          "Cookies analíticas o de marketing, únicamente con su consentimiento (art. 6.1.a RGPD).",
        ],
      },
      {
        heading: "4. Conservación de los datos",
        body: [
          "Conservamos los datos mientras su cuenta esté activa.",
          "Los datos de facturación se conservan durante los plazos exigidos por la legislación fiscal y mercantil española (con carácter general, varios años).",
          "Tras la eliminación de la cuenta, suprimimos o anonimizamos los datos que no estemos obligados a conservar por ley.",
        ],
      },
      {
        heading: "5. Destinatarios y encargados del tratamiento",
        body: [
          "Proveedor de infraestructura y alojamiento en la nube que presta el servicio backend de la aplicación.",
          "Proveedores de correo electrónico que usted decida conectar para el envío de facturas.",
          "La Agencia Estatal de Administración Tributaria (AEAT) cuando proceda el envío de registros de facturación.",
          "No vendemos sus datos personales a terceros.",
        ],
      },
      {
        heading: "6. Transferencias internacionales",
        body: [
          "Si algún proveedor trata datos fuera del Espacio Económico Europeo, se aplicarán las garantías adecuadas previstas por el RGPD (p. ej. Cláusulas Contractuales Tipo).",
        ],
      },
      {
        heading: "7. Sus derechos",
        body: [
          "Puede ejercer los derechos de acceso, rectificación, supresión, oposición, limitación del tratamiento y portabilidad de los datos.",
          `Para ejercerlos, escriba a ${I.email}. Desde la propia aplicación puede exportar sus datos y eliminar su cuenta.`,
          `Si considera que sus derechos no se han atendido, puede presentar una reclamación ante la ${I.authority} (${I.authorityUrl}).`,
        ],
      },
      {
        heading: "8. Seguridad",
        body: [
          "Aplicamos medidas técnicas y organizativas razonables, incluido el cifrado de credenciales sensibles y el control de acceso, para proteger sus datos.",
        ],
      },
      {
        heading: "9. Cambios en esta Política",
        body: [
          "Podemos actualizar esta Política. Publicaremos la versión vigente en esta página con su fecha de actualización.",
        ],
      },
    ],
  },
  terms: {
    title: "Términos y Condiciones",
    intro: `Estos Términos regulan el uso de la aplicación ${I.appName} prestada por ${I.company}. Al registrarse o utilizar el servicio, usted acepta estos Términos.`,
    sections: [
      {
        heading: "1. Objeto del servicio",
        body: [
          `${I.appName} es una herramienta de gestión y emisión de facturas y documentos comerciales, incluida la integración con el sistema Verifactu de la AEAT cuando corresponda.`,
        ],
      },
      {
        heading: "2. Cuenta y acceso",
        body: [
          "Debe facilitar información veraz al registrarse y mantener la confidencialidad de sus credenciales.",
          "El acceso puede estar sujeto a una suscripción o a un código de acceso válido.",
          "Usted es responsable de la actividad que se realice desde su cuenta.",
        ],
      },
      {
        heading: "3. Uso aceptable",
        body: [
          "No utilizará el servicio con fines ilícitos ni para emitir documentación fraudulenta.",
          "No intentará vulnerar la seguridad del servicio ni acceder a datos de otros usuarios.",
        ],
      },
      {
        heading: "4. Responsabilidad del usuario sobre los datos fiscales",
        body: [
          "Usted es el único responsable de la exactitud de los datos fiscales y de facturación que introduce y emite.",
          "El servicio es una herramienta de apoyo; no sustituye el asesoramiento fiscal o jurídico profesional.",
        ],
      },
      {
        heading: "5. Disponibilidad y limitación de responsabilidad",
        body: [
          "El servicio se presta \u201ctal cual\u201d. Procuramos su disponibilidad continua pero no garantizamos un funcionamiento ininterrumpido.",
          "En la medida permitida por la ley, no seremos responsables de daños indirectos o pérdida de datos derivados del uso del servicio.",
        ],
      },
      {
        heading: "6. Suscripción y pagos",
        body: [
          "Las condiciones de la suscripción, su duración y renovación se mostrarán antes de la contratación, cuando proceda.",
        ],
      },
      {
        heading: "7. Resolución",
        body: [
          "Puede dejar de usar el servicio y eliminar su cuenta en cualquier momento desde los ajustes de la aplicación.",
          "Podemos suspender o cancelar cuentas que incumplan estos Términos.",
        ],
      },
      {
        heading: "8. Legislación aplicable",
        body: [
          "Estos Términos se rigen por la legislación española. Para cualquier controversia, las partes se someten a los juzgados y tribunales que correspondan conforme a la normativa de consumo aplicable.",
        ],
      },
    ],
  },
  cookies: {
    title: "Política de Cookies",
    intro: `Esta Política explica cómo ${I.appName} utiliza cookies y tecnologías similares, conforme a la LSSI-CE y al RGPD.`,
    sections: [
      {
        heading: "1. ¿Qué son las cookies?",
        body: [
          "Las cookies son pequeños archivos que se almacenan en su dispositivo para permitir el funcionamiento de la aplicación o recordar sus preferencias.",
        ],
      },
      {
        heading: "2. Cookies que utilizamos",
        body: [
          "Cookies técnicas (necesarias): imprescindibles para el inicio de sesión, la seguridad y el funcionamiento básico. No requieren consentimiento.",
          "Cookies analíticas: nos ayudan a entender el uso de la aplicación, incluido un identificador anónimo almacenado en su navegador para contar visitas únicas y recurrentes. Solo se activan con su consentimiento.",
          "Cookies de marketing: se utilizarían para publicidad personalizada. Solo se activan con su consentimiento.",
        ],
      },
      {
        heading: "3. Gestión del consentimiento",
        body: [
          "Al acceder por primera vez se le muestra un banner para aceptar, rechazar o configurar las cookies no necesarias.",
          "Puede modificar su elección en cualquier momento borrando los datos del navegador para esta aplicación.",
        ],
      },
      {
        heading: "4. Cambios",
        body: [
          "Actualizaremos esta Política cuando incorporemos nuevas cookies o servicios.",
        ],
      },
    ],
  },
  notice: {
    title: "Aviso Legal",
    intro: `En cumplimiento del artículo 10 de la Ley 34/2002 de Servicios de la Sociedad de la Información y de Comercio Electrónico (LSSI-CE), se facilitan los siguientes datos.`,
    sections: [
      {
        heading: "1. Datos identificativos",
        body: [
          `Titular: ${I.company}`,
          `NIF/CIF: ${I.nif}`,
          `Domicilio: ${I.address}`,
          `Correo electrónico: ${I.email}`,
          `Sitio web: ${I.website}`,
        ],
      },
      {
        heading: "2. Objeto",
        body: [
          `El presente Aviso Legal regula el uso del sitio web y de la aplicación ${I.appName}, titularidad del Responsable.`,
        ],
      },
      {
        heading: "3. Propiedad intelectual e industrial",
        body: [
          "El software, marcas, logotipos y contenidos del servicio son titularidad del Responsable o de sus licenciantes y están protegidos por la normativa de propiedad intelectual e industrial.",
        ],
      },
      {
        heading: "4. Responsabilidad",
        body: [
          "El Responsable no se hace responsable del uso indebido de la aplicación ni de los contenidos introducidos por los usuarios.",
        ],
      },
      {
        heading: "5. Legislación aplicable",
        body: [
          "El presente Aviso Legal se rige por la legislación española.",
        ],
      },
    ],
  },
};
