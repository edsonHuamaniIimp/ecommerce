import 'server-only';

import { EventoPrismaRepository } from "@/infrastructure/persistence/evento-repository";
import { GessPrismaRepository } from "@/infrastructure/persistence/gess-repository";
import { RolePrismaRepository } from "@/infrastructure/persistence/role-repository";
import { AuthPrismaRepository } from "@/infrastructure/persistence/auth-repository";
import { SolicitudesPrismaRepository } from "@/infrastructure/persistence/solicitudes-repository";
import { PlanoPrismaRepository } from "@/infrastructure/persistence/plano-repository";
import { KbServiciosClient } from "@/infrastructure/external/kbservicios-client";
import { ListstandClient } from "@/infrastructure/external/liststand-client";
import { PersonaApiClient } from "@/infrastructure/external/persona-client";
import { EmpresaApiClient } from "@/infrastructure/external/empresa-client";
import { ConsultaDocumentoClient } from "@/infrastructure/external/consulta-documento-client";
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
import { PrellenadoReservaApplicationService } from "@/application/reservas/prellenado-reserva-service";
import { AuthApplicationService } from "@/application/auth/auth-service";
import { DashboardApplicationService } from "@/application/dashboard/dashboard-service";
import { SolicitudCuentaApplicationService } from "@/application/solicitud-cuenta/solicitud-cuenta-service";
import { SolicitudCuentaPrismaRepository } from "@/infrastructure/persistence/solicitud-cuenta-repository";
import { SolicitudesApplicationService } from "@/application/solicitudes/solicitudes-service";
import { PlanoApplicationService } from "@/application/planos/planos-service";
import { EmpresaPrismaRepository } from "@/infrastructure/persistence/empresa-repository";
import { EmpresaApplicationService } from "@/application/empresas/empresa-service";
import { UsuarioPrismaRepository } from "@/infrastructure/persistence/usuario-repository";
import { UsuariosApplicationService } from "@/application/usuarios/usuarios-service";
import { facturacionRepo } from "@/infrastructure/persistence/facturacion-repository";
import { ReservaIimpClient } from "@/infrastructure/external/reserva-iimp-client";
import { SolicitarFacturaApplicationService } from "@/application/facturacion-iimp/solicitar-factura-service";
import { FacturacionApplicationService } from "@/application/facturacion/facturacion-service";
import { tipoStandImagenRepo } from "@/infrastructure/persistence/tipo-stand-imagen-repository";
import { TiposStandImagenApplicationService } from "@/application/stands/tipos-stand-imagen-service";
import { ContratoApplicationService } from "@/application/contratos/contrato-service";
import { AlertasApplicationService } from "@/application/alertas/alertas-service";
import { ConfiguracionPrismaRepository } from "@/infrastructure/persistence/configuracion-repository";
import { ConfiguracionApplicationService } from "@/application/configuracion/configuracion-service";
import { getStorage } from "@/lib/server/storage";

const eventoRepo = new EventoPrismaRepository();
const gessRepo = new GessPrismaRepository();
const roleRepo = new RolePrismaRepository();
const authRepo = new AuthPrismaRepository();
const solicitudCuentaRepo = new SolicitudCuentaPrismaRepository();
const solicitudesRepo = new SolicitudesPrismaRepository();
const planoRepo = new PlanoPrismaRepository();
const empresaRepo = new EmpresaPrismaRepository();
const usuarioRepo = new UsuarioPrismaRepository();
const configuracionRepo = new ConfiguracionPrismaRepository();
const kbServiciosClient = new KbServiciosClient();
const planogessClient = new ListstandClient();
const personaClient = new PersonaApiClient();
const empresaClient = new EmpresaApiClient();
const consultaDocumentoClient = new ConsultaDocumentoClient();
const reservaIimpClient = new ReservaIimpClient();
const sgcConfig = getSgcConfig();
const sgcRepo = new SgcPrismaRepository();
const sgcWebhookRepo = new SgcWebhookPrismaRepository();
const sgcClient: ISgcClient =
  getSgcMode() === SGC_MODES.REAL
    ? new SgcClient({ apiUrl: getSgcApiUrl(), apiKey: getSgcApiKey(), timeoutMs: getSgcTimeoutMs() })
    : new SgcClientMock();
const documentoOrigen = new DocumentoOrigen();
const sgcIntegracion = new SgcIntegracionApplicationService(solicitudesRepo, sgcRepo, sgcClient, documentoOrigen, sgcConfig);
const sgcWebhook = new SgcWebhookApplicationService(sgcWebhookRepo, sgcRepo, sgcConfig, solicitudesRepo, authRepo);
const sgcOutboxRepo = new SgcOutboxPrismaRepository();
const sgcOutbox = new SgcOutboxApplicationService(sgcOutboxRepo, sgcIntegracion, sgcConfig);

export const services = {
  eventos: new EventoApplicationService(eventoRepo),
  presala: new PresalaApplicationService(kbServiciosClient, eventoRepo),
  gess: new GessApplicationService(gessRepo, planogessClient, planoRepo, tipoStandImagenRepo),
  reservas: new ReservaApplicationService(gessRepo, solicitudesRepo, authRepo),
  prellenadoReserva: new PrellenadoReservaApplicationService(usuarioRepo, personaClient, empresaClient),
  auth: new AuthApplicationService(authRepo, roleRepo, empresaRepo, personaClient),
  dashboard: new DashboardApplicationService(gessRepo),
  solicitudCuenta: new SolicitudCuentaApplicationService(solicitudCuentaRepo, roleRepo, empresaRepo),
  kbServicios: kbServiciosClient,
  planogess: planogessClient,
  sgc: sgcIntegracion,
  sgcWebhook,
  sgcOutbox,
  solicitudes: new SolicitudesApplicationService(solicitudesRepo, sgcIntegracion),
  planos: new PlanoApplicationService(planoRepo),
  empresas: new EmpresaApplicationService(empresaRepo, authRepo, roleRepo, personaClient, empresaClient, consultaDocumentoClient),
  facturacion: new FacturacionApplicationService(facturacionRepo, authRepo),
  solicitarFactura: new SolicitarFacturaApplicationService(facturacionRepo, solicitudesRepo, authRepo, empresaRepo, reservaIimpClient, personaClient),
  tiposStandImagen: new TiposStandImagenApplicationService(tipoStandImagenRepo),
  contrato: new ContratoApplicationService(solicitudesRepo, empresaRepo, planoRepo, gessRepo, authRepo, getStorage()),
  alertas: new AlertasApplicationService(authRepo),
  usuarios: new UsuariosApplicationService(usuarioRepo, authRepo, empresaRepo, roleRepo, personaClient),
  configuracion: new ConfiguracionApplicationService(configuracionRepo),
  gessRepo,
  roleRepo,
};
