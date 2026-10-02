import { describe, expect, it } from "vitest";
import { planSincronizacionCatalogo, type TipoCatalogoEntrante } from "../catalogo-tipos";

const base: TipoCatalogoEntrante = {
  codigo: "VIP1",
  label: "VIP",
  nombre: "VIP 1",
  w: 3,
  d: 3,
  h: 2.5,
  color: "#FFD700",
  ambito: "interno",
  flgActivo: true,
};

const uso = (entries: Array<[string, number]>) => new Map(entries);

describe("planSincronizacionCatalogo", () => {
  it("da de alta codigos que no existen", () => {
    const plan = planSincronizacionCatalogo([], [base], uso([]));
    expect(plan.altas).toEqual([base]);
    expect(plan.cambios).toEqual([]);
    expect(plan.desactivar).toEqual([]);
  });

  it("no genera operaciones si nada cambio", () => {
    const plan = planSincronizacionCatalogo([{ ...base }], [{ ...base }], uso([]));
    expect(plan).toEqual({ altas: [], cambios: [], desactivar: [], bloqueados: [] });
  });

  it("actualiza cuando cambian medidas o color", () => {
    const editado = { ...base, w: 4, color: "#000000" };
    const plan = planSincronizacionCatalogo([{ ...base }], [editado], uso([]));
    expect(plan.cambios).toEqual([editado]);
  });

  it("normaliza codigo (trim + mayusculas) para comparar", () => {
    const plan = planSincronizacionCatalogo([{ ...base, codigo: "vip1" }], [{ ...base, codigo: " VIP1 " }], uso([]));
    expect(plan).toEqual({ altas: [], cambios: [], desactivar: [], bloqueados: [] });
  });

  it("desactiva codigos ausentes sin uso global", () => {
    const plan = planSincronizacionCatalogo([{ ...base }], [], uso([]));
    expect(plan.desactivar).toEqual(["VIP1"]);
  });

  it("bloquea la desactivacion de un codigo ausente que tiene bloques en cualquier mapa", () => {
    const plan = planSincronizacionCatalogo([{ ...base }], [], uso([["VIP1", 3]]));
    expect(plan.desactivar).toEqual([]);
    expect(plan.bloqueados).toEqual(["VIP1"]);
  });

  it("bloquea marcar inactivo un tipo con uso global", () => {
    const inactivo = { ...base, flgActivo: false };
    const plan = planSincronizacionCatalogo([{ ...base }], [inactivo], uso([["VIP1", 1]]));
    expect(plan.cambios).toEqual([]);
    expect(plan.bloqueados).toEqual(["VIP1"]);
  });

  it("permite desactivar un tipo sin uso global", () => {
    const inactivo = { ...base, flgActivo: false };
    const plan = planSincronizacionCatalogo([{ ...base }], [inactivo], uso([]));
    expect(plan.cambios).toEqual([inactivo]);
  });

  it("rename: alta del nuevo codigo y desactivacion del viejo sin uso", () => {
    const renombrado = { ...base, codigo: "VIP2" };
    const plan = planSincronizacionCatalogo([{ ...base }], [renombrado], uso([]));
    expect(plan.altas).toEqual([renombrado]);
    expect(plan.desactivar).toEqual(["VIP1"]);
  });

  it("rename con bloques en el viejo codigo: alta y bloqueo del viejo", () => {
    const renombrado = { ...base, codigo: "VIP2" };
    const plan = planSincronizacionCatalogo([{ ...base }], [renombrado], uso([["VIP1", 2]]));
    expect(plan.altas).toEqual([renombrado]);
    expect(plan.desactivar).toEqual([]);
    expect(plan.bloqueados).toEqual(["VIP1"]);
  });
});
