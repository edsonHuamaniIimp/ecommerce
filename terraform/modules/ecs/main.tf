# Módulo ecs: ECR + ALB + ECS Fargate (ARM64, on-demand + Spot, autoscaling y pre-warm)
# R2: capacidades/objetivos por variable. R3: hashtag base por default_tags; aquí solo component.

variable "environment" {
  description = "Entorno (qa | prod)"
  type        = string
}

variable "vpc_id" {
  description = "VPC"
  type        = string
}

variable "public_subnet_ids" {
  description = "Subnets públicas (ALB)"
  type        = list(string)
}

variable "private_subnet_ids" {
  description = "Subnets privadas (tareas Fargate con NAT)"
  type        = list(string)
}

variable "enable_nat_gateway" {
  description = "Si es true, las tareas van a subnets privadas (prod); si no, a públicas con IP pública"
  type        = bool
}

variable "secret_arns" {
  description = "ARNs de Secrets Manager"
  type        = map(string)
}

variable "bucket_arn" {
  description = "ARN del bucket de documentos (permisos de la tarea para el futuro upload firmado)"
  type        = string
}

variable "s3_bucket" {
  description = "Nombre del bucket S3 (S3_BUCKET) (R2)"
  type        = string
}

variable "efs_file_system_id" {
  description = "ID del EFS de uploads (vacío = sin volumen EFS)"
  type        = string
  default     = ""
}

variable "efs_access_point_id" {
  description = "ID del access point del EFS de uploads"
  type        = string
  default     = ""
}

variable "uploads_backend" {
  description = "Backend de archivos: 'efs' (STORAGE_PROVIDER=local + volumen EFS) o 's3' (requiere subida prefirmada implementada)"
  type        = string
  default     = "efs"

  validation {
    condition     = contains(["efs", "s3"], var.uploads_backend)
    error_message = "uploads_backend debe ser 'efs' o 's3'."
  }
}

variable "planogess_api_url" {
  description = "URL de KBEventos PlanoGESS (R2) — vacio = no inyectar"
  type        = string
  default     = ""
}

variable "kbservicios_url" {
  description = "URL de KBServicios (R2) — vacio = no inyectar"
  type        = string
  default     = ""
}

variable "admin_email" {
  description = "Correo administrador / notificaciones (R2) — vacio = no inyectar"
  type        = string
  default     = ""
}

variable "app_domain" {
  description = "Dominio público (APP_URL) (R2) — vacio = usar el DNS del ALB"
  type        = string
  default     = ""
}

variable "certificate_arn" {
  description = "ARN del certificado ACM para HTTPS en el ALB (vacío = solo HTTP)"
  type        = string
  default     = ""
}

variable "enable_https" {
  description = "Crear listener HTTPS + redirección 80→443 (debe ser un valor conocido en plan; el certificado debe estar validado) (R2)"
  type        = bool
}

variable "restrict_alb_to_cloudfront" {
  description = "Permitir ingreso al ALB solo desde los rangos de CloudFront (prod)"
  type        = bool
  default     = false
}

variable "ecr_repository_name" {
  description = "Nombre del repo ECR (R2)"
  type        = string
}

variable "ecr_keep_last_images" {
  description = "Imágenes a retener en ECR (R2)"
  type        = number
}

variable "image_tag" {
  description = "Tag de la imagen a desplegar (revisión — rollback) (R2)"
  type        = string
}

variable "container_port" {
  description = "Puerto del contenedor Next.js standalone (R2)"
  type        = number
}

variable "task_cpu" {
  description = "CPU de la tarea (R2)"
  type        = string
}

variable "task_memory" {
  description = "Memoria de la tarea en MB (R2)"
  type        = string
}

variable "enable_fargate_spot" {
  description = "Usar FARGATE_SPOT para el overflow (R2)"
  type        = bool
}

variable "fargate_spot_weight" {
  description = "Peso de FARGATE_SPOT en la capacidad de ráfaga (R2)"
  type        = number
}

variable "desired_min_capacity" {
  description = "Mínimo de tareas del autoscaling (R2)"
  type        = number
}

variable "desired_max_capacity" {
  description = "Máximo de tareas del autoscaling (R2)"
  type        = number
}

variable "desired_count_prod" {
  description = "Tareas deseadas en prod (R2)"
  type        = number
}

variable "desired_count_qa" {
  description = "Tareas deseadas en qa (R2)"
  type        = number
}

variable "autoscale_cpu_target" {
  description = "CPU objetivo del autoscaling (%) (R2)"
  type        = number
}

variable "autoscale_request_count_target" {
  description = "Requests/min por tarea objetivo (R2)"
  type        = number
}

variable "alb_health_check_path" {
  description = "Ruta del health check (R2)"
  type        = string
}

