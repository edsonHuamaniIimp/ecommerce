# MÃ³dulo network: VPC 2 AZ, subnets pÃºblicas (ALB) y privadas (ECS/BD), NAT opcional,
# y Gateway Endpoint de S3 (gratis: saca el trÃ¡fico de documentos del NAT).
# R3: hashtag base lo garantiza default_tags del provider; aquÃ­ solo component.

variable "environment" {
  description = "Entorno (qa | prod)"
  type        = string
}

variable "aws_region" {
  description = "Region AWS"
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR de la VPC (R2: variable, no hardcodeado)"
  type        = string
}

variable "enable_nat_gateway" {
  description = "Crear NAT Gateway (IP de salida fija). En qa se desactiva (ahorra ~$33/mes)"
  type        = bool
}

variable "az_count" {
  description = "Cantidad de zonas de disponibilidad / subnets por tipo (R2)"
  type        = number
}

locals {
  tags = merge(var.common_tags, { component = "network" })
  name = "iimp-ctrst-${var.environment}"
}

data "aws_availability_zones" "available" {
  state = "available"
}

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = merge(local.tags, { Name = "${local.name}-vpc" })
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = merge(local.tags, { Name = "${local.name}-igw" })
}

resource "aws_subnet" "public" {
  count                   = var.az_count
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 8, count.index)
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true

  tags = merge(local.tags, { Name = "${local.name}-public-${count.index + 1}" })
}

resource "aws_subnet" "private" {
  count             = var.az_count
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index + var.az_count)
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = merge(local.tags, { Name = "${local.name}-private-${count.index + 1}" })
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = merge(local.tags, { Name = "${local.name}-public-rt" })
}

resource "aws_route_table_association" "public" {
  count          = var.az_count
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# NAT Gateway â€” solo cuando se pide (prod: IP de salida fija para integraciones IIMP)
resource "aws_eip" "nat" {
  count  = var.enable_nat_gateway ? 1 : 0
  domain = "vpc"
  tags   = merge(local.tags, { Name = "${local.name}-nat-eip" })
}

resource "aws_nat_gateway" "main" {
  count         = var.enable_nat_gateway ? 1 : 0
  allocation_id = aws_eip.nat[0].id
  subnet_id     = aws_subnet.public[0].id

  depends_on = [aws_internet_gateway.main]

  tags = merge(local.tags, { Name = "${local.name}-nat" })
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id

  dynamic "route" {
    for_each = var.enable_nat_gateway ? [1] : []
    content {
      cidr_block     = "0.0.0.0/0"
      nat_gateway_id = aws_nat_gateway.main[0].id
    }
  }

  tags = merge(local.tags, { Name = "${local.name}-private-rt" })
}

resource "aws_route_table_association" "private" {
  count          = var.az_count
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}

# â”€â”€ Gateway Endpoint de S3 (SIN COSTO) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# El trafico de documentos hacia S3 deja de pasar por el NAT (evita su consumo).
resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.main.id
  service_name      = "com.amazonaws.${var.aws_region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = [aws_route_table.public.id, aws_route_table.private.id]

  tags = merge(local.tags, { Name = "${local.name}-s3-endpoint" })
}

output "vpc_id" {
  description = "ID de la VPC"
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "Subnets pÃºblicas (ALB)"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "Subnets privadas (ECS, Aurora)"
  value       = aws_subnet.private[*].id
}

output "s3_endpoint_id" {
  description = "ID del Gateway Endpoint de S3"
  value       = aws_vpc_endpoint.s3.id
}

variable "common_tags" {
  description = "Etiquetas base del proyecto (R3): project, environment, managed-by, cost-center"
  type        = map(string)
}
