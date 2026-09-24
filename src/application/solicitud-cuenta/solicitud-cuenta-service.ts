import type { ISolicitudCuentaRepository } from "@/domain/ports/solicitud-cuenta-repository";
import type { IRoleRepository } from "@/domain/ports/role-repository";
import type { SolicitudCuentaEntity } from "@/domain/models/entities";
import { sendEmail } from "@/lib/server/email";
import {
  buildInvitacionCuentaEmail,
  buildRechazoCuentaEmail,
  buildSolicitudCuentaAdminEmail,
} from "@/lib/server/solicitud-cuenta-email";
import { generarTokenAleatorio } from "@/lib/server/utils/token";
import { hashPassword } from "@/lib/server/utils/password";
import {
  ESTADOS_SOLICITUD_CUENTA,
  INVITACION_CUENTA_MINUTOS_VIGENCIA,
  MS_POR_MINUTO,
  ROLES,
} from "@/lib/shared/constants";
import type { CrearSolicitudCuentaRequestDTO } from "@/types/dto/solicitud-cuenta/crear-solicitud-cuenta-request.dto";
import type { CrearSolicitudCuentaResult } from "@/types/dto/solicitud-cuenta/crear-solicitud-cuenta-result.dto";
import type { RevisarSolicitudCuentaRequestDTO } from "@/types/dto/solicitud-cuenta/revisar-solicitud-cuenta-request.dto";
import type { RevisarSolicitudCuentaResult } from "@/types/dto/solicitud-cuenta/revisar-solicitud-cuenta-result.dto";
import type { ListarSolicitudesCuentaResult } from "@/types/dto/solicitud-cuenta/listar-solicitudes-cuenta-result.dto";
import type { SolicitudCuentaDTO } from "@/types/dto/solicitud-cuenta/solicitud-cuenta.dto";

const MENSAJE_RECIBIDA = "Solicitud enviada. Te contactaremos cuando sea revisada.";
const MENSAJE_CUENTA_EXISTENTE =
  "Este correo ya tiene una cuenta habilitada. Inicia sesion o recupera tu contrasena.";
const MENSAJE_PENDIENTE = "Ya existe una solicitud pendiente para este correo.";

function aDTO(s: SolicitudCuentaEntity): SolicitudCuentaDTO {
  return {
    id: s.id,
    email: s.email,
    nombre: s.nombre,
    apellidos: s.apellidos,
    telefono: s.telefono,
    razonSocial: s.razonSocial,
    ruc: s.ruc,
    cargo: s.cargo,
    mensaje: s.mensaje,
    estado: s.estado,
    motivoRechazo: s.motivoRechazo,
    revisadoPor: s.revisadoPor,
    revisadoEn: s.revisadoEn ? s.revisadoEn.toISOString() : null,
    createdAt: s.createdAt.toISOString(),
  };
}

export class SolicitudCuentaApplicationService {
  constructor(
    private readonly repo: ISolicitudCuentaRepository,
    private readonly roleRepo: IRoleRepository,
  ) {}

  async crear(dto: CrearSolicitudCuentaRequestDTO): Promise<CrearSolicitudCuentaResult> {
    const email = dto.email.trim().toLowerCase();

    if (await this.repo.existeUsuarioPorEmail(email)) {
      return { ok: false, message: MENSAJE_CUENTA_EXISTENTE };
    }
    if (await this.repo.existePendientePorEmail(email)) {
      return { ok: false, message: MENSAJE_PENDIENTE };
    }

    const solicitud = await this.repo.crear({
      email,
      nombre: dto.nombre.trim(),
      apellidos: dto.apellidos.trim(),
      telefono: dto.telefono?.trim() ?? null,
      razonSocial: dto.razonSocial.trim(),
      ruc: dto.ruc?.trim() ?? null,
      cargo: dto.cargo?.trim() ?? null,
      mensaje: dto.mensaje?.trim() ?? null,
    });

    await this.notificarAdmin(solicitud).catch(() => {});
    return { ok: true, message: MENSAJE_RECIBIDA };
  }

