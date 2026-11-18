# Módulo backups: protección de datos del proyecto (R3: component = storage)
#
# Contiene:
#   - AWS Backup diario del EFS de uploads (vault + plan + selección).
#   - Bucket S3 de dumps lógicos diarios de la BD (pg_dump).
#   - Tarea ECS programada (EventBridge) que genera el dump y lo sube al bucket.
#   - Alarma SNS/email cuando la tarea de backup falla.
#
# NO toca el servicio de la app: todo es aditivo (cero interrupción).

terraform {
  required_providers {
    aws = {
      source = "hashicorp/aws"
    }
  }
}

locals {
  tags = merge(var.common_tags, { component = "storage" })
  name = "iimp-ctrst-${var.environment}"

  cluster_arn = "arn:aws:ecs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:cluster/${var.cluster_name}"
}

data "aws_caller_identity" "current" {}

data "aws_region" "current" {}

# ── Alertas (SNS) ───────────────────────────────────────────────────────────
resource "aws_sns_topic" "backup_alerts" {
  name = "${local.name}-backup-alerts"

  tags = local.tags
}

resource "aws_sns_topic_subscription" "email" {
  count     = var.alert_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.backup_alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# ═══════════════════════════════════════════════════════════════════════════
# AWS Backup — EFS de uploads
# ═══════════════════════════════════════════════════════════════════════════

resource "aws_backup_vault" "main" {
  name = "${local.name}-vault"

  tags = local.tags
}

resource "aws_iam_role" "backup_service" {
  name = "${local.name}-backup-service-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "backup.amazonaws.com" }
    }]
  })

  tags = local.tags
}

resource "aws_iam_role_policy_attachment" "backup_service_backup" {
  role       = aws_iam_role.backup_service.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForBackup"
}

resource "aws_iam_role_policy_attachment" "backup_service_restore" {
  role       = aws_iam_role.backup_service.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForRestores"
}

resource "aws_backup_plan" "main" {
  name = "${local.name}-plan"

  rule {
    rule_name         = "diario"
    target_vault_name = aws_backup_vault.main.name
    schedule          = var.backup_schedule

    lifecycle {
      delete_after = var.backup_retention_days
    }
  }

  tags = local.tags
}

resource "aws_backup_selection" "efs" {
  name         = "${local.name}-efs-uploads"
  iam_role_arn = aws_iam_role.backup_service.arn
  plan_id      = aws_backup_plan.main.id
  resources    = [var.efs_arn]
}

# ═══════════════════════════════════════════════════════════════════════════
# Dumps lógicos diarios (pg_dump) → S3
# ═══════════════════════════════════════════════════════════════════════════

resource "aws_s3_bucket" "db_backups" {
  bucket = "${var.db_backup_bucket_prefix}-${var.environment}"

  tags = local.tags
}

resource "aws_s3_bucket_server_side_encryption_configuration" "db_backups" {
  bucket = aws_s3_bucket.db_backups.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "db_backups" {
  bucket = aws_s3_bucket.db_backups.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Rotación automática: el dump más antiguo se expira solo.
resource "aws_s3_bucket_lifecycle_configuration" "db_backups" {
  bucket = aws_s3_bucket.db_backups.id

  rule {
    id     = "expirar-dumps-antiguos"
    status = "Enabled"

    filter {}

    expiration {
      days = var.dump_expire_days
    }
  }
}

# ── Roles de la tarea de backup ─────────────────────────────────────────────
resource "aws_iam_role" "backup_task" {
  name = "${local.name}-db-backup-task"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })

  tags = local.tags
}

resource "aws_iam_policy" "backup_task" {
  name = "${local.name}-db-backup-task"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = [var.database_url_secret_arn]
      },
      {
        Effect   = "Allow"
        Action   = ["s3:PutObject"]
        Resource = ["${aws_s3_bucket.db_backups.arn}/*"]
      },
    ]
  })
}

resource "aws_iam_role_policy_attachment" "backup_task" {
  role       = aws_iam_role.backup_task.name
  policy_arn = aws_iam_policy.backup_task.arn
}

resource "aws_iam_role" "backup_exec" {
  name = "${local.name}-db-backup-exec"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })

  tags = local.tags
}

resource "aws_iam_role_policy_attachment" "backup_exec" {
  role       = aws_iam_role.backup_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# ── SG minimo: solo egreso (Aurora acepta el CIDR de la VPC) ────────────────
resource "aws_security_group" "backup" {
  name   = "${local.name}-db-backup-sg"
  vpc_id = var.vpc_id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.tags, { Name = "${local.name}-db-backup-sg" })
}

resource "aws_cloudwatch_log_group" "backup" {
  name              = "/ecs/${local.name}-db-backup"
  retention_in_days = var.log_retention_days

  tags = local.tags
}

# ── Task definition (imagen: docker/db-backup, tag gestionado por CI) ───────
resource "aws_ecs_task_definition" "db_backup" {
  family                   = "${local.name}-db-backup"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.backup_task_cpu
  memory                   = var.backup_task_memory

  execution_role_arn = aws_iam_role.backup_exec.arn
  task_role_arn      = aws_iam_role.backup_task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "ARM64"
  }

  container_definitions = jsonencode([
    {
      name  = "backup"
      image = "${var.ecr_repository_url}:${var.backup_image_tag}"

      environment = [
        { name = "BACKUP_BUCKET", value = aws_s3_bucket.db_backups.id },
        { name = "AWS_DEFAULT_REGION", value = data.aws_region.current.name },
      ]

      secrets = [
        { name = "DATABASE_URL", valueFrom = var.database_url_secret_arn },
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.backup.name
          "awslogs-region"        = data.aws_region.current.name
          "awslogs-stream-prefix" = "backup"
        }
      }
    },
  ])

  tags = local.tags
}

