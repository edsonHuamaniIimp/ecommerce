"use client";

import * as Banderas from "country-flag-icons/react/3x2";
import type { ComponentType, SVGProps } from "react";

type BanderaSvg = ComponentType<SVGProps<SVGSVGElement> & { title?: string }>;

/** Bandera SVG por codigo ISO alpha-2 (sin pedir imagenes externas). Chunk separado: ver `DdPaisBandera`. */
export default function DdPaisBanderaSvg({ codigo, titulo, className }: { codigo: string; titulo: string; className?: string }) {
  const Bandera = (Banderas as unknown as Record<string, BanderaSvg | undefined>)[codigo.toUpperCase()];
  if (!Bandera) return null;
  return <Bandera title={titulo} className={className} />;
}
