# Táctica Aterrizada

Wizard de 8 pasos que convierte una idea en un **plan de ejecución validado**, con ROI calculado, matriz ROI × riesgo, diagnóstico automático y **registro de resultados reales** para comprobar si la táctica cumplió.

```
npm install
npm run dev        # http://localhost:5173
npm test           # tests de humo del store (Vitest)
npm run build      # typecheck + build de producción en dist/
```

## Qué hace

| Área | Implementación |
|---|---|
| Wizard 8 pasos | `src/views/Wizard.tsx` + `steps.tsx`. react-hook-form + zod (`src/lib/schema.ts`). No se puede saltar a un paso posterior al primero inválido; “Validar y seguir” bloquea sin datos mínimos. Los borradores se guardan mientras escribes. |
| ROI | `(retornoEsperado − inversionEstimada) / inversionEstimada` (`calcROI`). La inversión es la suma automática del desglose. |
| Ciclo de vida | Tablero Kanban Borrador → Aprobada → Ejecutando → Medida. Para salir de Borrador hacen falta los 8 pasos válidos. |
| Portafolio | Matriz SVG ROI × riesgo (tamaño = inversión) + tabla comparativa ordenable. |
| Diagnóstico | `src/lib/insights.ts`: reglas deterministas, entre 3 y 6 hallazgos (título, evidencia, acción), ordenados por impacto. |
| Estado | Zustand con acciones puras, undo/redo de 30 pasos (Ctrl/⌘+Z, Ctrl/⌘+⇧+Z), auto-guardado con debounce de 500 ms en `localStorage["vn-tactica-aterrizada"]` como `{ v: 1, updatedAt, data }`. |
| Exportación | PDF ejecutivo A4, PNG 2x con marca de agua, CSV, JSON re-importable, enlace compartible `?s=` (lz-string). |
| UX | Cmd/Ctrl+K, búsqueda + filtros combinables, confirmaciones, Reset escribiendo `BORRAR`, tour de 3 pasos (driver.js), skeletons, error boundary con exportación de rescate. |

## Decisiones de producto (lo que el brief no fijaba)

1. **Extensiones del modelo** (compatibles con el brief):
   - `canal`: necesario para el insight de *concentración de inversión*.
   - `fechaInicio`: necesario para *listas para ejecutar esta semana*.
   - Paso 5 `probabilidad` e `impacto` (1-5): el riesgo pasa a ser un número (0-25) para poder ponerlo en la matriz y ordenarlo.
   - `mediciones[]` `{fecha, valorKpi, retornoReal, nota}`: **resultados comprobables**. Con ellos se calcula el ROI real y el *ritmo* (% del retorno conseguido frente a % del horizonte consumido).
   - `createdAt` / `updatedAt`.
2. **Inversión = suma del desglose.** Así no hay incoherencias; zod lo verifica igualmente.
3. **“Lista para ejecutar esta semana”** = estado *Aprobada*, 8/8 pasos válidos, ROI ≥ 0 y fecha de inicio vacía o dentro de los próximos 7 días.
4. **Riesgos recurrentes**: palabras significativas (≥ 5 letras, sin stopwords, plural → singular) que aparecen en el riesgo de 2 o más tácticas.
5. **Concentración**: alerta si un canal tiene ≥ 50 % de la inversión (impacto alto si ≥ 75 %).
6. **Insights adicionales**: ritmo real por debajo del plan, ejecución sin mediciones, costo de herramientas fuera del desglose, desviación entre ROI real y proyectado > 30 puntos y borradores incompletos. Si saltan menos de 3 reglas, se completa con hallazgos de salud del portafolio.
7. **Drag & drop**: el Kanban usa `@dnd-kit/core` con un gestor de coordenadas propio: las flechas saltan de columna en columna. El orden del plan (paso 2) usa `@dnd-kit/sortable`. En pantallas de menos de 768 px el arrastre se sustituye por el menú “Mover a…” y por botones de subir y bajar.
8. **Ctrl/⌘+Z dentro de un campo de texto** usa el deshacer nativo del navegador; fuera de los campos usa el historial de la app. Las ediciones seguidas de un mismo campo se agrupan en una sola entrada del historial.
9. **Enlace compartido**: `compressToEncodedURIComponent` de lz-string, que es base64 apto para URL. Al abrirlo se muestra en modo solo lectura; “Duplicar para editar” añade las tácticas compartidas a tus datos locales.
10. **Paleta**: solo blanco, negro, amarillo `#FFE600`, azul `#0047FF` y rojo `#D10000` para los errores (los errores necesitan un color propio además del texto).

## Usar tus recursos: dominio + Supabase + Coolify

### 1. Supabase (opcional, recomendado)
1. Crea un proyecto y ejecuta `supabase/schema.sql` en el SQL Editor. Crea `workspaces` (copia en la nube por usuario, con RLS) y `shared_snapshots` (enlaces cortos de solo lectura).
2. Authentication → URL Configuration: añade `https://tactica.tudominio.com` como Site URL y Redirect URL (para el magic link).
3. Copia la *Project URL* y la *anon public key*.

Sin estas variables la app funciona 100 % en local.

### 2. Coolify
1. New Resource → Public/Private Repository → este repo, rama principal. Build Pack: **Dockerfile**.
2. Build Variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_PUBLIC_URL=https://tactica.tudominio.com`
3. Puerto expuesto: `80`. Healthcheck: `/healthz`.
4. El build del Docker ejecuta los tests: si fallan, no se despliega.

### 3. Dominio
- DNS: registro `A` de `tactica.tudominio.com` apuntando a la IP de tu servidor Coolify (o un `CNAME` si usas proxy).
- En Coolify → Domains: `https://tactica.tudominio.com`. Coolify emite el certificado SSL con Let's Encrypt.

### Verificar el despliegue
- `https://tactica.tudominio.com/healthz` → `ok`
- Cargar el ejemplo → exportar PDF → copiar el enlace → abrirlo en incógnito: debe aparecer el banner de snapshot.
- Con Supabase: Ajustes → Entrar con email → Subir; en otro dispositivo, Descargar.

## Estructura

```
src/
  lib/       schema (zod), calc (ROI, riesgo, ritmo), insights, exporters, persistence, supabase, sample, tour
  store/     useTacticaStore (datos + historial), useUiStore (vista, filtros, toasts, confirmaciones)
  views/     Board (Kanban dnd), Portfolio (matriz + tabla), Wizard + steps
  components/ Modal, ConfirmDialog, Toasts, InsightsPanel, CommandPalette, Settings, Matrix, ExportStage, ErrorBoundary
  test/      store.test.ts
supabase/schema.sql · Dockerfile · nginx.conf · .github/workflows/ci.yml
```

© Vilma Núñez, PhD — Todos los derechos reservados
