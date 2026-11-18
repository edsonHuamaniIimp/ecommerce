# Plan de Backups — ContratosStands

> Estado: **IMPLEMENTADO EN CÓDIGO (2026-11-18) — pendiente de aplicar a prod con autorización (R1).**
> `terraform validate` OK · `terraform fmt` OK. Ningún recurso de AWS fue tocado todavía.
> Cuenta: `sistemas-aws` (517839275515), región `us-east-1`.
> Reglas: `docs/02-despliegue/REGLAS-DESPLIEGUE.md` (R1 prod con autorización, R2 todo variable, R3 hashtag).

## 1. Estado actual (auditado 2026-11-18)

| Componente | Estado |
|---|---|
| Aurora prod (BD) | Backups nativos: retención 14 días, ventana 04:40-05:10 UTC. Automáticos diarios activos + 9 snapshots manuales del equipo. `skip_final_snapshot=true` (prod). |
| S3 documentos (`iimp-contratos-stands-documentos-prod`) | Versioning **Enabled** + lifecycle (expira versiones antiguas, tiering 90 días). **Sin replicación ni backup externo.** |
| S3 terraform state | Versioning Enabled. Sin replicación. |
| EFS uploads (`iimp-ctrst-prod-uploads`) | **Sin backup policy** (PolicyNotFound). |
| ECR imágenes | Lifecycle: últimas 10 imágenes (rollback por tag). |
| AWS Backup | **No existe plan del proyecto.** |
| DeletionProtection Aurora | **False** (riesgo de borrado accidental). |
| pg_dump lógico | No existe automatización (solo snapshots físicos). |
| Secrets Manager | Sin replicación. |

## 2. Objetivos (RPO / RTO)

| Dato | Protección | RPO | RTO |
|---|---|---|---|
| BD (Aurora) | Snapshots nativos + pg_dump lógico diario | 24 h (dump diario) / minutos (PITR) | 1-2 h |
| Documentos S3 | Versioning + **CRR cross-region** | continuo (CRR ~minutos) | minutos |
| Uploads EFS | AWS Backup diario | 24 h | 1-2 h |
| Secretos | Replicación Secrets Manager | continuo | inmediato |

## 3. Cambios propuestos

### 3.1 Fase 1 — Inmediato (barato, bajo riesgo) — IMPLEMENTADO EN CÓDIGO

**A. DeletionProtection en Aurora (prod)**
- `terraform/modules/aurora/main.tf`: `deletion_protection = var.environment == "prod"`. ✔ implementado

**B. AWS Backup para EFS uploads**
- Módulo nuevo `terraform/modules/backups/` (tags R3: `component = storage`):
  - Vault `iimp-ctrst-{env}-vault`.
  - Plan diario (cron `cron(0 2 * * ? *)` UTC), retención **35 días**.
  - Selección por ARN del EFS de uploads (`module.uploads.file_system_arn`). ✔ implementado

**C. pg_dump lógico diario a S3**
- Bucket `iimp-ctrst-{env}-db-backups` (privado, SSE-S3, lifecycle expira a los 90 días).
- Tarea ECS programada (EventBridge `cron(30 3 * * ? *)` UTC, Fargate ARM64 256/512):
  - Imagen `docker/db-backup/` (postgres:16-alpine + aws-cli), tag ECR `db-backup`
    (la construye el CI en `build-db-backup` de `.github/workflows/deploy.yml`).
  - `DATABASE_URL` inyectado desde Secrets Manager (mismo secreto de la app).
  - Task role mínimo: `s3:PutObject` al bucket de dumps + `secretsmanager:GetSecretValue` al secreto. ✔ implementado

**D. Replicación cross-region de documentos S3 (CRR)**
- Provider `aws.dr` (`us-east-2`, mismas 5 tags R3).
- Bucket destino `iimp-ctrst-{env}-documentos-dr` (versioning + bloqueo público + SSE-S3).
- Regla de replicación en el bucket origen: todo el contenido, delete markers y
  objetos existentes. Rol IAM mínimo de replicación. ✔ implementado

