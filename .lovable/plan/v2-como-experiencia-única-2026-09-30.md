# V2 como experiencia única

## Objetivo

Retirar el selector V1/V2, abrir siempre la experiencia V2 y rescatar en ella los accesos útiles que solo existían en V1.

## Cambios

- Fijar V2 para todas las pantallas autenticadas, ignorando cualquier preferencia V1 guardada anteriormente.
- Eliminar los selectores visibles de versión en escritorio y móvil.
- Comparar navegación y pantallas condicionales V1/V2; conservar en V2 los accesos útiles faltantes, especialmente clientes y herramientas administrativas directas.
- Mantener temporalmente las vistas V1 internas solo como código de referencia para evitar una eliminación riesgosa en este cambio; ya no serán accesibles desde el portal.
- Corregir cualquier advertencia relacionada con navegación duplicada detectada durante la revisión.

## Verificación

- Confirmar que una preferencia antigua `v1` abre V2.
- Recorrer escritorio y móvil, comprobar que no aparece el selector y que los accesos incorporados funcionan.
- Revisar errores de compilación y consola.

## Detalles técnicos

- La compatibilidad del contexto de versión se mantendrá para las pantallas existentes, pero devolverá exclusivamente `v2`.
- La navegación V2 será la fuente única visible; no se cambiará la lógica de grants ni los datos.
