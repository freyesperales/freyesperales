# CLAUDE.md

Guía para trabajar en este repositorio. Léela antes de hacer cambios.

## Qué es esto

El repositorio especial de perfil de GitHub de **freyesperales** (un repo cuyo
nombre coincide con el usuario se muestra en su página de perfil). El `README.md`
es la portada del perfil.

La idea central: **el perfil no es estático**. Un generador propio en TypeScript
(`src/`) consulta la API de GitHub y **pre-renderiza SVGs** que el README embebe.
Un workflow de GitHub Actions lo reconstruye a diario y commitea los assets.

**Principio rector — sin servicios de terceros.** Todo (datos, render, animación,
temas) se hace en casa. No añadas dependencias de runtime, servicios externos,
ni imágenes generadas por terceros. Si algo parece necesitar un servicio externo,
prefiere renderizarlo nosotros (así nació `src/render/snake.ts`, que sustituyó a
la action `Platane/snk`).

## Arquitectura

Pipeline puro de datos → render:

```
src/api/github.ts   fetchStats() → una sola query GraphQL → GitHubStats (reshape puro)
src/types.ts        contratos del dominio (todo readonly, framework-agnóstico)
src/theme.ts        ÚNICA fuente de tokens visuales (colores, fuentes, radius)
src/render/*.ts     funciones puras (stats, theme) => string  (un SVG cada una)
src/render/svg.ts   helpers compartidos: esc(), truncate(), themeStyle(), heatmapStyle()
src/main.ts         orquesta: fetch → render → writeIfChanged → inyecta README
```

Renderers actuales (cada uno escribe `assets/<nombre>.svg`):
`hero`, `stats`, `activity` (heatmap de contribuciones), `now` (repos recientes),
`snake` (la serpiente que recorre el año).

## Convenciones (respétalas — el código es consistente)

- **Renderers = funciones puras** `(stats, theme) => string`. Nada de I/O ni de
  estado dentro de un renderer.
- **`theme.ts` es la única fuente de verdad visual.** Cambiar el aspecto de todo
  el perfil = editar solo ese archivo. No hardcodees colores en los renderers;
  usa las clases CSS (`.accent`, `.muted`, `.cell l0..l4`, etc.).
- **Tema claro/oscuro vía variables CSS dentro del SVG** (`themeStyle()`).
  GitHub respeta `<style>` con `prefers-color-scheme` dentro de un SVG embebido,
  pero lo elimina del Markdown. Por eso todo color va por variable CSS.
- **Animación: solo SMIL** (`<animate>`), nunca JS ni `<foreignObject>`. El proxy
  de imágenes de GitHub (Camo) sirve el SVG estáticamente; SMIL sobrevive, JS no.
  Patrón habitual: revelado one-shot con `fill="freeze"` (el estado de reposo es
  la imagen completa). Para `calcMode="linear"` puedes omitir `keyTimes` (se
  distribuyen uniformes) y ahorrar bytes.
- **Escapa SIEMPRE datos de la API** con `esc()` antes de interpolarlos en el SVG
  (nombres de repo, descripciones). Previene inyección de markup.
- **Sin fallbacks silenciosos.** `fetchStats` lanza ante cualquier error de red /
  HTTP / GraphQL / usuario vacío; `requireEnv` falla si falta una env var. Mantén
  esa disciplina: mejor romper ruidosamente que servir datos obsoletos.
- **`writeIfChanged`** evita commits vacíos: solo escribe si el contenido cambió.

## README: NO edites `README.md` a mano

`README.md` es generado. Edita **`README.template.md`** y deja que `main.ts` lo
regenere (copia la plantilla e inyecta la región entre `<!-- GENERATED:START -->`
y `:END`). Los SVGs se embeben con rutas relativas estables (`./assets/x.svg`),
así que el README casi nunca cambia aunque los assets sí.

## Build y verificación

```bash
npm run build       # genera assets + README  (necesita env GH_LOGIN y GH_TOKEN)
npm run typecheck   # tsc --noEmit
```

- Requiere **Node ≥ 20** (usa `fetch` nativo). ESM puro (`"type": "module"`):
  los imports relativos llevan extensión **`.js`** aunque el archivo sea `.ts`.
- Para **probar un renderer sin token**: crea un script temporal *dentro* de la
  raíz del proyecto (para que resuelvan los imports relativos), fabrica un
  `GitHubStats` sintético y llama al renderer. Revisa tamaño del SVG y que
  contenga `<svg`, `<animate>`, etc. Borra el script temporal al terminar.

## Automatización (GitHub Actions)

- **`.github/workflows/build-profile.yml`** — único workflow. Corre a diario
  (cron 06:00 UTC), en `workflow_dispatch`, y al hacer push que toque
  `src/**`, `README.template.md` o el propio workflow. Usa el `GITHUB_TOKEN`
  automático (sin PAT). Commitea `assets/` y `README.md` solo si cambiaron,
  con `[skip ci]`.
- Permisos mínimos: `contents: write`. No amplíes el scope salvo necesidad real.

## Notas / deuda

- La rama `output` y el segundo workflow (`generate-snake.yml`) eran del snake de
  terceros y **ya se retiraron**. La rama `output` puede seguir existiendo en el
  remoto; es inofensiva y puede borrarse (`git push origin --delete output`).
- El asset `assets/snake.svg` lo genera el workflow en el próximo push a `main`
  que toque `src/**`; hasta entonces el README lo referencia pero el archivo aún
  no existe en el repo.
