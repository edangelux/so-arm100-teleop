// Lenguaje de programación del SO-ARM100, un subconjunto de ABB RAPID.
//
// Se eligió RAPID porque sus instrucciones (MoveJ, MoveL, MoveC, MoveAbsJ,
// Offs, WaitTime, SetDO, WaitDI, FOR, WHILE, IF, PROC) son las que aparecen en
// la industria y en los cursos; lo que se aprende aquí se reconoce en un robot
// real. Se simplificó en tres cosas: el punto y coma es opcional, no hay que
// declarar herramienta ni objeto de trabajo, y una pose tiene cinco números
// [x, y, z, cabeceo, giro] porque el brazo tiene cinco articulaciones.
//
// El texto es la fuente de verdad. La vista de lista (consola de programación)
// se construye analizando el texto y, cuando se edita una instrucción en la
// lista, se reescribe sólo esa línea.

export const INSTRUCCIONES = {
  MoveJ: 'Movimiento articular: cada articulación va de su ángulo inicial al final a la vez; la punta describe una curva.',
  MoveL: 'Movimiento lineal: la punta recorre una línea recta a la velocidad indicada.',
  MoveC: 'Movimiento circular: la punta recorre un arco que pasa por un punto intermedio.',
  MoveAbsJ: 'Movimiento a ángulos absolutos de las articulaciones, sin cinemática inversa.',
  GripperOpen: 'Abre la pinza.',
  GripperClose: 'Cierra la pinza; si hay una pieza entre los dedos, la sujeta.',
  GripperSet: 'Lleva la pinza a una apertura en por ciento (0 cerrada, 100 abierta).',
  WaitTime: 'Espera los segundos indicados.',
  SetDO: 'Pone una salida digital en 0 o 1.',
  WaitDI: 'Espera a que una entrada digital valga 0 o 1.',
  TPWrite: 'Escribe un mensaje en la consola.',
  VelSet: 'Ajusta la velocidad de todo el programa en por ciento.',
  FOR: 'Repite un bloque con un contador.',
  WHILE: 'Repite un bloque mientras se cumpla una condición.',
  IF: 'Ejecuta un bloque sólo si se cumple una condición.',
  Incr: 'Suma 1 a una variable.',
  Decr: 'Resta 1 a una variable.',
  Stop: 'Pausa el programa hasta pulsar Continuar.',
};

export const SENALES = ['di1', 'di2', 'di3', 'di4', 'do1', 'do2', 'do3', 'do4'];
export const CONSTANTES = { home: 'jointtarget', init: 'jointtarget' };

const PALABRAS = ['MODULE', 'ENDMODULE', 'PROC', 'ENDPROC', 'FOR', 'FROM', 'TO', 'STEP', 'DO', 'ENDFOR',
  'WHILE', 'ENDWHILE', 'IF', 'THEN', 'ELSEIF', 'ELSE', 'ENDIF', 'AND', 'OR', 'NOT', 'TRUE', 'FALSE',
  'VAR', 'CONST', 'PERS', 'ROBTARGET', 'JOINTTARGET', 'NUM', 'BOOL'];

export class ErrorPrograma extends Error {
  constructor(linea, mensaje) { super(mensaje); this.linea = linea; }
}

// ---------------------------------------------------------------- léxico
function lexico(texto, linea) {
  const t = [];
  let i = 0;
  while (i < texto.length) {
    const c = texto[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '!' || c === '#') break;                     // comentario hasta el final
    if (c === '"') {
      const f = texto.indexOf('"', i + 1);
      if (f < 0) throw new ErrorPrograma(linea, 'Falta cerrar las comillas.');
      t.push({ k: 'txt', v: texto.slice(i + 1, f) }); i = f + 1; continue;
    }
    const num = /^\d+(\.\d+)?|^\.\d+/.exec(texto.slice(i));
    if (num) { t.push({ k: 'num', v: parseFloat(num[0]) }); i += num[0].length; continue; }
    const id = /^[A-Za-z_áéíóúñÁÉÍÓÚÑ][\wáéíóúñÁÉÍÓÚÑ]*/.exec(texto.slice(i));
    if (id) { t.push({ k: 'id', v: id[0] }); i += id[0].length; continue; }
    const s2 = texto.slice(i, i + 2);
    if ([':=', '<>', '<=', '>='].includes(s2)) { t.push({ k: 's', v: s2 }); i += 2; continue; }
    if ('=<>+-*/()[],;:\\'.includes(c)) { t.push({ k: 's', v: c }); i++; continue; }
    throw new ErrorPrograma(linea, `Carácter no reconocido: «${c}».`);
  }
  while (t.length && t[t.length - 1].k === 's' && t[t.length - 1].v === ';') t.pop();
  return t;
}

