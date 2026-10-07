"use client";

import { useState } from "react";
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@nrivera-iimp/ui-kit-iimp";
import { toast } from "sonner";
import { empresasService } from "@/lib/client/api/services/empresas-service";
import { REGEX_EMAIL, REGEX_RUC, TIPOS_DOCUMENTO_EMPRESA, TIPOS_DOCUMENTO_EMPRESA_LABELS, TIPOS_DOCUMENTO_PERSONA, TIPOS_DOCUMENTO_PERSONA_LABELS, UBIGEO_PAIS_PERU } from "@/lib/shared/constants";
import { validarDocumentoPersona } from "@/lib/shared/utils/documento-persona";
import type { EmpresaFuenteDTO } from "@/types/dto/empresas";

/**
 * Registra la relacion usuario (persona) - empresa con servicio-persona como
 * fuente: busca la empresa (o la crea), asegura la persona de contacto y crea
 * la cuenta local con sus identificadores (sie_code / id_empresa).
 */
export function RegistrarEmpresaFuenteModal({ onClose, onRegistrado }: {
  onClose: () => void;
  onRegistrado: () => void;
}) {
  /* Busqueda en la fuente */
  const [q, setQ] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState<EmpresaFuenteDTO[] | null>(null);
  const [seleccionada, setSeleccionada] = useState<EmpresaFuenteDTO | null>(null);
  const [creandoEmpresa, setCreandoEmpresa] = useState(false);

  /* Empresa (fuente) */
  const [nombre, setNombre] = useState("");
  const [idTipoDocumento, setIdTipoDocumento] = useState<string>(TIPOS_DOCUMENTO_EMPRESA.RUC);
  const [documento, setDocumento] = useState("");
  const [direccion, setDireccion] = useState("");
  const [correoEmpresa, setCorreoEmpresa] = useState("");
  const [telefonoEmpresa, setTelefonoEmpresa] = useState("");
  const [pais, setPais] = useState(String(UBIGEO_PAIS_PERU));

  /* Persona de contacto (fuente) */
  const [tipoDocumento, setTipoDocumento] = useState<string>(TIPOS_DOCUMENTO_PERSONA.DNI);
  const [documentoPersona, setDocumentoPersona] = useState("");
  const [apellidoPaterno, setApellidoPaterno] = useState("");
  const [apellidoMaterno, setApellidoMaterno] = useState("");
  const [nombres, setNombres] = useState("");
  const [celular, setCelular] = useState("");
  const [direccionPersona, setDireccionPersona] = useState("");

  /* Acceso local */
  const [email, setEmail] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const buscar = async () => {
    const termino = q.trim();
    if (termino.length < 3) { setError("Escribe al menos 3 caracteres (razon social o RUC)"); return; }
    setError(null);
    setBuscando(true);
    try {
      const lista = await empresasService.buscarFuente(termino);
      setResultados(lista);
      if (lista.length === 0) toast.info("No se encontro la empresa en servicio-persona");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al buscar empresas");
      setResultados([]);
    } finally {
      setBuscando(false);
    }
  };

  const usar = (empresa: EmpresaFuenteDTO) => {
    setSeleccionada(empresa);
    setCreandoEmpresa(false);
    setNombre(empresa.nombre);
    setDocumento(empresa.documento);
    setIdTipoDocumento(empresa.idTipoDocumento || TIPOS_DOCUMENTO_EMPRESA.RUC);
    setDireccion(empresa.direccion ?? "");
    setCorreoEmpresa(empresa.correo ?? "");
    setTelefonoEmpresa(empresa.telefono ?? "");
    setError(null);
  };

  const iniciarCreacion = () => {
    const termino = q.trim();
    setSeleccionada(null);
    setCreandoEmpresa(true);
    setResultados(null);
    setNombre(termino);
    setDocumento(/^\d+$/.test(termino) ? termino : "");
    setIdTipoDocumento(TIPOS_DOCUMENTO_EMPRESA.RUC);
    setError(null);
  };

  const volverABuscar = () => {
    setSeleccionada(null);
    setCreandoEmpresa(false);
    setError(null);
  };

  const registrar = async () => {
    setError(null);
    if (!REGEX_EMAIL.test(email.trim())) { setError("Ingresa un correo valido para el acceso"); return; }
    const errorDocumento = validarDocumentoPersona(tipoDocumento, documentoPersona);
    if (errorDocumento) { setError(errorDocumento); return; }
    if (!apellidoPaterno.trim() || !nombres.trim()) { setError("Apellido paterno y nombres del contacto son obligatorios"); return; }
    if (idTipoDocumento === TIPOS_DOCUMENTO_EMPRESA.RUC && !REGEX_RUC.test(documento.trim())) { setError("El RUC de la empresa debe tener 11 digitos"); return; }
    if (!nombre.trim() || !direccion.trim() || !REGEX_EMAIL.test(correoEmpresa.trim()) || !telefonoEmpresa.trim()) {
      setError("Completa los datos de la empresa (razon social, direccion, correo y telefono)");
      return;
    }

    setGuardando(true);
    try {
      const resultado = await empresasService.registrarCuentaEmpresa({
        sieCodeEmpresa: seleccionada?.sieCode ?? null,
        empresa: {
          nombre: nombre.trim(),
          idTipoDocumento,
          documento: documento.trim(),
          direccion: direccion.trim(),
          correo: correoEmpresa.trim(),
          telefono: telefonoEmpresa.trim(),
          pais: Number(pais) || UBIGEO_PAIS_PERU,
        },
        persona: {
          tipoDocumento,
          documento: documentoPersona.trim(),
          apellidoPaterno: apellidoPaterno.trim(),
          apellidoMaterno: apellidoMaterno.trim() || null,
          nombres: nombres.trim(),
          celular: celular.trim() || null,
          direccion: direccionPersona.trim() || null,
        },
        email: email.trim(),
      });
      const detalle = [
        resultado.empresaCreadaEnFuente
          ? "empresa creada en servicio-persona"
          : resultado.empresaActualizadaEnFuente
            ? "empresa actualizada en servicio-persona"
            : "empresa existente reutilizada",
        resultado.personaCreadaEnFuente ? "persona creada" : "persona existente reutilizada",
      ].join(" · ");
      if (resultado.emailEnviado) {
        toast.success(`Cuenta creada (${detalle}). Credenciales enviadas a ${resultado.email}.`);
      } else {
        toast.warning(`Cuenta creada (${detalle}), pero el correo no pudo enviarse. Usa "Reenviar credenciales".`);
      }
      onRegistrado();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrar la cuenta");
    } finally {
      setGuardando(false);
    }
  };

  const enFormulario = Boolean(seleccionada) || creandoEmpresa;

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle><span>Registrar empresa desde servicio-persona</span></DialogTitle>
        </DialogHeader>

        {!enFormulario ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={q}
                onChange={(e) => { setQ(e.target.value); }}
                onKeyDown={(e) => { if (e.key === "Enter") void buscar(); }}
                placeholder="Razon social o RUC (ej. ACME o 20123456789)"
                className="h-8 text-xs"
              />
              <Button size="sm" className="h-8 shrink-0" onClick={() => { void buscar(); }} disabled={buscando}>
                <span>{buscando ? "Buscando..." : "Buscar"}</span>
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              La empresa vive en <strong>servicio-persona</strong> (fuente). Si no existe, se crea alli con los datos
              que ingreses; en este sistema solo se guarda la relacion con el usuario y la ficha contractual minima.
            </p>
            {resultados && resultados.length > 0 && (
              <div className="max-h-[300px] space-y-1 overflow-y-auto rounded-lg border border-border p-2">
                {resultados.map((e) => (
                  <div key={e.sieCode || e.documento || e.nombre} className="flex items-center justify-between gap-2 rounded px-1 py-1">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium">{e.nombre}</p>
                      <p className="font-mono text-[10px] text-muted-foreground">
                        {e.documento || "—"} · {e.sieCode || "—"}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" className="h-7 shrink-0 text-xs" onClick={() => { usar(e); }}>
                      <span>Usar empresa</span>
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {resultados && resultados.length === 0 && !buscando && (
              <div className="space-y-2 rounded-lg border border-dashed border-border bg-secondary px-3 py-3 text-center">
                <p className="text-[11px] text-muted-foreground">Sin resultados en servicio-persona.</p>
                <Button size="sm" className="h-7 text-xs" onClick={iniciarCreacion}>
                  <span>Crear empresa en servicio-persona</span>
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {seleccionada ? (
              <div className="rounded-lg border border-border bg-secondary p-3 text-xs">
                <p className="font-medium">{seleccionada.nombre}</p>
                <p className="font-mono text-[10px] text-muted-foreground">
                  {seleccionada.documento || "—"} · {seleccionada.sieCode || "—"}
                </p>
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                La empresa no existe en servicio-persona: se creara con estos datos.
              </p>
            )}

            <div className="space-y-2">
              <p className="text-xs font-semibold text-primary">Empresa</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs"><span>Razon social *</span></Label>
                  <Input value={nombre} onChange={(e) => { setNombre(e.target.value); }} disabled={Boolean(seleccionada)} className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs"><span>Tipo de documento *</span></Label>
                  <Select value={idTipoDocumento} onValueChange={setIdTipoDocumento} disabled={Boolean(seleccionada)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(TIPOS_DOCUMENTO_EMPRESA_LABELS).map(([valor, etiqueta]) => (
                        <SelectItem key={valor} value={valor}><span>{etiqueta}</span></SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs"><span>Documento *</span></Label>
                  <Input value={documento} onChange={(e) => { setDocumento(e.target.value); }} disabled={Boolean(seleccionada?.documento)} className="h-8 text-xs" placeholder="20123456789" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs"><span>Telefono *</span></Label>
                  <Input value={telefonoEmpresa} onChange={(e) => { setTelefonoEmpresa(e.target.value); }} className="h-8 text-xs" />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs"><span>Direccion *</span></Label>
                  <Input value={direccion} onChange={(e) => { setDireccion(e.target.value); }} className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs"><span>Correo de la empresa *</span></Label>
                  <Input value={correoEmpresa} onChange={(e) => { setCorreoEmpresa(e.target.value); }} className="h-8 text-xs" placeholder="contacto@empresa.com" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs"><span>Pais (ubigeo)</span></Label>
                  <Input value={pais} onChange={(e) => { setPais(e.target.value.replace(/\D/g, "")); }} className="h-8 text-xs" placeholder={String(UBIGEO_PAIS_PERU)} />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-primary">Persona de contacto</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs"><span>Tipo de documento *</span></Label>
                  <Select value={tipoDocumento} onValueChange={setTipoDocumento}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(TIPOS_DOCUMENTO_PERSONA_LABELS).map(([valor, etiqueta]) => (
                        <SelectItem key={valor} value={valor}><span>{etiqueta}</span></SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs"><span>Documento *</span></Label>
                  <Input value={documentoPersona} onChange={(e) => { setDocumentoPersona(e.target.value); }} className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs"><span>Apellido paterno *</span></Label>
                  <Input value={apellidoPaterno} onChange={(e) => { setApellidoPaterno(e.target.value); }} className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs"><span>Apellido materno</span></Label>
                  <Input value={apellidoMaterno} onChange={(e) => { setApellidoMaterno(e.target.value); }} className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs"><span>Nombres *</span></Label>
                  <Input value={nombres} onChange={(e) => { setNombres(e.target.value); }} className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs"><span>Celular</span></Label>
                  <Input value={celular} onChange={(e) => { setCelular(e.target.value); }} className="h-8 text-xs" />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs"><span>Direccion</span></Label>
                  <Input value={direccionPersona} onChange={(e) => { setDireccionPersona(e.target.value); }} className="h-8 text-xs" placeholder="Av. Arequipa 1250, Lince" />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs"><span>Correo del acceso (login del Portal) *</span></Label>
              <Input value={email} onChange={(e) => { setEmail(e.target.value); }} className="h-8 text-xs" placeholder="usuario@empresa.com" />
            </div>
          </div>
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}

        <DialogFooter>
          {enFormulario ? (
            <>
              <Button variant="ghost" size="sm" onClick={volverABuscar} disabled={guardando}>
                <span>Volver</span>
              </Button>
              <Button size="sm" onClick={() => { void registrar(); }} disabled={guardando}>
                <span>{guardando ? "Registrando..." : "Registrar cuenta"}</span>
              </Button>
            </>
          ) : (
            <Button variant="ghost" size="sm" onClick={onClose}><span>Cerrar</span></Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
