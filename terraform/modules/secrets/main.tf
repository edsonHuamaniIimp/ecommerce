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

output "secret_arns" {
  description = "ARNs de los secretos existentes (para la task definition)"
  value = merge(
    {
      database_url = aws_secretsmanager_secret.database_url.arn
      jwt_secret   = aws_secretsmanager_secret.jwt_secret.arn
    },
    var.sunat_api_token != "" ? { sunat_api_token = aws_secretsmanager_secret.sunat_api_token[0].arn } : {},
    var.resend_api_key != "" ? { resend_api_key = aws_secretsmanager_secret.resend_api_key[0].arn } : {},
  )
}

variable "common_tags" {
  description = "Etiquetas base del proyecto (R3): project, environment, managed-by, cost-center"
  type        = map(string)
}
