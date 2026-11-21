# Modulo contract_async: cola, estado de jobs, worker ECS y bandera runtime.
# R2: toda configuracion por variable. R3: tags completas; component=app.
# No modifica el servicio web existente ni el esquema de Aurora.

variable "environment" {
  description = "Entorno (qa | prod)"
  type        = string
}

variable "common_tags" {
  description = "Etiquetas base del proyecto (R3)"
  type        = map(string)
}

variable "vpc_id" {
  description = "VPC donde corre el worker"
  type        = string
}

variable "subnet_ids" {
  description = "Subnets para el worker (privadas con NAT o publicas con IP publica)"
  type        = list(string)
}

variable "assign_public_ip" {
  description = "Asignar IP publica al worker (true cuando no hay NAT)"
  type        = bool
}

variable "bucket_name" {
  description = "Bucket S3 de documentos"
  type        = string
}

variable "bucket_arn" {
  description = "ARN del bucket S3 de documentos"
  type        = string
}

variable "database_secret_arn" {
  description = "ARN del secreto DATABASE_URL"
  type        = string
}

variable "alarm_topic_arn" {
  description = "ARN del topico SNS de alarmas (vacio = sin notificacion)"
  type        = string
  default     = ""
}

variable "worker_enabled" {
  description = "Crear task definition/servicio del worker (false hasta publicar la imagen)"
  type        = bool
  default     = false
}

variable "worker_image_tag" {
  description = "Tag de la imagen del worker en ECR"
  type        = string
  default     = "bootstrap"
}

variable "worker_ecr_repository_name" {
  description = "Nombre del repositorio ECR del worker"
  type        = string
  default     = "iimp-contratos-stands-contract-worker"
}

variable "worker_cpu" {
  description = "CPU de la tarea del worker (unidades Fargate; 2048 = 2 vCPU)"
  type        = string
  default     = "2048"
}

variable "worker_cpu_architecture" {
  description = "Arquitectura de la imagen/tarea del worker: X86_64 o ARM64"
  type        = string
  default     = "X86_64"

  validation {
    condition     = contains(["X86_64", "ARM64"], var.worker_cpu_architecture)
    error_message = "worker_cpu_architecture debe ser X86_64 o ARM64."
  }
}

variable "worker_memory" {
  description = "Memoria de la tarea del worker en MB"
  type        = string
  default     = "4096"
}

variable "worker_base_capacity" {
  description = "Tareas base on-demand del worker (0 = sin base fija)"
  type        = number
  default     = 0
}

variable "worker_desired_count" {
  description = "Tareas deseadas del worker al crear el servicio"
  type        = number
  default     = 0
}

variable "worker_min_capacity" {
  description = "Minimo de tareas del autoscaling del worker"
  type        = number
  default     = 0
}

variable "worker_max_capacity" {
  description = "Maximo de tareas del autoscaling del worker"
  type        = number
  default     = 20
}

variable "worker_sqs_target_value" {
  description = "Mensajes visibles por tarea objetivo para autoscaling"
  type        = number
  default     = 5
}

variable "worker_enable_spot" {
  description = "Usar FARGATE_SPOT para overflow del worker"
  type        = bool
  default     = true
}

variable "worker_spot_weight" {
  description = "Peso de FARGATE_SPOT en el worker"
  type        = number
  default     = 3
}

variable "worker_log_retention_days" {
  description = "Retencion de logs CloudWatch del worker"
  type        = number
  default     = 30
}

variable "worker_concurrency" {
  description = "Mensajes/conversiones simultaneas por tarea"
  type        = number
  default     = 2
}

variable "pdf_concurrency" {
  description = "Conversiones LibreOffice simultaneas por tarea"
  type        = number
  default     = 1
}

variable "queue_visibility_timeout" {
  description = "Timeout de visibilidad SQS en segundos"
  type        = number
  default     = 900
}

variable "queue_message_retention_seconds" {
  description = "Retencion de mensajes SQS en segundos"
  type        = number
  default     = 345600
}

variable "queue_max_receive_count" {
  description = "Intentos antes de enviar a DLQ"
  type        = number
  default     = 3
}

variable "s3_prefix" {
  description = "Prefijo S3 para contratos generados"
  type        = string
  default     = "contratos/"
}

variable "jobs_ttl_days" {
  description = "Dias de retencion del estado de jobs en DynamoDB"
  type        = number
  default     = 90
}

variable "async_ssm_parameter_name" {
  description = "Nombre del parametro SSM de la bandera de activacion"
  type        = string
}

variable "async_enabled" {
  description = "Valor inicial de la bandera async (false = flujo sincrono)"
  type        = bool
  default     = false
}

variable "async_percentage" {
  description = "Porcentaje inicial de canary (0..100)"
  type        = number
  default     = 0
}

locals {
  tags = merge(var.common_tags, { component = "app" })
  name = "iimp-ctrst-${var.environment}-contract"
}

resource "aws_sqs_queue" "dlq" {
  name                      = "${local.name}-jobs-dlq"
  message_retention_seconds = var.queue_message_retention_seconds
  sqs_managed_sse_enabled   = true

  tags = merge(local.tags, { Name = "${local.name}-jobs-dlq" })
}

