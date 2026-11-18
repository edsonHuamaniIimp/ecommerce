import { API_ERROR_CODES, RECORDATORIOS_FACTURACION } from "@/lib/shared/constants";
import { DomainError } from "@/lib/server/router";
import { enviarEmailPlantilla } from "@/lib/server/email";
import { numeroSolicitudIImp } from "@/application/facturacion-iimp/numero-solicitud";
import { resolverIdiomaDestinatario } from "@/application/idioma/resolver-idioma";
import { TIPOS_ARCHIVO_IIMP_LABELS, tiposRequeridosPorRequisitos } from "@/lib/shared/utils/requisitos-facturacion";
import type { IAuthRepository } from "@/domain/ports/auth-repository";
import type { IFacturacionRepository, RecordatorioCandidatoRow } from "@/domain/ports/facturacion-repository";
import type { IReservaIimpClient } from "@/domain/ports/reserva-iimp-client";
import type { EnviarRecordatoriosRequestDTO } from "@/types/dto/facturacion/enviar-recordatorios-request.dto";
import type { EnviarRecordatoriosResultDTO } from "@/types/dto/facturacion/enviar-recordatorios-result.dto";
import type { RecordatorioCandidatoDTO } from "@/types/dto/facturacion/recordatorio-candidato.dto";
import type { RecordatoriosResponseDTO } from "@/types/dto/facturacion/recordatorios-response.dto";

/** Consultas simultaneas al IIMP al verificar documentos de una lista de empresas. */
const CONCURRENCIA_VERIFICACION_IIMP = 5;

/** La reserva esta declarada en el IIMP cuando tiene contrato y cuenta corriente. */
function cuentaDeclarada(row: RecordatorioCandidatoRow): boolean {
  return Boolean(row.iimpContrato) && Number(row.iimpCuentaCorriente ?? 0) > 0;
}

function aDTO(row: RecordatorioCandidatoRow, faltantes: string[] = []): RecordatorioCandidatoDTO {
  return {
    facturacionId: row.facturacionId,
    solicitudId: row.solicitudId,
    empresa: row.empresa,
    email: row.email,
    standCode: row.standCode,
    moneda: row.moneda,
    cuotasPendientes: row.cuotasPendientes,
    montoPendiente: row.montoPendiente,
    faltantes,
  };
}

/**
 * Recordatorios de facturacion desde la bandeja de Contabilidad:
 * - Empresas con pagos pendientes que aun no registraron su solicitud en el IIMP.
 * - Empresas registradas que declararon requisitos (OC/HES/valorizacion/otros) y
 *   no registraron esos documentos en su cuenta corriente.
 *
 * La verificacion documental se hace contra el IIMP al momento de listar y de
 * enviar, para no notificar por datos desactualizados.
 */
export class RecordatoriosFacturacionApplicationService {
  constructor(
    private readonly repo: Pick<
      IFacturacionRepository,
      "listarCandidatosRecordatorio" | "registrarNotificacionRecordatorio"
    >,
    private readonly reserva: Pick<IReservaIimpClient, "listarArchivos">,
    private readonly auth: IAuthRepository,
  ) {}

  async listarCandidatos(): Promise<RecordatoriosResponseDTO> {
    const rows = (await this.repo.listarCandidatosRecordatorio()).filter((row) => row.cuotasPendientes > 0);

    const sinSolicitud = rows.filter((row) => !cuentaDeclarada(row)).map((row) => aDTO(row));
    const declaradas = rows
      .filter(cuentaDeclarada)
      .filter((row) => tiposRequeridosPorRequisitos(row.requisitos).length > 0);

    let noVerificados = 0;
    const documentosPendientes: RecordatorioCandidatoDTO[] = [];
    for (let i = 0; i < declaradas.length; i += CONCURRENCIA_VERIFICACION_IIMP) {
      const lote = declaradas.slice(i, i + CONCURRENCIA_VERIFICACION_IIMP);
      const resultados = await Promise.all(
        lote.map(async (row) => {
          try {
            const archivos = await this.reserva.listarArchivos({
              numeroSolicitud: numeroSolicitudIImp(row.solicitudId),
            });
            const requeridos = tiposRequeridosPorRequisitos(row.requisitos);
            /* Misma regla que Mis pagos: el documento global (cuota null) o el de la cuota declarada cubre el requisito. */
            const cuotaObjetivo = row.requisitos?.cuota ?? 1;
            const presentes = new Set(
              archivos.filter((a) => a.cuota === null || a.cuota === undefined || a.cuota === cuotaObjetivo).map((a) => a.tipo),
            );
            return { row, faltantes: requeridos.filter((tipo) => !presentes.has(tipo)) };
          } catch {
            return { row, faltantes: null };
          }
        }),
      );
      for (const resultado of resultados) {
        if (resultado.faltantes === null) {
          noVerificados += 1;
        } else if (resultado.faltantes.length > 0) {
          documentosPendientes.push(aDTO(resultado.row, resultado.faltantes));
        }
      }
    }

    return { sinSolicitud, documentosPendientes, noVerificados };
  }

