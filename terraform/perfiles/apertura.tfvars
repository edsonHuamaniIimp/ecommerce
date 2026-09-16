# ═══════════════════════════════════════════════════════════════════════════════
# PERFIL: APERTURA — oct-2026 (inicio de venta; demanda DESCONOCIDA)
# Uso: terraform apply -var-file=terraform.tfvars -var-file=perfiles/apertura.tfvars
# Objetivo: pre-escalar antes de la hora de apertura y dar techo amplio.
# R1: en prod, revisar el plan y autorizar.
# ═══════════════════════════════════════════════════════════════════════════════

# BD: sin auto-pausa (nada de reanudación en plena venta) y techo alto
aurora_min_acu = 1
aurora_max_acu = 16

# Cómputo: piso alto y techo amplio para absorber lo desconocido
desired_min_capacity = 4
desired_max_capacity = 16
desired_count_prod   = 4
desired_count_qa     = 1
task_cpu             = "1024"
task_memory          = "2048"

# Autoscaling agresivo (la estampida se mide en segundos)
autoscale_cpu_target           = 60
autoscale_request_count_target = 500

# SOLO el ALB recibe tráfico de CloudFront (no exponer el origen)
restrict_alb_to_cloudfront = true

# Pre-warm programado: encender antes de la hora de apertura (fechas/horas UTC).
# Ejemplo: apertura 08:00 hora Perú (13:00 UTC) → prewarm a las 12:50 UTC.
# Ajustar a la fecha real de apertura antes de aplicar.
scheduled_scalings = [
  {
    name     = "prewarm-apertura"
    schedule = "cron(50 12 * * ? *)"
    min      = 8
    max      = 16
    timezone = "UTC"
  },
]

enable_cloudfront = true
enable_waf        = true
waf_rate_limit    = 2000
