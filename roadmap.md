# Roadmap

- [x] Recomendar usos de las nuevas funciones de IA de Lovable para GrantDesk; no activar servicios sin autorización.

- [ ] Unificar idioma de detalles, requisitos y evaluaciones con el selector EN/ES, sin alterar evidencia ni decisiones.

- [ ] Replicar para Juan Marcelo y Clarissa el perfil institucional y preparación de conocimiento usados por Rocío.
- [x] Unificar el sistema visual en todas las pantallas, eliminando mezclas incoherentes de superficies claras y oscuras.
- [x] Automatizar búsqueda, validación determinista y clasificación de todos los grants existentes y nuevos.
- [x] Garantizar búsqueda multicriterio (palabras clave, títulos, resúmenes, agencias y embeddings) con fallback cuando no hay vectores cargados.
- [x] Auditoría integral y evaluación 1-a-1 de las 54 convocatorias del catálogo con el perfil institucional de Rocío, con fallback determinista ante saturación de LLMs.
- [x] Incorporar botón de auto-evaluación en lote con progreso en tiempo real en la barra de herramientas del Radar.
- [ ] Replicar para Juan Marcelo y Clarissa el perfil institucional y preparación de conocimiento usados por Rocío.
- [x] Mostrar razones de descarte comprensibles en el listado de resultados (Radar/Cards) y sincronizar el veredicto del evaluador sin incoherencias en todo el sistema.
- [ ] Eliminar pasos redundantes y verificar el flujo completo con los tres administradores.
- [x] Ejecutar pruebas de reglas, seguridad, tipos y recorrido end-to-end.
- [x] Mover requisitos críticos detectados en la propuesta Alliance al análisis inicial del grant.
- [x] Ejecutar y consolidar revisión experta y matriz de cumplimiento durante la evaluación del grant.
- [x] Auditar a fondo Alliance, corregir enriquecimiento/análisis y validar con otro grant sin evaluación previa.

- [x] Crear una cola reanudable para reprocesar cada grant con extracción, reglas y controles estrictos.
- [x] Registrar cobertura, bloqueos y calidad por grant sin inventar evidencia.
- [x] Corregir Grants.gov y tratar montos no publicados como desconocidos, no como fallos técnicos.
- [x] Fijar V2 como experiencia única y rescatar accesos y funciones operativas útiles de V1.
- [x] Crear rol `consultant` (solo Home y Grant Radar) y asignarlo a Rocío Elizabeth.
- [x] Auditoría extrema, erradicación de bugs y deuda técnica: resolución atómica en `funders_name_country_key`, persistencia administrativa de requisitos/briefs y guardas defensivas en `FitRules`.
- [x] Ciclo de subsanación (remediation loop): habilitar actualización de facts manuales con re-evaluación forzada determinista (`Re-check fit`) para desbloquear propuestas bloqueadas.
- [x] Suite de pruebas sintéticas end-to-end (`npm run test:synthetic`) cubriendo ingestión, síntesis de requerimientos, brief financiero, subsanación y aislamiento multi-tenant.
