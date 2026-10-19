# Observacion de documentos (revision del Asociado)

> Fuente: `src/application/solicitudes/solicitudes-service.ts`,
> `src/infrastructure/persistence/solicitudes-repository.ts`,
> `src/components/solicitudes/{solicitud-review,mis-solicitudes-manager,cliente-upload-modal}.tsx`,
> `src/lib/shared/utils/solicitud-documentos.ts`, `src/proxy.ts`.

## 1. Proposito

Permitir que el revisor del area **Asociado** observe documentos del cliente con una
justificacion, notifique al cliente y este suba nuevas versiones y reenvie la solicitud
a revision. El ciclo **observar -> subsanar -> reenviar** puede repetirse N veces.

No se elimina nada fisicamente: los documentos y sus archivos se conservan como
historial y solo cambian de estado logico.

## 2. Roles y permisos

| Accion | Quien | Regla |
|---|---|---|
| Observar documentos | `solicitudes:review:asociado` o admin | Solo documentos **vigentes subidos por el cliente** (`user_id` no nulo). |
| Ver sus solicitudes / subsanar | Cliente titular | El proxy permite `/api/solicitudes` con `mis-reservas:view`; los controllers validan dueno. |
| Regenerar/subir contrato | Admin (`solicitudes:upload` / admin) | El contrato del administrador **no es observable** por el revisor. |
| Reenviar a revision | Cliente titular | Solo si todos los observados fueron reemplazados y, si aplica, el contrato corregido fue firmado. |

## 3. Estados

- `solicitud.estado` calculado: `pendiente`, `en_proceso`, `observado`, `aprobado`,
  `rechazado`, `pendiente_pago`, `pagado`.
- `solicitud_documento.estado` (`ESTADOS_DOCUMENTO_SOLICITUD`):
  `activo`, `observado`, `reemplazado`, `baja`.
- Catalogos maestra: `solicitud_estado` (item 7 "Observado"), `revision_estado`
  (item 4 "Observado") y `documento_estado` (activo/observado/reemplazado/baja).

## 4. Flujo

1. **Asociado observa** uno o varios documentos **del cliente** con justificacion.
   - El backend exige motivo, al menos un documento y que cada documento pertenezca
     a la solicitud, este activo y tenga `user_id` (cliente).
   - Los documentos pasan a `observado` con `motivo_observacion`, `observado_por` y
     `observado_at`. La revision Asociado queda `observado` y la solicitud se calcula
     como `observado`.
   - Se envia alerta en campana y correo (ES/EN) con el detalle.
2. **Cliente subsana** desde `/dashboard/mis-solicitudes`:
   - Ve la accion requerida y el motivo en la tarjeta.
   - Sube nuevas versiones de los anexos observados y/o firma el contrato.
   - La version anterior del mismo requisito/categoria pasa a `reemplazado`.
3. **Cliente reenvia** (`POST /api/solicitudes/reenviar-observacion`):
   - Exige que **todos** los observados tengan una version vigente posterior.
   - Si se observo el contrato firmado, exige un `contrato_firmado` vigente posterior
     al contrato vigente del administrador.
   - Los observados pendientes pasan a `reemplazado`, la revision Asociado vuelve a
     `pendiente` y se alerta a los revisores.
4. Si el contrato esta errado, el **admin** lo corrige (regenerar plantilla o subir un
   PDF) y el cliente firma/descarga esa version vigente. El contrato del admin nunca
   se observa.

## 5. Reglas de negocio

- **Solo documentos del cliente son observables**; el contrato del admin es lectura.
- **Firma digital**: solo aplica al contrato generado por el sistema. Si el admin subio
  un PDF corregido como archivo, el cliente debe descargarlo, firmarlo y subirlo.
- **Firma manual previa**: mientras exista un firmado vigente de la version actual, la
  firma digital queda deshabilitada; si el cliente elimina esa firma de la iteracion
  actual, se habilita de nuevo.
- **Eliminacion logica**: el cliente solo puede dar de baja documentos subidos en la
  **iteracion actual** (posteriores a la ultima actualizacion de revision). Las
  versiones de iteraciones pasadas son historial y no se eliminan.
- **Ultimas versiones oficiales**: solo las versiones vigentes (`activo`) son las que
  se consideran para la aprobacion y para la integracion SGC.

## 6. UI

- **Revisar solicitud** (`/dashboard/solicitudes`): documentos agrupados por documento
  logico; version actual arriba y "Ver versiones anteriores (N)" colapsable. Solo la
  version actual del cliente muestra el checkbox "Observar".
- **Mis solicitudes**: tarjeta con "Accion requerida", motivo, boton "Subsanar
  observacion" y estado del reenvio. El detalle es informativo (sin acciones duplicadas).
- **Modal de subsanacion**: muestra la observacion, el contrato vigente con Ver/Descargar
  y vista previa, los anexos observados y la firma anterior. Bloquea el envio si faltan
  anexos observados por reemplazar.

## 7. Endpoints

| Metodo | Ruta | Uso |
|---|---|---|
| `POST` | `/api/solicitudes/revisar` | Body incluye `documentosObservados[]` cuando `estado=observado`. |
| `POST` | `/api/solicitudes/reenviar-observacion` | Cliente reenvia tras subsanar. |
| `POST` | `/api/solicitudes/upload-doc` | Nueva version (anexo/firmado); auto-reemplaza la vigente. |
| `POST` | `/api/solicitudes/eliminar-doc` | Baja logica del documento de la iteracion actual. |
| `GET` | `/api/solicitudes/listar` | Filtros de bandeja; cliente solo ve lo propio. |

## 8. Integracion SGC

- Se envia el **ultimo contrato firmado vigente**; si no existe, el ultimo contrato
  vigente del administrador.
- Los anexos enviados son solo documentos **activos** (`estado` nulo/`activo`); se
  excluyen `observado`, `reemplazado` y `baja`.
- Las versiones anteriores quedan en la tabla como historial y nunca se envian al SGC.

## 9. Limites

- La regeneracion automatica del contrato al observar ya no existe: la observacion solo
  aplica al cliente. La correccion del contrato del admin es una accion manual del admin.
- Documentos legacy en el campo JSON `solicitud.documentos` no tienen ID de fila y no son
  observables individualmente; se conservan para compatibilidad.
