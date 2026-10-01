# DESIGN_STITCH.md — Master UX/UI Specification for Stitch
## Sistema Integral de Evaluaciones IIMP

> Documento maestro para que Stitch genere **todas las vistas, estados y flujos necesarios** del Sistema Integral de Evaluaciones IIMP.
> Este archivo debe usarse como especificación visual y funcional. No debe interpretarse como una simple guía estética: representa el alcance completo de pantallas del producto.

---

# 1. Objetivo del diseño

Diseñar una plataforma interna de evaluaciones para el Instituto de Ingenieros de Minas del Perú (IIMP), accesible exclusivamente con cuentas institucionales `@iimp.org.pe`.

El sistema debe sentirse:

- corporativo;
- moderno;
- sobrio;
- altamente intuitivo;
- rápido;
- confiable;
- visualmente limpio;
- accesible;
- consistente;
- fácil de usar sin capacitación.

La complejidad del motor de evaluaciones debe permanecer oculta detrás de una UX simple y guiada.

## Regla UX principal

Un colaborador debe poder:

1. iniciar sesión;
2. entender inmediatamente qué tiene pendiente;
3. responder una evaluación;
4. guardar progreso;
5. enviar;
6. consultar sus resultados;
7. revisar feedback;
8. gestionar su PDI;

sin capacitación previa.

Un usuario de RR.HH. debe poder configurar campañas complejas mediante wizard, defaults seguros, ayudas contextuales y progressive disclosure.

---

# 2. Contexto funcional que Stitch debe representar

El producto NO es únicamente un sistema de evaluación 360°.

Debe representarse como una **plataforma general de evaluaciones y gestión del talento**, capaz de soportar:

- Evaluación 360°.
- Evaluación 180°.
- Evaluación de desempeño.
- Evaluación de liderazgo.
- Evaluación por competencias.
- Encuestas de clima.
- Pulsos semanales.
- Evaluaciones por proyecto.
- Evaluaciones de onboarding.
- Evaluaciones trimestrales.
- Evaluaciones semestrales.
- Evaluaciones anuales.
- Evaluaciones puntuales.
- Evaluaciones personalizadas.
- Importación de evaluaciones externas.

No crear interfaces rígidas dependientes de un único tipo de evaluación.

---

# 3. Principios UX obligatorios

1. Claridad antes que decoración.
2. Una acción primaria dominante por contexto.
3. Progressive disclosure.
4. Estado del proceso siempre visible.
5. Lenguaje humano.
6. Consistencia de patrones.
7. Prevención de errores.
8. Accesibilidad WCAG AA.
9. Responsive.
10. Privacidad y confidencialidad visibles.
11. Nunca utilizar tecnicismos internos como JSON, RRULE, queue, snapshot, worker, etc.
12. Minimizar la carga cognitiva.
13. Los flujos complejos deben dividirse en pasos.
14. Las acciones peligrosas requieren confirmación explícita.
15. Nunca mostrar información confidencial que el rol no tenga autorización para consultar.
16. Los dashboards deben priorizar decisiones y acciones, no decoración.
17. Evitar pantallas saturadas.
18. Priorizar desktop para RR.HH. y mobile para colaboradores/evaluadores.
19. Mantener acciones importantes en posiciones consistentes.
20. Diseñar todos los estados: loading, empty, error, disabled, success, partial, permission denied.

---

# 4. Dirección visual

## Personalidad

Corporate SaaS moderno, premium y sobrio.

Referencias conceptuales:

- software empresarial moderno;
- dashboards tipo Linear / Notion / Stripe / modern HR SaaS;
- simplicidad de Google Workspace;
- densidad visual controlada;
- estética institucional.

No copiar literalmente ninguna marca.

## Identidad IIMP

Usar la identidad corporativa IIMP como referencia.

Dirección:

- azul corporativo profundo como color primario;
- dorado como acento secundario limitado;
- fondos neutros claros;
- superficies blancas;
- gris muy suave para contenedores;
- verde / ámbar / rojo solo como colores semánticos;
- bordes sutiles;
- radius entre 8 y 12 px;
- sombras mínimas;
- mucho espacio blanco;
- iconografía lineal y consistente.

No usar gradients llamativos, glassmorphism excesivo ni estética startup informal.

---

# 5. Design tokens sugeridos

Stitch puede adaptar valores exactos, pero debe mantener este sistema.

## Colors

Primary:
- IIMP Deep Blue

Accent:
- IIMP Gold

Neutral:
- Neutral 950
- Neutral 700
- Neutral 500
- Neutral 300
- Neutral 200
- Neutral 100
- Neutral 50
- White

Semantic:
- Success
- Warning
- Danger
- Info

## Radius

- Small: 6px
- Medium: 8px
- Large: 12px
- XL: 16px

## Spacing

Basado en múltiplos de 4/8.

## Typography

Preferir `Inter`, `Geist`, `Roboto` o sans-serif equivalente.

