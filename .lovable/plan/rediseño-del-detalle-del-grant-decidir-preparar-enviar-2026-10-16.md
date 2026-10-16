# Rediseño del detalle del grant: "Decidir → Preparar → Enviar"

## Roast (lo que hoy sobra o confunde)
- "Our decision" / "Nuestra decisión" repite lo que ya dicen el encaje, los hechos y el veredicto: tres bloques para una sola respuesta.
- Hay dos "planes" (plan de trabajo + checklist de Claude) con documentos duplicados y rutas, bloqueos e hitos que el usuario no pidió gestionar.
- Rutas comparadas en tabla, trampas, preguntas, mensajes y cronograma compiten al mismo nivel: no hay un "siguiente paso" claro.
- Vocabulario interno (fit, route, lead, partner_only, milestones) que un consultor no usa.

## Principios (buenas prácticas de gestión de propuestas: go/no-go, matriz de cumplimiento, cronograma hacia atrás desde la fecha límite)
1. Una pregunta por pantalla: ¿Vale la pena? → ¿Qué falta? → ¿Qué hago hoy?
2. Un solo veredicto, un solo plan, una sola lista.
3. La IA propone, el usuario confirma con un clic; nada se genera sin pedirlo (créditos).
4. Todo lo no publicado se convierte en una pregunta lista para enviar al financiador.

## Nueva estructura de la página
```text
[Cabecera] Título · financiador · monto · fecha límite (cuenta regresiva) · Página oficial
[Barra de progreso]  1 Decidir  ──  2 Preparar  ──  3 Enviar

1 DECIDIR (tarjeta única "¿Postulamos?")
   Semáforo Sí / Como socio / No / Por confirmar + 1 frase de por qué
   3 razones a favor · 3 riesgos (de las trampas) · hechos clave en línea
   Botones: [Postular] [Descartar] [Preguntar al financiador]
2 PREPARAR (aparece al elegir Postular)
   Lista única "Lo que falta": documentos + datos no publicados + requisitos,
   cada uno con estado (tengo / en curso / falta), responsable y fecha sugerida
   Cronograma automático hacia atrás desde la fecha límite (hitos semanales)
   IA: "Revisar mi borrador contra los requisitos" y "Redactar sección"
3 ENVIAR
   Verificación final (todo en "tengo"), correo listo al financiador, enlace de envío
[Asistente IA] panel lateral siempre disponible: "¿Qué hago ahora?", preguntas libres
[Detalles y fuentes] plegado al final
```

## Qué se elimina o fusiona
- Se elimina el bloque "Our decision" y la tabla de rutas comparadas (la ruta recomendada queda como una línea dentro de Decidir).
- Plan de trabajo + checklist de Claude → una sola lista "Lo que falta" (se conservan los datos ya guardados).
- Bloqueos, notas de ruta e institución líder salen de la vista principal (quedan en "Más").
- Mensajes listos: solo el correo al financiador, dentro de "Preguntar al financiador".

## Comportamiento con IA
- "Siguiente mejor acción": una tarjeta arriba que dice qué hacer hoy según etapa, faltantes y días restantes (lógica determinista, sin costo).
- Botones de IA claros con aviso de créditos; usa los modelos ya configurados, sin nuevos proveedores.
- Todo bilingüe EN/ES sin mezcla.

## Detalles técnicos
- Nuevo `GrantStageFlow` (etapas derivadas del dossier + plan guardado; etapa persistida en el plan existente, sin migración nueva salvo campo `stage` si no existe).
- `GrantDecisionCard` reemplaza el encabezado de GrantDossier + DecisionFacts; rutas/trampas/preguntas se resumen.
- `GrantTodoList` fusiona `workspace.checklist` y `grant_checklists` (deduplicación por texto normalizado) sobre las funciones existentes.
- `backwardSchedule(deadline, items)` en un módulo shared con pruebas unitarias (fechas a partir de la fecha límite).
- `nextBestAction(...)` shared, con pruebas.
- V2GrantDetail reorganizado; GrantPlanPanel y GrantChecklistPanel retirados de la vista.
- Verificación con Playwright en un grant real, EN y ES.
