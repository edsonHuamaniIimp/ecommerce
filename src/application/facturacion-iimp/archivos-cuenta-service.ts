import { API_ERROR_CODES } from "@/lib/shared/constants";
import { DomainError } from "@/lib/server/router";
import type { ClienteIdent, IFacturacionRepository } from "@/domain/ports/facturacion-repository";
import type { ISolicitudesRepository } from "@/domain/ports/solicitudes-repository";
import type { IReservaIimpClient, ReservaIimpArchivo, ReservaIimpArchivoInput, ReservaIimpCuentaInput } from "@/domain/ports/reserva-iimp-client";
import { validarArchivoIImp, normalizarLinkArchivoIImp } from "./validar-archivo-iimp";
import { numeroSolicitudIImp } from "./numero-solicitud";

/**
 * Archivos de la cuenta corriente del IIMP (OC, HES, detraccion y diferencia):
 * la empresa registra links desde Mis pagos y el IIMP los asocia a su cuenta.
 * La cuenta corriente la crea `POST /stands/reserva`; aqui solo se opera sobre ella.
 */
export class ArchivosCuentaCorrienteApplicationService {
  constructor(
    private readonly facturacion: Pick<IFacturacionRepository, "esPropietarioDeCuota" | "facturacionDeCuota">,
    private readonly solicitudes: Pick<ISolicitudesRepository, "datosReservaIImp">,
    private readonly reserva: Pick<IReservaIimpClient, "agregarArchivos" | "listarArchivos" | "eliminarArchivo">,
  ) {}

  async listar(cuotaId: string, ident: ClienteIdent): Promise<ReservaIimpArchivo[]> {
    const { cuenta } = await this.cuentaDeCuota(cuotaId, ident);
    return this.reserva.listarArchivos(cuenta);
  }

  async agregar(cuotaId: string, archivo: ReservaIimpArchivoInput, ident: ClienteIdent): Promise<ReservaIimpArchivo[]> {
    /* v3: un archivo sin link se ignora; se responde la lista actual de la cuenta. */
    if (!archivo.link?.trim()) return this.listar(cuotaId, ident);
    const { cuenta, cuotas } = await this.cuentaDeCuota(cuotaId, ident);
    const normalizado = { ...archivo, link: normalizarLinkArchivoIImp(archivo.link) };
    validarArchivoIImp(normalizado, cuotas);
    return this.reserva.agregarArchivos({ ...cuenta, archivos: [normalizado] });
  }

  async eliminar(cuotaId: string, item: number, ident: ClienteIdent): Promise<ReservaIimpArchivo[]> {
    if (!Number.isInteger(item) || item <= 0) {
      throw new DomainError("Item de archivo invalido", API_ERROR_CODES.VALIDATION, 400);
    }
    const { cuenta } = await this.cuentaDeCuota(cuotaId, ident);
    return this.reserva.eliminarArchivo({ ...cuenta, item });
  }

  /** Resuelve la cuenta corriente del IIMP a partir de una cuota propia del cliente. */
  private async cuentaDeCuota(cuotaId: string, ident: ClienteIdent): Promise<{ cuenta: ReservaIimpCuentaInput; cuotas: number }> {
    const propio = await this.facturacion.esPropietarioDeCuota(cuotaId, ident);
    if (!propio) throw new DomainError("Sin acceso a esta cuota", API_ERROR_CODES.FORBIDDEN, 403);
    const fact = await this.facturacion.facturacionDeCuota(cuotaId);
    if (!fact) throw new DomainError("Cuota no encontrada", API_ERROR_CODES.NOT_FOUND, 404);
    const datos = await this.solicitudes.datosReservaIImp(fact.solicitudId);
    if (!datos) throw new DomainError("Solicitud no encontrada", API_ERROR_CODES.NOT_FOUND, 404);

    const registrada = Boolean(datos.iimpContrato) && Number(datos.iimpCuentaCorriente ?? 0) > 0;
    if (!registrada) {
      throw new DomainError("La reserva aun no esta registrada en el IIMP; enviala primero desde Mis pagos", API_ERROR_CODES.CONFLICT, 409);
    }
    return {
      /* v3: los endpoints de archivos identifican la cuenta con `NumeroSolicitud` (determinista). */
      cuenta: { numeroSolicitud: numeroSolicitudIImp(fact.solicitudId) },
      cuotas: datos.planCuotas?.cuotas?.length ?? 0,
    };
  }
}
