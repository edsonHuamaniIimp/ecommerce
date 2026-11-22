# ─────────────────────────────────────────────────────────────────────────────
# Variables raíz — R2: TODO configurable por variable (defaults documentados)
# Cambiar un valor = -var="clave=valor" | terraform.tfvars | perfiles/*.tfvars
# Decisión de arquitectura: docs/02-despliegue/arquitectura-aws.md (v5, Opción 1)
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

variable "facturas_pdf_url_template" {
  description = "Plantilla publica del PDF de facturas del IIMP con {ruc}-{tipo}-{serie}-{numero} (vacio = no inyectar)"
  type        = string
  default     = ""
}

variable "facturas_emisor_ruc" {
  description = "RUC emisor de las facturas del IIMP (vacio = no inyectar)"
  type        = string
  default     = ""
}

variable "liststand_api_url" {
  description = "URL base del API de stands del IIMP (liststand; Vinculacion). Pruebas: .../servicio-eventos-pruebas/api | Prod: .../servicio-eventos/api"
  type        = string
  default     = ""
}

variable "liststand_usuario" {
  description = "Usuario de la cuenta tecnica liststand (acceso VTA, secreto) — vacio = no crear secreto"
  type        = string
  default     = ""
  sensitive   = true
}

variable "liststand_clave" {
  description = "Clave de la cuenta tecnica liststand (acceso VTA, secreto) — vacio = no crear secreto"
  type        = string
  default     = ""
  sensitive   = true
}

variable "personas_api_url" {
  description = "URL base de servicio-persona (personas del ecosistema IIMP). Pruebas: .../servicio-persona/api"
  type        = string
  default     = ""
}

variable "personas_api_usuario" {
  description = "Usuario de la cuenta tecnica de servicio-persona (rol ESCRITURA, secreto) — vacio = no crear secreto"
  type        = string
  default     = ""
  sensitive   = true
}

variable "personas_api_clave" {
  description = "Clave de la cuenta tecnica de servicio-persona (secreto) — vacio = no crear secreto"
  type        = string
  default     = ""
  sensitive   = true
}

