import type { IGessRepository } from "@/domain/ports/gess-repository";
import { ESTADOS_STAND } from "@/lib/constants";
import { sendEmail, buildReservaConfirmationEmail, buildAdminNotificacionEmail } from "@/lib/email";

const BLOQUEADOS = [ESTADOS_STAND.EN_EVALUACION, ESTADOS_STAND.RESERVADO, "Reservado", "En evaluacion"];
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "ext_analistaprogramador3@iimp.org.pe";

export class ReservaApplicationService {
  constructor(private readonly gessRepo: IGessRepository) {}

  async crear(request: {
    standIds: string[];
    documentos?: string[];
    datos?: { razonSocial: string; tipoDocumento: string; numeroDocumento: string; email: string };
  }): Promise<{ ok: boolean; message: string; conflicted?: string[] }> {
    const conflicted: string[] = [];
    const standCodes: string[] = [];

    for (const dbId of request.standIds) {
      const stand = await this.gessRepo.findById(dbId);
      if (!stand) { conflicted.push("Stand no encontrado"); continue; }
      if (stand.estado && BLOQUEADOS.includes(stand.estado)) {
        const label = stand.estado === ESTADOS_STAND.RESERVADO || stand.estado === "Reservado" ? "Reservado" : "En evaluacion";
        conflicted.push(`${stand.standCode} ya esta en estado ${label}`);
        continue;
      }
      standCodes.push(stand.standCode);
      const data: Record<string, unknown> = { estado: ESTADOS_STAND.EN_EVALUACION };
      if (request.documentos) data.documentos = request.documentos;
      await this.gessRepo.update(stand.id, data as never);
    }

    if (conflicted.length > 0) {
      return { ok: false, message: "Conflicto", conflicted };
    }

    // Enviar correos en background
    if (request.datos?.email) {
      const emailData = {
        standCodes: standCodes.join(", "),
        razonSocial: request.datos.razonSocial || "—",
        documento: `${request.datos.tipoDocumento || ""} ${request.datos.numeroDocumento || ""}`.trim() || "—",
        emailCliente: request.datos.email,
      };
      const clientEmail = buildReservaConfirmationEmail({ ...emailData, email: request.datos.email });
      sendEmail({ to: request.datos.email, ...clientEmail }).catch(() => {});
      if (ADMIN_EMAIL && ADMIN_EMAIL !== request.datos.email) {
        const adminEmail = buildAdminNotificacionEmail(emailData);
        sendEmail({ to: ADMIN_EMAIL, ...adminEmail }).catch(() => {});
      }
    }

    return { ok: true, message: `${standCodes.length} stand(s) reservados` };
  }
}
