"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@nrivera-iimp/ui-kit-iimp";
import { AlertTriangle, Image as ImageIcon, Loader2, ShieldCheck, Upload } from "lucide-react";
import { toast } from "sonner";
import { sunatService } from "@/lib/client/api/services/sunat-service";
import { empresasService } from "@/lib/client/api/services/empresas-service";
import { uploadService } from "@/lib/client/api/services/upload-service";
import { BADGE_STYLES, FOTO_PERSONA_MAX_BYTES, TIPOS_DOCUMENTO_PERSONA, TIPOS_DOCUMENTO_PERSONA_LABELS, VALIDACIONES } from "@/lib/shared/constants";
import type { PersonaFuenteDTO } from "@/types/dto/empresas";

interface Props {
  inicial: { nombre: string; tipoDocumento: string; dni: string; partida: string; direccion: string; correo: string; celular: string; fotoUrl: string };
  onGuardar: (datos: {
    representanteLegalNombre: string;
    representanteLegalTipoDocumento: string;
    representanteLegalDni: string;
    partidaElectronica: string;
    representanteDireccion: string;
    representanteCorreo: string;
    representanteCelular: string;
    representanteFotoUrl: string;
  }) => void;
  onClose: () => void;
}

type ReniecDni = Awaited<ReturnType<typeof sunatService.consultarDni>>;

function normalizarNombre(valor?: string | null): string {
  return tokensNombre(valor).join(" ");
}

