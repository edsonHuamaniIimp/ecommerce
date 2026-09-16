# Módulo storage: bucket S3 de documentos (SSE-S3, privado, versioning + lifecycle)
# R3: hashtag base por default_tags del provider; aquí solo component.

variable "environment" {
  description = "Entorno (qa | prod)"
  type        = string
}

variable "bucket_name_prefix" {
  description = "Prefijo del bucket (R2: variable, no hardcodeado)"
  type        = string
}

variable "intelligent_tiering_days" {
  description = "Dias para transicionar a Intelligent-Tiering (0 = desactivado)"
  type        = number
}

variable "noncurrent_version_expiration_days" {
  description = "Dias para expirar versiones no actuales (evita acumulacion silenciosa)"
  type        = number
}

locals {
  tags = merge(var.common_tags, { component = "storage" })
}

resource "aws_s3_bucket" "documentos" {
  bucket = "${var.bucket_name_prefix}-${var.environment}"

  tags = local.tags
}

resource "aws_s3_bucket_server_side_encryption_configuration" "documentos" {
  bucket = aws_s3_bucket.documentos.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "documentos" {
  bucket = aws_s3_bucket.documentos.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "documentos" {
  bucket = aws_s3_bucket.documentos.id

  versioning_configuration {
    status = "Enabled"
  }
}

# ── Lifecycle: controla el crecimiento de costo y de versiones ──────────────
resource "aws_s3_bucket_lifecycle_configuration" "documentos" {
  bucket = aws_s3_bucket.documentos.id

  # Versiones antiguas: se expiran (si no, se acumulan silenciosamente)
  rule {
    id     = "expirar-versiones-antiguas"
    status = "Enabled"

    filter {}

    noncurrent_version_expiration {
      noncurrent_days = var.noncurrent_version_expiration_days
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }

  # Documentos viejos: pasan a Intelligent-Tiering (auto-optimiza el costo)
  dynamic "rule" {
    for_each = var.intelligent_tiering_days > 0 ? [1] : []
    content {
      id     = "intelligent-tiering"
      status = "Enabled"

      filter {}

      transition {
        days          = var.intelligent_tiering_days
        storage_class = "INTELLIGENT_TIERING"
      }
    }
  }
}

output "bucket_name" {
  description = "Nombre del bucket (S3_BUCKET del .env)"
  value       = aws_s3_bucket.documentos.id
}

output "bucket_arn" {
  description = "ARN del bucket"
  value       = aws_s3_bucket.documentos.arn
}

variable "common_tags" {
  description = "Etiquetas base del proyecto (R3): project, environment, managed-by, cost-center"
  type        = map(string)
}
