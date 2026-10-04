/**
 * Render de prueba de las plantillas de correo (sin RESEND_API_KEY).
 * Uso: npx tsx scripts/preview-email.ts <plantilla> <es|en>
 * Salida: <tmp>/email-<plantilla>-<idioma>.html
 * Ejemplo: npx tsx scripts/preview-email.ts revision-resultado en
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getPlantillaEmail } from "../src/lib/server/mail-templates";
import type { DatosPlantilla, PlantillaEmailKind } from "../src/lib/server/mail-templates";

const DATOS: { [K in PlantillaEmailKind]: DatosPlantilla[K] } = {
  "codigo-registro": { codigo: "482913", nombre: "Jorge Quispe" },
  "reset-password": { nombre: "Jorge Quispe", url: "https://ejemplo.pe/reset/token", minutos: 30 },
  "credenciales-empresa": {
    razonSocial: "Minera Cordillera S.A.C.",
    nombreContacto: "Jorge Quispe Ramos",
    email: "contacto@mineracordillera.pe",
    passwordTemporal: "TempPass22",
  },
  "notificacion-solicitud-cuenta": {
    email: "contacto@mineracordillera.pe",
    nombre: "Jorge",
    apellidos: "Quispe",
    razonSocial: "Minera Cordillera S.A.C.",
    ruc: "20601234567",
  },
  "invitacion-cuenta": { nombre: "Jorge", razonSocial: "Minera Cordillera S.A.C.", token: "tok-123" },
  "rechazo-cuenta": { nombre: "Jorge", razonSocial: "Minera Cordillera S.A.C.", motivo: "Documentos incompletos" },
  "reserva-confirmacion": {
    standCodes: "BLOQUE-01, BLOQUE-04",
    razonSocial: "Minera Cordillera S.A.C.",
    documento: "RUC 20601234567",
    esMultiple: true,
    solicitudId: "sol-1",
  },
  "reserva-admin": {
    standCodes: "BLOQUE-01, BLOQUE-04",
    razonSocial: "Minera Cordillera S.A.C.",
    documento: "RUC 20601234567",
    emailCliente: "contacto@mineracordillera.pe",
    solicitudId: "sol-1",
  },
  "revision-resultado": {
    standCode: "BLOQUE-01",
    empresa: "Minera Cordillera S.A.C.",
    nombre: "Jorge Quispe",
    email: "contacto@mineracordillera.pe",
    gessStandId: "stand-1",
    modo: "automatico",
    revisiones: [
      { area: "asociado", estado: "aprobado", comentario: "Todo conforme." },
      { area: "legal", estado: "aprobado", comentario: null },
    ],
  },
  "comprobante-pago": { standCode: "BLOQUE-01", tipo: "factura", numero: "F001-1234" },
};

const plantilla = (process.argv[2] ?? "revision-resultado") as PlantillaEmailKind;
const idioma = process.argv[3] ?? "en";
if (!(plantilla in DATOS)) throw new Error(`Plantilla desconocida: ${plantilla}`);

const { subject, html } = getPlantillaEmail(plantilla, idioma, DATOS[plantilla] as never);
const destino = path.join(os.tmpdir(), `email-${plantilla}-${idioma}.html`);
fs.writeFileSync(destino, html);
console.log(`Asunto: ${subject}`);
console.log(`HTML -> ${destino} (${html.length} chars)`);