resource "aws_sqs_queue" "jobs" {
  name                       = "${local.name}-jobs"
  visibility_timeout_seconds = var.queue_visibility_timeout
  message_retention_seconds  = var.queue_message_retention_seconds
  receive_wait_time_seconds  = 20
  sqs_managed_sse_enabled    = true

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dlq.arn
    maxReceiveCount     = var.queue_max_receive_count
  })

  tags = merge(local.tags, { Name = "${local.name}-jobs" })
}

resource "aws_sqs_queue_redrive_allow_policy" "dlq" {
  queue_url = aws_sqs_queue.dlq.id

  redrive_allow_policy = jsonencode({
    redrivePermission = "byQueue"
    sourceQueueArns   = [aws_sqs_queue.jobs.arn]
  })
}

resource "aws_dynamodb_table" "jobs" {
  name         = "${local.name}-jobs"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "jobId"

  attribute {
    name = "jobId"
    type = "S"
  }

  attribute {
    name = "solicitudId"
    type = "S"
  }

  global_secondary_index {
    name            = "solicitudId-index"
    hash_key        = "solicitudId"
    projection_type = "ALL"
  }

  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }

  deletion_protection_enabled = var.environment == "prod"

  tags = merge(local.tags, { Name = "${local.name}-jobs" })
}

resource "aws_ecr_repository" "worker" {
  name                 = var.worker_ecr_repository_name
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = merge(local.tags, { Name = var.worker_ecr_repository_name })
}

resource "aws_ecr_lifecycle_policy" "worker" {
  repository = aws_ecr_repository.worker.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Retener las ultimas 10 imagenes"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 10
      }
      action = { type = "expire" }
    }]
  })
}

resource "aws_cloudwatch_log_group" "worker" {
  name              = "/ecs/${local.name}-worker"
  retention_in_days = var.worker_log_retention_days

  tags = merge(local.tags, { Name = "${local.name}-worker" })
}

resource "aws_security_group" "worker" {
  name        = "${local.name}-worker-sg"
  description = "Worker de contratos: sin ingress; egress a SQS, S3, Aurora y ECR"
  vpc_id      = var.vpc_id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.tags, { Name = "${local.name}-worker-sg" })
}

resource "aws_iam_role" "execution" {
  name = "${local.name}-worker-execution"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = local.tags
}

resource "aws_iam_role_policy_attachment" "execution_managed" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "execution_secret" {
  name = "${local.name}-worker-execution-secret"
  role = aws_iam_role.execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = [var.database_secret_arn]
    }]
  })
}

resource "aws_iam_role" "task" {
  name = "${local.name}-worker-task"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = local.tags
}

resource "aws_iam_role_policy" "task" {
  name = "${local.name}-worker-task-policy"
  role = aws_iam_role.task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:ChangeMessageVisibility",
          "sqs:GetQueueAttributes",
          "sqs:GetQueueUrl",
        ]
        Resource = [aws_sqs_queue.jobs.arn, aws_sqs_queue.dlq.arn]
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:Query",
        ]
        Resource = [
          aws_dynamodb_table.jobs.arn,
          "${aws_dynamodb_table.jobs.arn}/index/*",
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:ListBucket",
        ]
        Resource = [
          var.bucket_arn,
          "${var.bucket_arn}/${var.s3_prefix}*",
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents",
        ]
        Resource = ["*"]
      },
    ]
  })
}

resource "aws_ssm_parameter" "async_flag" {
  name = var.async_ssm_parameter_name
  type = "String"
  value = jsonencode({
    enabled    = var.async_enabled
    percentage = var.async_percentage
    allowlist  = []
  })

  lifecycle {
    ignore_changes = [value]
  }

  tags = local.tags
}

resource "aws_ecs_cluster" "worker" {
  name = "${local.name}-workers"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = local.tags
}

resource "aws_ecs_cluster_capacity_providers" "worker" {
  cluster_name       = aws_ecs_cluster.worker.name
  capacity_providers = var.worker_enable_spot ? ["FARGATE", "FARGATE_SPOT"] : ["FARGATE"]

  default_capacity_provider_strategy {
    capacity_provider = "FARGATE"
    base              = 1
    weight            = 1
  }

  dynamic "default_capacity_provider_strategy" {
    for_each = var.worker_enable_spot ? [1] : []
    content {
      capacity_provider = "FARGATE_SPOT"
      weight            = var.worker_spot_weight
    }
  }
}

