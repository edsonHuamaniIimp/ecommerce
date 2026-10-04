/**
 * Render de prueba de la plantilla de contrato etiquetada con datos dummy.
 * Uso: npx tsx scripts/preview-contrato.ts [contrato-perumin38-tags.docx|contrato-perumin38-tags-en.docx]
 * Salida: <tmp>/contrato-demo[-en].docx
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import ImageModule from "docxtemplater-image-module-free";

// PNG 1x1 transparente (suficiente para validar la insercion de imagenes).
const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const archivo = process.argv[2] ?? "contrato-perumin38-tags.docx";
const plantilla = fs.readFileSync(path.join(process.cwd(), "plantillas", archivo));
const zip = new PizZip(plantilla);

const imageModule = new ImageModule({
  centered: false,
  fileType: "docx",
  getImage: (v) => Buffer.from(String(v), "base64"),
  getSize: () => [320, 200],
});

let doc: Docxtemplater;
try {
  doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    modules: [imageModule],
  });
} catch (e) {
  const err = e as { message: string; properties?: unknown };
  console.error("ERROR DE PLANTILLA:", err.message);
  console.error("PROPIEDADES:", JSON.stringify(err.properties, null, 2));
  process.exit(1);
}

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
  modulos: [
    { modulo: "EXT-DER-03", zona: "Pabellon GESS", tipo: "Estandar", metraje: "9", frente: "3", fondo: "3" },
    { modulo: "EXT-DER-04", zona: "Pabellon GESS", tipo: "Estandar", metraje: "9", frente: "3", fondo: "3" },
  ],
  planos: [{ imagen_plano: PNG_1PX.toString("base64"), pabellon: "Pabellon GESS (2 stands)", version: "1", fecha: "03/10/2026" }],
  monto_total: "4,000.00",
  valor_venta: "3,389.83",
  igv: "610.17",
  precio_venta: "4,000.00",
  sel_modalidad_1: "",
  monto_modalidad_1: "",
  sel_modalidad_2: "",
  sel_modalidad_3: "X",
  cuotas_contrato: [
    { numero: 1, porcentaje: 30, monto: "1,200.00", fecha: "02/11/2026" },
    { numero: 2, porcentaje: 30, monto: "1,200.00", fecha: "17/12/2026" },
    { numero: 3, porcentaje: 40, monto: "1,600.00", fecha: "31/01/2027" },
  ],
  firmante_nombre_cargo: "Jorge Quispe - Gerente General",
  firmante_empresa: "Minera Cordillera S.A.C.",
  firma_exhibidor: PNG_1PX.toString("base64"),
  firmante_fecha: "03/10/2026",
});

const out = doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" });
const destino = path.join(os.tmpdir(), archivo.includes("-en") ? "contrato-demo-en.docx" : "contrato-demo.docx");
fs.writeFileSync(destino, out);
console.log(`OK -> ${destino} (${out.length} bytes)`);
