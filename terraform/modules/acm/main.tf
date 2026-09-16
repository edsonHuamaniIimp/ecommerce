# Módulo acm: certificado TLS para el dominio público (us-east-1, requerido por CloudFront)
# Si se entrega route53_zone_id, la validación DNS se crea automáticamente; si no,
# se emiten los registros de validación para cargarlos manualmente en el DNS externo.
# R3: hashtag base por default_tags; aquí solo component.

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

variable "app_domain" {
  description = "Dominio público a certificar (R2)"
  type        = string
}

variable "route53_zone_id" {
  description = "Hosted zone de Route53 (vacío = DNS externo; se emiten los registros para carga manual)"
  type        = string
  default     = ""
}

locals {
  tags = merge(var.common_tags, { component = "network" })
}

resource "aws_acm_certificate" "app" {
  domain_name       = var.app_domain
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = merge(local.tags, { Name = var.app_domain })
}

# Validación automática (solo si el DNS está en Route53)
resource "aws_route53_record" "validation" {
  for_each = var.route53_zone_id != "" ? {
    for dvo in aws_acm_certificate.app.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  } : {}

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = var.route53_zone_id
}

resource "aws_acm_certificate_validation" "app" {
  count = var.route53_zone_id != "" ? 1 : 0

  certificate_arn         = aws_acm_certificate.app.arn
  validation_record_fqdns = [for r in aws_route53_record.validation : r.fqdn]
}

output "certificate_arn" {
  description = "ARN del certificado (validado si el DNS está en Route53; si no, el emitido)"
  value = (
    var.route53_zone_id != ""
    ? aws_acm_certificate_validation.app[0].certificate_arn
    : aws_acm_certificate.app.arn
  )
}

output "certificate_arn_unvalidated" {
  description = "ARN del certificado sin esperar validación (DNS externo: usar este)"
  value       = aws_acm_certificate.app.arn
}

output "validation_records" {
  description = "Registros CNAME a cargar en el DNS externo (cuando route53_zone_id está vacío)"
  value = [
    for dvo in aws_acm_certificate.app.domain_validation_options : {
      name  = dvo.resource_record_name
      type  = dvo.resource_record_type
      value = dvo.resource_record_value
    }
  ]
}

variable "common_tags" {
  description = "Etiquetas base del proyecto (R3): project, environment, managed-by, cost-center"
  type        = map(string)
}
