# ─────────────────────────────────────────────────────────────────────────────
# ContratosStands — Infraestructura AWS (ECS Fargate + Aurora Serverless v2 + CloudFront/WAF)
# DECISIÓN: docs/01-despliegue/arquitectura-aws.md (v5, Opción 1)
# REGLAS OBLIGATORIAS: docs/01-despliegue/REGLAS-DESPLIEGUE.md
# - R1: prod solo con autorización explícita del usuario
# - R2: TODO con variables, nada hardcodeado
# - R3: hashtag del proyecto = tag `project=contratos-stands` (default_tags)
# - R4: cuenta de trabajo sistemas-aws (sistemas.iimp 517839275515)
# - R5: backend remoto S3+DynamoDB antes de prod
# ─────────────────────────────────────────────────────────────────────────────

terraform {
  required_version = ">= 1.8"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # R5 — Estado remoto S3 + DynamoDB (lock). El backend s3 NO admite variables:
  # se configura por -backend-config (init del CI/CD y de uso local).
  # Requisito: terraform/bootstrap aplicado una vez.
  backend "s3" {}
}

locals {
  # R3 — Etiquetas base OBLIGATORIAS. Se pasan EXPLÍCITAMENTE a cada módulo para que
  # sean visibles y auditables en el plan (el default_tags del provider no se muestra
  # en el plan de recursos nuevos y rompería la revisión del diff que exige R6).
  common_tags = {
    project       = "contratos-stands"
    environment   = var.environment
    "managed-by"  = "terraform"
    "cost-center" = "eventos-iimp"
  }
}

provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile != "" ? var.aws_profile : null

  # R3 — Hashtag del proyecto: TODO recurso que soporte tags las recibe.
  default_tags {
    tags = {
      project     = "contratos-stands"
      environment = var.environment
      managed-by  = "terraform"
      cost-center = "eventos-iimp"
    }
  }
}

# CloudFront, WAF y los certificados para CloudFront EXIGEN us-east-1
provider "aws" {
  alias   = "us_east_1"
  region  = "us-east-1"
  profile = var.aws_profile != "" ? var.aws_profile : null

  default_tags {
    tags = {
      project     = "contratos-stands"
      environment = var.environment
      managed-by  = "terraform"
      cost-center = "eventos-iimp"
    }
  }
}

# ── Certificado TLS (ACM en us-east-1) ──────────────────────────────────────
module "acm" {
  source = "./modules/acm"

  providers = {
    aws = aws.us_east_1
  }

  app_domain      = var.app_domain
  route53_zone_id = var.route53_zone_id

  common_tags = local.common_tags
}

# ── Red ─────────────────────────────────────────────────────────────────────
module "network" {
  source = "./modules/network"

  environment        = var.environment
  aws_region         = var.aws_region
  vpc_cidr           = var.vpc_cidr
  enable_nat_gateway = var.enable_nat_gateway
  az_count           = var.az_count

  common_tags = local.common_tags
}

# ── Base de datos (Aurora Serverless v2) ────────────────────────────────────
module "aurora" {
  source = "./modules/aurora"

  environment              = var.environment
  vpc_id                   = module.network.vpc_id
  private_subnet_ids       = module.network.private_subnet_ids
  vpc_cidr                 = var.vpc_cidr
  db_name                  = var.db_name
  db_username              = var.db_username
  engine_version           = var.aurora_engine_version
  min_acu                  = var.aurora_min_acu
  max_acu                  = var.aurora_max_acu
  seconds_until_auto_pause = var.aurora_seconds_until_auto_pause
  instance_class           = var.aurora_instance_class
  instance_count           = var.aurora_instance_count
  backup_retention_period  = var.environment == "prod" ? var.db_backup_retention_days_prod : var.db_backup_retention_days_qa

  common_tags = local.common_tags
}

# ── Almacenamiento (S3 documentos) ──────────────────────────────────────────
module "storage" {
  source = "./modules/storage"

  environment                        = var.environment
  bucket_name_prefix                 = var.bucket_name_prefix
  intelligent_tiering_days           = var.s3_intelligent_tiering_days
  noncurrent_version_expiration_days = var.s3_noncurrent_version_expiration_days

  common_tags = local.common_tags
}

# ── Uploads (EFS mientras la subida a S3 no sea prefirmada) ─────────────────
module "uploads" {
  source = "./modules/uploads"

  environment           = var.environment
  vpc_id                = module.network.vpc_id
  subnet_ids            = var.enable_nat_gateway ? module.network.private_subnet_ids : module.network.public_subnet_ids
  vpc_cidr              = var.vpc_cidr
  posix_uid             = var.uploads_posix_uid
  posix_gid             = var.uploads_posix_gid
  transition_to_ia_days = var.uploads_transition_to_ia_days
  mount_target_count    = var.uploads_mount_target_count

  common_tags = local.common_tags
}

# ── Secretos ────────────────────────────────────────────────────────────────
module "secrets" {
  source = "./modules/secrets"

