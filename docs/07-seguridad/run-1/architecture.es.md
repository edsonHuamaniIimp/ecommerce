# Arquitectura — ContratosStands

## 1. Producto, principales, autoridad normal, recursos protegidos

Aplicación web para reservar stands de exhibición en eventos del IIMP (PERUMIN, ProExplo,
WMC, GESS). Es un orquestador/handler frente al sistema legado GeneXus/SAP(HANA);
la facturación y los datos maestros de empresa/persona permanecen en SAP/KBServicios. Ref de
origen `de1ebbc` (`main`), árbol de trabajo sucio solo por el directorio de skills no rastreado.

Principales, de menor a mayor confianza:

- **Anónimo** — sin sesión. Por diseño: páginas públicas (`/`, `/403`, `/presala`,
  `/auth/login`), prefijos de API públicos `/api/auth/`, `/api/maestra/`, y rutas
  exactas `/api/exhibidoras`, `/api/stands/exhibidora`, `/api/stands/contrato`,
  `/api/planos/publico` (`src/lib/shared/constants.ts:16-36`).
- **Par M2M (Sistema de Montaje)** — header `x-api-key` compartido
  (`src/lib/server/integracion-m2m.ts:10-16`). Lee el estado de exhibidor/stand/contrato.
- **`cliente`** — rol de cliente; puede leer sus propias solicitudes y crear
  reservas (`src/lib/shared/constants.ts:212`).
- **Áreas internas `logistica` / `legal` / `comunicacion`** — revisan solicitudes
  (`src/lib/shared/constants.ts:209-211`, orden de revisión `:290-314`).
- **`admin`** — `admin:full` más todos los permisos; bypass duro en el middleware
  (`src/middleware.ts:63`) y en `hasPermission` (`src/lib/server/auth.ts:71`).
- **Operadores de CI/workload** — GitHub Actions con clave SSH de EC2 + token de git,
  claves de acceso de AWS (`deploy.yml`), y el rol IAM de la tarea ECS.

Recursos protegidos: registros de contrato/solicitud y sus documentos, estado de facturación y
pago, datos de exhibidor/stand/plano, roles y permisos de usuario, consultas de PII
(DNI/RUC), y las credenciales usadas para alcanzar servicios externos.

## 2. Línea base comparable

El comparable más cercano anclado en el código fuente es un BFF pequeño de Next.js con
múltiples roles sobre un ESB legado: JWT en cookie de sesión + lista de permisos por ruta,
Prisma sobre PostgreSQL, S3/EFS para cargas, una pasarela de pago saliente, y despliegue
con Terraform/ECS. Dichas aplicaciones normalmente aún centralizan la autorización en un
solo middleware/guard y almacenan hashes de contraseña (Argon2/bcrypt). Donde este repositorio
acepta un trade-off más débil (sin hashing de contraseñas, autorización dividida entre
middleware y controladores), la línea base se usa solo para calibración.

## 3. Stack, rutas de despliegue, límites de build/test offline

TypeScript strict, Next.js 16.2 App Router (Turbopack), React 19, Prisma 7 + pg,
Tailwind v4 + IIMP UI kit, Vitest. La autenticación es un **JWT HS256 personalizado**;
`@auth0/nextjs-auth0` está declarado pero no se importa en ningún lugar de `src/`.

Modos de despliegue (selección determinista): **A)** EC2 + Docker Compose con nginx
+ supervisord, código fuente montado sobre `/app`, puertos 80/443 (`Dockerfile`,
`docker-compose.prod.yml:27-68`); **B)** ECS Fargate + Aurora + ALB/CloudFront/WAF
(`Dockerfile.ecs`, `terraform/`), declarado en la documentación pero sin automatización
en el repo que construya/publique la imagen; **local** solo PostgreSQL (`docker-compose.yml`).

Build/test offline: `npm test` (3 specs de Vitest con mocks), `npm run lint`,
`npx tsc --noEmit`, y `next build` con env de marcador de posición se declaran ejecutables.
No hay ningún sandbox impuesto por el SO disponible en este host, así que **no se ejecutó
código controlado por el objetivo** en esta corrida; los comandos de build/test se listan
solo como verificaciones candidatas y la ausencia del sandbox es un blocker de
needs-validation para cualquier afirmación que dependa de la ejecución.

