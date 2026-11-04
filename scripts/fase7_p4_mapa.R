# =============================================================================
# FASE 7 — PREGUNTA 4: ¿por qué estados transita el cliente y con qué probabilidad se mueve?
# =============================================================================
# QUÉ HACE (orden 1, cadenas CON autotransiciones = base validada en M.1–M.6;
#           compradores y no compradores por separado, como decidió M.3)
#   1. Matriz P de cada cadena y su lectura "por salida" (a dónde va al salir de un estado),
#      con intervalo del 95% por bootstrap por cliente (igual que M.5: 500 réplicas, semilla
#      2026, 5.000 compradores y 5.000 no compradores con reposición, percentiles 2,5 y 97,5).
#   2. Uso de cada estado: % de hits y % de visitas que pasan por él (datos observados).
#   3. ¿Hasta dónde llegan las visitas? (etapa más profunda alcanzada; datos observados).
#      "Rebote" = visita de un solo hit (cualquiera sea el estado), igual que en B.4 y M.4.
#   4. Rutas más frecuentes (secuencia de estados sin repeticiones, de Inicio a Compra/Abandono).
#   5. Estabilidad y sensibilidad de las transiciones clave:
#        - rango semanal S1–S4 (como M.2) y, aparte, S5 (29–31, incluye los días 30–31),
#        - matriz con igual peso por cliente (como M.4).
#   6. ¿Importa de dónde venía? (orden 2 solo como complemento): a dónde va al salir de
#      Producto según el estado anterior.
#   7. Actividad por día (visitas, clientes y compras) para describir los días 30–31.
#
# AVISO
#   - REQUIERE: df_markov (correr antes 00_cargar_todo.R).
#   - Solo LEE df_markov. No modifica nada. NO guarda archivos. Tarda unos 5–10 minutos (bootstrap).
#   - Objetos que crea (todos empiezan con p4_):
#       p4_P          matriz P (%) por cadena, celda a celda, con IC 95% (bootstrap) y lectura por salida
#       p4_uso        % de hits y % de visitas que pasan por cada estado, por cadena
#       p4_profundidad visitas según la etapa más profunda que alcanzan, por cadena
#       p4_rutas      10 rutas más frecuentes por cadena
#       p4_rutas_compra 8 rutas más frecuentes entre las visitas que terminan en compra (compradores)
#       p4_rutas_resumen cuántas rutas distintas hay y cuántos estados recorre una visita, juntando repeticiones seguidas (mediana)
#       p4_clave      transiciones clave: mes, IC 95%, rango semanal S1–S4, S5 y peso igual por cliente
#       p4_dias       visitas, clientes y visitas con compra por día (evento de los días 30–31)
#       p4_evento     compradores que compraron SOLO en los días 30–31 y búsqueda de palabras de campaña en page_name
#       p4_memoria    salida de Producto según el estado anterior (orden 2), por cadena
# =============================================================================
library(data.table)
if (!exists("df_markov")) stop("Falta df_markov: corre antes 00_cargar_todo.R")
set.seed(2026); B <- 500
ESTADOS <- c("INICIO", "PORTADA", "BUSQUEDA", "LISTADO", "PRODUCTO", "AGREGAR_CARRO", "CARRITO",
             "CHECKOUT", "CUENTA_SERVICIOS", "OTROS", "COMPRA", "ABANDONO")
TRANS <- ESTADOS[1:10]
CAD <- c(compradores = 1L, no_compradores = 0L)

# 1. Transiciones (cortadas en la 1ª compra de cada visita), igual que M.1–M.6
h <- as.data.table(df_markov)[, .(unified_id, visit_id, segmento = cliente_compro_en_ventana,
       dia = as.Date(date_time_start), node_order, date_time_start, estado)]
setorder(h, visit_id, dia, node_order, date_time_start)
h[, pos := seq_len(.N), by = visit_id]
h[, pc := if (any(estado == "COMPRA")) min(pos[estado == "COMPRA"]) else NA_integer_, by = visit_id]
h <- h[is.na(pc) | pos <= pc]
vis <- h[, .(uid = unified_id[1], segmento = segmento[1], d = as.integer(format(dia[1], "%d")), hits = .N,
             compra = any(estado == "COMPRA")), by = visit_id]
