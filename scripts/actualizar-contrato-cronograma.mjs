import fs from "node:fs";
import path from "node:path";
import PizZip from "pizzip";

const ES_MOD3 = "Modalidad 3 {sel_modalidad_3}: El 40% del costo total se pagará dentro de los treinta (30) días hábiles posteriores a la reserva, previa firma del Contrato y presentación de la factura correspondiente; el 30% restante se cancelará dentro de los cuarenta y cinco (45) días hábiles posteriores al pago de la primera cuota; y la última cuota, equivalente al 30% del costo total, se pagará dentro de los treinta (30) días hábiles siguientes, previa presentación de la factura correspondiente. El incumplimiento del primer pago facultará a EL IIMP a suspender la entrega del espacio. La pérdida definitiva de la ubicación y su nueva comercialización procederán una vez resuelto el Contrato, conforme a la Cláusula Décimo Tercera y al numeral 7 del presente Anexo.";
const ES_MOD4 = "Modalidad 4 {sel_modalidad_4}: cronograma personalizado según configuración del cliente.";
const ES_HEADING = "Cronograma de pagos seleccionado:";
const ES_ROW = "Cuota {numero}: {porcentaje}% del total - US$ {monto} - vence: {fecha}";

const EN_MOD3 = "Option 3 {sel_modalidad_3}: 40% of the total cost shall be paid within thirty (30) business days after the reservation, upon signing the Contract and presentation of the corresponding invoice; the remaining 30% shall be paid within forty-five (45) business days after payment of the first installment; and the last installment, equivalent to 30% of the total cost, shall be paid within the following thirty (30) business days, upon presentation of the corresponding invoice. Default on the first payment shall entitle IIMP to suspend delivery of the space. Definitive loss of the location and its re-marketing shall proceed once the Contract is resolved, in accordance with Clause Thirteen and numeral 7 of this Annex.";
const EN_MOD4 = "Option 4 {sel_modalidad_4}: customized schedule according to client configuration.";
const EN_HEADING = "Selected payment schedule:";
const EN_ROW = "Installment {numero}: {porcentaje}% of the total - US$ {monto} - due: {fecha}";

const ESC = (texto) => texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function parrafos(xml) {
  return [...xml.matchAll(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g)].map((m) => ({ xml: m[0], texto: m[0].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() }));
}

function pPr(xml) {
  return /<w:pPr>[\s\S]*?<\/w:pPr>/.exec(xml)?.[0] ?? "";
}

function rPr(xml) {
  return /<w:rPr>[\s\S]*?<\/w:rPr>/.exec(xml)?.[0] ?? "";
}

function parrafoTexto(original, texto) {
  const propiedades = pPr(original);
  const runProps = rPr(original);
  return `<w:p>${propiedades}<w:r>${runProps}<w:t xml:space="preserve">${ESC(texto)}</w:t></w:r></w:p>`;
}

function actualizar(ruta, textos) {
  const zip = new PizZip(fs.readFileSync(ruta));
  let xml = zip.file("word/document.xml").asText();
  const ps = parrafos(xml);

  if (ps.some((p) => p.texto.includes("Modalidad 4 {sel_modalidad_4}") || p.texto.includes("Option 4 {sel_modalidad_4}"))) {
    console.log(`Sin cambios: ${ruta} ya tiene Modalidad 4.`);
    return;
  }

  const mod3 = ps.find((p) => p.texto.includes("Modalidad 3") || p.texto.includes("Option 3"));
  const row = ps.find((p) => p.texto.includes("Cuota {numero}") || p.texto.includes("Installment {numero}"));
  const close = ps.find((p) => p.texto.includes("{/cuotas_contrato}"));
  if (!mod3 || !row || !close) throw new Error(`No se encontraron los parrafos de modalidad/cronograma en ${ruta}`);

  /* Quitar el bloque viejo y reinsertarlo con Modalidad 4 + cronograma unico. */
  xml = xml.replace(row.xml, "");
  xml = xml.replace(close.xml, "");

  const nuevoBloque = [
    parrafoTexto(mod3.xml, textos.mod3),
    parrafoTexto(mod3.xml, textos.mod4),
    parrafoTexto(mod3.xml, textos.heading),
    parrafoTexto(row.xml, "{#cuotas_contrato}"),
    parrafoTexto(row.xml, textos.row),
    parrafoTexto(close.xml, "{/cuotas_contrato}"),
  ].join("");

  xml = xml.replace(mod3.xml, nuevoBloque);
  zip.file("word/document.xml", xml);
  fs.writeFileSync(ruta, zip.generate({ type: "nodebuffer", compression: "DEFLATE" }));
}

const es = path.join("plantillas", "contrato-perumin38-tags.docx");
const en = path.join("plantillas", "contrato-perumin38-tags-en.docx");

actualizar(es, { mod3: ES_MOD3, mod4: ES_MOD4, heading: ES_HEADING, row: ES_ROW });
actualizar(en, { mod3: EN_MOD3, mod4: EN_MOD4, heading: EN_HEADING, row: EN_ROW });

console.log("Plantillas actualizadas: Modalidad 3 oficial, Modalidad 4 y cronograma unico.");
