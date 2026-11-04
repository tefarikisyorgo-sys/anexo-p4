# Anexo P4 – Customer journey Falabella (julio 2026)

Página web estática (una sola página) con el detalle de la Pregunta 4 del desafío: estados del customer journey y probabilidades de transición, para compradores y no compradores. Solo usa datos agregados (conteos y porcentajes); no contiene datos de clientes ni de visitas individuales.

## Estructura
```
index.html              página única con 7 secciones (menú de anclas)
assets/css/style.css    estilos
assets/js/app.js        lee data/*.json y dibuja mapas, matrices, tablas y gráficos
data/                   10 JSON agregados (fuente única de los números)
scripts/                fase7_p4_mapa.R (análisis), build_data.py (CSV → JSON), o2check.R (chequeo aparte)
```

## Cómo funciona
`app.js` carga los JSON con rutas relativas (`./data/...`) y construye cada sección. Ningún número está escrito a mano en la página: si cambia un JSON, la página cambia sola. Si un JSON no carga, la página muestra un aviso.

Para verla en el computador hay que usar un servidor local (por ejemplo `python -m http.server` dentro de la carpeta) y abrir `http://localhost:8000`; abriendo el archivo directo, el navegador bloquea la lectura de los JSON.

## Publicar en GitHub Pages
1. Crear un repositorio público (por ejemplo `anexo-p4`) y subir **el contenido** de esta carpeta a la raíz (que `index.html` quede en la raíz del repo).
2. En el repositorio: **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` / `(root)` → Save**.
3. A los 1–2 minutos queda en `https://<usuario>.github.io/anexo-p4/`.

Versión publicada: https://tefarikisyorgo-sys.github.io/anexo-p4/

## Regenerar los datos
1. En R, con `df_markov` cargado: `source("scripts/fase7_p4_mapa.R")` y exportar los objetos `p4_*` a CSV.
2. `python scripts/build_data.py` → reescribe `data/*.json`.

## Notas de interpretación
- Compradores = clientes que compraron al menos una vez en julio; no son visitas con compra.
- Muestra balanceada (5.000 y 5.000): las tasas no son la conversión real de Falabella.
- La tabla de procedencia de Producto es un análisis complementario por cambio de estado; no es el orden 2 de la cadena base.
- Los resultados de M.1–M.6 se transcriben del informe; la página no los recalcula.
