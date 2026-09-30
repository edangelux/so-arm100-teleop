// Taller de programación: ejercicios que se resuelven escribiendo un programa.
//
// Cada ejercicio trae un enunciado, un programa inicial (casi siempre vacío),
// pistas, una solución de referencia y una lista de comprobaciones. El
// programa se escribe en un editor igual al de la pestaña Programar (a la
// derecha), se ejecuta en el robot virtual con la celda de trabajo y se
// corrige solo: cada comprobación dice si se cumple y, si no, por qué. El
// botón «Siguiente» de la lección no se habilita hasta que todas se cumplen.
//
// Un ejercicio puede tener varios escenarios (por ejemplo, con y sin pieza en
// el sensor): el programa se ejecuta en todos y debe cumplir en todos, así que
// un IF no se puede «adivinar».
import { el, aviso, confirmar } from '../ui.js';
import { analizar, resaltar } from '../programa/lenguaje.js';
import { Ejecutor, Detenido, PINZA } from '../programa/ejecutor.js';
import { muestrear, GRADO, marcoHerramienta } from '../programa/movimiento.js';
import { DISPOSICION } from '../programa/celda.js';
import { linea as trazo, vaciar } from './comun.js';

const CLAVE_HECHOS = 'soarm-taller-hechos';
const hechos = () => { try { return new Set(JSON.parse(localStorage.getItem(CLAVE_HECHOS) || '[]')); } catch { return new Set(); } };
const marcar = (id) => { try { const h = hechos(); h.add(id); localStorage.setItem(CLAVE_HECHOS, JSON.stringify([...h])); } catch { /* sin almacenamiento */ } };
const leerCodigo = (id) => { try { return localStorage.getItem(`soarm-taller-${id}`); } catch { return null; } };
const guardarCodigo = (id, t) => { try { localStorage.setItem(`soarm-taller-${id}`, t); } catch { /* sin almacenamiento */ } };
const leerIntentos = (id) => { try { return Number(localStorage.getItem(`soarm-taller-int-${id}`) || 0); } catch { return 0; } };
const guardarIntentos = (id, n) => { try { localStorage.setItem(`soarm-taller-int-${id}`, String(n)); } catch { /* sin almacenamiento */ } };
export const tallerHechos = hechos;

const mm = (v) => v.toArray ? v.toArray().map((x) => x * 1000) : v;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const fmt = (p) => `[${p.slice(0, 3).map((v) => Math.round(v)).join(', ')}]`;
export const SIN_CUBO1 = DISPOSICION.piezas.filter((p) => p.nombre !== 'cubo1');

