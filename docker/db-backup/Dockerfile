# Imagen de backup lógico (pg_dump) — tarea ECS diaria (EventBridge).
# Corre pg_dump de la BD y sube el dump al bucket S3 de backups.
# Construida y pusheada por el CI (tag: db-backup) al mismo ECR de la app.

FROM postgres:16-alpine

RUN apk add --no-cache aws-cli bash

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
