param(
  [string]$Origen = "plantillas\contrato-perumin38.docx",
  [string]$Destino = "plantillas\contrato-perumin38-tags.docx"
)

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$utf8 = New-Object System.Text.UTF8Encoding($false)

function Leer-DocumentoXml {
  param([System.IO.Compression.ZipArchive]$Zip)
  $entry = $Zip.GetEntry("word/document.xml")
  $reader = New-Object System.IO.StreamReader($entry.Open(), $utf8)
  $content = $reader.ReadToEnd()
  $reader.Close()
  return $content
}

function Run-Arial {
  param([string]$Texto)
  return "<w:r><w:rPr><w:rFonts w:ascii=`"Arial`" w:eastAsia=`"Arial`" w:hAnsi=`"Arial`" w:cs=`"Arial`"/><w:sz w:val=`"20`"/><w:szCs w:val=`"20`"/></w:rPr><w:t xml:space=`"preserve`">$Texto</w:t></w:r>"
}

$zip = [System.IO.Compression.ZipFile]::OpenRead((Resolve-Path $Origen))
$xml = Leer-DocumentoXml -Zip $zip
$zip.Dispose()

# ---------------------------------------------------------------------------
# 1) Placeholders "xxx" del contrato (en orden de aparicion)
# ---------------------------------------------------------------------------
$tagsX = @(
  "{razon_social}", "{ruc}", "{domicilio_fiscal}", "{representante_legal}",
  "{dni_representante}", "{partida_electronica}", "{objeto_social}", "{actividad}",
  "{correo_planos}"
)
$matchesX = [regex]::Matches($xml, '<w:t[^>]*>([^<]*[xX]{3,}[^<]*)</w:t>')
if ($matchesX.Count -ne $tagsX.Count) { throw "Se esperaban $($tagsX.Count) placeholders x, encontrados $($matchesX.Count)" }
for ($i = $matchesX.Count - 1; $i -ge 0; $i--) {
  $m = $matchesX[$i]
  $nuevoTexto = [regex]::Replace($m.Groups[1].Value, "[xX]{3,}", $tagsX[$i])
  $nodoNuevo = $m.Value -replace [regex]::Escape($m.Groups[1].Value), $nuevoTexto
  $xml = $xml.Substring(0, $m.Index) + $nodoNuevo + $xml.Substring($m.Index + $m.Length)
}

# ---------------------------------------------------------------------------
# 2) Placeholders con guiones bajos (Anexo 2 y Anexo 3)
#    Orden: firma IIMP, firma exhibidor, monto total, valor venta, IGV,
#    precio venta, monto modalidad 1, anexo 3 (nombre/empresa/firma/fecha)
# ---------------------------------------------------------------------------
$tagsU = @(
  $null, $null, "{monto_total}", "{valor_venta}", "{igv}", "{precio_venta}",
  "{monto_modalidad_1}", "{firmante_nombre_cargo}", "{firmante_empresa}",
  "{firmante_firma}", "{firmante_fecha}"
)
$matchesU = [regex]::Matches($xml, '<w:t[^>]*>([^<]*_{3,}[^<]*)</w:t>')
if ($matchesU.Count -ne $tagsU.Count) { throw "Se esperaban $($tagsU.Count) placeholders con guiones, encontrados $($matchesU.Count)" }
for ($i = $matchesU.Count - 1; $i -ge 0; $i--) {
  if ($null -eq $tagsU[$i]) { continue }
  $m = $matchesU[$i]
  $nuevoTexto = [regex]::Replace($m.Groups[1].Value, "_{3,}", $tagsU[$i])
  $nodoNuevo = $m.Value -replace [regex]::Escape($m.Groups[1].Value), $nuevoTexto
  $xml = $xml.Substring(0, $m.Index) + $nodoNuevo + $xml.Substring($m.Index + $m.Length)
}

# ---------------------------------------------------------------------------
# 3) Seleccion de modalidad: "Modalidad N (indicar seleccion): "
#    (regex ASCII-safe para no depender del encoding del script)
# ---------------------------------------------------------------------------
$xml = [regex]::Replace($xml, 'Modalidad 1 \(indicar selecci[^)]*\)', "Modalidad 1 {sel_modalidad_1}")
$xml = [regex]::Replace($xml, 'Modalidad 2 \(indicar selecci[^)]*\)', "Modalidad 2 {sel_modalidad_2}")

# ---------------------------------------------------------------------------
# 4) Fila de la tabla del Anexo 1: fila vacia -> fila loop con tags
# ---------------------------------------------------------------------------
$trs = [regex]::Matches($xml, '(?s)<w:tr[ >].*?</w:tr>')
$filaVacia = $null
foreach ($tr in $trs) {
  $texto = [regex]::Replace($tr.Value, '<[^>]+>', '')
  if ($texto.Trim().Length -eq 0) { $filaVacia = $tr; break }
}
if ($null -eq $filaVacia) { throw "No se encontro la fila vacia del Anexo 1" }

$tagsFila = @("{#modulos}{modulo}", "{zona}", "{tipo}", "{metraje}", "{frente}", "{fondo}{/modulos}")
$separador = "</w:p></w:tc>"
$partes = $filaVacia.Value -split [regex]::Escape($separador)
if ($partes.Count -ne 7) { throw "La fila del Anexo 1 no tiene 6 celdas (partes: $($partes.Count))" }
$filaNueva = ""
for ($k = 0; $k -lt 6; $k++) {
  $filaNueva += $partes[$k] + (Run-Arial -Texto $tagsFila[$k]) + $separador
}
$filaNueva += $partes[6]
$xml = $xml.Substring(0, $filaVacia.Index) + $filaNueva + $xml.Substring($filaVacia.Index + $filaVacia.Length)

# ---------------------------------------------------------------------------
# 5) Imagenes por pabellon: tras "Plano de ubicacion ... fecha." hay 2 parrafos
#    vacios -> {#planos} + imagen + (caption + cierre, parrafo clonado)
#    (indices ABSOLUTOS sobre $xml: se busca sobre el substring y se suma la base)
# ---------------------------------------------------------------------------
$idxPlano = $xml.IndexOf("Plano de ubicaci")
if ($idxPlano -lt 0) { throw "No se encontro la linea del plano de ubicacion" }

$vacioPattern = '(?s)<w:p\b[^>]*>(?:(?!</w:p>).)*?</w:p>'
$vacios = @()
$buscarDesde = $idxPlano
while ($vacios.Count -lt 2) {
  $m = [regex]::Match($xml.Substring($buscarDesde), $vacioPattern)
  if (-not $m.Success) { break }
  if ($m.Value -notmatch '<w:r[ >]') {
    $vacios += [pscustomobject]@{ Start = $buscarDesde + $m.Index; Length = $m.Length; Value = $m.Value }
  }
  $buscarDesde = $buscarDesde + $m.Index + $m.Length
}
if ($vacios.Count -lt 2) { throw "No se encontraron los 2 parrafos vacios para las imagenes" }

$pA = $vacios[0]
$pB = $vacios[1]
$pANuevo = $pA.Value.Replace("</w:p>", (Run-Arial -Texto "{#planos}") + "</w:p>")
$pBNuevo = $pB.Value.Replace("</w:p>", (Run-Arial -Texto "{%imagen_plano}") + "</w:p>")
$paraIdB = [regex]::Match($pB.Value, 'w14:paraId="(\w+)"').Groups[1].Value
$pCNuevo = $pB.Value.Replace("</w:p>", (Run-Arial -Texto "{pabellon} - Version {version} - {fecha}") + "</w:p>")
if ($paraIdB) { $pCNuevo = $pCNuevo.Replace('w14:paraId="' + $paraIdB + '"', 'w14:paraId="A1B2C3D4"') }
$pDNuevo = $pB.Value.Replace("</w:p>", (Run-Arial -Texto "{/planos}") + "</w:p>")
if ($paraIdB) { $pDNuevo = $pDNuevo.Replace('w14:paraId="' + $paraIdB + '"', 'w14:paraId="A1B2C3D5"') }

$entreAB = $xml.Substring($pA.Start + $pA.Length, $pB.Start - ($pA.Start + $pA.Length))
$xml = $xml.Substring(0, $pA.Start) + $pANuevo + $entreAB + $pBNuevo + $pCNuevo + $pDNuevo + $xml.Substring($pB.Start + $pB.Length)

# ---------------------------------------------------------------------------
# 5b) Modalidad 3 (personalizada): parrafo + loop de cuotas del cliente, insertado
#     despues del parrafo de Modalidad 2.
# ---------------------------------------------------------------------------
$m2 = [regex]::Match($xml, '(?s)<w:p\b[^>]*>(?:(?!</w:p>).)*?Modalidad 2 \{sel_modalidad_2\}(?:(?!</w:p>).)*?</w:p>')
if (-not $m2.Success) { throw "No se encontro el parrafo de Modalidad 2 para insertar la Modalidad 3" }
$pPr = [regex]::Match($m2.Value, '(?s)<w:pPr>.*?</w:pPr>').Value
$pMod3A = "<w:p>$pPr" + (Run-Arial -Texto "Modalidad 3 {sel_modalidad_3}: cronograma personalizado segun configuracion del cliente.{#cuotas_contrato}") + "</w:p>"
$pMod3B = "<w:p>$pPr" + (Run-Arial -Texto "Cuota {numero}: {porcentaje}% del total - US$ {monto} - vence: {fecha}") + "</w:p>"
$pMod3C = "<w:p>$pPr" + (Run-Arial -Texto "{/cuotas_contrato}") + "</w:p>"
$xml = $xml.Substring(0, $m2.Index + $m2.Length) + $pMod3A + $pMod3B + $pMod3C + $xml.Substring($m2.Index + $m2.Length)

# ---------------------------------------------------------------------------
# 6) Empaquetar el docx etiquetado (copiando el resto de entradas intactas)
# ---------------------------------------------------------------------------
if (Test-Path $Destino) { Remove-Item -LiteralPath $Destino -Force }
$src = [System.IO.Compression.ZipFile]::OpenRead((Resolve-Path $Origen))
$dst = [System.IO.Compression.ZipFile]::Open($Destino, [System.IO.Compression.ZipArchiveMode]::Create)
foreach ($entry in $src.Entries) {
  $nueva = $dst.CreateEntry($entry.FullName, [System.IO.Compression.CompressionLevel]::Optimal)
  $inStream = $entry.Open()
  $outStream = $nueva.Open()
  if ($entry.FullName -eq "word/document.xml") {
    $bytes = $utf8.GetBytes($xml)
    $outStream.Write($bytes, 0, $bytes.Length)
  } else {
    $inStream.CopyTo($outStream)
  }
  $outStream.Close()
  $inStream.Close()
}
$dst.Dispose()
$src.Dispose()

Write-Output "OK: $Destino generado. Tags: {razon_social} ... {planos}/{%imagen_plano}; fila Anexo 1 con loop {#modulos}; modalidades con {sel_modalidad_N}."
