# Bootstrap — estado remoto de Terraform (R5)
# Se aplica UNA vez (manual o por el guard del workflow). Estado local efímero:
# el workflow solo lo corre si el bucket NO existe (verificación por AWS CLI).
# Tags: hashtag del proyecto + component=state + environment=infra (transversal a qa/prod).

variable "aws_region" {
  description = "Region AWS"
  type        = string
  default     = "us-east-1"
}

variable "aws_profile" {
  description = "Perfil AWS CLI (R4). Vacio = usar env vars/chain (CI/CD)"
  type        = string
  default     = ""
}

variable "state_bucket_name" {
  description = "Nombre del bucket del estado remoto"
  type        = string
  default     = "iimp-contratos-stands-terraform-state"
}

variable "state_dynamodb_table" {
  description = "Tabla DynamoDB de lock del estado"
  type        = string
  default     = "iimp-contratos-stands-terraform-locks"
}

terraform {
  required_version = ">= 1.8"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile != "" ? var.aws_profile : null

  default_tags {
    tags = {
      project     = "contratos-stands"
      environment = "infra"
      managed-by  = "terraform"
      cost-center = "eventos-iimp"
    }
  }
}

resource "aws_s3_bucket" "state" {
  bucket = var.state_bucket_name

  tags = { component = "state" }
}

resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "state" {
  bucket = aws_s3_bucket.state.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "state" {
  bucket = aws_s3_bucket.state.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_dynamodb_table" "locks" {
  name         = var.state_dynamodb_table
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  tags = { component = "state" }
}
