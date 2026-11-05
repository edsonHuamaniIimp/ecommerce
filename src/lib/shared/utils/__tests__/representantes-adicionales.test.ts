import { describe, expect, it } from "vitest";
import {
  erroresRepresentanteAdicional,
  erroresRepresentantesAdicionales,
  representanteAdicionalDesdeDTO,
  representanteAdicionalPayload,
  representanteAdicionalVacio,
} from "../representantes-adicionales";

const valido = {
  nombre: "Ana Perez",
  tipoDocumento: "1",
  documento: "45871233",
  correo: "ana@empresa.pe",
  celular: "+51999888777",
  direccion: "Av. Arequipa 1250",
  partidaElectronica: "",
};

describe("representantes adicionales", () => {
  it("inicia con los campos vacios", () => {
    expect(representanteAdicionalVacio()).toMatchObject({ nombre: "", documento: "", tipoDocumento: "1" });
  });

  it("exige todos los datos de contacto y valida el documento", () => {
    const errores = erroresRepresentanteAdicional({ ...representanteAdicionalVacio(), documento: "123" });
    expect(errores.nombre).toBeTruthy();
    expect(errores.documento).toBeTruthy();
    expect(errores.correo).toBeTruthy();
    expect(errores.celular).toBeTruthy();
    expect(errores.direccion).toBeTruthy();
  });

  it("acepta un representante completo", () => {
    expect(erroresRepresentanteAdicional(valido)).toEqual({});
  });

  it("acepta carnet y pasaporte con mas de 8 caracteres", () => {
    expect(erroresRepresentanteAdicional({ ...valido, tipoDocumento: "4", documento: "CE123456" }).documento).toBeUndefined();
    expect(erroresRepresentanteAdicional({ ...valido, tipoDocumento: "7", documento: "123456789" }).documento).toBeUndefined();
  });

  it("valida cada representante con su propio tipo de documento", () => {
    const errores = erroresRepresentantesAdicionales([
      { ...valido, tipoDocumento: "1", documento: "12345678" },
      { ...valido, tipoDocumento: "4", documento: "CE123456" },
      { ...valido, tipoDocumento: "7", documento: "123456789" },
    ]);
    expect(errores).toEqual([{}, {}, {}]);
  });

  it("mapea desde/hacia el DTO sin perder el id", () => {
    const form = representanteAdicionalDesdeDTO({ id: "rep-1", nombre: "Ana", documento: "45871233" });
    expect(form.id).toBe("rep-1");
    expect(form.tipoDocumento).toBe("1");
    expect(representanteAdicionalPayload(form)).toMatchObject({ id: "rep-1", nombre: "Ana", documento: "45871233" });
  });
});
