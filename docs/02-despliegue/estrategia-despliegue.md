# Estrategia de despliegue — ContratosStands

> Decisión: **ECS Fargate + Aurora es la ÚNICA producción**, y es lo que sirve
> `https://ecommerce.sistemasiimp.org.pe` (CloudFront → ALB → ECS). El despliegue por
> **EC2 queda como legado y deshabilitado**.

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

## 2. Flujo de despliegue (automático)

En **push a `main`** con cambios de código (los `.md` y `docs/**` **no** disparan el pipeline):

1. **`ci`**: lint (`eslint`) + tipos (`tsc --noEmit`) + tests (`vitest run src`).
2. **`build-image`**: construye `Dockerfile.ecs` **arm64** con **cache de capas** (`type=gha`)
   y publica `…/iimp-contratos-stands-app:<sha>` **y** `:latest` en ECR.
   - Cache: el `npm ci` se reutiliza si no cambió `package.json`; solo se rehace la capa de
     código + `next build`. Así el rebuild por revisión es barato.
3. **`deploy-ecs`**: `aws ecs update-service --force-new-deployment` + `wait services-stable`
   → ECS hace rolling update (circuit breaker). **No depende de Terraform.**
4. **Verificar**: `curl -fsS https://ecommerce.sistemasiimp.org.pe/api/health` (200).

Terraform se usa **solo para infraestructura** (Aurora/ALB/CloudFront/WAF/ECS base), no para
cada deploy de app. **Rollback**: re-deploy de una imagen previa (por `:<sha>`) o revertir commit.

## 3. Secrets/variables de CI requeridos

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