function tokensNombre(valor?: string | null): string[] {
  return (valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .sort();
}

type OrigenDatos = "reniec" | "padron";

/**
 * Representante legal de la empresa (dato del contrato y de servicio-persona).
 * Consulta RENIEC y el padrón interno; si ambos responden, el usuario elige la
 * fuente que se usará para autocompletar el representante.
 */
export function RepresentanteLegalModal({ inicial, onGuardar, onClose }: Props) {
  const [tipoDocumento, setTipoDocumento] = useState(inicial.tipoDocumento || TIPOS_DOCUMENTO_PERSONA.DNI);
  const [dni, setDni] = useState(inicial.dni);
  const [nombre, setNombre] = useState(inicial.nombre);
  const [partida, setPartida] = useState(inicial.partida);
  const [direccion, setDireccion] = useState(inicial.direccion);
  const [correo, setCorreo] = useState(inicial.correo);
  const [celular, setCelular] = useState(inicial.celular);
  const [fotoUrl, setFotoUrl] = useState(inicial.fotoUrl);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [consultando, setConsultando] = useState(false);
  const [reniec, setReniec] = useState<ReniecDni | null>(null);
  const [padron, setPadron] = useState<PersonaFuenteDTO | null>(null);
  const [origen, setOrigen] = useState<OrigenDatos | null>(null);
  const [consultado, setConsultado] = useState(false);
  const editedRef = useRef(inicial.dni.trim().length > 0);
  const fotoRef = useRef<HTMLInputElement>(null);
  const esDni = tipoDocumento === TIPOS_DOCUMENTO_PERSONA.DNI;

  const usarReniec = useCallback((datos: ReniecDni) => {
    setNombre(datos.nombreCompleto ?? "");
    setDireccion(datos.direccion ?? "");
    setCorreo("");
    setCelular("");
    setOrigen("reniec");
  }, []);

  const usarPadron = useCallback((datos: PersonaFuenteDTO) => {
    setNombre(datos.nombreCompleto);
    setDireccion(datos.direccion ?? "");
    setCorreo(datos.correo ?? "");
    setCelular(datos.celular ?? "");
    setOrigen("padron");
  }, []);

  const onFotoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > FOTO_PERSONA_MAX_BYTES) {
      toast.error("La foto supera el maximo de 5 MB");
      return;
    }
    setSubiendoFoto(true);
    try {
      setFotoUrl(await uploadService.subir(file));
    } catch {
      toast.error("No se pudo subir la foto");
    }
    setSubiendoFoto(false);
  };

  /** Consulta RENIEC solo para DNI; el padrón interno se consulta siempre. */
  const consultarPersona = useCallback(async (documento: string, tipo: string) => {
    setConsultando(true);
    setConsultado(false);
    setReniec(null);
    setPadron(null);
    setOrigen(null);
    const [ren, pad] = await Promise.allSettled([
      tipo === TIPOS_DOCUMENTO_PERSONA.DNI
        ? sunatService.consultarDni(documento)
        : Promise.resolve(null),
      empresasService.buscarPersonaFuente(tipo, documento),
    ]);
    const r = ren.status === "fulfilled" && ren.value && !ren.value.error && ren.value.nombreCompleto
      ? ren.value
      : null;
    const p = pad.status === "fulfilled" ? pad.value : null;
    setReniec(r);
    setPadron(p);
    /* Si solo hay una fuente, se usa automáticamente. Si hay dos, decide el usuario. */
    if (r && !p) usarReniec(r);
    if (!r && p) usarPadron(p);
    setConsultado(true);
    setConsultando(false);
  }, [usarReniec, usarPadron]);

  /* El DNI se consulta al llegar a 8 dígitos; otros documentos, al salir del campo. */
  useEffect(() => {
    if (!editedRef.current || !esDni || dni.length !== VALIDACIONES.DNI_LONGITUD) return;
    editedRef.current = false;
    void consultarPersona(dni, tipoDocumento);
  }, [dni, tipoDocumento, esDni, consultarPersona]);

  const nombresDifieren =
    !!reniec && !!padron &&
    normalizarNombre(reniec.nombreCompleto) !== normalizarNombre(padron.nombreCompleto);
  const requiereEleccion = !!reniec && !!padron && !origen;

  const guardar = () => {
    if (requiereEleccion) return;
    onGuardar({
      representanteLegalNombre: nombre.trim(),
      representanteLegalTipoDocumento: tipoDocumento,
      representanteLegalDni: dni.trim(),
      partidaElectronica: partida.trim(),
      representanteDireccion: direccion.trim(),
      representanteCorreo: correo.trim(),
      representanteCelular: celular.trim(),
      representanteFotoUrl: fotoUrl,
    });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader className="text-left">
          <DialogTitle className="text-base font-semibold">Representante legal</DialogTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {esDni
              ? "Con DNI se consultan RENIEC y el padrón interno."
              : "Con carné de extranjería o pasaporte solo se consulta el padrón interno."}
            {" "}Si hay dos resultados, elige la fuente correcta para el contrato.
          </p>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label className="text-xs">Tipo de documento</Label>
            <Select
              value={tipoDocumento}
              onValueChange={(value) => {
                setTipoDocumento(value);
                setOrigen(null);
                setReniec(null);
                setPadron(null);
                setConsultado(false);
                editedRef.current = true;
                setDni((prev) => value === TIPOS_DOCUMENTO_PERSONA.DNI
                  ? prev.replace(/\D/g, "").slice(0, VALIDACIONES.DNI_LONGITUD)
                  : prev.replace(/[^0-9A-Za-z]/g, "").slice(0, 15));
              }}
              disabled={consultando}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(TIPOS_DOCUMENTO_PERSONA).map((tipo) => (
                  <SelectItem key={tipo} value={tipo}>
                    {TIPOS_DOCUMENTO_PERSONA_LABELS[tipo] ?? tipo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs">Documento del representante</Label>
              {origen === "reniec" && (
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${BADGE_STYLES.SUCCESS}`}>
                  <ShieldCheck className="h-3 w-3" />
                  <span>Datos RENIEC</span>
                </span>
              )}
              {origen === "padron" && (
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${BADGE_STYLES.INFO}`}>
                  <span>Padrón interno</span>
                </span>
              )}
            </div>
            <Input
              value={dni}
              onChange={(e) => {
                editedRef.current = true;
                setOrigen(null);
                setReniec(null);
                setPadron(null);
                setConsultado(false);
                setDni(esDni
                  ? e.target.value.replace(/\D/g, "").slice(0, VALIDACIONES.DNI_LONGITUD)
                  : e.target.value.replace(/[^0-9A-Za-z]/g, "").slice(0, 15));
              }}
              placeholder={esDni ? "45871233" : "Numero de documento"}
              onBlur={() => {
                if (!esDni && dni.trim().length > 0) {
                  editedRef.current = false;
                  void consultarPersona(dni.trim(), tipoDocumento);
                }
              }}
              className="h-9 font-mono text-sm"
            />
            {consultando && (
              <p className="flex items-center gap-1.5 rounded-md border border-border bg-secondary/50 px-2 py-1.5 text-[11px] text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>{esDni ? "Consultando RENIEC y padrón interno..." : "Consultando padrón interno..."}</span>
              </p>
            )}
            {!consultando && consultado && (reniec || padron) && (
              <div className="space-y-2">
                {nombresDifieren && (
                  <p className="flex items-start gap-1.5 rounded-md border border-warning/40 bg-warning/10 px-2 py-1.5 text-[11px] text-warning">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                    <span>Las fuentes devuelven nombres distintos. Elige la identidad correcta antes de guardar.</span>
                  </p>
                )}
                {reniec && (
                  <div className={`rounded-md border p-2 ${origen === "reniec" ? "border-primary/50 bg-primary/5" : "border-border"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 space-y-0.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">RENIEC</p>
                        <p className="text-xs font-semibold text-foreground">{reniec.nombreCompleto}</p>
                        {reniec.direccion && <p className="text-[11px] text-muted-foreground">{reniec.direccion}</p>}
                        <p className="text-[10px] text-muted-foreground">Nombre oficial. No aporta correo ni celular.</p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant={origen === "reniec" ? "default" : "outline"}
                        className="h-7 shrink-0 text-xs"
                        onClick={() => usarReniec(reniec)}
                      >
                        Usar
                      </Button>
                    </div>
                  </div>
                )}
                {padron && (
                  <div className={`rounded-md border p-2 ${origen === "padron" ? "border-primary/50 bg-primary/5" : "border-border"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 space-y-0.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Padrón interno</p>
                        <p className="text-xs font-semibold text-foreground">{padron.nombreCompleto}</p>
                        <p className="font-mono text-[10px] text-muted-foreground">{padron.sieCode}</p>
                        {padron.direccion && <p className="text-[11px] text-muted-foreground">{padron.direccion}</p>}
                        <p className="text-[10px] text-muted-foreground">
                          {[padron.correo, padron.celular].filter(Boolean).join(" - ") || "Sin correo ni celular registrados."}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant={origen === "padron" ? "default" : "outline"}
                        className="h-7 shrink-0 text-xs"
                        onClick={() => usarPadron(padron)}
                      >
                        Usar
                      </Button>
                    </div>
                  </div>
                )}
                {requiereEleccion && (
                  <p className="text-[11px] font-medium text-destructive">Selecciona una de las dos fuentes para continuar.</p>
                )}
              </div>
            )}
            {!consultando && consultado && !reniec && !padron && (
              <p className="rounded-md border border-border bg-secondary/50 px-2 py-1.5 text-[11px] text-muted-foreground">
                No se encontraron datos en {esDni ? "RENIEC ni en el padrón interno" : "el padrón interno"}. Completa los datos manualmente.
              </p>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Nombre completo</Label>
            <Input
              value={nombre}
              onChange={(e) => {
                setNombre(e.target.value);
                setOrigen(null);
              }}
              placeholder="Jorge Quispe Ramos"
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Partida electronica (opcional)</Label>
            <Input value={partida} onChange={(e) => setPartida(e.target.value)} placeholder="11014857" maxLength={50} className="h-9 font-mono text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Direccion</Label>
            <Input value={direccion} onChange={(e) => setDireccion(e.target.value)} placeholder="Av. Arequipa 1250, Lince" maxLength={100} className="h-9 text-sm" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Correo</Label>
              <Input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="representante@empresa.pe" maxLength={101} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Celular</Label>
              <Input value={celular} onChange={(e) => setCelular(e.target.value)} placeholder="+51 987 654 321" maxLength={35} className="h-9 text-sm" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Foto (opcional)</Label>
            <div className="mt-1 flex items-center gap-3">
              {fotoUrl ? (
                <img src={fotoUrl} alt="Foto del representante" className="h-12 w-12 rounded-full border bg-white object-cover" />
              ) : (
                <span className="flex h-12 w-12 items-center justify-center rounded-full border border-dashed text-muted-foreground">
                  <ImageIcon className="h-4 w-4" />
                </span>
              )}
              <input ref={fotoRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { void onFotoFile(e); }} />
              <Button type="button" variant="outline" size="sm" className="rounded-full text-xs" disabled={subiendoFoto} onClick={() => fotoRef.current?.click()}>
                {subiendoFoto ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
                <span>{fotoUrl ? "Cambiar foto" : "Subir foto"}</span>
              </Button>
              {fotoUrl && (
                <Button type="button" variant="ghost" size="sm" className="rounded-full text-xs text-destructive" onClick={() => setFotoUrl("")}>
                  <span>Quitar</span>
                </Button>
              )}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground"><span>JPG/PNG/WEBP hasta 5 MB; se guarda en servicio-persona al registrar la empresa.</span></p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}><span>Cancelar</span></Button>
          <Button size="sm" onClick={guardar} disabled={requiereEleccion}><span>Guardar representante</span></Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
