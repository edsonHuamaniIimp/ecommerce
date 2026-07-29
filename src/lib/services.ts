import { EventoPrismaRepository } from "@/infrastructure/persistence/evento-repository";
import { GessPrismaRepository } from "@/infrastructure/persistence/gess-repository";
import { RolePrismaRepository } from "@/infrastructure/persistence/role-repository";
import { EventoApplicationService } from "@/application/eventos/evento-service";

const eventoRepo = new EventoPrismaRepository();
const gessRepo = new GessPrismaRepository();
const roleRepo = new RolePrismaRepository();

export const services = {
  eventos: new EventoApplicationService(eventoRepo),
  gessRepo,
  roleRepo,
};
