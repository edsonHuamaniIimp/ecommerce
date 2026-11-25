/**
 * Convierte el Excel oficial "RESULTADO DEBIDA DILIGENCIA FINAL_MOSTRAR.xlsx" a JSON para reimportar-dd.cjs.
 * El archivo trae filas de notas arriba: se detecta la fila del encabezado ("FECHA DE INGRESO SOLICITUD").
 * Las fechas salen como AAAA-MM-DD tal como las muestra Excel (no se convierten por zona horaria).
 *
 *   node xlsx-a-json.cjs "<ruta del xlsx>" "<salida.json>"
 */
const ExcelJS = require("exceljs");
const fs = require("fs");

const texto = (v) => {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? "" : v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if (v.richText) return v.richText.map((x) => x.text).join("").trim();
    if (v.result !== undefined) return texto(v.result);
    if (v.text !== undefined) return String(v.text).trim();
    return "";
  }
  return String(v).trim();
};

(async () => {
  const [entrada, salida] = process.argv.slice(2);
  if (!entrada || !salida) throw new Error('Uso: node xlsx-a-json.cjs "<xlsx>" "<salida.json>"');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(entrada);
  const ws = wb.worksheets[0];
  let cabecera = 0;
  ws.eachRow((row, i) => {
    if (!cabecera && texto(row.getCell(1).value).toUpperCase().startsWith("FECHA DE INGRESO")) cabecera = i;
  });
  if (!cabecera) throw new Error("No se encontro el encabezado FECHA DE INGRESO SOLICITUD");
  const head = ws.getRow(cabecera).values.slice(1).map(texto);
  const filas = [];
  for (let r = cabecera + 1; r <= ws.rowCount; r += 1) {
    const valores = ws.getRow(r).values.slice(1);
    if (!valores.some((v) => texto(v))) continue;
    const fila = { fila: r };
    head.forEach((h, i) => { fila[h || `col${i + 1}`] = texto(valores[i]); });
    filas.push(fila);
  }
  fs.writeFileSync(salida, JSON.stringify(filas));
  console.log(`${filas.length} filas -> ${salida}`);
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
