"use client";

import type { ReactNode } from "react";
import { Card, CardContent, Progress, Skeleton } from "@nrivera-iimp/ui-kit-iimp";
import { Clock3, FileCheck2, FolderOpen, ListChecks } from "lucide-react";
import {
  DD_REPOSITORIO_TABS,
  DD_REPOSITORIO_TIPOS,
  type DdRepositorioTab,
} from "@/lib/shared/constants";
import {
  ddRepositorioVista,
  type DdRepositorioCobertura,
  type DdRepositorioFila,
} from "@/lib/shared/utils/dd-repositorio-vista";

interface TarjetaProps {
  titulo: string;
  valor: ReactNode;
  detalle: ReactNode;
  icono: ReactNode;
  avance?: number;
  alerta?: boolean;
  cargando: boolean;
  onClick?: () => void;
}

function Tarjeta({ titulo, valor, detalle, icono, avance, alerta, cargando, onClick }: TarjetaProps) {
  const contenido = (
    <CardContent className="space-y-2 p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</p>
        <span className="text-primary">{icono}</span>
      </div>
      {cargando ? (
        <Skeleton className="h-7 w-16" />
      ) : (
        <p className="text-2xl font-bold leading-none text-foreground">{valor}</p>
      )}
      {avance !== undefined && !cargando ? <Progress value={avance} className="h-1.5" /> : null}
      <p className={`text-[11px] leading-snug ${alerta ? "text-warning" : "text-muted-foreground"}`}>{detalle}</p>
    </CardContent>
  );
  return (
    <Card className={onClick ? "transition-shadow hover:shadow-md" : ""}>
      {onClick ? (
        <button type="button" onClick={onClick} className="block w-full text-left" aria-label={`Filtrar por ${titulo}`}>
          {contenido}
        </button>
      ) : (
        contenido
      )}
    </Card>
  );
}

interface Props {
  filas: DdRepositorioFila[];
  documentosBase: { requeridos: number; cargados: number; faltantes: string[] };
  coberturas: DdRepositorioCobertura[];
  ahora: number;
  cargando: boolean;
  onTipo: (tipo: DdRepositorioTab) => void;
}

/** Tarjetas de lectura rapida del expediente seleccionado (cada una filtra la lista al hacer clic). */
export function DdRepositorioResumen({ filas, documentosBase, coberturas, ahora, cargando, onTipo }: Props) {
  const evidencias = filas.filter((fila) => fila.tipo === DD_REPOSITORIO_TIPOS.EVIDENCIA).length;
  const aplicables = coberturas.reduce((total, item) => total + item.aplicables, 0);
  const conEvidencia = coberturas.reduce((total, item) => total + item.conEvidencia, 0);
  const vinculosIncompletos = coberturas.filter((item) => item.conEvidencia < item.aplicables).length;
  const nuevos = filas.filter((fila) => ddRepositorioVista.esNuevo(fila.fecha, ahora)).length;
  const masReciente = ddRepositorioVista.ordenar(filas, "recientes")[0];
  const completoBase = documentosBase.cargados === documentosBase.requeridos;

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Tarjeta
        titulo="Documentos base"
        cargando={cargando}
        valor={`${documentosBase.cargados}/${documentosBase.requeridos}`}
        avance={documentosBase.requeridos > 0 ? (documentosBase.cargados / documentosBase.requeridos) * 100 : 0}
        alerta={!completoBase}
        detalle={completoBase ? "Documentos obligatorios completos" : `Falta: ${documentosBase.faltantes.join(", ")}`}
        icono={<FileCheck2 className="h-4 w-4" />}
        onClick={() => onTipo(DD_REPOSITORIO_TABS.DOCUMENTOS)}
      />
      <Tarjeta
        titulo="Evidencias de matriz"
        cargando={cargando}
        valor={evidencias}
        detalle={`En ${coberturas.length} vínculo${coberturas.length === 1 ? "" : "s"} evaluado${coberturas.length === 1 ? "" : "s"}`}
        icono={<FolderOpen className="h-4 w-4" />}
        onClick={() => onTipo(DD_REPOSITORIO_TABS.EVIDENCIAS)}
      />
      <Tarjeta
        titulo="Criterios con evidencia"
        cargando={cargando}
        valor={`${conEvidencia}/${aplicables}`}
        avance={aplicables > 0 ? (conEvidencia / aplicables) * 100 : 0}
        alerta={vinculosIncompletos > 0}
        detalle={
          vinculosIncompletos === 0
            ? "Todos los vínculos con criterios cubiertos"
            : `${vinculosIncompletos} vínculo${vinculosIncompletos === 1 ? "" : "s"} con criterios sin evidencia`
        }
        icono={<ListChecks className="h-4 w-4" />}
      />
      <Tarjeta
        titulo="Última carga"
        cargando={cargando}
        valor={masReciente ? ddRepositorioVista.fechaRelativa(masReciente.fecha, ahora) : "—"}
        detalle={nuevos > 0 ? `${nuevos} archivo${nuevos === 1 ? "" : "s"} nuevo${nuevos === 1 ? "" : "s"} en 48 h` : "Sin archivos nuevos en 48 h"}
        icono={<Clock3 className="h-4 w-4" />}
      />
    </div>
  );
}
