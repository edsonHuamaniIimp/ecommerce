# Módulo uploads: EFS para los archivos subidos (/app/public/uploads compartido entre tareas)
#
# Por qué EFS: el adaptador S3 actual del proyecto hace un PUT SIN FIRMA con ACL public-read,
# por lo que NO funciona contra un bucket privado (ver arquitectura-aws.md §10, pendiente).
# Mientras se implemente la subida con URLs prefirmadas, los uploads se persisten en EFS.
# R2: parámetros por variable. R3: hashtag base por default_tags; aquí solo component.

variable "environment" {
  description = "Entorno (qa | prod)"
  type        = string
}

variable "vpc_id" {
  description = "VPC"
  type        = string
}

variable "subnet_ids" {
  description = "Subnets donde se crean los mount targets (las mismas donde corren las tareas)"
  type        = list(string)
}

variable "vpc_cidr" {
  description = "CIDR de la VPC (para permitir NFS) (R2)"
  type        = string
}

variable "posix_uid" {
  description = "UID del proceso Node en el contenedor (nextjs = 1001 según Dockerfile.ecs)"
  type        = number
}

variable "posix_gid" {
  description = "GID del proceso Node en el contenedor (nodejs = 1001)"
  type        = number
}

variable "mount_target_count" {
  description = "Cantidad de mount targets a crear (debe ser <= cantidad de subnets)"
  type        = number
}

variable "transition_to_ia_days" {
  description = "Dias para mover archivos no accedidos a Infrequent Access (0 = desactivado)"
  type        = number
}

locals {
  tags = merge(var.common_tags, { component = "storage" })
  name = "iimp-ctrst-${var.environment}"
}

resource "aws_efs_file_system" "uploads" {
  creation_token = "${local.name}-uploads"
  encrypted      = true

  lifecycle_policy {
    transition_to_ia = var.transition_to_ia_days > 0 ? "AFTER_${var.transition_to_ia_days}_DAYS" : "AFTER_30_DAYS"
  }

  tags = merge(local.tags, { Name = "${local.name}-uploads" })
}

resource "aws_security_group" "efs" {
  name   = "${local.name}-efs-sg"
  vpc_id = var.vpc_id

  ingress {
    description = "NFS desde las tareas"
    from_port   = 2049
    to_port     = 2049
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.tags, { Name = "${local.name}-efs-sg" })
}

resource "aws_efs_mount_target" "uploads" {
  count = var.mount_target_count

  file_system_id  = aws_efs_file_system.uploads.id
  subnet_id       = var.subnet_ids[count.index]
  security_groups = [aws_security_group.efs.id]
}

resource "aws_efs_access_point" "uploads" {
  file_system_id = aws_efs_file_system.uploads.id

  posix_user {
    uid = var.posix_uid
    gid = var.posix_gid
  }

  root_directory {
    path = "/uploads"

    creation_info {
      owner_uid   = var.posix_uid
      owner_gid   = var.posix_gid
      permissions = "0755"
    }
  }

  tags = merge(local.tags, { Name = "${local.name}-uploads-ap" })
}

output "file_system_id" {
  description = "ID del file system EFS"
  value       = aws_efs_file_system.uploads.id
}

output "access_point_id" {
  description = "ID del access point (volumen de la task definition)"
  value       = aws_efs_access_point.uploads.id
}

variable "common_tags" {
  description = "Etiquetas base del proyecto (R3): project, environment, managed-by, cost-center"
  type        = map(string)
}