vis[, semana := fcase(d <= 7, "S1", d <= 14, "S2", d <= 21, "S3", d <= 28, "S4", default = "S5")]
h[, desde := shift(estado, fill = "INICIO"), by = visit_id]
fin <- h[, .(desde = estado[.N], hasta = if (estado[.N] == "COMPRA") NA_character_ else "ABANDONO"), by = visit_id][!is.na(hasta)]
tr <- rbind(h[, .(visit_id, desde, hasta = estado)], fin)
tr[vis, `:=`(uid = i.uid, segmento = i.segmento, semana = i.semana), on = "visit_id"]
tr[, T_cli := .N, by = uid]

# Herramientas
pmat <- function(cn) {                        # cn: desde, hasta, n -> P (%) y por salida (%)
  m <- CJ(desde = TRANS, hasta = ESTADOS)[cn, n := i.n, on = c("desde", "hasta")][is.na(n), n := 0]
  m[, p := 100 * n / sum(n), by = desde]
  m[, p_salida := fifelse(desde == hasta, NA_real_, 100 * n / sum(n[hasta != desde])), by = desde][]
}
# 2. Matriz P con IC 95% por bootstrap por cliente
cnt <- tr[, .(N = .N), by = .(uid, segmento, desde, hasta)]
cli <- unique(cnt[, .(uid, segmento)])[, ci := .I]; cnt[cli, ci := i.ci, on = "uid"]
est <- rbindlist(lapply(names(CAD), function(k) cbind(cadena = k, pmat(cnt[segmento == CAD[[k]], .(n = sum(N)), by = .(desde, hasta)]))))
idx <- split(cli$ci, cli$segmento)
bp <- matrix(NA_real_, B, nrow(est)); bs <- bp
for (b in seq_len(B)) {
  w <- numeric(nrow(cli)); for (s in idx) w[s] <- tabulate(sample(seq_along(s), length(s), replace = TRUE), length(s))
  r <- rbindlist(lapply(names(CAD), function(k) cbind(cadena = k,
         pmat(cnt[segmento == CAD[[k]], .(n = sum(N * w[ci])), by = .(desde, hasta)]))))
  bp[b, ] <- r$p; bs[b, ] <- r$p_salida
  if (b %% 100 == 0) cat("bootstrap", b, "de", B, "\n")
}
q <- function(M, pr) apply(M, 2, quantile, pr, na.rm = TRUE)
p4_P <- est[, .(cadena, desde, hasta, n, p = round(p, 1), p_inf = round(q(bp, .025), 1), p_sup = round(q(bp, .975), 1),
                p_salida = round(p_salida, 1), salida_inf = round(q(bs, .025), 1), salida_sup = round(q(bs, .975), 1))]

# 3. Uso de cada estado (observado)
hh <- copy(h); hh[vis, segmento := i.segmento, on = "visit_id"]
p4_uso <- rbindlist(lapply(names(CAD), function(k) {
  x <- hh[segmento == CAD[[k]]]; nv <- uniqueN(x$visit_id)
  x[, .(hits = .N, visitas_que_pasan = uniqueN(visit_id)), by = estado][
    , `:=`(cadena = k, pct_hits = round(100 * hits / sum(hits), 1), pct_visitas = round(100 * visitas_que_pasan / nv, 1))][] }))
setcolorder(p4_uso, "cadena")

# 4. ¿Hasta dónde llegan las visitas? (etapa más profunda alcanzada)
prof <- hh[, .(segmento = segmento[1], hits = .N, comp = any(estado == "COMPRA"), chk = any(estado == "CHECKOUT"),
               car = any(estado %in% c("CARRITO", "AGREGAR_CARRO")), prod = any(estado == "PRODUCTO")), by = visit_id]
