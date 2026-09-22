# Pedido al equipo del SGC — credencial y catálogos para cerrar la integración

> Documento para enviar al equipo que desarrolla el SGC (autor de `APIS_USE_HOOKS.md`).
> Contexto: ContratosStands (sistema de separación de stands) es el **cliente**; el SGC es el
> **proveedor** de `/api/integrations/v1/*` y de los webhooks.
> Estado: el host y la autenticación ya se probaron contra producción (ver evidencia).

## Hallazgo importante

El dominio de la API de integración **no aparece en `APIS_USE_HOOKS.md`**. El único dominio que
menciona la guía es `canal-seguro.sistemasiimp.org.pe` (que según su §5.5 es nuestro host de
webhooks, no el suyo). Nosotros encontramos el host real por prueba:

```
SGC_API_URL = https://gestion-contratos.sistemasiimp.org.pe/api/integrations/v1
```

Sugerimos **agregar esa URL a la documentación** para que el próximo integrador no tenga que
adivinar el host.

## Lo que necesitamos

1. **`SGC_API_KEY`** (`sgc_<clave>`) del actor de servicio con rol `Responsable de contratos`
   (`contract-manager`). Es el bloqueo principal: la API la exige (ver evidencia).
2. **`areaCode`** para "separación de stands" (lo define el SGC).
3. **`contractTypeCode`** para "separación de stands" (lo define el SGC).
4. **Webhooks** (cuando lo habiliten):
   - Confirmar qué host autorizan como receptor.
   - Registrar `POST https://ecommerce.sistemasiimp.org.pe/api/integracion/sgc/webhook`.
   - Enviar el **secreto HMAC** de la suscripción.

## Evidencia de la prueba (22 set. 2026)

```
GET https://gestion-contratos.sistemasiimp.org.pe/api/integrations/v1/contracts
                                                              -> 401 {"error":"No autorizado."}
GET .../api/integrations/v1/contracts
    (Authorization: Bearer sgc_invalida)                      -> 401 {"error":"No autorizado."}
GET .../api/integrations/v1                                   -> 404 (base de la app)
```

Interpretación: el servicio **está arriba** (Next.js + Auth.js detrás de CloudFront) y la API de
integración **sí exige la credencial**. Sin `sgc_<clave>` válida toda llamada responde 401.

### Reproducción

```bash
curl -i https://gestion-contratos.sistemasiimp.org.pe/api/integrations/v1/contracts
curl -i -H "Authorization: Bearer sgc_invalida" \
     https://gestion-contratos.sistemasiimp.org.pe/api/integrations/v1/contracts
```

## Qué desbloquea la prueba end-to-end

Con `SGC_API_KEY` + `areaCode` + `contractTypeCode` ejecutamos el flujo completo: crear
expediente → subir contrato v1 → consultar estado/stepper → recibir webhook → subsanar →
descargar.

## Nuestro lado (referencia)

- Fases 0–6 implementadas; `npx tsc --noEmit` y `npx eslint` en 0 errores.
- Integración **dormida** (`SGC_ENABLED=0`) hasta tener credencial. Al recibirla se activa solo
  con variables de entorno (`SGC_MODE=real`), sin recompilar.
- Doc de diseño: `docs/05-integraciones/integracion-sgc.md`.
