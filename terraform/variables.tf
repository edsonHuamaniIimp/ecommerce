# ─────────────────────────────────────────────────────────────────────────────
# Variables raíz — R2: TODO configurable por variable (defaults documentados)
# Cambiar un valor = -var="clave=valor" | terraform.tfvars | perfiles/*.tfvars
# Decisión de arquitectura: docs/01-despliegue/arquitectura-aws.md (v5, Opción 1)
# ─────────────────────────────────────────────────────────────────────────────

# ── AWS / cuenta (R4) ───────────────────────────────────────────────────────
variable "aws_region" {
  description = "Region AWS del proyecto"
  type        = string
  default     = "us-east-1"
}

variable "aws_profile" {
  description = "Perfil AWS CLI (R4: sistemas-aws = cuenta sistemas.iimp 517839275515). Vacio = usar env vars/chain (CI/CD)"
  type        = string
  default     = ""
}

# ── Entorno ─────────────────────────────────────────────────────────────────
variable "environment" {
  description = "Entorno de despliegue (R1: prod SOLO con autorización del usuario; qa = pruebas, mas barato)"
  type        = string

  validation {
    condition     = contains(["qa", "prod"], var.environment)
    error_message = "environment debe ser 'qa' o 'prod'."
  }
}

# ── Red ─────────────────────────────────────────────────────────────────────
variable "vpc_cidr" {
  description = "CIDR de la VPC (distinto de montaje-integral para evitar colisiones en la misma cuenta)"
  type        = string
  default     = "10.20.0.0/16"
}

variable "enable_nat_gateway" {
  description = "Crear NAT Gateway (prod). Da IP de salida fija para las integraciones IIMP; en qa la tarea va en subnet publica (sin NAT, ahorra ~$33/mes)"
  type        = bool
  default     = false
}

variable "az_count" {
  description = "Cantidad de zonas de disponibilidad y subnets por tipo (minimo 2 para Aurora)"
  type        = number
  default     = 2
}

# ── Dominio / DNS ───────────────────────────────────────────────────────────
variable "app_domain" {
  description = "Dominio publico de la app (APP_URL). Vacio = usar el DNS del ALB/CloudFront"
  type        = string
  default     = "ecommerce.sistemasiimp.org.pe"
}

variable "route53_zone_id" {
  description = "ID de la hosted zone Route53 del dominio. Vacio = el DNS se administra fuera: Terraform emitira los CNAME de validacion ACM para cargarlos a mano"
  type        = string
  default     = ""
}

# ── Base de datos: Aurora PostgreSQL Serverless v2 ──────────────────────────
variable "db_name" {
  description = "Nombre de la base de datos"
  type        = string
  default     = "contratos_stands"
}

variable "db_username" {
  description = "Usuario master de la BD"
  type        = string
  default     = "ctrst"
}

variable "aurora_engine_version" {
  description = "Version del motor Aurora PostgreSQL (verificar disponibles: aws rds describe-db-engine-versions --engine aurora-postgresql)"
  type        = string
  default     = "16.14"
}

variable "aurora_min_acu" {
  description = "ACU minimo de Aurora Serverless v2 (0 = auto-pausa entre eventos; subir a 0.5/1 durante la ventana para evitar la reanudacion)"
  type        = number
  default     = 0
}

variable "aurora_max_acu" {
  description = "ACU maximo de Aurora Serverless v2 (techo de escalado en la apertura)"
  type        = number
  default     = 4
}

variable "aurora_seconds_until_auto_pause" {
  description = "Segundos de inactividad antes de auto-pausar (solo aplica si aurora_min_acu = 0)"
  type        = number
  default     = 300
}

variable "db_backup_retention_days_qa" {
  description = "Dias de retencion de snapshots en qa (0 = sin backups automaticos). La BD NUNCA se recrea; solo evoluciona con migrate deploy"
  type        = number
  default     = 0
}

variable "db_backup_retention_days_prod" {
  description = "Dias de retencion de snapshots en prod"
  type        = number
  default     = 14
}

# ── Almacenamiento ──────────────────────────────────────────────────────────
variable "bucket_name_prefix" {
  description = "Prefijo del bucket S3 de documentos (el entorno se agrega al final)"
  type        = string
  default     = "iimp-contratos-stands-documentos"
}

