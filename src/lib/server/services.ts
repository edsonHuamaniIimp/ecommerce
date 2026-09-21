import 'server-only';

import { EventoPrismaRepository } from "@/infrastructure/persistence/evento-repository";
import { GessPrismaRepository } from "@/infrastructure/persistence/gess-repository";
import { RolePrismaRepository } from "@/infrastructure/persistence/role-repository";
import { AuthPrismaRepository } from "@/infrastructure/persistence/auth-repository";
import { SolicitudesPrismaRepository } from "@/infrastructure/persistence/solicitudes-repository";
import { PlanoPrismaRepository } from "@/infrastructure/persistence/plano-repository";
import { KbServiciosClient } from "@/infrastructure/external/kbservicios-client";
import { PlanogessClient } from "@/infrastructure/external/planogess-client";
import { SgcClientMock } from "@/infrastructure/external/sgc-client.mock";
import { SgcClient } from "@/infrastructure/external/sgc-client";
import type { ISgcClient } from "@/domain/ports/sgc-client";
import { SGC_MODES } from "@/lib/shared/constants";
import { SgcPrismaRepository } from "@/infrastructure/persistence/sgc-repository";
import { SgcWebhookPrismaRepository } from "@/infrastructure/persistence/sgc-webhook-repository";
import { SgcOutboxPrismaRepository } from "@/infrastructure/persistence/sgc-outbox-repository";
import { DocumentoOrigen } from "@/infrastructure/external/documento-origen";
import { SgcIntegracionApplicationService } from "@/application/sgc-integracion/sgc-integracion-service";
import { SgcWebhookApplicationService } from "@/application/sgc-integracion/sgc-webhook-service";
import { SgcOutboxApplicationService } from "@/application/sgc-integracion/sgc-outbox-service";
import { getSgcApiKey, getSgcApiUrl, getSgcConfig, getSgcMode, getSgcTimeoutMs } from "@/lib/server/sgc-config";
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
const sgcConfig = getSgcConfig();
const sgcRepo = new SgcPrismaRepository();
const sgcWebhookRepo = new SgcWebhookPrismaRepository();
const sgcClient: ISgcClient =
  getSgcMode() === SGC_MODES.REAL
    ? new SgcClient({ apiUrl: getSgcApiUrl(), apiKey: getSgcApiKey(), timeoutMs: getSgcTimeoutMs() })
    : new SgcClientMock();
const documentoOrigen = new DocumentoOrigen();
const sgcIntegracion = new SgcIntegracionApplicationService(solicitudesRepo, sgcRepo, sgcClient, documentoOrigen, sgcConfig);
const sgcWebhook = new SgcWebhookApplicationService(sgcWebhookRepo, sgcRepo, sgcConfig);
const sgcOutboxRepo = new SgcOutboxPrismaRepository();
const sgcOutbox = new SgcOutboxApplicationService(sgcOutboxRepo, sgcIntegracion, sgcConfig);

export const services = {
  eventos: new EventoApplicationService(eventoRepo),
  presala: new PresalaApplicationService(kbServiciosClient, eventoRepo),
  gess: new GessApplicationService(gessRepo, planogessClient, planoRepo),
  reservas: new ReservaApplicationService(gessRepo, solicitudesRepo),
  auth: new AuthApplicationService(authRepo),
  kbServicios: kbServiciosClient,
  planogess: planogessClient,
  sgc: sgcIntegracion,
  sgcWebhook,
  sgcOutbox,
  solicitudes: new SolicitudesApplicationService(solicitudesRepo, sgcIntegracion),
  planos: new PlanoApplicationService(planoRepo),
  gessRepo,
  roleRepo,
};
