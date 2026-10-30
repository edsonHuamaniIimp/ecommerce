import fs from "node:fs";
import path from "node:path";
import PizZip from "pizzip";

const ESC = (texto) => texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function parrafos(xml) {
  return [...xml.matchAll(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g)].map((m) => ({
    xml: m[0],
    index: m.index ?? 0,
    texto: m[0].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim(),
  }));
}

function pPr(xml) {
  return /<w:pPr>[\s\S]*?<\/w:pPr>/.exec(xml)?.[0] ?? "";
}

function rPr(xml) {
  return /<w:rPr>[\s\S]*?<\/w:rPr>/.exec(xml)?.[0] ?? "";
}

function parrafoTexto(original, texto) {
  return `<w:p>${pPr(original)}<w:r>${rPr(original)}<w:t xml:space="preserve">${ESC(texto)}</w:t></w:r></w:p>`;
}

function actualizar(archivo, textos) {
  const ruta = path.join("plantillas", archivo);
  const zip = new PizZip(fs.readFileSync(ruta));
  let xml = zip.file("word/document.xml").asText();
  if (xml.includes("{#representantes_adicionales}")) {
    console.log(`Sin cambios: ${archivo} ya tiene representantes adicionales.`);
    return;
  }

  const principal = parrafos(xml).find((p) => p.texto.includes("{representante_legal}") && p.texto.includes("{dni_representante}"));
  if (!principal) throw new Error(`No se encontro el parrafo del representante en ${archivo}`);

  const bloque = [
    parrafoTexto(principal.xml, "{#representantes_adicionales}"),
    parrafoTexto(principal.xml, textos.representante),
    parrafoTexto(principal.xml, "{/representantes_adicionales}"),
  ].join("");

  xml = xml.slice(0, principal.index + principal.xml.length) + bloque + xml.slice(principal.index + principal.xml.length);
  zip.file("word/document.xml", xml);
  fs.writeFileSync(ruta, zip.generate({ type: "nodebuffer", compression: "DEFLATE" }));
  console.log(`OK: ${archivo}`);
}

actualizar("contrato-perumin38-tags.docx", {
  representante: "Adicionalmente, comparece como representante legal de EL EXHIBIDOR: {nombre}, identificado con {tipoDocumento} Nro. {documento}, con poderes inscritos en la Partida Electronica Nro. {partida_electronica} del Registro de Personas Juridicas de Lima (si aplica), correo {correo}, telefono {celular}.",
});
actualizar("contrato-perumin38-tags-en.docx", {
  representante: "Additionally, the following legal representative of THE EXHIBITOR appears: {nombre}, identified with {tipoDocumento} No. {documento}, with powers registered in the Electronic Registry No. {partida_electronica} (if applicable), email {correo}, phone {celular}.",
});
