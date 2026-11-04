/* Anexo P4 – lee los JSON agregados de ./data/ y dibuja cada sección. Sin frameworks. */
(function () {
  'use strict';
  const ARCH = ['meta', 'matrices', 'diagrama_config', 'transiciones_clave', 'uso_estados', 'profundidad', 'rutas', 'procedencia_producto', 'dias', 'validaciones'];
  const NOM = {INICIO: 'Inicio', PORTADA: 'Portada', BUSQUEDA: 'Búsqueda', LISTADO: 'Listado', PRODUCTO: 'Producto', AGREGAR_CARRO: 'Agregar al carro', CARRITO: 'Carrito', CHECKOUT: 'Checkout', CUENTA_SERVICIOS: 'Cuenta y servicios', OTROS: 'Otros', COMPRA: 'Compra', ABANDONO: 'Abandono', OTRO: 'Otro estado'};
  const GRUPO = {compradores: 'Compradores', no_compradores: 'No compradores'};
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const pct = (v, d = 1) => (v === null || v === undefined) ? '—' : v.toFixed(d).replace('.', ',') + '%';
  const num = v => (v === null || v === undefined) ? '—' : String(v).replace('.', ',');
  const miles = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const nom = k => NOM[k] || k;
  let D = {};

  // ---------- carga ----------
  Promise.all(ARCH.map(a => fetch('./data/' + a + '.json').then(r => { if (!r.ok) throw new Error(a + '.json (' + r.status + ')'); return r.json(); })))
    .then(res => { ARCH.forEach((a, i) => D[a] = res[i]); $('#estado-carga').remove(); iniciar(); })
    .catch(e => { const el = $('#estado-carga'); el.className = 'aviso error'; el.textContent = 'No se pudieron cargar los datos: ' + e.message + '. Si abres el archivo directamente desde el computador, usa un servidor local o la versión publicada en GitHub Pages.'; });

  function tabs(target, cb) {
    const box = document.querySelector('.tabs[data-target="' + target + '"]');
    box.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return;
      box.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); cb(b.dataset.v); });
    return box.querySelector('button.on').dataset.v;
  }
  const celda = (c, d, e) => D.matrices.cadenas[c].find(x => x.desde === d && x.hasta === e);
  const clave = (c, d, e) => D.transiciones_clave.filas.find(x => x.cadena === c && x.desde === d && x.hasta === e);

  function iniciar() {
    resumen(); mapas(); matrices(); transiciones(); visitas(); procedencia(); validaciones(); reglas(); menuActivo();
  }

  // ---------- 1. Resumen ----------
  function resumen() {
    const uso = (c, k) => D.uso_estados.filas.find(x => x.cadena === c && x.estado === 'PRODUCTO')[k];
    const carro = c => { const a = clave(c, 'PRODUCTO', 'CARRITO').julio, b = clave(c, 'PRODUCTO', 'AGREGAR_CARRO').julio; return Math.round((a + b) * 10) / 10; };
    const K = [
      ['Clics en Producto', c => uso(c, 'pct_clics'), '% de clics del grupo · uso_estados.json'],
      ['Visitas que pasan por Producto', c => uso(c, 'pct_visitas'), '% de visitas del grupo · uso_estados.json'],
      ['Abandono al salir de Producto', c => clave(c, 'PRODUCTO', 'ABANDONO').julio, 'por salida · transiciones_clave.json'],
      ['Salidas de Producto hacia el carro (Carrito + Agregar al carro)', carro, 'por salida · transiciones_clave.json']];
    $('#kpis').innerHTML = K.map(([t, f, fu]) => '<div class="kpi"><div class="t">' + esc(t) + '</div><div class="v"><div>' + pct(f('compradores')) + '<small>Compradores</small></div><div class="nc">' + pct(f('no_compradores')) + '<small>No compradores</small></div></div><div class="f">' + esc(fu) + '</div></div>').join('');
    const m = D.meta;
    $('#definiciones').innerHTML = '<p>' + esc(m.base) + '</p><ul class="notas">' + Object.entries(m.definiciones).map(([k, v]) => '<li><b>' + esc(k.replace(/_/g, ' ')) + ':</b> ' + esc(v) + '</li>').join('') + '</ul><ul class="notas">' + m.advertencias.map(a => '<li>' + esc(a) + '</li>').join('') + '</ul>';
    const est = [...new Set(D.uso_estados.filas.map(x => x.estado))];
    const g = (c, e, k) => { const r = D.uso_estados.filas.find(x => x.cadena === c && x.estado === e); return r ? pct(r[k]) : '—'; };
    est.sort((a, b) => (D.uso_estados.filas.find(x => x.cadena === 'compradores' && x.estado === b) || {pct_visitas: 0}).pct_visitas - (D.uso_estados.filas.find(x => x.cadena === 'compradores' && x.estado === a) || {pct_visitas: 0}).pct_visitas);
    $('#uso').innerHTML = '<div class="scroll"><table class="tabla"><tr><th>Estado</th><th>% clics · Compradores</th><th>% clics · No compradores</th><th>% visitas que pasan · Compradores</th><th>% visitas que pasan · No compradores</th></tr>' +
      est.map(e => '<tr><td>' + nom(e) + '</td><td>' + g('compradores', e, 'pct_clics') + '</td><td>' + g('no_compradores', e, 'pct_clics') + '</td><td>' + g('compradores', e, 'pct_visitas') + '</td><td>' + g('no_compradores', e, 'pct_visitas') + '</td></tr>').join('') +
      '</table></div><p class="fuente">' + esc(D.uso_estados.descripcion) + ' Una visita pasa por varios estados, por eso los % de visitas no suman 100%.</p>';
  }

  // ---------- 2. Mapas (SVG) ----------
  function mapas() {
    const cfg = D.diagrama_config;
    $('#nota-umbral').innerHTML = 'Solo se dibujan las flechas de ' + cfg.umbral_flecha_por_salida + '% o más. <b>Las transiciones menores no se eliminan:</b> se consultan en la matriz completa.';
    const dibujar = c => { $('#mapa').innerHTML = svgMapa(c); };
    dibujar(tabs('mapa', dibujar));
  }
  function svgMapa(cad) {
    const cfg = D.diagrama_config, POS = cfg.posiciones, U = cfg.umbral_flecha_por_salida;
    const RAD = {'INICIO>PRODUCTO': .28, 'INICIO>LISTADO': .05, 'OTROS>CARRITO': -.30, 'OTROS>PRODUCTO': 0, 'PORTADA>CARRITO': -.20, 'CUENTA_SERVICIOS>PRODUCTO': 0, 'OTROS>BUSQUEDA': -.08, 'INICIO>PORTADA': 0, 'CHECKOUT>COMPRA': 0, 'CHECKOUT>PRODUCTO': .30};
    const TL = {'INICIO>PRODUCTO': .38, 'PORTADA>CARRITO': .80, 'OTROS>CARRITO': .5, 'OTROS>PRODUCTO': .33, 'CUENTA_SERVICIOS>PRODUCTO': .42, 'OTROS>PORTADA': .45, 'CUENTA_SERVICIOS>PORTADA': .5, 'PORTADA>LISTADO': .42, 'AGREGAR_CARRO>CARRITO': .33, 'INICIO>LISTADO': .33};
    const OFF = {'CARRITO>CHECKOUT': [0, -.42], 'CHECKOUT>CARRITO': [0, .42], 'CHECKOUT>COMPRA': [0, .38], 'INICIO>PORTADA': [0, .36]};
    const PER = ['CUENTA_SERVICIOS', 'OTROS'], W = 2.8, H = 1.25, X0 = -1.6, X1 = 25.1, Y1 = 9.1, s = 90;
    const px = (x, y) => [((x - X0) * s), ((Y1 - y) * s)];
    const inBox = (p, q) => Math.abs(p[0] - q[0]) <= W / 2 + .05 && Math.abs(p[1] - q[1]) <= H / 2 + .05;
    const bez = (a, b, r, t) => { const cx = (a[0] + b[0]) / 2 + r * (b[1] - a[1]), cy = (a[1] + b[1]) / 2 - r * (b[0] - a[0]);
      return [(1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * cx + t * t * b[0], (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * cy + t * t * b[1]]; };
    const M = D.matrices.cadenas[cad];
    const sal = o => M.filter(x => x.desde === o && x.hasta !== o).reduce((a, b) => a + b.n, 0), tot = o => M.filter(x => x.desde === o).reduce((a, b) => a + b.n, 0);
    const exS = x => x.por_salida;
    // redondeo igual al de las figuras del informe (al par más cercano sobre el valor con 1 decimal del JSON)
    const R0 = v => { const f = Math.floor(v), d = Math.round((v - f) * 10); return d === 5 ? (f % 2 === 0 ? f : f + 1) : Math.round(v); };
    const edges = M.filter(x => x.desde !== x.hasta && x.hasta !== 'ABANDONO' && x.por_salida !== null && x.por_salida >= U && POS[x.desde] && POS[x.hasta]);
    let ar = '', lb = '', nd = '';
    for (const e of edges) {
      const key = e.desde + '>' + e.hasta, r = key in RAD ? RAD[key] : .12, A = POS[e.desde], B = POS[e.hasta];
      const col = e.hasta === 'COMPRA' ? '#2E7D32' : ((PER.includes(e.desde) || PER.includes(e.hasta)) ? '#A0A0A0' : '#37474F');
      const lw = (.7 + e.por_salida / 11) * 1.85, pts = [];
      for (let i = 0; i <= 300; i++) { const p = bez(A, B, r, i / 300); if (!inBox(p, A) && !inBox(p, B)) pts.push(px(p[0], p[1])); }
      if (pts.length < 2) continue;
      const end = pts[pts.length - 1], pre = pts[Math.max(0, pts.length - 6)], ang = Math.atan2(end[1] - pre[1], end[0] - pre[0]);
      const hl = 13 + lw * 1.7, hw = 6.5 + lw * .85, bx = end[0] - hl * Math.cos(ang), by = end[1] - hl * Math.sin(ang);
      const linea = []; for (const q of pts) { if (Math.hypot(q[0] - end[0], q[1] - end[1]) < hl * .8) break; linea.push(q); } linea.push([bx, by]);
      ar += '<polyline points="' + linea.map(q => q[0].toFixed(1) + ',' + q[1].toFixed(1)).join(' ') + '" fill="none" stroke="' + col + '" stroke-width="' + lw.toFixed(1) + '"/>';
      ar += '<polygon points="' + [end, [bx + hw * Math.sin(ang), by - hw * Math.cos(ang)], [bx - hw * Math.sin(ang), by + hw * Math.cos(ang)]].map(q => q[0].toFixed(1) + ',' + q[1].toFixed(1)).join(' ') + '" fill="' + col + '"/>';
      const L = bez(A, B, r, key in TL ? TL[key] : .5), o = OFF[key] || [0, 0], [lx, ly] = px(L[0] + o[0], L[1] + o[1]), t = R0(exS(e)) + '%';
      const tw = t.length * 13.5 + 12;
      lb += '<g><title>' + esc(nom(e.desde) + ' → ' + nom(e.hasta) + ': ' + pct(e.por_salida) + ' de las salidas' + (e.desde === 'INICIO' ? ' (= % de visitas)' : '') + ' · n = ' + miles(e.n)) + '</title><rect x="' + (lx - tw / 2) + '" y="' + (ly - 16) + '" width="' + tw + '" height="32" rx="7" fill="#fff" fill-opacity=".95"/><text x="' + lx + '" y="' + (ly + 8) + '" text-anchor="middle" font-size="24">' + t + '</text></g>';
    }
    for (const [sn, [x, y]] of Object.entries(POS)) {
      let fc = '#EAF1FB', ec = '#2F5597', dash = '';
      if (sn === 'INICIO') { fc = '#FFFFFF'; dash = ' stroke-dasharray="10 6"'; }
      if (PER.includes(sn)) { fc = '#F3F3F3'; ec = '#7F7F7F'; }
      const apag = sn === 'COMPRA' && cad === 'no_compradores';
      if (sn === 'COMPRA') { fc = apag ? '#FAFAFA' : '#D9EAD3'; ec = apag ? '#BDBDBD' : '#38761D'; if (apag) dash = ' stroke-dasharray="10 6"'; }
      const [bx, by] = px(x - W / 2, y + H / 2);
      nd += '<rect x="' + bx + '" y="' + by + '" width="' + W * s + '" height="' + H * s + '" rx="16" fill="' + fc + '" stroke="' + ec + '" stroke-width="3"' + dash + '/>';
      const T = (t, yy, sz, col, w) => { const [tx, ty] = px(x, yy); return '<text x="' + tx + '" y="' + ty + '" text-anchor="middle" dominant-baseline="middle" font-size="' + sz + '" fill="' + col + '"' + (w ? ' font-weight="700"' : '') + '>' + esc(t) + '</text>'; };
      if (sn === 'INICIO') { nd += T('Inicio', y + .17, 24, '#222') + T('de la visita', y - .2, 24, '#222'); continue; }
      if (sn === 'COMPRA') { nd += apag ? T('COMPRA', y + .33, 24, '#9E9E9E', 1) + T('no aplica: este grupo', y - .02, 19, '#9E9E9E') + T('no compra en julio', y - .33, 19, '#9E9E9E') : T('COMPRA', y, 25, '#222', 1); continue; }
      const q = celda(cad, sn, sn).por_clic, ab = exS(celda(cad, sn, 'ABANDONO'));
      nd += T(nom(sn), y + .33, 24, '#222', 1) + T('se queda ' + (q < 1 ? '<1%' : R0(q) + '%'), y - .02, 21, '#555') + T('abandona ' + R0(ab) + '%', y - .34, 21, '#B00000', 1);
    }
    const vbw = Math.round((X1 - X0) * s), vbh = Math.round((Y1 + .2) * s);
    return '<svg viewBox="0 0 ' + vbw + ' ' + vbh + '" role="img" aria-label="Mapa del customer journey de ' + GRUPO[cad] + '" font-family="system-ui, Segoe UI, Arial, sans-serif"><rect width="100%" height="100%" fill="#fff"/>' + ar + nd + lb + '</svg>';
  }

  // ---------- 3. Matrices ----------
  const BINS = [[2, '#ffffff', '#1f2328'], [5, '#cde2fb', '#1f2328'], [10, '#9ec5f4', '#1f2328'], [20, '#6da7ec', '#1f2328'], [35, '#3987e5', '#1f2328'], [50, '#256abf', '#fff'], [101, '#104281', '#fff']];
  const BLAB = ['< 2%', '2–5%', '5–10%', '10–20%', '20–35%', '35–50%', '≥ 50%'];
  function matrices() {
    $('#leyenda-matriz').innerHTML = 'Escala: ' + BINS.map((b, i) => '<span style="background:' + b[1] + ';color:' + b[2] + ';border:1px solid #e3e6ea">' + BLAB[i] + '</span>').join('');
    let g = 'compradores', m = 'por_salida';
    const draw = () => {
      const M = D.matrices.cadenas[g], orig = D.matrices.estados.filter(e => M.some(x => x.desde === e)), dest = D.matrices.estados.filter(e => e !== 'INICIO');
      let h = '<thead><tr><th>Desde \\ Hacia</th>' + dest.map(d => '<th>' + nom(d) + '</th>').join('') + '</tr></thead><tbody>';
      for (const o of orig) {
        h += '<tr><td>' + nom(o) + (o === 'INICIO' ? ' <small>(% visitas)</small>' : '') + '</td>';
        for (const d of dest) {
          const x = M.find(z => z.desde === o && z.hasta === d);
          if (g === 'no_compradores' && d === 'COMPRA') { h += '<td class="na" data-na="1">n/a</td>'; continue; }
          const v = x ? x[m] : null;
          if (v === null) { h += '<td class="na" data-o="' + o + '" data-d="' + d + '">—</td>'; continue; }
          const b = BINS.find(z => v < z[0]), t = (v === 0 && x.n > 0) ? '<0,1' : v.toFixed(1).replace('.', ',');
          h += '<td data-o="' + o + '" data-d="' + d + '" style="background:' + b[1] + ';color:' + b[2] + (v >= 20 ? ';font-weight:650' : '') + '">' + t + '</td>';
        }
        h += '</tr>';
      }
      $('#matriz').innerHTML = h + '</tbody>';
    };
    g = tabs('matriz-grupo', v => { g = v; draw(); });
    m = tabs('matriz-medida', v => { m = v; draw(); });
    draw();
    const info = td => {
      if (!td || td.tagName !== 'TD' || td.cellIndex === 0) return;
      $('#matriz').querySelectorAll('td.sel').forEach(z => z.classList.remove('sel')); td.classList.add('sel');
      if (td.dataset.na) { $('#detalle-celda').innerHTML = '<b>No aplica:</b> los no compradores no compran en julio por definición; no es una estimación de cero.'; return; }
      const x = D.matrices.cadenas[g].find(z => z.desde === td.dataset.o && z.hasta === td.dataset.d); if (!x) return;
      const diag = x.desde === x.hasta;
      let t = '<b>' + nom(x.desde) + ' → ' + nom(x.hasta) + '</b> (' + GRUPO[g] + ') · n = ' + miles(x.n) + ' · ';
      if (m === 'por_salida' && diag) t += 'Por salida: no aplica (es la autotransición; ver «por clic»: ' + pct(x.por_clic) + ').';
      else { const ic = m === 'por_clic' ? x.por_clic_ic : x.por_salida_ic; t += (m === 'por_clic' ? 'Por clic: ' : 'Por salida: ') + pct(x[m]) + ' [IC 95%: ' + num(ic[0]) + '–' + num(ic[1]) + ']' + (x.desde === 'INICIO' ? ' · % de visitas que empiezan aquí.' : ''); }
      $('#detalle-celda').innerHTML = t;
    };
    $('#matriz').addEventListener('mouseover', e => info(e.target.closest('td')));
    $('#matriz').addEventListener('click', e => info(e.target.closest('td')));
  }

  // ---------- 4. Transiciones clave ----------
  function transiciones() {
    const CORTA = ['INICIO>PORTADA', 'INICIO>PRODUCTO', 'PRODUCTO>ABANDONO', 'PRODUCTO>CARRITO', 'CARRITO>CHECKOUT', 'CHECKOUT>COMPRA'];
    let g, todas = false;
    const draw = () => {
      let F = D.transiciones_clave.filas.filter(x => x.cadena === g);
      if (!todas) F = F.filter(x => CORTA.includes(x.desde + '>' + x.hasta));
      $('#tabla-trans').innerHTML = '<thead><tr><th>Transición</th><th>Medida</th><th>Julio [IC 95%]</th><th>S1–S4 (mín–máx)</th><th>S5 (29–31)</th><th>Peso igual</th></tr></thead><tbody>' +
        F.map(x => { const fuera = x.julio < x.s1_s4[0] || x.julio > x.s1_s4[1];
          return '<tr><td>' + nom(x.desde) + ' → ' + (x.desde === x.hasta ? 'se queda' : nom(x.hasta)) + '</td><td>' + (x.desde === x.hasta ? 'por clic' : 'por salida') + '</td><td>' + pct(x.julio) + ' [' + num(x.ic[0]) + '–' + num(x.ic[1]) + ']' + (fuera ? ' *' : '') + '</td><td>' + num(x.s1_s4[0]) + '–' + num(x.s1_s4[1]) + '</td><td>' + pct(x.s5) + '</td><td>' + pct(x.peso_igual) + '</td></tr>'; }).join('') +
        '</tbody>' + (F.some(x => x.julio < x.s1_s4[0] || x.julio > x.s1_s4[1]) ? '<caption style="caption-side:bottom;text-align:left;font-size:.8rem;color:#5b6472;padding-top:6px">* El valor de julio queda fuera del rango S1–S4 porque incluye S5.</caption>' : '');
      $('#ver-todas').textContent = todas ? 'Ver solo las principales' : 'Ver todas las transiciones';
    };
    g = tabs('trans', v => { g = v; draw(); });
    $('#ver-todas').addEventListener('click', () => { todas = !todas; draw(); });
    draw();
  }

  // ---------- 5. Visitas y rutas ----------
  function visitas() {
    const COL = ['#b8bec7', '#cde2fb', '#86b6ef', '#3987e5', '#1c5cab', '#0f8b8d'];
    const P = D.profundidad.filas, etapas = [...new Map(P.map(x => [x.orden, x.etapa])).entries()].sort((a, b) => a[0] - b[0]);
    let h = '<div class="scroll">';
    for (const c of ['compradores', 'no_compradores']) {
      const F = P.filter(x => x.cadena === c).sort((a, b) => a.orden - b.orden), tot = F.reduce((a, b) => a + b.visitas, 0);
      h += '<div class="fila-apilada"><div class="et">' + GRUPO[c] + ' <small style="color:#5b6472;font-weight:400">(' + miles(tot) + ' visitas)</small></div><div class="barra-apilada">' +
        F.map(x => '<div title="' + esc(x.etapa + ': ' + pct(x.pct_visitas) + ' de las visitas · ' + miles(x.visitas) + ' visitas · ' + num(x.clics_por_visita) + ' clics por visita') + '" style="width:' + x.pct_visitas + '%;background:' + COL[x.orden - 1] + ';color:' + (x.orden <= 3 ? '#1f2328' : '#fff') + '">' + (x.pct_visitas >= 6 ? pct(x.pct_visitas) : '') + '</div>').join('') + '</div></div>';
    }
    h += '</div><div class="leyenda-apilada">' + etapas.map(([o, e]) => '<span><i style="background:' + COL[o - 1] + '"></i>' + esc(e.replace('Rebote (1 hit)', 'Rebote (1 clic)')) + '</span>').join('') + '</div>';
    h += '<details class="caja"><summary>Tabla: % de visitas y clics por visita</summary><div class="scroll"><table class="tabla"><tr><th>Etapa más profunda</th><th>Compradores · % visitas</th><th>Compradores · clics/visita</th><th>No compradores · % visitas</th><th>No compradores · clics/visita</th></tr>' +
      etapas.map(([o, e]) => { const a = P.find(x => x.cadena === 'compradores' && x.orden === o), b = P.find(x => x.cadena === 'no_compradores' && x.orden === o);
        return '<tr><td>' + esc(e.replace('Rebote (1 hit)', 'Rebote (1 clic)')) + '</td><td>' + (a ? pct(a.pct_visitas) : '—') + '</td><td>' + (a ? num(a.clics_por_visita) : '—') + '</td><td>' + (b ? pct(b.pct_visitas) : '—') + '</td><td>' + (b ? num(b.clics_por_visita) : '—') + '</td></tr>'; }).join('') + '</table></div></details>';
    $('#profundidad').innerHTML = h;
    $('#nota-rebote').textContent = 'Nota: 1 visita de comprador de un solo clic que es la compra se cuenta aquí como Compra; en B.4 se cuenta como rebote (27.939 frente a 27.938). El % de rebote no cambia. Fuente: profundidad.json.';
    const R = D.rutas;
    const draw = c => {
      const s = R.resumen.find(x => x.cadena === c), T = R.top10.filter(x => x.cadena === c);
      $('#rutas-resumen').innerHTML = '<div>Rutas distintas: <b>' + miles(s.rutas_distintas) + '</b></div><div>Las 10 más frecuentes cubren: <b>' + pct(T[T.length - 1].pct_acumulado) + '</b> de las visitas</div><div>Estados por visita (mediana): <b>' + num(s.mediana_estados_por_visita) + '</b></div>';
      $('#tabla-rutas').innerHTML = '<thead><tr><th>#</th><th style="text-align:left">Ruta</th><th>% de visitas</th><th>% acumulado</th></tr></thead><tbody>' + T.map((x, i) => '<tr><td>' + (i + 1) + '</td><td class="ruta" style="text-align:left">' + esc(x.ruta) + '</td><td>' + pct(x.pct_visitas) + '</td><td>' + pct(x.pct_acumulado) + '</td></tr>').join('') + '</tbody>';
    };
    draw(tabs('rutas', draw));
    $('#tabla-rutas-compra').innerHTML = '<thead><tr><th>#</th><th style="text-align:left">Ruta</th><th>% de visitas con compra</th><th>% acumulado</th></tr></thead><tbody>' + R.compra_top8.map((x, i) => '<tr><td>' + (i + 1) + '</td><td class="ruta" style="text-align:left">' + esc(x.ruta) + '</td><td>' + pct(x.pct_visitas_con_compra) + '</td><td>' + pct(x.pct_acumulado) + '</td></tr>').join('') + '</tbody>';
  }

  // ---------- 6. Procedencia ----------
  function procedencia() {
    const Q = D.procedencia_producto;
    $('#advertencia-proc').innerHTML = '<b>Ojo:</b> ' + esc(Q.advertencia);
    const PRIM = ['INICIO', 'BUSQUEDA', 'LISTADO', 'CARRITO'], COLS = ['ABANDONO', 'BUSQUEDA', 'LISTADO', 'CARRITO', 'AGREGAR_CARRO', 'PORTADA', 'OTRO'];
    const ETQ = {ABANDONO: 'Abandona', BUSQUEDA: 'Vuelve a Búsqueda', LISTADO: 'Vuelve a Listado', CARRITO: 'Carrito', AGREGAR_CARRO: 'Agregar al carro', PORTADA: 'Portada', OTRO: 'Otro estado'};
    const proc = p => p === 'INICIO' ? 'Entró directo (Inicio)' : nom(p);
    const tabla = F => '<thead><tr><th>Llegó a Producto desde</th><th>Salidas</th>' + COLS.map(k => '<th>' + ETQ[k] + '</th>').join('') + '</tr></thead><tbody>' +
      F.map(x => { const mx = Math.max(...COLS.map(k => x.pct[k])); return '<tr><td>' + proc(x.procedencia) + '</td><td>' + miles(x.salidas) + '</td>' + COLS.map(k => '<td' + (x.pct[k] === mx ? ' style="font-weight:700;color:#0f8b8d"' : '') + '>' + pct(x.pct[k]) + '</td>').join('') + '</tr>'; }).join('') + '</tbody>';
    const draw = c => {
      const F = Q.filas.filter(x => x.cadena === c);
      $('#tabla-proc').innerHTML = tabla(PRIM.map(p => F.find(x => x.procedencia === p)).filter(Boolean));
      $('#tabla-proc-resto').innerHTML = tabla(F.filter(x => !PRIM.includes(x.procedencia)));
    };
    draw(tabs('proc', draw));
  }

  // ---------- 7. Validaciones y días ----------
  function validaciones() {
    const IMP = {
      'M.1': 'Las probabilidades de un paso son las observadas; lo que encadena muchos pasos (compra final, llegada) se usa con cautela. La tabla de procedencia de Producto es un complemento, no el orden 2 de la cadena base.',
      'M.2': 'Estabilidad aproximada, no homogeneidad exacta: basta una matriz del mes. S1–S4 son las semanas normales; S5 (29–31) va aparte.',
      'M.3': 'Dos mapas (compradores y no compradores). App y web juntas en la matriz principal; Agregar al carro y login de Checkout solo se registran en la app.',
      'M.4': 'Se muestra la sensibilidad con peso igual por cliente en las transiciones clave.',
      'M.5': 'Intervalos del 95% por bootstrap por cliente (500 réplicas). Filas chicas de no compradores (Checkout, Cuenta y servicios, Otros) son imprecisas.',
      'M.6': 'La matriz mezcla visitas antes y después de la primera compra y distintas puertas de entrada; se usa como complemento para interpretar.'};
    const T = (cab, filas) => '<div class="scroll"><table class="tabla"><tr>' + cab.map(c => '<th>' + c + '</th>').join('') + '</tr>' + filas.map(f => '<tr>' + f.map(c => '<td>' + c + '</td>').join('') + '</tr>').join('') + '</table></div>';
    const det = it => { const d = it.datos;
      if (it.id === 'M.1') return T(['Medida', 'Compradores (orden 1 / 2 / 3)', 'No compradores (orden 1 / 2 / 3)'], [
        ['Parámetros', d.compradores.parametros.map(miles).join(' / '), d.no_compradores.parametros.map(miles).join(' / ')],
        ['BIC (menor = mejor)', d.compradores.bic.map(miles).join(' / '), d.no_compradores.bic.map(miles).join(' / ')],
        ['Acierto en clientes no vistos (%)', d.compradores.acierto_pct.map(num).join(' / '), d.no_compradores.acierto_pct.map(num).join(' / ')],
        ['Brecha de llegada (pp)', d.compradores.brecha_llegada_pp.map(num).join(' / '), d.no_compradores.brecha_llegada_pp.map(num).join(' / ')],
        ['Brecha de compra (pp)', d.compradores.brecha_compra_pp.map(num).join(' / '), 'no aplica']]);
      if (it.id === 'M.2') return T(['Semana', 'Compradores (pp)', 'No compradores (pp)'], d.semanas.map((s, i) => [s + (s === 'S5' ? ' (29–31, aparte)' : ''), num(d.compradores_pp[i]), num(d.no_compradores_pp[i])])) +
        '<p>Días 30–31 frente a 1–29: ' + num(d.dias_30_31_vs_1_29_pp.compradores) + ' pp (compradores) y ' + num(d.dias_30_31_vs_1_29_pp.no_compradores) + ' pp (no compradores). Matriz del mes con y sin 30–31: ' + num(d.mes_con_vs_sin_30_31_pp.compradores) + ' y ' + num(d.mes_con_vs_sin_30_31_pp.no_compradores) + ' pp. (Comparación de matrices: diferencia promedio en pp.)</p>';
      if (it.id === 'M.3') return '<p>Compradores vs no compradores: ' + num(d.compradores_vs_no_pp) + ' pp. App vs web: ' + num(d.app_vs_web_pp.compradores) + ' pp (compradores) y ' + num(d.app_vs_web_pp.no_compradores) + ' pp (no compradores). App + web frente a solo app: ' + num(d.app_mas_web_vs_solo_app_pp.compradores) + ' y ' + num(d.app_mas_web_vs_solo_app_pp.no_compradores) + ' pp (diferencia promedio entre matrices).</p>';
      if (it.id === 'M.4') return '<p>El 10% de clientes más activos aporta el ' + pct(d.pct_transiciones_top10.compradores) + ' de las transiciones en compradores y el ' + pct(d.pct_transiciones_top10.no_compradores) + ' en no compradores.</p>';
      if (it.id === 'M.5') return T(['Fuga por salida', 'Compradores [IC 95%]', 'No compradores [IC 95%]'], d.fuga_por_salida.map(r => [nom(r[0]), pct(r[1]) + ' [' + num(r[2][0]) + '–' + num(r[2][1]) + ']', pct(r[3]) + ' [' + num(r[4][0]) + '–' + num(r[4][1]) + ']']));
      if (it.id === 'M.6') { const a = d.compradores_antes_despues_1a_compra;
        return T(['Compradores', 'Hasta la 1ª compra', 'Después de la 1ª compra'], [['Visitas', miles(a.visitas[0]), miles(a.visitas[1])], ['% visitas con compra', pct(a.pct_visitas_con_compra[0]), pct(a.pct_visitas_con_compra[1])], ['% visitas que pasan por Cuenta', pct(a.pct_pasan_cuenta[0]), pct(a.pct_pasan_cuenta[1])], ['Fuga desde Producto (por salida)', pct(a.fuga_producto[0]), pct(a.fuga_producto[1])], ['Fuga desde Cuenta (por salida)', pct(a.fuga_cuenta[0]), pct(a.fuga_cuenta[1])], ['Checkout → Compra (por salida)', pct(a.checkout_compra[0]), pct(a.checkout_compra[1])]]) +
          T(['Grupo', 'Entrada', '% de visitas', '% con 1 solo clic'], d.entrada.map(e => [GRUPO[e.cadena], nom(e.entrada), pct(e.pct_visitas), pct(e.pct_1_clic)])); }
      return ''; };
    $('#lista-val').innerHTML = D.validaciones.items.map(it => '<details class="caja val-item"><summary><span class="id">' + it.id + '</span> ' + esc(it.nombre) + ' <span class="p">' + esc(it.pregunta) + '</span></summary><div class="val-cuerpo"><p><b>Resultado:</b> ' + esc(it.conclusion) + '</p><p><b>Qué significa para P4:</b> ' + esc(IMP[it.id] || '') + '</p>' + det(it) + '</div></details>').join('');
    // actividad diaria
    const F = D.dias.filas, Wd = 1000, Hp = 170, L = 50, R = 990, bw = (R - L) / F.length, dow = ['mié', 'jue', 'vie', 'sáb', 'dom', 'lun', 'mar'];
    const panel = (k, top, tit) => { const mx = Math.max(...F.map(x => x[k])) * 1.15, Y = v => top + Hp - v / mx * Hp, base = F.filter(x => x.dia <= 29), m = base.reduce((a, b) => a + b[k], 0) / base.length;
      let s = '<text x="' + L + '" y="' + (top - 12) + '" font-size="15" font-weight="700" fill="#1b2a49">' + tit + '</text><text x="' + R + '" y="' + (top - 12) + '" font-size="12" fill="#5b6472" text-anchor="end">línea punteada = promedio días 1–29: ' + miles(Math.round(m)) + '</text>';
      F.forEach((x, i) => { const exc = x.dia >= 30, xx = L + i * bw + bw * .14;
        s += '<rect x="' + xx.toFixed(1) + '" y="' + Y(x[k]).toFixed(1) + '" width="' + (bw * .72).toFixed(1) + '" height="' + (Y(0) - Y(x[k])).toFixed(1) + '" fill="' + (exc ? '#d9822b' : '#1b2a49') + '" fill-opacity="' + (exc ? 1 : .78) + '"><title>' + x.dia + ' de julio: ' + miles(x[k]) + '</title></rect>';
        if (exc) s += '<text x="' + (xx + bw * .36).toFixed(1) + '" y="' + (Y(x[k]) - 5).toFixed(1) + '" font-size="12" font-weight="700" text-anchor="middle">' + miles(x[k]) + '</text>'; });
      s += '<line x1="' + L + '" x2="' + R + '" y1="' + Y(m).toFixed(1) + '" y2="' + Y(m).toFixed(1) + '" stroke="#5b6472" stroke-dasharray="6 4"/><line x1="' + L + '" x2="' + R + '" y1="' + Y(0) + '" y2="' + Y(0) + '" stroke="#c3c8cf"/>';
      return s; };
    let svg = '<svg viewBox="0 0 ' + Wd + ' 500" role="img" aria-label="Visitas y visitas con compra por día" font-family="system-ui, Segoe UI, Arial, sans-serif">' + panel('visitas', 30, 'Visitas por día') + panel('visitas_con_compra', 255, 'Visitas que terminan en compra, por día');
    F.forEach((x, i) => { const cx = L + i * bw + bw / 2; svg += '<text x="' + cx.toFixed(1) + '" y="448" font-size="11" text-anchor="middle" fill="#5b6472"' + (x.dia >= 30 ? ' font-weight="700"' : '') + '>' + x.dia + '</text><text x="' + cx.toFixed(1) + '" y="462" font-size="9.5" text-anchor="middle" fill="#5b6472">' + dow[(x.dia - 1) % 7] + '</text>'; });
    svg += '<text x="' + (L + R) / 2 + '" y="488" font-size="12" text-anchor="middle" fill="#5b6472">Día de julio 2026 (cada visita se asigna al día de su primer clic)</text></svg>';
    $('#dias').innerHTML = '<div class="dias scroll">' + svg + '</div>';
    const e = D.dias.evento;
    $('#evento').innerHTML = '<div>Compradores que compraron solo el 30 o 31: <b>' + miles(e.compran_solo_30_31) + '</b> (' + pct(e.pct_solo_30_31) + ' de ' + miles(e.compradores) + ')</div><div>Clics con palabras de campaña (oferta, promo, liquidación, black): <b>' + miles(e.clics_con_palabra_campana) + '</b>, de ellos <b>' + miles(e.de_ellos_en_30_31) + '</b> en los días 30–31</div>';
  }

  function reglas() {
    const R = ['Compradores = clientes que compraron al menos una vez en julio; no significa que cada visita de esos clientes haya comprado.',
      'No compradores = clientes que no compraron en julio.',
      'Abandono = término de una visita sin compra; no equivale a perder al cliente (puede volver en otra visita).',
      'La muestra tiene 5.000 compradores y 5.000 no compradores por diseño; las tasas no son la conversión real de Falabella.',
      'El mapa describe frecuencias y asociaciones observadas; no atribuye causalidad.',
      'Cada visita se analiza hasta su primera compra; los clics posteriores quedan fuera.',
      'App y web van juntas en el análisis principal; Agregar al carro y el login de Checkout solo se registran en la app.'];
    $('#reglas-lista').innerHTML = R.map(r => '<li>' + esc(r) + '</li>').join('');
  }

  function menuActivo() {
    const links = [...document.querySelectorAll('.menu a')], secs = links.map(a => document.querySelector(a.getAttribute('href')));
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) links.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id)); }), {rootMargin: '-40% 0px -55% 0px'});
    secs.forEach(s => s && io.observe(s));
  }
})();
