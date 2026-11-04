"""Construye los JSON agregados del anexo web P4 a partir de las salidas de fase7_p4_mapa.R (CSV).
Lee: p4/run2/*.csv. Escribe: web/anexo-p4/data/*.json. No lee ni escribe datos de clientes."""
import csv, json, os
SRC='p4/run2'; OUT='web/anexo-p4/data'; os.makedirs(OUT, exist_ok=True)
rd=lambda f: list(csv.DictReader(open(f'{SRC}/{f}.csv',encoding='utf-8')))
num=lambda x: None if x in ('','NA') else (float(x) if '.' in x else int(x))
def w(name,obj): json.dump(obj, open(f'{OUT}/{name}.json','w',encoding='utf-8'), ensure_ascii=False, indent=1)
EST=['INICIO','PORTADA','BUSQUEDA','LISTADO','PRODUCTO','AGREGAR_CARRO','CARRITO','CHECKOUT','CUENTA_SERVICIOS','OTROS','COMPRA','ABANDONO']
NOM={'INICIO':'Inicio','PORTADA':'Portada','BUSQUEDA':'Búsqueda','LISTADO':'Listado','PRODUCTO':'Producto','AGREGAR_CARRO':'Agregar al carro','CARRITO':'Carrito','CHECKOUT':'Checkout','CUENTA_SERVICIOS':'Cuenta y servicios','OTROS':'Otros','COMPRA':'Compra','ABANDONO':'Abandono'}
CAD={'compradores':'Compradores','no_compradores':'No compradores'}

# 1. Matrices (celda a celda, dos lecturas, IC 95%)
P=rd('p4_P'); M={}
for c in CAD:
    rows=[r for r in P if r['cadena']==c and r['hasta']!='INICIO']
    M[c]=[{'desde':r['desde'],'hasta':r['hasta'],'n':int(r['n']),
           'por_clic':num(r['p']),'por_clic_ic':[num(r['p_inf']),num(r['p_sup'])],
           'por_salida':num(r['p_salida']),'por_salida_ic':[num(r['salida_inf']),num(r['salida_sup'])]} for r in rows]
w('matrices',{'descripcion':'Matriz de transición de orden 1 con autotransiciones (julio 2026), por cadena. por_clic = n / clics que salen del estado (incluye quedarse). por_salida = n / salidas hacia otro estado (sin la diagonal). Diagonal: por_salida = null. IC 95% por bootstrap por cliente (500 réplicas, semilla 2026, percentiles 2,5 y 97,5). Fila INICIO: cada visita sale una vez, así que sus valores son % de visitas.',
  'estados':EST,'nombres':NOM,'cadenas':M,'fuente':'fase7_p4_mapa.R → p4_P'})

# 2. Transiciones clave
K=rd('p4_clave')
w('transiciones_clave',{'descripcion':'Valor de julio con IC 95%, mínimo y máximo de las semanas normales S1–S4, semana S5 (29–31, incluye los días 30–31) aparte y versión con igual peso por cliente (M.4). Lectura por salida, salvo PRODUCTO → PRODUCTO (se queda, por clic). El valor de julio incluye S5, por eso puede quedar fuera del rango S1–S4 (no compradores, Portada → Búsqueda).',
  'filas':[{'cadena':r['cadena'],'desde':r['transicion'].split(' → ')[0],'hasta':r['transicion'].split(' → ')[1],'lectura':r['lectura'],
            'julio':num(r['mes']),'ic':[num(r['ic_inf']),num(r['ic_sup'])],'s1_s4':[num(r['sem_min']),num(r['sem_max'])],'s5':num(r['S5']),'peso_igual':num(r['peso_igual'])}
           for r in K if not (r['cadena']=='no_compradores' and r['transicion']=='CHECKOUT → COMPRA')],
  'fuente':'fase7_p4_mapa.R → p4_clave'})

