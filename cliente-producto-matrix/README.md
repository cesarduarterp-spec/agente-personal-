# Cliente × Producto Matrix

Herramienta de análisis de cross-sell: matriz **Avatar (filas) × Producto (columnas)** donde cada celda guarda compra, unidades, NPS del match y notas. Calcula ingresos, cobertura, índice de cross-sell, afinidad y un diagnóstico ejecutivo automático.

## Arrancar

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # tests de humo del store (Vitest)
npm run build      # build de producción en dist/ (base relativa: se puede servir desde cualquier ruta)
```

## Qué incluye

- **Matriz** con totales por fila (ingreso, unidades, cobertura) y por columna (precio y cobertura en el header; ingreso, unidades y cobertura en el footer). Heatmap opcional por ingreso.
- **Popover de celda** (clic o Enter): compra, unidades, NPS 0–10 y notas, con validación zod.
- **Vista Oportunidades**: celdas vacías ordenadas por `tamañoSegmento × precio`, con filtros por avatar y producto.
- **Diagnóstico ejecutivo** (panel colapsable): de 3 a 6 hallazgos deterministas con título, evidencia y acción sugerida, ordenados por impacto.
- **CRUD** de avatares y productos (react-hook-form + zod), modal de confirmación reutilizable y Reset con doble confirmación (hay que escribir `BORRAR` a mano).
- **Drag & drop** de filas y columnas con @dnd-kit, también por teclado: Espacio toma, flechas mueven, Enter suelta y Escape cancela. Los anuncios aria-live están en español. En móvil se sustituye por el menú «Mover a…».
- **Undo/redo** de las últimas 30 acciones (`Ctrl/⌘+Z`, `Ctrl/⌘+Shift+Z`).
- **Cmd/Ctrl+K**: crear, buscar avatar o producto, saltar de vista, exportar, importar, resetear y reactivar el tour.
- **Exportación**: PNG 2x con marca de agua, PDF ejecutivo A4, CSV, JSON re-importable y enlace compartible.
- **Persistencia** en `localStorage["vn-cliente-producto-matrix"]` como `{ v: 1, updatedAt, data }`, con auto-guardado (debounce de 500 ms) y el indicador «Guardado hace Xs».

## Decisiones de producto (lo que el brief dejaba abierto)

| Tema | Decisión |
|---|---|
| Ingreso de una celda | `compra ? unidades × precio : 0`. Si una celda está desmarcada conserva sus datos, pero no suma. |
| Cobertura | Fila: productos comprados / total de productos. Columna: avatares que compran / total de avatares. Global: matches / (avatares × productos). |
| Índice de cross-sell | Media de productos comprados por cada avatar que compra al menos uno. |
| Afinidad | NPS medio de los matches ponderado por unidades. En Oportunidades se muestra además el NPS medio que el producto obtiene en otros avatares. |
| Impacto de los insights | Se mide en moneda para poder ordenarlos. Mono-producto: potencial del mejor hueco del avatar. Huérfano: 1 % del mercado × precio. Match perfecto: ingreso de esos matches. Concentración: ingreso de la celda top × su peso. También se añaden reglas para detractores (NPS ≤ 6) y avatares sin compras. Si no salen 3 hallazgos, se completan con «mayor hueco» y «cobertura». |
| Heatmap | Cinco escalones discretos de amarillo y negro, sin degradados, relativos a la celda de mayor ingreso. Lleva leyenda. |
| Matriz en `<table>` y no en SVG | Una tabla semántica da cabeceras de fila y columna leíbles por lectores de pantalla, celdas enfocables y sticky headers. En pantallas de menos de 768 px pasa a tarjetas apiladas por avatar. |
| PNG/PDF | Se captura una copia de la matriz completa, inerte y fuera de pantalla, sin filtros ni controles. Así la exportación es idéntica desde cualquier vista y dispositivo. En el PDF, la página de la matriz es apaisada. |
| Enlace compartido | `?s=` lleva el envoltorio versionado comprimido con `lz-string` (`compressToEncodedURIComponent`, base64 URL-safe). Se abre en solo lectura con un banner. «Duplicar para editar» lo copia a tu localStorage, pidiendo confirmación si ya tenías datos. |
| CSV | Una fila por celda avatar × producto, también las vacías, con ingreso y potencial. Separador coma, en UTF-8 con BOM para que Excel lo abra bien. |
| Tipografía | Space Grotesk llega como máximo a 700. Los titulares piden 900 y el navegador usa el peso más alto disponible. Las fuentes van autoalojadas (@fontsource) para que el PNG las incruste. |
| Store | Un único store Zustand con un slice de datos (con historial) y un slice de UI. Los selectores están memoizados por referencia (`src/store/selectors.ts`). |
| Moneda | EUR por defecto. Se puede cambiar en Ajustes (USD, MXN, COP, ARS, CLP, PEN). |
| Tour | driver.js, 3 pasos. Solo aparece la primera vez y se puede reactivar desde Ajustes o con Cmd+K. |

## Estructura

```
src/
  types.ts                 modelo de datos
  store/useAppStore.ts     store Zustand (acciones puras + historial)
  store/selectors.ts       selectores memoizados (métricas, insights, filtros)
  lib/metrics.ts           totales, cobertura, oportunidades, heatmap
  lib/insights.ts          motor de reglas del diagnóstico
  lib/schema.ts            esquemas zod (import, share y formularios)
  lib/persistence.ts       localStorage versionado + debounce
  lib/share.ts             enlace ?s= con lz-string
  lib/exporters.ts         PNG, PDF, CSV y JSON
  components/              UI (matriz, popover, paleta, modales, panel…)
```

© Vilma Núñez, PhD — Todos los derechos reservados
