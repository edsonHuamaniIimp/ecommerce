import { describe, expect, it } from "vitest";
import { ALERTA_CLAVES, getAlertaPlantilla, localizarAlerta } from "../index";

describe("alert-templates (campana es/en)", () => {
  it("renderiza la nueva solicitud en espanol e ingles", () => {
    const es = getAlertaPlantilla(ALERTA_CLAVES.NUEVA_SOLICITUD_REVISION, "es", { stands: "A-1, A-2" });
    expect(es?.titulo).toBe("Nueva solicitud para revision");
    expect(es?.mensaje).toContain("A-1, A-2");

    const en = getAlertaPlantilla(ALERTA_CLAVES.NUEVA_SOLICITUD_REVISION, "en", { stands: "A-1, A-2" });
    expect(en?.titulo).toBe("New request for review");
    expect(en?.mensaje).toContain("A-1, A-2");
  });

  it("interpola el total y traduce el area del turno", () => {
    const multiple = getAlertaPlantilla(ALERTA_CLAVES.SOLICITUD_MULTIPLE_CLIENTE, "es", { total: 3, stands: "A" });
    expect(multiple?.mensaje).toContain("3 stands");

    const en = getAlertaPlantilla(ALERTA_CLAVES.TURNO_REVISION, "en", { area: "asociado", stands: "A" });
    expect(en?.titulo).toBe("Review turn - Associate");

    const es = getAlertaPlantilla(ALERTA_CLAVES.TURNO_REVISION, "es", { area: "asociado", stands: "A" });
    expect(es?.titulo).toBe("Turno de revision - Asociado");
  });

  it("idioma invalido o nulo cae a espanol", () => {
    const es = getAlertaPlantilla(ALERTA_CLAVES.REVISION_COMPLETADA, "es", { stands: "A" });
    expect(getAlertaPlantilla(ALERTA_CLAVES.REVISION_COMPLETADA, null, { stands: "A" })).toEqual(es);
    expect(getAlertaPlantilla(ALERTA_CLAVES.REVISION_COMPLETADA, "pt", { stands: "A" })).toEqual(es);
  });

  it("localizarAlerta usa la plantilla y cae al texto guardado (legacy)", () => {
    const fila = { clave: ALERTA_CLAVES.CONTRATO_FIRMADO_SUBIDO, datos: { stands: "B-1" }, titulo: "x", mensaje: "y" };
    expect(localizarAlerta(fila, "en").titulo).toBe("Signed contract uploaded");
    expect(localizarAlerta(fila, "es").mensaje).toContain("B-1");

    const legacy = { clave: null, datos: null, titulo: "Viejo", mensaje: "Texto" };
    expect(localizarAlerta(legacy, "en")).toEqual({ titulo: "Viejo", mensaje: "Texto" });

    const desconocida = { clave: "clave-inexistente", datos: {}, titulo: "Guardado", mensaje: "Guardado" };
    expect(localizarAlerta(desconocida, "en")).toEqual({ titulo: "Guardado", mensaje: "Guardado" });
  });
});
