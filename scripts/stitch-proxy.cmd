@echo off
setlocal
set "GOOGLE_CLOUD_PROJECT=gen-lang-client-0500006143"
set "STITCH_PROJECT_ID=gen-lang-client-0500006143"

rem --- Auth del proxy Stitch (en orden de prioridad) ---
rem 1) STITCH_API_KEY ya definido en el entorno -> no expira.
rem 2) Archivo %USERPROFILE%\.stitch-mcp\api-key.txt -> no expira.
rem 3) Access token de gcloud -> expira ~1 h.
if defined STITCH_API_KEY goto :run

set "KEYFILE=%USERPROFILE%\.stitch-mcp\api-key.txt"
if not exist "%KEYFILE%" goto :gcloud
set /p STITCH_API_KEY=<"%KEYFILE%"
if defined STITCH_API_KEY goto :run

:gcloud
set "GCLOUD=C:\Users\ASUSVivobook\.stitch-mcp\google-cloud-sdk\bin\gcloud.cmd"
for /f "delims=" %%t in ('"%GCLOUD%" auth print-access-token 2^>nul') do set "STITCH_ACCESS_TOKEN=%%t"
if "%STITCH_ACCESS_TOKEN%"=="" (
  echo ERROR: Falta STITCH_API_KEY o token de gcloud. Ejecuta: "%GCLOUD%" auth login 1>&2
  exit /b 1
)

:run
npx -y @_davideast/stitch-mcp proxy
