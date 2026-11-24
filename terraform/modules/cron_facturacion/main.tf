# Módulo cron_facturacion: dispara cada minuto el registro de las solicitudes de
# factura programadas (solicitudes internas). R3: component = app
#
# Flujo:  EventBridge Scheduler (rate) -> bus propio (PutEvents) -> regla
#         -> API destination -> POST https://<app_domain>/api/cron/facturacion-programada
#
# - El endpoint responde 202 enseguida (la API destination corta a los 5 s) y procesa
#   las tareas vencidas despues de responder.
# - Sin reintentos: la siguiente corrida (1 min) reintenta sola, la BD es la fuente de verdad.
# - Todo es aditivo: no toca el servicio de la app, Aurora ni la red.

terraform {
  required_providers {
    aws = {
      source = "hashicorp/aws"
    }
  }
}

locals {
  tags   = merge(var.common_tags, { component = "app" })
  name   = "iimp-ctrst-${var.environment}-cron-facturacion"
  create = var.enabled && var.cron_secret != ""

  event_source      = "contratos-stands.cron"
  event_detail_type = "facturacion-programada"
}

# ── Conexión + API destination (llamada HTTP firmada con x-cron-secret) ────
resource "aws_cloudwatch_event_connection" "cron" {
  count = local.create ? 1 : 0

  name               = local.name
  description        = "Cron de facturas programadas (header ${var.cron_secret_header})"
  authorization_type = "API_KEY"

  auth_parameters {
    api_key {
      key   = var.cron_secret_header
      value = var.cron_secret
    }
  }
}

resource "aws_cloudwatch_event_api_destination" "cron" {
  count = local.create ? 1 : 0

  name                             = local.name
  description                      = "POST ${var.endpoint_path} de la app"
  invocation_endpoint              = "https://${var.app_domain}${var.endpoint_path}"
  http_method                      = "POST"
  invocation_rate_limit_per_second = var.invocation_rate_limit_per_second
  connection_arn                   = aws_cloudwatch_event_connection.cron[0].arn
}

# ── Bus propio + regla hacia la API destination ─────────────────────────────
resource "aws_cloudwatch_event_bus" "cron" {
  count = local.create ? 1 : 0

  name = local.name
  tags = local.tags
}

resource "aws_cloudwatch_event_rule" "cron" {
  count = local.create ? 1 : 0

  name           = local.name
  event_bus_name = aws_cloudwatch_event_bus.cron[0].name
  description    = "Enruta el tick del Scheduler hacia la API destination"

  event_pattern = jsonencode({
    source        = [local.event_source]
    "detail-type" = [local.event_detail_type]
  })

  tags = local.tags
}

resource "aws_cloudwatch_event_target" "cron" {
  count = local.create ? 1 : 0

  rule           = aws_cloudwatch_event_rule.cron[0].name
  event_bus_name = aws_cloudwatch_event_bus.cron[0].name
  target_id      = "api-destination"
  arn            = aws_cloudwatch_event_api_destination.cron[0].arn
  role_arn       = aws_iam_role.events[0].arn

  # Sin reintentos: el siguiente tick (1 min) reintenta.
  retry_policy {
    maximum_retry_attempts       = 0
    maximum_event_age_in_seconds = 60
  }
}

# ── IAM: events -> InvokeApiDestination ─────────────────────────────────────
resource "aws_iam_role" "events" {
  count = local.create ? 1 : 0

  name = "${local.name}-events"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "events.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = local.tags
}

resource "aws_iam_role_policy" "events" {
  count = local.create ? 1 : 0

  name = "invoke-api-destination"
  role = aws_iam_role.events[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["events:InvokeApiDestination"]
      Resource = [aws_cloudwatch_event_api_destination.cron[0].arn]
    }]
  })
}

# ── EventBridge Scheduler: tick periodico -> PutEvents en el bus ────────────
resource "aws_iam_role" "scheduler" {
  count = local.create ? 1 : 0

  name = "${local.name}-scheduler"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "scheduler.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = local.tags
}

resource "aws_iam_role_policy" "scheduler" {
  count = local.create ? 1 : 0

  name = "put-events"
  role = aws_iam_role.scheduler[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["events:PutEvents"]
      Resource = [aws_cloudwatch_event_bus.cron[0].arn]
    }]
  })
}

resource "aws_scheduler_schedule" "cron" {
  count = local.create ? 1 : 0

  name        = local.name
  description = "Tick periodico: registra las solicitudes de factura programadas vencidas"
  state       = "ENABLED"

  # rate(): no depende de zona horaria. La hora programada la guarda la app en UTC.
  schedule_expression = var.schedule_expression

  flexible_time_window {
    mode = "OFF"
  }

  target {
    arn      = aws_cloudwatch_event_bus.cron[0].arn
    role_arn = aws_iam_role.scheduler[0].arn
    input    = jsonencode({ tick = "facturacion-programada" })

    eventbridge_parameters {
      detail_type = local.event_detail_type
      source      = local.event_source
    }

    retry_policy {
      maximum_retry_attempts       = 0
      maximum_event_age_in_seconds = 60
    }
  }
}

# ── Alarma: la regla no logra invocar la API destination ────────────────────
resource "aws_cloudwatch_metric_alarm" "failed_invocations" {
  count = local.create && var.alarm_topic_arn != "" ? 1 : 0

  alarm_name          = "${local.name}-fallos"
  alarm_description   = "El cron de facturas programadas no pudo invocar la app (revisar URL, secreto o WAF)"
  namespace           = "AWS/Events"
  metric_name         = "FailedInvocations"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 3
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [var.alarm_topic_arn]

  dimensions = {
    RuleName = aws_cloudwatch_event_rule.cron[0].name
  }

  tags = local.tags
}

# ── Variables ───────────────────────────────────────────────────────────────
variable "environment" {
  description = "Ambiente (qa | prod)"
  type        = string
}

variable "app_domain" {
  description = "Dominio publico de la app (host de la URL del cron)"
  type        = string
}

variable "enabled" {
  description = "Crear el cron de facturas programadas"
  type        = bool
  default     = true
}

variable "cron_secret" {
  description = "Secreto del header del cron (mismo CRON_SECRET de la app); vacio = no crear"
  type        = string
  default     = ""
  sensitive   = true
}

variable "cron_secret_header" {
  description = "Nombre del header con el secreto"
  type        = string
  default     = "x-cron-secret"
}

variable "endpoint_path" {
  description = "Ruta del endpoint del cron en la app"
  type        = string
  default     = "/api/cron/facturacion-programada"
}

variable "schedule_expression" {
  description = "Frecuencia del Scheduler (rate/cron). La hora programada del usuario se evalua en cada tick."
  type        = string
  default     = "rate(1 minute)"
}

variable "invocation_rate_limit_per_second" {
  description = "Limite de invocaciones por segundo de la API destination"
  type        = number
  default     = 1
}

variable "alarm_topic_arn" {
  description = "Topic SNS para la alarma de invocaciones fallidas (vacio = sin alarma)"
  type        = string
  default     = ""
}

variable "common_tags" {
  description = "Tags base del proyecto (R3)"
  type        = map(string)
}

# ── Outputs ─────────────────────────────────────────────────────────────────
output "schedule_name" {
  description = "Nombre del schedule del cron"
  value       = try(aws_scheduler_schedule.cron[0].name, null)
}

output "api_destination_arn" {
  description = "ARN de la API destination"
  value       = try(aws_cloudwatch_event_api_destination.cron[0].arn, null)
}