variable "alb_health_check_interval" {
  description = "Intervalo del health check en segundos (R2)"
  type        = number
}

variable "alb_health_check_timeout" {
  description = "Timeout del health check en segundos (R2)"
  type        = number
}

variable "alb_healthy_threshold" {
  description = "Chequeos exitosos para tarea sana (R2)"
  type        = number
}

variable "alb_unhealthy_threshold" {
  description = "Chequeos fallidos para tarea no sana (R2)"
  type        = number
}

variable "alb_deregistration_delay" {
  description = "Segundos de espera antes de sacar una tarea en el despliegue (R2)"
  type        = number
}

variable "scale_in_cooldown" {
  description = "Cooldown de bajada de tareas en segundos (R2)"
  type        = number
}

variable "scale_out_cooldown" {
  description = "Cooldown de subida de tareas en segundos (R2)"
  type        = number
}

variable "log_retention_days" {
  description = "Retención de logs CloudWatch (R2)"
  type        = number
}

variable "scheduled_scalings" {
  description = "Pre-warm programado: [{ name, schedule, min, max, timezone }] (R2)"
  type = list(object({
    name     = string
    schedule = string
    min      = number
    max      = number
    timezone = string
  }))
  default = []
}

locals {
  tags = merge(var.common_tags, { component = "app" })
  name = "iimp-ctrst-${var.environment}"

  use_private_subnets = var.enable_nat_gateway
  task_subnets        = var.enable_nat_gateway ? var.private_subnet_ids : var.public_subnet_ids

  # Credenciales de la app: EFS mientras no exista la subida prefirmada a S3
  storage_provider = var.uploads_backend == "s3" ? "s3" : "local"
  app_url          = var.app_domain != "" ? "https://${var.app_domain}" : "http://${aws_lb.main.dns_name}"

  secret_list = concat(
    [
      { name = "DATABASE_URL", valueFrom = var.secret_arns["database_url"] },
      { name = "JWT_SECRET", valueFrom = var.secret_arns["jwt_secret"] },
    ],
    can(var.secret_arns["sunat_api_token"]) ? [{ name = "SUNAT_API_TOKEN", valueFrom = var.secret_arns["sunat_api_token"] }] : [],
    can(var.secret_arns["resend_api_key"]) ? [{ name = "RESEND_API_KEY", valueFrom = var.secret_arns["resend_api_key"] }] : [],
  )

  env_list = concat(
    [
      { name = "NODE_ENV", value = "production" },
      { name = "NEXT_PUBLIC_APP_ENV", value = var.environment == "prod" ? "production" : "qa" },
      { name = "NEXT_PUBLIC_API_MOCK", value = "0" },
      { name = "STORAGE_PROVIDER", value = local.storage_provider },
      { name = "S3_BUCKET", value = var.s3_bucket },
      { name = "S3_REGION", value = data.aws_region.current.name },
      { name = "S3_ENDPOINT", value = "" },
      { name = "NEXT_TELEMETRY_DISABLED", value = "1" },
      { name = "RUN_MIGRATIONS", value = "true" },
      { name = "NEXT_PUBLIC_APP_URL", value = local.app_url },
      { name = "APP_URL", value = local.app_url },
    ],
    var.planogess_api_url != "" ? [{ name = "PLANOGESS_API_URL", value = var.planogess_api_url }] : [],
    var.kbservicios_url != "" ? [{ name = "KBSERVICIOS_URL", value = var.kbservicios_url }] : [],
    var.admin_email != "" ? [{ name = "ADMIN_EMAIL", value = var.admin_email }] : [],
  )
}

# ── ECR (gestionado por Terraform) ──────────────────────────────────────────
resource "aws_ecr_repository" "app" {
  name                 = var.ecr_repository_name
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = local.tags
}

resource "aws_ecr_lifecycle_policy" "app" {
  repository = aws_ecr_repository.app.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Retener las ultimas ${var.ecr_keep_last_images} imagenes"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = var.ecr_keep_last_images
      }
      action = { type = "expire" }
    }]
  })
}

# ── Security group de la tarea ──────────────────────────────────────────────
resource "aws_security_group" "app" {
  name   = "${local.name}-app-sg"
  vpc_id = var.vpc_id

  ingress {
    description     = "HTTP desde el ALB"
    from_port       = var.container_port
    to_port         = var.container_port
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.tags, { Name = "${local.name}-app-sg" })
}

