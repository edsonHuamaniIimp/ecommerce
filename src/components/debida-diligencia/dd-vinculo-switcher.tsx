"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@nrivera-iimp/ui-kit-iimp";
import { Check, ChevronLeft, ChevronRight, ChevronsUpDown, Users } from "lucide-react";
import { DdMatrizResultadoFinalBadge } from "./dd-matriz-badges";
import { DdPaisBandera } from "./dd-pais-bandera";
import { ddMatrizEvaluacionService } from "@/lib/client/api/services/dd-matriz-evaluacion-service";
import {
  DD_MATRIZ_EVAL_PER_PAGE_MAX,
  DD_MATRIZ_TIPO_VINCULO_LABELS,
  DD_RUTAS,
  type DdMatrizTipoVinculo,
} from "@/lib/shared/constants";
import type { DdMatrizEvaluacionFilaDTO } from "@/types/dto/debida-diligencia";

interface Props {
  expedienteId: string;
  /** Id del vinculo que se esta viendo. */
  actualId: string;
}

function normalizar(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * Atajo para pasar a otro vinculo de la misma empresa sin volver a la Matriz:
 * flechas anterior/siguiente y lista desplegable con buscador.
 */
export function DdVinculoSwitcher({ expedienteId, actualId }: Props) {
  const router = useRouter();
  const [vinculos, setVinculos] = useState<DdMatrizEvaluacionFilaDTO[]>([]);
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    let activo = true;
    (async () => {
      const filas: DdMatrizEvaluacionFilaDTO[] = [];
      for (let page = 1; ; page += 1) {
        const respuesta = await ddMatrizEvaluacionService.listar({
          expedienteId,
          page,
          perPage: DD_MATRIZ_EVAL_PER_PAGE_MAX,
        });
        filas.push(...respuesta.data);
        if (page >= respuesta.totalPages) break;
      }
      if (activo) setVinculos(filas);
    })().catch(() => {
      if (activo) setVinculos([]);
    });
    return () => {
      activo = false;
    };
  }, [expedienteId]);

  const indice = useMemo(() => vinculos.findIndex((vinculo) => vinculo.id === actualId), [vinculos, actualId]);

  if (vinculos.length <= 1) return null;

  const ir = (id: string) => {
    setAbierto(false);
    if (id !== actualId) router.push(`${DD_RUTAS.MATRIZ}/${id}`);
  };
  const anterior = indice > 0 ? vinculos[indice - 1] : null;
  const siguiente = indice >= 0 && indice < vinculos.length - 1 ? vinculos[indice + 1] : null;

  return (
    <div className="inline-flex items-center gap-1" role="group" aria-label="Cambiar de vínculo">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 w-8 p-0"
        disabled={!anterior}
        title={anterior ? `Anterior: ${anterior.nombre}` : "No hay vínculo anterior"}
        aria-label="Vínculo anterior"
        onClick={() => anterior && ir(anterior.id)}
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </Button>

      <Popover open={abierto} onOpenChange={setAbierto}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            role="combobox"
            aria-expanded={abierto}
            className="h-8 gap-1.5 text-xs"
            title="Cambiar de vínculo de esta empresa"
            aria-label="Cambiar de vínculo"
          >
            <Users className="h-3.5 w-3.5" />
            <span>
              {indice >= 0 ? `${indice + 1}/` : ""}
              {vinculos.length}
            </span>
            <ChevronsUpDown className="h-3 w-3 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[380px] p-0" align="end">
          <Command
            filter={(valor, busqueda) => (normalizar(valor).includes(normalizar(busqueda)) ? 1 : 0)}
          >
            <CommandInput placeholder="Buscar vínculo por nombre o documento..." />
            <CommandList>
              <CommandEmpty>Sin resultados.</CommandEmpty>
              <CommandGroup heading="Vínculos de esta empresa">
                {vinculos.map((vinculo) => (
                  <CommandItem
                    key={vinculo.id}
                    value={`${vinculo.nombre} ${vinculo.documento ?? ""} ${vinculo.tipo} ${vinculo.id}`}
                    onSelect={() => ir(vinculo.id)}
                    className="gap-2"
                  >
                    <Check className={`h-3.5 w-3.5 shrink-0 ${vinculo.id === actualId ? "opacity-100" : "opacity-0"}`} />
                    <DdPaisBandera pais={vinculo.pais} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium">{vinculo.nombre}</span>
                      <span className="block truncate text-[10px] text-muted-foreground">
                        {DD_MATRIZ_TIPO_VINCULO_LABELS[vinculo.tipo as DdMatrizTipoVinculo] ?? vinculo.tipo}
                        {vinculo.documento ? ` · ${vinculo.documento}` : ""}
                      </span>
                    </span>
                    <DdMatrizResultadoFinalBadge valor={vinculo.resultadoFinal} />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 w-8 p-0"
        disabled={!siguiente}
        title={siguiente ? `Siguiente: ${siguiente.nombre}` : "No hay vínculo siguiente"}
        aria-label="Vínculo siguiente"
        onClick={() => siguiente && ir(siguiente.id)}
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