variable "s3_intelligent_tiering_days" {
  description = "Dias tras los cuales los documentos pasan a Intelligent-Tiering (0 = desactivado)"
  type        = number
  default     = 90
}

variable "s3_noncurrent_version_expiration_days" {
  description = "Dias para expirar versiones antiguas de los objetos (evita acumulacion silenciosa de versiones)"
  type        = number
  default     = 90
}

# ── Integraciones externas (vacio = no inyectar en la tarea) ────────────────
variable "planogess_api_url" {
  description = "URL de KBEventos PlanoGESS (prod: https://secure2.iimp.org:8443/KBEventos/rest/planogess)"
  type        = string
  default     = ""
}

variable "kbservicios_url" {
  description = "URL de KBServicios (eventos y tipos)"
  type        = string
  default     = ""
}

variable "sunat_api_token" {
  description = "Token para consultas SUNAT RUC/DNI (secreto) — vacio = no crear secreto"
  type        = string
  default     = ""
  sensitive   = true
}

variable "resend_api_key" {
  description = "API key de Resend para correos (secreto) — vacio = correos deshabilitados"
  type        = string
  default     = ""
  sensitive   = true
}

variable "kbservicios_api_key" {
  description = "API key de KBServicios (auspicios) (secreto) — vacio = no crear secreto"
  type        = string
  default     = ""
  sensitive   = true
}

variable "auspicios_api_url" {
  description = "URL del servicio de auspicios — vacio = no inyectar"
  type        = string
  default     = ""
}

variable "niubizz_merchant_id" {
  description = "Merchant ID de Niubiz — vacio = no inyectar"
  type        = string
  default     = ""
}

variable "niubizz_user" {
  description = "Usuario de Niubiz (secreto)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "niubizz_password" {
  description = "Password de Niubiz (secreto)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "niubizz_url_api" {
  description = "URL de la API de Niubiz — vacio = no inyectar"
  type        = string
  default     = ""
}

variable "niubizz_url_js" {
  description = "URL del JS de checkout de Niubiz — vacio = no inyectar"
  type        = string
  default     = ""
}

variable "iimp_proxy_url" {
  description = "URL del proxy IIMP (salida a internet) — vacio = no inyectar"
  type        = string
  default     = ""
}

variable "iimp_proxy_ip" {
  description = "IP del proxy IIMP — vacio = no inyectar"
  type        = string
  default     = ""
}

variable "iimp_proxy_pass" {
  description = "Password del proxy IIMP (secreto)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "integracion_api_key" {
  description = "Clave M2M con el sistema de montaje (secreto)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "public_api_url" {
  description = "NEXT_PUBLIC_API_URL (URL base de la API para el navegador). Vacio = '/api' (mismo origen, recomendado)"
  type        = string
  default     = "/api"
}

variable "admin_email" {
  description = "Correo administrador / destino de notificaciones — vacio = no inyectar"
  type        = string
  default     = ""
}

# ── Aplicacion (ECS Fargate) ────────────────────────────────────────────────
variable "ecr_repository_name" {
  description = "Nombre del repo ECR de la imagen (gestionado por Terraform)"
  type        = string
  default     = "iimp-contratos-stands-app"
}

variable "ecr_keep_last_images" {
  description = "Cantidad de imagenes a retener en ECR (lifecycle policy)"
  type        = number
  default     = 10
}

variable "image_tag" {
  description = "Tag de la imagen ECR a desplegar (revision — rollback = cambiar este valor)"
  type        = string
  default     = "latest"
}

variable "container_port" {
  description = "Puerto del contenedor Next.js standalone"
  type        = number
  default     = 3000
}

variable "task_cpu" {
  description = "CPU de la tarea Fargate (unidades 1024 = 1 vCPU)"
  type        = string
  default     = "512"
}

variable "task_memory" {
  description = "Memoria de la tarea Fargate (MB)"
  type        = string
  default     = "1024"
}

variable "enable_fargate_spot" {
  description = "Usar FARGATE_SPOT para el overflow (hasta -70%). La capacidad base (base=1) queda on-demand para proteger el flujo de pago"
  type        = bool
  default     = true
}

