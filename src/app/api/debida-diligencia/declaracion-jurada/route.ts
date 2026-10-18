import "server-only";

import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getSession } from "@/lib/server/auth";
import { PERMISSIONS, ROLES } from "@/lib/shared/constants";

const ANCHO = 612;
const ALTO = 792;
const MARGEN = 56;
const NAVY = rgb(0.106, 0.212, 0.365);
const TEXTO = rgb(0.059, 0.09, 0.165);
const SECUNDARIO = rgb(0.278, 0.333, 0.412);
const BORDE = rgb(0.886, 0.91, 0.941);

function dividirTexto(texto: string, maximo: number, medir: (t: string) => number): string[] {
  const palabras = texto.split(/\s+/);
  const lineas: string[] = [];
  let linea = "";
  for (const palabra of palabras) {
    const candidata = linea ? `${linea} ${palabra}` : palabra;
    if (medir(candidata) <= maximo) {
      linea = candidata;
    } else {
      if (linea) lineas.push(linea);
      linea = palabra;
    }
  }
  if (linea) lineas.push(linea);
  return lineas;
}

/** Genera el formato vigente de la declaracion jurada de actualizacion de informacion. */
export async function GET(): Promise<NextResponse> {
  const session = await getSession();
  const puedeDescargar =
    session &&
    (session.roles.includes(ROLES.ADMIN) || session.permissions.includes(PERMISSIONS.DD_FORMULARIO));
  if (!puedeDescargar) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const pdf = await PDFDocument.create();
  const pagina = pdf.addPage([ANCHO, ALTO]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);

  pagina.drawRectangle({
    x: 0,
    y: ALTO - 92,
    width: ANCHO,
    height: 92,
    color: NAVY,
  });
  pagina.drawText("IIMP", { x: MARGEN, y: ALTO - 48, size: 18, font: negrita, color: rgb(1, 1, 1) });
  pagina.drawText("Instituto de Ingenieros de Minas del Peru", {
    x: MARGEN,
    y: ALTO - 68,
    size: 10,
    font: regular,
    color: rgb(0.88, 0.91, 0.96),
  });

  let y = ALTO - 130;
  pagina.drawText("DECLARACION JURADA", { x: MARGEN, y, size: 16, font: negrita, color: NAVY });
  y -= 22;
  pagina.drawText("Compromiso de actualizacion de informacion - Debida Diligencia", {
    x: MARGEN,
    y,
    size: 10,
    font: regular,
    color: SECUNDARIO,
  });

  y -= 28;
  pagina.drawLine({ start: { x: MARGEN, y }, end: { x: ANCHO - MARGEN, y }, thickness: 1, color: BORDE });
  y -= 28;

  const parrafos = [
    "Yo, ______________________________________________, identificado(a) con documento de identidad N.° ________________, en calidad de representante legal de la empresa ______________________________________________, con RUC N.° ________________, declaro bajo juramento lo siguiente:",
    "1. Que la informacion consignada en el formulario de Debida Diligencia del IIMP es veraz, completa y se encuentra vigente a la fecha de su presentacion.",
    "2. Que me comprometo a comunicar al IIMP cualquier cambio en la informacion de la empresa, de sus representantes legales o de sus beneficiarios finales, dentro de los quince (15) dias calendario siguientes de producido el cambio.",
    "3. Que la debida diligencia tiene una vigencia de seis (6) meses y que solicitaré su renovacion antes del vencimiento, presentando la documentacion actualizada que corresponda.",
    "4. Que autorizo al IIMP a verificar la informacion en fuentes publicas y listas restrictivas, en cumplimiento de la normativa de prevencion de lavado de activos y financiamiento del terrorismo.",
    "5. Que tomo conocimiento de que la empresa puede reservar un stand, pero no avanzara en las aprobaciones del evento hasta que la debida diligencia se encuentre aprobada y vigente.",
  ];

  for (const parrafo of parrafos) {
    const lineas = dividirTexto(parrafo, ANCHO - MARGEN * 2, (t) => regular.widthOfTextAtSize(t, 10.5));
    for (const linea of lineas) {
      pagina.drawText(linea, { x: MARGEN, y, size: 10.5, font: regular, color: TEXTO });
      y -= 16;
    }
    y -= 8;
  }

  y -= 12;
  pagina.drawText("Firma del representante legal", { x: MARGEN, y, size: 10, font: negrita, color: TEXTO });
  y -= 36;
  pagina.drawLine({ start: { x: MARGEN, y }, end: { x: MARGEN + 220, y }, thickness: 1, color: SECUNDARIO });
  y -= 16;
  pagina.drawText("Nombre y documento de identidad", { x: MARGEN, y, size: 9, font: regular, color: SECUNDARIO });

  y -= 44;
  pagina.drawLine({ start: { x: MARGEN, y }, end: { x: ANCHO - MARGEN, y }, thickness: 1, color: BORDE });
  y -= 18;
  const pie = [
    "Formato vigente 2026. Cargue este documento firmado en el paso 4 del formulario de Debida Diligencia.",
    "La informacion se contrasta con registros publicos y listas restrictivas.",
  ];
  for (const texto of pie) {
    pagina.drawText(texto, { x: MARGEN, y, size: 8.5, font: regular, color: SECUNDARIO });
    y -= 13;
  }

  const bytes = await pdf.save();
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="declaracion-jurada-debida-diligencia.pdf"',
      "Cache-Control": "no-store",
    },
  });
}
