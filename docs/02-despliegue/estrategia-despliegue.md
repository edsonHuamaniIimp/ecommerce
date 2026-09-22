# Estrategia de despliegue — ContratosStands

> Decisión: **ECS Fargate + Aurora es la ÚNICA producción**, y es lo que sirve
> `https://ecommerce.sistemasiimp.org.pe` (CloudFront → ALB → ECS). El despliegue por
> **EC2 queda como legado y deshabilitado**.

## 0. Estado actual — YA CONFIGURADO (NO re-evaluar)

> **Para próximas sesiones/agentes:** todo lo de esta sección **ya está desplegado y
> configurado y verificado**. NO hay que re-evaluar el despliegue, ni recrear secrets, ni
> cambiar el pipeline, ni volver a decidir arquitectura. Solo desplegar cambios de código
> cuando corresponda (ver §2).

### 0.1 Pipeline de CI/CD (`.github/workflows/deploy.yml`)

- **Push a `main`** → corre **SOLO `ci`** (lint / `tsc` / tests). **NO** construye ni despliega.
- **Deploy = MANUAL**: GitHub → **Actions** → *CI/CD — ContratosStands* → **Run workflow**
  (branch `main`). El deploy **no** se dispara solo con el push.
- Jobs del run manual: `ci` (informativo, **no bloquea**) → `build-image` → `deploy-ecs`.
- `build-image`: runner **ARM nativo** (`ubuntu-24.04-arm`, **sin QEMU**) + cache `type=gha`.
  **Idempotente**: si la imagen de ese commit ya existe en ECR, **no se reconstruye**.
- `deploy-ecs`: `aws ecs update-service --force-new-deployment` + `wait services-stable`.
  **No depende de `ci`** (los tests no bloquean el deploy; corren en paralelo como informe).
- ⏱️ Tiempos medidos: `ci` ~1 min (paralelo), `build` ~3.5 min, `rollout` ~3.5 min.
- **Rollback**: re-deploy de una imagen previa (`:<sha>`) o revertir commit.
- Push de **solo docs** (`docs/**`, `**/*.md`) → no dispara el pipeline.

### 0.2 GitHub Actions secrets — YA CARGADOS (no recrear)

`ECR_REGISTRY`, `ECR_REPOSITORY`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`,
`AWS_DEFAULT_REGION`, `APP_URL`, `ECS_CLUSTER`, `ECS_SERVICE`, `SGC_RECONCILE_URL`,
`SGC_CRON_SECRET`.
`gh` está autenticado con el PAT guardado en git (`gh auth login` no aplica por scope; se usa
`GH_TOKEN`, persistido a nivel usuario).

### 0.3 IDs de AWS (cuenta `517839275515`, región `us-east-1`, perfil `sistemas-aws`)

| Recurso | Valor |
|---|---|
| Cluster ECS | `iimp-ctrst-prod-cluster` |
| Servicio ECS | `iimp-ctrst-prod-service` (familia task def `iimp-ctrst-prod-app`) |
| Task def actual | `iimp-ctrst-prod-app:7` |
| ECR | `517839275515.dkr.ecr.us-east-1.amazonaws.com/iimp-contratos-stands-app` |
| Subnets | `subnet-002cec8a22f901692`, `subnet-0aee52c3778187fbc` |
| Security Group | `sg-0ba0fd0451ccd4270` |
| Aurora | `iimp-ctrst-prod-aurora.cluster-cnylvqmtzz6i.us-east-1.rds.amazonaws.com` (db `contratos_stands`, user `ctrst`) |
| WAF | `iimp-ctrst-prod-waf` (`SizeRestrictions_BODY`→`count`) |
| Target group | `iimp-ctrst-prod-tg` (health check `/api/health`, **interval 10s**, timeout 5s, healthy 2) |
| Dominio | `https://ecommerce.sistemasiimp.org.pe` (CloudFront → ALB → ECS Fargate) |
| Tamaño imagen | ~843 MB (se empuja al build y se baja en cada task; candidato a reducir) |

### 0.4 Integración SGC — variables YA en el task ECS (`:7`)

```
SGC_ENABLED=1
SGC_MODE=real
SGC_API_URL=https://qa-gestion-contratos.sistemasiimp.org.pe/api/integrations/v1
SGC_API_KEY=sgc_...            (conexión ECOMMERCE_IIMP_CONEX — ambiente QA)
SGC_AREA_CODE=EVENTOS
SGC_CONTRACT_TYPE_CODE=AUSPICIO
SGC_WEBHOOK_SECRET=whsec_...   (receptor de webhooks)
CRON_SECRET=<cron de reconciliación>
```