// ---------------------------------------------------------------- análisis estático
// Cuenta lo que el texto usa, sin ejecutarlo.
export function estructura(a, texto) {
  const c = { MoveJ: 0, MoveL: 0, MoveC: 0, MoveAbsJ: 0, for: 0, while: 0, if: 0, else: 0, proc: 0, llamada: 0, tpwrite: 0,
    setdo: 0, waitdi: 0, velset: 0, incr: 0, asig: 0, espera: 0, pinza: 0, robtarget: 0, jointtarget: 0, num: 0, lineas: 0, literales: 0, zonas: 0, fines: 0 };
  for (const ln of a.lineas) {
    const n = ln.nodo;
    if (!n || ['vacio', 'comentario'].includes(n.tipo)) continue;
    c.lineas++;
    if (n.tipo === 'move') {
      c[n.instr]++;
      if (n.zona > 0) c.zonas++; else c.fines++;
      if (n.destino?.tipo === 'lit' || n.via?.tipo === 'lit') c.literales++;
    } else if (n.tipo === 'decl') c[n.clase] = (c[n.clase] || 0) + 1;
    else if (n.tipo === 'proc') { if (n.nombre.toLowerCase() !== 'main') c.proc++; }
    else if (n.tipo in c) c[n.tipo]++;
  }
  c.offs = (texto.match(/\bOffs\s*\(/gi) || []).length;
  c.reltool = (texto.match(/\bRelTool\s*\(/gi) || []).length;
  c.else = (texto.match(/^\s*ELSE\b/gim) || []).length;
  return c;
}

// ---------------------------------------------------------------- ejecución
// Ejecuta el programa en el robot virtual con la celda. animar: se ve moverse;
// si no, sólo se calcula. Devuelve un registro de todo lo que pasó.
export async function correr(app, texto, { animar = false, escenario = {}, q0 = null, dibujar = animar, alLinea = null, alDetener = null } = {}) {
  const a = analizar(texto);
  const r = { poses: app.modelo.poses, a, error: null, tramos: [], tcp: [], paradas: [], eventos: [], mensajes: [], tiempo: 0, final: null, piezas: {}, senales: {}, movs: { MoveJ: 0, MoveL: 0, MoveC: 0, MoveAbsJ: 0 } };
  if (a.errores.length) { r.error = { linea: a.errores[0].linea, mensaje: a.errores[0].mensaje }; return r; }
  const celda = app.celda;
  celda.reiniciar(escenario.piezas || DISPOSICION.piezas);
  for (const s of ['di2', 'di3', 'di4', 'do1', 'do2', 'do3', 'do4']) celda.fijarSenal(s, 0);
  let q = (q0 || [0, 0, 0, 0, 0]).slice(0, 5);
  let pinza = PINZA.abierta;
  const poner = () => app.escena.fijarPostura([...q, pinza]);
  poner();
  const ej = new Ejecutor(app.cadena, app.modelo.poses);
  if (alDetener) alDetener(() => ej.parar());
  const instrs = {};
  a.lineas.forEach((l, i) => { if (l.nodo?.tipo === 'move') instrs[i + 1] = l.nodo.instr; });
  const color = { MoveJ: 0x7553ff, MoveAbsJ: 0x7553ff, MoveL: 0xc2ef4e, MoveC: 0xfd44b0 };
  const asentar = () => { for (let k = 0; k < 400 && celda.cayendo.length; k++) celda._cuadro(0.02); };
  const esperaReal = (s) => new Promise((ok, mal) => {
    const fin = performance.now() + s * 1000;
    const t = setInterval(() => { if (ej.detener) { clearInterval(t); mal(new Detenido()); } else if (performance.now() >= fin) { clearInterval(t); ok(); } }, 20);
  });
  try {
    await ej.ejecutar(a, {
      q0: q, pinza0: pinza, senales: celda.senales,
      linea: (n) => alLinea?.(n),
      antes: async (n) => { if (n.tipo === 'move') r.movs[n.instr]++; },
      mover: async (tr) => {
        r.tramos.push({ linea: tr.linea[tr.linea.length - 1], instr: instrs[tr.linea[tr.linea.length - 1]], duracion: tr.duracion, t0: r.tiempo });
        for (const p of tr.p) r.tcp.push(mm(p));
        r.eventos.push({ tipo: 'mover', t: r.tiempo, linea: tr.linea[tr.linea.length - 1] });
        if (dibujar) {
          let ini = 0;
          for (let i = 1; i <= tr.p.length; i++) {
            if (i === tr.p.length || tr.linea[i] !== tr.linea[ini]) {
              const pts = tr.p.slice(Math.max(0, ini - 1), i);
              if (pts.length > 1) trazo(app, pts, color[instrs[tr.linea[ini]]] ?? 0xffffff, 0.9);
              ini = i;
            }
          }
        }
        if (animar) {
          await new Promise((ok, mal) => {
            const t0 = performance.now();
            const paso = () => {
              if (ej.detener) return mal(new Detenido());
              const t = (performance.now() - t0) / 1000;
              const m = muestrear(tr, t);
              q = m.q.slice(0, 5);
              poner();
              alLinea?.(tr.linea[m.i]);
              if (t >= tr.duracion) return ok();
              requestAnimationFrame(paso);
            };
            paso();
          });
        }
        q = tr.q[tr.q.length - 1].slice(0, 5);
        poner();
        r.tiempo += tr.duracion;
        const ps = app.cadena.pose(q);
        r.paradas.push({ p: mm(ps.p), cab: ps.cab / GRADO, q: q.slice(), linea: tr.linea[tr.linea.length - 1] });
      },
      pinza: async (accion, valor) => {
        poner();
        let agarro = null, solto = null;
        if (accion === 'cerrar' || (accion === 'fijar' && valor < pinza)) agarro = celda.agarrar(app.escena.robot);
        else solto = celda.soltar();
        pinza = agarro ? PINZA.conPieza : valor;
        poner();
        r.eventos.push({ tipo: 'pinza', accion, t: r.tiempo, pieza: agarro?.nombre || solto?.nombre || null });
        if (animar) await esperaReal(0.35);
        if (solto) { if (animar) await esperaReal(0.4); asentar(); }
        r.tiempo += 0.5;
      },
      esperar: async (s) => { r.eventos.push({ tipo: 'espera', s, t: r.tiempo }); if (animar) await esperaReal(Math.min(s, 3)); r.tiempo += s; },
      esperarEntrada: async (s, v) => {
        if (celda.senales[s] === v) { r.eventos.push({ tipo: 'entrada', s, v, t: r.tiempo, ya: true }); return; }
        const sim = escenario.entradas?.[s];
        if (sim === undefined || sim.valor !== v) {
          throw Object.assign(new Error(s === 'di1' ? `WaitDI ${s}, ${v}: el sensor no cambia solo en este escenario (${v ? 'no hay pieza sobre el anillo' : 'la pieza sigue ahí'}). El programa se quedaría esperando para siempre.` : `WaitDI ${s}, ${v}: en este escenario nadie pulsa ${s}. El programa se quedaría esperando para siempre.`), { linea: null });
        }
        if (animar) await esperaReal(sim.tras ?? 1);
        r.tiempo += sim.tras ?? 1;
        celda.fijarSenal(s, v);
        r.eventos.push({ tipo: 'entrada', s, v, t: r.tiempo });
      },
      salida: (s, v) => { celda.fijarSenal(s, v); r.eventos.push({ tipo: 'salida', s, v, t: r.tiempo }); },
      escribir: (t) => { r.mensajes.push(String(t)); r.eventos.push({ tipo: 'mensaje', texto: String(t), t: r.tiempo }); },
      pausa: async () => { r.eventos.push({ tipo: 'stop', t: r.tiempo }); },
      ceder: () => new Promise((ok) => setTimeout(ok, 0)),
    }, { override: 1, maxPasos: 20000 });
  } catch (e) {
    if (e instanceof Detenido) r.error = { linea: null, mensaje: 'Detenido.', detenido: true };
    else r.error = { linea: e.linea ?? null, mensaje: e.message };
  }
  asentar();
  const ps = app.cadena.pose(q);
  r.final = { p: mm(ps.p), cab: ps.cab / GRADO, q: q.slice(), giro: q[4] / GRADO };
  r.piezas = Object.fromEntries(celda.resumen().map((p) => [p.nombre, p]));
  r.senales = { ...celda.senales };
  return r;
}

// ---------------------------------------------------------------- comprobaciones
// Cada una: { texto, prueba(r, c) → true | 'motivo' }. r: registro de correr();
// c: estructura del texto.
export const C = {
  sinError: () => ({ texto: 'El programa se ejecuta de principio a fin sin errores', prueba: (r) => !r.error || `${r.error.linea ? `Línea ${r.error.linea}: ` : ''}${r.error.mensaje}` }),
  llega: (p, tol = 4, texto) => ({ texto: texto || `Termina con la pinza en ${fmt(p)} mm`,
    prueba: (r) => dist(r.final.p, p) <= tol || `La pinza termina en ${fmt(r.final.p)}, a ${dist(r.final.p, p).toFixed(0)} mm.` }),
  cabeceoFinal: (cab, tol = 3) => ({ texto: `Termina con un cabeceo de ${cab}°`,
    prueba: (r) => Math.abs(r.final.cab - cab) <= tol || `Termina con cabeceo ${r.final.cab.toFixed(0)}°.` }),
  // Se detiene (fin de un movimiento) en cada punto, en ese orden.
  paraEn: (pts, tol = 4, texto) => ({ texto: texto || `Se detiene en ${pts.map(fmt).join(' → ')}`,
    prueba: (r) => {
      let k = 0;
      for (const s of r.paradas) if (k < pts.length && dist(s.p, pts[k]) <= tol) k++;
      return k === pts.length || `No llegó a ${fmt(pts[k])}${k ? ` después de ${fmt(pts[k - 1])}` : ''}. Paradas: ${r.paradas.slice(0, 8).map((s) => fmt(s.p)).join(', ') || 'ninguna'}.`;
    } }),
  // La punta pasa (aunque no se detenga) por cada punto, en orden.
  pasaPor: (pts, tol = 5, texto) => ({ texto: texto || `La punta pasa por ${pts.map(fmt).join(' → ')}`,
    prueba: (r) => {
      let k = 0;
      for (const s of r.tcp) if (k < pts.length && dist(s, pts[k]) <= tol) k++;
      return k === pts.length || `La punta no pasó por ${fmt(pts[k])}${k ? ` después de ${fmt(pts[k - 1])}` : ''}.`;
    } }),
  // Entre a y b la punta va en línea recta (todas las muestras cerca del segmento).
  recto: (a, b, tol = 2.5) => ({ texto: `De ${fmt(a)} a ${fmt(b)} la punta va en línea recta`,
    prueba: (r) => {
      const i = r.tcp.findIndex((s) => dist(s, a) <= 3);
      if (i < 0) return `La punta no pasó por ${fmt(a)}.`;
      const j = r.tcp.findIndex((s, k) => k > i && dist(s, b) <= 3);
      if (j < 0) return `La punta no llegó a ${fmt(b)} después de ${fmt(a)}.`;
      const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2;
      let peor = 0;
      for (let k = i; k <= j; k++) {
        const s = r.tcp[k], ap = [s[0] - a[0], s[1] - a[1], s[2] - a[2]];
        const u = Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / L2));
        peor = Math.max(peor, dist(s, [a[0] + u * ab[0], a[1] + u * ab[1], a[2] + u * ab[2]]));
      }
      return peor <= tol || `La punta se aparta ${peor.toFixed(0)} mm de la recta: ese tramo no es un MoveL.`;
    } }),
  usa: (clave, min = 1, texto) => ({ texto: texto || `Usa ${nombreClave(clave)}${min > 1 ? ` al menos ${min} veces` : ''}`,
    prueba: (r, c) => c[clave] >= min || `Hay ${c[clave]}.` }),
  noMas: (clave, max, texto) => ({ texto: texto || `Usa ${nombreClave(clave)} como mucho ${max} ${max === 1 ? 'vez' : 'veces'}`,
    prueba: (r, c) => c[clave] <= max || `Hay ${c[clave]}.` }),
  lineas: (max) => ({ texto: `Cabe en ${max} líneas de código o menos (sin contar comentarios)`, prueba: (r, c) => c.lineas <= max || `Tiene ${c.lineas}. Use un bucle o un procedimiento para no repetir.` }),
  ejecuta: (instr, min, texto) => ({ texto: texto || `Ejecuta ${instr} al menos ${min} veces`, prueba: (r) => r.movs[instr] >= min || `Se ejecutó ${r.movs[instr]} veces.` }),
  ciclo: (max, min = 0) => ({ texto: min ? `El ciclo dura entre ${min} y ${max} s` : `El ciclo dura ${max} s o menos`,
    prueba: (r) => (r.tiempo <= max && r.tiempo >= min) || `Dura ${r.tiempo.toFixed(1)} s.` }),
  tramo: (f, texto) => ({ texto, prueba: (r) => r.tramos.some(f) || `Duraciones de los tramos: ${r.tramos.map((t) => `${t.instr} ${t.duracion.toFixed(1)} s`).join(', ')}.` }),
  mensajes: (lista) => ({ texto: `Escribe ${lista.map((m) => `«${m}»`).join(', ')}${lista.length > 1 ? ', en ese orden' : ''}`,
    prueba: (r) => (r.mensajes.length === lista.length && lista.every((m, i) => r.mensajes[i].trim() === m)) || `Escribió: ${r.mensajes.map((m) => `«${m}»`).join(', ') || 'nada'}.` }),
  mensaje: (texto) => ({ texto: `Escribe «${texto}»`, prueba: (r) => r.mensajes.some((m) => m.trim() === texto) || `Escribió: ${r.mensajes.map((m) => `«${m}»`).join(', ') || 'nada'}.` }),
  noMensaje: (texto) => ({ texto: `No escribe «${texto}»`, prueba: (r) => !r.mensajes.some((m) => m.trim() === texto) || `Escribió «${texto}».` }),
  pieza: (nombre, f, texto) => ({ texto, prueba: (r) => f(r.piezas[nombre]) || `${nombre} ${donde(r.piezas[nombre])}.` }),
  enBandeja: (nombres) => ({ texto: `${nombres.join(', ')} ${nombres.length > 1 ? 'terminan' : 'termina'} dentro de la bandeja`,
    prueba: (r) => { const f = nombres.filter((n) => !enBandeja(r.piezas[n])); return !f.length || f.map((n) => `${n} ${donde(r.piezas[n])}`).join('; ') + '.'; } }),
  enSitio: (nombre, x, y, texto) => ({ texto: texto || `${nombre} termina en [${x}, ${y}]`,
    prueba: (r) => cerca(r.piezas[nombre], x, y) || `${nombre} ${donde(r.piezas[nombre])}.` }),
  sujeta: (nombre) => ({ texto: `Termina con ${nombre} en la pinza`, prueba: (r) => r.piezas[nombre]?.sujeta || `${nombre} ${donde(r.piezas[nombre])}.` }),
  salidaFinal: (s, v) => ({ texto: `Termina con ${s} = ${v}`, prueba: (r) => r.senales[s] === v || `${s} vale ${r.senales[s]}.` }),
  // Secuencia de eventos: lista de funciones que deben cumplirse en orden sobre r.eventos.
  orden: (pasos, texto) => ({ texto, prueba: (r) => {
    let k = 0;
    for (const e of r.eventos) if (k < pasos.length && pasos[k].f(e)) k++;
    return k === pasos.length || `Falta: ${pasos[k].que}${k ? ` (después de: ${pasos[k - 1].que})` : ''}.`;
  } }),
  nuncaBajo: (zmin, texto) => ({ texto: texto || `La punta nunca baja de z = ${zmin} mm`, prueba: (r) => { const z = Math.min(...r.tcp.map((p) => p[2])); return z >= zmin - 0.5 || `Bajó hasta z = ${z.toFixed(0)} mm.`; } }),
  propia: (texto, f) => ({ texto, prueba: f }),
};
// Atajos para C.orden
export const E = {
  salida: (s, v) => ({ que: `SetDO ${s}, ${v}`, f: (e) => e.tipo === 'salida' && e.s === s && e.v === v }),
  entrada: (s, v) => ({ que: `WaitDI ${s}, ${v}`, f: (e) => e.tipo === 'entrada' && e.s === s && e.v === v }),
  mover: () => ({ que: 'un movimiento', f: (e) => e.tipo === 'mover' }),
  agarra: (n) => ({ que: `tomar ${n || 'una pieza'}`, f: (e) => e.tipo === 'pinza' && e.accion !== 'abrir' && (!n || e.pieza === n) && e.pieza }),
  suelta: (n) => ({ que: `soltar ${n || 'una pieza'}`, f: (e) => e.tipo === 'pinza' && e.accion === 'abrir' && (!n || e.pieza === n) && e.pieza }),
  mensaje: (t) => ({ que: `TPWrite «${t}»`, f: (e) => e.tipo === 'mensaje' && e.texto.trim() === t }),
};