prof[, etapa := fcase(comp, "6 Compra", hits == 1, "1 Rebote (1 hit)", chk, "5 Llega a Checkout",
                      car, "4 Agrega al carro / Carrito", prod, "3 Ve productos", default = "2 Solo navega (sin Producto)")]
p4_profundidad <- prof[, .(visitas = .N, hits_por_visita = round(mean(hits), 1)), by = .(cadena = fifelse(segmento == 1, "compradores", "no_compradores"), etapa)][
  , pct_visitas := round(100 * visitas / sum(visitas), 1), by = cadena][order(cadena, etapa)]

# 5. Rutas más frecuentes (estados sin repeticiones)
ABR <- c(INICIO = "Ini", PORTADA = "Portada", BUSQUEDA = "Búsqueda", LISTADO = "Listado", PRODUCTO = "Producto",
         AGREGAR_CARRO = "AgregarCarro", CARRITO = "Carrito", CHECKOUT = "Checkout", CUENTA_SERVICIOS = "Cuenta",
         OTROS = "Otros", COMPRA = "COMPRA", ABANDONO = "ABANDONO")
rr <- copy(hh)[, prev := shift(estado), by = visit_id][is.na(prev) | estado != prev]
rr <- rr[, .(segmento = segmento[1], n_tramos = .N, ruta = paste(c(ABR[estado], if (estado[.N] != "COMPRA") "ABANDONO"), collapse = " → ")), by = visit_id]
p4_rutas <- rr[, .N, by = .(cadena = fifelse(segmento == 1, "compradores", "no_compradores"), ruta)][
  , pct_visitas := round(100 * N / sum(N), 1), by = cadena][order(cadena, -N)][, .SD[1:10], by = cadena]
p4_rutas[, pct_acumulado := cumsum(pct_visitas), by = cadena]
p4_rutas_compra <- rr[grepl("COMPRA$", ruta), .N, by = ruta][, pct_visitas_con_compra := round(100 * N / sum(N), 1)][order(-N)][1:8]
p4_rutas_compra[, pct_acumulado := cumsum(pct_visitas_con_compra)]
p4_rutas_resumen <- rr[, .(visitas = .N, rutas_distintas = uniqueN(ruta), mediana_estados_distintos = as.numeric(median(n_tramos))),
                       by = .(cadena = fifelse(segmento == 1, "compradores", "no_compradores"))]

# 6. Transiciones clave: mes, IC, rango semanal y peso igual
CLAVE <- list(c("INICIO", "PORTADA"), c("INICIO", "PRODUCTO"), c("PORTADA", "BUSQUEDA"), c("PORTADA", "PRODUCTO"),
              c("BUSQUEDA", "PRODUCTO"), c("LISTADO", "PRODUCTO"), c("PRODUCTO", "PRODUCTO"), c("PRODUCTO", "BUSQUEDA"),
              c("PRODUCTO", "CARRITO"), c("PRODUCTO", "AGREGAR_CARRO"), c("PRODUCTO", "ABANDONO"), c("CARRITO", "CHECKOUT"),
              c("CARRITO", "PRODUCTO"), c("CHECKOUT", "COMPRA"), c("CHECKOUT", "CARRITO"))
lect <- function(m, de, a) if (de == a) m[desde == de & hasta == a, p] else m[desde == de & hasta == a, p_salida]
p4_clave <- rbindlist(lapply(names(CAD), function(k) {
  x <- tr[segmento == CAD[[k]]]
  sem <- lapply(c("S1", "S2", "S3", "S4"), function(s) pmat(x[semana == s, .(n = .N), by = .(desde, hasta)]))
  s5  <- pmat(x[semana == "S5", .(n = .N), by = .(desde, hasta)])
  peq <- pmat(x[, .(n = sum(1 / T_cli)), by = .(desde, hasta)])
  rbindlist(lapply(CLAVE, function(cl) {
    e <- p4_P[cadena == k & desde == cl[1] & hasta == cl[2]]
    ws <- sapply(sem, lect, cl[1], cl[2])
    data.table(cadena = k, transicion = paste(cl[1], "→", cl[2]), lectura = if (cl[1] == cl[2]) "se queda (por hit)" else "por salida",
               mes = if (cl[1] == cl[2]) e$p else e$p_salida, ic_inf = if (cl[1] == cl[2]) e$p_inf else e$salida_inf,
               ic_sup = if (cl[1] == cl[2]) e$p_sup else e$salida_sup, sem_min = round(min(ws), 1), sem_max = round(max(ws), 1), S5 = round(lect(s5, cl[1], cl[2]), 1),
               peso_igual = round(lect(peq, cl[1], cl[2]), 1))
  }))
}))

