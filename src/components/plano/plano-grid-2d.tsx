"use client";

import { useState, useMemo, Fragment } from "react";
import { Card, CardContent, CardHeader, CardTitle, Badge, Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Input, Label, Separator } from "@nrivera-iimp/ui-kit-iimp";

/* ================================================================
   PLANO 2D — HashMap desde isométrico. 52 bloques.
   Flujo de reserva: modal 3 pasos.
   ================================================================ */

interface BlockDef { w: number; d: number; color: string; tailwindBg: string; label: string; nombre: string; }

const BD: Record<string, BlockDef> = {
  S:  { w:2.5, d:2, color:"#FFD700", tailwindBg:"bg-[#FFD700] border-[#E5C100]", label:"S",  nombre:"Columna" },
  P:  { w:2,   d:2, color:"#32CD32", tailwindBg:"bg-[#32CD32] border-[#28a428]", label:"P",  nombre:"Preferencial" },
  C:  { w:2,   d:2, color:"#90EE90", tailwindBg:"bg-[#90EE90] border-[#7ad87a]", label:"C",  nombre:"Estándar A" },
  BG: { w:3.5, d:3.5, color:"#006400", tailwindBg:"bg-[#006400] border-[#004d00]", label:"BG", nombre:"Isla Grande" },
};

type CellType = keyof typeof BD;
interface StandPos { id: string; type: CellType; x: number; y: number; }

function buildStands(): StandPos[] {
  const items: StandPos[] = [];
  const vCol = (t: CellType, x: number, y: number, n: number, ids: string[]) => {
    for (let i = 0; i < n; i++) items.push({ id: ids[i], type: t, x, y: y - i * 2 });
  };
  const m2x4 = (x: number, cy: number, ids: string[]) => {
    const col: CellType[] = ["P","C","C","P"]; const yt = cy + 4, x1 = x - 1, x2 = x + 1; let idx = 0;
    for (const cx of [x1,x2]) { let y = yt; for (const t of col) { items.push({ id: ids[idx++] ?? "?", type: t, x: cx, y: y - 1 }); y -= 2; } }
  };
  vCol("S", -18.5, 8, 6, Array.from({length:6},(_,i)=>`EXT-IZQ-${String(i+1).padStart(2,"0")}`));
  vCol("S", -18.5, -8, 4, Array.from({length:4},(_,i)=>`EXT-IZQ-${String(i+7).padStart(2,"0")}`));
  vCol("S", 18.5, 8, 6, Array.from({length:6},(_,i)=>`EXT-DER-${String(i+1).padStart(2,"0")}`));
  vCol("S", 18.5, -8, 4, Array.from({length:4},(_,i)=>`EXT-DER-${String(i+7).padStart(2,"0")}`));
  m2x4(-10.25, 7.5, Array.from({length:8},(_,i)=>`INT-IZQ-A${i+1}`));
  m2x4(-10.25, -7.5, Array.from({length:8},(_,i)=>`INT-IZQ-B${i+1}`));
  m2x4(10.25, 0, Array.from({length:8},(_,i)=>`INT-DER-${i+1}`));
  for (const [x,y,id] of [[-3.5,6,"ISLA-GRANDE-1"],[3.5,6,"ISLA-GRANDE-2"],[-3.5,-6,"ISLA-GRANDE-3"],[3.5,-6,"ISLA-GRANDE-4"]] as const)
    items.push({ id, type:"BG", x, y });
  items.push({ id:"EXTRA-2L", type:"S", x:-18.5, y:-12 });
  items.push({ id:"EXTRA-2M", type:"S", x:-18.5, y:-14 });
  items.push({ id:"EXTRA-21L", type:"S", x:18.5, y:-12 });
  items.push({ id:"EXTRA-21M", type:"S", x:18.5, y:-14 });
  return items;
}

interface Cell { id: string | null; type: string | null; label: string; }