# ── IAM de la tarea (ECR + S3 + Secrets + logs + EFS) ───────────────────────
resource "aws_iam_role" "task" {
  name = "${local.name}-ecs-task-role"

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
  name = "${local.name}-ecs-task-policy"
  role = aws_iam_role.task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
        ]
        Resource = ["*"]
      },
      {
        Effect   = "Allow"
        Action   = ["s3:PutObject", "s3:GetObject", "s3:ListBucket"]
        Resource = [var.bucket_arn, "${var.bucket_arn}/*"]
      },
      {
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = values(var.secret_arns)
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogStreams",
        ]
        Resource = ["*"]
      },
      {
        Effect = "Allow"
        Action = [
          "elasticfilesystem:ClientMount",
          "elasticfilesystem:ClientWrite",
          "elasticfilesystem:ClientRootAccess",
        ]
        Resource = ["*"]
      },
    ]
  })
}

# ── ALB ─────────────────────────────────────────────────────────────────────
resource "aws_security_group" "alb" {
  name   = "${local.name}-alb-sg"
  vpc_id = var.vpc_id

  ingress {
    description = var.restrict_alb_to_cloudfront ? "HTTP solo desde CloudFront" : "HTTP publico"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = var.restrict_alb_to_cloudfront ? [] : ["0.0.0.0/0"]
    prefix_list_ids = var.restrict_alb_to_cloudfront ? [
      data.aws_ec2_managed_prefix_list.cloudfront[0].id
    ] : []
  }

  dynamic "ingress" {
    for_each = var.enable_https ? [1] : []
    content {
      description = "HTTPS publico (o solo CloudFront)"
      from_port   = 443
      to_port     = 443
      protocol    = "tcp"
      cidr_blocks = var.restrict_alb_to_cloudfront ? [] : ["0.0.0.0/0"]
      prefix_list_ids = var.restrict_alb_to_cloudfront ? [
        data.aws_ec2_managed_prefix_list.cloudfront[0].id
      ] : []
    }
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.tags, { Name = "${local.name}-alb-sg" })
}

data "aws_ec2_managed_prefix_list" "cloudfront" {
  count = var.restrict_alb_to_cloudfront ? 1 : 0
  name  = "com.amazonaws.global.cloudfront.origin-facing"
}

resource "aws_lb" "main" {
  name               = "${local.name}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = var.public_subnet_ids

  tags = local.tags
}

resource "aws_lb_target_group" "app" {
  name        = "${local.name}-tg"
  port        = var.container_port
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  # Reactividad del autoscaling: menos de 5 min con una tarea lenta la reemplaza
  deregistration_delay = var.alb_deregistration_delay

  health_check {
    path                = var.alb_health_check_path
    interval            = var.alb_health_check_interval
    timeout             = var.alb_health_check_timeout
    healthy_threshold   = var.alb_healthy_threshold
    unhealthy_threshold = var.alb_unhealthy_threshold
    matcher             = "200"
  }

  tags = local.tags
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = var.enable_https ? "redirect" : "forward"
    target_group_arn = var.enable_https ? null : aws_lb_target_group.app.arn

    dynamic "redirect" {
      for_each = var.enable_https ? [1] : []
      content {
        port        = "443"
        protocol    = "HTTPS"
        status_code = "HTTP_301"
      }
    }
  }
}

resource "aws_lb_listener" "https" {
  count = var.enable_https ? 1 : 0

  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }
}

# ── ECS Cluster + capacity providers (on-demand base + Spot burst) ──────────
resource "aws_ecs_cluster" "main" {
  name = "${local.name}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = local.tags
}

resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name       = aws_ecs_cluster.main.name
  capacity_providers = var.enable_fargate_spot ? ["FARGATE", "FARGATE_SPOT"] : ["FARGATE"]

  default_capacity_provider_strategy {
    capacity_provider = "FARGATE"
    base              = 1
    weight            = 1
  }

  dynamic "default_capacity_provider_strategy" {
    for_each = var.enable_fargate_spot ? [1] : []
    content {
      capacity_provider = "FARGATE_SPOT"
      weight            = var.fargate_spot_weight
    }
  }
}

resource "aws_ecs_task_definition" "app" {
  family                   = "${local.name}-app"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.task_cpu
  memory                   = var.task_memory
  execution_role_arn       = aws_iam_role.task.arn
  task_role_arn            = aws_iam_role.task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "ARM64"
  }

  dynamic "volume" {
    for_each = var.uploads_backend == "efs" ? [1] : []
    content {
      name = "uploads"

      efs_volume_configuration {
        file_system_id     = var.efs_file_system_id
        transit_encryption = "ENABLED"

        authorization_config {
          access_point_id = var.efs_access_point_id
          iam             = "ENABLED"
        }
      }
    }
  }

  container_definitions = jsonencode([
    {
      name         = "app"
      image        = "${aws_ecr_repository.app.repository_url}:${var.image_tag}"
      portMappings = [{ containerPort = var.container_port, protocol = "tcp" }]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.app.name
          "awslogs-region"        = data.aws_region.current.name
          "awslogs-stream-prefix" = "app"
        }
      }

      secrets     = local.secret_list
      environment = local.env_list

      mountPoints = var.uploads_backend == "efs" ? [{
        sourceVolume  = "uploads"
        containerPath = "/app/public/uploads"
        readOnly      = false
      }] : []
    },
  ])

  tags = local.tags
}

