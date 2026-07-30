"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { internalApi } from "@/lib/api/services/internal-api";
import { reservaBorradorDB } from "@/lib/indexed-db";
import { ESTADOS_STAND } from "@/lib/constants";
import type { FormDatos, GessLinkedInfo } from "./types";

function standIdsKey(ids: string[]): string {
  return [...ids].sort().join("|");
}

export function useReservaForm(selectedIds: string[], linkedMap: Map<string, GessLinkedInfo>) {
  const [reservaOpen, setReservaOpen] = useState(false);
  const [reservaStep, setReservaStep] = useState(0);
  const [formDatos, setFormDatos] = useState<FormDatos>({ razonSocial: "", ruc: "", contacto: "", email: "" });
  const [formDocs, setFormDocs] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const selectedCount = selectedIds.length;
  const singleStand = selectedCount === 1;
  const currentKey = standIdsKey(selectedIds);
  const keyRef = useRef(currentKey);
  keyRef.current = currentKey;

  const stepDone = useCallback((step: number): boolean => {
    if (step === 0) return !!(formDatos.razonSocial && formDatos.ruc && formDatos.contacto && formDatos.email);
    if (step === 1) return !singleStand || formDocs.length > 0;
    if (step === 2) return stepDone(0) && stepDone(1);
    return false;
  }, [formDatos, formDocs, singleStand]);

  const canGoStep = useCallback((step: number): boolean => {
    if (step === 0) return true;
    if (step === 1) return stepDone(0);
    if (step === 2) return stepDone(0) && stepDone(1);
    return false;
  }, [stepDone]);

  // Load from IndexedDB when modal opens or key changes
  useEffect(() => {
    if (!reservaOpen || selectedIds.length === 0) return;
    (async () => {
      const draft = await reservaBorradorDB.cargar(selectedIds);
      if (draft) {
        setFormDatos(draft.datos);
        setFormDocs(draft.documentos);
      } else {
        setFormDatos({ razonSocial: "", ruc: "", contacto: "", email: "" });
        setFormDocs([]);
      }
    })();
  }, [reservaOpen, currentKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save to IndexedDB on form changes (using ref for stable key)
  useEffect(() => {
    if (!reservaOpen || selectedIds.length === 0) return;
    const hasData = formDatos.razonSocial || formDatos.ruc || formDatos.contacto || formDatos.email || formDocs.length > 0;
    if (!hasData) return;
    reservaBorradorDB.guardar(keyRef.current.split("|"), formDatos, formDocs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formDatos, formDocs]);

  // Persist on close without submit
  const handleOpenChange = (open: boolean) => {
    if (!open && !submitting) {
      if (formDatos.razonSocial || formDocs.length > 0) {
        reservaBorradorDB.guardar(selectedIds, formDatos, formDocs);
      }
      setReservaStep(0);
    }
    setReservaOpen(open);
  };

  const handleUpload = async (file: File): Promise<string> => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const json = await res.json() as { success?: boolean; data?: { url: string } };
    if (json.success && json.data) return json.data.url;
    throw new Error("Error al subir");
  };

  const addDoc = async (file: File) => {
    setUploading(true);
    try {
      const url = await handleUpload(file);
      setFormDocs((prev) => [...prev, url]);
    } catch { /* ignore */ }
    setUploading(false);
  };

  const removeDoc = (idx: number) => setFormDocs((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      for (const id of selectedIds) {
        const info = linkedMap.get(id);
        if (!info || !info.dbId) continue;
        await internalApi.patch("/api/gess", {
          id: info.dbId,
          estado: ESTADOS_STAND.EN_EVALUACION,
          documentos: singleStand ? formDocs : undefined,
        });
      }
      await reservaBorradorDB.eliminar(selectedIds);
      setReservaOpen(false);
      return true;
    } catch {
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setFormDatos({ razonSocial: "", ruc: "", contacto: "", email: "" });
    setFormDocs([]);
    setReservaStep(0);
    setReservaOpen(false);
  };

  return {
    reservaOpen, setReservaOpen,
    reservaStep, setReservaStep,
    formDatos, setFormDatos,
    formDocs,
    uploading,
    submitting,
    selectedCount,
    singleStand,
    stepDone,
    canGoStep,
    handleOpenChange,
    addDoc,
    removeDoc,
    handleSubmit,
    reset,
  };
}
