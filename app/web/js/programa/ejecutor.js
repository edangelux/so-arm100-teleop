// Intérprete de los programas: recorre el árbol que produce lenguaje.js,
// evalúa variables y expresiones, agrupa los movimientos que se encadenan con
// zonas y los entrega al planificador. Lo que pasa «afuera» (mover el modelo o
// el brazo, la pinza, esperar, escribir) lo hacen los ganchos que recibe, de
// modo que el mismo intérprete sirve para verificar, simular y ejecutar.
import { ErrorPrograma } from './lenguaje.js';
import { GRADO, Planificador, ErrorMovimiento, marcoHerramienta } from './movimiento.js';

export const PINZA = { abierta: 1.2, cerrada: -0.1, conPieza: 0.25 };   // rad de la articulación Gripper
export const pinzaDesdePorcentaje = (pct) => -0.1 + (Math.max(0, Math.min(100, pct)) / 100) * 1.5;

class Detenido extends Error {}

const FUNCIONES = {
  abs: Math.abs, sqrt: Math.sqrt, round: (x, n = 0) => Math.round(x * 10 ** n) / 10 ** n, trunc: Math.trunc,
  sin: (x) => Math.sin(x * GRADO), cos: (x) => Math.cos(x * GRADO), tan: (x) => Math.tan(x * GRADO),
  min: Math.min, max: Math.max,
};

export class Ejecutor {
  constructor(cadena, poses) {
    this.cadena = cadena;
    this.poses = poses;
    this.plan = new Planificador(cadena);
    this.detener = false;
  }

  // ganchos: { q0, pinza0, senales, mover(tr), pinza(accion, valor), esperar(s), esperarEntrada(s, v),
  //            salida(s, v), escribir(texto), linea(n), pausa(), antes(nodo) }
  async ejecutar(analisis, ganchos, { override = 1, maxPasos = Infinity } = {}) {
    if (analisis.errores.length) throw new ErrorPrograma(analisis.errores[0].linea, analisis.errores[0].mensaje);
    this.g = ganchos;
    this.a = analisis;
    this.override = override;
    this.velset = 1;
    this.q = ganchos.q0.slice(0, 5);
    this.pinza = ganchos.pinza0 ?? PINZA.abierta;
    this.vars = new Map();
    this.pendientes = [];
    this.pasos = 0;
    this.maxPasos = maxPasos;
    this.detener = false;
    this.profundidad = 0;
    for (const d of analisis.decls) this.declarar(d);
    await this.bloque(analisis.principal);
    await this.vaciar();
    return { q: this.q };
  }

  parar() { this.detener = true; }

  // ------------------------------------------------------------ valores
  declarar(d) {
    const clave = d.nombre.toLowerCase();
    if (d.clase === 'num') this.vars.set(clave, { clase: 'num', valor: this.valor(d.valor, d.linea) });
    else this.vars.set(clave, { clase: d.clase, valor: d.valor.map((e) => this.valor(e, d.linea)), linea: d.linea });
  }

  valor(e, linea) {
    if ('num' in e) return e.num;
    if ('txt' in e) return e.txt;
    if ('ref' in e) {
      const k = e.ref.toLowerCase();
      if (k in this.g.senales) return this.g.senales[k];
      if (k === 'pi') return Math.PI;
      const v = this.vars.get(k);
      if (!v) throw new ErrorPrograma(linea, `«${e.ref}» no existe: declárelo antes (VAR num ${e.ref} := 0;).`);
      if (v.clase !== 'num') throw new ErrorPrograma(linea, `«${e.ref}» es un punto, no un número.`);
      return v.valor;
    }
    if ('fn' in e) {
      const f = FUNCIONES[e.fn.toLowerCase()];
      if (!f) throw new ErrorPrograma(linea, `La función ${e.fn} no existe. Hay: Abs, Sqrt, Round, Trunc, Sin, Cos, Tan, Min, Max.`);
      return f(...e.args.map((x) => this.valor(x, linea)));
    }
    const a = () => this.valor(e.a, linea), b = () => this.valor(e.b, linea);
    switch (e.op) {
      case 'neg': return -a();
      case 'NOT': return a() ? 0 : 1;
      case 'AND': return a() && b() ? 1 : 0;
      case 'OR': return a() || b() ? 1 : 0;
      case '+': { const x = a(), y = b(); return typeof x === 'string' || typeof y === 'string' ? `${x}${y}` : x + y; }
      case '-': return a() - b();
      case '*': return a() * b();
      case '/': { const y = b(); if (y === 0) throw new ErrorPrograma(linea, 'División entre cero.'); return a() / y; }
      case '=': return Math.abs(a() - b()) < 1e-9 ? 1 : 0;
      case '<>': return Math.abs(a() - b()) >= 1e-9 ? 1 : 0;
      case '<': return a() < b() ? 1 : 0;
      case '>': return a() > b() ? 1 : 0;
      case '<=': return a() <= b() ? 1 : 0;
      case '>=': return a() >= b() ? 1 : 0;
      default: throw new ErrorPrograma(linea, 'Expresión no válida.');
    }
  }

