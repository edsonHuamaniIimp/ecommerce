# Módulo secrets: Secrets Manager con los secretos de la aplicación
# R3: hashtag base por default_tags del provider; aquí solo component.
# Los secretos opcionales (integraciones) solo se crean si su valor viene no vacío.

variable "environment" {
  description = "Entorno (qa | prod)"
  type        = string
}

variable "db_endpoint" {
  description = "Endpoint del RDS"
  type        = string
}

variable "db_username" {
  description = "Usuario master del RDS"
  type        = string
}

variable "db_password" {
  description = "Password master del RDS"
  type        = string
  sensitive   = true
}

variable "db_name" {
  description = "Nombre de la BD"
  type        = string
}

variable "sunat_api_token" {
  description = "Token SUNAT/RENIEC (R2) — vacío = no crear"
  type        = string
  default     = ""
  sensitive   = true
}

variable "resend_api_key" {
  description = "API key de Resend (correos transaccionales) (R2) — vacio = no crear"
  type        = string
  default     = ""
  sensitive   = true
}

variable "kbservicios_api_key" {
  description = "API key de KBServicios (R2) — vacio = no crear"
  type        = string
  default     = ""
  sensitive   = true
}

variable "niubizz_user" {
  description = "Usuario de Niubiz (R2) — vacio = no crear"
  type        = string
  default     = ""
  sensitive   = true
}

variable "niubizz_password" {
  description = "Password de Niubiz (R2) — vacio = no crear"
  type        = string
  default     = ""
  sensitive   = true
}

variable "iimp_proxy_pass" {
  description = "Password del proxy IIMP (R2) — vacio = no crear"
  type        = string
  default     = ""
  sensitive   = true
}

variable "integracion_api_key" {
  description = "Clave M2M con el sistema de montaje (R2) — vacio = no crear"
  type        = string
  default     = ""
  sensitive   = true
}

variable "cron_secret" {
  description = "Secreto del cron de reconciliacion SGC (header x-cron-secret) — vacio = no crear"
  type        = string
  default     = ""
  sensitive   = true
}

variable "sgc_api_key" {
  description = "Bearer del API del SGC (rol contract-manager) — vacio = no crear"
  type        = string
  default     = ""
  sensitive   = true
}

variable "sgc_webhook_secret" {
  description = "Secreto HMAC de webhooks del SGC — vacio = no crear"
  type        = string
  default     = ""
  sensitive   = true
}

variable "liststand_usuario" {
  description = "Usuario de la cuenta tecnica del API de stands del IIMP (liststand, acceso VTA) (R2) — vacio = no crear"
  type        = string
  default     = ""
  sensitive   = true
}

variable "liststand_clave" {
  description = "Clave de la cuenta tecnica del API de stands del IIMP (liststand, acceso VTA) (R2) — vacio = no crear"
  type        = string
  default     = ""
  sensitive   = true
}

variable "personas_api_usuario" {
  description = "Usuario de la cuenta tecnica de servicio-persona (rol ESCRITURA) (R2) — vacio = no crear"
  type        = string
  default     = ""
  sensitive   = true
}

variable "personas_api_clave" {
  description = "Clave de la cuenta tecnica de servicio-persona (R2) — vacio = no crear"
  type        = string
  default     = ""
  sensitive   = true
}

locals {
  tags = merge(var.common_tags, { component = "secrets" })
  name = "iimp-ctrst-${var.environment}"
}

# ── DATABASE_URL (Prisma) ───────────────────────────────────────────────────
resource "aws_secretsmanager_secret" "database_url" {
  name = "${local.name}-database-url"
  tags = local.tags
}

resource "aws_secretsmanager_secret_version" "database_url" {
  secret_id = aws_secretsmanager_secret.database_url.id
  secret_string = format(
    "postgresql://%s:%s@%s:5432/%s?schema=public",
    var.db_username,
    var.db_password,
    var.db_endpoint,
    var.db_name,
  )
}

# ── JWT_SECRET (sesión/roles) ───────────────────────────────────────────────
resource "aws_secretsmanager_secret" "jwt_secret" {
  name = "${local.name}-jwt-secret"
  tags = local.tags
}

resource "aws_secretsmanager_secret_version" "jwt_secret" {
  secret_id     = aws_secretsmanager_secret.jwt_secret.id
  secret_string = random_password.jwt.result
}

resource "random_password" "jwt" {
  length  = 64
  special = true
}

# ── SUNAT_API_TOKEN (solo si viene valor) ───────────────────────────────────
resource "aws_secretsmanager_secret" "sunat_api_token" {
  count = var.sunat_api_token != "" ? 1 : 0
  name  = "${local.name}-sunat-api-token"
  tags  = local.tags
}