function buildFinalGrid() {
  const stands = buildStands();
  const STEP = 2, XR = 44, YR = 24;
  const COLS = ~~(XR / STEP), ROWS = ~~(YR / STEP);
  const map = new Map<string, Cell>();
  const occ = new Set<string>();
  for (const s of stands) {
    const bd = BD[s.type];
    const xs = Math.round((s.x - bd.w/2 + XR/2)/STEP), xe = Math.round((s.x + bd.w/2 + XR/2)/STEP);
    const ys = Math.round((-s.y - bd.d/2 + YR/2)/STEP), ye = Math.round((-s.y + bd.d/2 + YR/2)/STEP);
    for (let r = Math.max(0, ys); r < Math.min(ROWS, ye); r++)
      for (let c = Math.max(0, xs); c < Math.min(COLS, xe); c++) {
        const k = `${c},${r}`; if (!occ.has(k)) { map.set(`${c+1},${r}`, { id: s.id, type: s.type, label: bd.label }); occ.add(k); }
      }
  }

  const del = (m: Map<string,Cell>, cols: number[]) => { for (const k of m.keys()) { if (cols.includes(+k.split(",")[0])) m.delete(k); } };
  const sd = (m: Map<string,Cell>, fr: number) => { const e = [...m.entries()]; m.clear(); for (const [k, c] of e) { let [co, r] = k.split(",").map(Number); if (r >= fr) r++; m.set(`${co},${r}`, c); } };
  const su = (m: Map<string,Cell>, col: number, amt: number) => {
    const e = [...m.entries()].filter(([k]) => k.startsWith(`${col},`)); for (const [k] of e) m.delete(k);
    for (const [k, c] of e) { const [, r] = k.split(",").map(Number); m.set(`${col},${r - amt}`, c); }
  };
  const mv = (m: Map<string,Cell>, fc: number, fr: number, tc: number, tr: number) => { const c = m.get(`${fc},${fr}`); if (c) { m.delete(`${fc},${fr}`); m.set(`${tc},${tr}`, c); } };

  del(map, [4, 19]); sd(map, 0);
  for (const col of [2, 21]) su(map, col, 2);
  for (const col of [2, 21]) { mv(map, col, 12, col, 11); mv(map, col, 13, col, 12); }
  map.set("2,11", { id:"EXTRA-2L", type:"S", label:"S" }); map.set("2,12", { id:"EXTRA-2M", type:"S", label:"S" });
  map.set("21,11", { id:"EXTRA-21L", type:"S", label:"S" }); map.set("21,12", { id:"EXTRA-21M", type:"S", label:"S" });

  const cs = new Set<number>(), rs = new Set<number>();
  for (const k of map.keys()) { const [c, r] = k.split(",").map(Number); cs.add(c); rs.add(r); }
  const cols = [...cs].sort((a,b)=>a-b), rows = [...rs].sort((a,b)=>a-b);
  const minC = cols[0], maxC = cols[cols.length-1], minR = rows[0], maxR = rows[rows.length-1];
  const grid: Cell[][] = [];
  for (let r = minR; r <= maxR; r++) {
    const row: Cell[] = [];
    for (let c = minC; c <= maxC; c++) row.push(map.get(`${c},${r}`) ?? { id:null, type:null, label:"" });
    grid.push(row);
  }
  const colLabels: number[] = [];
  for (let c = 1; c <= COLS; c++) { if (c !== 4 && c !== 19) colLabels.push(c); }
  return { grid, colLabels, cols: grid[0]?.length ?? 0 };
}