# 3. Uso de estados
U=rd('p4_uso')
w('uso_estados',{'descripcion':'pct_clics = clics en el estado / clics del grupo (cadena cortada en la primera compra). pct_visitas = visitas que pasan al menos una vez / visitas del grupo.',
  'totales':{'compradores':{'clics':627129,'visitas':82236,'clientes':5000},'no_compradores':{'clics':79811,'visitas':18915,'clientes':5000}},
  'filas':[{'cadena':r['cadena'],'estado':r['estado'],'clics':int(r['hits']),'visitas_que_pasan':int(r['visitas_que_pasan']),'pct_clics':num(r['pct_hits']),'pct_visitas':num(r['pct_visitas'])} for r in U],
  'fuente':'fase7_p4_mapa.R → p4_uso'})

# 4. Profundidad
D=rd('p4_profundidad')
w('profundidad',{'descripcion':'Etapa más profunda que alcanza cada visita (datos observados, sin modelo). Rebote = visita de 1 clic. Diferencia con B.4: 1 visita de comprador de un solo clic que es la compra se cuenta aquí como Compra (B.4 la cuenta como rebote: 27.939 vs 27.938); el % no cambia.',
  'filas':[{'cadena':r['cadena'],'orden':int(r['etapa'][0]),'etapa':r['etapa'][2:],'visitas':int(r['visitas']),'clics_por_visita':num(r['hits_por_visita']),'pct_visitas':num(r['pct_visitas'])} for r in D],
  'fuente':'fase7_p4_mapa.R → p4_profundidad'})

# 5. Rutas
R=rd('p4_rutas'); RC=rd('p4_rutas_compra'); RR=rd('p4_rutas_resumen')
fix=lambda s: s.replace('AgregarCarro','Agregar al carro')
w('rutas',{'descripcion':'Ruta = secuencia de estados de una visita juntando repeticiones seguidas (sin Inicio). pct_visitas = visitas con esa ruta / visitas del grupo. Rutas de compra: % de las 7.190 visitas con compra.',
  'top10':[{'cadena':r['cadena'],'ruta':fix(r['ruta']),'visitas':int(r['N']),'pct_visitas':num(r['pct_visitas']),'pct_acumulado':num(r['pct_acumulado'])} for r in R],
  'compra_top8':[{'ruta':fix(r['ruta']),'visitas':int(r['N']),'pct_visitas_con_compra':num(r['pct_visitas_con_compra']),'pct_acumulado':num(r['pct_acumulado'])} for r in RC],
  'resumen':[{'cadena':r['cadena'],'visitas':int(r['visitas']),'rutas_distintas':int(r['rutas_distintas']),'mediana_estados_por_visita':num(r['mediana_estados_distintos'])} for r in RR],
  'fuente':'fase7_p4_mapa.R → p4_rutas, p4_rutas_compra, p4_rutas_resumen'})

# 6. Procedencia de Producto (análisis complementario, NO es el orden 2 de la cadena base)
Q=rd('p4_memoria')
w('procedencia_producto',{'titulo':'Salida de Producto según el estado de procedencia (análisis complementario por cambio de estado)',
  'advertencia':'No es el modelo de orden 2 de la cadena base (con autotransiciones). Se juntan las repeticiones seguidas: varias fichas seguidas = una pasada por Producto. Equivale a la fila Producto de un orden 2 sin autotransiciones (versión que M.1 también estimó), con estados agrupados en "OTRO". Las salidas suman lo mismo que la lectura por salida del mapa (152.522 en compradores).',
  'filas':[{'cadena':r['cadena'],'procedencia':r['antes_g'],'salidas':int(r['salidas']),'pct':{k:num(r[k]) for k in ['ABANDONO','BUSQUEDA','LISTADO','CARRITO','AGREGAR_CARRO','PORTADA','OTRO']}} for r in Q],
  'comparacion_con_autotransiciones':{'descripcion':'Versión con autotransiciones: solo el primer clic en Producto conserva la procedencia. % de abandono entre quienes dejan Producto en ese primer clic, compradores.',
     'compradores':{'INICIO':64.2,'PORTADA':53.6,'BUSQUEDA':10.5},'fuente':'o2check.R (cálculo aparte; aún no está en fase7_p4_mapa.R)'},
  'fuente':'fase7_p4_mapa.R → p4_memoria'})