const NOMBRES = { MoveJ: 'MoveJ', MoveL: 'MoveL', MoveC: 'MoveC', MoveAbsJ: 'MoveAbsJ', for: 'FOR', while: 'WHILE', if: 'IF', else: 'ELSE', proc: 'un PROC propio (además de main)',
  llamada: 'llamadas a procedimientos', tpwrite: 'TPWrite', setdo: 'SetDO', waitdi: 'WaitDI', velset: 'VelSet', incr: 'Incr', robtarget: 'puntos robtarget declarados',
  jointtarget: 'jointtarget declarados', num: 'variables num', offs: 'Offs', reltool: 'RelTool', literales: 'puntos escritos entre corchetes dentro de un movimiento', zonas: 'movimientos con zona (z1, z10…)', fines: 'movimientos con fine' };
const nombreClave = (k) => NOMBRES[k] || k;
const B = DISPOSICION.bandeja;
export const enBandeja = (p) => p && !p.sujeta && Math.abs(p.x - B.x) < B.ancho / 2 - 4 && Math.abs(p.y - B.y) < B.largo / 2 - 4;
export const cerca = (p, x, y, tol = 10) => p && !p.sujeta && Math.hypot(p.x - x, p.y - y) < tol;
const donde = (p) => (!p ? 'no está en la celda' : p.sujeta ? 'sigue en la pinza' : `está en [${Math.round(p.x)}, ${Math.round(p.y)}, ${Math.round(p.z)}]`);