# 7. ¿Importa de dónde venía? Salida de Producto según el estado anterior (orden 2, sin repeticiones)
m2 <- copy(hh)[, prev := shift(estado), by = visit_id][is.na(prev) | estado != prev]
m2 <- m2[, .(segmento = segmento[1], estado = c("INICIO", estado, if (estado[.N] != "COMPRA") "ABANDONO")), by = visit_id]
m2[, `:=`(antes = shift(estado), despues = shift(estado, -1)), by = visit_id]
m2 <- m2[estado == "PRODUCTO" & !is.na(despues)]
m2[, antes_g := fifelse(antes %in% c("INICIO", "PORTADA", "BUSQUEDA", "LISTADO", "CARRITO", "AGREGAR_CARRO"), antes, "OTRO")]
m2[, despues_g := fifelse(despues %in% c("ABANDONO", "CARRITO", "AGREGAR_CARRO", "BUSQUEDA", "LISTADO", "PORTADA"), despues, "OTRO")]
p4_memoria <- m2[, .N, by = .(cadena = fifelse(segmento == 1, "compradores", "no_compradores"), antes_g, despues_g)][
  , pct := round(100 * N / sum(N), 1), by = .(cadena, antes_g)][, salidas := sum(N), by = .(cadena, antes_g)]
p4_memoria <- dcast(p4_memoria, cadena + antes_g + salidas ~ despues_g, value.var = "pct", fill = 0)
# 8. Actividad por día (para describir el evento de los días 30–31)
p4_dias <- vis[, .(visitas = .N, clientes = uniqueN(uid), visitas_con_compra = sum(compra),
                   visitas_compradores = sum(segmento == 1), visitas_no_compradores = sum(segmento == 0)), by = d][order(d)]
setnames(p4_dias, "d", "dia")
cc <- vis[segmento == 1, .(compra_alguna = any(compra), compra_solo_30_31 = any(compra) && all(d[compra] >= 30)), by = uid]
pal <- as.data.table(df_markov)[grepl("cyber|black|promo|evento|oferta|descuento|sale|liquidaci", tolower(page_name)),
                                .(d = as.integer(format(as.Date(date_time_start), "%d")))]
p4_evento <- data.table(compradores = nrow(cc), compradores_con_visita_con_compra = sum(cc$compra_alguna),
                        compran_solo_30_31 = sum(cc$compra_solo_30_31),
                        pct_solo_30_31 = round(100 * sum(cc$compra_solo_30_31) / nrow(cc), 1),
                        hits_palabra_campana = nrow(pal), de_ellos_en_30_31 = sum(pal$d >= 30))
rm(cc, pal)
rm(h, hh, fin, tr, cnt, cli, idx, bp, bs, est, prof, rr, m2, vis)

options(width = 220)
cat("\n=== Uso de cada estado ===\n"); print(p4_uso[order(cadena, -pct_visitas)])
cat("\n=== Hasta dónde llegan las visitas ===\n"); print(p4_profundidad)
cat("\n=== Rutas más frecuentes ===\n"); print(p4_rutas); print(p4_rutas_compra); print(p4_rutas_resumen)
cat("\n=== Transiciones clave ===\n"); print(p4_clave)
cat("\n=== Salida de Producto según el estado anterior (orden 2) ===\n"); print(p4_memoria)
cat("\n=== Actividad por día y evento de los días 30–31 ===\n"); print(p4_dias); print(p4_evento)