- La app apunta al SGC **QA** (`qa-gestion-contratos...`). Para producción real faltaría la
  **clave del SGC de prod** (`gestion-contratos...`).
- Receptor de webhooks: `POST https://ecommerce.sistemasiimp.org.pe/api/integracion/sgc/webhook`
  (el SGC debe registrar **esa** URL; hoy no está registrada → los estados se refrescan por
  *sync-on-read* del panel y por la reconciliación).
- Contrato y anexos se envían por la **misma API** (`POST /contracts/{id}/documents`) cambiando
  `category` (`"contract"` / `"annex"`). Detalle: `docs/05-integraciones/integracion-sgc.md`.

## 1. Topología

```
Usuario → ecommerce.sistemasiimp.org.pe → CloudFront → ALB → ECS Fargate (iimp-ctrst-prod)
                                                                    └→ Aurora PostgreSQL (DATABASE_URL en Secrets Manager)
```

- **App**: imagen `Dockerfile.ecs` (Next.js standalone) en **ECR** (repo `iimp-contratos-stands-app`).
- **BD**: Aurora Serverless v2 (`terraform/modules/aurora`).
- **Secretos**: Secrets Manager (`database_url`, `jwt_secret`, …) → variables del task ECS.
- Migraciones: el entrypoint ECS (`docker/entrypoint-ecs.sh`) corre `prisma migrate deploy` al
  arrancar cada task (nunca destruye datos).

## 2. Flujo de despliegue (manual)

> **Push a `main` NO despliega**: solo corre `ci`. El deploy se lanza **a mano** (ver §0.1).

**Deploy manual** (Actions → *Run workflow*, branch `main`):

1. **`ci`**: lint + tipos + tests. Corre en paralelo y **no bloquea**.
2. **`build-image`**: construye `Dockerfile.ecs` **arm64** (runner ARM nativo, sin QEMU) con
   **cache de capas** (`type=gha`) y publica `…:<sha>` **y** `:latest` en ECR.
   - Si la imagen de ese commit **ya existe** en ECR, **no reconstruye** (idempotente).
   - Cache: el `npm ci` se reutiliza si no cambió `package.json`; solo se rehace la capa de
     código + `next build`.
3. **`deploy-ecs`**: `aws ecs update-service --force-new-deployment` + `wait services-stable`
   → ECS hace rolling update (circuit breaker, min 100% / max 200%, drain 30s).
   **No depende de `ci` ni de Terraform.**
4. **Verificar**: `curl -fsS https://ecommerce.sistemasiimp.org.pe/api/health` (200).

Terraform se usa **solo para infraestructura** (Aurora/ALB/CloudFront/WAF/ECS base), no para
cada deploy de app. **Rollback**: re-deploy de una imagen previa (por `:<sha>`) o revertir commit.

## 3. Secrets/variables de CI requeridos

> ✅ **Ya cargados** en el repo (ver §0.2). No recrear.

| Nombre | Para | Obligatorio |
|---|---|---|
| `ECR_REGISTRY` | `<acct>.dkr.ecr.<region>.amazonaws.com` | Sí (para build-image) |
| `ECR_REPOSITORY` | `iimp-contratos-stands-app` | Sí |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | push a ECR + `ecs update-service` | Sí |
| `AWS_DEFAULT_REGION` | región | No (`us-east-1`) |
| `APP_URL` | build arg `NEXT_PUBLIC_APP_URL` | Sí (`https://ecommerce.sistemasiimp.org.pe`) |
| `ECS_CLUSTER` | cluster del rollout | No (`iimp-ctrst-prod-cluster`) |
| `ECS_SERVICE` | servicio del rollout | No (`iimp-ctrst-prod-service`) |
| `SGC_RECONCILE_URL` / `SGC_CRON_SECRET` | cron de reconciliación SGC | Sí (cron) |

Variables de repo (`vars`, no secrets):

| Nombre | Efecto |
|---|---|
| `DEPLOY_EC2` | `1` reactiva el deploy legado al EC2 (por defecto deshabilitado) |

## 4. Seed en ECS

El task ECS siembra solo si `RUN_SEED=true` (usa `prisma/seed-auth.ts`, autocontenido).
Está **desactivado por defecto**. Ver `docs/06-operacion/seeders.md`.

### 4.1 Opción A — `RUN_SEED=true` (una vez)