variable "email_from" {
  description = "Remitente de los correos transaccionales (debe ser del dominio verificado en Resend). Vacio = usa ADMIN_EMAIL"
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

variable "enable_exec_command" {
  description = "Habilita ECS Exec (SSM) para seed/mantenimiento sin SSH"
  type        = bool
  default     = true
}

variable "run_seed" {
  description = "Si true, el task ECS ejecuta el seed (roles+usuarios) al arrancar. Usar una vez y volver a false."
  type        = bool
  default     = false
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
variable "proteger_uploads" {
  description = "Protege los documentos de DD en /uploads/*: CloudFront reenvia la cookie de sesion (token) y x-api-key al origen y la app exige sesion (UPLOADS_PROTEGIDOS=true). Aplicar antes de habilitar en la app."
  type        = bool
  default     = false
}

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
  description = "Intervalo del health check del ALB (segundos). 10s acelera el rollout de ECS."
  type        = number
  default     = 10
}

variable "alb_health_check_timeout" {
  description = "Timeout del health check del ALB (segundos). Debe ser menor que el intervalo."
  type        = number
  default     = 5
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

variable "sgc_api_url" {
  description = "Base del API del SGC (SGC_API_URL) — vacio = no inyectar"
  type        = string
  default     = ""
}

variable "cron_secret" {
  description = "Secreto del cron de reconciliacion SGC (header x-cron-secret) — vacio = no crear"
  type        = string
  default     = ""
  sensitive   = true
}

variable "sgc_api_key" {
  description = "Bearer del API del SGC (rol contract-manager) — vacio = no crear"
  type        = string
  default     = ""
  sensitive   = true
}

variable "sgc_webhook_secret" {
  description = "Secreto HMAC de webhooks del SGC — vacio = no crear"
  type        = string
  default     = ""
  sensitive   = true
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

# ── Backups (protección de datos — plan: docs/06-operacion/plan-backups.md) ─
variable "dr_region" {
  description = "Region DR de los backups (CRR de documentos y replicas de secretos)"
  type        = string
  default     = "us-east-2"
}

variable "enable_crr" {
  description = "Replicar los documentos S3 a la region DR (backup real de la gestion documental)"
  type        = bool
  default     = true
}

variable "secrets_replica_enabled" {
  description = "Replicar los secretos de Secrets Manager a la region DR"
  type        = bool
  default     = true
}

variable "backup_schedule" {
  description = "Cron de AWS Backup para el EFS de uploads (UTC)"
  type        = string
  default     = "cron(0 2 * * ? *)"
}

variable "backup_retention_days" {
  description = "Retencion de los recovery points de AWS Backup (rotacion automatica)"
  type        = number
  default     = 35
}

variable "dump_schedule_cron" {
  description = "Cron de EventBridge del pg_dump diario (UTC)"
  type        = string
  default     = "cron(30 3 * * ? *)"
}

variable "dump_enabled" {
  description = "Activar la tarea diaria de pg_dump"
  type        = bool
  default     = true
}

variable "db_backup_bucket_prefix" {
  description = "Prefijo del bucket de dumps logicos de la BD"
  type        = string
  default     = "iimp-ctrst-db-backups"
}

variable "dump_expire_days" {
  description = "Dias para expirar el dump mas antiguo (rotacion automatica)"
  type        = number
  default     = 90
}

variable "backup_image_tag" {
  description = "Tag de la imagen de backup en ECR (lo pushea el CI: docker/db-backup)"
  type        = string
  default     = "db-backup"
}

variable "backup_task_cpu" {
  description = "CPU de la tarea de pg_dump (Fargate)"
  type        = string
  default     = "256"
}

variable "backup_task_memory" {
  description = "Memoria de la tarea de pg_dump (Fargate, MB)"
  type        = string
  default     = "512"
}

variable "backup_alert_email" {
  description = "Correo de alertas de fallo de backup — vacio = usa budget_alert_email"
  type        = string
  default     = ""
}

# Contract async: worker de contratos, cola y estado de jobs (Fase 1)
variable "contract_worker_enabled" {
  description = "Crear task definition/servicio del worker de contratos (false hasta publicar la imagen)"
  type        = bool
  default     = false
}

variable "contract_worker_image_tag" {
  description = "Tag de la imagen del worker en ECR"
  type        = string
  default     = "bootstrap"
}

variable "contract_worker_ecr_repository_name" {
  description = "Repositorio ECR del worker de contratos"
  type        = string
  default     = "iimp-contratos-stands-contract-worker"
}

variable "contract_worker_cpu" {
  description = "CPU Fargate del worker (2048 = 2 vCPU)"
  type        = string
  default     = "2048"
}

variable "contract_worker_cpu_architecture" {
  description = "Arquitectura de la imagen/tarea del worker: X86_64 o ARM64"
  type        = string
  default     = "X86_64"

  validation {
    condition     = contains(["X86_64", "ARM64"], var.contract_worker_cpu_architecture)
    error_message = "contract_worker_cpu_architecture debe ser X86_64 o ARM64."
  }
}

variable "contract_worker_memory" {
  description = "Memoria Fargate del worker en MB"
  type        = string
  default     = "4096"
}

variable "contract_worker_base_capacity" {
  description = "Tareas base on-demand del worker (0 = sin base fija)"
  type        = number
  default     = 0
}

variable "contract_worker_desired_count" {
  description = "Tareas deseadas del worker al crear el servicio"
  type        = number
  default     = 0
}

variable "contract_worker_min_capacity" {
  description = "Minimo de tareas del autoscaling del worker"
  type        = number
  default     = 0
}

variable "contract_worker_max_capacity" {
  description = "Maximo de tareas del autoscaling del worker"
  type        = number
  default     = 20
}

variable "contract_worker_sqs_target_value" {
  description = "Mensajes visibles por tarea objetivo para autoscaling"
  type        = number
  default     = 5
}

variable "contract_worker_enable_spot" {
  description = "Usar FARGATE_SPOT para el overflow del worker"
  type        = bool
  default     = true
}

variable "contract_worker_spot_weight" {
  description = "Peso de FARGATE_SPOT en el worker"
  type        = number
  default     = 3
}

variable "contract_worker_log_retention_days" {
  description = "Retencion de logs CloudWatch del worker"
  type        = number
  default     = 30
}

variable "contract_worker_concurrency" {
  description = "Mensajes/conversiones simultaneas por tarea"
  type        = number
  default     = 2
}

variable "contract_pdf_concurrency" {
  description = "Conversiones LibreOffice simultaneas por tarea"
  type        = number
  default     = 1
}

variable "contract_queue_visibility_timeout" {
  description = "Timeout de visibilidad SQS en segundos"
  type        = number
  default     = 900
}

variable "contract_queue_message_retention_seconds" {
  description = "Retencion de mensajes SQS en segundos"
  type        = number
  default     = 345600
}

variable "contract_queue_max_receive_count" {
  description = "Intentos antes de enviar a DLQ"
  type        = number
  default     = 3
}

variable "contract_s3_prefix" {
  description = "Prefijo S3 para contratos generados"
  type        = string
  default     = "contratos/"
}

variable "contract_jobs_ttl_days" {
  description = "Dias de retencion del estado de jobs en DynamoDB"
  type        = number
  default     = 90
}

variable "contract_async_ssm_parameter_name" {
  description = "Nombre del parametro SSM de la bandera de activacion (vacio = ruta por entorno)"
  type        = string
  default     = ""
}

variable "contract_async_enabled" {
  description = "Valor inicial de la bandera async (false = flujo sincrono)"
  type        = bool
  default     = false
}

variable "contract_async_percentage" {
  description = "Porcentaje inicial de canary (0..100)"
  type        = number
  default     = 0

  validation {
    condition     = var.contract_async_percentage >= 0 && var.contract_async_percentage <= 100
    error_message = "contract_async_percentage debe estar entre 0 y 100."
  }
}