# 7. Días y evento 30–31
DI=rd('p4_dias'); EV=rd('p4_evento')[0]
w('dias',{'descripcion':'Actividad por día; cada visita se asigna al día de su primer clic. 1 de julio de 2026 = miércoles. Días 30 (jueves) y 31 (viernes): actividad excepcional; hipótesis de evento promocional ("Cyber") o fin de mes, no confirmada con los datos.',
  'filas':[{k:int(v) for k,v in r.items()} for r in DI],
  'evento':{'compradores':int(EV['compradores']),'compran_solo_30_31':int(EV['compran_solo_30_31']),'pct_solo_30_31':num(EV['pct_solo_30_31']),
            'clics_con_palabra_campana':int(EV['hits_palabra_campana']),'de_ellos_en_30_31':int(EV['de_ellos_en_30_31']),
            'pct_clics_base_en_30_31':10.6,'nota_pct_clics_base':'10,6% calculado aparte (no está en el script)'},
  'fuente':'fase7_p4_mapa.R → p4_dias, p4_evento'})

# 8. Validaciones (resumen tomado del informe, pestaña Aclaración de puntos)
w('validaciones',{'fuente':'Informe, sección M (valores transcritos, no recalculados)','items':[
 {'id':'M.1','nombre':'Propiedad de Markov (orden)','pregunta':'¿Basta el estado actual para predecir el siguiente paso?',
  'datos':{'compradores':{'parametros':[94,682,3235],'bic':[2057749,1861298,1837440],'acierto_pct':[49.5,54.0,54.5],'brecha_llegada_pp':[18.4,6.7,4.0],'brecha_compra_pp':[23.5,12.8,9.0]},
           'no_compradores':{'parametros':[83,476,1594],'bic':[284933,259256,262167],'acierto_pct':[44.2,51.8,52.5],'brecha_llegada_pp':[16.8,4.3,2.3]},'ordenes':[1,2,3]},
  'conclusion':'El orden 2 es mejor; se usa orden 1 por simplicidad y tiempo, declarando la limitación.'},
 {'id':'M.2','nombre':'Homogeneidad en el tiempo','pregunta':'¿La matriz es la misma todo el mes?',
  'datos':{'semanas':['S1','S2','S3','S4','S5'],'compradores_pp':[1.94,1.53,1.34,2.07,3.55],'no_compradores_pp':[3.15,3.95,2.57,3.65,4.46],
           'dias_30_31_vs_1_29_pp':{'compradores':4.9,'no_compradores':6.2},'mes_con_vs_sin_30_31_pp':{'compradores':0.5,'no_compradores':0.6}},
  'conclusion':'Homogeneidad aproximada; rango normal S1–S4 y S5 aparte.'},
 {'id':'M.3','nombre':'Agregabilidad','pregunta':'¿Se pueden juntar grupos?',
  'datos':{'compradores_vs_no_pp':17.6,'app_vs_web_pp':{'compradores':23.1,'no_compradores':14.3},'app_mas_web_vs_solo_app_pp':{'compradores':0.9,'no_compradores':1.5}},
  'conclusion':'Compradores y no compradores por separado; app y web juntas.'},
 {'id':'M.4','nombre':'Clientes muy activos','pregunta':'¿La matriz representa al cliente típico?',
  'datos':{'pct_transiciones_top10':{'compradores':33.8,'no_compradores':58.1}},
  'conclusion':'Las conclusiones no cambian de dirección; las magnitudes sí. Se reporta la versión con peso igual por cliente.'},
 {'id':'M.5','nombre':'Precisión','pregunta':'¿Cuánto cambiarían los números con otra muestra?',
  'datos':{'fuga_por_salida':[
    ['PRODUCTO',25.0,[24.5,25.6],47.2,[45.0,49.2]],['LISTADO',16.0,[15.5,16.6],33.6,[31.8,35.9]],['CHECKOUT',7.8,[7.3,8.2],25.1,[20.8,29.2]],
    ['CARRITO',10.9,[10.4,11.3],21.1,[19.3,23.0]],['BUSQUEDA',13.2,[12.7,13.6],19.5,[18.0,21.1]],['PORTADA',11.6,[11.1,12.0],17.7,[16.2,19.1]],
    ['OTROS',13.2,[12.0,14.5],18.4,[15.3,22.1]],['AGREGAR_CARRO',1.7,[1.5,1.9],6.7,[5.4,8.3]],['CUENTA_SERVICIOS',47.3,[46.1,48.4],36.6,[31.3,42.0]]],
   'columnas':['estado','compradores','ic','no_compradores','ic']},
  'conclusion':'Precisión buena; filas chicas de no compradores (Checkout, Cuenta y servicios, Otros) imprecisas.'},
 {'id':'M.6','nombre':'Heterogeneidad','pregunta':'¿Hay tipos de visitas mezclados?',
  'datos':{'compradores_antes_despues_1a_compra':{'visitas':[33534,48702],'pct_visitas_con_compra':[14.9,4.5],'pct_pasan_cuenta':[6.4,19.9],'fuga_producto':[20.6,29.1],'fuga_cuenta':[29.8,51.3],'checkout_compra':[45.7,35.8]},
           'entrada':[{'cadena':'compradores','entrada':'PORTADA','pct_visitas':60.3,'pct_1_clic':11.6},{'cadena':'compradores','entrada':'PRODUCTO','pct_visitas':27.2,'pct_1_clic':49.3},
                      {'cadena':'no_compradores','entrada':'PORTADA','pct_visitas':33.9,'pct_1_clic':18.1},{'cadena':'no_compradores','entrada':'PRODUCTO','pct_visitas':47.0,'pct_1_clic':63.2}]},
  'conclusion':'Se mantienen las matrices generales; los tipos de visita se usan como complemento.'}]})

