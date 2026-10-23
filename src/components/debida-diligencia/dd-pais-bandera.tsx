"use client";

import dynamic from "next/dynamic";
import { CircleHelp } from "lucide-react";
import { REGEX_PAIS } from "@/lib/shared/constants";
import { nombrePais } from "@/lib/shared/utils/pais";

/* Las ~250 banderas viajan en un chunk aparte que solo se baja al abrir la matriz. */
const BanderaSvg = dynamic(() => import("./dd-pais-bandera-svg"), { ssr: false });

const CAJA = "inline-block h-4 w-6 shrink-0 overflow-hidden rounded-[3px] border border-border bg-secondary align-middle";

interface Props {
  /** Pais ISO alpha-2; null/invalido muestra el simbolo de interrogacion. */
  pais: string | null | undefined;
  /** Muestra el nombre del pais junto a la bandera. */
  mostrarNombre?: boolean;
}

/** Bandera del pais de un vinculo; "?" cuando el dato aun no existe. */
export function DdPaisBandera({ pais, mostrarNombre = false }: Props) {
  const codigo = pais && REGEX_PAIS.test(pais) ? pais : null;
  const titulo = codigo ? nombrePais(codigo) : "País sin registrar";

  return (
    <span className="inline-flex items-center gap-1.5" title={titulo}>
      {codigo ? (
        <span className={CAJA}>
          <BanderaSvg codigo={codigo} titulo={titulo} className="h-full w-full object-cover" />
        </span>
      ) : (
        <span className={`${CAJA} flex items-center justify-center text-muted-foreground`} role="img" aria-label={titulo}>
          <CircleHelp className="h-3 w-3" />
        </span>
      )}
      {mostrarNombre ? <span className="text-xs text-foreground">{codigo ? nombrePais(codigo) : "Sin país"}</span> : null}
    </span>
  );
}
