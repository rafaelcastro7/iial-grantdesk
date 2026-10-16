# Limpieza y estabilización de GrantDesk

## Alcance

Limpiar código muerto y corregir los fallos confirmados, conservando las pantallas útiles, los datos guardados, los permisos y los proveedores actuales. Sin reescribir la app ni añadir funciones nuevas. Cada etapa se comprueba antes de continuar.

La revisión siguió el criterio de **Code review**: no cambiar código ni dependencias hasta aprobar el plan. **Compact code** guiará la simplificación sin cambiar los comportamientos correctos.

## Hallazgos confirmados

| Prioridad | Problema | Qué le cuesta al usuario |
|---|---|---|
| Alta | Al guardar pendientes se eliminan su procedencia y explicación. | Se pierde la distinción entre requisito publicado, sugerencia y dato por verificar después de recargar. |
| Alta | Volver a revisar el encaje actualiza la evaluación, pero no la decisión que presenta el plan. | Puede mostrar recomendaciones contradictorias después de corregir datos. |
| Alta | Un plan iniciado puede recomendar enviar después del vencimiento; con cero pendientes también recomienda enviar. | La siguiente acción puede ser imposible o prematura. Ambos casos se reprodujeron con entradas concretas. |
| Alta | El catálogo visible se limita a 100 candidatos sin paginación; 100 canadienses dejan fuera todas las oportunidades extranjeras al explorar sin país. | Oportunidades válidas desaparecen sin advertencia. |
| Alta | Una fuente puede figurar como exitosa aunque falle su lectura o la incorporación del financiador. | La búsqueda deja de incorporar oportunidades sin que el administrador lo advierta. |
| Media | La actualización del plan admite duplicados dentro del mismo lote. | Más pendientes y progreso distorsionado. |
| Media | Si el análisis con IA se genera pero no se guarda, la pantalla descarta su respuesta sin mostrar el fallo de guardado. | Se pierde trabajo que ya consumió créditos. |
| Media | Una fecha futura corregida puede convivir con el estado «Cerrada». | No queda claro si se puede postular; no debe reabrirse automáticamente una convocatoria sin evidencia. |
| Media | Hay pantallas auxiliares sin consumidores y una selección V1/V2 sin uso. | Más código duplicado que mantener y más riesgo en cada cambio. |

**Estado comprobado:** 447 pruebas pasan; 7 están omitidas, incluidas las pruebas en vivo. Esto no demuestra ausencia de bugs. Las reproducciones del plan vencido y vacío no están cubiertas por las pruebas actuales.

## Orden de ejecución

### 1. Retirar únicamente código sin uso

- Eliminar los tres paneles de grant sin consumidores y la selección de versión sin lectores.
- Eliminar juntos los controles de carrusel y código de un solo uso y sus dependencias exclusivas, después de reconfirmar sus referencias.
- Conservar rutas antiguas de redirección, interfaces públicas y funciones marcadas como compatibles mientras no se demuestre que no tienen consumidores.
- Corregir los títulos y descripciones incoherentes de Inicio, Pipeline y Biblioteca de respuestas.

**Comprobación:** búsqueda de referencias, pruebas existentes, resultado automático de compilación y apertura de Inicio, Radar, detalle y propuestas. Ninguna pantalla útil debe desaparecer.

### 2. Proteger el contenido guardado y eliminar nuevas duplicaciones

- Conservar procedencia y explicación en la validación y guardado de cada pendiente.
- Unificar la deduplicación de nuevas entradas sin confundir requisitos distintos por socio o responsable.
- No borrar ni fusionar silenciosamente pendientes históricos con distinto estado, dueño o fecha; conservar los datos existentes.

**Comprobación:** pruebas de guardado y lectura para las tres procedencias; duplicados en un lote y aplicación repetida; recargar un plan real y confirmar que sus etiquetas y explicaciones siguen visibles.

### 3. Sincronizar decisiones y acciones

- Hacer que el encaje actualizado, la decisión, la siguiente acción y el acceso al borrador reflejen la misma evaluación, sin volver a pagar investigación.
- Identificar la finalización de la revisión por su ejecución, no aceptar una evaluación anterior reciente; mostrar fallos o espera excesiva sin cancelar la generación.
- Resolver de manera compartida disponibilidad, vencimiento y contradicciones entre fecha y estado. Mantener planes históricos y preparación del próximo ciclo.
- No recomendar envío con una convocatoria vencida ni con un plan vacío.

