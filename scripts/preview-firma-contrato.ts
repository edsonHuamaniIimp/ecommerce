/**
 * QA: renderiza el contrato con una FIRMA VISIBLE para verificar que la imagen
 * se inserta (bloque de firmas + Anexo 3) y en que posicion queda.
 * Uso: npx tsx scripts/preview-firma-contrato.ts [contrato-perumin38-tags.docx|contrato-perumin38-tags-en.docx]
 * Salida: <tmp>/contrato-firma-qa[-en].docx
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import ImageModule from "docxtemplater-image-module-free";
import sharp from "sharp";

/** Firma visible: rectangulo azul con trazo diagonal (para verla en el DOCX). */
async function firmaVisible(): Promise<string> {
  const svg = `<svg width="240" height="80" xmlns="http://www.w3.org/2000/svg">
    <rect width="240" height="80" fill="white"/>
    <path d="M15 55 C 50 10, 90 70, 120 35 S 190 20, 225 45" stroke="#123a8c" stroke-width="3" fill="none"/>
  </svg>`;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return png.toString("base64");
}

const archivo = process.argv[2] ?? "contrato-perumin38-tags.docx";

async function main(): Promise<void> {
  const plantilla = fs.readFileSync(path.join(process.cwd(), "plantillas", archivo));
  const zip = new PizZip(plantilla);

  const imageModule = new ImageModule({
    centered: false,
    fileType: "docx",
    getImage: (v) => Buffer.from(String(v), "base64"),
    getSize: (_img: Buffer, _valor: unknown, tagName: string) => (tagName === "firma_exhibidor" ? [150, 55] : [320, 200]),
  });

  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true, modules: [imageModule] });
  const firma = await firmaVisible();
  doc.render({
    razon_social: "MINERA CORDILLERA S.A.C.",
    ruc: "20601234567",
    domicilio_fiscal: "Av. Los Ingenieros 245, Lima",
    representante_legal: "JORGE QUISPE RAMOS",
    dni_representante: "45871233",
    partida_electronica: "11014857",
    objeto_social: "actividades mineras",
    actividad: "exhibicion de equipos",
    correo_planos: "planos@empresa.pe",
    modulos: [{ modulo: "EXT-DER-03", zona: "Pabellon GESS", tipo: "Estandar", metraje: "9", frente: "3", fondo: "3" }],
    planos: [],
    monto_total: "4,000.00",
    valor_venta: "3,389.83",
    igv: "610.17",
    precio_venta: "4,000.00",
    sel_modalidad_1: "X",
    monto_modalidad_1: "4,000.00",
    sel_modalidad_2: "",
    sel_modalidad_3: "",
    cuotas_contrato: [],
    firmante_nombre_cargo: "Jorge Quispe - Representante Legal",
    firmante_empresa: "Minera Cordillera S.A.C.",
    firma_exhibidor: firma,
    firmante_fecha: "03/10/2026",
  });

  const out = doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" });
  const destino = path.join(os.tmpdir(), archivo.includes("-en") ? "contrato-firma-qa-en.docx" : "contrato-firma-qa.docx");
  fs.writeFileSync(destino, out);

  const revisar = new PizZip(out);
  const xml = revisar.file("word/document.xml")?.asText() ?? "";
  const drawings = xml.match(/<w:drawing>/g)?.length ?? 0;
  const media = Object.keys(revisar.files).filter((f) => f.startsWith("word/media/"));
  console.log(`OK -> ${destino}`);
  console.log(`drawings en document.xml: ${drawings}`);
  console.log(`media: ${media.join(", ")}`);
}

void main();
