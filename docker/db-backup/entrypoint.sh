#!/bin/bash
# Entrypoint de la tarea de backup: pg_dump de la BD -> S3.
# Env esperados: DATABASE_URL (secret), BACKUP_BUCKET, AWS_DEFAULT_REGION.
# Salir con codigo != 0 dispara la alarma SNS (stopCode EssentialContainerExited).
set -euo pipefail

FECHA="$(date +%Y%m%d)"
DESTINO="s3://${BACKUP_BUCKET}/${FECHA}/contratos_stands.dump"

echo "Backup iniciado: ${FECHA}"
pg_dump "${DATABASE_URL}" -Fc -f /tmp/contratos_stands.dump

aws s3 cp /tmp/contratos_stands.dump "${DESTINO}" --only-show-errors

echo "Backup OK: ${DESTINO}"