```bash
terraform apply -var="image_tag=<sha>" -var="run_seed=true"
# ... verificar login ...
terraform apply -var="image_tag=<sha>" -var="run_seed=false"   # volver a false
```

### 4.2 Opción B — ECS Exec (sin redeploy)

Requiere `enable_execute_command = true` en el servicio (variable `enable_exec_command`, default `true`)
y haber desplegado con esa config.

```bash
CLUSTER=$(terraform output -raw ecs_cluster_name)
SERVICE=$(terraform output -raw ecs_service_name)
TASK=$(aws ecs list-tasks --cluster "$CLUSTER" --service-name "$SERVICE" --query 'taskArns[0]' --output text)

aws ecs execute-command --cluster "$CLUSTER" --task "$TASK" --container app --interactive \
  --command "sh -c 'SEED_ALLOW_PROD=1 npx tsx prisma/seed-auth.ts'"
```

### 4.3 Opción C — task one-off (el entrypoint ejecuta y termina)

```bash
aws ecs run-task --cluster "$CLUSTER" --launch-type FARGATE \
  --task-definition <taskdef> \
  --overrides '{"containerOverrides":[{"name":"app","command":["sh","-c","SEED_ALLOW_PROD=1 npx tsx prisma/seed-auth.ts"]}]}' \
  --network-configuration '{"awsvpcConfiguration":{"subnets":["<subnet>"],"securityGroups":["<sg>"]}}'
```

### 4.4 Outputs útiles para armar/consultar la BD

```bash
terraform output -raw aurora_endpoint        # host
terraform output -raw aurora_username        # usuario (sensitive)
terraform output -raw aurora_database_name
terraform output -raw database_url_secret_arn
```

## 5. EC2 (legado)

- `docker-compose.prod.yml` + `docker/entrypoint.sh` en un host EC2 (puerto 8080).
- **No** está detrás del dominio. Se mantiene solo como respaldo/pruebas.
- El job de deploy EC2 está **deshabilitado** salvo que se defina `vars.DEPLOY_EC2=1`.

## 5.1 WAF y subidas de archivos

La regla `SizeRestrictions_BODY` del `AWSManagedRulesCommonRuleSet` bloquea cuerpos > 8 KB
(HTTP **403**), lo que impedía subir documentos/imágenes (`POST /api/upload`). En el WebACL
`iimp-ctrst-prod-waf` se **sobrescribe esa regla a `count`** (`rule_action_override`), de modo
que las subidas funcionan; el resto de reglas del CRS siguen activas. Ver
`terraform/modules/cloudfront/main.tf`.

> AWS WAF no permite *scope-down* por ruta en `rule_action_override`, por eso el override es
> global para esa regla (no solo para `/api/upload`).

## 6. Credenciales AWS y backend remoto

### 6.1 Perfiles (`credentials` — formato INI)

El archivo `credentials` (con bloques `[perfil]` + `aws_access_key_id` / `aws_secret_access_key`)
es el de **AWS CLI**. Ubicarlo en:

- Windows: `%USERPROFILE%\.aws\credentials`
- Linux/macOS: `~/.aws/credentials`
- o definiendo `AWS_SHARED_CREDENTIALS_FILE` apuntando al archivo.

Perfiles (ver **R4** en `REGLAS-DESPLIEGUE.md`):

| Perfil | Cuenta | Uso |
|---|---|---|
| `sistemas-aws` | `517839275515` (sistemas.iimp) | ✅ **Cuenta de trabajo del proyecto** |
| `iimp-aws` | `463470959856` | Solo con aviso explícito |
| `default` / `sara-aws-cli` | `564914947461` | ❌ **Prohibidos** (otro proyecto) |

```bash
export AWS_PROFILE=sistemas-aws        # Linux/Mac
$env:AWS_PROFILE = "sistemas-aws"      # Windows (PowerShell)
# por comando:      aws --profile sistemas-aws ...
# terraform:        -var="aws_profile=sistemas-aws"
```

> **Nunca** commitear el archivo `credentials` ni claves. En CI/CD se usan los secrets
> `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`.

### 6.2 Backend remoto (R5)

Ya aprovisionado (`terraform/bootstrap/`: bucket `iimp-contratos-stands-terraform-state` +
tabla `iimp-contratos-stands-terraform-locks`). Inicializar:

```bash
cd terraform
terraform init \
  -backend-config="bucket=iimp-contratos-stands-terraform-state" \
  -backend-config="key=<entorno>/terraform.tfstate" \
  -backend-config="region=us-east-1" \
  -backend-config="dynamodb_table=iimp-contratos-stands-terraform-locks"
```
