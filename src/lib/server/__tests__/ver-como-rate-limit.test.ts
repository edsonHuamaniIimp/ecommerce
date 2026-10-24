import { describe, expect, it } from "vitest";
import { DomainError } from "@/domain/errors/domain-error";
import { exigirLimiteVerComo } from "../ver-como-rate-limit";

describe("exigirLimiteVerComo", () => {
  it("bloquea al superar el maximo de la ventana", () => {
    const actor = `admin-${Date.now()}-${Math.random()}`;
    expect(() => exigirLimiteVerComo(actor, "127.0.0.1", "buscar_empresa", 2)).not.toThrow();
    expect(() => exigirLimiteVerComo(actor, "127.0.0.1", "buscar_empresa", 2)).not.toThrow();
    expect(() => exigirLimiteVerComo(actor, "127.0.0.1", "buscar_empresa", 2)).toThrow(DomainError);
  });

  it("separa los limites por accion e IP", () => {
    const actor = `admin-${Date.now()}-${Math.random()}`;
    expect(() => exigirLimiteVerComo(actor, "10.0.0.1", "buscar_empresa", 1)).not.toThrow();
    expect(() => exigirLimiteVerComo(actor, "10.0.0.1", "ver_solicitudes", 1)).not.toThrow();
    expect(() => exigirLimiteVerComo(actor, "10.0.0.2", "buscar_empresa", 1)).not.toThrow();
  });
});
