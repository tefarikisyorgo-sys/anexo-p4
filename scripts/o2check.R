# =============================================================================
# o2check.R — chequeo exploratorio (no forma parte de fase7_p4_mapa.R)
# QUÉ HACE: salida de Producto según el estado anterior en la cadena CON autotransiciones
#           (orden 2 de la base), para compararla con la tabla de procedencia por cambio de estado.
#           También cuenta las visitas de un solo hit (rebote) por grupo.
# REQUIERE: df_markov cargado. Solo LEE df_markov; no lo modifica. NO guarda archivos.
# OBJETOS QUE CREA: h, s, x, r (tabla por grupo y procedencia), v (visitas y rebotes).
# =============================================================================
library(data.table)
h <- as.data.table(df_markov)[, .(visit_id, seg = cliente_compro_en_ventana, dia = as.Date(date_time_start), node_order, date_time_start, estado)]
setorder(h, visit_id, dia, node_order, date_time_start)
h[, pos := seq_len(.N), by = visit_id]
h[, pc := if (any(estado == "COMPRA")) min(pos[estado == "COMPRA"]) else NA_integer_, by = visit_id]
h <- h[is.na(pc) | pos <= pc]
s <- h[, .(seg = seg[1], e = c("INICIO", estado, if (estado[.N] != "COMPRA") "ABANDONO")), by = visit_id]
s[, `:=`(antes = shift(e), despues = shift(e, -1)), by = visit_id]
x <- s[e == "PRODUCTO"]
x[, ag := fifelse(antes %in% c("INICIO","PORTADA","BUSQUEDA","LISTADO","AGREGAR_CARRO","CARRITO","PRODUCTO"), antes, "OTRO")]
r <- x[, .(n = .N, se_queda = round(100*mean(despues=="PRODUCTO"),1), abandona_clic = round(100*mean(despues=="ABANDONO"),1),
          abandona_salida = round(100*sum(despues=="ABANDONO")/sum(despues!="PRODUCTO"),1)), by = .(seg, ag)][order(seg, -n)]
print(r)
# rebote check
v <- h[, .(seg=seg[1], n=.N, comp=any(estado=="COMPRA")), by=visit_id]
print(v[, .(visitas=.N, rebote_1hit=sum(n==1), rebote_1hit_sin_compra=sum(n==1 & !comp)), by=seg])
