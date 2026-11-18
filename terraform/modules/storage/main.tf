# Módulo storage: bucket S3 de documentos (SSE-S3, privado, versioning + lifecycle)
# R3: hashtag base por default_tags del provider; aquí solo component.
# Backups: replicación cross-region (CRR) de los documentos a us-east-2.

terraform {
  required_providers {
    aws = {
      source                = "hashicorp/aws"
      configuration_aliases = [aws.dr]
    }
  }
}

variable "environment" {
  description = "Entorno (qa | prod)"
  type        = string
}

variable "enable_crr" {
  description = "Replicar los documentos a la region DR (us-east-2). Backup real de los documentos."
  type        = bool
  default     = true
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

# ── Backup: replicación cross-region de los documentos (CRR) ────────────────
# Copia continua de los documentos a us-east-2. Si se pierde la region
# primaria (o se borra el bucket), los documentos siguen existiendo en DR.

resource "aws_s3_bucket" "documentos_dr" {
  count    = var.enable_crr ? 1 : 0
  provider = aws.dr

  bucket = "${var.bucket_name_prefix}-${var.environment}-dr"

  tags = local.tags
}

resource "aws_s3_bucket_server_side_encryption_configuration" "documentos_dr" {
  count    = var.enable_crr ? 1 : 0
  provider = aws.dr
  bucket   = aws_s3_bucket.documentos_dr[0].id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "documentos_dr" {
  count    = var.enable_crr ? 1 : 0
  provider = aws.dr
  bucket   = aws_s3_bucket.documentos_dr[0].id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "documentos_dr" {
  count    = var.enable_crr ? 1 : 0
  provider = aws.dr
  bucket   = aws_s3_bucket.documentos_dr[0].id

  versioning_configuration {
    status = "Enabled"
  }
}

# Rol de replicación (permisos minimos: leer versiones del origen, escribir destino)
resource "aws_iam_role" "replication" {
  count = var.enable_crr ? 1 : 0
  name  = "${var.bucket_name_prefix}-${var.environment}-replication"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "s3.amazonaws.com" }
    }]
  })

  tags = local.tags
}

resource "aws_iam_policy" "replication" {
  count = var.enable_crr ? 1 : 0
  name  = "${var.bucket_name_prefix}-${var.environment}-replication"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetReplicationConfiguration",
          "s3:ListBucket",
        ]
        Resource = [aws_s3_bucket.documentos.arn]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObjectVersionForReplication",
          "s3:GetObjectVersionAcl",
          "s3:GetObjectVersionTagging",
        ]
        Resource = ["${aws_s3_bucket.documentos.arn}/*"]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ReplicateObject",
          "s3:ReplicateDelete",
          "s3:ReplicateTags",
        ]
        Resource = ["${aws_s3_bucket.documentos_dr[0].arn}/*"]
      },
    ]
  })
}

resource "aws_iam_role_policy_attachment" "replication" {
  count      = var.enable_crr ? 1 : 0
  role       = aws_iam_role.replication[0].name
  policy_arn = aws_iam_policy.replication[0].arn
}

resource "aws_s3_bucket_replication_configuration" "documentos" {
  count  = var.enable_crr ? 1 : 0
  bucket = aws_s3_bucket.documentos.id
  role   = aws_iam_role.replication[0].arn

  rule {
    id     = "crr-documentos-dr"
    status = "Enabled"

    filter {}

    destination {
      bucket        = aws_s3_bucket.documentos_dr[0].arn
      storage_class = "STANDARD"
    }

    delete_marker_replication {
      status = "Enabled"
    }

    existing_object_replication {
      status = "Enabled"
    }
  }
}

output "bucket_name_dr" {
  description = "Nombre del bucket DR en us-east-2 (replica de los documentos)"
  value       = var.enable_crr ? aws_s3_bucket.documentos_dr[0].id : ""
}

variable "common_tags" {
  description = "Etiquetas base del proyecto (R3): project, environment, managed-by, cost-center"
  type        = map(string)
}
