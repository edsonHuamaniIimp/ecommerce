import 'client-only';

import { internalApi } from "./internal-api";
import type {
  ActualizarEmpresaRequestDTO,
  CrearEmpresaRequestDTO,
  EmpresaDTO,
  EmpresaFuenteDTO,
  EmpresasPaginatedDTO,
  FilaCargaEmpresaDTO,
  ListarEmpresasQueryDTO,
  PersonaFuenteDTO,
  PrevisualizacionCargaEmpresasDTO,
  RegistrarCuentaEmpresaRequestDTO,
  ResultadoCreacionCuentasEmpresasDTO,
  ResultadoCredencialesEmpresaDTO,
  ResultadoImportacionEmpresasDTO,
  ResultadoRegistroEmpresaDTO,
} from "@/types/dto/empresas";

/** Empresas registradas por el backoffice (bandeja + alta/edicion). */
export const empresasService = {
  listar(params: ListarEmpresasQueryDTO = {}) {
    const qs = new URLSearchParams();
    if (params.page) qs.set("page", String(params.page));
    if (params.perPage) qs.set("perPage", String(params.perPage));
    if (params.search) qs.set("search", params.search);
    if (params.estado) qs.set("estado", params.estado);
    const sufijo = qs.toString() ? `?${qs.toString()}` : "";
    return internalApi.get<EmpresasPaginatedDTO>(`/api/empresas/listar${sufijo}`);
  },

  detalle(id: string) {
    return internalApi.get<EmpresaDTO>(`/api/empresas/detalle?id=${encodeURIComponent(id)}`);
  },

  crear(body: CrearEmpresaRequestDTO) {
    return internalApi.post<EmpresaDTO>("/api/empresas/crear", body);
  },

  actualizar(body: ActualizarEmpresaRequestDTO) {
    return internalApi.post<EmpresaDTO>("/api/empresas/actualizar", body);
  },

  cambiarEstado(id: string, estado: string) {
    return internalApi.post<EmpresaDTO>("/api/empresas/estado", { id, estado });
  },

  /** Carga masiva: valida el archivo (Excel/CSV) y devuelve la previsualizacion por fila. */
  previsualizarCarga(archivo: File) {
    const form = new FormData();
    form.append("archivo", archivo);
    return internalApi.postForm<PrevisualizacionCargaEmpresasDTO>("/api/empresas/carga-masiva/previsualizar", form);
  },

  /** Carga masiva: importa las filas validas (el backend omite las que tienen error). */
  importarCarga(filas: FilaCargaEmpresaDTO[]) {
    return internalApi.post<ResultadoImportacionEmpresasDTO>("/api/empresas/carga-masiva/importar", { filas });
  },

  /** Crea la cuenta de acceso (solo con RUC): devuelve la contrasena temporal para el administrador. */
  crearCuenta(id: string) {
    return internalApi.post<ResultadoCredencialesEmpresaDTO>("/api/empresas/crear-cuenta", { id });
  },

  /** Crea las cuentas de acceso (solo con RUC) de varias empresas; una fila por RUC. */
  crearCuentas(rucs: string[]) {
    return internalApi.post<ResultadoCreacionCuentasEmpresasDTO>("/api/empresas/crear-cuentas", { rucs });
  },

  /** Regenera la contrasena temporal y reenvia/entrega las credenciales. */
  reenviarCredenciales(id: string) {
    return internalApi.post<ResultadoCredencialesEmpresaDTO>("/api/empresas/reenviar-credenciales", { id });
  },

  /** Busca empresas en servicio-persona (fuente) por razon social o RUC. */
  buscarFuente(q: string) {
    return internalApi.get<EmpresaFuenteDTO[]>(`/api/empresas/fuente?q=${encodeURIComponent(q)}`);
  },

  /** Busca una persona en el padron interno (servicio-persona) por documento exacto. */
  buscarPersonaFuente(tipoDocumento: string, numeroDocumento: string) {
    const qs = new URLSearchParams({ tipoDocumento, numeroDocumento });
    return internalApi.get<PersonaFuenteDTO | null>(`/api/empresas/persona-fuente?${qs.toString()}`);
  },

  /** Registra la relacion usuario (persona) - empresa: la fuente es servicio-persona. */
  registrarCuentaEmpresa(body: RegistrarCuentaEmpresaRequestDTO) {
    return internalApi.post<ResultadoRegistroEmpresaDTO>("/api/empresas/registrar-cuenta-empresa", body);
  },
};