- Display: 32–36px
- H1: 28–32px
- H2: 22–24px
- H3: 18–20px
- Body: 14–16px
- Caption/helper: 12–13px

No abusar de mayúsculas.

---

# 6. Shell principal

## Desktop

Layout base:

```text
┌───────────────────────────────────────────────────────────────────┐
│ Header: contexto | búsqueda global | ayuda | notificaciones | yo │
├───────────────────┬───────────────────────────────────────────────┤
│ Sidebar           │ Breadcrumb                                  │
│                   │ Page title + description + actions           │
│ Inicio            │                                               │
│ Mis evaluaciones  │ Main content                                  │
│ Campañas          │                                               │
│ Modelos           │                                               │
│ Personas          │                                               │
│ Resultados        │                                               │
│ Feedback          │                                               │
│ Desarrollo        │                                               │
│ Reportes          │                                               │
│ Importaciones     │                                               │
│ Configuración     │                                               │
└───────────────────┴───────────────────────────────────────────────┘
```

Sidebar colapsable.

Nunca mostrar módulos sin permiso.

## Mobile

- Header compacto.
- Navegación inferior o drawer.
- Priorizar: Inicio, Pendientes, Resultados, PDI, Perfil.
- Administración avanzada puede mantenerse adaptativa pero desktop-first.

---

# 7. Roles visuales

Stitch debe producir dashboards y vistas coherentes para los siguientes perfiles:

1. Colaborador / Evaluado.
2. Evaluador.
3. Jefe / Responsable de equipo.
4. RR.HH. / Administrador funcional.
5. Responsable de ciclo.
6. Validador de evaluadores.
7. Calibrador / Comité.
8. Responsable de feedback.
9. Ejecutivo.
10. Auditor / Soporte.

Las pantallas deben cambiar según permisos.

---

# 8. MAPA COMPLETO DE VISTAS

Stitch debe generar **todas las siguientes vistas**.

No omitir vistas por considerarlas secundarias.

---

# A. AUTENTICACIÓN Y ACCESO

## A01 — Login

Contenido:

- Logo IIMP.
- Nombre del sistema.
- Mensaje institucional corto.
- Botón `Continuar con Google`.
- Texto: acceso exclusivo a cuentas `@iimp.org.pe`.
- Footer seguridad / privacidad.

## A02 — Validando sesión

Loading corporativo.

## A03 — Cuenta Google no permitida

Mensaje claro:

> Utiliza tu cuenta institucional @iimp.org.pe.

Acción:
- Cambiar cuenta.

## A04 — Usuario no habilitado

Cuenta válida del dominio pero usuario sin acceso.

Acciones:
- Contactar RR.HH./Soporte.
- Cerrar sesión.

## A05 — Acceso denegado por permisos

403 visual amigable.

## A06 — Sesión expirada

CTA:
- Volver a iniciar sesión.

---

# B. HOME / DASHBOARD POR ROL

## B01 — Home colaborador

Cards principales:

- Evaluaciones pendientes.
- Próximo vencimiento.
- Continuar evaluación.
- Resultados disponibles.
- Feedback pendiente.
- PDI activo.

Sección:
- Mis tareas.
- Actividad reciente.
- Próximas fechas.

## B02 — Home evaluador

- Evaluaciones por responder.
- Evaluaciones en progreso.
- Vencimientos próximos.
- Completadas recientemente.

## B03 — Home jefe

- Estado de mi equipo.
- Evaluaciones pendientes del equipo.
- Feedback por realizar.
- PDI próximos/vencidos.
- Alertas.
- Resumen permitido de resultados.

## B04 — Home RR.HH.

KPIs:

- Campañas activas.
- Tasa de participación.
- Evaluaciones pendientes.
- Vencidas.
- Muestras insuficientes.
- Evaluadores pendientes de validación.
- Casos de calibración.
- Resultados por publicar.
- Feedback pendientes.
- PDI vencidos.

Bloques:

- Campañas que requieren atención.
- Alertas operativas.
- Próximas acciones.
- Actividad reciente.

## B05 — Home ejecutivo

Solo consolidado.

- Tendencias generales.
- Fortalezas organizacionales.
- Principales brechas.
- Comparativos por área.
- Evolución temporal.
- Heatmap corporativo.

No mostrar respuestas individuales.

## B06 — Home auditor

- Eventos recientes.
- Cambios críticos.
- Exportaciones.
- Reaperturas.
- Cambios de permisos.
- Importaciones.

---

# C. MIS EVALUACIONES

## C01 — Listado Mis evaluaciones

Tabs:

- Pendientes.
- En progreso.
- Completadas.
- Vencidas.

Cards/lista con:

- Nombre.
- Tipo.
- Persona evaluada.
- Relación.
- Fecha límite.
- Progreso.
- Estado.
- CTA.

## C02 — Detalle de evaluación asignada

Antes de comenzar:

- Objetivo.
- Persona evaluada.
- Relación.
- Duración estimada.
- Fecha límite.
- Política de privacidad.
- Escala.
- Instrucciones.

CTA:
- Comenzar evaluación.