resource "aws_ecs_task_definition" "worker" {
  count                    = var.worker_enabled ? 1 : 0
  family                   = "${local.name}-worker"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.worker_cpu
  memory                   = var.worker_memory
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = var.worker_cpu_architecture
  }

  container_definitions = jsonencode([{
    name      = "worker"
    image     = "${aws_ecr_repository.worker.repository_url}:${var.worker_image_tag}"
    essential = true

    environment = [
      { name = "NODE_ENV", value = "production" },
      { name = "STORAGE_PROVIDER", value = "s3" },
      { name = "S3_BUCKET", value = var.bucket_name },
      { name = "S3_REGION", value = data.aws_region.current.name },
      { name = "CONTRACT_QUEUE_URL", value = aws_sqs_queue.jobs.id },
      { name = "CONTRACT_JOBS_TABLE", value = aws_dynamodb_table.jobs.name },
      { name = "CONTRACT_S3_PREFIX", value = var.s3_prefix },
      { name = "CONTRACT_WORKER_CONCURRENCY", value = tostring(var.worker_concurrency) },
      { name = "CONTRACT_PDF_CONCURRENCY", value = tostring(var.pdf_concurrency) },
      { name = "HOME", value = "/tmp" },
      { name = "XDG_CACHE_HOME", value = "/tmp/.cache" },
      { name = "NEXT_TELEMETRY_DISABLED", value = "1" },
    ]

    secrets = [{ name = "DATABASE_URL", valueFrom = var.database_secret_arn }]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.worker.name
        awslogs-region        = data.aws_region.current.name
        awslogs-stream-prefix = "worker"
      }
    }
  }])

  tags = local.tags
}

resource "aws_ecs_service" "worker" {
  count           = var.worker_enabled ? 1 : 0
  name            = "${local.name}-worker"
  cluster         = aws_ecs_cluster.worker.id
  task_definition = aws_ecs_task_definition.worker[0].arn
  desired_count   = var.worker_desired_count

  capacity_provider_strategy {
    capacity_provider = "FARGATE"
    base              = var.worker_base_capacity
    weight            = 1
  }

  dynamic "capacity_provider_strategy" {
    for_each = var.worker_enable_spot ? [1] : []
    content {
      capacity_provider = "FARGATE_SPOT"
      base              = 0
      weight            = var.worker_spot_weight
    }
  }

  network_configuration {
    subnets          = var.subnet_ids
    security_groups  = [aws_security_group.worker.id]
    assign_public_ip = var.assign_public_ip
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  deployment_minimum_healthy_percent = 0
  deployment_maximum_percent         = 100

  enable_execute_command = false
  propagate_tags         = "SERVICE"

  lifecycle {
    ignore_changes = [desired_count]
  }

  tags = local.tags
}

resource "aws_appautoscaling_target" "worker" {
  count              = var.worker_enabled ? 1 : 0
  max_capacity       = var.worker_max_capacity
  min_capacity       = var.worker_min_capacity
  resource_id        = "service/${aws_ecs_cluster.worker.name}/${aws_ecs_service.worker[0].name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "worker_sqs" {
  count              = var.worker_enabled ? 1 : 0
  name               = "${local.name}-worker-sqs-scale"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.worker[0].resource_id
  scalable_dimension = aws_appautoscaling_target.worker[0].scalable_dimension
  service_namespace  = aws_appautoscaling_target.worker[0].service_namespace

  target_tracking_scaling_policy_configuration {
    customized_metric_specification {
      metric_name = "ApproximateNumberOfMessagesVisible"
      namespace   = "AWS/SQS"
      statistic   = "Average"
      unit        = "Count"

      dimensions {
        name  = "QueueName"
        value = aws_sqs_queue.jobs.name
      }
    }

    target_value       = var.worker_sqs_target_value
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}

resource "aws_cloudwatch_metric_alarm" "dlq" {
  alarm_name          = "${local.name}-dlq-messages"
  alarm_description   = "Hay mensajes en la DLQ de contratos"
  namespace           = "AWS/SQS"
  metric_name         = "ApproximateNumberOfMessagesVisible"
  dimensions          = { QueueName = aws_sqs_queue.dlq.name }
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 1
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = var.alarm_topic_arn != "" ? [var.alarm_topic_arn] : []

  tags = local.tags
}

resource "aws_cloudwatch_metric_alarm" "queue_age" {
  alarm_name          = "${local.name}-queue-age"
  alarm_description   = "La cola de contratos lleva mas de 5 minutos"
  namespace           = "AWS/SQS"
  metric_name         = "ApproximateAgeOfOldestMessage"
  dimensions          = { QueueName = aws_sqs_queue.jobs.name }
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 1
  threshold           = 300
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = var.alarm_topic_arn != "" ? [var.alarm_topic_arn] : []

  tags = local.tags
}

data "aws_region" "current" {}

output "queue_url" {
  value = aws_sqs_queue.jobs.id
}

output "dlq_url" {
  value = aws_sqs_queue.dlq.id
}

output "jobs_table_name" {
  value = aws_dynamodb_table.jobs.name
}

output "worker_ecr_repository_url" {
  value = aws_ecr_repository.worker.repository_url
}

output "worker_cluster_name" {
  value = aws_ecs_cluster.worker.name
}

output "worker_service_name" {
  value = try(aws_ecs_service.worker[0].name, null)
}

output "worker_task_role_arn" {
  value = aws_iam_role.task.arn
}

output "worker_security_group_id" {
  value = aws_security_group.worker.id
}

output "async_ssm_parameter_name" {
  value = aws_ssm_parameter.async_flag.name
}
