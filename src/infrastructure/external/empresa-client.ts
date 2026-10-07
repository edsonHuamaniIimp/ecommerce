/**
 * Cliente de empresas de servicio-persona (fuente de empresas del ecosistema IIMP).
 * Reusa la autenticacion compartida (token 30 min con reintento unico ante 401).
 * Los datos de la empresa viven en la fuente; aca solo se usa su `sie_code`.
 *
 * Doc: docs/05-integraciones/guia-consumo-servicio-persona.md
 */
import { peticionServicioPersona } from "./servicio-persona-auth";
import type { EmpresaApi, IEmpresaClient, NuevaEmpresaApi } from "@/domain/ports/empresa-client";

function mapearEmpresa(raw: Record<string, unknown>): EmpresaApi {
  const texto = (valor: unknown) => (valor === undefined || valor === null ? undefined : String(valor));
  return {
    sie_code: texto(raw.sie_code),
    nombre: texto(raw.nombre),
    id_tipo_documento: texto(raw.id_tipo_documento),
    documento: texto(raw.documento),
    direccion: texto(raw.direccion),
    correo: texto(raw.correo),
    telefono: texto(raw.telefono),
    link_logo: texto(raw.link_logo),
    pais: typeof raw.pais === "number" ? raw.pais : undefined,
  };
}

function cuerpoEmpresa(dto: NuevaEmpresaApi): Record<string, unknown> {
  return {
    nombre: dto.nombre,
    id_tipo_documento: dto.id_tipo_documento,
    documento: dto.documento,
    direccion: dto.direccion,
    correo: dto.correo,
    telefono: dto.telefono,
    pais: dto.pais,
    ...(dto.link_logo ? { link_logo: dto.link_logo } : {}),
  };
}

export class EmpresaApiClient implements IEmpresaClient {
  async buscarEmpresas(q: string): Promise<EmpresaApi[]> {
    const json = await peticionServicioPersona<{ contenido?: Record<string, unknown>[] }>(
      `/empresas?q=${encodeURIComponent(q)}&pagina=0&tamanio=20`,
    );
    return (json.contenido ?? []).map(mapearEmpresa);
  }

  async buscarPorDocumento(tipoDocumento: string, numeroDocumento: string): Promise<EmpresaApi | null> {
    const json = await peticionServicioPersona<Record<string, unknown> | null>(
      `/empresas/documento?tipoDocumento=${encodeURIComponent(tipoDocumento)}&numeroDocumento=${encodeURIComponent(numeroDocumento)}`,
      { permitir404: true },
    );
    return json ? mapearEmpresa(json) : null;
  }

  async crearEmpresa(dto: NuevaEmpresaApi): Promise<EmpresaApi> {
    const creada = await peticionServicioPersona<Record<string, unknown>>("/empresas", {
      method: "POST",
      body: cuerpoEmpresa(dto),
    });
    return mapearEmpresa(creada);
  }

  async actualizarEmpresa(sieCode: string, dto: NuevaEmpresaApi): Promise<EmpresaApi> {
    const actualizada = await peticionServicioPersona<Record<string, unknown>>(
      `/empresas/${encodeURIComponent(sieCode)}`,
      { method: "PUT", body: cuerpoEmpresa(dto) },
    );
    return mapearEmpresa(actualizada);
  }
}
