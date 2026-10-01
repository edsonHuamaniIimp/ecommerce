import { describe, expect, it } from "vitest";
import { getPlantillaEmail } from "../index";
import type { DatosPlantilla } from "../tipos";

const DATOS: { [K in keyof DatosPlantilla]: DatosPlantilla[K] } = {
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
    revisiones: [{ area: "logistica", estado: "aprobado", comentario: null }],
  },
  "comprobante-pago": {
    standCode: "BLOQUE-01",
    tipo: "factura",
    numero: "F001-1234",
  },
};

const KINDS = Object.keys(DATOS) as (keyof DatosPlantilla)[];

describe("getPlantillaEmail", () => {
  it("todas las plantillas generan asunto y html en espanol", () => {
    for (const kind of KINDS) {
      const { subject, html } = getPlantillaEmail(kind, "es", DATOS[kind] as never);
      expect(subject.length, kind).toBeGreaterThan(0);
      expect(html.length, kind).toBeGreaterThan(50);
    }
  });

  it("todas las plantillas generan asunto y html en ingles", () => {
    for (const kind of KINDS) {
      const { subject, html } = getPlantillaEmail(kind, "en", DATOS[kind] as never);
      expect(subject.length, kind).toBeGreaterThan(0);
      expect(html.length, kind).toBeGreaterThan(50);
    }
  });

  it("el idioma cambia el asunto (es vs en)", () => {
    const es = getPlantillaEmail("credenciales-empresa", "es", DATOS["credenciales-empresa"]);
    const en = getPlantillaEmail("credenciales-empresa", "en", DATOS["credenciales-empresa"]);
    expect(es.subject).toContain("Portal del Cliente");
    expect(en.subject).toContain("Client Portal");
  });

  it("idioma invalido o nulo cae a espanol", () => {
    const es = getPlantillaEmail("invitacion-cuenta", "es", DATOS["invitacion-cuenta"]);
    const nulo = getPlantillaEmail("invitacion-cuenta", null, DATOS["invitacion-cuenta"]);
    const invalido = getPlantillaEmail("invitacion-cuenta", "pt", DATOS["invitacion-cuenta"]);
    expect(nulo.subject).toBe(es.subject);
    expect(invalido.subject).toBe(es.subject);
  });

  it("la plantilla de revision refleja el estado y escapa el contenido", () => {
    const { subject, html } = getPlantillaEmail("revision-resultado", "en", {
      ...DATOS["revision-resultado"],
      standCode: "<BLOQUE-01>",
    });
    expect(subject).toContain("Stand <BLOQUE-01>");
    expect(html).toContain("&lt;BLOQUE-01&gt;");
  });
});
