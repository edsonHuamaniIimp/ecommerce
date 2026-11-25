import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/db", () => ({ prisma: {} }));

import { DD_DOCUMENTOS, DD_ESTADOS, DD_MATRIZ_FILTRO_VIGENCIA, DD_ORIGENES } from "@/lib/shared/constants";
import { condicionVigenciaExpediente } from "@/infrastructure/persistence/dd-matriz-evaluacion-repository";

const AHORA = new Date("2026-11-24T15:00:00.000Z");

describe("condicionVigenciaExpediente", () => {
  it("por vencer: solo aprobadas que vencen en los proximos 30 dias", () => {
    const c = condicionVigenciaExpediente(DD_MATRIZ_FILTRO_VIGENCIA.POR_VENCER, AHORA);
    expect(c?.estado).toBe(DD_ESTADOS.APROBADA);
    const [conFecha] = c?.OR as { fechaVencimiento: { gt: Date; lte: Date } }[];
    expect(conFecha?.fechaVencimiento.gt).toEqual(AHORA);
    const dias = (conFecha!.fechaVencimiento.lte.getTime() - AHORA.getTime()) / 86_400_000;
    expect(dias).toBeGreaterThan(29);
    expect(dias).toBeLessThanOrEqual(30);
  });

  it("vencidas: aprobadas con fecha de vencimiento pasada o sin fecha y aprobacion antigua", () => {
    const c = condicionVigenciaExpediente(DD_MATRIZ_FILTRO_VIGENCIA.VENCIDA, AHORA);
    expect(c?.estado).toBe(DD_ESTADOS.APROBADA);
    expect(c?.OR).toHaveLength(2);
    expect((c?.OR?.[0] as { fechaVencimiento: { lt: Date } }).fechaVencimiento.lt).toEqual(AHORA);
  });

  it("revalidacion pendiente: importadas vigentes de otro evento sin declaracion de vigencia aprobada", () => {
    const c = condicionVigenciaExpediente(DD_MATRIZ_FILTRO_VIGENCIA.REVALIDACION_PENDIENTE, AHORA, "evento-activo");
    expect(c?.estado).toBe(DD_ESTADOS.APROBADA);
    expect(c?.origen).toBe(DD_ORIGENES.IMPORTADO);
    expect(c?.eventoId).toEqual({ not: "evento-activo" });
    expect(c?.documentos).toEqual({ none: expect.objectContaining({ tipo: DD_DOCUMENTOS.DECLARACION_VIGENCIA }) });
  });

  it("sin evento activo no excluye ningun evento y un valor desconocido no filtra", () => {
    expect(condicionVigenciaExpediente(DD_MATRIZ_FILTRO_VIGENCIA.REVALIDACION_PENDIENTE, AHORA)?.eventoId).toBeUndefined();
    expect(condicionVigenciaExpediente("otra", AHORA)).toBeNull();
  });
});
