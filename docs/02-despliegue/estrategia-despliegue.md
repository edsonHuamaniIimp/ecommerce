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

## 2. Flujo de despliegue (una revisión)

1. **CI** (`.github/workflows/deploy.yml`, job `build-image`): en push a `main`, construye
   `Dockerfile.ecs` y publica `…/iimp-contratos-stands-app:${{ github.sha }}` en ECR.
2. **Rollout** (Terraform): en `terraform/`
   ```bash
   terraform plan  -var="image_tag=<sha>"
   terraform apply -var="image_tag=<sha>"   # PROD: solo con autorización (R1)
   ```
   ECS hace rolling update (circuit breaker). Ver `terraform/AGENTS.md`.
3. **Verificar**: `curl -fsS https://ecommerce.sistemasiimp.org.pe/api/health` (200).
4. **Rollback**: re-`apply` con el `image_tag` anterior.

## 3. Secrets/variables de CI requeridos

| Nombre | Para | Obligatorio |
|---|---|---|
| `ECR_REGISTRY` | `<acct>.dkr.ecr.<region>.amazonaws.com` | Sí (para build-image) |
| `ECR_REPOSITORY` | `iimp-contratos-stands-app` | Sí |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | push a ECR (+ sync S3) | Sí |
| `AWS_DEFAULT_REGION` | región | No (`us-east-1`) |
| `APP_URL` | build arg `NEXT_PUBLIC_APP_URL` | Sí (`https://ecommerce.sistemasiimp.org.pe`) |
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
