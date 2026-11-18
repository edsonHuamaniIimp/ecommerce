import { describe, expect, it } from "vitest";
import { ESTADOS_SOLICITUD, SOLICITUDES_FILTRO_CONTRATO } from "@/lib/shared/constants";
import { solicitudesListarSchema, solicitudesPaisesSchema } from "../solicitudes.validator";

const EVENTO_ID = "11111111-1111-4111-8111-111111111111";

describe("solicitudesListarSchema - filtro de pais", () => {
  it("acepta un codigo ISO alpha-2 en mayusculas", () => {
    const parsed = solicitudesListarSchema.safeParse({ eventoId: EVENTO_ID, pais: "PE" });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.pais).toBe("PE");
      expect(parsed.data.page).toBe(1);
      expect(parsed.data.per_page).toBe(10);
    }
  });

  it("rechaza codigos invalidos o en minusculas", () => {
    expect(solicitudesListarSchema.safeParse({ eventoId: EVENTO_ID, pais: "pe" }).success).toBe(false);
    expect(solicitudesListarSchema.safeParse({ eventoId: EVENTO_ID, pais: "PER" }).success).toBe(false);
  });

  it("conserva los filtros existentes junto con pais", () => {
    const parsed = solicitudesListarSchema.safeParse({
      eventoId: EVENTO_ID,
      pais: "CL",
      estado: ESTADOS_SOLICITUD.OBSERVADO,
      page: "2",
      per_page: "25",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.pais).toBe("CL");
      expect(parsed.data.estado).toBe(ESTADOS_SOLICITUD.OBSERVADO);
      expect(parsed.data.page).toBe(2);
      expect(parsed.data.per_page).toBe(25);
    }
  });
});

describe("solicitudesListarSchema - filtro de contrato", () => {
  it("acepta los filtros sin contrato generado y sin contrato firmado", () => {
    for (const contrato of Object.values(SOLICITUDES_FILTRO_CONTRATO)) {
      const parsed = solicitudesListarSchema.safeParse({ eventoId: EVENTO_ID, contrato });
      expect(parsed.success).toBe(true);
      if (parsed.success) expect(parsed.data.contrato).toBe(contrato);
    }
  });

  it("rechaza valores desconocidos", () => {
    expect(solicitudesListarSchema.safeParse({ eventoId: EVENTO_ID, contrato: "sin_todo" }).success).toBe(false);
  });
});

describe("solicitudesPaisesSchema", () => {
  it("exige un evento valido", () => {
    expect(solicitudesPaisesSchema.safeParse({ eventoId: EVENTO_ID }).success).toBe(true);
    expect(solicitudesPaisesSchema.safeParse({ eventoId: "evento-1" }).success).toBe(false);
  });
});
