# Grant Radar: reingeniería de lógica y UX

## Qué cambia para el usuario
- Desaparece el bloque "Local decision record" de la ficha de cada convocatoria. Lo útil (fechas de descubrimiento, veces vista) pasa a una línea discreta de "Historial" al pie.
- El Radar abre con una sola vista clara: **"Para IIAL"** — las convocatorias ordenadas por lo que conviene hacer hoy, agrupadas por país (como en coincidencias), con monto mínimo de 50.000 aplicado por defecto.
- Cada tarjeta muestra en una línea: veredicto (Puedes aplicar / Falta información / No aplica), cierre ("Cierra en 12 días"), monto, país, y **un solo botón** con la siguiente acción (Revisar requisitos → Evaluar → Redactar).
- Filtros compactos en una barra (país, sector, monto, con fecha), con chips removibles y contador de "ocultas por filtros".
- Se eliminan duplicados: modo "express/advanced", tablero Kanban y vista de excepciones se fusionan en la vista principal + un filtro "Estado". Menos pantallas, misma capacidad.
- Estados vacíos y de carga útiles (qué hacer, no solo "sin resultados").

## Lógica (reingeniería)
1. **Un solo cálculo de prioridad**, puro y probado, en un módulo nuevo: combina veredicto determinista de elegibilidad, urgencia del cierre vs. las 4 semanas de preparación de IIAL, monto y afinidad de la búsqueda. Reemplaza los varios ordenamientos dispersos en la ruta y el componente.
2. Convocatorias vencidas o que cierran antes del tiempo de preparación bajan al final con aviso "No da tiempo", en lugar de mezclarse.
3. El filtrado queda en un solo lugar (hoy está repartido entre servidor, ruta y componente); el país sigue filtrándose en servidor.
4. Se quitan estados y efectos redundantes de la ruta (hoy ~20 estados y varios efectos encadenados) y el código muerto que quede tras la fusión de vistas.
5. El veredicto sigue siendo determinista: el modelo nunca decide elegibilidad.

## Verificación
- Pruebas unitarias del cálculo de prioridad y filtros.
- Prueba end-to-end del Radar actualizada (buscar, filtrar, abrir una convocatoria).
- Captura de pantalla del Radar y de la ficha en el navegador con la cuenta de prueba.

## Detalles técnicos
- Nuevo `src/lib/grant-radar.ts` (priorización + filtros puros) con tests Vitest.
- Reescritura de `src/components/v2/V2GrantsWorkspace.tsx` (1.589 líneas) en piezas más pequeñas bajo `src/components/grants/radar/`.
- Simplificación de `src/routes/_authenticated.grants.index.tsx`; se conservan server functions existentes.
- `V2GrantDetail.tsx`: eliminar el aside oscuro con colores fijos; usar tokens semánticos.
- Sin cambios de base de datos.
