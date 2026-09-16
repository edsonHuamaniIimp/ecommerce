output "dominio_app" {
  description = "Dominio publico de la aplicacion (APP_URL)"
  value       = "https://${var.app_domain}"
}

output "cloudfront_domain" {
  description = "Dominio de CloudFront (si el DNS es externo, apuntar un CNAME aqui)"
  value       = module.cloudfront.distribution_domain_name
}

output "alb_dns_name" {
  description = "DNS del ALB (no exponer al publico; es el origen de CloudFront)"
  value       = module.ecs.alb_dns_name
}

output "acm_validation_records" {
  description = "Registros CNAME para validar el certificado (solo si el DNS NO esta en Route53)"
  value       = module.acm.validation_records
}

output "ecr_repository_url" {
  description = "URL del repo ECR para pushear la imagen"
  value       = module.ecs.ecr_repository_url
}

output "ecs_cluster_name" {
  description = "Nombre del cluster ECS (para comandos de despliegue)"
  value       = module.ecs.cluster_name
}

output "ecs_service_name" {
  description = "Nombre del servicio ECS"
  value       = module.ecs.service_name
}

output "bucket_documentos" {
  description = "Bucket S3 de documentos (S3_BUCKET)"
  value       = module.storage.bucket_name
}

output "aurora_endpoint" {
  description = "Endpoint de Aurora (la URL completa vive en Secrets Manager)"
  value       = module.aurora.endpoint
  sensitive   = true
}

output "alarms_topic_arn" {
  description = "Topic SNS de alarmas (suscripcion por correo)"
  value       = module.observability.sns_topic_arn
}