# ── Programación (EventBridge cron, UTC) ────────────────────────────────────
resource "aws_iam_role" "events" {
  name = "${local.name}-db-backup-events"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "events.amazonaws.com" }
    }]
  })

  tags = local.tags
}

resource "aws_iam_policy" "events" {
  name = "${local.name}-db-backup-events"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["ecs:RunTask"]
      Resource = [aws_ecs_task_definition.db_backup.arn]
      }, {
      Effect = "Allow"
      Action = ["iam:PassRole"]
      Resource = [
        aws_iam_role.backup_exec.arn,
        aws_iam_role.backup_task.arn,
      ]
    }]
  })
}

resource "aws_iam_role_policy_attachment" "events" {
  role       = aws_iam_role.events.name
  policy_arn = aws_iam_policy.events.arn
}

resource "aws_cloudwatch_event_rule" "backup_schedule" {
  name                = "${local.name}-db-backup-schedule"
  schedule_expression = var.dump_schedule_cron
  is_enabled          = var.dump_enabled

  tags = local.tags
}

resource "aws_cloudwatch_event_target" "backup" {
  rule     = aws_cloudwatch_event_rule.backup_schedule.name
  arn      = local.cluster_arn
  role_arn = aws_iam_role.events.arn

  ecs_target {
    task_definition_arn = aws_ecs_task_definition.db_backup.arn
    launch_type         = "FARGATE"

    network_configuration {
      subnets          = var.task_subnet_ids
      security_groups  = [aws_security_group.backup.id]
      assign_public_ip = var.assign_public_ip
    }
  }
}

# ── Alarma: la tarea de backup terminó mal → SNS ────────────────────────────
resource "aws_cloudwatch_event_rule" "backup_failed" {
  name        = "${local.name}-db-backup-failed"
  description = "Avisa por SNS cuando la tarea de pg_dump falla"

  event_pattern = jsonencode({
    source      = ["aws.ecs"]
    detail-type = ["ECS Task State Change"]
    detail = {
      clusterArn        = [local.cluster_arn]
      taskDefinitionArn = [aws_ecs_task_definition.db_backup.arn]
      lastStatus        = ["STOPPED"]
      stopCode          = ["EssentialContainerExited", "TaskFailedToStart"]
    }
  })

  tags = local.tags
}

resource "aws_cloudwatch_event_target" "backup_failed_sns" {
  rule      = aws_cloudwatch_event_rule.backup_failed.name
  arn       = aws_sns_topic.backup_alerts.arn
  target_id = "sns-backup-failed"
}

resource "aws_sns_topic_policy" "backup_alerts" {
  arn = aws_sns_topic.backup_alerts.arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "events.amazonaws.com" }
      Action    = "sns:Publish"
      Resource  = aws_sns_topic.backup_alerts.arn
    }]
  })
}

# ═══════════════════════════════════════════════════════════════════════════
# Variables
# ═══════════════════════════════════════════════════════════════════════════

variable "environment" {
  description = "Entorno (qa | prod)"
  type        = string
}

variable "aws_region" {
  description = "Region primaria"
  type        = string
}

variable "vpc_id" {
  description = "VPC del proyecto"
  type        = string
}

variable "task_subnet_ids" {
  description = "Subnets donde corre la tarea de backup"
  type        = list(string)
}

variable "assign_public_ip" {
  description = "Asignar IP publica a la tarea (true si no hay NAT)"
  type        = bool
}

variable "cluster_name" {
  description = "Nombre del cluster ECS donde corre la tarea"
  type        = string
}

variable "ecr_repository_url" {
  description = "URL del repositorio ECR (imagen db-backup)"
  type        = string
}

variable "backup_image_tag" {
  description = "Tag de la imagen de backup en ECR (lo pushea el CI)"
  type        = string
  default     = "db-backup"
}

variable "database_url_secret_arn" {
  description = "ARN del secreto DATABASE_URL (para pg_dump)"
  type        = string
}

variable "efs_arn" {
  description = "ARN del EFS de uploads (selección de AWS Backup)"
  type        = string
}

variable "backup_schedule" {
  description = "Cron de AWS Backup (UTC)"
  type        = string
  default     = "cron(0 2 * * ? *)"
}

variable "backup_retention_days" {
  description = "Dias de retencion de los recovery points de AWS Backup"
  type        = number
  default     = 35
}

variable "dump_schedule_cron" {
  description = "Cron de EventBridge para el pg_dump diario (UTC)"
  type        = string
  default     = "cron(30 3 * * ? *)"
}

variable "dump_enabled" {
  description = "Activar la tarea diaria de pg_dump"
  type        = bool
  default     = true
}

variable "db_backup_bucket_prefix" {
  description = "Prefijo del bucket de dumps (el entorno se agrega al final)"
  type        = string
  default     = "iimp-ctrst-db-backups"
}

variable "dump_expire_days" {
  description = "Dias tras los cuales el dump mas antiguo se expira (rotacion automatica)"
  type        = number
  default     = 90
}

variable "backup_task_cpu" {
  description = "CPU de la tarea de backup"
  type        = string
  default     = "256"
}

variable "backup_task_memory" {
  description = "Memoria de la tarea de backup (MB)"
  type        = string
  default     = "512"
}

variable "log_retention_days" {
  description = "Retencion de logs de la tarea de backup"
  type        = number
  default     = 30
}

variable "alert_email" {
  description = "Correo que recibe alertas de fallo de backup — vacio = sin suscripcion"
  type        = string
  default     = ""
}

variable "common_tags" {
  description = "Etiquetas base del proyecto (R3)"
  type        = map(string)
}
