"use client";

import { useState, useEffect, useRef } from "react";
import { Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@nrivera-iimp/ui-kit-iimp";
import { ShieldCheck, Store } from "lucide-react";
import { isValidDocumento, isValidEmail, isValidTelefono, onlyDigits, onlyPhoneDigits } from "@/lib/shared/utils/form-validator";
import { maestraService } from "@/lib/client/api/services/maestra-service";
import { sunatService } from "@/lib/client/api/services/sunat-service";
import { reservaDatosService } from "@/lib/client/api/services/reserva-datos-service";
import { BADGE_STYLES, MAESTRA_TABLAS, TIPOS_COMPROBANTE, TIPOS_DOCUMENTO, TIPOS_DOCUMENTO_EMPRESA, TIPOS_DOCUMENTO_PERSONA } from "@/lib/shared/constants";
import type { MaestraItemDTO } from "@/types/dto/maestra";
import type { FormDatos } from "./interfaces";
import { RepresentantesAdicionalesEditor } from "@/components/empresa/representantes-adicionales-editor";
import { erroresRepresentantesAdicionales, type RepresentanteAdicionalForm } from "@/lib/shared/utils/representantes-adicionales";

const LABEL_CLASE = "text-[11px] font-medium text-muted-foreground";
const INPUT_CLASE =
  "h-9 border-border text-sm focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary";
const INPUT_ERROR_CLASE = "border-destructive focus-visible:border-destructive focus-visible:ring-destructive";

interface Props {
  datos: FormDatos;
  onChange: (update: Partial<FormDatos>) => void;
  /** Etiqueta de los stands en reserva temporal (barra de resumen). */
  selectedLabels?: string;
  /** Representantes adicionales guardados en la empresa. */
  representantesAdicionales: RepresentanteAdicionalForm[];
  onRepresentantesChange: (value: RepresentanteAdicionalForm[]) => void;
}

export function StepDatos({ datos, onChange, selectedLabels, representantesAdicionales, onRepresentantesChange }: Props) {
  const [comprobantes, setComprobantes] = useState<MaestraItemDTO[]>([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [validado, setValidado] = useState(false);
  /* Campos tocados (blur): el error de un campo vacio recien aparece al salir de el. */
  const [tocados, setTocados] = useState<Record<string, boolean>>({});

  useEffect(() => {
    maestraService.listar(MAESTRA_TABLAS.COMPROBANTE_TIPO).then(setComprobantes).catch(() => {});
  }, []);

  const isFactura = datos.tipoComprobante === TIPOS_COMPROBANTE.FACTURA;
  const docLabel = isFactura ? TIPOS_DOCUMENTO.RUC : TIPOS_DOCUMENTO.DNI;
  const docMax = isFactura ? 11 : 8;
  const docPlaceholder = isFactura ? "20123456789" : "12345678";

  // Autocomplete: consulta SUNAT/RENIEC al completar el documento (solo al editar, no al cargar)
  const docEditedRef = useRef(false);
  /* Datos actuales del formulario: evita pisar lo que el usuario ya escribio. */
  const datosRef = useRef(datos);
  useEffect(() => { datosRef.current = datos; }, [datos]);
  useEffect(() => {
    const num = datos.numeroDocumento;
    if (!num || num.length !== docMax || !docEditedRef.current) return;
    docEditedRef.current = false;
    setLookupLoading(true);
    const lookup = isFactura
      ? sunatService.consultarRuc(num).then((r) => {
          if (r.razonSocial) {
            /* SUNAT (full) tambien devuelve la direccion fiscal: se autocompleta. */
            onChange({ razonSocial: r.razonSocial, ...(r.direccion ? { direccion: r.direccion } : {}) });
            setValidado(true);
          }
        })
      : sunatService.consultarDni(num).then((r) => {
          if (r.nombreCompleto) {
            onChange({ contacto: r.nombreCompleto });
            setValidado(true);
          }
        });
    /* Prellenado interno (solo del propio usuario logueado): completa lo vacio. */
    const tipoDoc = isFactura ? TIPOS_DOCUMENTO_EMPRESA.RUC : TIPOS_DOCUMENTO_PERSONA.DNI;
    const prellenado = reservaDatosService.prellenar(tipoDoc, num).catch(() => null);
    Promise.allSettled([lookup, prellenado])
      .then(([, pre]) => {
        const d = pre.status === "fulfilled" ? pre.value : null;
        if (!d) return;
        const actuales = datosRef.current;
        const update: Partial<FormDatos> = {};
        if (d.contacto && !actuales.contacto.trim()) update.contacto = d.contacto;
        if (d.direccion && !actuales.direccion.trim()) update.direccion = d.direccion;
        const telefonoPrellenado = onlyPhoneDigits(d.telefono ?? "");
        if (isValidTelefono(telefonoPrellenado) && !actuales.telefono.trim()) update.telefono = telefonoPrellenado;
        if (d.correo && !actuales.email.trim()) update.email = d.correo;
        if (Object.keys(update).length > 0) onChange(update);
      })
      .finally(() => setLookupLoading(false));
  }, [datos.numeroDocumento, isFactura, docMax]); // eslint-disable-line react-hooks/exhaustive-deps

  const cambiarComprobante = (valor: string) => {
    docEditedRef.current = false;
    setValidado(false);
    onChange({ tipoComprobante: valor, numeroDocumento: "", razonSocial: "", contacto: "" });
  };

  /* Errores por campo: mismas reglas que `isStepDatosCompleto` (form-validator). */
  const errores = {
    documento: datos.numeroDocumento
      ? (isValidDocumento(datos.numeroDocumento, isFactura) ? null : `El ${docLabel} debe tener ${docMax} digitos numericos`)
      : `Ingresa el ${docLabel} (${docMax} digitos)`,
    razonSocial: isFactura && !datos.razonSocial.trim() ? "Ingresa la razon social (se autocompleta al validar el RUC)" : null,
    direccion: datos.direccion.trim() ? null : "Ingresa la direccion fiscal",
    contacto: datos.contacto.trim() ? null : "Ingresa la persona de contacto",
    telefono: datos.telefono
      ? (isValidTelefono(datos.telefono) ? null : "El telefono debe tener 9 digitos y empezar con 9")
      : "Ingresa el telefono (9 digitos, ej. 999 888 777)",
    email: datos.email.trim()
      ? (isValidEmail(datos.email) ? null : "El correo no es valido (ej. contacto@empresa.pe)")
      : "Ingresa el correo electronico",
  };

  /** Muestra el error si el campo ya tiene contenido o el usuario salio de el. */
  const errorVisible = (campo: keyof typeof errores, valor: string): string | null => {
    if (!errores[campo]) return null;
    return tocados[campo] || valor.trim().length > 0 ? errores[campo] : null;
  };
  const marcarTocado = (campo: keyof typeof errores) => setTocados((prev) => ({ ...prev, [campo]: true }));

  const errorDocumento = errorVisible("documento", datos.numeroDocumento);
  const errorRazonSocial = errorVisible("razonSocial", datos.razonSocial);
  const errorDireccion = errorVisible("direccion", datos.direccion);
  const errorContacto = errorVisible("contacto", datos.contacto);
  const errorTelefono = errorVisible("telefono", datos.telefono);
  const errorEmail = errorVisible("email", datos.email);

  return (
    <div className="flex flex-col gap-4 pt-3">
      {selectedLabels && (
        <div className="flex items-start gap-2 rounded-lg border border-border bg-secondary px-3 py-2.5 text-xs">
          <Store className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="text-muted-foreground">
            <span className="font-semibold text-foreground">Espacios en reserva temporal: </span>
            {selectedLabels}
          </span>
        </div>
      )}

      <div>
        <p className="mb-2 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
          Datos comerciales
        </p>
        <div className="space-y-2.5">
          <div className="space-y-1">
            <Label htmlFor="tipoComprobante" className={LABEL_CLASE}><span>Comprobante</span></Label>
            {comprobantes.length >= 2 ? (
              <div className="grid grid-cols-2 gap-2">
                {comprobantes.slice(0, 2).map((c) => {
                  const valor = c.nombre.toLowerCase();
                  const activo = datos.tipoComprobante === valor;
                  return (
                    <Button
                      key={c.itemId ?? c.id}
                      type="button"
                      variant={activo ? "default" : "outline"}
                      className={`h-auto justify-center rounded-lg px-3 py-2 text-xs ${
                        activo ? "bg-primary font-semibold text-primary-foreground" : "border-border font-medium text-muted-foreground"
                      }`}
                      onClick={() => cambiarComprobante(valor)}
                    >
                      <span>{c.nombre}</span>
                    </Button>
                  );
                })}
              </div>
            ) : (
              <Select value={datos.tipoComprobante} onValueChange={cambiarComprobante}>
                <SelectTrigger id="tipoComprobante" className="h-9 text-sm"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  {comprobantes.map((c) => (
                    <SelectItem key={c.itemId ?? c.id} value={c.nombre.toLowerCase()}><span>{c.nombre}</span></SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {datos.tipoComprobante && (
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="numeroDocumento" className={LABEL_CLASE}><span>{docLabel}</span></Label>
                {lookupLoading && (
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${BADGE_STYLES.WARNING}`}>
                    <span>{isFactura ? "Buscando en SUNAT..." : "Buscando en RENIEC..."}</span>
                  </span>
                )}
                {!lookupLoading && validado && (
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${BADGE_STYLES.SUCCESS}`}>
                    <ShieldCheck className="h-3 w-3" />
                    <span>{isFactura ? "Validado SUNAT" : "Validado RENIEC"}</span>
                  </span>
                )}
              </div>
              <Input
                id="numeroDocumento"
                placeholder={docPlaceholder}
                className={errorDocumento ? `${INPUT_CLASE} ${INPUT_ERROR_CLASE}` : INPUT_CLASE}
                aria-invalid={Boolean(errorDocumento)}
                maxLength={docMax}
                inputMode="numeric"
                value={datos.numeroDocumento}
                onBlur={() => marcarTocado("documento")}
                onChange={(e) => {
                  docEditedRef.current = true;
                  setValidado(false);
                  onChange({ numeroDocumento: onlyDigits(e.target.value, docMax), tipoDocumento: docLabel });
                }}
              />
              {errorDocumento && (
                <p role="alert" className="text-[10px] font-medium text-destructive">{errorDocumento}</p>
              )}
            </div>
          )}

          {isFactura && (
            <div className="space-y-1">
              <Label htmlFor="razonSocial" className={LABEL_CLASE}><span>Razon social</span></Label>
              <Input id="razonSocial" placeholder="Ej. Corporacion Minera S.A." className={errorRazonSocial ? `${INPUT_CLASE} ${INPUT_ERROR_CLASE}` : INPUT_CLASE} maxLength={150}
                aria-invalid={Boolean(errorRazonSocial)}
                value={datos.razonSocial} onBlur={() => marcarTocado("razonSocial")}
                onChange={(e) => onChange({ razonSocial: e.target.value })} />
              {errorRazonSocial ? (
                <p role="alert" className="text-[10px] font-medium text-destructive">{errorRazonSocial}</p>
              ) : (
                <p className="text-[10px] text-muted-foreground">
                  Dato validado automaticamente con el padron de contribuyentes de SUNAT.
                </p>
              )}
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="direccion" className={LABEL_CLASE}><span>Direccion fiscal</span></Label>
            <Input id="direccion" placeholder="Av. Principal 123, Distrito, Provincia" className={errorDireccion ? `${INPUT_CLASE} ${INPUT_ERROR_CLASE}` : INPUT_CLASE} maxLength={200}
              aria-invalid={Boolean(errorDireccion)}
              value={datos.direccion} onBlur={() => marcarTocado("direccion")}
              onChange={(e) => onChange({ direccion: e.target.value })} />
            {errorDireccion && (
              <p role="alert" className="text-[10px] font-medium text-destructive">{errorDireccion}</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="h-px flex-1 bg-border" />
        <span className="text-[9px] font-medium tracking-widest text-muted-foreground uppercase">Contacto comercial y tecnico</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <div className="space-y-2.5">
        <div className="flex gap-3">
          <div className="flex-1 space-y-1">
            <Label htmlFor="contacto" className={LABEL_CLASE}><span>Persona de contacto</span></Label>
            <Input id="contacto" placeholder="Nombre y apellido" className={errorContacto ? `${INPUT_CLASE} ${INPUT_ERROR_CLASE}` : INPUT_CLASE} maxLength={100}
              aria-invalid={Boolean(errorContacto)}
              value={datos.contacto} onBlur={() => marcarTocado("contacto")}
              onChange={(e) => onChange({ contacto: e.target.value })} />
            {errorContacto && (
              <p role="alert" className="text-[10px] font-medium text-destructive">{errorContacto}</p>
            )}
          </div>
          <div className="flex-1 space-y-1">
            <Label htmlFor="telefono" className={LABEL_CLASE}><span>Telefono</span></Label>
            <Input id="telefono" placeholder="999 888 777" className={errorTelefono ? `${INPUT_CLASE} ${INPUT_ERROR_CLASE}` : INPUT_CLASE} maxLength={9} inputMode="numeric"
              aria-invalid={Boolean(errorTelefono)}
              value={datos.telefono} onBlur={() => marcarTocado("telefono")}
              onChange={(e) => onChange({ telefono: onlyPhoneDigits(e.target.value) })} />
            {errorTelefono && (
              <p role="alert" className="text-[10px] font-medium text-destructive">{errorTelefono}</p>
            )}
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="emailReserva" className={LABEL_CLASE}><span>Correo electronico</span></Label>
          <Input id="emailReserva" type="email" placeholder="contacto@empresa.pe" className={errorEmail ? `${INPUT_CLASE} ${INPUT_ERROR_CLASE}` : INPUT_CLASE} maxLength={150}
            aria-invalid={Boolean(errorEmail)}
            value={datos.email} onBlur={() => marcarTocado("email")}
            onChange={(e) => onChange({ email: e.target.value })} />
          {errorEmail && (
            <p role="alert" className="text-[10px] font-medium text-destructive">{errorEmail}</p>
          )}
        </div>
      </div>

      <RepresentantesAdicionalesEditor
        value={representantesAdicionales}
        onChange={onRepresentantesChange}
        errores={erroresRepresentantesAdicionales(representantesAdicionales)}
        titulo="Representantes legales adicionales"
        descripcion="El representante principal es el titular de la cuenta. Si la empresa tiene otro representante legal, agregalo aqui; se guardara para el contrato y las proximas reservas."
      />

      <div className="flex items-start gap-2 rounded-lg border border-primary/10 bg-primary/5 px-3 py-2.5 text-[11px] text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
        <span>Tus datos seran vinculados al contrato marco del evento y validados por el area legal del IIMP.</span>
      </div>
    </div>
  );
}
