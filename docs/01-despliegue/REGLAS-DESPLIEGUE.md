# Reglas de Despliegue — ContratosStands (gobernanza)

> Reglas adaptadas de `montaje-iimp/docs/01-despliegue/REGLAS-DESPLIEGUE.md`
> (originadas por el equipo — LT Edson — y el usuario dueño). Son de **cumplimiento
> obligatorio** para cualquier operación de infraestructura, despliegue o agente (MCP).

---

## R1. PROD: PROHIBIDO sin autorización explícita

- **NUNCA** se crea, modifica o destruye nada en el entorno `prod` sin autorización explícita y validación del usuario.
- Todo cambio en prod pasa por: `terraform plan` → revisión del diff **con el usuario** → autorización → `apply`.
- Aplica también a: `terraform destroy`, rotación de secretos, migraciones de BD en prod, y cambios manuales fuera de Terraform.
- **QA** se puede trabajar libremente, pero siempre avisando antes de un `apply` que cree recursos reales.

## R2. TODO con variables Terraform — NADA hardcodeado

> "Cuando quieres arreglar lo hardcodeado tienes que volver a hacer un despliegue... y eso puede perjudicarte."

- Cualquier valor configurable es una **variable con default documentado**: CIDRs, tamaños de instancia, capacidades, retenciones, regiones, perfiles, tags de imagen.
- Cambiar un valor **NUNCA requiere tocar código Terraform**: solo `-var="clave=valor"` o `terraform.tfvars`.
- El código HCL no contiene números mágicos de configuración (los defaults viven en `variables.tf`, declarados y comentados).

## R3. "Hashtag por proyecto" = tags AWS (OBLIGATORIAS)

> "Que te maneje un hashtag por proyecto... que siempre consulte cuál es el hashtag, que no toque otros."

- El **hashtag del proyecto** es: `project = "contratos-stands"`.
- Garantizado técnicamente por `default_tags` del provider AWS (todo recurso que soporte tags lo recibe automáticamente), además de la convención declarada en `terraform/AGENTS.md`.
- Tags completas:

  | Tag | Valores | Propósito |
  |---|---|---|
  | `project` | `contratos-stands` | **Hashtag** — identidad del proyecto |
  | `environment` | `qa` \| `prod` | Aisla entornos |
  | `component` | `network` \| `database` \| `storage` \| `secrets` \| `app` | Tipo de recurso |
  | `managed-by` | `terraform` | Solo recursos IaC |
  | `cost-center` | `eventos-iimp` | Centro de costos |

- El agente **SIEMPRE consulta el hashtag** antes de listar/modificar/destruir: solo opera recursos con `project=contratos-stands`. Nada más (en particular, **NUNCA** recursos de `montaje-integral`).

## R4. Cuentas AWS (separación por proyecto)

> "La cuenta de sistemas ya copó el máximo de cuota... lo ideal es una cuenta por proyecto."

| Perfil | Cuenta | Uso en ContratosStands |
|---|---|---|
| `sistemas-aws` | **`517839275515` (sistemas.iimp)** — user admin-aws-cli | ✅ **Cuenta de trabajo** del proyecto (misma decisión del dueño que montaje-integral) |
| `iimp-aws` | `463470959856` — user iimp-aws-cli | Alternativa (otra cuenta del IIMP); no usar sin aviso |
| `default` / `sara-aws-cli` | `564914947461` | ❌ No usar (cuenta de otro proyecto) |

- **Advertencia del LT**: la cuenta sistemas está cerca del tope de cuota de proyectos.
- **Ideal a futuro** (pendiente con el LT): crear cuenta dedicada anexada a la organización. Mientras tanto, todo vive en sistemas.iimp separado por el hashtag.

## R5. Estado remoto antes de prod

- Antes de cualquier despliegue en prod: backend remoto **S3 + DynamoDB (lock)** (`terraform/bootstrap/` aplicado una vez; el backend `s3` ya está declarado en `terraform/main.tf`).
- Nunca estado local compartido para prod.

## R6. Flujo de cambio de infraestructura

```
cambio en código → terraform fmt + validate → terraform plan (qa)
  → revisar diff (solo recursos con project=contratos-stands)
  → [qa] apply → [prod] autorización del usuario → apply
```

- Rollback: revisiones de imagen ECR (`image_tag`) y versionado del bucket.
- Cualquier duda con el LT: consultar antes de avanzar.
