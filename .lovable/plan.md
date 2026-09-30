# Auditoría completa de GrantDesk

Objetivo: dejar la app sin bugs conocidos, sin código muerto ni restos de la cadena de IA antigua, funcionando solo con Lovable Cloud, y con pruebas automáticas que demuestren que la búsqueda y el análisis de grants funcionan.

## Fase 1 — Inventario y código muerto
- Mapear qué archivos, funciones de servidor y componentes se usan desde alguna página; listar los huérfanos.
- Eliminar los restos de la cadena antigua (Cerebras/Groq/Gemini/Ollama): `llm-cloud.server.ts`, referencias a `OLLAMA_*`, `CEREBRAS_*`, `GROQ_*`, variables de entorno y textos de interfaz que las mencionan.
- Borrar componentes, páginas v1/v2 duplicadas y dependencias npm sin uso.
- Quitar comentarios obsoletos y `TODO` que ya no aplican.

## Fase 2 — Bugs y deuda técnica
- Revisar logs de ejecución, consola y red de la vista previa; corregir cada error.
- Revisar funciones de servidor: validación de entrada, autenticación donde toca, y que ninguna ruta pública devuelva datos privados.
- Base de datos: ejecutar el linter de seguridad, revisar políticas de acceso y permisos de cada tabla, y reponer el alta automática de perfil/rol para usuarios nuevos (quedó pendiente) — probándola con un registro real.
- Unificar consultas duplicadas y patrones de carga de datos inconsistentes.
- Resolver el caso pendiente de `scraped.via === "direct"` en el enriquecedor.

## Fase 3 — Reingeniería de búsqueda y análisis (donde haga falta)
- Búsqueda híbrida (texto + vectores + RRF): comprobar que todos los grants tienen embedding, que la consulta usa el mismo espacio de 768 dimensiones y que los resultados se ordenan de forma estable.
- Elegibilidad: mantener la lógica determinista; revisar casos límite (sin monto, sin fecha, jurisdicción múltiple, "unknown").
- Análisis con IA (brief, estrategia, redacción): manejo correcto de errores del servicio (429/402/403) mostrado al usuario, sin reintentos indebidos.

## Fase 4 — Pruebas sintéticas
- Pruebas unitarias (vitest) de elegibilidad, fusión RRF, estructurado de texto leído y filtros por país/monto, con fixtures deterministas.
- Prueba de integración contra la nube: búsquedas conocidas ("clean tech Ontario", "youth education US") deben devolver grants relevantes esperados en el top-N.
- Prueba en vivo del análisis con IA sobre un grant real para IIAL, validando la forma de la respuesta.
- E2E en navegador: login → búsqueda de grants → filtro → abrir grant → ver coincidencias de IIAL → análisis → borrador de propuesta.
- Registro nuevo de usuario de punta a punta.

## Fase 5 — Cierre
- Typecheck en 0 errores, build limpio, todas las pruebas en verde.
- Actualizar AGENTS.md con las decisiones y un informe breve de hallazgos corregidos.

## Detalles técnicos
- Todo el tráfico de IA: Lovable AI Gateway (`openai/gpt-6-astra` en `/v1/responses`, `google/gemini-embedding-2`).
- Cambios de esquema solo aditivos; lo retirado queda marcado `DEPRECATED`.
- Las pruebas contra la nube usan la cuenta de prueba existente y no modifican los datos de IIAL.
