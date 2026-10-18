# Roadmap

- [x] Retirar la dependencia Mermaid/graphlib del chat; inicio y conversación guardada comprobados con sesión real, sin errores. Compilación automática y 5 pruebas pasan; la revisión publicada requiere publicación.
- [x] Comparar OpenClaw, Hermes y capacidades de Lovable: priorizar vigilancia verificable, memoria editable, lectura de PDFs y acciones con aprobación; sin activar servicios.

- [x] Agente de grants (/agent): conversaciones guardadas, catálogo → web → página oficial, fichas recomendadas, chequeo de país, glosario, vigilancias y bandeja "Hecho por el agente". Probado con sesión real.
- [ ] Vigilancia diaria automática: falta activar la tarea programada (requiere activar programación y firma en el backend).
- [ ] Correos del agente (resumen matutino, alertas, envíos aprobados): requiere configurar el dominio de correo de IIAL.
- [ ] Lectura de PDFs subidos y acciones del agente (guardar en pipeline, crear plan, checklist) desde el chat.

- [x] Mejorar búsqueda y análisis: citas por convocatoria, aviso de enlaces no corroborados, fechas desconocidas explícitas y montos sin mezclar monedas; 71 pruebas pasan, sin cambiar proveedores ni añadir llamadas pagadas.
- [ ] Verificar búsqueda → abrir → análisis con una sesión real. Radar, detalle y plan comprobados con sesión real; falta una nueva ejecución IA en vivo.

- [x] Recomendar usos de las nuevas funciones de IA de Lovable para GrantDesk; no activar servicios sin autorización.

- [ ] Unificar idioma de detalles, requisitos y evaluaciones con el selector EN/ES, sin alterar evidencia ni decisiones. Etiquetas y cambio EN/ES comprobados con sesión real; la traducción de contenido mostró espera y textos históricos en inglés, por lo que la cobertura completa sigue pendiente de traducción en vivo.

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

## Limpieza y estabilización aprobada

- [x] Retirar código huérfano y selección V1/V2; conservar interfaces públicas.
- [x] Conservar procedencia y detalle de pendientes; impedir nuevas duplicaciones.
- [x] Sincronizar evaluación, decisión y siguiente acción; resolver fechas contradictorias.
- [x] Evitar catálogo truncado y errores de fuentes presentados como éxito.
- [x] Recuperar análisis no guardados sin regenerar IA; pruebas y verificación real.
- [x] Consolidar contratos y documentación; pruebas deterministas y compilación automática limpias.
- [ ] Revisar permisos señalados por el escáner nuevo: acceso amplio a requirements, tenants, source_runs y configuración. Bloqueo: validar el acceso intencionado por rol antes de restringirlo; no se cambiaron permisos en esta limpieza.
- [ ] Verificación de revisión IA y recuperación de guardado fallido contra servicios reales. Las regresiones automatizadas pasan; no se forzó un fallo en datos reales ni se inició otra revisión pagada.

## Agente: workspace dual y pipeline multiagente

- [x] Tabla `agent_workspace` (estado, decisión, análisis con citas, tareas con procedencia) con RLS por usuario.
- [x] Extractor rápido (Gemini Flash, JSON estricto, cita exacta por dato) aislado del orquestador.
- [x] Herramientas `analyze_grant` y `save_to_workspace`; panel "Plan de trabajo" editable junto al chat.
- [x] Activar la vigilancia diaria automática: trabajo `iial-agent-watch-daily` (11:30 UTC) firmado con HMAC; secreto sembrado en `webhook_config`. Entra en vigor al publicar (el cron apunta a la URL publicada).
- [ ] Correos del agente (resumen matutino, alertas). Bloqueo: falta configurar el dominio de correo de IIAL.
- [x] Lectura de PDFs adjuntos en el chat: el extractor rápido (Gemini Flash) transcribe el documento y el orquestador solo recibe texto; el base64 nunca se guarda en la base de datos.