resource "aws_secretsmanager_secret_version" "sunat_api_token" {
  count         = var.sunat_api_token != "" ? 1 : 0
  secret_id     = aws_secretsmanager_secret.sunat_api_token[0].id
  secret_string = var.sunat_api_token
}

# ── Resend (correos) ────────────────────────────────────────────────────────
resource "aws_secretsmanager_secret" "resend_api_key" {
  count = var.resend_api_key != "" ? 1 : 0
  name  = "${local.name}-resend-api-key"
  tags  = local.tags
}

resource "aws_secretsmanager_secret_version" "resend_api_key" {
  count         = var.resend_api_key != "" ? 1 : 0
  secret_id     = aws_secretsmanager_secret.resend_api_key[0].id
  secret_string = var.resend_api_key
}

# ── KBServicios (auspicios) ─────────────────────────────────────────────────
resource "aws_secretsmanager_secret" "kbservicios_api_key" {
  count = var.kbservicios_api_key != "" ? 1 : 0
  name  = "${local.name}-kbservicios-api-key"
  tags  = local.tags
}

resource "aws_secretsmanager_secret_version" "kbservicios_api_key" {
  count         = var.kbservicios_api_key != "" ? 1 : 0
  secret_id     = aws_secretsmanager_secret.kbservicios_api_key[0].id
  secret_string = var.kbservicios_api_key
}

# ── Niubiz (pasarela de pagos) ──────────────────────────────────────────────
resource "aws_secretsmanager_secret" "niubizz_user" {
  count = var.niubizz_user != "" ? 1 : 0
  name  = "${local.name}-niubizz-user"
  tags  = local.tags
}

resource "aws_secretsmanager_secret_version" "niubizz_user" {
  count         = var.niubizz_user != "" ? 1 : 0
  secret_id     = aws_secretsmanager_secret.niubizz_user[0].id
  secret_string = var.niubizz_user
}

resource "aws_secretsmanager_secret" "niubizz_password" {
  count = var.niubizz_password != "" ? 1 : 0
  name  = "${local.name}-niubizz-password"
  tags  = local.tags
}

resource "aws_secretsmanager_secret_version" "niubizz_password" {
  count         = var.niubizz_password != "" ? 1 : 0
  secret_id     = aws_secretsmanager_secret.niubizz_password[0].id
  secret_string = var.niubizz_password
}

# ── Proxy IIMP ──────────────────────────────────────────────────────────────
resource "aws_secretsmanager_secret" "iimp_proxy_pass" {
  count = var.iimp_proxy_pass != "" ? 1 : 0
  name  = "${local.name}-iimp-proxy-pass"
  tags  = local.tags
}

resource "aws_secretsmanager_secret_version" "iimp_proxy_pass" {
  count         = var.iimp_proxy_pass != "" ? 1 : 0
  secret_id     = aws_secretsmanager_secret.iimp_proxy_pass[0].id
  secret_string = var.iimp_proxy_pass
}

# ── Clave M2M con montaje ───────────────────────────────────────────────────
resource "aws_secretsmanager_secret" "integracion_api_key" {
  count = var.integracion_api_key != "" ? 1 : 0
  name  = "${local.name}-integracion-api-key"
  tags  = local.tags
}

resource "aws_secretsmanager_secret_version" "integracion_api_key" {
  count         = var.integracion_api_key != "" ? 1 : 0
  secret_id     = aws_secretsmanager_secret.integracion_api_key[0].id
  secret_string = var.integracion_api_key
}

# ── API de stands del IIMP (liststand, Vinculacion) ─────────────────────────
resource "aws_secretsmanager_secret" "liststand_usuario" {
  count = var.liststand_usuario != "" ? 1 : 0
  name  = "${local.name}-liststand-usuario"
  tags  = local.tags
}

resource "aws_secretsmanager_secret_version" "liststand_usuario" {
  count         = var.liststand_usuario != "" ? 1 : 0
  secret_id     = aws_secretsmanager_secret.liststand_usuario[0].id
  secret_string = var.liststand_usuario
}

resource "aws_secretsmanager_secret" "liststand_clave" {
  count = var.liststand_clave != "" ? 1 : 0
  name  = "${local.name}-liststand-clave"
  tags  = local.tags
}

resource "aws_secretsmanager_secret_version" "liststand_clave" {
  count         = var.liststand_clave != "" ? 1 : 0
  secret_id     = aws_secretsmanager_secret.liststand_clave[0].id
  secret_string = var.liststand_clave
}

# ── servicio-persona (personas del ecosistema IIMP) ─────────────────────────
resource "aws_secretsmanager_secret" "personas_api_usuario" {
  count = var.personas_api_usuario != "" ? 1 : 0
  name  = "${local.name}-personas-api-usuario"
  tags  = local.tags
}