**E. Replicación de Secrets Manager**
- Bloque nativo `replica { region = us-east-2 }` en los 16 secretos
  (`secrets_replica_enabled=true`, `dr_region` por variable). ✔ implementado

**F. Alarma de fallo de backup**
- EventBridge detecta la tarea de pg_dump en estado `STOPPED` con
  `stopCode` = `EssentialContainerExited`/`TaskFailedToStart` → SNS
  `iimp-ctrst-{env}-backup-alerts` con suscripción email
  (`backup_alert_email`, fallback `budget_alert_email`). ✔ implementado

### 3.2 Fase 2 — Fire drill (probar que los backups SIRVEN)

Ejercicio trimestral (o antes de cada evento), documentado en runbook:

1. **Aurora**: `restore-db-cluster-to-point-in-time` a un cluster temporal
   `iimp-ctrst-prod-restore-test` → conectar, `SELECT count(*)` en tablas clave → borrar.
2. **pg_dump**: descargar el dump del día, `pg_restore --list` + restaurar en
   contenedor local `postgres:16` → validar conteos.
3. **S3 documentos**: `get-object --version-id` de un documento viejo (prueba de
   versioning) y de un objeto del bucket DR en `us-east-2` (prueba de CRR).
4. **EFS**: restaurar un recovery point de AWS Backup a un EFS temporal → verificar
   archivos → borrar.
5. Registrar resultado en `docs/06-operacion/fire-drills.md`.

## 4. Pasos pendientes para producción (NO ejecutados)

1. **Merge del código a `main`** → el CI construye y pushea la imagen `db-backup` a ECR.
2. **Seed inicial de CRR**: una vez aplicado, copiar los documentos existentes al
   bucket DR (`aws s3 sync s3://iimp-contratos-stands-documentos-prod s3://iimp-contratos-stands-documentos-prod-dr`)
   — la replicación cubre solo objetos nuevos.
3. **`terraform plan`** (flujo R6: revisar diff con el usuario — solo recursos con
   `project=contratos-stands`) → **autorización → `terraform apply`**.
   Cambios esperados en el plan: SOLO adiciones (módulo backups, bucket DR, reglas)
   + 2 modificaciones in-place sin restart (`deletion_protection` en Aurora,
   `replica` blocks en secretos). La app no se redespliega.

## 5. Archivos tocados

| Archivo | Cambio |
|---|---|
| `terraform/main.tf` | + provider `aws.us_east_2` (R3 tags), + `module "backups"` |
| `terraform/variables.tf` | + `backup_retention_days`, `backup_schedule`, `backup_bucket_name_prefix`, `enable_crr` (R2) |
| `terraform/modules/aurora/main.tf` | `deletion_protection` |
| `terraform/modules/storage/main.tf` | + CRR rule + bucket DR (o bucket DR en module backups) |
| `terraform/modules/backups/main.tf` | NUEVO: vault, plan, selección, bucket de dumps, task def + EventBridge |
| `terraform/modules/observability/main.tf` | + alarma de fallo de la tarea de backup |
| `docker/db-backup/Dockerfile` + `entrypoint.sh` | NUEVO: imagen de dump lógico |

## 5. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Apply en prod cambia algo no deseado | Flujo R6: `terraform plan` → revisar diff (solo `project=contratos-stands`) → autorización → apply |
| Tarea de backup con credenciales | Secret DATABASE_URL existente + role mínimo `s3:PutObject` a UN bucket |
| CRR no replica objetos anteriores | Tras aplicar, correr un seed `aws s3 sync` inicial a `us-east-2` |
| Fire drill olvidado | EventBridge o recordatorio en plan de eventos; registrar en runbook |

## 6. Costo mensual estimado

| Ítem | Est. USD/mes |
|---|---|
| AWS Backup EFS | ~0.5 |
| Bucket dumps + tarea ECS | ~2 |
| CRR documentos (transfer + almacén) | ~3-5 (depende del volumen de docs) |
| Secrets replication | ~0.5 |
| **Total** | **~6-8** |

## 7. Rollback del plan

- Cada cambio es aditivo y reversible por Terraform (`destroy` del módulo backups,
  quitar regla CRR, etc.). El DeletionProtection se revierte con un apply.
