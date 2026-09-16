# AGENTS.md — Instrucciones para agentes (MCP Terraform / AWS)

> Convención obligatoria para cualquier operación de infraestructura de **contratos-stands**.
> Reglas completas: `docs/01-despliegue/REGLAS-DESPLIEGUE.md` (originadas por el LT del equipo).

## Reglas de oro (reglas del LT + dueño del proyecto)

1. **R1 — PROD PROHIBIDO sin autorización**: NUNCA `apply`/`destroy` en `environment=prod`
   sin autorización explícita y validación del usuario (revisar el `plan` juntos).
   En `qa`, avisar antes de cualquier `apply`.
2. **R2 — Todo con variables**: prohibido hardcodear valores configurables en HCL.
   Un cambio de valor = `-var="clave=valor"` / `terraform.tfvars`. Nunca editar código para cambiar configuración.
3. **R3 — HASHTAG del proyecto** = tag `project=contratos-stands`:
   - Garantizado por `default_tags` del provider (todo recurso que soporte tags lo recibe solo).
   - **SIEMPRE consultar el hashtag antes de listar/modificar/destruir**: solo operar recursos
     con `project=contratos-stands`. **NUNCA tocar otros** (en particular `montaje-integral`).
   - Los `component` (`network|database|storage|secrets|app`) los pone cada módulo.
4. **R4 — Cuentas**: trabajar SOLO con perfil `sistemas-aws` (cuenta sistemas.iimp `517839275515`).
   **PROHIBIDO `default`/`sara-aws-cli`** (otro proyecto). `iimp-aws` solo con aviso explícito.
   Nota del LT: sistemas está cerca del tope de cuota; ideal futuro = cuenta dedicada anexada a la org.
5. **R5 — Estado remoto**: antes de prod, backend S3 + DynamoDB (`bootstrap/` aplicado una vez).
6. Antes de `destroy`: `terraform plan -destroy` y confirmar que SOLO afecta recursos con el hashtag del proyecto.

## Tags del proyecto (R3)

```hcl
project     = "contratos-stands"   # HASHTAG — filtro SIEMPRE del agente
environment = "qa" | "prod"        # prod = solo con autorización (R1)
component   = "network|database|storage|secrets|app"
managed-by  = "terraform"
cost-center = "eventos-iimp"
```

## Arquitectura (ver `docs/01-despliegue/arquitectura-aws.md`)

```
modules/
├── network/       VPC 2 AZ, subnets, NAT (prod) + Gateway Endpoint S3  (component=network)
├── aurora/        Aurora PostgreSQL Serverless v2 (min/max ACU)         (component=database)
├── storage/       S3 documentos (SSE-S3, versioning + lifecycle)        (component=storage)
├── uploads/       EFS para /app/public/uploads (mientras S3 no firmado) (component=storage)
├── secrets/       Secrets Manager: DATABASE_URL, JWT, SUNAT, Resend     (component=secrets)
├── ecs/           ECR + ALB + Fargate ARM64 (on-demand + Spot)          (component=app)
├── acm/           Certificado TLS en us-east-1                          (component=network)
├── cloudfront/    CDN + WAF (us-east-1)                                 (component=app)
└── observability/ Alarmas CloudWatch + AWS Budgets                      (component=app)
```

Naming: prefijo `iimp-ctrst-{env}` en todos los recursos; repo ECR `iimp-contratos-stands-app`.

> **R3 en la práctica:** `component` admite SOLO `network|database|storage|secrets|app`.
> CloudFront/WAF y observabilidad se etiquetan `app` (sirven/monitorean la aplicación).
> Antes de listar/modificar/destruir: `aws resourcegroupstaggingapi get-resources --tag-filters Key=project,Values=contratos-stands`.
> Nunca tocar recursos de `project=montaje-integral` (hay ~58 en la misma cuenta).

## Etiquetas: cómo se implementan (R3) y cómo se auditan (R6)

Las 5 etiquetas **se pasan explícitamente** desde `main.tf` (`local.common_tags`) a cada módulo,
que las fusiona con su `component` (`merge(var.common_tags, { component = "..." })`).

> **Por qué explícitas y no solo `default_tags`:** el `default_tags` del provider **no aparece en el
> plan** de recursos nuevos, por lo que no se podría revisar el diff "solo de recursos con
> `project=contratos-stands`" que exige R6. `default_tags` se mantiene además como red de seguridad.

Auditoría obligatoria antes de cualquier `apply`:

```bash
cd terraform
terraform plan -out=tfplan
terraform show -json tfplan > plan.json
node ../scripts/audit-terraform-plan.mjs plan.json
```

Debe reportar: `etiquetas completas: N/N`, `project=contratos-stands: N/N`, `component en vocabulario R3: OK`
y `sin destrucciones ni reemplazos: OK`.

## HTTPS con DNS externo (no Route53) — dos pasos

Si `route53_zone_id` está vacío, el certificado ACM no se puede validar dentro del mismo `apply`:

1. `apply` con `enable_https = false` y `enable_cloudfront = false` → leer `terraform output acm_validation_records`
2. Cargar esos CNAME en el DNS externo y esperar la validación
3. `apply` con `enable_https = true` y `enable_cloudfront = true`

Con Route53 (`route53_zone_id` informado) se hace en un solo `apply`.

## Despliegue de una revisión

1. CI pushea la imagen a ECR con un tag de revisión.
2. `terraform plan -var="image_tag=<revision>"` — revisar diff (solo hashtag del proyecto).
3. `terraform apply` — ECS hace rolling update (sin downtime, circuit breaker activo).
4. Verificar `GET /api/health` (200) en el ALB.
5. Rollback = re-apply con el `image_tag` anterior.
