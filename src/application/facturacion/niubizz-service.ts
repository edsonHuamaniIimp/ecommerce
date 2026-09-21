import { prisma } from "@/lib/server/db";
import { niubizzClient } from "@/infrastructure/external/niubizz-client";
import { ESTADOS_CUOTA } from "@/lib/shared/constants";
import type { IFacturacionRepository } from "@/domain/ports/facturacion-repository";

export class NiubizzApplicationService {
  constructor(private readonly facturacionRepo: IFacturacionRepository) {}

  async crearSesion(facturacionId: string) {
    const fact = await this.facturacionRepo.detalle(facturacionId);
    if (!fact) throw new Error("Facturacion no encontrada");

    const user = await prisma.userRole.findFirst({
      where: { email: fact.correoSolicitante ?? "" },
      select: { nombre: true, apellidos: true, telefono: true },
    });

    const purchaseNumber = `${Date.now()}`;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const result = await niubizzClient.crearSesion({
      amount: fact.montoTotal,
      purchaseNumber,
      nombre: user?.nombre ?? "Cliente",
      apellido: user?.apellidos ?? "",
      email: fact.correoSolicitante ?? "",
      documento: "",
      telefono: user?.telefono ?? "",
      urlCallback: `${appUrl}/dashboard/facturacion/pago/response?facturacionId=${fact.id}`,
      urlTimeout: `${appUrl}/dashboard/facturacion/pago/error`,
    });

    return { ...result, amount: fact.montoTotal };
  }

  async confirmarPago(facturacionId: string, transactionToken: string) {
    const fact = await this.facturacionRepo.detalle(facturacionId);
    if (!fact) throw new Error("Facturacion no encontrada");

    const cuotaPendiente = fact.cuotas.find(c => c.estado === ESTADOS_CUOTA.PENDIENTE);
    if (!cuotaPendiente) throw new Error("Sin cuotas pendientes");

    const respuestaApi = "respuesta_api" in cuotaPendiente ? cuotaPendiente.respuesta_api : undefined;

    // Authorize via Niubizz proxy
    await niubizzClient.autorizar({
      key: typeof respuestaApi === "string" ? respuestaApi : "",
      amount: fact.montoTotal,
      transactionToken,
      purchaseNumber: String(Date.now()),
    });

    // Mark cuota as paid
    await this.facturacionRepo.pagarCuota(cuotaPendiente.id, "niubizz", null);
  }
}
