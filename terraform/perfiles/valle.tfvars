# ═══════════════════════════════════════════════════════════════════════════════
# PERFIL: VALLE — entre eventos (18 meses de los 22 de la ventana de venta)
# Uso: terraform apply -var-file=terraform.tfvars -var-file=perfiles/valle.tfvars
# Objetivo: costo mínimo. La BD se auto-pausa y el servicio queda en 1 tarea.
# ═══════════════════════════════════════════════════════════════════════════════

# Base de datos: auto-pausa a 0 ACU (solo storage cuando nadie usa la app)
aurora_min_acu = 0
aurora_max_acu = 4

# Cómputo: 1 tarea base, techo bajo
desired_min_capacity = 1
desired_max_capacity = 4
desired_count_prod   = 1
desired_count_qa     = 1
task_cpu             = "512"
task_memory          = "1024"

# Sin pre-warm programado
scheduled_scalings = []

# CDN/WAF activos (baratos y protegen la ventana comercial)
enable_cloudfront = true
enable_waf        = true
