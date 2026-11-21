"use client";

import { useMemo, useState } from "react";
import {
  Badge,
  Button,
  Checkbox,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsList,
  TabsTrigger,
} from "@nrivera-iimp/ui-kit-iimp";
import { ChevronDown, Layers, RotateCcw, Search, X } from "lucide-react";
import {
  DD_REPOSITORIO_AGRUPACION_OPCIONES,
  DD_REPOSITORIO_FORMATO_LABELS,
  DD_REPOSITORIO_ORDEN_OPCIONES,
  DD_REPOSITORIO_PERIODO_OPCIONES,
  DD_REPOSITORIO_PERIODOS,
  DD_REPOSITORIO_TABS,
  DD_REPOSITORIO_TIPOS,
  type DdRepositorioAgrupacion,
  type DdRepositorioFormato,
  type DdRepositorioOrden,
  type DdRepositorioPeriodo,
  type DdRepositorioTab,
} from "@/lib/shared/constants";
import {
  ddRepositorioVista,
  type DdRepositorioFaceta,
  type DdRepositorioFila,
  type DdRepositorioFiltros,
  type DdRepositorioOpcion,
} from "@/lib/shared/utils/dd-repositorio-vista";

interface Props {
  filas: DdRepositorioFila[];
  filtros: DdRepositorioFiltros;
  ahora: number;
  agrupacion: DdRepositorioAgrupacion;
  orden: DdRepositorioOrden;
  mostrados: number;
  onFiltros: (filtros: DdRepositorioFiltros) => void;
  onAgrupacion: (agrupacion: DdRepositorioAgrupacion) => void;
  onOrden: (orden: DdRepositorioOrden) => void;
}