**Comprobación:** regresiones para evaluación anterior, resultado nuevo, fallo, espera agotada, plan vacío, fecha vencida y fecha futura con cierre explícito; recorrido real de corregir → revisar encaje → leer decisión y siguiente acción.

### 4. Evitar oportunidades ocultas y falsos éxitos

- Añadir paginación estable y contadores coherentes al explorar el catálogo, aplicando los filtros al conjunto correcto y manteniendo la prioridad de resultados actual.
- Registrar lecturas de fuentes fallidas o parcialmente fallidas sin presentarlas como búsquedas exitosas sin resultados.
- Hacer reintentable la incorporación del financiador cuando falla, sin dejar candidatos aprobados permanentemente excluidos del reintento.
- Mantener en pantalla un análisis generado que no se pudo guardar, señalarlo y permitir guardar ese mismo contenido sin otra llamada de IA.

**Comprobación:** catálogo de más de 100 oportunidades canadienses y extranjeras; páginas sin huecos ni duplicados; caída total/parcial de fuentes; inserción fallida seguida de reintento exitoso; guardado fallido de análisis sin repetir generación.

### 5. Reducir deuda estructural y cerrar

- Después de las correcciones, extraer de los archivos grandes los bloques de consulta, transformación y validación que ya tengan pruebas. Mantener nombres exportados y contratos públicos.
- Consolidar ayudantes realmente duplicados y adaptar contratos tipados sin modificar archivos generados ni ocultar errores con nuevas conversiones forzadas.
- Actualizar las reglas desfasadas sobre Claude para reflejar la autorización ya dada de usar créditos Lovable; no modificar el orden de otros proveedores.
- Registrar tareas y decisiones en roadmap y AGENTS, y separar lo completado de los bloqueos reales.

**Comprobación:** suite determinista completa, compilación automática sin errores, recorrido con sesión real Radar → detalle → plan → propuesta y cambio EN/ES. Acciones de IA solo las necesarias para verificar el pedido y con el aviso de créditos existente. No enviar solicitudes al financiador ni alterar datos institucionales para probar.

## Seguridad: resultado existente, no garantía

Los resultados disponibles del escáner contienen alertas de permisos de lectura demasiado amplios, incluidos registros de organizaciones y actividad de fuentes; están marcados como desactualizados. El análisis de dependencias existente no muestra hallazgos, pero también está desactualizado. No aparecen resultados de una revisión profunda reciente.

Ejecutar una revisión desde la pestaña **Security** antes de dar por cerrada la seguridad. No cambiar permisos ni actualizar paquetes por seguridad basándose únicamente en estas alertas antiguas: revisar los nuevos resultados y proponer las correcciones necesarias por separado.

## Evidencia técnica

- Pérdida de campos: `src/lib/grant-workspace.functions.ts:183–194`; emisor: `src/components/grants/GrantJourney.tsx:193–198`.
- Decisión desfasada y sondeo: `src/routes/_authenticated.grants.$id.tsx:174–184,239–242`; decisión del dossier: `src/components/grants/GrantJourney.tsx:101,128–134`.
- Envío vencido/vacío: `src/lib/grant-journey.shared.ts:85–92`.
- Límite del catálogo: `src/lib/grants.functions.ts:293–340,728–778`.
- Falsos éxitos: `src/lib/source-curator/orchestrator.server.ts:109–112,164–199`; lecturas silenciadas: `src/lib/source-curator/rss-grants.server.ts:61,86–90`.
- Duplicados: `src/lib/grant-workspace.shared.ts:1049–1060`.
- Análisis no guardado: `src/lib/grant-dossier.functions.ts:438–460`; respuesta ignorada: `src/components/grants/GrantJourney.tsx:109–116`.
- Fecha/estado contradictorios: `src/components/v2/V2GrantDetail.tsx:678–740` y actualización de fecha en `supabase/migrations/20261001050000_grant_manual_fields.sql:51–55`.
- Candidatos de eliminación: `GrantDetailExpress`, `GrantChecklistPanel`, `GrantPlanPanel`, `UiVersionProvider`/`ui-version`, controles `carousel`/`input-otp` y sus dependencias exclusivas. Reconfirmar referencias antes de cada eliminación.

## Criterio de cierre

Cada fallo corregido tendrá una prueba que fallaba antes y pasa después. Se informará qué recorridos se verificaron y qué queda bloqueado. No se prometerá «cero bugs» ni seguridad garantizada.