## C03 — Responder evaluación

Layout:

- Header sticky.
- Nombre de evaluación.
- Persona evaluada.
- Relación.
- Progreso.
- Deadline.

Contenido:

- Secciones.
- Competencias.
- Preguntas.
- Escala.
- N/A.
- Comentarios.
- Evidencias si aplica.

Navegación:

- Anterior.
- Siguiente.
- Guardar progreso.

Autosave visible.

## C04 — Evaluación larga con índice lateral

Índice de secciones con:

- completas;
- incompletas;
- actual.

## C05 — Confirmar envío

Resumen:

- X de X preguntas respondidas.
- Advertencias.
- Respuestas incompletas opcionales.
- Confirmación irreversible salvo reapertura autorizada.

CTA:
- Enviar evaluación.

## C06 — Evaluación enviada

Success screen.

- Fecha/hora.
- Estado completado.
- CTA volver a pendientes.

## C07 — Evaluación vencida

- Estado.
- Fecha vencimiento.
- Explicación.
- Contacto.

## C08 — Evaluación reabierta

Banner visible:
- motivo resumido;
- nuevo plazo.

---

# D. RESULTADOS PERSONALES

## D01 — Mis resultados

Listado por periodo/tipo.

## D02 — Resultado individual resumen

- Score global.
- Fortalezas.
- Brechas.
- Competencias.
- Comparación con expectativa.
- Auto vs entorno si aplica.
- Indicador de confidencialidad.

## D03 — Resultado 360 detallado

Visualizaciones:

- score por competencia;
- autoevaluación vs entorno;
- grupos evaluadores;
- fortalezas;
- brechas;
- comentarios consolidados autorizados.

Nunca revelar identidad de pares/colaboradores protegidos.

## D04 — Evolución histórica

- Timeline.
- Trend chart.
- Comparación por competencia.
- Filtros por periodo.

## D05 — Resultado aún no publicado

Estado informativo.

---

# E. FEEDBACK

## E01 — Feedback pendiente

Lista de sesiones.

## E02 — Preparar feedback

Panel dividido:

- resumen resultados;
- fortalezas;
- brechas;
- notas privadas;
- agenda sugerida.

## E03 — Registrar sesión feedback

Stepper:

1. Datos sesión.
2. Fortalezas.
3. Brechas.
4. Acuerdos.
5. Compromisos.
6. Confirmación.

## E04 — Feedback completado

Resumen de acuerdos.

## E05 — Historial feedback

Timeline.

---

# F. PLAN DE DESARROLLO INDIVIDUAL — PDI

## F01 — Mi PDI

- progreso total;
- prioridades;
- acciones;
- fechas;
- responsable;
- estado.

## F02 — Crear PDI

Wizard:

1. Prioridades.
2. Objetivos.
3. Acciones.
4. Indicadores.
5. Fechas.
6. Seguimiento.

## F03 — Detalle PDI

- Timeline.
- Hitos.
- Evidencias.
- Comentarios.
- progreso.

## F04 — Registrar avance

- porcentaje;
- evidencia;
- comentario;
- fecha.

## F05 — PDI vencido

Alertas y acciones.

## F06 — Histórico PDI

---

# G. CAMPAÑAS

## G01 — Listado de campañas

Filtros:

- estado;
- tipo;
- área;
- periodo;
- responsable.

Columnas:

- nombre;
- tipo;
- población;
- avance;
- fecha inicio;
- fecha cierre;
- estado;
- responsable.

Acciones contextuales.

## G02 — Detalle campaña / Overview

Header:

- nombre;
- tipo;
- periodo;
- estado;
- responsable.

KPIs:

- población;
- asignaciones;
- participación;
- pendientes;
- vencidas;
- muestras insuficientes.

Tabs:

- Resumen.
- Población.
- Evaluadores.
- Cuestionario.
- Progreso.
- Resultados.
- Calibración.
- Feedback.
- Auditoría.

## G03 — Crear campaña — Paso 1 Tipo y objetivo

Cards de tipos:

- 360°.
- 180°.
- Desempeño.
- Competencias.
- Liderazgo.
- Clima.
- Pulso.
- Proyecto.
- Onboarding.
- Personalizada.

## G04 — Paso 2 Población

Métodos:

- personas;
- área;
- cargo;
- nivel;
- tags;
- archivo.

Preview población.

## G05 — Paso 3 Modelo / competencias

Seleccionar modelo.

Preview competencias.

## G06 — Paso 4 Evaluadores

Configurar:

- autoevaluación;
- jefe;
- pares;
- colaboradores;
- custom.

Min/max.

## G07 — Paso 5 Cuestionario

Vista previa del cuestionario.

## G08 — Paso 6 Reglas y anonimato

- anonimato;
- muestra mínima;
- evidencias;
- comentarios;
- políticas.

## G09 — Paso 7 Fechas y recurrencia

Opciones humanas:

- única;
- semanal;
- dos veces por semana;
- mensual;
- trimestral;
- semestral;
- anual;
- personalizada.

