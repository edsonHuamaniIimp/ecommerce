"use client";

import { useEffect, useState } from "react";
import { Badge } from "@nrivera-iimp/ui-kit-iimp";
import { Clock, UserCircle2, History } from "lucide-react";
import { REVISION_AREA_LABELS } from "@/lib/constants";

interface HistorialItem {
  fecha: string;
  area: string;
  accion: string;
  detalle: string;
  usuario: string | null;
  esActual: boolean;
}

function formatFecha(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("es-PE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function HistorialModal({ solicitudId }: { solicitudId: string }) {
  const [items, setItems] = useState<HistorialItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/solicitudes/historial?id=${solicitudId}`, { credentials: "include" });
        const json = await res.json() as { success: boolean; data: HistorialItem[] };
        if (json.success) setItems(json.data);
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, [solicitudId]);

  const grouped = items.reduce<Record<string, HistorialItem[]>>((acc, item) => {
    if (!acc[item.area]) acc[item.area] = [];
    acc[item.area].push(item);
    return acc;
  }, {});

  for (const areaItems of Object.values(grouped)) {
    areaItems.sort((a, b) => {
      if (a.esActual) return 1;
      if (b.esActual) return -1;
      return new Date(a.fecha).getTime() - new Date(b.fecha).getTime();
    });
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* ===== HEADER ===== */}
      <div className="shrink-0 px-5 pt-4 pb-3 border-b border-slate-100 !pr-12">
        <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
          <History className="h-4 w-4 text-slate-500" />
          Historial de revisiones
        </h3>
        <p className="text-[11px] text-slate-400 mt-1">Linea de tiempo de cambios por area</p>
      </div>

      {/* ===== BODY ===== */}
      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
        {loading ? (
          <p className="py-12 text-center text-sm text-slate-400">Cargando...</p>
        ) : items.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-400">Sin historial de revisiones.</p>
        ) : (
          <div className="space-y-5">
            {Object.entries(grouped).map(([area, areaItems]) => (
              <div key={area}>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-3">{area}</p>
                <div className="space-y-0">
                  {areaItems.map((item, i) => (
                    <div key={i} className="flex gap-3 group">
                      {/* Timeline line + dot */}
                      <div className="flex flex-col items-center">
                        <div className={`h-2.5 w-2.5 rounded-full border-2 shrink-0 transition-all duration-300 group-hover:scale-125 ${
                          item.esActual
                            ? "border-emerald-400 bg-emerald-100"
                            : "border-slate-300 bg-white"
                        }`} />
                        {i < areaItems.length - 1 && (
                          <div className={`w-px flex-1 ${item.esActual ? "bg-slate-200" : "bg-slate-200"}`} />
                        )}
                      </div>

                      {/* Content */}
                      <div className={`flex-1 min-w-0 pb-3 ${i === areaItems.length - 1 ? "pb-0" : ""}`}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            variant="secondary"
                            className={`text-[10px] h-4 px-1.5 font-medium transition-colors ${
                              item.esActual
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : item.accion === "Aprobacion de re-evaluacion"
                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                : item.accion === "Cambio de estado"
                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                : "bg-slate-100 text-slate-600 border-slate-200"
                            }`}
                          >
                            {item.accion}
                          </Badge>
                          <span className="text-[10px] text-slate-400 ml-auto flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5" />
                            {formatFecha(item.fecha)}
                          </span>
                        </div>

                        {item.detalle && (
                          <div className="mt-1">
                            {item.detalle.split("\n").map((line, li) => {
                              const isEstado = line.startsWith("Estado:");
                              const isJustificacion = line.startsWith("Justificacion:");
                              return (
                                <p
                                  key={li}
                                  className={`text-[11px] leading-relaxed ${
                                    item.esActual
                                      ? "text-slate-700"
                                      : "text-slate-500"
                                  } ${isEstado ? "font-medium" : ""} ${isJustificacion ? "italic text-slate-400" : ""}`}
                                >
                                  {isEstado ? (
                                    <>
                                      <span className="text-slate-400 font-normal">Estado: </span>
                                      {line.replace("Estado: ", "")}
                                    </>
                                  ) : isJustificacion ? (
                                    line
                                  ) : (
                                    line
                                  )}
                                </p>
                              );
                            })}
                          </div>
                        )}

                        {item.usuario && (
                          <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                            <UserCircle2 className="h-2.5 w-2.5" />
                            {item.usuario}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
