import fs from "node:fs";
import path from "node:path";
import PizZip from "pizzip";

const XML_ENTITIES = [
  ["&", "&amp;"],
  ["<", "&lt;"],
  [">", "&gt;"],
];

function escapeXml(texto) {
  return XML_ENTITIES.reduce((valor, [desde, hasta]) => valor.split(desde).join(hasta), texto);
}

function textoParrafo(parrafo) {
  return [...parrafo.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
    .map((m) => m[1])
    .join("");
}

function rPrBase(parrafo) {
  const run = /<w:r\b[^>]*>[\s\S]*?<\/w:r>/.exec(parrafo)?.[0] ?? "";
  return /<w:rPr>[\s\S]*?<\/w:rPr>/.exec(run)?.[0] ?? "";
}

function rPrSinNegrita(rPr) {
  return rPr.replace(/<w:b(?:\s[^>]*)?\/>/g, "").replace(/<w:bCs(?:\s[^>]*)?\/>/g, "");
}

function run(texto, rPr, negrita) {
  const props = negrita
    ? rPrSinNegrita(rPr).replace("</w:rPr>", "<w:b/><w:bCs/></w:rPr>")
    : rPrSinNegrita(rPr);
  return `<w:r>${props}<w:t xml:space="preserve">${escapeXml(texto)}</w:t></w:r>`;
}

/** Reconstruye una modalidad con el prefijo y las referencias al IIMP en negrita. */
function formatearModalidad(parrafo, idioma) {
  const texto = textoParrafo(parrafo);
  const prefijo = /^((?:Modalidad|Option)\s+\d+\s+\{sel_modalidad_\d+\}:\s*)/.exec(texto)?.[1];
  if (!prefijo) return null;

  const resto = texto.slice(prefijo.length);
  const referencia = idioma === "es" ? /EL IIMP/g : /IIMP/g;
  const rPr = rPrBase(parrafo);
  const pPr = /<w:pPr>[\s\S]*?<\/w:pPr>/.exec(parrafo)?.[0] ?? "";
  const partes = [run(prefijo, rPr, true)];

  let ultimo = 0;
  for (const match of resto.matchAll(referencia)) {
    const inicio = match.index ?? 0;
    if (inicio > ultimo) partes.push(run(resto.slice(ultimo, inicio), rPr, false));
    partes.push(run(match[0], rPr, true));
    ultimo = inicio + match[0].length;
  }
  if (ultimo < resto.length) partes.push(run(resto.slice(ultimo), rPr, false));

  return `<w:p>${pPr}${partes.join("")}</w:p>`;
}

function actualizar(ruta, idioma) {
  const zip = new PizZip(fs.readFileSync(ruta));
  let xml = zip.file("word/document.xml").asText();
  let cambios = 0;

  xml = xml.replace(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g, (parrafo) => {
    const texto = textoParrafo(parrafo).replace(/\s+/g, " ").trim();
    if (!/^(Modalidad|Option) [1-4] \{sel_modalidad_[1-4]\}:/.test(texto)) return parrafo;
    const nuevo = formatearModalidad(parrafo, idioma);
    if (!nuevo) return parrafo;
    cambios++;
    return nuevo;
  });

  zip.file("word/document.xml", xml);
  fs.writeFileSync(ruta, zip.generate({ type: "nodebuffer", compression: "DEFLATE" }));
  return cambios;
}

const es = path.join("plantillas", "contrato-perumin38-tags.docx");
const en = path.join("plantillas", "contrato-perumin38-tags-en.docx");
console.log(`ES: ${actualizar(es, "es")} modalidades formateadas`);
console.log(`EN: ${actualizar(en, "en")} modalidades formateadas`);
