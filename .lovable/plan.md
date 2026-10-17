# Nueva ventana de búsqueda: Agente de Grants

## Diagnóstico: hoy vs. lo que se pide

| Hoy (Grant Radar + detalle) | Lo que se pide |
| --- | --- |
| Perfiles, filtros, pre-check de elegibilidad, catálogo y pestaña web separada | Una sola conversación: "busco X para Y" |
| El usuario arma la búsqueda manualmente | El agente entiende, busca y pregunta solo lo necesario |
| Resultados en dos listas con lógicas distintas | Una lista única, ordenada por encaje, con origen marcado |
| Detalle con plan, dossier, checklist y varios paneles plegados | Ficha corta: qué financia, monto, fecha, ¿califico?, qué falta, fuente |

Sobra en la interfaz: perfiles de búsqueda, barra de filtros, pre-check separado, pestaña web aparte y los paneles plegados del detalle. Se conserva solo lo invisible: reglas de elegibilidad, verificación de fuentes por URL exacta, separación de monedas, traducción ES/EN y el catálogo.

## Qué se construye

Una página nueva, "Agente", separada de Grant Radar (que no se toca hasta que la nueva convenza).

```text
+--------------+-------------------------------------------+
| Conversac.   |  Agente de Grants                         |
| + Nueva      |  [usuario] Fondos para eficiencia en      |
| - Agro Perú  |  construcción, Canadá, 2026               |
| - NRC CA     |  [agente] Buscando en catálogo...  (paso) |
|              |           Buscando en internet... (paso)  |
|              |  Ficha 1  NRC — 94/100  Califica          |
|              |  Ficha 2  Mitacs — 71   Falta socio       |
|              |  [Ver más] [Guardar en mi pipeline]       |
|              |  ________________________________ [Enviar]|
+--------------+-------------------------------------------+
```

Estilo ChatGPT moderno:
- Lista de conversaciones a la izquierda, cada una con su propia dirección; se guardan en la cuenta.
- Respuestas en streaming; el agente muestra en cada momento qué está haciendo (pasos plegables).
- Fichas de grant dentro del chat, no listas aparte.
- Sugerencias de inicio y botón de detener.
- Seguimiento natural: "¿y en Perú?", "compárame las dos primeras", "¿qué me falta para la 1?".
- Todo en el idioma elegido, sin mezclar.

## Cómo busca el agente (decidido para no contaminar)

En este orden, de lo más barato y confiable a lo más caro:
1. Catálogo propio: siempre primero (búsqueda actual texto + significado).
2. Búsqueda web con citas: solo si el catálogo trae poco o el usuario pide "nuevos". Cada resultado web queda marcado como "Sin verificar" salvo que tenga una cita exacta de su página oficial.
3. Lectura de página oficial: solo cuando el usuario abre una ficha web o pide "léela". Extrae monto, fecha y requisitos con evidencia.

Los resultados web no entran al catálogo solos: el usuario pulsa "Guardar", y ahí pasan por la validación existente. Así el catálogo no se contamina.

## Ficha del grant (contenido único)

- Nombre, financiador, país, origen (Catálogo / Web verificada / Web sin verificar)
- Qué financia (1 frase)
- Monto y fecha límite, o "No publicado"
- ¿Califico?: Sí / No / Falta dato, con el motivo en una línea (reglas deterministas, no la IA)
- Qué falta (máximo 3 puntos)
- Fuente oficial y acciones: Ver detalle, Guardar, Preguntar al agente

## Tan potente como ChatGPT

- Razonamiento profundo visible (pasos y resumen de lo que pensó).
- Búsqueda web en vivo con citas por enlace.
- Lee páginas y PDFs de convocatorias que el usuario pegue o suba.
- Conversación larga con memoria del hilo y seguimiento natural.
- Tablas comparativas y borradores de texto dentro del chat.

## Lo que ChatGPT no puede (la ventaja)