function normalizar(valor: string): string {
  return valor.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

interface SelectorMultipleProps {
  titulo: string;
  placeholder: string;
  opciones: DdRepositorioOpcion[];
  seleccion: string[];
  conBusqueda?: boolean;
  vacio: string;
  onChange: (seleccion: string[]) => void;
}

/** Filtro de seleccion multiple con conteo por opcion (y buscador cuando hay muchas). */
function SelectorMultiple({ titulo, placeholder, opciones, seleccion, conBusqueda, vacio, onChange }: SelectorMultipleProps) {
  const [abierto, setAbierto] = useState(false);
  const alternar = (valor: string) =>
    onChange(seleccion.includes(valor) ? seleccion.filter((item) => item !== valor) : [...seleccion, valor]);

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={titulo}
          className={`h-8 gap-1.5 text-xs font-normal ${seleccion.length > 0 ? "border-primary/50 bg-primary/5" : ""}`}
        >
          <span>{titulo}</span>
          {seleccion.length > 0 ? (
            <Badge className="pointer-events-none h-4 min-w-4 justify-center bg-primary px-1 text-[9px] text-primary-foreground">
              <span>{seleccion.length}</span>
            </Badge>
          ) : null}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[360px] p-0" align="start">
        <Command filter={(valor, busqueda) => (normalizar(valor).includes(normalizar(busqueda)) ? 1 : 0)}>
          {conBusqueda ? <CommandInput placeholder={placeholder} /> : null}
          <CommandList>
            <CommandEmpty>{vacio}</CommandEmpty>
            <CommandGroup>
              {opciones.map((opcion) => (
                <CommandItem key={opcion.value} value={opcion.label} onSelect={() => alternar(opcion.value)}>
                  <Checkbox checked={seleccion.includes(opcion.value)} className="pointer-events-none mr-2" />
                  <span className="min-w-0 flex-1 truncate">{opcion.label}</span>
                  <span className={`ml-2 text-[10px] ${opcion.total === 0 ? "text-muted-foreground/60" : "text-muted-foreground"}`}>
                    {opcion.total}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
        {seleccion.length > 0 ? (
          <div className="border-t border-border p-1.5">
            <Button type="button" variant="ghost" size="sm" className="h-7 w-full text-xs" onClick={() => onChange([])}>
              <span>Quitar selección</span>
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

interface Chip {
  clave: string;
  etiqueta: string;
  quitar: () => void;
}

export function DdRepositorioFiltros({
  filas,
  filtros,
  ahora,
  agrupacion,
  orden,
  mostrados,
  onFiltros,
  onAgrupacion,
  onOrden,
}: Props) {
  const cambiar = (parcial: Partial<DdRepositorioFiltros>) => onFiltros({ ...filtros, ...parcial });

  const opcionesAreas = useMemo(
    () => ddRepositorioVista.opcionesFaceta(filas, filtros, "areas", ahora, (fila) => fila.area),
    [filas, filtros, ahora],
  );
  const opcionesClases = useMemo(
    () => ddRepositorioVista.opcionesFaceta(filas, filtros, "clases", ahora, (fila) => fila.claseLabel),
    [filas, filtros, ahora],
  );
  const opcionesVinculos = useMemo(
    () => ddRepositorioVista.opcionesFaceta(filas, filtros, "vinculos", ahora, (fila) => fila.vinculoNombre),
    [filas, filtros, ahora],
  );
  const opcionesFormatos = useMemo(
    () =>
      ddRepositorioVista.opcionesFaceta(
        filas,
        filtros,
        "formatos",
        ahora,
        (fila) => DD_REPOSITORIO_FORMATO_LABELS[fila.formato as DdRepositorioFormato] ?? fila.formato,
      ),
    [filas, filtros, ahora],
  );
  const opcionesEstados = useMemo(
    () => ddRepositorioVista.opcionesFaceta(filas, filtros, "estados", ahora, (fila) => ddRepositorioVista.etiquetaEstado(fila.estado)),
    [filas, filtros, ahora],
  );

  /* Conteo por tipo con el resto de filtros aplicados (sin el propio tipo). */
  const sinTipo = useMemo(
    () => ddRepositorioVista.aplicarFiltros(filas, { ...filtros, tipo: DD_REPOSITORIO_TABS.TODOS }, ahora),
    [filas, filtros, ahora],
  );
  const totalDocumentos = sinTipo.filter((fila) => fila.tipo === DD_REPOSITORIO_TIPOS.DOCUMENTO).length;
  const totalEvidencias = sinTipo.filter((fila) => fila.tipo === DD_REPOSITORIO_TIPOS.EVIDENCIA).length;

  const etiquetaDe = (opciones: DdRepositorioOpcion[], valor: string) =>
    opciones.find((opcion) => opcion.value === valor)?.label ?? valor;

  const chips: Chip[] = [];
  if (filtros.busqueda.trim()) {
    chips.push({ clave: "busqueda", etiqueta: `Búsqueda: “${filtros.busqueda.trim()}”`, quitar: () => cambiar({ busqueda: "" }) });
  }
  if (filtros.tipo !== DD_REPOSITORIO_TABS.TODOS) {
    chips.push({
      clave: "tipo",
      etiqueta: filtros.tipo === DD_REPOSITORIO_TABS.DOCUMENTOS ? "Solo documentos base" : "Solo evidencias",
      quitar: () => cambiar({ tipo: DD_REPOSITORIO_TABS.TODOS }),
    });
  }
  const facetas: [DdRepositorioFaceta, string, DdRepositorioOpcion[]][] = [
    ["areas", "Área", opcionesAreas],
    ["clases", "Tipo", opcionesClases],
    ["vinculos", "Vínculo", opcionesVinculos],
    ["formatos", "Formato", opcionesFormatos],
    ["estados", "Estado", opcionesEstados],
  ];
  for (const [faceta, prefijo, opciones] of facetas) {
    for (const valor of filtros[faceta]) {
      chips.push({
        clave: `${faceta}-${valor}`,
        etiqueta: `${prefijo}: ${etiquetaDe(opciones, valor)}`,
        quitar: () => cambiar({ [faceta]: filtros[faceta].filter((item) => item !== valor) }),
      });
    }
  }
  if (filtros.periodo !== DD_REPOSITORIO_PERIODOS.TODO) {
    chips.push({
      clave: "periodo",
      etiqueta: DD_REPOSITORIO_PERIODO_OPCIONES.find((opcion) => opcion.value === filtros.periodo)?.label ?? filtros.periodo,
      quitar: () => cambiar({ periodo: DD_REPOSITORIO_PERIODOS.TODO }),
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filtros.busqueda}
            onChange={(evento) => cambiar({ busqueda: evento.target.value })}
            placeholder="Buscar por archivo, vínculo, tipo de documento o responsable…"
            aria-label="Buscar en el centro documental"
            className="h-9 pl-8 text-xs"
          />
        </div>
        <Tabs value={filtros.tipo} onValueChange={(valor) => cambiar({ tipo: valor as DdRepositorioTab })}>
          <TabsList className="h-9">
            <TabsTrigger value={DD_REPOSITORIO_TABS.TODOS} className="text-xs">
              <span>Todos</span>
              <span className="ml-1.5 rounded bg-secondary px-1.5 py-0.5 text-[9px] text-muted-foreground">
                {totalDocumentos + totalEvidencias}
              </span>
            </TabsTrigger>
            <TabsTrigger value={DD_REPOSITORIO_TABS.DOCUMENTOS} className="text-xs">
              <span>Documentos base</span>
              <span className="ml-1.5 rounded bg-secondary px-1.5 py-0.5 text-[9px] text-muted-foreground">{totalDocumentos}</span>
            </TabsTrigger>
            <TabsTrigger value={DD_REPOSITORIO_TABS.EVIDENCIAS} className="text-xs">
              <span>Evidencias</span>
              <span className="ml-1.5 rounded bg-secondary px-1.5 py-0.5 text-[9px] text-muted-foreground">{totalEvidencias}</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SelectorMultiple
          titulo="Tipo de documento"
          placeholder="Buscar tipo de documento o criterio…"
          opciones={opcionesClases}
          seleccion={filtros.clases}
          conBusqueda
          vacio="Sin tipos para esta combinación."
          onChange={(clases) => cambiar({ clases })}
        />
        <SelectorMultiple
          titulo="Vínculo"
          placeholder="Buscar vínculo…"
          opciones={opcionesVinculos}
          seleccion={filtros.vinculos}
          conBusqueda
          vacio="Sin vínculos para esta combinación."
          onChange={(vinculos) => cambiar({ vinculos })}
        />
        <SelectorMultiple
          titulo="Área"
          placeholder="Área"
          opciones={opcionesAreas}
          seleccion={filtros.areas}
          vacio="Sin áreas."
          onChange={(areas) => cambiar({ areas })}
        />
        <SelectorMultiple
          titulo="Formato"
          placeholder="Formato"
          opciones={opcionesFormatos}
          seleccion={filtros.formatos}
          vacio="Sin formatos."
          onChange={(formatos) => cambiar({ formatos })}
        />
        <SelectorMultiple
          titulo="Estado"
          placeholder="Estado"
          opciones={opcionesEstados}
          seleccion={filtros.estados}
          vacio="Sin estados."
          onChange={(estados) => cambiar({ estados })}
        />
        <Select value={filtros.periodo} onValueChange={(valor) => cambiar({ periodo: valor as DdRepositorioPeriodo })}>
          <SelectTrigger className="h-8 w-[150px] text-xs" aria-label="Fecha de carga">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DD_REPOSITORIO_PERIODO_OPCIONES.map((opcion) => (
              <SelectItem key={opcion.value} value={opcion.value}>
                <span>{opcion.label}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Layers className="hidden h-3.5 w-3.5 text-muted-foreground sm:block" />
          <Select value={agrupacion} onValueChange={(valor) => onAgrupacion(valor as DdRepositorioAgrupacion)}>
            <SelectTrigger className="h-8 w-[170px] text-xs" aria-label="Agrupar por">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DD_REPOSITORIO_AGRUPACION_OPCIONES.map((opcion) => (
                <SelectItem key={opcion.value} value={opcion.value}>
                  <span>{opcion.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={orden} onValueChange={(valor) => onOrden(valor as DdRepositorioOrden)}>
            <SelectTrigger className="h-8 w-[140px] text-xs" aria-label="Ordenar por">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DD_REPOSITORIO_ORDEN_OPCIONES.map((opcion) => (
                <SelectItem key={opcion.value} value={opcion.value}>
                  <span>{opcion.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-t border-border pt-2.5">
        <span className="text-[11px] text-muted-foreground">
          Mostrando <strong className="text-foreground">{mostrados}</strong> de{" "}
          <strong className="text-foreground">{filas.length}</strong> archivos
        </span>
        {chips.map((chip) => (
          <button
            key={chip.clave}
            type="button"
            onClick={chip.quitar}
            title="Quitar este filtro"
            className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2 py-0.5 text-[10px] font-medium text-primary transition-colors hover:bg-primary/10"
          >
            <span>{chip.etiqueta}</span>
            <X className="h-3 w-3" />
          </button>
        ))}
        {chips.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto h-6 gap-1 px-2 text-[11px] text-muted-foreground"
            onClick={() => onFiltros(ddRepositorioVista.filtrosVacios())}
          >
            <RotateCcw className="h-3 w-3" />
            <span>Limpiar filtros</span>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