// ---------------------------------------------------------------- lector de fichas
class Fichas {
  constructor(t, linea) { this.t = t; this.i = 0; this.linea = linea; }
  ver(k = 0) { return this.t[this.i + k]; }
  fin() { return this.i >= this.t.length; }
  sig() { return this.t[this.i++]; }
  es(v) { const f = this.ver(); return f && (f.k === 's' ? f.v === v : f.k === 'id' && f.v.toUpperCase() === v); }
  tomar(v) { if (this.es(v)) { this.i++; return true; } return false; }
  exigir(v, que) {
    if (!this.tomar(v)) {
      const q = que || `«${v}»`;
      throw new ErrorPrograma(this.linea, this.fin() ? `Falta ${q}.` : `Se esperaba ${q} y apareció «${this.ver().v}».`);
    }
  }
  id(que = 'un nombre') {
    const f = this.sig();
    if (!f || f.k !== 'id') throw new ErrorPrograma(this.linea, `Se esperaba ${que}.`);
    return f.v;
  }
  terminar() {
    if (!this.fin()) throw new ErrorPrograma(this.linea, `Sobra «${this.ver().v}» al final de la línea.`);
  }
}

// ---------------------------------------------------------------- expresiones
function expresion(f) { return o(f); }
function o(f) { let a = y(f); while (f.tomar('OR')) a = { op: 'OR', a, b: y(f) }; return a; }
function y(f) { let a = no(f); while (f.tomar('AND')) a = { op: 'AND', a, b: no(f) }; return a; }
function no(f) { return f.tomar('NOT') ? { op: 'NOT', a: no(f) } : comparacion(f); }
function comparacion(f) {
  const a = suma(f);
  for (const op of ['=', '<>', '<=', '>=', '<', '>']) if (f.tomar(op)) return { op, a, b: suma(f) };
  return a;
}
function suma(f) {
  let a = producto(f);
  for (;;) {
    if (f.tomar('+')) a = { op: '+', a, b: producto(f) };
    else if (f.tomar('-')) a = { op: '-', a, b: producto(f) };
    else return a;
  }
}
function producto(f) {
  let a = unario(f);
  for (;;) {
    if (f.tomar('*')) a = { op: '*', a, b: unario(f) };
    else if (f.tomar('/')) a = { op: '/', a, b: unario(f) };
    else return a;
  }
}
function unario(f) {
  if (f.tomar('-')) return { op: 'neg', a: unario(f) };
  if (f.tomar('+')) return unario(f);
  return primario(f);
}
function primario(f) {
  const t = f.sig();
  if (!t) throw new ErrorPrograma(f.linea, 'Falta un valor.');
  if (t.k === 'num') return { num: t.v };
  if (t.k === 'txt') return { txt: t.v };
  if (t.k === 's' && t.v === '(') { const e = expresion(f); f.exigir(')'); return e; }
  if (t.k === 'id') {
    const u = t.v.toUpperCase();
    if (u === 'TRUE') return { num: 1 };
    if (u === 'FALSE') return { num: 0 };
    if (f.tomar('(')) {
      const args = [];
      if (!f.es(')')) do { args.push(expresion(f)); } while (f.tomar(','));
      f.exigir(')');
      return { fn: t.v, args };
    }
    return { ref: t.v };
  }
  throw new ErrorPrograma(f.linea, `No se esperaba «${t.v}».`);
}