resource "aws_secretsmanager_secret_version" "personas_api_usuario" {
  count         = var.personas_api_usuario != "" ? 1 : 0
  secret_id     = aws_secretsmanager_secret.personas_api_usuario[0].id
  secret_string = var.personas_api_usuario
}

resource "aws_secretsmanager_secret" "personas_api_clave" {
  count = var.personas_api_clave != "" ? 1 : 0
  name  = "${local.name}-personas-api-clave"
  tags  = local.tags
}

resource "aws_secretsmanager_secret_version" "personas_api_clave" {
  count         = var.personas_api_clave != "" ? 1 : 0
  secret_id     = aws_secretsmanager_secret.personas_api_clave[0].id
  secret_string = var.personas_api_clave
}

# -- SGC / cron de reconciliacion --------------------------------------------
resource "aws_secretsmanager_secret" "cron_secret" {
  count = var.cron_secret != "" ? 1 : 0
  name  = "${local.name}-cron-secret"
  tags  = local.tags
}

resource "aws_secretsmanager_secret_version" "cron_secret" {
  count         = var.cron_secret != "" ? 1 : 0
  secret_id     = aws_secretsmanager_secret.cron_secret[0].id
  secret_string = var.cron_secret
}

resource "aws_secretsmanager_secret" "sgc_api_key" {
  count = var.sgc_api_key != "" ? 1 : 0
  name  = "${local.name}-sgc-api-key"
  tags  = local.tags
}

resource "aws_secretsmanager_secret_version" "sgc_api_key" {
  count         = var.sgc_api_key != "" ? 1 : 0
  secret_id     = aws_secretsmanager_secret.sgc_api_key[0].id
  secret_string = var.sgc_api_key
}

resource "aws_secretsmanager_secret" "sgc_webhook_secret" {
  count = var.sgc_webhook_secret != "" ? 1 : 0
  name  = "${local.name}-sgc-webhook-secret"
  tags  = local.tags
}

resource "aws_secretsmanager_secret_version" "sgc_webhook_secret" {
  count         = var.sgc_webhook_secret != "" ? 1 : 0
  secret_id     = aws_secretsmanager_secret.sgc_webhook_secret[0].id
  secret_string = var.sgc_webhook_secret
}

output "secret_arns" {
  description = "ARNs de los secretos existentes (para la task definition)"
  value = merge(
    {
      database_url = aws_secretsmanager_secret.database_url.arn
      jwt_secret   = aws_secretsmanager_secret.jwt_secret.arn
    },
    var.sunat_api_token != "" ? { sunat_api_token = aws_secretsmanager_secret.sunat_api_token[0].arn } : {},
    var.resend_api_key != "" ? { resend_api_key = aws_secretsmanager_secret.resend_api_key[0].arn } : {},
    var.kbservicios_api_key != "" ? { kbservicios_api_key = aws_secretsmanager_secret.kbservicios_api_key[0].arn } : {},
    var.niubizz_user != "" ? { niubizz_user = aws_secretsmanager_secret.niubizz_user[0].arn } : {},
    var.niubizz_password != "" ? { niubizz_password = aws_secretsmanager_secret.niubizz_password[0].arn } : {},
    var.iimp_proxy_pass != "" ? { iimp_proxy_pass = aws_secretsmanager_secret.iimp_proxy_pass[0].arn } : {},
    var.integracion_api_key != "" ? { integracion_api_key = aws_secretsmanager_secret.integracion_api_key[0].arn } : {},
    var.liststand_usuario != "" ? { liststand_usuario = aws_secretsmanager_secret.liststand_usuario[0].arn } : {},
    var.liststand_clave != "" ? { liststand_clave = aws_secretsmanager_secret.liststand_clave[0].arn } : {},
    var.personas_api_usuario != "" ? { personas_api_usuario = aws_secretsmanager_secret.personas_api_usuario[0].arn } : {},
    var.personas_api_clave != "" ? { personas_api_clave = aws_secretsmanager_secret.personas_api_clave[0].arn } : {},
    var.cron_secret != "" ? { cron_secret = aws_secretsmanager_secret.cron_secret[0].arn } : {},
    var.sgc_api_key != "" ? { sgc_api_key = aws_secretsmanager_secret.sgc_api_key[0].arn } : {},
    var.sgc_webhook_secret != "" ? { sgc_webhook_secret = aws_secretsmanager_secret.sgc_webhook_secret[0].arn } : {},
  )
}

variable "common_tags" {
  description = "Etiquetas base del proyecto (R3): project, environment, managed-by, cost-center"
  type        = map(string)
}
