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

function estiloRun(bold = false, size = 20) {
  return `<w:rPr><w:rFonts w:ascii="Arial" w:eastAsia="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/>${bold ? "<w:b/><w:bCs/>" : ""}</w:rPr>`;
}

function parrafoTabs(tabs, textos, bold = false, size = 20) {
  const runs = textos.map((texto, indice) => {
    const tab = indice > 0 ? "<w:r><w:tab/></w:r>" : "";
    return texto ? `${tab}<w:r>${estiloRun(bold, size)}<w:t xml:space="preserve">${ESC(texto)}</w:t></w:r>` : tab;
  }).join("");
  return `<w:p><w:pPr>${tabs}<w:spacing w:before="0" w:after="0"/><w:jc w:val="left"/>${estiloRun(bold, size)}</w:pPr>${runs}</w:p>`;
}

function parrafoLoop(texto) {
  return `<w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr><w:r><w:t>${ESC(texto)}</w:t></w:r></w:p>`;
}

function agregarClausulaRepresentantes(xml, archivo) {
  if (xml.includes("{representantes_adicionales_clausula}")) return xml;
  xml = quitarBloque(xml, "{#representantes_adicionales}", "{/representantes_adicionales}");
  const principal = parrafos(xml).find((p) => p.texto.includes("{representante_legal}") && p.texto.includes("{dni_representante}"));
  if (!principal) throw new Error(`No se encontro el parrafo del representante en ${archivo}`);
  const bloque = parrafoTexto(principal.xml, "{representantes_adicionales_clausula}");
  return xml.slice(0, principal.index + principal.xml.length) + bloque + xml.slice(principal.index + principal.xml.length);
}

function quitarBloque(xml, inicioTag, finTag) {
  while (true) {
    const ps = parrafos(xml);
    const inicio = ps.find((p) => p.texto.includes(inicioTag));
    if (!inicio) return xml;
    const fin = ps.find((p) => p.index > inicio.index && p.texto.includes(finTag));
    if (!fin) return xml;
    xml = xml.slice(0, inicio.index) + xml.slice(fin.index + fin.xml.length);
  }
}

function quitarBloquesFirmas(xml) {
  xml = quitarBloque(xml, "{#firmas_representantes}", "{/firmas_representantes}");
  return quitarBloque(xml, "{#firmas_tabla}", "{/firmas_tabla}");
}

function agregarFirmasAdicionales(xml) {
  const tablaExistente = parrafos(xml).find((p) => p.texto.includes("{#firmas_tabla}"));
  xml = quitarBloquesFirmas(xml);

  /* Tres columnas: IIMP | exhibidor principal | representante adicional. */
  const tabs = '<w:tabs><w:tab w:val="left" w:pos="3200"/><w:tab w:val="left" w:pos="6300"/></w:tabs>';
  const bloque = [
    parrafoLoop("{#firmas_tabla}"),
    parrafoTabs(tabs, ["", "{%firma_1}", "{%firma_2}"], false, 16),
    parrafoTabs(tabs, ["{linea_iimp}", "{linea_1}", "{linea_2}"], false, 16),
    parrafoTabs(tabs, ["{nombre_iimp}", "{nombre_1}", "{nombre_2}"], true, 16),
    parrafoTabs(tabs, ["{cargo_iimp}", "{cargo_1}", "{cargo_2}"], false, 16),
    parrafoLoop("{/firmas_tabla}"),
  ].join("");

  /* Plantilla ya migrada: reemplaza el bloque existente en la misma posicion. */
  if (tablaExistente) {
    return xml.slice(0, tablaExistente.index) + bloque + xml.slice(tablaExistente.index);
  }

  const ps = parrafos(xml);
  const firma = ps.find((p) => p.texto.trim() === "{%firma_exhibidor}");
  const ancla = ps.find((p) => /^IIMP\s*(EL EXHIBIDOR|THE EXHIBITOR)$/i.test(p.texto));
  if (!firma || !ancla || ancla.index < firma.index) return xml;
  return xml.slice(0, firma.index) + bloque + xml.slice(ancla.index + ancla.xml.length);
}

function agregarFirmasDeclaracion(xml) {
  const existente = parrafos(xml).find((p) => p.texto.includes("{#firmas_declaracion_filas}"));
  xml = quitarBloque(xml, "{#firmas_representantes_filas}", "{/firmas_representantes_filas}");
  xml = quitarBloque(xml, "{#firmas_declaracion_filas}", "{/firmas_declaracion_filas}");

  /* Dos firmas por fila: principal + adicionales; luego salto de fila. */
  const tabs = '<w:tabs><w:tab w:val="left" w:pos="4600"/></w:tabs>';
  const bloque = [
    parrafoLoop("{#firmas_declaracion_filas}"),
    parrafoTabs(tabs, ["{%firma_1}", "{%firma_2}"], false, 16),
    parrafoTabs(tabs, ["{nombre_1}", "{nombre_2}"], true, 16),
    parrafoTabs(tabs, ["{cargo_1}", "{cargo_2}"], false, 16),
    parrafoLoop("{/firmas_declaracion_filas}"),
  ].join("");

  if (existente) {
    return xml.slice(0, existente.index) + bloque + xml.slice(existente.index);
  }

  const firma = parrafos(xml).find((p) => p.texto.trim() === "Firma: {%firma_exhibidor}" || p.texto.trim() === "Signature: {%firma_exhibidor}");
  if (!firma) return xml;
  return xml.slice(0, firma.index) + bloque + xml.slice(firma.index + firma.xml.length);
}

function actualizar(archivo) {
  const ruta = path.join("plantillas", archivo);
  const zip = new PizZip(fs.readFileSync(ruta));
  let xml = zip.file("word/document.xml").asText();

  xml = agregarClausulaRepresentantes(xml, archivo);
  xml = agregarFirmasAdicionales(xml);
  xml = agregarFirmasDeclaracion(xml);
  zip.file("word/document.xml", xml);
  fs.writeFileSync(ruta, zip.generate({ type: "nodebuffer", compression: "DEFLATE" }));
  console.log(`OK: ${archivo}`);
}

actualizar("contrato-perumin38-tags.docx");
actualizar("contrato-perumin38-tags-en.docx");