// Destino de un movimiento: nombre, Offs(...), RelTool(...) o [x, y, z, cab, giro].
function destino(f) {
  if (f.tomar('[')) {
    const valores = [];
    do { valores.push(expresion(f)); } while (f.tomar(','));
    f.exigir(']');
    return { tipo: 'lit', valores };
  }
  const nombre = f.id('un punto (por ejemplo p1, Offs(p1, 0, 0, 50) o [x, y, z, cab, giro])');
  const u = nombre.toUpperCase();
  if ((u === 'OFFS' || u === 'RELTOOL') && f.tomar('(')) {
    const base = destino(f);
    const d = [];
    while (f.tomar(',')) d.push(expresion(f));
    f.exigir(')');
    if (d.length !== 3) throw new ErrorPrograma(f.linea, `${nombre} lleva un punto y tres desplazamientos en mm: ${nombre}(p, dx, dy, dz).`);
    return { tipo: u === 'OFFS' ? 'offs' : 'reltool', base, d };
  }
  return { tipo: 'ref', nombre };
}

// Velocidad (v100 = 100 mm/s, o vmax) y zona (fine o z10 = 10 mm).
function datosMovimiento(f, n) {
  let vel = null, zona = null;
  while (f.tomar(',')) {
    const t = f.sig();
    if (!t || t.k !== 'id') throw new ErrorPrograma(f.linea, 'Después de la coma va una velocidad (v100) o una zona (fine, z10).');
    const v = t.v.toLowerCase();
    let m;
    if ((m = /^v(\d+)$/.exec(v))) vel = +m[1];
    else if (v === 'vmax') vel = 1000;
    else if (v === 'fine') zona = 0;
    else if ((m = /^z(\d+)$/.exec(v))) zona = +m[1];
    else if (v === 'tool0' || v === 'wobj0') { /* aceptados por compatibilidad con RAPID */ }
    else throw new ErrorPrograma(f.linea, `«${t.v}» no es una velocidad (v50, v100, v500) ni una zona (fine, z5, z10) de ${n}.`);
  }
  if (vel !== null && (vel < 5 || vel > 1000)) throw new ErrorPrograma(f.linea, 'La velocidad va de v5 a v1000 (mm/s).');
  return { vel, zona };
}

