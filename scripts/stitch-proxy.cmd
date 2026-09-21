@echo off
setlocal
set "GOOGLE_CLOUD_PROJECT=gen-lang-client-0500006143"
set "STITCH_PROJECT_ID=gen-lang-client-0500006143"
set "GCLOUD=C:\Users\ASUSVivobook\.stitch-mcp\google-cloud-sdk\bin\gcloud.cmd"
for /f "delims=" %%t in ('"%GCLOUD%" auth print-access-token 2^>nul') do set "STITCH_ACCESS_TOKEN=%%t"
if "%STITCH_ACCESS_TOKEN%"=="" (
  echo ERROR: No se pudo obtener el token de Google Cloud. Ejecuta: "%GCLOUD%" auth login 1>&2
  exit /b 1
)
npx -y @_davideast/stitch-mcp proxy
