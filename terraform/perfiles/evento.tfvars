# ═══════════════════════════════════════════════════════════════════════════════
# PERFIL: EVENTO — meses de campaña/cobranza (3 meses, uso laboral + staff)
# Uso: terraform apply -var-file=terraform.tfvars -var-file=perfiles/evento.tfvars
# Objetivo: respuesta ágil sin el costo del perfil de apertura.
# ═══════════════════════════════════════════════════════════════════════════════

# BD: sin auto-pausa en horario de oficina (evita la reanudación en el primer click)
aurora_min_acu = 0.5
aurora_max_acu = 8

# Cómputo: piso 2 tareas, techo 8
desired_min_capacity = 2
desired_max_capacity = 8
desired_count_prod   = 2
desired_count_qa     = 1
task_cpu             = "512"
task_memory          = "1024"

# Autoscaling más sensible
autoscale_cpu_target           = 65
autoscale_request_count_target = 700

# Sin pre-warm (la campaña no tiene una hora exacta de estampida)
scheduled_scalings = []

enable_cloudfront = true
enable_waf        = true