// ---------------------------------------------------------------- instrucciones
function instruccion(t, linea) {
  const f = new Fichas(t, linea);
  const primera = f.ver();
  if (primera.k !== 'id') throw new ErrorPrograma(linea, `Una instrucción empieza con un nombre, no con «${primera.v}».`);
  const u = primera.v.toUpperCase();

  // Declaraciones: [VAR|CONST|PERS] robtarget nombre := [...]
  if (['VAR', 'CONST', 'PERS'].includes(u)) f.sig();
  const tipoDecl = f.ver()?.k === 'id' && ['ROBTARGET', 'JOINTTARGET', 'NUM', 'BOOL'].includes(f.ver().v.toUpperCase()) ? f.sig().v.toLowerCase() : null;
  if (tipoDecl) {
    const nombre = f.id('el nombre de la variable');
    if (PALABRAS.includes(nombre.toUpperCase())) throw new ErrorPrograma(linea, `«${nombre}» es una palabra reservada.`);
    if (!f.tomar(':=') && !f.tomar('=')) throw new ErrorPrograma(linea, `Falta «:=» después de ${nombre}.`);
    let valor;
    if (tipoDecl === 'robtarget' || tipoDecl === 'jointtarget') {
      f.exigir('[', `«[» con los ${tipoDecl === 'robtarget' ? 'cinco valores x, y, z, cabeceo, giro' : 'cinco ángulos'}`);
      valor = [];
      do { valor.push(expresion(f)); } while (f.tomar(','));
      f.exigir(']');
      if (valor.length !== 5) throw new ErrorPrograma(linea, tipoDecl === 'robtarget'
        ? `Un robtarget lleva 5 valores [x, y, z, cabeceo, giro]; aquí hay ${valor.length}.`
        : `Un jointtarget lleva 5 ángulos en grados; aquí hay ${valor.length}.`);
    } else valor = expresion(f);
    f.terminar();
    return { tipo: 'decl', clase: tipoDecl === 'bool' ? 'num' : tipoDecl, nombre, valor };
  }
  if (['VAR', 'CONST', 'PERS'].includes(u)) throw new ErrorPrograma(linea, `Después de ${primera.v} va el tipo: robtarget, jointtarget o num.`);

  f.sig();
  const n = primera.v;
  switch (u) {
    case 'MOVEJ': case 'MOVEL': case 'MOVEABSJ': {
      const d = destino(f);
      const m = datosMovimiento(f, n);
      f.terminar();
      return { tipo: 'move', instr: { MOVEJ: 'MoveJ', MOVEL: 'MoveL', MOVEABSJ: 'MoveAbsJ' }[u], destino: d, ...m };
    }
    case 'MOVEC': {
      const via = destino(f);
      f.exigir(',', 'una coma y el punto final (MoveC via, fin)');
      const d = destino(f);
      const m = datosMovimiento(f, n);
      f.terminar();
      return { tipo: 'move', instr: 'MoveC', via, destino: d, ...m };
    }
    case 'GRIPPEROPEN': case 'ABRIRPINZA': f.terminar(); return { tipo: 'pinza', accion: 'abrir' };
    case 'GRIPPERCLOSE': case 'CERRARPINZA': f.terminar(); return { tipo: 'pinza', accion: 'cerrar' };
    case 'GRIPPERSET': { const e = expresion(f); f.terminar(); return { tipo: 'pinza', accion: 'fijar', valor: e }; }
    case 'WAITTIME': case 'ESPERAR': { f.tomar('\\'); if (f.es('INPOS')) f.sig(); f.tomar(','); const e = expresion(f); f.terminar(); return { tipo: 'espera', expr: e }; }
    case 'SETDO': case 'RESET': case 'SET': {
      const s = f.id('una salida (do1 a do4)').toLowerCase();
      if (!/^do[1-4]$/.test(s)) throw new ErrorPrograma(linea, `Las salidas son do1, do2, do3 y do4; «${s}» no existe.`);
      let e = { num: u === 'SET' ? 1 : 0 };
      if (u === 'SETDO') { f.exigir(',', 'una coma y el valor (0 o 1)'); e = expresion(f); }
      f.terminar();
      return { tipo: 'setdo', senal: s, expr: e };
    }
    case 'WAITDI': {
      const s = f.id('una entrada (di1 a di4)').toLowerCase();
      if (!/^di[1-4]$/.test(s)) throw new ErrorPrograma(linea, `Las entradas son di1, di2, di3 y di4; «${s}» no existe.`);
      f.exigir(',', 'una coma y el valor esperado (0 o 1)');
      const e = expresion(f);
      f.terminar();
      return { tipo: 'waitdi', senal: s, expr: e };
    }
    case 'TPWRITE': {
      const partes = [expresion(f)];
      while (f.tomar(',') || f.tomar('+')) partes.push(expresion(f));
      f.terminar();
      return { tipo: 'tpwrite', partes };
    }
    case 'VELSET': { const e = expresion(f); f.tomar(','); if (!f.fin()) expresion(f); f.terminar(); return { tipo: 'velset', expr: e }; }
    case 'INCR': case 'DECR': { const v = f.id(); f.terminar(); return { tipo: u.toLowerCase(), nombre: v }; }
    case 'STOP': case 'PAUSA': f.terminar(); return { tipo: 'stop' };
    case 'FOR': {
      const v = f.id('el nombre del contador');
      f.exigir('FROM', '«FROM» (FOR i FROM 1 TO 3 DO)');
      const desde = expresion(f);
      f.exigir('TO', '«TO» (FOR i FROM 1 TO 3 DO)');
      const hasta = expresion(f);
      const paso = f.tomar('STEP') ? expresion(f) : { num: 1 };
      f.exigir('DO', '«DO» (FOR i FROM 1 TO 3 DO)');
      f.terminar();
      return { tipo: 'for', var: v, desde, hasta, paso, cuerpo: [] };
    }
    case 'WHILE': { const c = expresion(f); f.exigir('DO', '«DO» (WHILE di1 = 1 DO)'); f.terminar(); return { tipo: 'while', cond: c, cuerpo: [] }; }
    case 'IF': { const c = expresion(f); f.exigir('THEN', '«THEN» (IF i > 2 THEN)'); f.terminar(); return { tipo: 'if', ramas: [{ cond: c, cuerpo: [] }], sino: null }; }
    case 'ELSEIF': { const c = expresion(f); f.exigir('THEN', '«THEN»'); f.terminar(); return { tipo: 'elseif', cond: c }; }
    case 'ELSE': f.terminar(); return { tipo: 'else' };
    case 'ENDFOR': case 'ENDWHILE': case 'ENDIF': case 'ENDPROC': case 'ENDMODULE':
      f.terminar(); return { tipo: 'fin', de: u };
    case 'PROC': {
      const nombre = f.id('el nombre del procedimiento');
      f.exigir('(', '«()» después del nombre: PROC main()');
      f.exigir(')');
      f.terminar();
      return { tipo: 'proc', nombre, cuerpo: [] };
    }
    case 'MODULE': f.id('el nombre del módulo'); f.terminar(); return { tipo: 'modulo' };
    default: {
      if (f.tomar(':=') || f.tomar('=')) { const e = expresion(f); f.terminar(); return { tipo: 'asig', nombre: n, expr: e }; }
      f.terminar();
      return { tipo: 'llamada', nombre: n };
    }
  }
}

