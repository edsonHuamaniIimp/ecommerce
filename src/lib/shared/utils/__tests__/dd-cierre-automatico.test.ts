import { describe, expect, it } from "vitest";
import { ddCierreAutomaticoUtils } from "../dd-cierre-automatico";
import {
  DD_CONFIG_CIERRE_ESTADOS,
  DD_CONFIG_CIERRE_LABELS,
  DD_MATRIZ_RESULTADOS_FINALES,
  DD_MENSAJES,
} from "@/lib/shared/constants";

/** Fecha en hora de Lima (UTC-5) expresada en UTC. */
const lima = (iso: string) => new Date(`${iso}-05:00`);

describe("ddCierreAutomaticoUtils.limiteObservacion", () => {
  it("resta solo dias habiles (lunes a viernes)", () => {
    // Miercoles 25/11/2026 10:00 Lima - 3 habiles = viernes 20/11/2026 10:00 Lima.
    expect(ddCierreAutomaticoUtils.limiteObservacion(lima("2026-11-25T10:00:00"), 3)).toEqual(lima("2026-11-20T10:00:00"));
    // Lunes 23/11/2026 - 1 habil = viernes 20/11/2026 (salta sabado y domingo).
    expect(ddCierreAutomaticoUtils.limiteObservacion(lima("2026-11-23T08:00:00"), 1)).toEqual(lima("2026-11-20T08:00:00"));
  });

  it("cuenta el dia en hora de Lima aunque en UTC ya sea el dia siguiente", () => {
    // Lunes 23/11/2026 22:00 Lima = martes 03:00 UTC. -1 habil debe dar viernes 20/11 22:00 Lima.
    expect(ddCierreAutomaticoUtils.limiteObservacion(lima("2026-11-23T22:00:00"), 1)).toEqual(lima("2026-11-20T22:00:00"));
  });

  it("con 0 dias devuelve el mismo instante", () => {
    const ahora = lima("2026-11-25T10:00:00");
    expect(ddCierreAutomaticoUtils.limiteObservacion(ahora, 0)).toEqual(ahora);
  });
});

describe("ddCierreAutomaticoUtils.vencidaEnDocumentacionObservada", () => {
  const limite = lima("2026-11-20T06:00:00");
  const base = {
    resultadoFinal: null,
    finalFecha: null,
    estadoExpediente: "observada",
    fechaRevision: lima("2026-11-10T10:00:00"),
    observacionesRegistradas: 2,
  };

  it("vence si la matriz muestra DOCUMENTACIÓN OBSERVADA, se observo en el sistema y paso el plazo", () => {
    expect(ddCierreAutomaticoUtils.vencidaEnDocumentacionObservada(base, limite)).toBe(true);
  });

  it("sin observaciones registradas en el sistema (importado del Excel) no vence", () => {
    expect(ddCierreAutomaticoUtils.vencidaEnDocumentacionObservada({ ...base, observacionesRegistradas: 0 }, limite)).toBe(false);
  });

  it("dentro del plazo no vence", () => {
    expect(
      ddCierreAutomaticoUtils.vencidaEnDocumentacionObservada({ ...base, fechaRevision: lima("2026-11-24T10:00:00") }, limite),
    ).toBe(false);
  });
});

describe("ddCierreAutomaticoUtils.accion", () => {
  it("SIN RESPUESTA y NO APTO cierran con su conclusion final; DOCUMENTACION OBSERVADA no cierra", () => {
    expect(ddCierreAutomaticoUtils.accion(DD_CONFIG_CIERRE_ESTADOS.SIN_RESPUESTA)).toMatchObject({
      cierra: true,
      resultadoFinal: DD_MATRIZ_RESULTADOS_FINALES.SIN_RESPUESTA,
      motivo: DD_MENSAJES.CIERRE_SIN_RESPUESTA,
    });
    expect(ddCierreAutomaticoUtils.accion(DD_CONFIG_CIERRE_ESTADOS.NO_APTO)).toMatchObject({
      cierra: true,
      resultadoFinal: DD_MATRIZ_RESULTADOS_FINALES.NO_APTO,
      motivo: DD_MENSAJES.CIERRE_PLAZO_VENCIDO,
    });
    expect(ddCierreAutomaticoUtils.accion(DD_CONFIG_CIERRE_ESTADOS.DOCUMENTACION_OBSERVADA).cierra).toBe(false);
  });

  it("acepta los valores guardados antes (rechazada / observada)", () => {
    expect(ddCierreAutomaticoUtils.normalizar("rechazada")).toBe(DD_CONFIG_CIERRE_ESTADOS.NO_APTO);
    expect(ddCierreAutomaticoUtils.normalizar("observada")).toBe(DD_CONFIG_CIERRE_ESTADOS.DOCUMENTACION_OBSERVADA);
    expect(ddCierreAutomaticoUtils.accion("rechazada")).toMatchObject({ resultadoFinal: DD_MATRIZ_RESULTADOS_FINALES.NO_APTO });
  });

  it("las opciones usan las etiquetas de la conclusion final de la matriz", () => {
    expect(DD_CONFIG_CIERRE_LABELS[DD_CONFIG_CIERRE_ESTADOS.SIN_RESPUESTA]).toBe("SIN RESPUESTA");
    expect(DD_CONFIG_CIERRE_LABELS[DD_CONFIG_CIERRE_ESTADOS.NO_APTO]).toBe("NO APTO");
    expect(DD_CONFIG_CIERRE_LABELS[DD_CONFIG_CIERRE_ESTADOS.DOCUMENTACION_OBSERVADA]).toBe("DOCUMENTACIÓN OBSERVADA");
  });
});
