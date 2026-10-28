"use client";

import type { ReactNode } from "react";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@nrivera-iimp/ui-kit-iimp";
import { Building2, ClipboardCheck, ReceiptText, UserRound, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  BADGE_STYLES,
  ESTADOS_EMPRESA,
  TIPO_COMPROBANTE_LABELS,
  TIPOS_DOCUMENTO_EMPRESA_LABELS,
  TIPOS_DOCUMENTO_PERSONA_LABELS,
} from "@/lib/shared/constants";
import { dateUtils } from "@/lib/shared/utils/date";
import { nombrePais } from "@/lib/shared/utils/pais";
import type { EmpresaDTO } from "@/types/dto/empresas";

interface Props {
  empresa: EmpresaDTO;
  onClose: () => void;
}

function Dato({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  const texto = value?.trim() ? value : "—";
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={`mt-0.5 break-words text-sm text-foreground ${mono ? "font-mono" : ""}`}>{texto}</dd>
    </div>
  );
}

function Seccion({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2 border-b border-border pb-2">
        <Icon className="h-4 w-4 text-primary" />
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-primary">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function tipoDocumentoPersona(tipo: string): string {
  return TIPOS_DOCUMENTO_PERSONA_LABELS[tipo] ?? tipo;
}

export function EmpresaDetalleModal({ empresa, onClose }: Props) {
  const activa = empresa.estado === ESTADOS_EMPRESA.ACTIVA;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader className="text-left">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <Building2 className="h-4 w-4 text-primary" />
            <span>Información de la empresa</span>
          </DialogTitle>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{empresa.razonSocial}</span>
            <span className="font-mono">{empresa.ruc}</span>
            <Badge className={`pointer-events-none text-[10px] ${activa ? BADGE_STYLES.SUCCESS : BADGE_STYLES.NEUTRAL}`}>
              <span>{activa ? "Activa" : "Inactiva"}</span>
            </Badge>
          </p>
        </DialogHeader>

        <div className="space-y-4">
          <Seccion icon={Building2} title="Datos de la empresa">
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
              <Dato label="Razón social" value={empresa.razonSocial} />
              <Dato label="Nombre comercial" value={empresa.nombreComercial} />
              <Dato label="Tipo de documento" value={TIPOS_DOCUMENTO_EMPRESA_LABELS[empresa.tipoDocumento] ?? empresa.tipoDocumento} />
              <Dato label="RUC / RUT" value={empresa.ruc} mono />
              <Dato label="País" value={nombrePais(empresa.pais)} />
              <Dato label="Dirección fiscal" value={empresa.direccionFiscal} />
              <Dato label="Inicio de operaciones" value={dateUtils.format(empresa.inicioOperaciones)} />
              <Dato label="Teléfono" value={empresa.telefono} />
              <Dato label="Email general" value={empresa.emailContacto} />
              <Dato label="Actividad económica" value={empresa.actividadEconomica} />
              <Dato label="Estado del contribuyente" value={empresa.estadoContribuyente} />
              <Dato label="Sitio web" value={empresa.sitioWeb} />
            </dl>
          </Seccion>

          <Seccion icon={UserRound} title="Representante legal y firma">
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
              <Dato label="Nombre" value={empresa.representanteLegalNombre} />
              <Dato label="Tipo de documento" value={tipoDocumentoPersona(empresa.representanteLegalTipoDocumento)} />
              <Dato label="Número de documento" value={empresa.representanteLegalDni} mono />
              <Dato label="Correo" value={empresa.representanteCorreo} />
              <Dato label="Celular" value={empresa.representanteCelular} />
              <Dato label="Dirección" value={empresa.representanteDireccion} />
              <Dato label="Partida electrónica" value={empresa.partidaElectronica} mono />
              <Dato label="Código SIE" value={empresa.representanteSieCode ?? "No sincronizado"} mono />
            </dl>
          </Seccion>

          <Seccion icon={Users} title="Responsables de la empresa">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-secondary/30 p-3">
                <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-primary">Responsable EXTEMIN</p>
                <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
                  <Dato label="Nombre" value={empresa.responsableExteminNombre} />
                  <Dato label="Teléfono" value={empresa.responsableExteminTelefono} />
                  <Dato label="Tipo de documento" value={tipoDocumentoPersona(empresa.responsableExteminTipoDocumento)} />
                  <Dato label="Número de documento" value={empresa.responsableExteminDni} mono />
                  <Dato label="Email" value={empresa.responsableExteminEmail} />
                </dl>
              </div>
              <div className="rounded-lg border border-border bg-secondary/30 p-3">
                <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-primary">Responsable de pagos</p>
                <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
                  <Dato label="Nombre" value={empresa.responsablePagosNombre} />
                  <Dato label="Teléfono" value={empresa.responsablePagosTelefono} />
                  <Dato label="Tipo de documento" value={tipoDocumentoPersona(empresa.responsablePagosTipoDocumento)} />
                  <Dato label="Número de documento" value={empresa.responsablePagosDni} mono />
                  <Dato label="Email" value={empresa.responsablePagosEmail} />
                </dl>
              </div>
            </div>
          </Seccion>

          <Seccion icon={ReceiptText} title="Facturación y stand">
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
              <Dato label="Facturar a nombre de" value={empresa.facturarANombre ?? empresa.razonSocial} />
              <Dato label="Correo de facturación" value={empresa.emailFacturacion} />
              <Dato label="Tipo de comprobante" value={TIPO_COMPROBANTE_LABELS[empresa.tipoComprobante] ?? empresa.tipoComprobante} />
              <Dato label="Nombre en el friso" value={empresa.nombreFriso} />
              <Dato label="Dirección de facturación" value={empresa.direccionFiscal} />
            </dl>
          </Seccion>

          <Seccion icon={ClipboardCheck} title="Registro y acceso">
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
              <Dato label="Cuenta de acceso" value={empresa.cuentaCreada ? "Creada" : "Pendiente"} />
              <Dato label="Email de la cuenta" value={empresa.cuentaEmail} />
              <Dato label="Primer acceso" value={empresa.primerAccesoCompletado ? "Completado" : "Pendiente"} />
              <Dato label="Datos validados" value={dateUtils.formatDateTime(empresa.datosValidadosEn)} />
              <Dato label="Registrado por" value={empresa.creadoPor} />
              <Dato label="Fecha de registro" value={dateUtils.formatDateTime(empresa.createdAt)} />
              <Dato label="Última actualización" value={dateUtils.formatDateTime(empresa.updatedAt)} />
            </dl>
          </Seccion>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            <span>Cerrar</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
