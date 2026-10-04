param(
  [string]$Origen = "plantillas\contrato-perumin38-tags.docx",
  [string]$Destino = "plantillas\contrato-perumin38-tags-en.docx",
  [string]$Extraer = "",
  [string]$Mapa = ""
)

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$utf8 = New-Object System.Text.UTF8Encoding($false)
$partes = @("word/document.xml", "word/header1.xml", "word/footnotes.xml", "word/endnotes.xml")

function Leer-Entrada {
  param([System.IO.Compression.ZipArchive]$Zip, [string]$Nombre)
  $entry = $Zip.GetEntry($Nombre)
  if ($null -eq $entry) { return $null }
  $reader = New-Object System.IO.StreamReader($entry.Open(), $utf8)
  $content = $reader.ReadToEnd()
  $reader.Close()
  return $content
}

function Escape-Xml {
  param([string]$Texto)
  return $Texto.Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;")
}

function Texto-Parrafo {
  param([string]$ParrafoXml)
  $partesTexto = [regex]::Matches($ParrafoXml, '<w:t(?:\s[^>]*)?>(.*?)</w:t>', [System.Text.RegularExpressions.RegexOptions]::Singleline)
  $texto = ""
  foreach ($t in $partesTexto) {
    $texto += $t.Groups[1].Value.Replace("&lt;", "<").Replace("&gt;", ">").Replace("&amp;", "&")
  }
  return $texto
}

$zip = [System.IO.Compression.ZipFile]::OpenRead((Resolve-Path $Origen))

# ---------------------------------------------------------------------------
# Fase 1: extraer los textos de cada parrafo (JSON por parte) para traducir
# ---------------------------------------------------------------------------
if ($Extraer -ne "") {
  $salida = @{}
  foreach ($nombre in $partes) {
    $xml = Leer-Entrada -Zip $zip -Nombre $nombre
    if ($null -eq $xml) { continue }
    $textos = @()
    foreach ($p in [regex]::Matches($xml, '(?s)<w:p\b[^>]*>.*?</w:p>')) {
      $texto = Texto-Parrafo -ParrafoXml $p.Value
      if ($texto.Trim().Length -gt 0) { $textos += $texto }
    }
    $salida[$nombre.Replace("word/", "").Replace(".xml", "")] = $textos
  }
  $zip.Dispose()
  $json = $salida | ConvertTo-Json -Depth 4
  [System.IO.File]::WriteAllText((Join-Path (Get-Location) $Extraer), $json, $utf8)
  foreach ($k in $salida.Keys) { Write-Output "$k : $($salida[$k].Count) parrafos con texto" }
  return
}

# ---------------------------------------------------------------------------
# Fase 2: aplicar el mapa de traduccion { parte: { "texto es": "texto en" } }
# ---------------------------------------------------------------------------
if ($Mapa -eq "") { throw "Indica -Extraer o -Mapa" }
$esJson = [System.IO.File]::ReadAllText((Join-Path (Get-Location) "plantillas\contrato-textos-es.json"), $utf8) | ConvertFrom-Json
$enJson = [System.IO.File]::ReadAllText((Join-Path (Get-Location) $Mapa), $utf8) | ConvertFrom-Json
$diccionarios = @{}
foreach ($clave in @("document", "header1", "footnotes", "endnotes")) {
  $dic = @{}
  $esArr = @($esJson.$clave)
  $enArr = @($enJson.$clave)
  for ($i = 0; $i -lt $esArr.Count; $i++) {
    if ($null -ne $enArr[$i]) { $dic[[string]$esArr[$i]] = [string]$enArr[$i] }
  }
  $diccionarios[$clave] = $dic
}

$xmls = @{}
foreach ($nombre in $partes) {
  $xml = Leer-Entrada -Zip $zip -Nombre $nombre
  if ($null -eq $xml) { continue }
  $diccionario = $diccionarios[$nombre.Replace("word/", "").Replace(".xml", "")]

  $reemplazos = 0
  $resultado = [System.Text.StringBuilder]::new()
  $pos = 0
  foreach ($m in [regex]::Matches($xml, '(?s)<w:p\b[^>]*>.*?</w:p>')) {
    [void]$resultado.Append($xml.Substring($pos, $m.Index - $pos))
    $pos = $m.Index + $m.Length
    $texto = Texto-Parrafo -ParrafoXml $m.Value
    $traduccion = $diccionario[$texto]
    $interior = $m.Value -replace '^<w:p\b[^>]*>', ''
    if ($null -eq $traduccion -or $texto.Trim().Length -eq 0 -or $interior -match '<w:p[ >]') {
      [void]$resultado.Append($m.Value)
      continue
    }
    $pPr = [regex]::Match($m.Value, '(?s)<w:pPr>.*?</w:pPr>').Value
    $rPr = [regex]::Match($m.Value, '(?s)<w:rPr>.*?</w:rPr>').Value
    $run = "<w:r>" + $rPr + '<w:t xml:space="preserve">' + (Escape-Xml $traduccion) + "</w:t></w:r>"
    [void]$resultado.Append("<w:p>" + $pPr + $run + "</w:p>")
    $reemplazos++
  }
  [void]$resultado.Append($xml.Substring($pos))
  $xmls[$nombre] = $resultado.ToString()
  Write-Output "$nombre : $reemplazos parrafos traducidos"
}
$zip.Dispose()

# ---------------------------------------------------------------------------
# Empaquetar el docx traducido (resto de entradas intactas)
# ---------------------------------------------------------------------------
if (Test-Path $Destino) { Remove-Item -LiteralPath $Destino -Force }
$src = [System.IO.Compression.ZipFile]::OpenRead((Resolve-Path $Origen))
$dst = [System.IO.Compression.ZipFile]::Open((Join-Path (Get-Location) $Destino), [System.IO.Compression.ZipArchiveMode]::Create)
foreach ($entry in $src.Entries) {
  $nueva = $dst.CreateEntry($entry.FullName, [System.IO.Compression.CompressionLevel]::Optimal)
  $inStream = $entry.Open()
  $outStream = $nueva.Open()
  if ($xmls.ContainsKey($entry.FullName)) {
    $bytes = $utf8.GetBytes($xmls[$entry.FullName])
    $outStream.Write($bytes, 0, $bytes.Length)
  } else {
    $inStream.CopyTo($outStream)
  }
  $outStream.Close()
  $inStream.Close()
}
$dst.Dispose()
$src.Dispose()

Write-Output "OK: $Destino generado."