variable "fargate_spot_weight" {
  description = "Peso de FARGATE_SPOT en la estrategia de capacity providers (avanzar mas rapido en Spot)"
  type        = number
  default     = 3
}

variable "desired_min_capacity" {
  description = "Minimo de tareas (autoscaling) — el pre-warm programado lo sube en la apertura"
  type        = number
  default     = 1
}

variable "desired_max_capacity" {
  description = "Maximo de tareas (autoscaling) — techo de crecimiento ante demanda desconocida"
  type        = number
  default     = 16
}

variable "desired_count_prod" {
  description = "Tareas deseadas en prod"
  type        = number
  default     = 2
}

variable "desired_count_qa" {
  description = "Tareas deseadas en qa"
  type        = number
  default     = 1
}

variable "autoscale_cpu_target" {
  description = "Porcentaje de CPU objetivo del autoscaling"
  type        = number
  default     = 65
}

variable "autoscale_request_count_target" {
  description = "Requests por minuto por tarea objetivo (metrica ALBRequestCountPerTarget — reacciona mas rapido que la CPU ante una estampida)"
  type        = number
  default     = 800
}

variable "log_retention_days" {
  description = "Retencion de logs CloudWatch (dias)"
  type        = number
  default     = 30
}

# Pre-warm programado (fecha/hora conocida de apertura — ver arquitectura-aws.md §1.3)
variable "scheduled_scalings" {
  description = "Pre-warm programado del servicio: lista de { name, schedule (cron UTC), min, max, timezone }. Vacio = sin programacion"
  type = list(object({
    name     = string
    schedule = string
    min      = number
    max      = number
    timezone = string
  }))
  default = []
}

# ── CDN / seguridad perimetral (CloudFront + WAF) ───────────────────────────
variable "enable_cloudfront" {
  description = "Crear distribucion CloudFront delante del ALB (cachea estaticos y el plano 3D, absorbiendo el pico)"
  type        = bool
  default     = true
}

variable "enable_waf" {
  description = "Asociar AWS WAF (reglas administradas + rate limit) a CloudFront"
  type        = bool
  default     = true
}

variable "waf_rate_limit" {
  description = "Maximo de requests por 5 minutos por IP (rate-based rule)"
  type        = number
  default     = 2000
}

variable "restrict_alb_to_cloudfront" {
  description = "Permitir ingreso al ALB SOLO desde los rangos de CloudFront (prod). En qa = false para poder probar el ALB directo"
  type        = bool
  default     = false
}

# ── Observabilidad / gobierno de costo ──────────────────────────────────────
variable "alarm_5xx_threshold" {
  description = "Umbral de respuestas 5xx del ALB en 5 minutos que dispara la alarma"
  type        = number
  default     = 10
}

variable "alarm_latency_target_seconds" {
  description = "Latencia p95 objetivo del ALB (segundos) para la alarma"
  type        = number
  default     = 2
}

variable "budget_amount_usd" {
  description = "Monto mensual del presupuesto (0 = no crear el budget)"
  type        = number
  default     = 0
}

variable "budget_alert_email" {
  description = "Correo que recibe las alertas de presupuesto"
  type        = string
  default     = ""
}

# ── Uploads (EFS) ───────────────────────────────────────────────────────────
variable "uploads_backend" {
  description = "Backend de archivos subidos: 'efs' (funciona hoy con STORAGE_PROVIDER=local) o 's3' (requiere subida prefirmada implementada)"
  type        = string
  default     = "efs"

  validation {
    condition     = contains(["efs", "s3"], var.uploads_backend)
    error_message = "uploads_backend debe ser 'efs' o 's3'."
  }
}

variable "uploads_posix_uid" {
  description = "UID del proceso Node en el contenedor (nextjs = 1001 segun Dockerfile.ecs)"
  type        = number
  default     = 1001
}

variable "uploads_posix_gid" {
  description = "GID del proceso Node en el contenedor (nodejs = 1001 segun Dockerfile.ecs)"
  type        = number
  default     = 1001
}

variable "uploads_transition_to_ia_days" {
  description = "Dias para mover archivos no accedidos de EFS a Infrequent Access (0 = sin transicion)"
  type        = number
  default     = 30
}