export function PlanoGrid2D() {
  const { grid, colLabels, cols: COLS } = useMemo(() => buildFinalGrid(), []);
  const stands = useMemo(() => buildStands(), []);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [reservaOpen, setReservaOpen] = useState(false);
  const [reservaStep, setReservaStep] = useState(0);
  const toggle = (id: string) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const selected = stands.filter(s => selectedIds.includes(s.id));

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <div className="lg:col-span-8 space-y-4">
        <Card>
          <CardHeader><CardTitle><span>Plano Grid 2D — {stands.length} bloques</span></CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto pb-2">
              <div className="mx-auto grid gap-px" style={{ gridTemplateColumns: `auto repeat(${COLS}, 28px)` }}>
                <div />
                {colLabels.map((lbl, ci) => <div key={ci} className="flex h-5 items-end justify-center text-[7px] font-bold text-slate-400">{lbl}</div>)}
                {grid.map((row, ri) => (
                  <Fragment key={ri}>
                    <div className="flex w-5 items-center justify-end pr-1 text-[9px] font-bold leading-none text-slate-400">{String.fromCharCode(65 + ri)}</div>
                    {row.map((cell, ci) => {
                      const sel = cell.id && selectedIds.includes(cell.id), bd = cell.type ? BD[cell.type] : null;
                      return (
                        <button key={ci} type="button" disabled={!cell.id} onClick={() => cell.id && toggle(cell.id)}
                          className={`flex h-7 w-7 items-center justify-center rounded-[3px] border text-[7px] font-bold leading-none transition-all ${
                            !cell.id || !bd ? "border-slate-100 bg-transparent" : sel ? "z-10 scale-125 border-amber-500 bg-amber-100 text-slate-800 shadow-md" : `${bd.tailwindBg} text-white cursor-pointer hover:scale-110 hover:shadow-md`}`}
                          title={cell.id ?? undefined}>{cell.label}</button>
                      );
                    })}
                  </Fragment>
                ))}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
              <Legend bg="bg-[#FFD700]" label="S (Columna)" /><Legend bg="bg-[#32CD32]" label="P (Preferencial)" />
              <Legend bg="bg-[#90EE90]" label="C (Estándar A)" /><Legend bg="bg-[#006400]" label="BG (Isla Grande)" />
              <Legend bg="bg-amber-100" border="border-amber-500" label="Seleccionado" />
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="lg:col-span-4 space-y-4">
        <Card>
          <CardHeader><CardTitle><span>Mi selección</span></CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3">
            {selected.length === 0 ? (
              <p className="text-sm text-muted-foreground"><span>Haz clic en un bloque para ver su ID.</span></p>
            ) : (
              <>
                <div className="space-y-2">
                  {selected.map(s => (
                    <div key={s.id} className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                      <div className="flex items-center gap-2"><Badge variant="secondary"><span>{BD[s.type]?.label ?? "?"}</span></Badge><span className="text-muted-foreground">{BD[s.type]?.nombre ?? s.type}</span></div>
                      <span className="font-mono text-xs text-slate-500">{s.id}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between border-t pt-3 text-sm font-bold"><span>Total</span><span>{selected.length} bloques</span></div>
                <Button variant="default" className="w-full" disabled={selected.length === 0} onClick={() => { setReservaOpen(true); setReservaStep(0); }}><span>Reservar ({selected.length})</span></Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
      <Dialog open={reservaOpen} onOpenChange={setReservaOpen}>
        <DialogContent className="sm:max-w-lg">
          {/* Step Indicator */}
          <div className="mb-4 flex items-center justify-center gap-2">
            {["Datos", "Documentos", "Confirmación"].map((label, idx) => (
              <Fragment key={idx}>
                <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                  reservaStep >= idx ? "bg-primary text-primary-foreground shadow-sm" : "bg-slate-200 text-slate-500"
                }`}>{idx + 1}</div>
                <span className={`text-[10px] font-semibold uppercase tracking-wider ${
                  reservaStep >= idx ? "text-slate-700" : "text-slate-400"
                }`}>{label}</span>
                {idx < 2 && <div className={`h-px w-8 ${reservaStep > idx ? "bg-primary" : "bg-slate-200"}`} />}
              </Fragment>
            ))}
          </div>

          <DialogHeader>
            <DialogTitle><span>Reserva de {selected.length} stand(s)</span></DialogTitle>
            <DialogDescription>
              {reservaStep === 0 && <span>Completá los datos de la empresa para iniciar la reserva.</span>}
              {reservaStep === 1 && <span>Descargá el formato de contrato, completalo, y adjuntalo firmado.</span>}
              {reservaStep === 2 && <span>Reserva enviada al flujo de aprobaciones.</span>}
            </DialogDescription>
          </DialogHeader>
          {reservaStep === 0 && (
            <div className="flex flex-col gap-3">
              <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
                <span className="font-semibold text-slate-700">Stands seleccionados:</span>{" "}
                {selected.map(s => BD[s.type]?.label ?? "?").join(", ")} · {selected.length} bloque(s)
              </div>
              <div className="space-y-1.5"><Label htmlFor="empresa"><span>Razón social</span></Label><Input id="empresa" placeholder="Ej. Corporación Minera S.A." /></div>
              <div className="flex gap-3"><div className="flex-1 space-y-1.5"><Label htmlFor="ruc"><span>RUC</span></Label><Input id="ruc" placeholder="20123456789" /></div><div className="flex-1 space-y-1.5"><Label htmlFor="contacto"><span>Persona de contacto</span></Label><Input id="contacto" placeholder="Nombre y apellido" /></div></div>
              <div className="space-y-1.5"><Label htmlFor="email"><span>Correo electrónico</span></Label><Input id="email" type="email" placeholder="contacto@empresa.pe" /></div>
            </div>
          )}
          {reservaStep === 1 && (
            <div className="flex flex-col gap-3">
              <div className="rounded-lg border bg-amber-50 p-3 text-xs text-amber-800">
                <span className="font-semibold">①</span> <span>Descargá el formato de contrato correspondiente al tipo de stand.</span>
              </div>
              <Button variant="outline" className="w-full"><span>📄 Descargar formato de contrato</span></Button>
              <Separator />
              <div className="rounded-lg border bg-amber-50 p-3 text-xs text-amber-800">
                <span className="font-semibold">②</span> <span>Completá el formato con los datos de la empresa y adjuntalo firmado.</span>
              </div>
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-muted-foreground hover:border-primary hover:bg-primary/5 cursor-pointer transition-colors">
                <span className="text-2xl">📎</span>
                <p className="mt-1 font-medium"><span>Adjuntar contrato firmado</span></p>
                <p className="text-xs"><span>PDF, JPG o PNG — máx. 10 MB</span></p>
              </div>
              <Button className="w-full" onClick={() => setReservaStep(2)}><span>Enviar reserva</span></Button>
            </div>
          )}
          {reservaStep === 2 && (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 text-xl">✓</div>
              <p className="text-sm font-semibold text-slate-800"><span>Reserva registrada</span></p>
              <p className="text-xs text-muted-foreground"><span>Legal → Logística → Eventos/Asociados. Seguimiento en el Dashboard.</span></p>
            </div>
          )}
          <DialogFooter>
            {reservaStep === 0 && <Button onClick={() => setReservaStep(1)} className="w-full"><span>Continuar</span></Button>}
            {reservaStep === 1 && <Button variant="secondary" onClick={() => setReservaStep(0)}><span>Volver</span></Button>}
            {reservaStep === 2 && <Button onClick={() => { setReservaOpen(false); setSelectedIds([]); }} variant="secondary" className="w-full"><span>Cerrar</span></Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Legend({ bg, border, label }: { bg: string; border?: string; label: string }) {
  return <span className="flex items-center gap-1.5"><span className={`inline-block h-3 w-3 rounded-sm ${bg} ${border ?? bg}`} />{label}</span>;
}
