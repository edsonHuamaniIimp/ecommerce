# Módulo cloudfront: CDN (absorbe el pico de estáticos y del plano 3D) + WAF + DNS opcional.
# El WAF y el certificado deben vivir en us-east-1 (CloudFront es global).
# R3: hashtag base por default_tags; aquí solo component.

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

variable "environment" {
  description = "Entorno (qa | prod)"
  type        = string
}

variable "app_domain" {
  description = "Dominio público (alias de la distribución) (R2)"
  type        = string
}

variable "certificate_arn" {
  description = "ARN del certificado ACM en us-east-1 (R2)"
  type        = string
}

variable "alb_dns_name" {
  description = "DNS del ALB (origen)"
  type        = string
}

variable "enable_waf" {
  description = "Asociar AWS WAF (managed rules + rate limit) (R2)"
  type        = bool
}

variable "waf_rate_limit" {
  description = "Máximo de requests por 5 min por IP (R2)"
  type        = number
}

variable "route53_zone_id" {
  description = "Hosted zone de Route53 (vacío = no crear registros)"
  type        = string
  default     = ""
}

variable "price_class" {
  description = "Clase de precio de CloudFront (PriceClass_100 = US/EU, la más económica)"
  type        = string
  default     = "PriceClass_100"
}

variable "static_ttl_seconds" {
  description = "TTL máximo de cache de /_next/static (R2)"
  type        = number
}

variable "uploads_ttl_seconds" {
  description = "TTL máximo de cache de /uploads (R2)"
  type        = number
}

locals {
  # R3: `component` solo admite network|database|storage|secrets|app (REGLAS-DESPLIEGUE.md).
  # CloudFront/WAF forman parte de la entrega de la aplicación → component = "app".
  tags = merge(var.common_tags, { component = "app" })

  use_waf = var.enable_waf
}

# ── WAF (scope CLOUDFRONT, us-east-1) ───────────────────────────────────────
resource "aws_wafv2_web_acl" "main" {
  count = local.use_waf ? 1 : 0

  name  = "iimp-ctrst-${var.environment}-waf"
  scope = "CLOUDFRONT"

  default_action {
    allow {}
  }

  # Reglas administradas por AWS (OWASP comunes)
  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 10

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"

        # SizeRestrictions_BODY (CRS) bloquea cuerpos > 8KB con 403, lo que impide subir
        # documentos/imagenes. Se pasa a 'count' (AWS no permite scope-down por ruta en
        # rule_action_override). El resto de reglas del CRS siguen activas.
        rule_action_override {
          name = "SizeRestrictions_BODY"
          action_to_use {
            count {}
          }
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "common-rules"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "AWSManagedRulesKnownBadInputsRuleSet"
    priority = 20

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "bad-inputs"
      sampled_requests_enabled   = true
    }
  }

  # Rate limit por IP: corta bots/scrapers en la apertura pública
  rule {
    name     = "RateLimit"
    priority = 30

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = var.waf_rate_limit
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "rate-limit"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "iimp-ctrst-waf"
    sampled_requests_enabled   = true
  }

  tags = local.tags
}

# ── Políticas administradas de cache (sin IDs hardcodeados) ─────────────────
data "aws_cloudfront_cache_policy" "optimized" {
  name = "Managed-CachingOptimized"
}

data "aws_cloudfront_cache_policy" "disabled" {
  name = "Managed-CachingDisabled"
}

data "aws_cloudfront_origin_request_policy" "all_viewer" {
  name = "Managed-AllViewer"
}

# ── Distribución ────────────────────────────────────────────────────────────
resource "aws_cloudfront_distribution" "main" {
  enabled         = true
  is_ipv6_enabled = true
  comment         = "ContratosStands ${var.environment}"
  aliases         = [var.app_domain]
  price_class     = var.price_class
  web_acl_id      = local.use_waf ? aws_wafv2_web_acl.main[0].arn : null

  origin {
    domain_name = var.alb_dns_name
    origin_id   = "alb"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  # API y SSR: sin caché, todo al origen
  default_cache_behavior {
    target_origin_id         = "alb"
    viewer_protocol_policy   = "redirect-to-https"
    allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods           = ["GET", "HEAD"]
    cache_policy_id          = data.aws_cloudfront_cache_policy.disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer.id
    compress                 = true
  }

  # Assets estáticos del build: cache largo (inmutables por hash)
  ordered_cache_behavior {
    path_pattern           = "/_next/static/*"
    target_origin_id       = "alb"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    cache_policy_id        = data.aws_cloudfront_cache_policy.optimized.id
    compress               = true
    min_ttl                = 0
    default_ttl            = 86400
    max_ttl                = var.uploads_ttl_seconds
  }

  # Documentos subidos (EFS vía app): cache moderado
  ordered_cache_behavior {
    path_pattern           = "/uploads/*"
    target_origin_id       = "alb"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    cache_policy_id        = data.aws_cloudfront_cache_policy.optimized.id
    compress               = true
    min_ttl                = 0
    default_ttl            = 86400
    max_ttl                = 2592000
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # El certificado debe estar en us-east-1
  viewer_certificate {
    acm_certificate_arn      = var.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  tags = local.tags
}

# ── DNS (solo si la zona está en Route53) ───────────────────────────────────
resource "aws_route53_record" "app_ipv4" {
  count = var.route53_zone_id != "" ? 1 : 0

  zone_id = var.route53_zone_id
  name    = var.app_domain
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.main.domain_name
    zone_id                = aws_cloudfront_distribution.main.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "app_ipv6" {
  count = var.route53_zone_id != "" ? 1 : 0

  zone_id = var.route53_zone_id
  name    = var.app_domain
  type    = "AAAA"

  alias {
    name                   = aws_cloudfront_distribution.main.domain_name
    zone_id                = aws_cloudfront_distribution.main.hosted_zone_id
    evaluate_target_health = false
  }
}

output "distribution_domain_name" {
  description = "Dominio de CloudFront (destino del CNAME si el DNS es externo)"
  value       = aws_cloudfront_distribution.main.domain_name
}

output "distribution_id" {
  description = "ID de la distribución"
  value       = aws_cloudfront_distribution.main.id
}

output "waf_web_acl_arn" {
  description = "ARN del WAF asociado (vacío si está desactivado)"
  value       = local.use_waf ? aws_wafv2_web_acl.main[0].arn : ""
}

variable "common_tags" {
  description = "Etiquetas base del proyecto (R3): project, environment, managed-by, cost-center"
  type        = map(string)
}
