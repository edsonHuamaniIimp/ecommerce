import 'server-only';

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/db";
import type {
  IFacturacionIntentoRepository,
  RegistrarIntentoFacturaData,
} from "@/domain/ports/facturacion-intento-repository";

const json = (valor: unknown): Prisma.InputJsonValue | undefined =>
  valor === null || valor === undefined ? undefined : (valor as Prisma.InputJsonValue);

export class FacturacionIntentoPrismaRepository implements IFacturacionIntentoRepository {
  async registrarFallo(data: RegistrarIntentoFacturaData): Promise<void> {
    await prisma.facturacionSolicitudIntento.create({
      data: {
        solicitudId: data.solicitudId,
        cuotaId: data.cuotaId,
        origen: data.origen,
        actor: data.actor?.slice(0, 200) ?? null,
        resultado: data.resultado,
        httpStatus: data.httpStatus,
        mensaje: data.mensaje?.slice(0, 1000) ?? null,
        identificadorSie: data.identificadorSie?.slice(0, 40) ?? null,
        requisitos: json(data.requisitos),
        archivos: json(data.archivos),
        payload: json(data.payload),
        respuestaSie: json(data.respuestaSie),
      },
    });
  }
}
