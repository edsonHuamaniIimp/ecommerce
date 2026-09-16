"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Button, Label, RadioGroup, RadioGroupItem } from "@nrivera-iimp/ui-kit-iimp";
import {
  RESULTADOS_APROBACION,
} from "@/lib/shared/constants";
import "react-quill-new/dist/quill.snow.css";

const ReactQuill = dynamic(() => import("react-quill-new"), { ssr: false });

interface RevisionData {
  id: string;
  area: string;
  estado: string;
  comentario: string | null;
}

interface Props {
  standCode: string;
  empresa: string;
  tipoStand: string | null;
  email: string;
  revisiones: RevisionData[];
  onSend: (modo: "automatico" | "personalizado", mensaje?: string) => Promise<void>;
  onClose: () => void;
  sending: boolean;
  error: string | null;
}

export function NotificarModal({ standCode, empresa, tipoStand, email, revisiones, onSend, onClose, sending, error }: Props) {
  const [modo, setModo] = useState<"automatico" | "personalizado">("automatico");
  const [mensaje, setMensaje] = useState("");

  const quillModules = {
    toolbar: [
      [{ header: [1, 2, 3, false] }],
      ["bold", "italic", "underline", "strike"],
      [{ color: [] }, { background: [] }],
      [{ list: "ordered" }, { list: "bullet" }],
      [{ align: [] }],
      ["link"],
      ["clean"],
    ],
  };

  const buildAutoPreview = () => {
    const algunaRechazada = revisiones.some(r => r.estado === RESULTADOS_APROBACION.RECHAZADO);
    const todasAprobadas = revisiones.every(r => r.estado === RESULTADOS_APROBACION.APROBADO);
    if (todasAprobadas) {
      return `<p style="margin:4px 0;color:#16a34a;font-weight:600">Tu solicitud ha sido aprobada por todas las areas del IIMP.</p>`;
    }
    if (algunaRechazada) {
      return `<p style="margin:4px 0;color:#dc2626;font-weight:600">Lamentamos informarte que tu solicitud no ha sido aprobada en esta ocasion.</p>
        <p style="margin:8px 0 0;color:#64748b">Puedes solicitar una re-evaluacion desde la seccion <strong>Mis solicitudes</strong> adjuntando documentacion adicional.</p>`;
    }
    return `<p style="margin:4px 0;color:#64748b">Tu solicitud se encuentra en proceso de revision.</p>`;
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* ===== HEADER ===== */}
      <div className="shrink-0 px-5 pt-4 pb-2 border-b border-slate-100 !pr-12">
        <h3 className="text-sm font-semibold text-slate-800">Notificar al cliente</h3>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-xs text-slate-500">
          <span className="font-mono font-medium text-slate-700">{standCode}</span>
          {tipoStand && (
            <>
              <span className="text-slate-300">·</span>
              <span className="text-slate-400">{tipoStand}</span>
            </>
          )}
          {empresa && empresa !== "—" && (
            <>
              <span className="text-slate-300">·</span>
              <span>{empresa}</span>
            </>
          )}
          {email && (
            <>
              <span className="text-slate-300">·</span>
              <span className="text-slate-400">{email}</span>
            </>
          )}
          {!email && (
            <span className="text-amber-600 font-medium">Sin correo de contacto</span>
          )}
        </div>
      </div>


      {/* ===== BODY ===== */}
      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
        <div>
          <Label className="text-xs mb-2 block">Modo de notificacion</Label>
          <RadioGroup value={modo} onValueChange={(v) => setModo(v as "automatico" | "personalizado")} className="space-y-2">
            <label className="flex items-start gap-2.5 rounded-lg border border-slate-200 p-3 cursor-pointer hover:border-emerald-300 transition-colors">
              <RadioGroupItem value="automatico" className="mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-medium text-slate-700">Automatico</p>
                <p className="text-[11px] text-slate-500">Se envia un resumen generico sin detallar el resultado de cada area.</p>
                <div className="mt-2 rounded-md bg-slate-50 border border-slate-100 p-2.5">
                  <p className="text-[10px] font-semibold text-slate-500 mb-1">Vista previa:</p>
                  <div className="text-[11px] text-slate-600" dangerouslySetInnerHTML={{ __html: buildAutoPreview() }} />
                </div>
              </div>
            </label>
            <label className="flex items-start gap-2.5 rounded-lg border border-slate-200 p-3 cursor-pointer hover:border-emerald-300 transition-colors">
              <RadioGroupItem value="personalizado" className="mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-medium text-slate-700">Personalizado</p>
                <p className="text-[11px] text-slate-500">Redacta tu propio mensaje para notificar al cliente.</p>
              </div>
            </label>
          </RadioGroup>
        </div>

        {modo === "personalizado" && (
          <div>
            <Label className="text-xs mb-1 block">Mensaje</Label>
            <div className="mt-1 rounded-lg border border-slate-200 overflow-hidden bg-white quill-notify">
              <ReactQuill
                value={mensaje}
                onChange={setMensaje}
                modules={quillModules}
                placeholder="Escribe el mensaje de notificacion..."
              />
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}
      </div>

      {/* ===== FOOTER ===== */}
      <div className="shrink-0 border-t border-slate-100 px-5 py-3">
        <div className="flex w-full items-center justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-full px-3 text-xs font-medium border-slate-200 hover:bg-slate-50"
            onClick={onClose}
            disabled={sending}
          >
            <span>Cancelar</span>
          </Button>
          <Button
            size="sm"
            className="rounded-full px-4 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700"
            disabled={sending || !email || (modo === "personalizado" && (!mensaje || mensaje.replace(/<[^>]*>/g, "").trim() === ""))}
            onClick={() => onSend(modo, modo === "personalizado" ? mensaje : undefined)}
          >
            {sending ? "Enviando..." : "Enviar notificacion"}
          </Button>
        </div>
      </div>
    </div>
  );
}
