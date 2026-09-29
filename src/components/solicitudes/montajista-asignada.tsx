"use client";

import { useState } from "react";
import { Badge, Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input } from "@nrivera-iimp/ui-kit-iimp";
import { Building2, Loader2, Search, X } from "lucide-react";
import { toast } from "sonner";
import { standsMontajistaService } from "@/lib/client/api/services/stands-montajista-service";
import { useConfirm } from "@/hooks/use-confirm";
import { BADGE_STYLES } from "@/lib/shared/constants";
import type { EmpresaMontajistaDTO } from "@/types/dto/stands/stands-integracion.dto";

interface Props {
  standApiId: string | null | undefined;
  standCode: string;
  asignadaId: string | null | undefined;
  asignadaNombre: string | null | undefined;
  tipoEvento: number;
  codigoEvento: number;
  /** Refresca la fila tras asignar/desasignar. */
  onChanged: () => void;
}

/** Asignacion de la empresa montajista del stand (solo admin). */
export function MontajistaAsignada({ standApiId, standCode, asignadaId, asignadaNombre, tipoEvento, codigoEvento, onChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState<EmpresaMontajistaDTO[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const { confirm, confirmDialog } = useConfirm();

  const buscar = async (texto?: string) => {
    setBuscando(true);
    try {
      setResultados(await standsMontajistaService.empresas(texto ?? q));
    } catch {
      toast.error("No se pudo obtener el catalogo de empresas");
    } finally {
      setBuscando(false);
    }
  };

  const abrir = () => {
    setOpen(true);
    setQ("");
    setResultados([]);
    void buscar("");
  };

  const asignar = async (empresa: EmpresaMontajistaDTO | null) => {
    if (!standApiId) {
      toast.error("El stand no tiene identificador de API");
      return;
    }
    if (empresa) {
      const ok = await confirm({
        title: "Asignar montajista",
        description: `¿Asignar "${empresa.razon_social}" al stand ${standCode}?`,
        confirmLabel: "Asignar",
      });
      if (!ok) return;
    }
    setGuardando(true);
    try {
      await standsMontajistaService.asignar({
        tipo_evento: tipoEvento,
        codigo_evento: codigoEvento,
        stand_api_id: standApiId,
        empresa_montajista: empresa ? { sie_code: empresa.sie_code, razon_social: empresa.razon_social } : null,
      });
      toast.success(empresa ? "Montajista asignada" : "Montajista desasignada");
      setOpen(false);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo asignar la montajista");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-secondary/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" />
          <span className="text-[11px] font-bold tracking-widest text-muted-foreground uppercase">Empresa montajista</span>
        </span>
        <span className="flex items-center gap-2">
          {asignadaId ? (
            <Badge className={`pointer-events-none text-[10px] ${BADGE_STYLES.SUCCESS}`}>
              <span>{asignadaNombre || asignadaId}</span>
            </Badge>
          ) : (
            <span className="text-[11px] text-muted-foreground">Sin asignar</span>
          )}
          <Button type="button" size="sm" variant="outline" className="h-7 gap-1.5 text-[11px]" onClick={abrir}>
            <Search className="h-3.5 w-3.5" />
            <span>{asignadaId ? "Reasignar" : "Asignar"}</span>
          </Button>
          {asignadaId && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-destructive"
              title="Quitar montajista"
              disabled={guardando}
              onClick={() => { void asignar(null); }}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </span>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto rounded-xl border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle><span>Asignar empresa montajista</span></DialogTitle>
          </DialogHeader>
          <div className="flex gap-2">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por RUC o razon social"
              onKeyDown={(e) => { if (e.key === "Enter") void buscar(); }}
            />
            <Button size="sm" variant="outline" className="shrink-0" onClick={() => { void buscar(); }} disabled={buscando}>
              {buscando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
            </Button>
          </div>
          <div className="max-h-64 divide-y divide-border overflow-y-auto rounded-lg border border-border">
            {resultados.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                {buscando ? "Buscando..." : "Sin resultados. Busca por RUC o razon social."}
              </p>
            ) : (
              resultados.map((emp) => (
                <button
                  key={emp.sie_code}
                  type="button"
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-secondary disabled:opacity-60"
                  disabled={guardando}
                  onClick={() => { void asignar(emp); }}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-medium text-foreground">{emp.razon_social || emp.sie_code}</span>
                    <span className="block font-mono text-[10px] text-muted-foreground">{emp.sie_code}</span>
                  </span>
                  <span className="shrink-0 text-[10px] font-semibold text-primary">Asignar</span>
                </button>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" className="w-full" onClick={() => setOpen(false)}><span>Cerrar</span></Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {confirmDialog}
    </div>
  );
}
