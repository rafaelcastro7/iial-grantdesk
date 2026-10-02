# Reprocesamiento estricto de todo el catálogo

## Objetivo

Llevar cada grant a la máxima **calidad verificable**: fuente oficial vigente, requisitos extraídos con evidencia, elegibilidad determinista, evaluación experta y estado operativo claro. Un grant nunca obtendrá una valoración alta si faltan pruebas; quedará como “requiere verificación”.

## Situación encontrada

- 400 grants registrados; 398 activos.
- 397 siguen como descubiertos.
- Solo 2 tienen enriquecimiento y requisitos.
- Solo 3 tienen evaluación guardada.
- El proceso automático actual evalúa únicamente grants ya enriquecidos, toma 10 por visita y depende de mantener abierta la página.
- La revisión experta y la matriz de cumplimiento actuales se ejecutan tarde, cuando ya existe una propuesta.

## Implementación

### 1. Expediente de evaluación único por grant

- Añadir un estado persistente por grant con versión del criterio, fase actual, cobertura, intentos, bloqueo, última fuente comprobada y próxima acción.
- Registrar resultados por etapa: vigencia, enriquecimiento, requisitos críticos, evidencia, elegibilidad, revisión experta previa y matriz previa a la propuesta.
- Mantener historial y propuestas existentes; no borrar el catálogo.

### 2. Cola segura y controlada

- Crear una cola deduplicada para los 400 grants y procesarla en lotes pequeños y secuenciales.
- Añadir bloqueo de ejecución, límite por corrida, reanudación idempotente y pausa persistente ante créditos, políticas, denegaciones o límites de tráfico.
- Priorizar grants abiertos y próximos a vencer; cerrar o archivar los vencidos y duplicados con explicación.
- Respetar Cerebras → Groq → Gemini → Lovable para texto; Lovable seguirá reservado como respaldo y para embeddings.

### 3. Evaluación estricta desde el inicio

Por cada grant:

1. Confirmar URL y vigencia en fuente oficial.
2. Extraer monto, fecha, jurisdicción, solicitantes, sectores, documentos, socios, cofinanciación y criterios.
3. Guardar evidencia textual y URL para cada dato crítico.
4. Ejecutar las reglas deterministas contra el perfil institucional compartido de IIAL.
5. Ejecutar una revisión experta del análisis del grant, no solo de la propuesta.
6. Generar una matriz de cumplimiento previa con `cumple`, `no cumple`, `desconocido` y acción necesaria.
7. Clasificar como aplicable, subsanable, requiere verificación o descartado; “desconocido” nunca contará como aprobado.

### 4. Iteración crítica

- Calcular una puntuación de cobertura, separada del fit: la cobertura mide qué tan completo y comprobable es el análisis.
- Reintentar únicamente etapas incompletas o desactualizadas, sin repetir llamadas exitosas.
- Detectar patrones de fallo por lote y corregir extractores/reglas antes de continuar con los siguientes grants.
- Crear pruebas de regresión con los casos que fallen durante cada iteración.

### 5. Experiencia en Grant Radar

- Mostrar progreso global: pendientes, procesando, completos, bloqueados y no verificables.
- Mostrar en cada grant la cobertura, fecha de comprobación, requisitos críticos y razón exacta del estado.
- Permitir “subsanar”, “omitir con justificación” y revalidar, conservando trazabilidad.
- No permitir iniciar propuesta cuando exista un requisito crítico sin resolver o evidencia insuficiente.

### 6. Verificación

- Ejecutar pruebas unitarias de extracción, reglas, matriz y clasificación.
- Probar recuperación ante fallos, reanudación y ausencia de duplicados.
- Validar grants de distintos países y tipos, incluido Alliance, y luego un muestreo estratificado del catálogo.
- Probar el recorrido completo con Rocío, Juan Marcelo y Clarissa, usando el mismo perfil institucional.
- Entregar un informe final con cobertura real, fallos por fuente, descartes justificados y elementos que requieren intervención humana.

## Criterio de terminación

Cada grant tendrá un resultado explícito y auditable. “Máxima evaluación” no significará forzar 100/100: significará que todos los controles aplicables se ejecutaron, cada afirmación crítica tiene evidencia y cualquier dato ausente queda claramente bloqueado para revisión.
