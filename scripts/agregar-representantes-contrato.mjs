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

function quitarParrafo(xml, textoTag) {
  const p = parrafos(xml).find((item) => item.texto === textoTag);
  if (!p) return xml;
  return xml.slice(0, p.index) + xml.slice(p.index + p.xml.length);
}

function agregarClausulaRepresentantes(xml, archivo) {
  /* La plantilla nueva usa una sola frase: "representada por X, Y y Z". */
  if (xml.includes("{representantes_clausula}")) {
    return quitarParrafo(xml, "{representantes_adicionales_clausula}");
  }
  const principal = parrafos(xml).find(
    (p) => p.texto.includes("{representante_legal}") && p.texto.includes("{dni_representante}"),
  );
  if (!principal) throw new Error(`No se encontro el parrafo del representante en ${archivo}`);
  if (!principal.texto.includes("{representantes_clausula}")) {
    const esIngles = principal.texto.includes("duly represented by");
    const marcador = esIngles ? "duly represented by" : "debidamente representada por";
    const inicio = principal.texto.indexOf(esIngles ? "duly represented by {representante_legal}" : "debidamente representada por");
    const cierre = principal.texto.indexOf(esIngles ? ", hereinafter referred to" : ", a la que", inicio);
    if (inicio < 0 || cierre < 0 || cierre <= inicio) {
      throw new Error(`No se pudo identificar la clausula de representacion en ${archivo}`);
    }
    const nuevo = `${principal.texto.slice(0, inicio)}${marcador} {representantes_clausula}${principal.texto.slice(cierre)}`;
    xml = xml.slice(0, principal.index) + parrafoTexto(principal.xml, nuevo) + xml.slice(principal.index + principal.xml.length);
  }
  return quitarParrafo(xml, "{representantes_adicionales_clausula}");
}

function agregarFecha(xml) {
  if (xml.includes("Lima, {firmante_fecha}")) return xml;
  const fecha = parrafos(xml).find((p) => p.texto === "Lima,");
  if (!fecha) return xml;
  const nuevo = parrafoTexto(fecha.xml, "Lima, {firmante_fecha}");
  return xml.slice(0, fecha.index) + nuevo + xml.slice(fecha.index + fecha.xml.length);
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

function celdaFirma(width, contenido) {
  return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/><w:vAlign w:val="top"/></w:tcPr>${contenido}</w:tc>`;
}

function rangoTablaExterior(xml, indice) {
  const re = /<\/?w:tbl\b[^>]*>/g;
  const pilas = [];
  let mejor = null;
  let match;
  while ((match = re.exec(xml))) {
    if (match[0].startsWith("</")) {
      const inicio = pilas.pop();
      if (inicio != null && inicio < indice && match.index + match[0].length > indice) {
        if (!mejor || inicio < mejor.inicio) {
          mejor = { inicio, fin: match.index + match[0].length };
        }
      }
    } else {
      pilas.push(match.index);
    }
  }
  return mejor;
}

function campo(texto, bold = false) {
  return parrafoTabs("", [texto], bold, 16);
}

function agregarFirmasAdicionales(xml) {
  /* La tabla de firmas es un bloque completo: se reemplaza entera, nunca dentro de otra tabla. */
  xml = quitarBloque(xml, "{#firmas_representantes}", "{/firmas_representantes}");

  /*
   * Tabla de 3 columnas con ancho fijo. El tag de apertura va en la MISMA
   * parrafo que la imagen del IIMP: si va en su propio parrafo, Word deja un
   * parrafo vacio antes de la imagen y la linea del IIMP queda mas abajo que
   * las lineas del exhibidor.
   */
  const cierre = parrafoLoop("{/firmas_tabla}");
  const fila = `<w:tr><w:trPr><w:cantSplit/></w:trPr>${celdaFirma(3000, `${parrafoLoop("{#firmas_tabla}{%firma_iimp}")}${campo("{linea_iimp}")}${campo("{cargo_iimp}")}${campo("{nombre_iimp}", true)}`)}${celdaFirma(3200, `${parrafoLoop("{%firma_1}")}${campo("{linea_1}")}${campo("{cargo_1}")}${campo("{nombre_1}", true)}`)}${celdaFirma(3200, `${parrafoLoop("{%firma_2}")}${campo("{linea_2}")}${campo("{cargo_2}")}${campo("{nombre_2}", true)}${cierre}`)}</w:tr>`;
  const bloque = `<w:tbl><w:tblPr><w:tblW w:w="9400" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid><w:gridCol w:w="3000"/><w:gridCol w:w="3200"/><w:gridCol w:w="3200"/></w:tblGrid>${fila}</w:tbl>`;

  const tagIndex = xml.indexOf("{#firmas_tabla}");
  if (tagIndex >= 0) {
    const rango = rangoTablaExterior(xml, tagIndex);
    if (rango) {
      return xml.slice(0, rango.inicio) + bloque + xml.slice(rango.fin);
    }
    xml = quitarBloque(xml, "{#firmas_tabla}", "{/firmas_tabla}");
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
    parrafoTabs(tabs, ["{linea_1}", "{linea_2}"], false, 16),
    parrafoTabs(tabs, ["{cargo_1}", "{cargo_2}"], true, 16),
    parrafoTabs(tabs, ["{nombre_1}", "{nombre_2}"], false, 16),
    parrafoLoop("{/firmas_declaracion_filas}"),
  ].join("");

  if (existente) {
    return xml.slice(0, existente.index) + bloque + xml.slice(existente.index);
  }

  const firma = parrafos(xml).find((p) => p.texto.trim() === "Firma: {%firma_exhibidor}" || p.texto.trim() === "Signature: {%firma_exhibidor}");
  if (!firma) return xml;
  return xml.slice(0, firma.index) + bloque + xml.slice(firma.index + firma.xml.length);
}

function espaciarFechaDeclaracion(xml) {
  const p = parrafos(xml).find((item) => item.texto === "Fecha: {firmante_fecha}" || item.texto === "Date: {firmante_fecha}");
  if (!p) return xml;
  let parrafo = p.xml;
  if (/<w:spacing\b[^>]*\/>/.test(parrafo)) {
    parrafo = parrafo.replace(/<w:spacing\b[^>]*\/>/, '<w:spacing w:before="240" w:after="0"/>');
  } else if (parrafo.includes("</w:pPr>")) {
    parrafo = parrafo.replace("</w:pPr>", '<w:spacing w:before="240" w:after="0"/></w:pPr>');
  } else {
    parrafo = parrafo.replace("<w:p>", '<w:p><w:pPr><w:spacing w:before="240" w:after="0"/></w:pPr>');
  }
  return xml.slice(0, p.index) + parrafo + xml.slice(p.index + p.xml.length);
}

function actualizar(archivo) {
  const ruta = path.join("plantillas", archivo);
  const zip = new PizZip(fs.readFileSync(ruta));
  let xml = zip.file("word/document.xml").asText();

  xml = agregarClausulaRepresentantes(xml, archivo);
  xml = agregarFecha(xml);
  xml = agregarFirmasAdicionales(xml);
  xml = agregarFirmasDeclaracion(xml);
  xml = espaciarFechaDeclaracion(xml);
  zip.file("word/document.xml", xml);
  fs.writeFileSync(ruta, zip.generate({ type: "nodebuffer", compression: "DEFLATE" }));
  console.log(`OK: ${archivo}`);
}

actualizar("contrato-perumin38-tags.docx");
actualizar("contrato-perumin38-tags-en.docx");
