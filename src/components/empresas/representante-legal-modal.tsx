"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label } from "@nrivera-iimp/ui-kit-iimp";
import { Image as ImageIcon, Loader2, ShieldCheck, Upload } from "lucide-react";
import { toast } from "sonner";
import { sunatService } from "@/lib/client/api/services/sunat-service";
import { empresasService } from "@/lib/client/api/services/empresas-service";
import { uploadService } from "@/lib/client/api/services/upload-service";
import { BADGE_STYLES, FOTO_PERSONA_MAX_BYTES, TIPOS_DOCUMENTO_PERSONA, VALIDACIONES } from "@/lib/shared/constants";
import type { PersonaFuenteDTO } from "@/types/dto/empresas";

interface Props {
  inicial: { nombre: string; dni: string; partida: string; direccion: string; correo: string; celular: string; fotoUrl: string };
  onGuardar: (datos: {
    representanteLegalNombre: string;
    representanteLegalDni: string;
    partidaElectronica: string;
    representanteDireccion: string;
    representanteCorreo: string;
    representanteCelular: string;
    representanteFotoUrl: string;
  }) => void;
  onClose: () => void;
}

/**
 * Representante legal de la empresa (dato del contrato y de servicio-persona):
 * modal adicional al de la empresa. Con el DNI (8 digitos) se autocompleta el
 * nombre desde RENIEC; direccion/correo/celular viajan a la fuente de personas.
 */
export function RepresentanteLegalModal({ inicial, onGuardar, onClose }: Props) {
  const [dni, setDni] = useState(inicial.dni);
  const [nombre, setNombre] = useState(inicial.nombre);
  const [partida, setPartida] = useState(inicial.partida);
  const [direccion, setDireccion] = useState(inicial.direccion);
  const [correo, setCorreo] = useState(inicial.correo);
  const [celular, setCelular] = useState(inicial.celular);
  const [fotoUrl, setFotoUrl] = useState(inicial.fotoUrl);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [validado, setValidado] = useState(false);
  /** Persona encontrada en el padron interno (servicio-persona): trae correo/celular/direccion. */
  const [enPadron, setEnPadron] = useState<PersonaFuenteDTO | null>(null);
  /** Ya se consulto la fuente para el DNI actual (para mostrar existe/no existe). */
  const [consultado, setConsultado] = useState(false);
  /** Si el DNI inicial ya viene completo (edicion), el primer efecto consulta la fuente. */
  const editedRef = useRef(inicial.dni.trim().length === VALIDACIONES.DNI_LONGITUD);
  const fotoRef = useRef<HTMLInputElement>(null);

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

  /** Consulta RENIEC (nombre) y el padron interno (correo/celular/direccion) para el DNI. */
  const consultarPersona = async (documento: string) => {
    const [ren, pad] = await Promise.allSettled([
      sunatService.consultarDni(documento),
      empresasService.buscarPersonaFuente(TIPOS_DOCUMENTO_PERSONA.DNI, documento),
    ]);
    const r = ren.status === "fulfilled" ? ren.value : null;
    const p = pad.status === "fulfilled" ? pad.value : null;
    const nombreOficial = r?.nombreCompleto || p?.nombreCompleto || "";
    if (nombreOficial) {
      setNombre(nombreOficial);
      setValidado(true);
    }
    if (p) {
      setEnPadron(p);
      /* La fuente manda: sobrescribe con lo que trae el padron interno (correo/celular/direccion). */
      if (p.direccion) setDireccion(p.direccion);
      if (p.correo) setCorreo(p.correo);
      if (p.celular) setCelular(p.celular);
    } else {
      setEnPadron(null);
    }
    setConsultado(true);
  };

  /* Al abrir con un DNI ya cargado (edicion) el flag arranca activo y este efecto
   * consulta una sola vez; en escritura manual el flag lo activa el onChange. */
  useEffect(() => {
    if (!editedRef.current || dni.length !== VALIDACIONES.DNI_LONGITUD) return;
    editedRef.current = false;
    void consultarPersona(dni);
  }, [dni]);

  const guardar = () => {
    onGuardar({
      representanteLegalNombre: nombre.trim(),
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-left">
          <DialogTitle className="text-base font-semibold">Representante legal</DialogTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Este dato aparece en el contrato. Con el DNI (8 digitos) se autocompleta desde RENIEC.
          </p>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs">DNI del representante</Label>
              {validado && (
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${BADGE_STYLES.SUCCESS}`}>
                  <ShieldCheck className="h-3 w-3" />
                  <span>Validado RENIEC</span>
                </span>
              )}
            </div>
            <Input
              value={dni}
              onChange={(e) => {
                editedRef.current = true;
                setValidado(false);
                setEnPadron(null);
                setConsultado(false);
                setDni(e.target.value.replace(/[^\dA-Za-z]/g, "").slice(0, 15));
              }}
              placeholder="45871233"
              className="h-9 font-mono text-sm"
            />
            {consultado && enPadron && (
              <p className="rounded-md border border-success/30 bg-success/10 px-2 py-1.5 text-[11px] text-muted-foreground">
                <span>
                  Ya existe en el padron interno: <span className="font-mono font-semibold">{enPadron.sieCode || "—"}</span>
                  {enPadron.correo ? ` · ${enPadron.correo}` : ""}{enPadron.celular ? ` · ${enPadron.celular}` : ""}. Se
                  reutilizara y, si modificas sus datos, se actualizaran en la fuente.
                </span>
              </p>
            )}
            {consultado && !enPadron && (
              <p className="rounded-md border border-border bg-secondary/50 px-2 py-1.5 text-[11px] text-muted-foreground">
                <span>No existe en el padron interno: se creara en servicio-persona al guardar (con los datos de RENIEC).</span>
              </p>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Nombre completo</Label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Jorge Quispe Ramos" className="h-9 text-sm" />
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
          <Button size="sm" onClick={guardar}><span>Guardar representante</span></Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
