import { EventoPrismaRepository } from "@/infrastructure/persistence/evento-repository";
import { GessPrismaRepository } from "@/infrastructure/persistence/gess-repository";
import { RolePrismaRepository } from "@/infrastructure/persistence/role-repository";
import { AuthPrismaRepository } from "@/infrastructure/persistence/auth-repository";
import { KbServiciosClient } from "@/infrastructure/external/kbservicios-client";
import { PlanogessClient } from "@/infrastructure/external/planogess-client";
import { EventoApplicationService } from "@/application/eventos/evento-service";
import { PresalaApplicationService } from "@/application/eventos/presala-service";
import { GessApplicationService } from "@/application/gess/gess-service";
import { ReservaApplicationService } from "@/application/reservas/reserva-service";
import { AuthApplicationService } from "@/application/auth/auth-service";

const eventoRepo = new EventoPrismaRepository();
const gessRepo = new GessPrismaRepository();
const roleRepo = new RolePrismaRepository();
const authRepo = new AuthPrismaRepository();
const kbServiciosClient = new KbServiciosClient();
const planogessClient = new PlanogessClient();

export const services = {
  eventos: new EventoApplicationService(eventoRepo),
  presala: new PresalaApplicationService(kbServiciosClient, eventoRepo),
  gess: new GessApplicationService(gessRepo, planogessClient),
  reservas: new ReservaApplicationService(gessRepo),
  auth: new AuthApplicationService(authRepo),
  kbServicios: kbServiciosClient,
  planogess: planogessClient,
  gessRepo,
  roleRepo,
};
