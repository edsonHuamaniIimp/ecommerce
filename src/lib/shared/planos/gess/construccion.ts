import type { Item, BlockType } from "./tipos";
import { DIMENSIONES as D } from "./tipos";

function vColumn(type: BlockType, key: string, x: number, yCenter: number, ids: string[]): Item[] {
  const dim = D[key];
  const out: Item[] = [];
  const totalDepth = ids.length * dim.d;
  let y = yCenter + totalDepth / 2;
  for (const id of ids) {
    out.push({ id, dim, type, x, z: -(y - dim.d / 2) });
    y -= dim.d;
  }
  return out;
}

function matrix2x4(cx: number, cy: number, ids: string[]): Item[] {
  const col: string[] = ["P", "C", "C", "P"];
  const colDepth = col.reduce((s, k) => s + D[k].d, 0);
  const colW = D.P.w;
  const totalW = colW * 2;
  const x1 = cx - totalW / 2 + colW / 2;
  const x2 = cx + totalW / 2 - colW / 2;
  const yTop = cy + colDepth / 2;
  const out: Item[] = [];
  let idx = 0;
  for (const x of [x1, x2]) {
    let y = yTop;
    for (const k of col) {
      const dim = D[k];
      out.push({ id: ids[idx++] ?? `?${idx}`, dim, type: k as BlockType, x, z: -(y - dim.d / 2) });
      y -= dim.d;
    }
  }
  return out;
}

export function buildItems(): Item[] {
  const items: Item[] = [];
  items.push(...vColumn("S", "S_vert", -18.5, 8.0, ["EXT-IZQ-01","EXT-IZQ-02","EXT-IZQ-03","EXT-IZQ-04","EXT-IZQ-05","EXT-IZQ-06"]));
  items.push(...vColumn("S", "S_vert", -18.5, -8.0, ["EXT-IZQ-07","EXT-IZQ-08","EXT-IZQ-09","EXT-IZQ-10"]));
  items.push(...vColumn("S", "S_vert", 18.5, 8.0, ["EXT-DER-01","EXT-DER-02","EXT-DER-03","EXT-DER-04","EXT-DER-05","EXT-DER-06"]));
  items.push(...vColumn("S", "S_vert", 18.5, -8.0, ["EXT-DER-07","EXT-DER-08","EXT-DER-09","EXT-DER-10"]));
  items.push(...matrix2x4(-11.0, 10.0, ["INT-IZQ-A1","INT-IZQ-A2","INT-IZQ-A3","INT-IZQ-A4","INT-IZQ-A5","INT-IZQ-A6","INT-IZQ-A7","INT-IZQ-A8"]));
  items.push(...matrix2x4(-11.0, -6.0, ["INT-IZQ-B1","INT-IZQ-B2","INT-IZQ-B3","INT-IZQ-B4","INT-IZQ-B5","INT-IZQ-B6","INT-IZQ-B7","INT-IZQ-B8"]));
  items.push(...matrix2x4(11.0, 2.0, ["INT-DER-1","INT-DER-2","INT-DER-3","INT-DER-4","INT-DER-5","INT-DER-6","INT-DER-7","INT-DER-8"]));
  const islands = [
    { id: "ISLA-GRANDE-1", x: -3.5, y: 6 },
    { id: "ISLA-GRANDE-2", x: 3.5, y: 6 },
    { id: "ISLA-GRANDE-3", x: -3.5, y: -6 },
    { id: "ISLA-GRANDE-4", x: 3.5, y: -6 },
  ];
  for (const isl of islands) items.push({ id: isl.id, dim: D.BG, type: "BG", x: isl.x, z: -isl.y });
  return items;
}

export function buildFurniture(): { id:string; type:"kiosko"; x:number; z:number; rotY:number }[] {
  return [
    {id:"KIOSKO_IZQ", type:"kiosko", x:-4.9, z:-0.0, rotY:1.6},
    {id:"KIOSKO_DER", type:"kiosko", x:4.9, z:-0.0, rotY:-1.6},
  ];
}

export function computeBounds(items: Item[]) {
  let minX=1/0,maxX=-1/0,minZ=1/0,maxZ=-1/0;
  for(const it of items){
    minX=Math.min(minX,it.x-it.dim.w/2); maxX=Math.max(maxX,it.x+it.dim.w/2);
    minZ=Math.min(minZ,it.z-it.dim.d/2); maxZ=Math.max(maxZ,it.z+it.dim.d/2);
  }
  const pad=4; return { minX:minX-pad, maxX:maxX+pad, minZ:minZ-pad, maxZ:maxZ+pad };
}
