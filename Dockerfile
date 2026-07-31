# ─── Dockerfile — Proyecto ContratosStands ───────────────────────────────
# Imagen base: Node.js 20 + Nginx
# El codigo de la app se monta como volumen, NO se copia en la imagen.
# Esto evita rebuilds costosos en cada deploy.

FROM node:20-bookworm-slim

LABEL maintainer="IIMP"
LABEL description="ContratosStands — Base image"

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}
ENV NEXT_TELEMETRY_DISABLED=1
ENV NPM_CONFIG_LOGLEVEL=warn

# ─── System dependencies ──────────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx curl ca-certificates supervisor \
    && rm -rf /var/lib/apt/lists/*

# ─── Workdir ──────────────────────────────────────────────────────────────
WORKDIR /app

# ─── JS deps (cacheable) ──────────────────────────────────────────────────
COPY package.json package-lock.json ./
RUN npm ci --include=dev \
    && npm cache clean --force

# ─── Prisma Client (cacheable) ────────────────────────────────────────────
COPY prisma/schema.prisma prisma/
COPY prisma.config.ts prisma/
RUN npx prisma generate

# ─── Nginx ────────────────────────────────────────────────────────────────
COPY docker/nginx.conf /etc/nginx/sites-enabled/default
RUN rm -f /etc/nginx/sites-enabled/default.dpkg-dist 2>/dev/null || true
RUN ln -sf /dev/stdout /var/log/nginx/access.log \
    && ln -sf /dev/stderr /var/log/nginx/error.log

# ─── Supervisor ───────────────────────────────────────────────────────────
COPY docker/supervisord.conf /etc/supervisor/conf.d/contratosstands.conf

# ─── Entrypoint ───────────────────────────────────────────────────────────
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# ─── Limpieza ─────────────────────────────────────────────────────────────
RUN apt-get clean && rm -rf /tmp/* /var/tmp/* /var/cache/apt/*

EXPOSE 80 443

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
