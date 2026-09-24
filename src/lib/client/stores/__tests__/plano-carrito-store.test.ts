import { beforeEach, describe, expect, it } from "vitest";
import { usePlanoCarrito, totalCarrito, conteoPorPlano } from "../plano-carrito-store";

const info = (bloqueId: string, pabellon = "pab-a") => ({
  bloqueId,
  standCode: `S-${bloqueId}`,
  pabellonCodigo: pabellon,
  tipoLabel: "ESTANDAR",
});

describe("usePlanoCarrito", () => {
  beforeEach(() => {
    usePlanoCarrito.getState().limpiar();
  });

  it("agrega y quita stands de un pabellon", () => {
    const s = usePlanoCarrito.getState();
    s.toggle("pab-a", info("b1"));
    s.toggle("pab-a", info("b2"));
    expect(usePlanoCarrito.getState().selecciones["pab-a"]).toEqual(["b1", "b2"]);

    s.toggle("pab-a", info("b1"));
    expect(usePlanoCarrito.getState().selecciones["pab-a"]).toEqual(["b2"]);
    expect(usePlanoCarrito.getState().items["b1"]).toBeUndefined();
  });

  it("mantiene carrito entre pabellones distintos", () => {
    const s = usePlanoCarrito.getState();
    s.toggle("pab-a", info("b1", "pab-a"));
    s.toggle("pab-b", info("b2", "pab-b"));
    const state = usePlanoCarrito.getState();
    expect(state.selecciones["pab-a"]).toEqual(["b1"]);
    expect(state.selecciones["pab-b"]).toEqual(["b2"]);
    expect(totalCarrito(state.selecciones)).toBe(2);
  });

  it("quitar elimina el item del plano correcto", () => {
    const s = usePlanoCarrito.getState();
    s.toggle("pab-a", info("b1", "pab-a"));
    s.toggle("pab-b", info("b2", "pab-b"));
    s.quitar("b2");
    const state = usePlanoCarrito.getState();
    expect(state.selecciones["pab-b"]).toEqual([]);
    expect(state.selecciones["pab-a"]).toEqual(["b1"]);
    expect(state.items["b2"]).toBeUndefined();
  });

  it("sincronizarPlano descarta ids invalidos y refresca metadata", () => {
    const s = usePlanoCarrito.getState();
    s.toggle("pab-a", info("b1", "pab-a"));
    s.toggle("pab-a", info("b2", "pab-a"));
    s.sincronizarPlano("pab-a", [{ ...info("b2", "pab-a"), standCode: "S-b2-nuevo" }]);
    const state = usePlanoCarrito.getState();
    expect(state.selecciones["pab-a"]).toEqual(["b2"]);
    expect(state.items["b1"]).toBeUndefined();
    expect(state.items["b2"]?.standCode).toBe("S-b2-nuevo");
  });

  it("seleccionarSolo reemplaza la seleccion del plano", () => {
    const s = usePlanoCarrito.getState();
    s.toggle("pab-a", info("b1", "pab-a"));
    s.toggle("pab-a", info("b2", "pab-a"));
    s.seleccionarSolo("pab-a", info("b3", "pab-a"));
    const state = usePlanoCarrito.getState();
    expect(state.selecciones["pab-a"]).toEqual(["b3"]);
    expect(state.items["b1"]).toBeUndefined();
    expect(state.items["b2"]).toBeUndefined();
  });

  it("conteoPorPlano agrupa por plano", () => {
    const s = usePlanoCarrito.getState();
    s.toggle("pab-a", info("b1", "pab-a"));
    s.toggle("pab-b", info("b2", "pab-b"));
    s.toggle("pab-b", info("b3", "pab-b"));
    expect(conteoPorPlano(usePlanoCarrito.getState().selecciones)).toEqual({ "pab-a": 1, "pab-b": 2 });
  });
});