// ---------------------------------------------------------------- programa
// Devuelve { lineas: [{texto, nodo, nivel}], principal: [...nodos], procs: {nombre: nodo},
//            decls: [...], errores: [{linea, mensaje}] }. Las líneas se cuentan desde 1.
export function analizar(texto) {
  const crudas = texto.replace(/\r/g, '').split('\n');
  const lineas = [];
  const errores = [];
  const raiz = { tipo: 'raiz', cuerpo: [] };
  const pila = [raiz];
  const procs = {};
  const actual = () => pila[pila.length - 1];
  const destinoDe = (b) => (b.tipo === 'if' ? (b.sino ?? b.ramas[b.ramas.length - 1].cuerpo) : b.cuerpo);

  crudas.forEach((texto, k) => {
    const n = k + 1;
    const limpio = texto.trim();
    const entrada = { texto, nodo: null, nivel: pila.length - 1 };
    lineas.push(entrada);
    if (!limpio) { entrada.nodo = { tipo: 'vacio', linea: n }; return; }
    if (limpio.startsWith('!') || limpio.startsWith('#')) {
      entrada.nodo = { tipo: 'comentario', texto: limpio.slice(1).trim(), linea: n };
      return;
    }
    let nodo;
    try {
      const t = lexico(limpio, n);
      if (!t.length) { entrada.nodo = { tipo: 'vacio', linea: n }; return; }
      nodo = instruccion(t, n);
    } catch (e) {
      if (!(e instanceof ErrorPrograma)) throw e;
      errores.push({ linea: n, mensaje: e.message });
      entrada.nodo = { tipo: 'error', linea: n, mensaje: e.message };
      return;
    }
    nodo.linea = n;
    entrada.nodo = nodo;
    const bloque = actual();
    if (nodo.tipo === 'modulo') return;
    if (nodo.tipo === 'fin') {
      const esperado = { ENDFOR: 'for', ENDWHILE: 'while', ENDIF: 'if', ENDPROC: 'proc', ENDMODULE: 'raiz' }[nodo.de];
      if (nodo.de === 'ENDMODULE') return;
      if (bloque.tipo !== esperado) {
        errores.push({ linea: n, mensaje: bloque.tipo === 'raiz' ? `${nodo.de} sin su bloque de apertura.` : `Se esperaba el cierre de ${bloque.tipo.toUpperCase()} (línea ${bloque.linea}) antes de ${nodo.de}.` });
        return;
      }
      bloque.fin = n;
      pila.pop();
      entrada.nivel = pila.length - 1;
      return;
    }
    if (nodo.tipo === 'else' || nodo.tipo === 'elseif') {
      if (bloque.tipo !== 'if' || bloque.sino) { errores.push({ linea: n, mensaje: `${nodo.tipo.toUpperCase()} fuera de un IF.` }); return; }
      if (nodo.tipo === 'else') bloque.sino = [];
      else bloque.ramas.push({ cond: nodo.cond, cuerpo: [] });
      entrada.nivel = pila.length - 2;
      return;
    }
    if (nodo.tipo === 'proc') {
      if (bloque.tipo !== 'raiz') { errores.push({ linea: n, mensaje: 'Un PROC no puede ir dentro de otro bloque.' }); return; }
      if (procs[nodo.nombre.toLowerCase()]) errores.push({ linea: n, mensaje: `El procedimiento ${nodo.nombre} ya existe.` });
      procs[nodo.nombre.toLowerCase()] = nodo;
      pila.push(nodo);
      return;
    }
    destinoDe(bloque).push(nodo);
    if (['for', 'while', 'if'].includes(nodo.tipo)) pila.push(nodo);
  });
  for (let i = pila.length - 1; i > 0; i--) {
    const b = pila[i];
    errores.push({ linea: b.linea, mensaje: `Falta cerrar ${b.tipo === 'proc' ? 'ENDPROC' : 'END' + b.tipo.toUpperCase()} del bloque que empieza aquí.` });
  }
  // Con procedimientos, se ejecuta main; las líneas sueltas sólo pueden ser declaraciones.
  const decls = raiz.cuerpo.filter((x) => x.tipo === 'decl');
  let principal = raiz.cuerpo.filter((x) => x.tipo !== 'decl');
  if (Object.keys(procs).length) {
    if (!procs.main) errores.push({ linea: 1, mensaje: 'Hay procedimientos pero falta PROC main(), que es por donde empieza el programa.' });
    for (const x of principal) errores.push({ linea: x.linea, mensaje: 'Con procedimientos, las instrucciones van dentro de un PROC; fuera sólo se declaran puntos y variables.' });
    principal = procs.main ? procs.main.cuerpo : [];
  }
  return { lineas, principal, procs, decls, errores };
}

