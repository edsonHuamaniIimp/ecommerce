import { describe, expect, it } from "vitest";
import { erroresFormularioEmpresa, paisInicialValidacion, type EmpresaFormValidacionLike } from "../empresa-form-validacion";

const base: EmpresaFormValidacionLike = {
  ruc: "20601234567",
  tipoDocumento: "6",
  pais: "PE",
  razonSocial: "Minera Demo S.A.C.",
  inicioOperaciones: "2020-01-15",
  partidaElectronica: "11014857",
  emailContacto: "contacto@minera.pe",
  emailFacturacion: "facturacion@minera.pe",
  direccionFiscal: "Av. Los Ingenieros 245",
  representanteLegalNombre: "Juan Perez",
  representanteLegalTipoDocumento: "1",
  representanteLegalDni: "45871233",
  representanteCorreo: "juan@minera.pe",
  representanteCelular: "+51999888777",
  representanteDireccion: "Av. Arequipa 1250",
  responsableExteminTipoDocumento: "1",
  responsableExteminDni: "",
  responsableExteminEmail: "",
  responsablePagosTipoDocumento: "1",
  responsablePagosDni: "",
  responsablePagosEmail: "",
};

describe("erroresFormularioEmpresa", () => {
  it("no devuelve errores con los obligatorios completos", () => {
    expect(erroresFormularioEmpresa(base)).toEqual({});
  });

  it("exige partida electronica para RUC", () => {
    expect(erroresFormularioEmpresa({ ...base, partidaElectronica: "" }).partidaElectronica).toBeTruthy();
  });

  it("valida correos y domicilio fiscal", () => {
    const errores = erroresFormularioEmpresa({
      ...base,
      emailContacto: "no-es-correo",
      emailFacturacion: "tampoco",
      direccionFiscal: "https://minera.pe",
    });
    expect(errores.emailContacto).toBeTruthy();
    expect(errores.emailFacturacion).toBeTruthy();
    expect(errores.direccionFiscal).toBeTruthy();
  });

  it("valida el documento del representante legal", () => {
    expect(erroresFormularioEmpresa({ ...base, representanteLegalDni: "123" }).representanteLegalDni).toBeTruthy();
  });

  it("requerirTodos exige los datos comerciales y de coordinacion", () => {
    const errores = erroresFormularioEmpresa(base, { requerirTodos: true });
    expect(errores.nombreComercial).toBeTruthy();
    expect(errores.telefono).toBeTruthy();
    expect(errores.responsableExteminNombre).toBeTruthy();
    expect(errores.responsablePagosEmail).toBeTruthy();
  });

  it("requerirTodos acepta el formulario completo", () => {
    const errores = erroresFormularioEmpresa(
      {
        ...base,
        nombreComercial: "Minera Demo",
        telefono: "+5112345678",
        tipoComprobante: "factura",
        sitioWeb: "www.minera.pe",
        nombreFriso: "Minera Demo",
        facturarANombre: "Minera Demo S.A.C.",
        actividadEconomica: "Minería",
        estadoContribuyente: "ACTIVO - HABIDO",
        responsableExteminNombre: "Ana Perez",
        responsableExteminTelefono: "+51999888777",
        responsableExteminDni: "45871233",
        responsableExteminEmail: "ana@minera.pe",
        responsablePagosNombre: "Luis Perez",
        responsablePagosTelefono: "+51999888778",
        responsablePagosDni: "45871234",
        responsablePagosEmail: "luis@minera.pe",
      },
      { requerirTodos: true },
    );
    expect(errores).toEqual({});
  });
});

const completo: EmpresaFormValidacionLike = {
  ...base,
  nombreComercial: "Minera Demo",
  telefono: "+5112345678",
  tipoComprobante: "factura",
  sitioWeb: "www.minera.pe",
  nombreFriso: "Minera Demo",
  facturarANombre: "Minera Demo S.A.C.",
  actividadEconomica: "Mineria",
  estadoContribuyente: "ACTIVO - HABIDO",
  responsableExteminNombre: "Ana Perez",
  responsableExteminTelefono: "+51999888777",
  responsableExteminDni: "45871233",
  responsableExteminEmail: "ana@minera.pe",
  responsablePagosNombre: "Luis Perez",
  responsablePagosTelefono: "+51999888778",
  responsablePagosDni: "45871234",
  responsablePagosEmail: "luis@minera.pe",
};

const obligatoriosPerfil: Array<keyof EmpresaFormValidacionLike> = [
  "ruc",
  "pais",
  "razonSocial",
  "nombreComercial",
  "telefono",
  "tipoComprobante",
  "sitioWeb",
  "nombreFriso",
  "facturarANombre",
  "actividadEconomica",
  "estadoContribuyente",
  "inicioOperaciones",
  "partidaElectronica",
  "direccionFiscal",
  "emailContacto",
  "emailFacturacion",
  "representanteLegalNombre",
  "representanteLegalDni",
  "representanteCorreo",
  "representanteCelular",
  "representanteDireccion",
  "responsableExteminNombre",
  "responsableExteminTelefono",
  "responsableExteminDni",
  "responsableExteminEmail",
  "responsablePagosNombre",
  "responsablePagosTelefono",
  "responsablePagosDni",
  "responsablePagosEmail",
];

describe("perfil: todos los campos son obligatorios", () => {
  it("acepta la ficha completa", () => {
    expect(erroresFormularioEmpresa(completo, { requerirTodos: true })).toEqual({});
  });

  it.each(obligatoriosPerfil)("exige el campo %s", (campo) => {
    const errores = erroresFormularioEmpresa({ ...completo, [campo]: "" }, { requerirTodos: true });
    expect(errores[campo]).toBeTruthy();
  });

  it("valida los documentos de los responsables", () => {
    const errores = erroresFormularioEmpresa(
      { ...completo, responsableExteminDni: "123", responsablePagosDni: "abc" },
      { requerirTodos: true },
    );
    expect(errores.responsableExteminDni).toBeTruthy();
    expect(errores.responsablePagosDni).toBeTruthy();
  });
});
describe("paisInicialValidacion", () => {
  it("precarga el pais solo cuando tiene origen confirmado", () => {
    expect(paisInicialValidacion({ pais: "PE", paisOrigen: "manual" })).toBe("PE");
    expect(paisInicialValidacion({ pais: "CL", paisOrigen: "sie" })).toBe("CL");
    expect(paisInicialValidacion({ pais: "US", paisOrigen: "cliente" })).toBe("US");
  });

  it("deja vacio el pais heredado o sin origen para obligar a elegirlo", () => {
    expect(paisInicialValidacion({ pais: "PE", paisOrigen: null })).toBe("");
    expect(paisInicialValidacion({ pais: "PE" })).toBe("");
    expect(paisInicialValidacion({ pais: "PE", paisOrigen: "default" })).toBe("");
  });
});