variable "uploads_mount_target_count" {
  description = "Cantidad de mount targets de EFS (debe coincidir con las subnets donde corren las tareas)"
  type        = number
  default     = 2
}

# ── Aurora: instancias ──────────────────────────────────────────────────────
variable "aurora_instance_class" {
  description = "Clase de instancia del cluster Aurora (Serverless v2 usa 'db.serverless')"
  type        = string
  default     = "db.serverless"
}

variable "aurora_instance_count" {
  description = "Instancias del cluster (1 = solo writer; 2 = writer + reader para HA, duplica el costo de ACU)"
  type        = number
  default     = 1
}

# ── ALB: health check y despliegue ──────────────────────────────────────────
variable "alb_health_check_path" {
  description = "Ruta del health check del ALB"
  type        = string
  default     = "/api/health"
}

variable "enable_https" {
  description = "Crear el listener HTTPS del ALB y redirigir 80→443. Requiere el certificado ACM YA VALIDADO (con DNS externo: emitir primero, validar, y luego activar)"
  type        = bool
  default     = false
}

variable "alb_health_check_interval" {
  description = "Intervalo del health check del ALB (segundos)"
  type        = number
  default     = 30
}

variable "alb_health_check_timeout" {
  description = "Timeout del health check del ALB (segundos)"
  type        = number
  default     = 10
}

variable "alb_healthy_threshold" {
  description = "Chequeos exitosos para marcar una tarea sana"
  type        = number
  default     = 2
}

variable "alb_unhealthy_threshold" {
  description = "Chequeos fallidos para marcar una tarea no sana"
  type        = number
  default     = 3
}

variable "alb_deregistration_delay" {
  description = "Segundos que espera el ALB antes de sacar una tarea durante el despliegue"
  type        = number
  default     = 30
}

variable "scale_in_cooldown" {
  description = "Cooldown de bajada de tareas (segundos) — alto para no bajar capacidad con pagos en curso"
  type        = number
  default     = 300
}

variable "scale_out_cooldown" {
  description = "Cooldown de subida de tareas (segundos) — bajo para reaccionar rapido a la estampida"
  type        = number
  default     = 60
}

# ── CDN: cache ──────────────────────────────────────────────────────────────
variable "cdn_static_ttl_seconds" {
  description = "TTL maximo de cache de los assets del build (/_next/static)"
  type        = number
  default     = 31536000
}

variable "cdn_uploads_ttl_seconds" {
  description = "TTL maximo de cache de los documentos servidos en /uploads"
  type        = number
  default     = 2592000
}

# ── Presupuesto ─────────────────────────────────────────────────────────────
variable "budget_alert_percentages" {
  description = "Porcentajes del presupuesto que disparan alerta por correo"
  type        = list(number)
  default     = [80, 100]
}

# ── Integracion SGC (Sistema de Gestion de Contratos) ─────────────────────
variable "sgc_enabled" {
  description = "Activar la integracion SGC (1 = dispara el expediente al aprobar Comunicacion)"
  type        = bool
  default     = false
}

variable "sgc_mode" {
  description = "Modo del cliente SGC: mock (sin red) | real"
  type        = string
  default     = "mock"

  validation {
    condition     = contains(["mock", "real"], var.sgc_mode)
    error_message = "sgc_mode debe ser 'mock' o 'real'."
  }
}

variable "sgc_area_code" {
  description = "Codigo de area del expediente SGC (lo define el SGC) — vacio = no inyectar"
  type        = string
  default     = ""
}

variable "sgc_contract_type_code" {
  description = "Codigo del tipo de contrato del expediente SGC (lo define el SGC) — vacio = no inyectar"
  type        = string
  default     = ""
}

variable "sgc_timeout_ms" {
  description = "Timeout de las llamadas al SGC (ms)"
  type        = number
  default     = 10000
}

# ── Estado remoto (R5 — bootstrap) ──────────────────────────────────────────
variable "state_bucket_name" {
  description = "Bucket S3 del estado remoto (R5)"
  type        = string
  default     = "iimp-contratos-stands-terraform-state"
}

variable "state_dynamodb_table" {
  description = "Tabla DynamoDB de lock del estado (R5)"
  type        = string
  default     = "iimp-contratos-stands-terraform-locks"
}