resource "aws_ecs_service" "app" {
  name            = "${local.name}-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = var.environment == "prod" ? var.desired_count_prod : var.desired_count_qa
  launch_type     = var.enable_fargate_spot ? null : "FARGATE"

  dynamic "capacity_provider_strategy" {
    for_each = var.enable_fargate_spot ? [1] : []
    content {
      capacity_provider = "FARGATE"
      base              = 1
      weight            = 1
    }
  }

  dynamic "capacity_provider_strategy" {
    for_each = var.enable_fargate_spot ? [1] : []
    content {
      capacity_provider = "FARGATE_SPOT"
      weight            = var.fargate_spot_weight
    }
  }

  network_configuration {
    subnets          = local.task_subnets
    security_groups  = [aws_security_group.app.id]
    assign_public_ip = !local.use_private_subnets
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.app.arn
    container_name   = "app"
    container_port   = var.container_port
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  lifecycle {
    ignore_changes = [desired_count]
  }

  tags = local.tags
}

# ── Autoscaling: métrica de requests (rápida) + CPU (respaldo) ──────────────
resource "aws_appautoscaling_target" "app" {
  max_capacity       = var.desired_max_capacity
  min_capacity       = var.desired_min_capacity
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.app.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

# Reacciona en ~1 min a la estampida de la apertura
resource "aws_appautoscaling_policy" "requests" {
  name               = "${local.name}-requests-scale"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.app.resource_id
  scalable_dimension = aws_appautoscaling_target.app.scalable_dimension
  service_namespace  = aws_appautoscaling_target.app.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ALBRequestCountPerTarget"
      resource_label         = "${aws_lb.main.arn_suffix}/${aws_lb_target_group.app.arn_suffix}"
    }

    target_value = var.autoscale_request_count_target
  }
}

resource "aws_appautoscaling_policy" "cpu" {
  name               = "${local.name}-cpu-scale"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.app.resource_id
  scalable_dimension = aws_appautoscaling_target.app.scalable_dimension
  service_namespace  = aws_appautoscaling_target.app.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }

    target_value       = var.autoscale_cpu_target
    scale_in_cooldown  = var.scale_in_cooldown
    scale_out_cooldown = var.scale_out_cooldown
  }
}

# Pre-warm programado: subir el piso ANTES de la hora de apertura (fecha conocida)
resource "aws_appautoscaling_scheduled_action" "prewarm" {
  for_each = { for s in var.scheduled_scalings : s.name => s }

  name               = "${local.name}-${each.value.name}"
  service_namespace  = aws_appautoscaling_target.app.service_namespace
  resource_id        = aws_appautoscaling_target.app.resource_id
  scalable_dimension = aws_appautoscaling_target.app.scalable_dimension

  schedule = each.value.schedule
  timezone = each.value.timezone

  scalable_target_action {
    min_capacity = each.value.min
    max_capacity = each.value.max
  }
}

# ── CloudWatch Logs ─────────────────────────────────────────────────────────
resource "aws_cloudwatch_log_group" "app" {
  name              = "/ecs/${local.name}-app"
  retention_in_days = var.log_retention_days

  tags = local.tags
}

data "aws_region" "current" {}

# ── Outputs ─────────────────────────────────────────────────────────────────
output "alb_dns_name" {
  description = "DNS del ALB (origen de CloudFront)"
  value       = aws_lb.main.dns_name
}

output "alb_arn" {
  description = "ARN del ALB"
  value       = aws_lb.main.arn
}

output "alb_zone_id" {
  description = "Hosted zone del ALB (registros alias)"
  value       = aws_lb.main.zone_id
}

output "ecr_repository_url" {
  description = "URL del repo ECR (push de imagen)"
  value       = aws_ecr_repository.app.repository_url
}

output "service_name" {
  description = "Nombre del servicio ECS"
  value       = aws_ecs_service.app.name
}

output "cluster_name" {
  description = "Nombre del cluster ECS"
  value       = aws_ecs_cluster.main.name
}

output "target_group_arn_suffix" {
  description = "Sufijo del target group (métricas del ALB)"
  value       = aws_lb_target_group.app.arn_suffix
}

output "alb_arn_suffix" {
  description = "Sufijo del ALB (métricas del ALB)"
  value       = aws_lb.main.arn_suffix
}

variable "common_tags" {
  description = "Etiquetas base del proyecto (R3): project, environment, managed-by, cost-center"
  type        = map(string)
}