No mostrar RRULE.

## G10 — Paso 8 Publicación y comunicaciones

- invitación;
- recordatorios;
- publicación automática/manual;
- responsable.

## G11 — Paso 9 Revisión final

Resumen humano.

Alertas de configuración.

CTA:
- Guardar borrador.
- Programar.
- Lanzar.

## G12 — Campaña creada

Success state.

## G13 — Duplicar campaña

Configurable.

## G14 — Programar campaña

Fecha/hora + confirmación.

## G15 — Lanzar campaña

Confirmación de alto impacto.

## G16 — Cerrar campaña

Preview impacto.

## G17 — Reabrir campaña

Motivo obligatorio.

## G18 — Anular campaña

Nunca eliminar.

---

# H. POBLACIÓN

## H01 — Población campaña

Tabla.

## H02 — Agregar personas

Selector avanzado.

## H03 — Segmentación

Filtros combinables:

- área;
- cargo;
- nivel;
- sede;
- tags;
- antigüedad;
- estado.

## H04 — Preview elegibilidad

- incluidos;
- excluidos;
- motivos.

## H05 — Importar población

Upload Excel.

## H06 — Errores de población

---

# I. EVALUADORES

## I01 — Gestión evaluadores

Por evaluado mostrar:

- auto;
- jefe;
- pares;
- colaboradores;
- estado validación.

## I02 — Proponer pares

Experiencia simple del colaborador.

## I03 — Validar pares

Jefe/RR.HH.

- aprobar;
- rechazar;
- reemplazar.

## I04 — Conflicto de interés

Alertas.

## I05 — Reemplazar evaluador

Motivo obligatorio.

## I06 — Cobertura insuficiente

Warning.

---

# J. MODELOS DE EVALUACIÓN

## J01 — Listado modelos

- nombre;
- tipo;
- versión vigente;
- estado;
- uso.

## J02 — Crear modelo

Wizard.

## J03 — Detalle modelo

Tabs:

- General.
- Competencias.
- Escalas.
- Fuentes.
- Pesos.
- Reglas.
- Workflow.
- Versiones.

## J04 — Nueva versión

Comparación con versión anterior.

## J05 — Publicar versión

Confirmación.

## J06 — Modelo bloqueado por campaña activa

---

# K. COMPETENCIAS

## K01 — Catálogo competencias

Categorías:

- corporativas;
- liderazgo;
- específicas.

## K02 — Crear competencia

## K03 — Editar competencia

## K04 — Conductas observables

## K05 — Niveles esperados

## K06 — Asociar cargos/roles

## K07 — Histórico/versiones

---

# L. BANCO DE PREGUNTAS

## L01 — Banco preguntas

Filtros:

- competencia;
- tipo;
- estado;
- uso.

## L02 — Crear pregunta

Tipos:

- Likert;
- rating;
- texto;
- texto largo;
- sí/no;
- opción única;
- múltiple;
- NPS;
- matriz;
- numérico;
- fecha;
- archivo;
- competencia.

## L03 — Preview pregunta

## L04 — Versionado pregunta

## L05 — Pregunta en uso

---

# M. CONSTRUCTOR DE CUESTIONARIOS

## M01 — Builder

Idealmente drag & drop moderado.

Panel izquierdo:
- componentes.

Centro:
- cuestionario.

Derecha:
- configuración.

## M02 — Crear sección

## M03 — Configurar lógica condicional

UX visual sencilla.

## M04 — Preview desktop

## M05 — Preview mobile

## M06 — Validación del cuestionario

Detectar:
- sin preguntas;
- escalas faltantes;
- campos inválidos.

---

# N. ESCALAS

## N01 — Listado escalas

## N02 — Crear escala

Ejemplo 1–5 + N/A.

## N03 — Descriptores

## N04 — Preview escala

---

# O. PROGRESO Y MONITOREO

## O01 — Dashboard progreso campaña

- response rate;
- avance;
- pendientes;
- vencidas;
- cobertura.

## O02 — Progreso por área

## O03 — Progreso por evaluado

## O04 — Progreso por grupo evaluador

## O05 — Personas en riesgo

## O06 — Recordatorios

Seleccionar destinatarios.

## O07 — Ampliar plazo

Motivo + nueva fecha.

## O08 — Incidencias

Lista y detalle.

---

# P. CONSOLIDACIÓN Y RESULTADOS

## P01 — Resultados campaña

KPIs + gráficos.

## P02 — Resultados por persona

## P03 — Resultados por competencia

## P04 — Resultados por área

## P05 — Resultados por cargo

## P06 — Comparación auto vs entorno

## P07 — Heatmap competencias

## P08 — Distribución scores

## P09 — Casos atípicos

## P10 — Muestra insuficiente

No revelar valores protegidos.

---

# Q. CALIBRACIÓN

## Q01 — Bandeja calibración

Columnas:

- persona;
- score;
- trigger;
- gap;
- dispersión;
- estado;
- responsable.

## Q02 — Detalle caso calibración