- Conoce a tus organizaciones: perfil, sectores, capacidades y socios ya guardados; no hay que explicarlos cada vez.
- Elegibilidad con reglas fijas y auditables, no opinión del modelo: mismo grant, mismo resultado.
- Distingue "dato oficial con cita exacta" de "sin verificar"; nunca inventa montos ni fechas.
- Recuerda lo ya revisado: no vuelve a proponer grants descartados y avisa de los nuevos.
- Ejecuta acciones: guarda en el pipeline, crea el plan con fechas hacia atrás, genera la checklist y abre el dossier.
- Vigilancia: "avísame cuando abra algo así" queda como búsqueda guardada que revisa periódicamente.
- Conocimiento del equipo: usa propuestas, respuestas y resultados anteriores del propio sistema.
- Trabajo compartido: las conversaciones quedan en la cuenta para el equipo.

## Cómo trabaja Rocío (de sus conversaciones con ChatGPT)

Su ciclo real, en este orden:
1. Buscar: "grants vigentes o por abrir donde IIAL sea principal, cacao/agroalimentos, Latinoamérica"; también "qué abre en próximos ciclos (FONTAGRO 2027, BID)".
2. Analizar: pega el enlace oficial y pide "analiza este grant".
3. Chequear: "¿entra Madagascar / quién es el país beneficiario?", "¿puede aplicar Nahua Canada con 1 mes de creada?", "¿qué significa Organization Attestation?".
4. Decidir con Marcelo: "mensaje a Marcelo: de qué trata, si aplica WCIS, requisitos, plazos, monto, qué falta".
5. Escribir: emails a socios y financiadores (paso 1 y paso 2 separados), WhatsApp de presentación, seguimiento al rector, tono cercano.
6. Resumir: "un solo email con todos los grants que trabajamos", ordenado por fecha.

Reglas que el agente debe respetar (ya probadas en el sistema):
- Nunca revelar debilidades a socios (por ejemplo, "sin estados financieros auditados" no va en el correo a Lambton).
- Latinoamérica es "como socio", no "no"; Europa sigue siendo "no".
- Citar la tesis del Dr. Juan Marcelo Gómez y los programas CSIP/CSCIP/CARP y WCIS cuando suma.
- Rol según ruta (principal o socio) y qué gana IIAL en cada caso.

Lo que esto cambia en el plan:
- Sugerencias de inicio con sus frases reales: Buscar, Analizar enlace, ¿Califica este país/organización?, Mensaje a Marcelo, Resumen de todos mis grants.
- El agente reutiliza las herramientas ya existentes y gratuitas (memo a Marcelo, resumen de grants, glosario, chequeo de país, paquete de cumplimiento, plantillas de correo y WhatsApp) en vez de redactar desde cero; la IA solo une y ajusta el tono.
- Todo lo que hoy le pide a ChatGPT pasa a un solo hilo por grant o tema, sin cambiar de pantalla.

## Fases

1. Página, lista de conversaciones, guardado en cuenta y chat con streaming.
2. Herramienta de catálogo y fichas con elegibilidad determinista.
3. Búsqueda web con citas y marca de verificación.
4. Lectura bajo demanda de páginas oficiales y PDFs subidos, y botón Guardar.
5. Contexto de organizaciones, memoria de descartes y acciones (pipeline, plan, checklist).
6. Búsquedas guardadas con aviso de novedades.
7. Verificación en vivo con sesión real, dos conversaciones y recarga.

## Detalles técnicos

- Ruta `/_authenticated/agent` y `/_authenticated/agent/$threadId`; endpoint de streaming separado en server route autenticada.
- Tablas nuevas `agent_threads` y `agent_messages` (UIMessage JSON, id UUID generado por la base, `ai_message_id` texto), RLS por usuario y tenant; migración aditiva.
- AI SDK `streamText` + `toUIMessageStreamResponse`, `useChat` por `threadId`, AI Elements para mensajes, herramientas y compositor.
- Modelo `openai/gpt-6-astra` por Responses (créditos Lovable), `stopWhen: stepCountIs(50)`.
- Herramientas: `search_catalog` (usa `searchGrantCatalogHybrid`), `search_web` (usa `searchWebForGrantsImpl` + `matchGrantSources`), `read_official_page` (lector existente), `check_eligibility` (`src/lib/eligibility.ts`), `save_grant` con `needsApproval`.
- Errores 402/429 visibles en el chat; sin reintentos automáticos.
- Se añade entrada "Agente" al menú consultor; Grant Radar sigue igual.
- Pruebas: orden de herramientas (catálogo antes que web), marca "sin verificar" sin cita exacta, guardado solo con aprobación.