  async enviar(dto: EnviarRecordatoriosRequestDTO, createdBy: string): Promise<EnviarRecordatoriosResultDTO> {
    if (
      dto.tipo !== RECORDATORIOS_FACTURACION.SIN_SOLICITUD &&
      dto.tipo !== RECORDATORIOS_FACTURACION.DOCUMENTOS_PENDIENTES
    ) {
      throw new DomainError("Tipo de recordatorio invalido", API_ERROR_CODES.VALIDATION, 400);
    }

    const candidatos = await this.listarCandidatos();
    const pool =
      dto.tipo === RECORDATORIOS_FACTURACION.SIN_SOLICITUD ? candidatos.sinSolicitud : candidatos.documentosPendientes;
    const porId = new Map(pool.map((candidato) => [candidato.facturacionId, candidato]));
    const ids = [...new Set(dto.facturacionIds)];

    const detalle: EnviarRecordatoriosResultDTO["detalle"] = [];
    let enviados = 0;
    let fallidos = 0;

    for (const facturacionId of ids) {
      const candidato = porId.get(facturacionId);
      if (!candidato) {
        fallidos += 1;
        detalle.push({ facturacionId, ok: false, error: "La empresa ya no cumple el criterio del recordatorio" });
        continue;
      }
      if (!candidato.email) {
        fallidos += 1;
        detalle.push({ facturacionId, ok: false, error: "La empresa no tiene correo de facturacion" });
        continue;
      }

      try {
        const idioma = await resolverIdiomaDestinatario(this.auth, candidato.email);
        const enviado =
          dto.tipo === RECORDATORIOS_FACTURACION.SIN_SOLICITUD
            ? await enviarEmailPlantilla({
                to: candidato.email,
                plantilla: "facturacion-recordatorio-solicitud",
                idioma,
                datos: {
                  razonSocial: candidato.empresa ?? "su empresa",
                  standCodes: candidato.standCode,
                },
              })
            : await enviarEmailPlantilla({
                to: candidato.email,
                plantilla: "facturacion-recordatorio-documentos",
                idioma,
                datos: {
                  razonSocial: candidato.empresa ?? "su empresa",
                  standCodes: candidato.standCode,
                  faltantes: candidato.faltantes.map((tipo) => TIPOS_ARCHIVO_IIMP_LABELS[tipo] ?? tipo),
                },
              });
        if (!enviado) throw new Error("El proveedor de correo rechazo el envio");

        await this.repo.registrarNotificacionRecordatorio(
          facturacionId,
          dto.tipo === RECORDATORIOS_FACTURACION.SIN_SOLICITUD
            ? `Recordatorio de solicitud de factura enviado a ${candidato.email}`
            : `Recordatorio de documentos pendientes (${candidato.faltantes.join(", ")}) enviado a ${candidato.email}`,
          createdBy,
        );
        enviados += 1;
        detalle.push({ facturacionId, ok: true });
      } catch (error) {
        fallidos += 1;
        detalle.push({
          facturacionId,
          ok: false,
          error: error instanceof Error ? error.message : "Error al enviar el correo",
        });
      }
    }

    return { enviados, fallidos, detalle };
  }
}