// Corrige: ejecuta en cada escenario y evalúa cada comprobación.
export async function corregir(app, ej, texto, { animar = false, alLinea, alDetener } = {}) {
  const escenarios = ej.escenarios || [{ nombre: '' }];
  const resultados = [];
  let registro = null;
  for (const [k, esc] of escenarios.entries()) {
    const r = await correr(app, texto, { animar: animar && k === 0, dibujar: k === 0, escenario: esc, alLinea, alDetener });
    if (k === 0) registro = r;
    if (r.error?.detenido) return { detenido: true, registro };
    const c = estructura(r.a, texto);
    const lista = [C.sinError(), ...(esc.comprobar || ej.comprobar)];
    resultados.push({ nombre: esc.nombre, items: lista.map((x) => {
      const res = x.prueba(r, c);
      return { texto: x.texto, ok: res === true, motivo: res === true ? '' : res };
    }) });
  }
  // El escenario 0 queda visible en la escena.
  if (escenarios.length > 1) await correr(app, texto, { animar: false, dibujar: false, escenario: escenarios[0] });
  const ok = resultados.every((e) => e.items.every((i) => i.ok));
  return { ok, resultados, registro };
}

// ---------------------------------------------------------------- interfaz
// Arma el paso de lección de un ejercicio. El editor va en el panel derecho
// (app.tarjetaPaso, que Aprender coloca arriba de la explicación) y los
// resultados en el cuadro de la lección, sobre la escena.
export function ejercicio(ej) {
  return {
    titulo: ej.titulo,
    texto: `<span class="chip-ejercicio">Ejercicio</span> ${ej.enunciado}`,
    reto: true,
    vista: 'programa',
    ejercicio: true,
    ej,
    detalle: ej.detalle,
    preparar(app, cuerpo, listo) {
      app.celda?.mostrar(true);
      app.celda?.reiniciar((ej.escenarios?.[0]?.piezas) || DISPOSICION.piezas);
      document.body.classList.add('panel-ancho');       // más sitio para el editor, como en Programar
      app.escena.fijarPostura([0, 0, 0, 0, 0, PINZA.abierta]);
      let texto = leerCodigo(ej.id) ?? ej.inicial ?? '';
      let corriendo = false;
      let parar = null;
      const resuelto = hechos().has(ej.id);
      if (resuelto) listo();

      // Editor (igual al de Programar, más bajo).
      const numeros = el('div', { class: 'editor-numeros' });
      const capa = el('pre', { class: 'editor-capa', 'aria-hidden': 'true' });
      const area = el('textarea', { class: 'editor-texto', spellcheck: 'false', autocomplete: 'off', wrap: 'off' });
      let actual = null;
      const pintarEditor = () => {
        const a = analizar(texto);
        const malas = new Set(a.errores.map((e) => e.linea));
        const l = texto.replace(/\r/g, '').split('\n');
        numeros.innerHTML = l.map((_, i) => `<div class="${malas.has(i + 1) ? 'num-error' : ''}${actual === i + 1 ? ' num-actual' : ''}">${i + 1}</div>`).join('');
        capa.innerHTML = l.map((x, i) => `<div class="${actual === i + 1 ? 'actual' : ''}${malas.has(i + 1) ? ' error' : ''}">${resaltar(x) || ' '}</div>`).join('') + '<div> </div>';
        errores.replaceChildren(...a.errores.slice(0, 3).map((e) => el('div', {}, el('b', {}, `Línea ${e.linea}: `), e.mensaje)));
        errores.classList.toggle('oculto', !a.errores.length);
      };
      area.value = texto;
      area.addEventListener('input', () => { texto = area.value; guardarCodigo(ej.id, texto); pintarEditor(); });
      area.addEventListener('scroll', () => { capa.scrollTop = numeros.scrollTop = area.scrollTop; capa.scrollLeft = area.scrollLeft; });
      area.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') { e.preventDefault(); document.execCommand('insertText', false, '  '); }
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); probar(true); }
      });
      const errores = el('div', { class: 'mensaje mal oculto', style: 'margin-top:8px' });

      // Cuadro de resultados, en la lección.
      const lista = el('div', { class: 'comprobaciones' },
        ...[C.sinError(), ...(ej.escenarios?.[0]?.comprobar || ej.comprobar)].map((x) => el('div', { class: 'comp' }, el('i'), el('span', {}, x.texto))));
      const consola = el('div', { class: 'consola consola-corta oculto' });
      const estado = el('div', { class: 'nota', style: 'margin-top:6px' }, resuelto ? 'Ya lo resolvió antes; puede seguir o mejorarlo.' : 'Escriba el programa a la derecha y pulse «Ejecutar y comprobar» (o Ctrl+Enter).');
      const pistas = ej.pistas || [];
      let nPista = 0;
      const cajaPista = el('div', { class: 'pista-ejercicio oculto' });
      const bPista = el('button', { class: 'boton pequeno', onclick: () => {
        if (!pistas.length) return;
        nPista = Math.min(nPista + 1, pistas.length);
        cajaPista.replaceChildren(...pistas.slice(0, nPista).map((p, i) => el('p', { html: `<b>Pista ${i + 1}.</b> ${p}` })));
        cajaPista.classList.remove('oculto');
        bPista.textContent = nPista < pistas.length ? `Otra pista (${nPista}/${pistas.length})` : 'Sin más pistas';
      } }, pistas.length ? `Pista (${pistas.length})` : 'Sin pistas');
      const bSolucion = el('button', { class: 'boton pequeno silencioso', onclick: async () => {
        if (leerIntentos(ej.id) < 3 && !hechos().has(ej.id)) return aviso('La solución se desbloquea después de 3 intentos. Use antes las pistas.', 'mal');
        if (!(await confirmar('Ver la solución', 'Se reemplaza su programa por una solución de referencia. Léala línea por línea, ejecútela y después intente escribirla sin mirar.', { aceptar: 'Ver la solución' }))) return;
        texto = ej.solucion; area.value = texto; guardarCodigo(ej.id, texto); pintarEditor();
      } }, 'Ver solución');
      const pintarSolucion = () => {
        const n = leerIntentos(ej.id);
        bSolucion.title = hechos().has(ej.id) || n >= 3 ? '' : `Se desbloquea tras 3 intentos (lleva ${n}).`;
        bSolucion.classList.toggle('bloqueado', !(hechos().has(ej.id) || n >= 3));
      };
      pintarSolucion();

      const bEjecutar = el('button', { class: 'boton primario pequeno', onclick: () => probar(true) }, 'Ejecutar y comprobar');
      const bRapido = el('button', { class: 'boton pequeno', onclick: () => probar(false) }, 'Comprobar sin animar');
      const bDetener = el('button', { class: 'boton pequeno peligro oculto', onclick: () => parar?.() }, 'Detener');
      const bReiniciar = el('button', { class: 'boton pequeno silencioso', onclick: async () => {
        if (!(await confirmar('Empezar de nuevo', 'Se borra su programa y vuelve el programa inicial del ejercicio.', { aceptar: 'Borrar' }))) return;
        texto = ej.inicial ?? ''; area.value = texto; guardarCodigo(ej.id, texto); pintarEditor();
      } }, 'Borrar mi programa');

      async function probar(animar) {
        if (corriendo) return;
        corriendo = true;
        [bEjecutar, bRapido].forEach((b) => { b.disabled = true; });
        bDetener.classList.toggle('oculto', !animar);
        estado.textContent = animar ? 'Ejecutando en el robot virtual…' : 'Comprobando…';
        consola.replaceChildren();
        vaciar(app);
        let res;
        try {
          res = await corregir(app, ej, texto, { animar, alLinea: (n) => { if (actual !== n) { actual = n; pintarEditor(); } }, alDetener: (f) => { parar = f; } });
        } finally {
          corriendo = false; parar = null; actual = null; pintarEditor();
          [bEjecutar, bRapido].forEach((b) => { b.disabled = false; });
          bDetener.classList.add('oculto');
        }
        if (res.detenido) { estado.textContent = 'Detenido.'; return; }
        const r = res.registro;
        if (r.mensajes.length) { consola.replaceChildren(...r.mensajes.map((m) => el('div', {}, `TPWrite: ${m}`))); consola.classList.remove('oculto'); } else consola.classList.add('oculto');
        const varios = res.resultados.length > 1;
        lista.replaceChildren(...res.resultados.flatMap((e) => [
          varios ? el('div', { class: 'escenario' }, `Escenario: ${e.nombre}`) : null,
          ...e.items.map((i) => el('div', { class: `comp ${i.ok ? 'bien' : 'mal'}` }, el('i'), el('span', {}, i.texto, i.ok ? null : el('small', {}, i.motivo)))),
        ]).filter(Boolean));
        if (res.ok) {
          const primera = !hechos().has(ej.id);
          marcar(ej.id);
          estado.innerHTML = `<b>¡Resuelto!</b> Tiempo de ciclo ${r.tiempo.toFixed(1)} s. ${primera ? 'Ya puede pasar al siguiente paso.' : ''}`;
          estado.className = 'mensaje ok';
          listo();
        } else {
          guardarIntentos(ej.id, leerIntentos(ej.id) + 1);
          const n = leerIntentos(ej.id);
          estado.textContent = `Todavía no (intento ${n}). Revise lo marcado en rosa${n >= 3 ? '; ya puede ver la solución' : ''}.`;
          estado.className = 'nota';
        }
        pintarSolucion();
      }

      cuerpo.append(lista, estado, consola,
        el('div', { class: 'fila', style: 'margin-top:10px;flex-wrap:wrap' }, bEjecutar, bRapido, bDetener, bPista, bSolucion),
        cajaPista);
      app.tarjetaPaso = el('div', { class: 'tarjeta tarjeta-taller' },
        el('div', { class: 'fila', style: 'margin-bottom:8px' }, el('h3', { style: 'margin:0' }, 'Su programa'), el('span', { class: 'crece' }), bReiniciar),
        el('p', { class: 'nota', html: ej.ayudaEditor || 'Escriba en RAPID. <b>Ctrl+Enter</b> ejecuta. El programa se guarda solo en este navegador.' }),
        el('div', { class: 'editor editor-taller' }, numeros, el('div', { class: 'editor-zona' }, capa, area)),
        errores);
      pintarEditor();
      return () => { parar?.(); app.tarjetaPaso = null; document.body.classList.remove('panel-ancho'); };
    },
  };
}

// Punto a lo largo del eje de la herramienta (para comprobar RelTool).
export function aLoLargoDeHerramienta(p, cab, giro, d) {
  const m = marcoHerramienta({ x: p[0] / 1000, y: p[1] / 1000 }, cab * GRADO, giro * GRADO);
  return [0, 1, 2].map((i) => p[i] + d * m.z.getComponent(i));
}