# 9. Configuración de los diagramas (posiciones y reglas de dibujo)
w('diagrama_config',{'umbral_flecha_por_salida':10,'posiciones':{'INICIO':[0,4],'PORTADA':[3.7,4],'BUSQUEDA':[7.3,6.9],'LISTADO':[7.3,1.1],'PRODUCTO':[10.9,4],'AGREGAR_CARRO':[13.9,6.9],'CARRITO':[16.1,4],'CHECKOUT':[19.8,4],'COMPRA':[23.5,4],'CUENTA_SERVICIOS':[0,0.6],'OTROS':[0,7.4]},
  'lecturas':{'caja_se_queda':'por clic','caja_abandona':'por salida','flechas':'por salida (desde Inicio = % de visitas)'}})

# 10. Meta
w('meta',{'titulo':'Anexo P4 – Customer journey Falabella (julio 2026)','base':'df_markov: 729.929 clics, 101.151 visitas, 10.000 clientes (5.000 compradores y 5.000 no compradores, muestra balanceada a propósito). La cadena se corta en la primera compra de cada visita: 706.940 clics.',
  'definiciones':{'compradores':'Clientes que compraron al menos una vez en julio (cliente_compro_en_ventana = 1). No son visitas con compra.',
                  'no_compradores':'Clientes que no compraron en julio.','visita':'visit_id; el paso del modelo es pasar de un clic al siguiente dentro de la visita.',
                  'abandono':'Fin de una visita sin compra (no significa que el cliente no vuelva).',
                  'por_clic':'Denominador: todos los clics que salen del estado, incluido quedarse.','por_salida':'Denominador: salidas hacia otro estado.','pct_visitas':'Denominador: visitas del grupo.'},
  'advertencias':['Las tasas no representan la conversión real de Falabella (muestra balanceada 50/50).','Descriptivo, no causal.'],
  'privacidad':'Solo agregados (conteos y porcentajes). Sin unified_id, visit_id, hash_rut ni filas por cliente o visita.'})
print(sorted(os.listdir(OUT)))
