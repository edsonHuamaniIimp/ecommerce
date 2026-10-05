import { internalApi } from "./internal-api";
import type {
  ActualizarUsuarioDTO,
  CrearCuentaUsuarioDTO,
  CrearUsuarioDTO,
  CrearUsuariosLoteDTO,
  EnviarAccesosUsuarioDTO,
  PersonaApiDTO,
  ResultadoCreacionUsuarioDTO,
  ResultadoEnvioAccesosDTO,
  ResultadoLoteUsuariosDTO,
  UsuarioPortalDTO,
} from "@/types/dto/usuarios/usuario.dto";

export const usuariosService = {
  /** Usuarios del Portal del Cliente con su empresa (bandeja de Usuarios). */
  listar() {
    return internalApi.get<UsuarioPortalDTO[]>("/api/usuarios/listar");
  },

  /** Busca personas en servicio-persona (fuente) por apellido paterno o documento. */
  buscarPersonas(q: string) {
    return internalApi.get<PersonaApiDTO[]>(`/api/usuarios/personas?q=${encodeURIComponent(q)}`);
  },

  /** Alta individual: crea/encuentra la persona en la fuente y el acceso local con su sie_code. */
  crear(body: CrearUsuarioDTO) {
    return internalApi.post<ResultadoCreacionUsuarioDTO>("/api/usuarios/crear", body);
  },

  /** Alta por lote: todos los usuarios quedan vinculados a la misma empresa y rol. */
  crearLote(body: CrearUsuariosLoteDTO) {
    return internalApi.post<ResultadoLoteUsuariosDTO>("/api/usuarios/crear-lote", body);
  },

  /** Crea la cuenta local para una persona existente en servicio-persona. */
  crearCuenta(body: CrearCuentaUsuarioDTO) {
    return internalApi.post<ResultadoCreacionUsuarioDTO>("/api/usuarios/crear-cuenta", body);
  },

  /** Asigna/cambia la empresa del acceso local. */
  actualizar(body: ActualizarUsuarioDTO) {
    return internalApi.post<UsuarioPortalDTO>("/api/usuarios/actualizar", body);
  },

  /** Regenera la credencial temporal y la envia al correo del usuario. */
  enviarAccesos(body: EnviarAccesosUsuarioDTO) {
    return internalApi.post<ResultadoEnvioAccesosDTO>("/api/usuarios/enviar-accesos", body);
  },
};