// ---------------------------------------------------------------- texto de una instrucción
const PRECEDENCIA = { OR: 1, AND: 2, NOT: 3, '=': 4, '<>': 4, '<': 4, '>': 4, '<=': 4, '>=': 4, '+': 5, '-': 5, '*': 6, '/': 6, neg: 7 };

export function exprTexto(e, padre = 0, derecha = false) {
  if (!e) return '';
  if ('num' in e) return String(Math.round(e.num * 1000) / 1000);
  if ('txt' in e) return `"${e.txt}"`;
  if ('ref' in e) return e.ref;
  if ('fn' in e) return `${e.fn}(${e.args.map((x) => exprTexto(x)).join(', ')})`;
  const p = PRECEDENCIA[e.op];
  let t;
  if (e.op === 'neg') t = `-${exprTexto(e.a, p)}`;
  else if (e.op === 'NOT') t = `NOT ${exprTexto(e.a, p)}`;
  else t = `${exprTexto(e.a, p)} ${e.op} ${exprTexto(e.b, p, true)}`;
  // Paréntesis cuando el hijo liga menos que el padre (o igual, a la derecha: 8 - (3 - 1)).
  return p < padre || (derecha && p === padre) ? `(${t})` : t;
}

export function destinoTexto(d) {
  if (d.tipo === 'ref') return d.nombre;
  if (d.tipo === 'lit') return `[${d.valores.map(exprTexto).join(', ')}]`;
  return `${d.tipo === 'offs' ? 'Offs' : 'RelTool'}(${destinoTexto(d.base)}, ${d.d.map(exprTexto).join(', ')})`;
}

