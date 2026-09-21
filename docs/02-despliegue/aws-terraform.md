# Despliegue AWS vía MCP — Terraform + Convención de Tags

> Documento de despliegue de infraestructura del SGC **ContratosStands** usando
> **Terraform** y agentes **MCP** (AWS MCP Server / Terraform MCP Server).
> Adaptado de `montaje-iimp/docs/01-despliegue/aws-terraform.md`.
> Infraestructura: `terraform/` en este repo.

---

## 1. Investigación: MCP servers disponibles

### 1.1 AWS MCP Server (recomendado — managed)
- **Repo**: [`awslabs/mcp`](https://github.com/awslabs/mcp) — suite oficial de MCP servers de AWS.
- **AWS MCP Server (preview)**: servicio remoto managed por AWS (`https://aws-mcp.us-east-1.api.aws/mcp`).
  - Soporte completo de API de AWS + documentación actualizada + SOPs pre-construidos.
  - **Seguridad**: permisos basados en IAM, **cero exposición de credenciales**, llamadas validadas sintácticamente y **auditoría CloudTrail completa**.
- **AWS Knowledge MCP Server**: documentación oficial de AWS en tiempo real.

### 1.2 Terraform MCP Server (HashiCorp)
- **Repo**: [`hashicorp/terraform-mcp-server`](https://github.com/hashicorp/terraform-mcp-server).
- Docker: `hashicorp/terraform-mcp-server` (stdio o streamable-http).
- Integra con **Terraform Registry** y **HCP Terraform / Terraform Enterprise** (`TFE_ADDRESS`/`TFE_TOKEN`).
- **Soporta `AGENTS.md`** en el directorio de configs Terraform para instruir al agente (ya lo tenemos en `terraform/AGENTS.md`).

### 1.3 Amazon S3 Client
- La app consume S3 vía `STORAGE_PROVIDER=s3` (`src/lib/server/storage.ts`).
- Terraform provisiona el bucket y el IAM con acceso mínimo (PutObject/GetObject, **sin DeleteObject**).

---

## 2. Convención de Tags (OBLIGATORIA — filtro del agente MCP)

**Objetivo**: que el agente "se encamine al recurso esperado" y no mire/tome otros servicios.

| Tag | Valor | Filtro |
|---|---|---|
| `project` | `contratos-stands` | **Siempre** — evita recursos de otros sistemas (montaje-integral, etc.) |
| `environment` | `qa` \| `prod` | Según entorno — evita tocar producción desde un plan de qa |
| `component` | `storage` \| `app` \| `database` \| `network` \| `secrets` | Acota al tipo de recurso |
| `managed-by` | `terraform` | Solo recursos manejados por IaC |
| `cost-center` | `eventos-iimp` | Centro de costos |

**Reglas**:
1. TODO recurso AWS del proyecto lleva las 5 tags (en Terraform: `default_tags` del provider + `component` por módulo).
2. El agente SIEMPRE filtra por `project = contratos-stands` antes de listar/modificar/destruir.
3. `terraform destroy` se valida primero con `plan` confirmando que solo afecta recursos con las tags del proyecto.

---

## 3. Estructura Terraform (`terraform/`)

> **Decisión de arquitectura completa: ver `docs/02-despliegue/arquitectura-aws.md` (v4, 2026-09-16).**

```
terraform/
├── AGENTS.md                  # instrucciones para el agente (tags, filtros, naming)
├── main.tf                    # root: orquesta los módulos + backend remoto
├── variables.tf               # aws_region, environment (validación qa|prod), app_domain, clases RDS, capacity ASG
├── outputs.tf                 # bucket, URL app, ECR (sensitive)
├── terraform.tfvars.example   # plantilla (no se sube el .tfvars real)
├── perfiles/                  # perfiles por etapa de la ventana de venta (ver arquitectura-aws.md §1.3)
│   ├── valle.tfvars           # 18 meses: RDS micro, ASG min 1, Multi-AZ off
│   ├── evento.tfvars          # 3 meses de campaña: RDS small, ASG min 1/max 2
│   └── apertura.tfvars        # oct-2026: RDS medium, ASG max 3, Multi-AZ on
├── bootstrap/
│   └── main.tf                # estado remoto: S3 + DynamoDB lock (se aplica UNA vez)
└── modules/
    ├── network/       VPC 2 AZ, subnets, EIP + Gateway Endpoint S3 (SIN NAT)  (component=network)
    ├── database/      RDS PostgreSQL t4g (clase por perfil, Multi-AZ variable) (component=database)
    ├── compute/       EC2 t4g ARM + ASG (min 1/max 3) + Nginx + EIP            (component=app)
    ├── storage/       S3 documentos + lifecycle + IAM                         (component=storage)
    ├── secrets/       Secrets Manager: DATABASE_URL, JWT, SUNAT, Resend       (component=secrets)
    ├── cdn/           CloudFront + ACM (us-east-1) + WAF                      (component=cdn)
    ├── ecs/           (se conserva) ECR + ALB + Fargate — plan de crecimiento  (component=app)
    └── observability/ CloudWatch alarmas + AWS Budgets                        (component=observability)
```

> **Decisión v4 (2026-09-16):** con la ventana de venta de **22 meses (oct-2026 → jul-2028)** y ~1.200
> reservas, el costo dominante es el baseline; se recomienda la **Opción B endurecida** (EC2 t4g ARM +
> ASG + RDS + CloudFront/WAF, **sin NAT**). El módulo `ecs` (Opción A) se conserva como plan de
> crecimiento: comparte el mismo `Dockerfile.ecs`, por lo que migrar no requiere reescribir la app.
> Estado actual del `terraform/` en el repo: base v1 (5 módulos orientados a ECS); el ajuste a v4 se
> implementa cuando el dueño confirme el paquete (`arquitectura-aws.md` §10).

**Recursos clave (todos con las 5 tags obligatorias):**
- **S3** `iimp-contratos-stands-documentos-{env}`: SSE-S3, bloqueo público total, versioning + lifecycle.
- **RDS** `iimp-ctrst-{env}-postgres` (16, t4g): clase por perfil (micro→medium), snapshots, Multi-AZ en apertura/campaña.
- **EC2** `iimp-ctrst-{env}-app` (t4g ARM) + ASG min 1/max 3 + EIP + Nginx → Next.js standalone.
- **CloudFront + WAF**: cache de estáticos/plano 3D y filtrado de tráfico en la apertura pública.
- **Secrets Manager**: `DATABASE_URL`, `JWT_SECRET` (generados por Terraform), `SUNAT_API_TOKEN`, `RESEND_API_KEY`.
- **AWS Budgets** por entorno + alarmas (5xx, CPU, disco) — obligatorio por gobernanza (R1).

**Imagen Docker**: `Dockerfile.ecs` (multi-stage, `output: "standalone"` en `next.config.ts`, entrypoint con `prisma migrate deploy` antes de `node server.js`).

**Conexión con la app (`.env`):**
```env
STORAGE_PROVIDER="s3"
S3_BUCKET="iimp-contratos-stands-documentos-prod"
S3_REGION="us-east-1"
S3_ENDPOINT=""
```

---

## 4. Flujo de despliegue (local con AWS CLI o vía MCP)

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars   # ajustar environment=qa|prod
export AWS_PROFILE="sistemas-aws"              # R4 — ver REGLAS-DESPLIEGUE.md

terraform init
terraform plan  -var-file="terraform.tfvars"   # revisar: SOLO recursos con project=contratos-stands
terraform apply -var-file="terraform.tfvars"   # R1: prod SOLO con autorización del usuario

terraform output s3_access_key_id              # → .env S3 (si se usa IAM user en vez de task role)
terraform output -json s3_access_key_secret    # → .env (sensitive)
```

**Con el MCP**: el agente ejecuta los mismos pasos respetando `terraform/AGENTS.md`
(filtros por tags, sin destroy sin validación previa, nunca credenciales en el repo).

---

## 5. Pendientes / decisión del equipo

- [x] Estructura Terraform completa (5 módulos + bootstrap) adaptada al proyecto.
- [ ] Definir cuenta/org AWS real y credenciales del CLI (o usar **AWS MCP Server managed** con IAM).
- [ ] Backend remoto de estado (`terraform/bootstrap/` aplicado una vez; `-backend-config` en el `init`).
- [ ] `terraform.tfvars` real NO se sube (ya en `.gitignore`).
- [ ] HTTPS: emitir certificado ACM para `ecommerce.sistemasiimp.org.pe` y pasar `acm_certificate_arn` (el listener 443 + redirect 80→443 ya están implementados en el módulo `ecs`, parametrizados por variable — R2).
- [ ] CI (GitHub Actions): build `Dockerfile.ecs` + push a ECR con tag de revisión (hoy `deploy.yml` hace SSH a EC2 — camino A).
- [ ] Migrar el tráfico de EC2 (`docker-compose.prod.yml`) a ECS cuando AWS esté aprobado y el DNS apunte al ALB.
