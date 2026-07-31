#!/usr/bin/env bash
# ─── S3 Bucket Setup — Proyecto ContratosStands ───────────────────────────
# Uso: bash scripts/s3-setup.sh <bucket-name> <region>
# Ejemplo: bash scripts/s3-setup.sh ctrst-archivos-prod us-east-1
#
# Requisitos:
#   - AWS CLI instalado y configurado (aws configure)
#   - Permisos IAM: s3:CreateBucket, s3:PutBucketPolicy, s3:PutBucketCors,
#                   s3:PutPublicAccessBlock, s3:PutBucketTagging

set -euo pipefail

BUCKET="${1:?❌  Error: Debe especificar el nombre del bucket}"
REGION="${2:-us-east-1}"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

echo "📦  Creando bucket S3: $BUCKET en region $REGION ..."

# ─── 1. Crear bucket ──────────────────────────────────────────────────────
if [ "$REGION" = "us-east-1" ]; then
  aws s3api create-bucket \
    --bucket "$BUCKET" \
    --region "$REGION"
else
  aws s3api create-bucket \
    --bucket "$BUCKET" \
    --region "$REGION" \
    --create-bucket-configuration LocationConstraint="$REGION"
fi

echo "✅  Bucket creado."

# ─── 2. Bloquear acceso publico ───────────────────────────────────────────
aws s3api put-public-access-block \
  --bucket "$BUCKET" \
  --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

echo "✅  Acceso publico bloqueado."

# ─── 3. Politica de bucket — solo HTTPS ──────────────────────────────────
POLICY=$(cat <<POL
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:*",
      "Resource": [
        "arn:aws:s3:::$BUCKET",
        "arn:aws:s3:::$BUCKET/*"
      ],
      "Condition": {
        "Bool": {"aws:SecureTransport": "false"}
      }
    }
  ]
}
POL
)
aws s3api put-bucket-policy --bucket "$BUCKET" --policy "$POLICY"
echo "✅  Politica HTTPS-only aplicada."

# ─── 4. Tags ──────────────────────────────────────────────────────────────
aws s3api put-bucket-tagging \
  --bucket "$BUCKET" \
  --tagging "TagSet=[{Key=Proyecto,Value=ContratosStands},{Key=Entorno,Value=Produccion}]"

echo "✅  Tags aplicadas."

# ─── 5. Configurar el bucket para hosting estatico de _next/static ───────
CORS=$(cat <<CORS
{
  "CORSRules": [
    {
      "AllowedOrigins": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
      "AllowedHeaders": ["*"],
      "MaxAgeSeconds": 3600
    }
  ]
}
CORS
)
aws s3api put-bucket-cors --bucket "$BUCKET" --cors-configuration "$CORS"
echo "✅  CORS configurado."

# ─── Resumen ──────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  Bucket S3 listo para usar                              ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║  Nombre:    $BUCKET"
echo "║  Region:    $REGION"
echo "║  Cuenta:    $ACCOUNT_ID"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║  Agrega al .env.prod:                                   ║"
echo "║    STORAGE_PROVIDER=s3                                  ║"
echo "║    S3_BUCKET=$BUCKET"
echo "║    S3_REGION=$REGION"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "⚠️   Recuerda configurar en GitHub Secrets:"
echo "    AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_BUCKET, AWS_DEFAULT_REGION"
echo "    EC2_HOST, EC2_USERNAME, EC2_SSH_KEY, EC2_PORT, EC2_APP_PATH, EC2_GIT_TOKEN"