Comparación:

- score preliminar;
- distribución;
- evidencia;
- histórico;
- comentarios permitidos.

## Q03 — Registrar decisión

Opciones:

- mantener;
- ajustar.

Si ajustar:
- nuevo score;
- motivo obligatorio;
- evidencia;
- comentario.

## Q04 — Comparación antes/después

## Q05 — Comité de calibración

Lista de casos + avance.

## Q06 — Cierre calibración

---

# R. PUBLICACIÓN DE RESULTADOS

## R01 — Resultados pendientes publicación

## R02 — Preview publicación

Qué verá cada rol.

## R03 — Publicar resultados

Confirmación.

## R04 — Publicación parcial

Por población/área si política lo permite.

## R05 — Resultado bloqueado

---

# S. REPORTES Y ANALÍTICA

## S01 — Dashboard analítico

## S02 — Reporte evolución temporal

## S03 — Reporte fortalezas/brechas

## S04 — Reporte participación

## S05 — Reporte competencias

## S06 — Comparativo áreas

## S07 — Comparativo periodos

## S08 — Reporte PDI

## S09 — Constructor de filtros

## S10 — Exportar reporte

- Excel;
- PDF.

## S11 — Exportación en proceso

## S12 — Exportación completada

---

# T. PERSONAS Y ORGANIZACIÓN

## T01 — Directorio personas

## T02 — Perfil colaborador

Tabs:

- Información.
- Evaluaciones.
- Resultados.
- Feedback.
- PDI.
- Histórico.

## T03 — Organigrama

## T04 — Áreas

## T05 — Cargos

## T06 — Niveles

## T07 — Equipos

## T08 — Tags

## T09 — Snapshot organizacional de campaña

Solo lectura.

---

# U. IMPORTACIONES

## U01 — Centro de importaciones

Tipos:

- personas;
- organización;
- población;
- evaluadores;
- resultados externos.

## U02 — Upload archivo

Drag/drop.

## U03 — Mapping columnas

## U04 — Validación

Mostrar:

- válidos;
- errores;
- advertencias.

## U05 — Preview importación

## U06 — Confirmar importación

## U07 — Importación procesando

Progreso real.

## U08 — Importación completada

## U09 — Importación con errores

Descargar errores.

## U10 — Historial importaciones

---

# V. EVALUACIONES EXTERNAS

## V01 — Listado fuentes externas

## V02 — Importar resultados externos

## V03 — Mapping de escalas

## V04 — Mapping de competencias

## V05 — Validar comparabilidad

## V06 — Resultado externo en perfil persona

Mostrar fuente y metodología.

---

# W. NOTIFICACIONES Y COMUNICACIONES

## W01 — Centro notificaciones

## W02 — Plantillas de email

## W03 — Editor plantilla

Preview.

## W04 — Variables disponibles

Ejemplo:
- persona;
- campaña;
- fecha límite.

## W05 — Recordatorios automáticos

## W06 — Historial envíos

## W07 — Notificación fallida

---

# X. CONFIGURACIÓN

## X01 — Configuración general

## X02 — Parámetros evaluación

## X03 — Umbrales anonimato

## X04 — Estados

## X05 — Catálogos

## X06 — Roles

## X07 — Permisos

## X08 — Matriz roles/permisos

## X09 — Usuarios habilitados

## X10 — Integraciones

## X11 — Configuración Google Workspace

Estado conexión.

## X12 — Configuración correo

## X13 — Branding

Logo / identidad.

---

# Y. AUDITORÍA Y SEGURIDAD

## Y01 — Audit log

Filtros:

- usuario;
- acción;
- entidad;
- fecha;
- módulo.

## Y02 — Detalle evento auditoría

Mostrar:

- actor;
- acción;
- fecha;
- entidad;
- origen;
- motivo;
- metadata segura.

## Y03 — Exportaciones realizadas

## Y04 — Accesos recientes

## Y05 — Cambios permisos

## Y06 — Reaperturas

## Y07 — Actividad sensible

No mostrar contenidos confidenciales salvo autorización.

---

# Z. PERFIL Y PREFERENCIAS

## Z01 — Mi perfil

- nombre;
- email;
- cargo;
- área;
- jefe.

## Z02 — Preferencias de notificación

## Z03 — Ayuda

## Z04 — Soporte

---

# AA. ESTADOS TRANSVERSALES OBLIGATORIOS

Stitch debe mostrar componentes/patrones para:

## Loading
- skeleton;
- loading table;
- upload progress;
- processing.

## Empty states
- sin evaluaciones;
- sin campañas;
- sin resultados;
- sin PDI;
- sin incidencias.

## Error states
- error genérico;
- error de guardado;
- error de red;
- archivo inválido;
- importación fallida.

## Success states
- guardado;
- enviado;
- publicado;
- importado;
- exportado.

## Permission states
- acceso denegado;
- información restringida.

## Offline / conexión inestable
Especialmente al responder evaluaciones.

Mostrar:
- cambios pendientes;
- último guardado.