export function instruccionTexto(n) {
  const md = (x) => [x.vel !== null && x.vel !== undefined ? (x.vel >= 1000 ? 'vmax' : `v${x.vel}`) : null,
    x.zona !== null && x.zona !== undefined ? (x.zona === 0 ? 'fine' : `z${x.zona}`) : null].filter(Boolean).map((s) => ', ' + s).join('');
  switch (n.tipo) {
    case 'decl': return n.clase === 'num' ? `VAR num ${n.nombre} := ${exprTexto(n.valor)};`
      : `CONST ${n.clase} ${n.nombre} := [${n.valor.map(exprTexto).join(', ')}];`;
    case 'move': return n.instr === 'MoveC' ? `MoveC ${destinoTexto(n.via)}, ${destinoTexto(n.destino)}${md(n)};` : `${n.instr} ${destinoTexto(n.destino)}${md(n)};`;
    case 'pinza': return n.accion === 'abrir' ? 'GripperOpen;' : n.accion === 'cerrar' ? 'GripperClose;' : `GripperSet ${exprTexto(n.valor)};`;
    case 'espera': return `WaitTime ${exprTexto(n.expr)};`;
    case 'setdo': return `SetDO ${n.senal}, ${exprTexto(n.expr)};`;
    case 'waitdi': return `WaitDI ${n.senal}, ${exprTexto(n.expr)};`;
    case 'tpwrite': return `TPWrite ${n.partes.map(exprTexto).join(' + ')};`;
    case 'velset': return `VelSet ${exprTexto(n.expr)};`;
    case 'incr': return `Incr ${n.nombre};`;
    case 'decr': return `Decr ${n.nombre};`;
    case 'stop': return 'Stop;';
    case 'asig': return `${n.nombre} := ${exprTexto(n.expr)};`;
    case 'llamada': return `${n.nombre};`;
    case 'for': return `FOR ${n.var} FROM ${exprTexto(n.desde)} TO ${exprTexto(n.hasta)}${n.paso.num === 1 ? '' : ` STEP ${exprTexto(n.paso)}`} DO`;
    case 'while': return `WHILE ${exprTexto(n.cond)} DO`;
    case 'if': return `IF ${exprTexto(n.ramas[0].cond)} THEN`;
    case 'proc': return `PROC ${n.nombre}()`;
    case 'comentario': return `! ${n.texto}`;
    default: return '';
  }
}

// ---------------------------------------------------------------- resaltado de sintaxis
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const MOV = /^(MoveJ|MoveL|MoveC|MoveAbsJ)$/i;
const INS = /^(GripperOpen|GripperClose|GripperSet|WaitTime|SetDO|WaitDI|TPWrite|VelSet|Incr|Decr|Stop|Set|Reset|Offs|RelTool|AbrirPinza|CerrarPinza)$/i;
const CTL = /^(FOR|FROM|TO|STEP|DO|ENDFOR|WHILE|ENDWHILE|IF|THEN|ELSEIF|ELSE|ENDIF|PROC|ENDPROC|MODULE|ENDMODULE|AND|OR|NOT|TRUE|FALSE)$/i;
const TIP = /^(VAR|CONST|PERS|robtarget|jointtarget|num|bool)$/i;
const DAT = /^(v\d+|vmax|fine|z\d+|tool0|wobj0|home|init|di[1-4]|do[1-4])$/i;

export function resaltar(linea) {
  const c = linea.search(/[!#]/);
  let codigo = c >= 0 ? linea.slice(0, c) : linea;
  const comentario = c >= 0 ? linea.slice(c) : '';
  let html = '';
  const re = /("[^"]*"?)|(\d+(?:\.\d+)?)|([A-Za-z_áéíóúñÁÉÍÓÚÑ][\wáéíóúñÁÉÍÓÚÑ]*)|(\s+)|(.)/g;
  let m;
  while ((m = re.exec(codigo))) {
    const [tok, s, num, id] = m;
    if (s) html += `<span class="s-txt">${esc(s)}</span>`;
    else if (num) html += `<span class="s-num">${num}</span>`;
    else if (id) {
      const cls = MOV.test(id) ? 's-mov' : INS.test(id) ? 's-ins' : CTL.test(id) ? 's-ctl' : TIP.test(id) ? 's-tip' : DAT.test(id) ? 's-dat' : 's-id';
      html += `<span class="${cls}">${esc(id)}</span>`;
    } else html += esc(tok);
  }
  if (comentario) html += `<span class="s-com">${esc(comentario)}</span>`;
  return html;
}