  // Destino → { tipo: 'cart', p: [mm], cab, giro (grados) } o { tipo: 'art', q: [grados] }.
  destino(d, linea) {
    if (d.tipo === 'lit') {
      const v = d.valores.map((e) => this.valor(e, linea));
      if (v.length !== 5) throw new ErrorPrograma(linea, 'Un punto escrito entre corchetes lleva 5 valores: [x, y, z, cabeceo, giro].');
      return { tipo: 'cart', p: v.slice(0, 3), cab: v[3], giro: v[4] };
    }
    if (d.tipo === 'ref') {
      const k = d.nombre.toLowerCase();
      if (k === 'home' || k === 'init') {
        if (!this.vars.has(k)) return { tipo: 'art', q: this.poses[k].map((r) => r / GRADO) };
      }
      const v = this.vars.get(k);
      if (!v) throw new ErrorPrograma(linea, `El punto «${d.nombre}» no existe. Declárelo arriba: CONST robtarget ${d.nombre} := [x, y, z, cabeceo, giro];`);
      if (v.clase === 'robtarget') return { tipo: 'cart', p: v.valor.slice(0, 3), cab: v.valor[3], giro: v.valor[4] };
      if (v.clase === 'jointtarget') return { tipo: 'art', q: v.valor.slice() };
      throw new ErrorPrograma(linea, `«${d.nombre}» es un número, no un punto.`);
    }
    let base = this.destino(d.base, linea);
    if (base.tipo === 'art') {
      const ps = this.cadena.pose(base.q.map((x) => x * GRADO));
      base = { tipo: 'cart', p: ps.p.toArray().map((x) => x * 1000), cab: ps.cab / GRADO, giro: base.q[4] };
    }
    const [dx, dy, dz] = d.d.map((e) => this.valor(e, linea));
    if (d.tipo === 'offs') return { ...base, p: [base.p[0] + dx, base.p[1] + dy, base.p[2] + dz] };
    const m = marcoHerramienta({ x: base.p[0] / 1000, y: base.p[1] / 1000 }, base.cab * GRADO, base.giro * GRADO);
    const p = base.p.map((v, i) => v + dx * m.x.getComponent(i) + dy * m.y.getComponent(i) + dz * m.z.getComponent(i));
    return { ...base, p };
  }

  // ------------------------------------------------------------ ejecución
  async bloque(nodos) {
    for (const n of nodos) {
      if (this.detener) throw new Detenido();
      await this.sentencia(n);
    }
  }