---

# 9. FLUJOS END-TO-END QUE STITCH DEBE REPRESENTAR

Además de pantallas individuales, Stitch debe construir prototipos conectados para estos flujos.

---

## Flujo 1 — Colaborador responde evaluación

Login  
→ Home  
→ Mis evaluaciones  
→ Detalle  
→ Comenzar  
→ Responder  
→ Guardado automático  
→ Revisión  
→ Confirmar envío  
→ Enviada

---

## Flujo 2 — RR.HH. crea una campaña 360°

Login  
→ Home RR.HH.  
→ Campañas  
→ Nueva campaña  
→ Tipo 360  
→ Población  
→ Modelo  
→ Evaluadores  
→ Cuestionario  
→ Anonimato  
→ Fechas  
→ Comunicaciones  
→ Revisión  
→ Programar/Lanzar  
→ Campaña activa

---

## Flujo 3 — RR.HH. crea un pulso recurrente martes/jueves

Nueva campaña  
→ Pulso  
→ Área  
→ Preguntas  
→ Anónimo  
→ Recurrencia  
→ Dos veces por semana  
→ Elegir martes y jueves  
→ Hora  
→ Duración  
→ Recordatorios  
→ Guardar automatización

---

## Flujo 4 — Evaluado propone pares

Home  
→ Acción pendiente  
→ Proponer pares  
→ Buscar colaboradores  
→ Seleccionar  
→ Validar cantidad  
→ Enviar propuesta

---

## Flujo 5 — Jefe valida pares

Home jefe  
→ Pendientes de validación  
→ Evaluado  
→ Revisar propuesta  
→ Aprobar / rechazar / reemplazar  
→ Confirmar

---

## Flujo 6 — Seguimiento de campaña

Home RR.HH.  
→ Campaña activa  
→ Progreso  
→ Identificar riesgo  
→ Enviar recordatorio  
→ Ampliar plazo si aplica  
→ Continuar monitoreo

---

## Flujo 7 — Consolidación

Campaña cerrada  
→ Resultados  
→ Consolidar  
→ Detectar gaps/outliers  
→ Casos para calibración

---

## Flujo 8 — Calibración

Bandeja calibración  
→ Caso  
→ Revisar evidencia  
→ Mantener/ajustar  
→ Registrar motivo  
→ Guardar  
→ Cierre calibración

---

## Flujo 9 — Publicación

Resultados aprobados  
→ Preview por rol  
→ Publicar  
→ Notificación  
→ Resultado visible al colaborador

---

## Flujo 10 — Feedback

Resultado publicado  
→ Feedback pendiente  
→ Preparar  
→ Realizar sesión  
→ Registrar fortalezas  
→ Brechas  
→ Acuerdos  
→ Crear PDI

---

## Flujo 11 — PDI

Crear PDI  
→ Prioridades  
→ Acciones  
→ Indicadores  
→ Fechas  
→ Publicar  
→ Seguimientos  
→ Evidencias  
→ Cerrar prioridad

---

## Flujo 12 — Importación de colaboradores

Personas  
→ Importar  
→ Upload Excel  
→ Mapping  
→ Validación  
→ Errores  
→ Preview  
→ Confirmar  
→ Procesando  
→ Resultado

---

## Flujo 13 — Importación de evaluación externa

Importaciones  
→ Resultados externos  
→ Upload  
→ Identidad  
→ Mapping escala  
→ Mapping competencias  
→ Comparabilidad  
→ Confirmar  
→ Histórico persona

---

## Flujo 14 — Ejecutivo consulta tendencias

Login  
→ Dashboard ejecutivo  
→ Filtro periodo  
→ Área  
→ Competencia  
→ Comparativo  
→ Drill-down permitido  
→ Exportar

---

# 10. COMPONENTES QUE DEBEN FORMAR EL DESIGN SYSTEM

Stitch debe generar un set visual consistente para:

- App shell.
- Sidebar.
- Header.
- Breadcrumb.
- Page header.
- Search.
- Filter bar.
- Chips.
- Tabs.
- Cards.
- KPI cards.
- Tables.
- Pagination.
- Badges.
- Status badge.
- Buttons.
- Button groups.
- Dropdown.
- Context menu.
- Inputs.
- Select.
- Combobox.
- Multi-select.
- Date picker.
- Date range.
- Radio.
- Checkbox.
- Toggle.
- Textarea.
- File upload.
- Progress bar.
- Stepper.
- Timeline.
- Accordion.
- Tooltip.
- Popover.
- Drawer.
- Modal.
- Alert.
- Toast.
- Skeleton.
- Empty state.
- Error state.
- User avatar.
- Org/person picker.
- Score card.
- Competency card.
- Heatmap.
- Trend chart.
- Horizontal bar chart.
- Distribution chart.
- Auto-vs-entorno comparison.
- PDI progress component.
- Audit event component.

---

# 11. ESTADOS ESTÁNDAR

Usar estos labels de forma consistente:

- Borrador.
- Programada.
- Activa.
- En progreso.
- Pendiente.
- Vencida.
- Cerrada.
- En consolidación.
- En calibración.
- Aprobada.
- Publicada.
- Anulada.
- Completada.
- Archivada.

Nunca crear sinónimos innecesarios.

Badges deben incluir texto; no depender únicamente del color.

---

# 12. TABLAS

Reglas:

- sticky header;
- filtros visibles;
- búsqueda;
- columnas importantes primero;
- menú contextual para acciones secundarias;
- paginación server-side;
- selección masiva cuando aporte valor;
- responsive con prioridades de columnas.

Evitar una columna con 8 botones.

---

# 13. FORMULARIOS

- Label siempre visible.
- Helper text cuando agregue valor.
- Validación inline.
- No borrar información tras error.
- Required claramente indicado.
- Estados disabled/loading claros.
- No formularios administrativos grandes dentro de modales.
- Dividir procesos complejos en pasos.

---

# 14. WIZARDS

El wizard de campaña debe incluir stepper superior o lateral.

Desktop:
- contenido central;
- resumen lateral sticky.

Mobile:
- stepper compacto;
- resumen al final.

Botones consistentes:

`Atrás` | `Guardar borrador` | `Continuar`

Último paso:

`Guardar borrador` | `Programar` | `Lanzar campaña`

---

# 15. UX DE ANONIMATO

Cuando exista anonimato:

Mostrar información como:

> Tus respuestas serán consolidadas con las de otros evaluadores.

> Los resultados de este grupo solo se mostrarán cuando exista un mínimo de 3 respuestas válidas.

Nunca mostrar:

- identidad de pares;
- identidad de colaboradores;
- respuesta individual protegida.

Cuando no exista muestra mínima:

Mostrar:

> Muestra insuficiente para mostrar este resultado.

No redistribuir visualmente score salvo que la configuración lo establezca.

---

# 16. UX DE SCORING

No saturar al colaborador con fórmulas.

Mostrar:

- score;
- descriptor;
- diferencia vs esperado;
- tendencia;
- interpretación.

En backoffice avanzado sí pueden existir:

- pesos;
- fuentes;
- scoring;
- fórmula;
- reglas.

---

# 17. DASHBOARDS

Principios:

- responder preguntas;
- ofrecer contexto;
- posibilitar drill-down;
- priorizar tendencias y excepciones.

Gráficos recomendados:

- barras horizontales;
- líneas;
- heatmap;
- distribución;
- barras agrupadas.

Evitar abuso de donut charts.

Todo gráfico debe tener alternativa tabular accesible.

---

# 18. MICROCOPY

Tono:

- directo;
- profesional;
- humano;
- no técnico.

Ejemplos:

Incorrecto:

> El RRULE será ejecutado por el scheduler.

Correcto:

> Esta evaluación se enviará automáticamente todos los martes y jueves.

Incorrecto:

> Assignment created.

Correcto:

> La evaluación fue asignada correctamente.

---

# 19. CONFIRMACIONES

## Enviar evaluación

> Una vez enviada, no podrás modificar tus respuestas salvo que RR.HH. autorice una reapertura.

## Cerrar campaña

> Al cerrar la campaña se bloquearán nuevas respuestas. La información registrada se conservará.

## Anular

> La campaña dejará de estar disponible, pero su información permanecerá en el historial y auditoría.

## Publicar resultados

> Los colaboradores autorizados podrán consultar sus resultados después de esta acción.

---

# 20. RESPONSIVE

## Mobile perfecto para:

- login;
- dashboard colaborador;
- pendientes;
- responder evaluación;
- resultados;
- feedback;
- PDI;
- notificaciones.

## Tablet/Desktop prioritario para:

- creación de campañas;
- builder;
- importaciones;
- dashboards analíticos;
- administración;
- calibración;
- matrices.

---

# 21. ACCESIBILIDAD

Obligatorio:

- WCAG AA;
- contraste;
- focus visible;
- labels;
- navegación teclado;
- estados no dependientes del color;
- tamaño mínimo de target táctil;
- charts con versión textual/tabular;
- modales con focus trap;
- mensajes de error asociados al input.

---

# 22. VISTAS DE ALTA PRIORIDAD PARA PRIMERA GENERACIÓN

Si Stitch genera por bloques, comenzar en este orden:

## Bloque 1 — Design System
1. App shell.
2. Componentes.
3. Tokens.
4. Estados.
5. Form patterns.

## Bloque 2 — Core colaborador
1. Login.
2. Home colaborador.
3. Mis evaluaciones.
4. Responder.
5. Confirmación.
6. Resultado.
7. Feedback.
8. PDI.

## Bloque 3 — RR.HH.
1. Home RR.HH.
2. Campañas.
3. Wizard campaña completo.
4. Detalle campaña.
5. Monitoreo.

## Bloque 4 — 360
1. Propuesta de pares.
2. Validación.
3. Resultados.
4. Calibración.
5. Publicación.

