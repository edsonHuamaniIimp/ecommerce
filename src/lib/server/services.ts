import 'server-only';

import { EventoPrismaRepository } from "@/infrastructure/persistence/evento-repository";
import { GessPrismaRepository } from "@/infrastructure/persistence/gess-repository";
import { RolePrismaRepository } from "@/infrastructure/persistence/role-repository";
import { AuthPrismaRepository } from "@/infrastructure/persistence/auth-repository";
import { SolicitudesPrismaRepository } from "@/infrastructure/persistence/solicitudes-repository";
import { PlanoPrismaRepository } from "@/infrastructure/persistence/plano-repository";
import { KbServiciosClient } from "@/infrastructure/external/kbservicios-client";
import { PlanogessClient } from "@/infrastructure/external/planogess-client";
import { EventoApplicationService } from "@/application/eventos/evento-service";
import { PresalaApplicationService } from "@/application/eventos/presala-service";
import { GessApplicationService } from "@/application/gess/gess-service";
import { ReservaApplicationService } from "@/application/reservas/reserva-service";
import { AuthApplicationService } from "@/application/auth/auth-service";
import { SolicitudesApplicationService } from "@/application/solicitudes/solicitudes-service";
import { PlanoApplicationService } from "@/application/planos/planos-service";

const eventoRepo = new EventoPrismaRepository();
const gessRepo = new GessPrismaRepository();
const roleRepo = new RolePrismaRepository();
const authRepo = new AuthPrismaRepository();
const solicitudesRepo = new SolicitudesPrismaRepository();
const planoRepo = new PlanoPrismaRepository();
const kbServiciosClient = new KbServiciosClient();
const planogessClient = new PlanogessClient();

export const services = {
  eventos: new EventoApplicationService(eventoRepo),
  presala: new PresalaApplicationService(kbServiciosClient, eventoRepo),
  gess: new GessApplicationService(gessRepo, planogessClient, planoRepo),
  reservas: new ReservaApplicationService(gessRepo, solicitudesRepo),
  auth: new AuthApplicationService(authRepo),
  kbServicios: kbServiciosClient,
  planogess: planogessClient,
  solicitudes: new SolicitudesApplicationService(solicitudesRepo),
  planos: new PlanoApplicationService(planoRepo),
  gessRepo,
  roleRepo,
};