  environment         = var.environment
  db_endpoint         = module.aurora.endpoint
  db_username         = module.aurora.username
  db_password         = module.aurora.password
  db_name             = module.aurora.database_name
  sunat_api_token     = var.sunat_api_token
  resend_api_key      = var.resend_api_key
  kbservicios_api_key = var.kbservicios_api_key
  niubizz_user        = var.niubizz_user
  niubizz_password    = var.niubizz_password
  iimp_proxy_pass     = var.iimp_proxy_pass
  integracion_api_key = var.integracion_api_key

  common_tags = local.common_tags
}

# ── Aplicación (ECR + ALB + ECS Fargate ARM64) ──────────────────────────────
module "ecs" {
  source = "./modules/ecs"

  environment         = var.environment
  vpc_id              = module.network.vpc_id
  public_subnet_ids   = module.network.public_subnet_ids
  private_subnet_ids  = module.network.private_subnet_ids
  enable_nat_gateway  = var.enable_nat_gateway
  secret_arns         = module.secrets.secret_arns
  bucket_arn          = module.storage.bucket_arn
  s3_bucket           = module.storage.bucket_name
  efs_file_system_id  = module.uploads.file_system_id
  efs_access_point_id = module.uploads.access_point_id
  uploads_backend     = var.uploads_backend
  planogess_api_url   = var.planogess_api_url
  kbservicios_url     = var.kbservicios_url
  auspicios_api_url   = var.auspicios_api_url
  admin_email         = var.admin_email
  niubizz_merchant_id = var.niubizz_merchant_id
  niubizz_url_api     = var.niubizz_url_api
  niubizz_url_js      = var.niubizz_url_js
  iimp_proxy_url      = var.iimp_proxy_url
  iimp_proxy_ip       = var.iimp_proxy_ip
  public_api_url      = var.public_api_url
  app_domain          = var.app_domain
  certificate_arn     = module.acm.certificate_arn
  enable_https        = var.enable_https
  # El redirect 80→443 solo si NO hay CloudFront delante (evita el loop de redirecciones)
  http_redirect_to_https         = var.enable_https && !var.enable_cloudfront
  restrict_alb_to_cloudfront     = var.restrict_alb_to_cloudfront
  ecr_repository_name            = var.ecr_repository_name
  ecr_keep_last_images           = var.ecr_keep_last_images
  image_tag                      = var.image_tag
  container_port                 = var.container_port
  task_cpu                       = var.task_cpu
  task_memory                    = var.task_memory
  enable_fargate_spot            = var.enable_fargate_spot
  fargate_spot_weight            = var.fargate_spot_weight
  desired_min_capacity           = var.desired_min_capacity
  desired_max_capacity           = var.desired_max_capacity
  desired_count_prod             = var.desired_count_prod
  desired_count_qa               = var.desired_count_qa
  autoscale_cpu_target           = var.autoscale_cpu_target
  autoscale_request_count_target = var.autoscale_request_count_target
  alb_health_check_path          = var.alb_health_check_path
  alb_health_check_interval      = var.alb_health_check_interval
  alb_health_check_timeout       = var.alb_health_check_timeout
  alb_healthy_threshold          = var.alb_healthy_threshold
  alb_unhealthy_threshold        = var.alb_unhealthy_threshold
  alb_deregistration_delay       = var.alb_deregistration_delay
  scale_in_cooldown              = var.scale_in_cooldown
  scale_out_cooldown             = var.scale_out_cooldown
  log_retention_days             = var.log_retention_days
  scheduled_scalings             = var.scheduled_scalings

  common_tags = local.common_tags
}

# ── CDN + WAF (us-east-1) ───────────────────────────────────────────────────
module "cloudfront" {
  source = "./modules/cloudfront"

  providers = {
    aws = aws.us_east_1
  }

  environment         = var.environment
  app_domain          = var.app_domain
  certificate_arn     = module.acm.certificate_arn
  alb_dns_name        = module.ecs.alb_dns_name
  enable_waf          = var.enable_waf
  waf_rate_limit      = var.waf_rate_limit
  route53_zone_id     = var.route53_zone_id
  static_ttl_seconds  = var.cdn_static_ttl_seconds
  uploads_ttl_seconds = var.cdn_uploads_ttl_seconds

  common_tags = local.common_tags
}

# ── Observabilidad + presupuesto ────────────────────────────────────────────
module "observability" {
  source = "./modules/observability"

  environment                  = var.environment
  alb_arn_suffix               = module.ecs.alb_arn_suffix
  target_group_arn_suffix      = module.ecs.target_group_arn_suffix
  ecs_cluster_name             = module.ecs.cluster_name
  ecs_service_name             = module.ecs.service_name
  aurora_cluster_identifier    = module.aurora.cluster_identifier
  alarm_5xx_threshold          = var.alarm_5xx_threshold
  alarm_latency_target_seconds = var.alarm_latency_target_seconds
  alarm_email                  = var.budget_alert_email
  budget_amount_usd            = var.budget_amount_usd
  budget_alert_email           = var.budget_alert_email
  budget_alert_percentages     = var.budget_alert_percentages

  common_tags = local.common_tags
}