  async listar(estado?: string): Promise<ListarSolicitudesCuentaResult> {
    const filas = await this.repo.listar(estado);
    return { solicitudes: filas.map(aDTO) };
  }

  async revisar(dto: RevisarSolicitudCuentaRequestDTO): Promise<RevisarSolicitudCuentaResult> {
    const { getSession } = await import("@/lib/server/auth");
    const session = await getSession();
    if (!session) return { ok: false, message: "No autenticado" };

    const solicitud = await this.repo.findById(dto.id);
    if (!solicitud) return { ok: false, message: "Solicitud no encontrada" };
    if (solicitud.estado !== ESTADOS_SOLICITUD_CUENTA.PENDIENTE) {
      return { ok: false, message: "La solicitud ya fue revisada" };
    }

    return dto.estado === ESTADOS_SOLICITUD_CUENTA.RECHAZADA
      ? this.rechazar(solicitud, session.email, dto.motivoRechazo)
      : this.aprobar(solicitud, session.email);
  }

  private async rechazar(
    solicitud: SolicitudCuentaEntity,
    revisor: string,
    motivo: string | undefined,
  ): Promise<RevisarSolicitudCuentaResult> {
    const motivoRechazo = (motivo ?? "").trim();
    if (!motivoRechazo) return { ok: false, message: "El motivo de rechazo es obligatorio" };

    await this.repo.rechazar(solicitud.id, { revisadoPor: revisor, motivoRechazo });
    await sendEmail({
      to: solicitud.email,
      ...buildRechazoCuentaEmail({
        nombre: solicitud.nombre,
        razonSocial: solicitud.razonSocial,
        motivo: motivoRechazo,
      }),
    }).catch(() => {});
    return { ok: true, message: "Solicitud rechazada. Se notifico al solicitante." };
  }

  private async aprobar(
    solicitud: SolicitudCuentaEntity,
    revisor: string,
  ): Promise<RevisarSolicitudCuentaResult> {
    if (await this.repo.existeUsuarioPorEmail(solicitud.email)) {
      return { ok: false, message: "El correo ya tiene una cuenta habilitada" };
    }

    const rol = await this.roleRepo.findByNombre(ROLES.CLIENTE);
    if (!rol) return { ok: false, message: `No existe el rol ${ROLES.CLIENTE} en el sistema` };

    const token = generarTokenAleatorio();
    await this.repo.aprobar(solicitud.id, {
      revisadoPor: revisor,
      usuario: {
        userId: `user|${solicitud.email}`,
        email: solicitud.email,
        nombre: solicitud.nombre,
        apellidos: solicitud.apellidos,
        telefono: solicitud.telefono,
        nombreEmpresa: solicitud.razonSocial,
        password: hashPassword(generarTokenAleatorio()),
        resetToken: token,
        resetTokenExpires: new Date(Date.now() + INVITACION_CUENTA_MINUTOS_VIGENCIA * MS_POR_MINUTO),
        roleId: rol.id,
      },
    });

    await sendEmail({
      to: solicitud.email,
      ...buildInvitacionCuentaEmail({
        nombre: solicitud.nombre,
        razonSocial: solicitud.razonSocial,
        token,
      }),
    }).catch(() => {});
    return { ok: true, message: "Solicitud aprobada. Se envio la invitacion al exhibidor." };
  }

  private async notificarAdmin(solicitud: SolicitudCuentaEntity): Promise<void> {
    const destino = process.env.ADMIN_EMAIL;
    if (!destino) return;
    await sendEmail({
      to: destino,
      ...buildSolicitudCuentaAdminEmail({
        email: solicitud.email,
        nombre: solicitud.nombre,
        apellidos: solicitud.apellidos,
        razonSocial: solicitud.razonSocial,
        ruc: solicitud.ruc,
        telefono: solicitud.telefono,
        cargo: solicitud.cargo,
        mensaje: solicitud.mensaje,
      }),
    });
  }
}
