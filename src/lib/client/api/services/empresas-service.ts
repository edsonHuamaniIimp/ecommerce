import 'client-only';

import { internalApi } from "./internal-api";
import type {
  ActualizarEmpresaRequestDTO,
  CrearEmpresaRequestDTO,
  EmpresaDTO,
  EmpresasPaginatedDTO,
  FilaCargaEmpresaDTO,
  ListarEmpresasQueryDTO,
  PrevisualizacionCargaEmpresasDTO,
  ResultadoCredencialesEmpresaDTO,
  ResultadoImportacionEmpresasDTO,
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

  /** Crea la cuenta del Portal del Cliente y envia las credenciales por correo. */
  crearCuenta(id: string) {
    return internalApi.post<ResultadoCredencialesEmpresaDTO>("/api/empresas/crear-cuenta", { id });
  },

  /** Regenera la contrasena temporal y reenvia las credenciales. */
  reenviarCredenciales(id: string) {
    return internalApi.post<ResultadoCredencialesEmpresaDTO>("/api/empresas/reenviar-credenciales", { id });
  },
};
