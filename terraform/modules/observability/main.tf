# Módulo observability: alarmas CloudWatch + presupuesto (AWS Budgets).
# R2: umbrales por variable. R3: hashtag base por default_tags; aquí solo component.

variable "environment" {
  description = "Entorno (qa | prod)"
  type        = string
}

variable "alb_arn_suffix" {
  description = "Sufijo del ALB (métricas)"
  type        = string
}

variable "target_group_arn_suffix" {
  description = "Sufijo del target group (métricas)"
  type        = string
}

variable "ecs_cluster_name" {
  description = "Cluster ECS (métricas de CPU/memoria)"
  type        = string
}

variable "ecs_service_name" {
  description = "Servicio ECS"
  type        = string
}

variable "aurora_cluster_identifier" {
  description = "Identificador del cluster Aurora (métricas de capacidad)"
  type        = string
}

variable "alarm_5xx_threshold" {
  description = "Umbral de 5xx en 5 minutos (R2)"
  type        = number
}

variable "alarm_latency_target_seconds" {
  description = "Latencia p95 objetivo en segundos (R2)"
  type        = number
}

variable "alarm_email" {
  description = "Correo que recibe las alarmas (vacío = sin suscripción)"
  type        = string
  default     = ""
}

variable "budget_amount_usd" {
  description = "Monto mensual del presupuesto (0 = no crear) (R2)"
  type        = number
}

variable "budget_alert_email" {
  description = "Correo de alertas de presupuesto"
  type        = string
  default     = ""
}

variable "budget_alert_percentages" {
  description = "Porcentajes del presupuesto que disparan alerta (R2)"
  type        = list(number)
  default     = [80, 100]
}

locals {
  # R3: `component` solo admite network|database|storage|secrets|app (REGLAS-DESPLIEGUE.md).
  # La observabilidad monitorea la aplicación → component = "app".
  tags = merge(var.common_tags, { component = "app" })
  name = "iimp-ctrst-${var.environment}"
}

resource "aws_sns_topic" "alarms" {
  name = "${local.name}-alarms"
  tags = local.tags
}

resource "aws_sns_topic_subscription" "email" {
  count = var.alarm_email != "" ? 1 : 0

  topic_arn = aws_sns_topic.alarms.arn
  protocol  = "email"
  endpoint  = var.alarm_email
}

# ── Alarmas del ALB ─────────────────────────────────────────────────────────
resource "aws_cloudwatch_metric_alarm" "alb_5xx" {
  alarm_name          = "${local.name}-alb-5xx"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  statistic           = "Sum"
  threshold           = var.alarm_5xx_threshold
  treat_missing_data  = "notBreaching"
  alarm_description   = "Errores 5xx del backend en prod (posible falla en apertura/pagos)"
  alarm_actions       = [aws_sns_topic.alarms.arn]

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
  }

  tags = local.tags
}

resource "aws_cloudwatch_metric_alarm" "alb_latency" {
  alarm_name          = "${local.name}-alb-latencia"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  extended_statistic  = "p95"
  threshold           = var.alarm_latency_target_seconds
  treat_missing_data  = "notBreaching"
  alarm_description   = "Latencia p95 alta (el sistema se esta quedando corto de capacidad)"
  alarm_actions       = [aws_sns_topic.alarms.arn]

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
  }

  tags = local.tags
}

resource "aws_cloudwatch_metric_alarm" "unhealthy_targets" {
  alarm_name          = "${local.name}-tareas-no-sanas"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "UnHealthyHostCount"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Maximum"
  threshold           = 0
  treat_missing_data  = "notBreaching"
  alarm_description   = "Una o mas tareas no pasan el health check"
  alarm_actions       = [aws_sns_topic.alarms.arn]

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
    TargetGroup  = var.target_group_arn_suffix
  }

  tags = local.tags
}

# ── Alarmas de Aurora (capacidad: detecta que el pico se acerca al techo) ───
resource "aws_cloudwatch_metric_alarm" "aurora_capacity" {
  alarm_name          = "${local.name}-aurora-capacidad"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "ServerlessDatabaseCapacity"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 8
  treat_missing_data  = "notBreaching"
  alarm_description   = "Aurora cerca del techo de ACU (subir aurora_max_acu o revisar consultas)"
  alarm_actions       = [aws_sns_topic.alarms.arn]

  dimensions = {
    DBClusterIdentifier = var.aurora_cluster_identifier
  }

  tags = local.tags
}

# ── Presupuesto mensual (gobierno de costo — R1-friendly) ───────────────────
resource "aws_budgets_budget" "monthly" {
  count = var.budget_amount_usd > 0 ? 1 : 0

  name         = "${local.name}-mensual"
  budget_type  = "COST"
  limit_amount = tostring(var.budget_amount_usd)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  # Aviso al alcanzar cada porcentaje configurado del presupuesto
  dynamic "notification" {
    for_each = var.budget_alert_email != "" ? var.budget_alert_percentages : []
    content {
      comparison_operator        = "GREATER_THAN"
      threshold                  = notification.value
      threshold_type             = "PERCENTAGE"
      notification_type          = "ACTUAL"
      subscriber_email_addresses = [var.budget_alert_email]
    }
  }
}

output "sns_topic_arn" {
  description = "ARN del topic de alarmas"
  value       = aws_sns_topic.alarms.arn
}

variable "common_tags" {
  description = "Etiquetas base del proyecto (R3): project, environment, managed-by, cost-center"
  type        = map(string)
}
