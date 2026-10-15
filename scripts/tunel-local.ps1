<#
  Tunel publico (Cloudflare Quick Tunnel) hacia el dev server local
  (http://localhost:3001) para que sistemas externos -- p. ej. el sistema de
  facturacion del IIMP en QA -- puedan probar el endpoint
  POST /api/integracion/factura mientras trabajamos en local.

  El tunel corre en ESTA laptop (conexion saliente; no hay que abrir puertos),
  asi que funciona desde cualquier red a la que se mueva el equipo.

  Uso:
    .\scripts\tunel-local.ps1              # levanta el tunel y muestra la URL publica
    .\scripts\tunel-local.ps1 -Stop        # detiene el tunel
    .\scripts\tunel-local.ps1 -Port 3001   # puerto local (por defecto 3001)

  Notas:
  - La URL de Cloudflare Quick Tunnel es EFIMERA: cambia al reiniciar el tunel.
    Si la reinicias, reenvia la URL nueva a quien este probando.
  - Mientras este activo, tu app local queda accesible desde internet: pasale
    la URL solo a quien corresponda y detenlo al terminar (-Stop).
#>
param(
  [int]$Port = 3001,
  [switch]$Stop
)

$ErrorActionPreference = "Stop"
$dir = Join-Path $env:USERPROFILE ".cloudflared"
$exe = Join-Path $dir "cloudflared.exe"

function Get-TunelProcesos { Get-Process cloudflared -ErrorAction SilentlyContinue }

if ($Stop) {
  $procs = Get-TunelProcesos
  if (-not $procs) { Write-Output "No hay tunel activo."; exit 0 }
  $procs | Stop-Process -Force
  Write-Output "Tunel detenido."
  exit 0
}

# Descarga unica del binario (no requiere instalacion) si no existe.
if (-not (Test-Path $exe)) {
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  Write-Output "Descargando cloudflared (solo la primera vez)..."
  Invoke-WebRequest -Uri "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" -OutFile $exe -UseBasicParsing
}

# Una sola instancia del tunel.
Get-TunelProcesos | Stop-Process -Force -ErrorAction SilentlyContinue

$out = Join-Path $dir "tunel.out.log"
$err = Join-Path $dir "tunel.err.log"
Remove-Item $out, $err -Force -ErrorAction SilentlyContinue

$proc = Start-Process -FilePath $exe -ArgumentList "tunnel", "--url", "http://localhost:$Port", "--no-autoupdate" -RedirectStandardOutput $out -RedirectStandardError $err -PassThru -WindowStyle Hidden

$url = ""
for ($i = 0; $i -lt 30 -and -not $url; $i++) {
  Start-Sleep -Seconds 1
  $contenido = Get-Content $err -Raw -ErrorAction SilentlyContinue
  if ($contenido) { $url = [regex]::Match($contenido, "https://[a-z0-9-]+\.trycloudflare\.com").Value }
}

if (-not $url) {
  Write-Output "No se pudo obtener la URL del tunel; revisa $err"
  exit 1
}

Write-Output ""
Write-Output "=== TUNEL ACTIVO ==="
Write-Output ("Local   : http://localhost:{0}" -f $Port)
Write-Output ("Publica : {0}" -f $url)
Write-Output ("PID     : {0}" -f $proc.Id)
Write-Output ""
Write-Output "El sistema externo debe llamar a:"
Write-Output ("  POST {0}/api/integracion/factura" -f $url)
Write-Output "(en local no se exige x-api-key)"
Write-Output ""
Write-Output "Detener con: .\scripts\tunel-local.ps1 -Stop"
