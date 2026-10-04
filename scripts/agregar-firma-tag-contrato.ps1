param(
  [string[]]$Archivos = @("plantillas\contrato-perumin38-tags.docx", "plantillas\contrato-perumin38-tags-en.docx")
)

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$utf8 = New-Object System.Text.UTF8Encoding($false)

function Run-Firma {
  # Parrafo de firma ARRIBA de la linea: tabulador centrado en la posicion de la linea
  # del exhibidor (6513 twips = centro de la linea derecha 4956..8070), sin espaciado extra.
  return '<w:p><w:pPr><w:tabs><w:tab w:val="center" w:pos="6513"/></w:tabs><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="left"/><w:rPr><w:rFonts w:ascii="Arial" w:eastAsia="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:eastAsia="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:tab/></w:r><w:r><w:rPr><w:rFonts w:ascii="Arial" w:eastAsia="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:t>{%firma_exhibidor}</w:t></w:r></w:p>'
}

function Texto-Parrafo {
  param([string]$ParrafoXml)
  $texto = ""
  foreach ($t in [regex]::Matches($ParrafoXml, '<w:t(?:\s[^>]*)?>(.*?)</w:t>', [System.Text.RegularExpressions.RegexOptions]::Singleline)) { $texto += $t.Groups[1].Value }
  return $texto
}

function Buscar-Parrafo {
  param([string]$Xml, [scriptblock]$Criterio)
  foreach ($m in [regex]::Matches($Xml, '(?s)<w:p\b[^>]*>.*?</w:p>')) {
    if (& $Criterio (Texto-Parrafo -ParrafoXml $m.Value)) { return $m }
  }
  return $null
}

foreach ($archivo in $Archivos) {
  $ruta = (Resolve-Path $archivo).Path
  $zip = [System.IO.Compression.ZipFile]::OpenRead($ruta)
  $entry = $zip.GetEntry("word/document.xml")
  $reader = New-Object System.IO.StreamReader($entry.Open(), $utf8)
  $xml = $reader.ReadToEnd()
  $reader.Close()
  $zip.Dispose()

  # 1) Anexo 3: el tag de texto de firma pasa a ser imagen (si aun no lo es).
  $xml = [regex]::Replace($xml, '<w:t([^>]*)>([^<]*)\{firmante_firma\}([^<]*)</w:t>', '<w:t$1>$2{%firma_exhibidor}$3</w:t>')
  if ($xml -notmatch '\{%firma_exhibidor\}') { throw "No se encontro ningun tag de firma en $archivo" }

  # 2) Quitar el parrafo de firma standalone previo (si existe) para re-insertarlo bien.
  $mFirma = Buscar-Parrafo -Xml $xml -Criterio { param($t) $t.Trim() -eq '{%firma_exhibidor}' }
  if ($null -ne $mFirma) {
    $xml = $xml.Substring(0, $mFirma.Index) + $xml.Substring($mFirma.Index + $mFirma.Length)
  }

  # 2b) Limpieza: si la firma quedo DENTRO del parrafo de la linea (intento flotante previo),
  #     quitar ese run para volver a la version "arriba de la linea".
  $mLinea = Buscar-Parrafo -Xml $xml -Criterio { param($t) $t.Trim() -match '^_{20,}' }
  if ($null -eq $mLinea) { throw "No se encontro la linea de firma (guiones) en $archivo" }
  if ($mLinea.Value -match '\{%firma_exhibidor\}') {
    $parrafoLimpio = [regex]::Replace($mLinea.Value, '<w:r\b[^>]*>(?:(?!</w:r>).)*?\{%.*?\}(?:(?!</w:r>).)*?</w:r>', '')
    $xml = $xml.Substring(0, $mLinea.Index) + $parrafoLimpio + $xml.Substring($mLinea.Index + $mLinea.Length)
  }

  # 3) Insertar el parrafo de firma ARRIBA de la linea del exhibidor (centrado con tab 6513).
  $mLinea = Buscar-Parrafo -Xml $xml -Criterio { param($t) $t.Trim() -match '^_{20,}' }
  if ($null -eq $mLinea) { throw "No se encontro la linea de firma (guiones) en $archivo" }
  $xml = $xml.Substring(0, $mLinea.Index) + (Run-Firma) + $xml.Substring($mLinea.Index)

  # 4) Centrar la imagen del plano (el modulo ya no fuerza centrado global).
  $mPlano = Buscar-Parrafo -Xml $xml -Criterio { param($t) $t -match '\{%imagen_plano\}' }
  if ($null -ne $mPlano) {
    $conJc = [regex]::Replace($mPlano.Value, '<w:jc w:val="[^"]*"/>', '<w:jc w:val="center"/>', 1)
    if ($conJc -eq $mPlano.Value) { $conJc = [regex]::Replace($mPlano.Value, '<w:pPr>', '<w:pPr><w:jc w:val="center"/>', 1) }
    $xml = $xml.Substring(0, $mPlano.Index) + $conJc + $xml.Substring($mPlano.Index + $mPlano.Length)
  }

  # Repack: escribe el document.xml nuevo conservando el resto de entradas.
  $tmp = "$ruta.tmp"
  if (Test-Path $tmp) { Remove-Item -LiteralPath $tmp -Force }
  $src = [System.IO.Compression.ZipFile]::OpenRead($ruta)
  $dst = [System.IO.Compression.ZipFile]::Open($tmp, [System.IO.Compression.ZipArchiveMode]::Create)
  foreach ($e in $src.Entries) {
    $nueva = $dst.CreateEntry($e.FullName, [System.IO.Compression.CompressionLevel]::Optimal)
    $inStream = $e.Open()
    $outStream = $nueva.Open()
    if ($e.FullName -eq "word/document.xml") {
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
  Move-Item -LiteralPath $tmp -Destination $ruta -Force
  Write-Output "OK: $archivo (tags de firma: $(([regex]::Matches($xml, '\{%firma_exhibidor\}')).Count))"
}