## Bloque 5 — Administración
1. Modelos.
2. Competencias.
3. Preguntas.
4. Cuestionarios.
5. Escalas.
6. Personas.
7. Organización.

## Bloque 6 — Operaciones
1. Importaciones.
2. Exportaciones.
3. Auditoría.
4. Configuración.
5. Seguridad.

---

# 23. PROMPT MAESTRO PARA STITCH

Usar el siguiente contexto al generar pantallas:

> Diseña una plataforma SaaS corporativa interna llamada “Sistema Integral de Evaluaciones IIMP”, destinada al Instituto de Ingenieros de Minas del Perú. Debe sentirse moderna, premium, institucional y extremadamente fácil de usar. El producto soporta evaluaciones 360°, desempeño, competencias, liderazgo, clima, pulsos recurrentes, evaluaciones por proyecto, onboarding y evaluaciones personalizadas.
>
> La interfaz debe mantener la complejidad técnica oculta mediante progressive disclosure, wizards, defaults seguros, lenguaje humano y acciones claras.
>
> Usa un app shell con sidebar, header, breadcrumbs y contenido. Azul corporativo profundo como color principal, dorado como acento limitado y neutrales claros. Evita decoración innecesaria, gradients llamativos, glassmorphism excesivo y dashboards saturados.
>
> Genera las vistas siguiendo exactamente el inventario de pantallas de este documento, respetando roles, permisos, confidencialidad y estados del workflow.
>
> El colaborador debe poder usar perfectamente las funciones principales desde mobile. RR.HH. debe operar cómodamente desde desktop/tablet.
>
> Diseña componentes reutilizables y un design system consistente. Todos los estados de loading, empty, error, success, disabled, permissions y responsive deben estar contemplados.
>
> No inventes módulos fuera del alcance. No elimines módulos listados. No conviertas la aplicación en un simple survey builder: es una plataforma corporativa completa de gestión de evaluaciones, resultados, feedback, desarrollo y analítica.

---

# 24. INSTRUCCIÓN DE GENERACIÓN PARA STITCH

No intentar generar todo como una única pantalla gigante.

Generar por módulos manteniendo el mismo design system.

Cada vista debe incluir:

1. nombre de pantalla;
2. objetivo;
3. rol;
4. layout;
5. datos principales;
6. acción primaria;
7. acciones secundarias;
8. estados;
9. responsive behavior.

Stitch debe mantener continuidad visual entre todas las pantallas.

---

# 25. CHECKLIST DE COBERTURA

Antes de considerar el diseño completo, verificar que existan:

- [ ] Login y seguridad.
- [ ] Dashboards por rol.
- [ ] Evaluaciones pendientes.
- [ ] Formulario de evaluación.
- [ ] Envío.
- [ ] Campañas.
- [ ] Wizard completo.
- [ ] Recurrencia.
- [ ] Población.
- [ ] Evaluadores.
- [ ] Validación de pares.
- [ ] Modelos.
- [ ] Competencias.
- [ ] Banco de preguntas.
- [ ] Constructor de cuestionarios.
- [ ] Escalas.
- [ ] Monitoreo.
- [ ] Resultados.
- [ ] Anonimato.
- [ ] Consolidación.
- [ ] Calibración.
- [ ] Publicación.
- [ ] Feedback.
- [ ] PDI.
- [ ] Histórico.
- [ ] Reportes.
- [ ] Organización.
- [ ] Importaciones.
- [ ] Evaluaciones externas.
- [ ] Notificaciones.
- [ ] Configuración.
- [ ] Roles y permisos.
- [ ] Auditoría.
- [ ] Perfil.
- [ ] Responsive.
- [ ] Loading.
- [ ] Empty states.
- [ ] Errores.
- [ ] Success states.
- [ ] Permissions.
- [ ] Design system.

---

# 26. Criterio final

Una pantalla solo se considera terminada si responde positivamente:

1. ¿El usuario entiende dónde está?
2. ¿Entiende qué debe hacer?
3. ¿La acción principal es evidente?
4. ¿El sistema previene errores?
5. ¿El estado del proceso es evidente?
6. ¿El usuario recibe confirmación?
7. ¿Es accesible?
8. ¿Funciona en el dispositivo objetivo?
9. ¿Protege la información confidencial?
10. ¿Es consistente con el resto del sistema?
11. ¿Puede entenderse sin capacitación?
12. ¿Evita exponer complejidad técnica?

---

# 27. Resultado esperado de Stitch

El resultado final debe incluir un prototipo visual coherente de punta a punta que permita entender:

- cómo entra cada rol;
- qué ve;
- qué acciones realiza;
- cómo se configura una evaluación;
- cómo se lanza;
- cómo se responde;
- cómo se monitorea;
- cómo se consolida;
- cómo se calibra;
- cómo se publica;
- cómo se da feedback;
- cómo se crea y sigue un PDI;
- cómo se consulta el histórico;
- cómo RR.HH. administra el sistema.

El producto debe sentirse como una sola plataforma coherente, no como pantallas independientes diseñadas por separado.