  async sentencia(n) {
    if (++this.pasos > this.maxPasos) throw new ErrorPrograma(n.linea, 'El programa no termina (¿un WHILE que nunca se cumple?). Se detuvo la verificación.');
    const mov = n.tipo === 'move';
    if (!mov && !['decl', 'asig', 'incr', 'decr', 'comentario', 'vacio'].includes(n.tipo)) await this.vaciar();
    if (!['comentario', 'vacio'].includes(n.tipo)) {
      this.g.linea?.(n.linea);
      if (this.g.antes) await this.g.antes(n);
      if (this.detener) throw new Detenido();
    }
    switch (n.tipo) {
      case 'decl': return this.declarar(n);
      case 'asig': {
        const k = n.nombre.toLowerCase();
        const v = this.vars.get(k);
        if (!v) throw new ErrorPrograma(n.linea, `«${n.nombre}» no existe: declárelo con VAR num ${n.nombre} := 0;`);
        if (v.clase !== 'num') throw new ErrorPrograma(n.linea, `A «${n.nombre}» no se le puede asignar un número.`);
        v.valor = this.valor(n.expr, n.linea);
        return;
      }
      case 'incr': case 'decr': {
        const v = this.vars.get(n.nombre.toLowerCase());
        if (!v || v.clase !== 'num') throw new ErrorPrograma(n.linea, `«${n.nombre}» no es una variable numérica.`);
        v.valor += n.tipo === 'incr' ? 1 : -1;
        return;
      }
      case 'move': {
        const m = {
          instr: n.instr, linea: n.linea,
          destino: this.destino(n.destino, n.linea),
          via: n.via ? this.destino(n.via, n.linea) : null,
          vel: n.vel ?? (n.instr === 'MoveJ' || n.instr === 'MoveAbsJ' ? 500 : 100),
          zona: n.zona ?? 0,
        };
        if (n.instr === 'MoveAbsJ' && m.destino.tipo !== 'art') throw new ErrorPrograma(n.linea, 'MoveAbsJ va a un jointtarget (ángulos), no a un robtarget.');
        m.vel *= this.velset;
        this.pendientes.push(m);
        if (!(m.zona > 0) || this.pendientes.length >= 40) await this.vaciar();
        return;
      }
      case 'pinza': {
        const valor = n.accion === 'abrir' ? PINZA.abierta : n.accion === 'cerrar' ? PINZA.cerrada : pinzaDesdePorcentaje(this.valor(n.valor, n.linea));
        this.pinza = valor;
        await this.g.pinza(n.accion, valor);
        return;
      }
      case 'espera': {
        const s = this.valor(n.expr, n.linea);
        if (!(s >= 0)) throw new ErrorPrograma(n.linea, 'WaitTime lleva un tiempo en segundos, mayor o igual a 0.');
        await this.g.esperar(s);
        return;
      }
      case 'setdo': this.g.salida(n.senal, this.valor(n.expr, n.linea) ? 1 : 0); return;
      case 'waitdi': await this.g.esperarEntrada(n.senal, this.valor(n.expr, n.linea) ? 1 : 0); return;
      case 'tpwrite': this.g.escribir(n.partes.map((e) => { const v = this.valor(e, n.linea); return typeof v === 'number' ? String(Math.round(v * 1000) / 1000) : v; }).join('')); return;
      case 'velset': {
        const p = this.valor(n.expr, n.linea);
        if (!(p > 0 && p <= 100)) throw new ErrorPrograma(n.linea, 'VelSet va de 1 a 100 (por ciento).');
        this.velset = p / 100;
        return;
      }
      case 'stop': await this.g.pausa(); return;
      case 'for': {
        const k = n.var.toLowerCase();
        const desde = this.valor(n.desde, n.linea), hasta = this.valor(n.hasta, n.linea), paso = this.valor(n.paso, n.linea);
        if (!paso) throw new ErrorPrograma(n.linea, 'STEP no puede ser 0.');
        const previo = this.vars.get(k);
        for (let i = desde; paso > 0 ? i <= hasta + 1e-9 : i >= hasta - 1e-9; i += paso) {
          this.vars.set(k, { clase: 'num', valor: i });
          await this.bloque(n.cuerpo);
        }
        if (previo) this.vars.set(k, previo); else this.vars.delete(k);
        return;
      }
      case 'while':
        while (this.valor(n.cond, n.linea)) {
          await this.bloque(n.cuerpo);
          await this.g.ceder?.();
        }
        return;
      case 'if': {
        for (const r of n.ramas) if (this.valor(r.cond, n.linea)) return this.bloque(r.cuerpo);
        if (n.sino) return this.bloque(n.sino);
        return;
      }
      case 'llamada': {
        const p = this.a.procs[n.nombre.toLowerCase()];
        if (!p) throw new ErrorPrograma(n.linea, `No existe la instrucción ni el procedimiento «${n.nombre}».`);
        if (++this.profundidad > 20) throw new ErrorPrograma(n.linea, 'Demasiadas llamadas anidadas (¿un procedimiento que se llama a sí mismo?).');
        await this.bloque(p.cuerpo);
        this.profundidad--;
        return;
      }
      default:
    }
  }

  // Planifica y ejecuta los movimientos acumulados.
  async vaciar() {
    if (!this.pendientes.length) return;
    const movs = this.pendientes;
    this.pendientes = [];
    let tr;
    try {
      tr = this.plan.planificar(movs, this.q, this.override);
    } catch (e) {
      if (e instanceof ErrorMovimiento) throw new ErrorPrograma(e.linea, e.message);
      throw e;
    }
    await this.g.mover(tr);
    this.q = tr.q[tr.q.length - 1].slice();
  }
}

export { Detenido };
