# Módulo aurora: Aurora PostgreSQL Serverless v2 (elasticidad sin reboot)
# R2: ACUs y retenciones por variable. R3: hashtag base por default_tags; aquí solo component.
#
# Por qué Aurora v2 y no RDS: en la apertura comercial la BD puede crecer 0→16 ACU en
# segundos SIN reiniciar (RDS exigiría un reboot de 5-10 min con clientes pagando).

variable "environment" {
  description = "Entorno (qa | prod)"
  type        = string
}

variable "vpc_id" {
  description = "VPC donde vive el cluster"
  type        = string
}

variable "private_subnet_ids" {
  description = "Subnets privadas (>=2 AZ) para el subnet group"
  type        = list(string)
}

variable "vpc_cidr" {
  description = "CIDR de la VPC (para el SG de acceso) (R2)"
  type        = string
}

variable "db_name" {
  description = "Nombre de la BD (R2)"
  type        = string
}

variable "db_username" {
  description = "Usuario master (R2)"
  type        = string
}

variable "engine_version" {
  description = "Version de Aurora PostgreSQL (R2)"
  type        = string
}

variable "min_acu" {
  description = "ACU minimo (0 = auto-pausa entre eventos) (R2)"
  type        = number
}

variable "max_acu" {
  description = "ACU maximo (techo de escalado) (R2)"
  type        = number
}

variable "seconds_until_auto_pause" {
  description = "Segundos de inactividad antes de auto-pausar (aplica si min_acu = 0) (R2)"
  type        = number
}

variable "instance_class" {
  description = "Clase de instancia del cluster (Serverless v2 = db.serverless) (R2)"
  type        = string
}

variable "instance_count" {
  description = "Instancias del cluster (1 = solo writer; 2 = writer + reader para HA) (R2)"
  type        = number
}

variable "backup_retention_period" {
  description = "Retencion de backups en dias (R2)"
  type        = number
}

locals {
  tags = merge(var.common_tags, { component = "database" })
  name = "iimp-ctrst-${var.environment}"
}

resource "aws_db_subnet_group" "main" {
  name       = "${local.name}-db-subnet"
  subnet_ids = var.private_subnet_ids

  tags = local.tags
}

resource "aws_security_group" "aurora" {
  name   = "${local.name}-aurora-sg"
  vpc_id = var.vpc_id

  ingress {
    description = "PostgreSQL desde la app (ECS)"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.tags, { Name = "${local.name}-aurora-sg" })
}

resource "random_password" "master" {
  length  = 32
  special = false
}

resource "aws_rds_cluster" "main" {
  cluster_identifier = "${local.name}-aurora"
  engine             = "aurora-postgresql"
  engine_version     = var.engine_version
  database_name      = var.db_name
  master_username    = var.db_username
  master_password    = random_password.master.result

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.aurora.id]

  storage_encrypted = true
  apply_immediately = true

  backup_retention_period   = var.backup_retention_period
  skip_final_snapshot       = var.environment != "prod"
  final_snapshot_identifier = var.environment == "prod" ? "${local.name}-aurora-final" : null

  # Elasticidad: 0 ACU = auto-pausa (valle) · N ACU = techo de la apertura
  serverlessv2_scaling_configuration {
    min_capacity             = var.min_acu
    max_capacity             = var.max_acu
    seconds_until_auto_pause = var.min_acu == 0 ? var.seconds_until_auto_pause : null
  }

  tags = local.tags
}

resource "aws_rds_cluster_instance" "main" {
  count = var.instance_count

  identifier         = "${local.name}-aurora-${count.index + 1}"
  cluster_identifier = aws_rds_cluster.main.id
  instance_class     = var.instance_class
  engine             = aws_rds_cluster.main.engine
  engine_version     = aws_rds_cluster.main.engine_version

  apply_immediately = true

  tags = local.tags
}

output "cluster_identifier" {
  description = "Identificador del cluster (métricas de capacidad)"
  value       = aws_rds_cluster.main.cluster_identifier
}

output "endpoint" {
  description = "Writer endpoint del cluster (host para DATABASE_URL)"
  value       = aws_rds_cluster.main.endpoint
  sensitive   = true
}

output "database_name" {
  description = "Nombre de la BD"
  value       = aws_rds_cluster.main.database_name
}

output "username" {
  description = "Usuario master"
  value       = aws_rds_cluster.main.master_username
  sensitive   = true
}

output "password" {
  description = "Password master (a Secrets Manager)"
  value       = random_password.master.result
  sensitive   = true
}

variable "common_tags" {
  description = "Etiquetas base del proyecto (R3): project, environment, managed-by, cost-center"
  type        = map(string)
}
