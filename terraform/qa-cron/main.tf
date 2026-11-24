# Stack independiente del cron de facturas programadas para QA.
#
# QA NO se despliega con el stack principal (corre en una EC2 con docker, fuera de este
# Terraform). Este root crea SOLO el cron (EventBridge Scheduler) apuntando a la app de QA,
# con su propio estado (key qa-cron/terraform.tfstate): no puede tocar nada mas. (R3: project=contratos-stands)
#
# Uso (R4: perfil sistemas-aws):
#   terraform init -backend-config="bucket=iimp-contratos-stands-terraform-state" \
#     -backend-config="key=contratos-stands/qa-cron/terraform.tfstate" -backend-config="region=us-east-1" \
#     -backend-config="dynamodb_table=iimp-contratos-stands-terraform-locks"
#   TF_VAR_cron_secret=<CRON_SECRET de QA>  terraform plan -var-file=qa.tfvars

terraform {
  required_version = ">= 1.8"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {}
}

variable "environment" {
  description = "Ambiente"
  type        = string
  default     = "qa"
}

variable "aws_profile" {
  description = "Perfil AWS (R4: sistemas-aws)"
  type        = string
  default     = "sistemas-aws"
}

variable "aws_region" {
  description = "Region AWS"
  type        = string
  default     = "us-east-1"
}

variable "app_domain" {
  description = "Dominio publico de la app de QA"
  type        = string
}

variable "cron_secret" {
  description = "CRON_SECRET de la app de QA (env-file /opt/ctrst-qa/app.env)"
  type        = string
  sensitive   = true
}

variable "cron_facturacion_schedule" {
  description = "Frecuencia del cron"
  type        = string
  default     = "rate(1 minute)"
}

locals {
  common_tags = {
    project       = "contratos-stands"
    environment   = var.environment
    "managed-by"  = "terraform"
    "cost-center" = "eventos-iimp"
  }
}

provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile

  default_tags {
    tags = local.common_tags
  }
}

module "cron_facturacion" {
  source = "../modules/cron_facturacion"

  environment         = var.environment
  app_domain          = var.app_domain
  enabled             = true
  cron_secret         = var.cron_secret
  schedule_expression = var.cron_facturacion_schedule
  # QA no tiene topic SNS del stack: sin alarma.
  alarm_topic_arn = ""

  common_tags = local.common_tags
}

output "schedule_name" {
  value = module.cron_facturacion.schedule_name
}