## 4. Superficies de entrada y rutas importantes de source-to-sink

- ~60 route handlers bajo `src/app/api/**`, despachados a través de un mapa
  slug→action (`src/lib/server/router.ts:27-52`). **No existen Server Actions.**
- Parseo de body/query en `src/controllers/*`; Zod solo en algunas rutas.
- Sinks: Prisma (parametrizado; un `$queryRawUnsafe` en
  `src/infrastructure/persistence/evento-repository.ts:7,83` con parámetros vinculados),
  escrituras a filesystem/S3 (`src/lib/server/storage.ts:10-47`), fetches salientes a
  KBServicios/Niubiz/SUNAT/Resend, HTML de correo construido por interpolación de
  strings (`src/lib/server/email.ts`, `email-templates.ts`), y generación de código
  TypeScript (`src/application/planos/planos-service.ts`, `src/lib/shared/utils/ts-codegen.ts`).
- Copias almacenadas/derivadas: `GessStand.rawData` JSON, `Solicitud.documentos`,
  `SolicitudDocumento.url`, `ErrorLog`, historiales de auditoría/revisión, `UserRole.password`
  y `resetToken` en texto plano.

## 5. Límites de confianza y control más fuerte visible en el código fuente

| Límite | Ubicación | Control más fuerte visible en el código fuente |
|---|---|---|
| Edge/CDN/WAF | `terraform/modules/cloudfront/main.tf:74-249` | Reglas administradas de AWS + límite de tasa por IP; sin reglas de path/auth |
| Middleware de edge | `src/middleware.ts:12-84` | Verificación de JWT HS256 + lista de permisos por prefijo; los prefijos públicos hacen bypass |
| Route handlers | `src/app/api/**` | Depende de la ruta: `getSession()`/`requireAdmin` del controlador, o nada |
| Par M2M | `src/lib/server/integracion-m2m.ts` | `x-api-key` compartido; deshabilitado cuando `NODE_ENV !== "production"` |
| Alcance de objeto/propietario | repositories | Filtros opcionales `userId`/`eventoId`; las alertas son los únicos datos con alcance de propietario confiable |
| Almacén de credenciales | `src/application/auth/auth-service.ts:20-29`, `prisma/schema.prisma:125` | Ninguno: comparación en texto plano, `123456` por defecto, token de reset con `Math.random()` |
| Workload/IAM | `terraform/modules/ecs/main.tf:387-449` | Un único rol de tarea = rol de ejecución, permisos amplios de S3/Secrets/EFS |

## 6. Rutas de inicio

`src/middleware.ts`; `src/lib/server/{auth,integracion-m2m,router,storage,email}.ts`;
`src/controllers/*.controller.ts`; `src/application/**`; `src/infrastructure/**`;
`prisma/schema.prisma`; `docker/**`; `terraform/**`; `.github/workflows/deploy.yml`.

## 7. Cobertura previa

No existe un `coverage-ledger.json`/`findings.json` previo compatible para este repo.
Esta es la corrida 1 e implica que no hay cobertura previa. La corrida es parcial por construcción.

## 8. Selección de companions

Límites dentro del alcance que requieren bloques companion: cargas entregadas al navegador y
renderizado de contenido almacenado (`CLIENT-SIDE.md`), semántica de sesión/JWT/CSRF/reset/API-key
(`WEB-PROTOCOL-AND-AUTH.md`), lectura/escritura entre registros y expansión de copias almacenadas
(`DATA-ISOLATION-AND-LIFECYCLE.md`), carga/amplificación no autenticada
(`RESOURCE-EXHAUSTION-AND-AVAILABILITY.md`), CI/despliegue privilegiado
(`SUPPLY-CHAIN-AND-RELEASE.md`), y precedencia de container/IAM/secret
(`CLOUD-AND-DEPLOYMENT.md`). Los companions native, AI/LLM, RPC, y desktop/mobile
se consideraron y excluyeron: no existe código native/FFI, ni runtime de modelo/tool, ni
servicio broker/RPC, ni cliente desktop/mobile en el repositorio.
