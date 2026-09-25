// Programar: escribir, verificar y ejecutar programas del robot con
// instrucciones de robot industrial (MoveJ, MoveL, MoveC...), en el robot
// virtual o en el brazo real. El programa se ve como lista de instrucciones
// (como en la consola de programación de un robot) y como texto; las dos
// vistas son el mismo programa.
import * as THREE from 'three';
import { enviar, obtener } from '../api.js';
import { el, aviso, confirmar, preguntar } from '../ui.js';
import { analizar, instruccionTexto, resaltar, INSTRUCCIONES, destinoTexto, exprTexto } from '../programa/lenguaje.js';
import { Ejecutor, Detenido, PINZA } from '../programa/ejecutor.js';
import { muestrear, GRADO } from '../programa/movimiento.js';
import { Celda } from '../programa/celda.js';
import { EJEMPLOS, NUEVO } from '../programa/ejemplos.js';

const GUARDADO = 'soarm-programa-borrador';
const VELOCIDADES = [20, 50, 80, 100, 150, 200, 300, 500, 1000];
const ZONAS = [0, 1, 5, 10, 20, 50];
const COLOR_CAMINO = { MoveJ: 0x7553ff, MoveAbsJ: 0x7553ff, MoveL: 0xc2ef4e, MoveC: 0xfd44b0 };

const r1 = (v) => Math.round(v * 10) / 10;
const leer = () => { try { return localStorage.getItem(GUARDADO); } catch { return null; } };
const escribirLocal = (t) => { try { localStorage.setItem(GUARDADO, t); } catch { /* sin almacenamiento */ } };

// Retos de la celda: cada uno comprueba dónde quedaron los cubos (mm, marco de la base).
const enBandeja = (p) => p && !p.sujeta && Math.abs(p.x - 110) < 46 && Math.abs(p.y + 200) < 46;
const cerca = (p, x, y, tol = 10) => p && !p.sujeta && Math.hypot(p.x - x, p.y - y) < tol;
const RETOS = [
  { id: 'lima', nivel: 'Fácil', titulo: 'El cubo lima a la bandeja',
    texto: 'Lleve cubo2 (lima, el del medio de la fila) a la bandeja y deje los otros dos donde están.',
    pista: 'Copie el ejemplo 2 y cambie el punto de toma a [-110, -200, 10, -90, 0].',
    cumple: (c) => enBandeja(c.cubo2) && cerca(c.cubo1, -110, -150) && cerca(c.cubo3, -110, -250) },
  { id: 'todos', nivel: 'Medio', titulo: 'Los tres a la bandeja',
    texto: 'Lleve los tres cubos a la bandeja, cada uno en un sitio distinto, con un solo programa.',
    pista: 'Un FOR con Offs sobre la fila y sobre la bandeja evita escribir tres veces lo mismo.',
    cumple: (c) => ['cubo1', 'cubo2', 'cubo3'].every((n) => enBandeja(c[n])) },
  { id: 'torre', nivel: 'Medio', titulo: 'Una torre en la bandeja',
    texto: 'Apile los tres cubos, uno encima del otro, dentro de la bandeja.',
    pista: 'Mire el ejemplo 6: cada cubo se deja 25 mm más arriba que el anterior.',
    cumple: (c) => {
      const t = ['cubo1', 'cubo2', 'cubo3'].map((n) => c[n]);
      if (!t.every(enBandeja)) return false;
      const z = t.map((p) => p.z).sort((a, b) => a - b);
      return z[2] - z[0] > 40 && Math.max(...t.map((p) => Math.hypot(p.x - t[0].x, p.y - t[0].y))) < 15;
    } },
  { id: 'inversa', nivel: 'Difícil', titulo: 'La fila al revés',
    texto: 'Deje la fila en orden inverso: cubo3 (durazno) donde estaba cubo1, y cubo1 (fucsia) donde estaba cubo3. El lima vuelve a su sitio.',
    pista: 'Hace falta un lugar libre para dejar un cubo mientras se mueve otro: la bandeja sirve.',
    cumple: (c) => cerca(c.cubo3, -110, -150) && cerca(c.cubo2, -110, -200) && cerca(c.cubo1, -110, -250) },
];
const retosHechos = () => { try { return new Set(JSON.parse(localStorage.getItem('soarm-retos') || '[]')); } catch { return new Set(); } };

const seccion = {
  id: 'programar', titulo: 'Programar el robot', corto: 'Programar', icono: 'programar',

  montar(nodo, app) {
    this.app = app;
    this.nodo = nodo;
    this.vista = 'lista';
    this.destino = 'virtual';
    this.override = 0.5;
    this.seleccion = null;
    this.lineaActual = null;
    this.corriendo = false;
    this.nombre = null;
    this.ejecutor = new Ejecutor(app.cadena, app.modelo.poses);
    this.celda = new Celda(app.escena);
    app.celda = this.celda;
    app.abrirPrograma = (id) => {
      app.mostrar('programar');
      const ej = EJEMPLOS.find((e) => e.id === id);
      if (ej) this.abrirTexto(ej.texto, null);
    };
    this.celda.alCambiarSenales = () => this.pintarSenales();
    this.camino = new THREE.Group();
    app.escena.raiz.add(this.camino);
    this.construir();
    this.fijarTexto(leer() || EJEMPLOS[1].texto, { nombre: null });
    app.on('estado', () => this.pintarDestino());
    app.on('manual', () => this.pintarPose());
  },

  alMostrar() {
    document.body.classList.add('panel-ancho');
    this.celda.mostrar(true);
    this.camino.visible = true;
    this.app.escena.vista('programa');
    this.cargarLista();
    this.pintarDestino();
    this.pintarPose();
    this.pintarCelda();
  },

  alOcultar() {
    document.body.classList.remove('panel-ancho');
    this.celda.mostrar(false);
    this.camino.visible = false;
  },

  // ------------------------------------------------------------ interfaz
  construir() {
    const app = this.app;
    const b = (texto, f, clase = '', titulo = '') => el('button', { class: `boton ${clase}`, onclick: f, title: titulo || null }, texto);

    this.selEjemplo = el('select', { class: 'campo', onchange: (e) => { const ej = EJEMPLOS.find((x) => x.id === e.target.value); if (ej) this.abrirTexto(ej.texto, null); e.target.value = ''; } },
      el('option', { value: '' }, 'Ejemplos…'), ...EJEMPLOS.map((e) => el('option', { value: e.id }, e.titulo)));
    this.selGuardados = el('select', { class: 'campo', onchange: (e) => { if (e.target.value) this.abrirGuardado(e.target.value); e.target.value = ''; } },
      el('option', { value: '' }, 'Mis programas…'));
    this.archivo = el('input', { type: 'file', accept: '.mod,.txt,.prg', class: 'oculto', onchange: (e) => this.importar(e.target.files[0]) });
    this.titulo = el('span', { class: 'nombre-programa' });

    // Ejecución
    this.segDestino = el('div', { class: 'segmentos' },
      el('button', { 'data-v': 'virtual', onclick: () => this.fijarDestino('virtual') }, 'Robot virtual'),
      el('button', { 'data-v': 'robot', onclick: () => this.fijarDestino('robot') }, 'Brazo o Gazebo'));
    this.notaDestino = el('div', { class: 'nota', style: 'margin-top:8px' });
    this.etqVel = el('span', { class: 'valor-vel' });
    this.rangoVel = el('input', { type: 'range', min: 10, max: 100, step: 10, value: 50, oninput: (e) => { this.override = e.target.value / 100; this.etqVel.textContent = `${e.target.value} %`; } });
    this.etqVel.textContent = '50 %';
    this.bVerificar = b('Verificar', () => this.verificar());
    this.bEjecutar = b('Ejecutar', () => this.ejecutar(false), 'primario');
    this.bPaso = b('Paso a paso', () => this.ejecutar(true));
    this.bSiguiente = b('Siguiente ➔', () => this.soltarPuerta(), 'primario oculto');
    this.bDetener = b('Detener', () => this.detener(), 'peligro');
    this.estado = el('div', { class: 'estado-programa' }, 'Listo.');
    this.consola = el('div', { class: 'consola consola-corta' });

    // Programa
    this.segVista = el('div', { class: 'segmentos' },
      el('button', { 'data-v': 'lista', onclick: () => this.fijarVista('lista') }, 'Instrucciones'),
      el('button', { 'data-v': 'codigo', onclick: () => this.fijarVista('codigo') }, 'Código'));
    this.lista = el('div', { class: 'lista-prog' });
    this.barraInsertar = el('div', { class: 'barra-insertar' },
      ...[['+ MoveJ', () => this.insertarMovimiento('MoveJ')], ['+ MoveL', () => this.insertarMovimiento('MoveL')], ['+ MoveC', () => this.insertarMovimiento('MoveC')],
        ['+ Abrir pinza', () => this.insertar('GripperOpen;')], ['+ Cerrar pinza', () => this.insertar('GripperClose;')],
        ['+ Esperar', () => this.insertar('WaitTime 0.5;')], ['+ Salida', () => this.insertar('SetDO do1, 1;')],
        ['+ Esperar entrada', () => this.insertar('WaitDI di1, 1;')], ['+ FOR', () => this.insertarBloque('FOR i FROM 1 TO 3 DO', 'ENDFOR')],
        ['+ IF', () => this.insertarBloque('IF di2 = 1 THEN', 'ENDIF')], ['+ Mensaje', () => this.insertar('TPWrite "Hola";')],
        ['+ Comentario', () => this.insertar('! comentario')]].map(([t, f]) => b(t, f, 'pequeno')));
    this.barraFila = el('div', { class: 'barra-fila' },
      b('Subir', () => this.moverLinea(-1), 'pequeno silencioso'), b('Bajar', () => this.moverLinea(1), 'pequeno silencioso'),
      b('Duplicar', () => this.duplicar(), 'pequeno silencioso'), b('Borrar', () => this.borrarLinea(), 'pequeno silencioso'));
    this.editorNumeros = el('div', { class: 'editor-numeros' });
    this.editorCapa = el('pre', { class: 'editor-capa', 'aria-hidden': 'true' });
    this.editor = el('textarea', { class: 'editor-texto', spellcheck: 'false', autocomplete: 'off', wrap: 'off' });
    this.editor.addEventListener('input', () => { clearTimeout(this._t); this._t = setTimeout(() => this.fijarTexto(this.editor.value, { desdeEditor: true }), 120); });
    this.editor.addEventListener('scroll', () => { this.editorCapa.scrollTop = this.editorNumeros.scrollTop = this.editor.scrollTop; this.editorCapa.scrollLeft = this.editor.scrollLeft; });
    this.editor.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') { e.preventDefault(); document.execCommand('insertText', false, '  '); }
    });
    this.editorCaja = el('div', { class: 'editor oculto' }, this.editorNumeros, el('div', { class: 'editor-zona' }, this.editorCapa, this.editor));
    this.errores = el('div');

    // Puntos
    this.listaPuntos = el('div', { class: 'lista-puntos' });

    // Mover a mano
    this.modoJog = 'cart';
    this.pasoJog = 10;
    this.segJog = el('div', { class: 'segmentos' },
      el('button', { 'data-v': 'cart', onclick: () => { this.modoJog = 'cart'; this.pintarJog(); } }, 'Cartesiano'),
      el('button', { 'data-v': 'art', onclick: () => { this.modoJog = 'art'; this.pintarJog(); } }, 'Articular'));
    this.selPaso = el('select', { class: 'campo', style: 'width:auto', onchange: (e) => { this.pasoJog = +e.target.value; } },
      ...[1, 5, 10, 20].map((v) => el('option', { value: v, selected: v === 10 }, `Paso ${v} mm o °`)));
    this.rejillaJog = el('div', { class: 'rejilla-jog' });
    this.lecturaPose = el('div', { class: 'lectura-pose' });

    // Celda
    this.listaCelda = el('div', { class: 'nota' });
    this.senalesNodo = el('div', { class: 'senales' });
    this.verCamino = el('input', { type: 'checkbox', checked: true, onchange: (e) => { this.camino.visible = e.target.checked; } });

    this.nodo.append(
      el('h2', {}, 'Programar el robot'),
      el('p', { class: 'sub' }, 'Instrucciones de robot industrial, las mismas de ABB RAPID: MoveJ, MoveL, MoveC, Offs, WaitTime, SetDO, FOR. El programa corre en el robot virtual o, con una sesión abierta y la teleoperación cerrada, en el brazo.'),
      el('div', { class: 'fila barra-archivo' }, this.selEjemplo, this.selGuardados),
      el('div', { class: 'fila barra-archivo' },
        b('Nuevo', () => this.nuevo(), 'pequeno'), b('Guardar', () => this.guardar(false), 'pequeno'),
        b('Guardar como', () => this.guardar(true), 'pequeno'), b('Exportar .mod', () => this.exportar(), 'pequeno silencioso'),
        b('Importar', () => this.archivo.click(), 'pequeno silencioso'), this.archivo),
      el('div', { class: 'tarjeta' },
        el('h3', {}, 'Ejecutar'),
        this.segDestino, this.notaDestino,
        el('div', { class: 'fila', style: 'margin-top:12px' }, el('span', { class: 'etq' }, 'Velocidad del programa'), el('span', { class: 'crece' }), this.etqVel),
        this.rangoVel,
        el('div', { class: 'fila', style: 'margin-top:10px' }, this.bVerificar, this.bEjecutar, this.bPaso, this.bSiguiente, this.bDetener),
        this.estado, this.consola),
      el('div', { class: 'tarjeta' },
        el('div', { class: 'fila', style: 'margin-bottom:12px' }, el('h3', { style: 'margin:0' }, 'Programa'), this.titulo, el('span', { class: 'crece' })),
        this.segVista, this.errores,
        el('div', { class: 'vista-lista' }, this.barraInsertar, this.lista, this.barraFila),
        this.editorCaja),
      el('div', { class: 'tarjeta' },
        el('h3', {}, 'Puntos'),
        el('p', { class: 'nota' }, 'Cada punto es una pose de la pinza: [x, y, z] en mm desde la base, cabeceo (−90° = hacia abajo, 0° = horizontal) y giro de la muñeca en grados. «Enseñar» guarda en el punto la pose actual del robot.'),
        this.listaPuntos,
        el('div', { class: 'fila', style: 'margin-top:8px' }, b('+ Punto con la pose actual', () => this.nuevoPunto(), 'pequeno'))),
      el('div', { class: 'tarjeta' },
        el('h3', {}, 'Mover a mano'),
        el('p', { class: 'nota' }, 'Mueve el robot virtual paso a paso, como el mando de una consola de programación (jog). En cartesiano la pinza se mueve en línea recta sobre los ejes de la base.'),
        el('div', { class: 'fila' }, this.segJog, this.selPaso),
        this.rejillaJog, this.lecturaPose),
      el('div', { class: 'tarjeta' },
        el('h3', {}, 'Celda de trabajo'),
        el('p', { class: 'nota' }, 'Tres cubos de 25 mm, una bandeja, un sensor de presencia (di1, el anillo bajo cubo1) y una torre de luces (do1 a do3). Si la pinza se cierra con una pieza entre los dedos, la sujeta; al abrirse, la suelta.'),
        this.listaCelda, this.senalesNodo,
        el('div', { class: 'fila', style: 'margin-top:10px' },
          b('Reiniciar la celda', () => { this.celda.reiniciar(); this.pintarCelda(); }, 'pequeno'),
          el('label', { class: 'fila etq', style: 'margin-left:auto' }, this.verCamino, 'Mostrar el camino planificado'))),
      el('div', { class: 'tarjeta' },
        el('h3', {}, 'Retos'),
        el('p', { class: 'nota' }, 'Escriba un programa que deje la celda como pide cada reto. Se comprueban solos al terminar cada ejecución en el robot virtual; «Reiniciar la celda» devuelve los cubos a su sitio.'),
        this.listaRetos = el('div', { class: 'retos' }),
        el('div', { class: 'fila', style: 'margin-top:8px' }, b('Comprobar ahora', () => this.comprobarRetos(true), 'pequeno'))),
    );
    this.pintarRetos();
    this.fijarVista('lista');
    this.fijarDestino('virtual');
    this.pintarJog();
  },

  // ------------------------------------------------------------ texto y vistas
  abrirTexto(texto, nombre) {
    if (this.corriendo) return aviso('Detenga el programa antes de abrir otro.', 'mal');
    this.fijarTexto(texto, { nombre });
    this.seleccion = null;
    this.limpiarCamino();
    this.pintarLista();
  },

  fijarTexto(texto, { desdeEditor = false, nombre } = {}) {
    this.texto = texto;
    if (nombre !== undefined) this.nombre = nombre;
    this.titulo.textContent = this.nombre ? `· ${this.nombre}` : '· sin guardar';
    escribirLocal(texto);
    this.analisis = analizar(texto);
    if (!desdeEditor && this.editor.value !== texto) this.editor.value = texto;
    this.pintarEditor();
    this.pintarLista();
    this.pintarPuntos();
    this.pintarErrores();
  },

  lineas() { return this.texto.replace(/\r/g, '').split('\n'); },

  reemplazarLineas(desde, borrar, nuevas) {
    const l = this.lineas();
    l.splice(desde - 1, borrar, ...nuevas);
    this.fijarTexto(l.join('\n'));
  },

  fijarVista(v) {
    this.vista = v;
    [...this.segVista.children].forEach((x) => x.classList.toggle('activo', x.dataset.v === v));
    this.nodo.querySelector('.vista-lista').classList.toggle('oculto', v !== 'lista');
    this.editorCaja.classList.toggle('oculto', v !== 'codigo');
    if (v === 'codigo') this.pintarEditor();
  },

  pintarErrores() {
    const errs = this.analisis.errores;
    this.errores.replaceChildren(...(errs.length ? [el('div', { class: 'mensaje mal' },
      ...errs.slice(0, 4).map((e) => el('div', {}, el('b', {}, `Línea ${e.linea}: `), e.mensaje)),
      errs.length > 4 ? el('div', {}, `y ${errs.length - 4} más.`) : null)] : []));
  },

  pintarEditor() {
    const l = this.lineas();
    const conError = new Set(this.analisis.errores.map((e) => e.linea));
    this.editorNumeros.innerHTML = l.map((_, i) => `<div class="${conError.has(i + 1) ? 'num-error' : ''}${this.lineaActual === i + 1 ? ' num-actual' : ''}">${i + 1}</div>`).join('');
    this.editorCapa.innerHTML = l.map((x, i) => `<div class="${this.lineaActual === i + 1 ? 'actual' : ''}${conError.has(i + 1) ? ' error' : ''}">${resaltar(x) || ' '}</div>`).join('') + '<div> </div>';
  },

  // La lista: una fila por instrucción, con sangría según los bloques.
  pintarLista() {
    if (!this.analisis) return;
    const filas = [];
    this.analisis.lineas.forEach((ln, i) => {
      const n = ln.nodo;
      if (!n || n.tipo === 'vacio') return;
      const numero = i + 1;
      const fila = el('div', { class: `fila-prog t-${n.tipo}${this.seleccion === numero ? ' sel' : ''}${this.lineaActual === numero ? ' actual' : ''}`,
        'data-linea': numero, style: `padding-left:${12 + ln.nivel * 18}px`, onclick: () => this.seleccionar(numero) },
      el('span', { class: 'n' }, String(numero).padStart(2, '0')), this.describir(n, ln));
      filas.push(fila);
      if (this.seleccion === numero && !this.corriendo) filas.push(this.formulario(n, ln, numero));
    });
    this.lista.replaceChildren(...filas);
    this.barraFila.classList.toggle('oculto', !this.seleccion);
  },

  describir(n, ln) {
    const d = el('span', { class: 'desc' });
    const dat = (t) => el('span', { class: 'dato' }, t);
    switch (n.tipo) {
      case 'move':
        d.append(el('b', { class: `ins-${n.instr}` }, n.instr), ' ', n.via ? `${destinoTexto(n.via)} → ${destinoTexto(n.destino)}` : destinoTexto(n.destino),
          n.vel ? dat(n.vel >= 1000 ? 'vmax' : `v${n.vel}`) : null, n.zona !== null && n.zona !== undefined ? dat(n.zona ? `z${n.zona}` : 'fine') : null);
        break;
      case 'comentario': d.append(el('i', {}, n.texto)); break;
      case 'error': d.append(el('span', { class: 'err' }, ln.texto.trim()), el('span', { class: 'err-msg' }, n.mensaje)); break;
      case 'decl': d.append(el('b', { class: 'ins-decl' }, n.clase), ' ', n.nombre, n.clase === 'num' ? ` = ${exprTexto(n.valor)}` : dat(`[${n.valor.map((e) => exprTexto(e)).join(', ')}]`)); break;
      default: {
        const t = ln.texto.trim().replace(/;$/, '');
        const m = /^(\w+)(.*)$/.exec(t);
        if (m) d.append(el('b', {}, m[1]), m[2]); else d.append(t);
      }
    }
    const ayuda = n.tipo === 'move' ? INSTRUCCIONES[n.instr] : null;
    if (ayuda) d.title = ayuda;
    return d;
  },

  seleccionar(n) {
    if (this.corriendo) return;
    this.seleccion = this.seleccion === n ? null : n;
    this.pintarLista();
  },

  // Formulario para editar la instrucción seleccionada sin escribir código.
  formulario(n, ln, numero) {
    const caja = el('div', { class: 'form-prog', style: `margin-left:${12 + ln.nivel * 18}px` });
    const aplicar = (texto) => this.reemplazarLineas(numero, 1, ['  '.repeat(ln.nivel) + texto]);
    const campo = (valor, ph = '') => el('input', { class: 'campo', value: valor, placeholder: ph });
    const sel = (opciones, actual) => el('select', { class: 'campo' }, ...opciones.map(([v, t]) => el('option', { value: v, selected: String(v) === String(actual) }, t)));
    const b = (t, f, c = '') => el('button', { class: `boton pequeno ${c}`, onclick: f }, t);
    if (n.tipo === 'move') {
      const instr = sel([['MoveJ', 'MoveJ (articular)'], ['MoveL', 'MoveL (lineal)'], ['MoveC', 'MoveC (circular)'], ['MoveAbsJ', 'MoveAbsJ (ángulos)']], n.instr);
      const via = campo(n.via ? destinoTexto(n.via) : '', 'punto intermedio');
      const dest = campo(destinoTexto(n.destino), 'p1, Offs(p1, 0, 0, 50)…');
      const vel = sel([['', 'predeterminada'], ...VELOCIDADES.map((v) => [v, v >= 1000 ? 'vmax' : `v${v} (${v} mm/s)`])], n.vel ?? '');
      const zona = sel([['', 'predeterminada (fine)'], ...ZONAS.map((z) => [z, z ? `z${z} (redondea ${z} mm)` : 'fine (se detiene)'])], n.zona ?? '');
      const componer = () => {
        const v = vel.value ? (+vel.value >= 1000 ? ', vmax' : `, v${vel.value}`) : '';
        const z = zona.value !== '' ? (+zona.value ? `, z${zona.value}` : ', fine') : '';
        return instr.value === 'MoveC' ? `MoveC ${via.value || destinoTexto(n.destino)}, ${dest.value}${v}${z};` : `${instr.value} ${dest.value}${v}${z};`;
      };
      const filaVia = el('div', { class: 'fila' }, el('span', { class: 'etq', style: 'width:80px' }, 'Vía'), via,
        n.via?.tipo === 'ref' ? b('Enseñar vía', () => this.ensenar(n.via.nombre)) : null);
      filaVia.classList.toggle('oculto', instr.value !== 'MoveC');
      instr.addEventListener('change', () => filaVia.classList.toggle('oculto', instr.value !== 'MoveC'));
      caja.append(
        el('div', { class: 'fila' }, el('span', { class: 'etq', style: 'width:80px' }, 'Tipo'), instr),
        filaVia,
        el('div', { class: 'fila' }, el('span', { class: 'etq', style: 'width:80px' }, 'Destino'), dest,
          n.destino.tipo === 'ref' ? b('Enseñar', () => this.ensenar(n.destino.nombre)) : null),
        el('div', { class: 'fila' }, el('span', { class: 'etq', style: 'width:80px' }, 'Velocidad'), vel),
        el('div', { class: 'fila' }, el('span', { class: 'etq', style: 'width:80px' }, 'Zona'), zona),
        el('div', { class: 'fila' }, el('span', { class: 'crece' }), b('Ir al destino', () => this.irA(n)), b('Aplicar', () => aplicar(componer()), 'primario')),
        el('div', { class: 'nota' }, INSTRUCCIONES[n.instr]));
      return caja;
    }
    if (n.tipo === 'espera') {
      const s = campo(exprTexto(n.expr));
      caja.append(el('div', { class: 'fila' }, el('span', { class: 'etq' }, 'Segundos'), s, b('Aplicar', () => aplicar(`WaitTime ${s.value};`), 'primario')));
      return caja;
    }
    if (n.tipo === 'setdo' || n.tipo === 'waitdi') {
      const nombres = n.tipo === 'setdo' ? ['do1', 'do2', 'do3', 'do4'] : ['di1', 'di2', 'di3', 'di4'];
      const s = sel(nombres.map((x) => [x, x]), n.senal);
      const v = sel([[1, '1 (encendida)'], [0, '0 (apagada)']], exprTexto(n.expr));
      caja.append(el('div', { class: 'fila' }, s, v, b('Aplicar', () => aplicar(`${n.tipo === 'setdo' ? 'SetDO' : 'WaitDI'} ${s.value}, ${v.value};`), 'primario')));
      return caja;
    }
    if (n.tipo === 'pinza') {
      const s = sel([['abrir', 'Abrir'], ['cerrar', 'Cerrar'], ['fijar', 'Apertura en %']], n.accion);
      const p = campo(n.valor ? exprTexto(n.valor) : '50');
      caja.append(el('div', { class: 'fila' }, s, p, b('Aplicar', () => aplicar(s.value === 'abrir' ? 'GripperOpen;' : s.value === 'cerrar' ? 'GripperClose;' : `GripperSet ${p.value};`), 'primario')));
      return caja;
    }
    // Resto: se edita la línea como texto.
    const t = campo(ln.texto.trim());
    caja.append(el('div', { class: 'fila' }, t, b('Aplicar', () => aplicar(t.value), 'primario')),
      n.tipo === 'error' ? el('div', { class: 'nota', style: 'color:var(--peligro)' }, n.mensaje) : null);
    return caja;
  },

  // ------------------------------------------------------------ edición
  // Dónde insertar: después de la fila seleccionada; si no hay, al final del
  // programa principal (antes de ENDPROC de main si hay procedimientos).
  puntoDeInsercion() {
    const a = this.analisis;
    if (this.seleccion) {
      const ln = a.lineas[this.seleccion - 1];
      const n = ln.nodo;
      const abre = ['for', 'while', 'if', 'proc'].includes(n?.tipo);
      let fin = this.seleccion;
      return { despues: fin, nivel: ln.nivel + (abre ? 1 : 0) };
    }
    if (a.procs.main?.fin) return { despues: a.procs.main.fin - 1, nivel: 1 };
    let ultima = a.lineas.length;
    while (ultima > 1 && !a.lineas[ultima - 1].texto.trim()) ultima--;
    return { despues: ultima, nivel: 0 };
  },

  insertar(texto, { seleccionar = true } = {}) {
    const { despues, nivel } = this.puntoDeInsercion();
    const lineas = (Array.isArray(texto) ? texto : [texto]).map((t) => '  '.repeat(nivel) + t);
    this.reemplazarLineas(despues + 1, 0, lineas);
    if (seleccionar) this.seleccion = despues + 1;
    this.pintarLista();
  },

  insertarBloque(cabeza, fin) {
    const { despues, nivel } = this.puntoDeInsercion();
    const s = '  '.repeat(nivel);
    this.reemplazarLineas(despues + 1, 0, [s + cabeza, s + '  ', s + fin]);
    this.seleccion = despues + 1;
    this.pintarLista();
  },

  // Un movimiento nuevo guarda la pose actual en un punto nuevo, como al
  // enseñar un punto con la consola de un robot industrial.
  insertarMovimiento(instr) {
    const nombres = new Set(this.analisis.decls.map((d) => d.nombre.toLowerCase()));
    const libre = (base) => { let i = 1; while (nombres.has(`${base}${i}`)) i++; nombres.add(`${base}${i}`); return `${base}${i}`; };
    const pose = this.poseActual();
    const decl = (nombre, p) => `CONST robtarget ${nombre} := [${p.join(', ')}];`;
    const nuevas = [];
    let instruccion;
    if (instr === 'MoveC') {
      const via = libre('p'), fin = libre('p');
      nuevas.push(decl(via, pose), decl(fin, pose));
      instruccion = `MoveC ${via}, ${fin}, v100, fine;`;
    } else {
      const p = libre('p');
      nuevas.push(decl(p, pose));
      instruccion = `${instr} ${p}, ${instr === 'MoveJ' ? 'v500' : 'v100'}, fine;`;
    }
    // Primero la instrucción (su posición depende de la selección) y luego los puntos arriba.
    this.insertar(instruccion);
    const sel = this.seleccion;
    const posDecl = this.lineaParaDeclarar();
    this.reemplazarLineas(posDecl + 1, 0, nuevas);
    this.seleccion = sel + (posDecl < sel ? nuevas.length : 0);
    this.pintarLista();
    if (instr === 'MoveC') aviso('MoveC necesita dos puntos: mueva el robot y pulse «Enseñar vía»; muévalo otra vez y pulse «Enseñar».');
  },

  // Línea tras la cual se declaran puntos nuevos: después de la última declaración o de los comentarios iniciales.
  lineaParaDeclarar() {
    const a = this.analisis;
    if (a.decls.length) return Math.max(...a.decls.map((d) => d.linea));
    let i = 0;
    while (i < a.lineas.length && ['comentario', 'vacio'].includes(a.lineas[i].nodo?.tipo)) i++;
    return i;
  },

  nuevoPunto() {
    const nombres = new Set(this.analisis.decls.map((d) => d.nombre.toLowerCase()));
    let i = 1; while (nombres.has(`p${i}`)) i++;
    const pos = this.lineaParaDeclarar();
    this.reemplazarLineas(pos + 1, 0, [`CONST robtarget p${i} := [${this.poseActual().join(', ')}];`]);
    aviso(`Punto p${i} guardado con la pose actual.`, 'ok');
  },

  moverLinea(d) {
    const n = this.seleccion;
    const l = this.lineas();
    const m = n - 1 + d;
    if (!n || m < 0 || m >= l.length) return;
    [l[n - 1], l[m]] = [l[m], l[n - 1]];
    this.seleccion = m + 1;
    this.fijarTexto(l.join('\n'));
  },

  duplicar() {
    const n = this.seleccion;
    if (!n) return;
    const l = this.lineas();
    this.reemplazarLineas(n + 1, 0, [l[n - 1]]);
    this.seleccion = n + 1;
    this.pintarLista();
  },

  borrarLinea() {
    const n = this.seleccion;
    if (!n) return;
    const nodo = this.analisis.lineas[n - 1].nodo;
    // Borrar la cabeza de un bloque borra el bloque completo.
    const fin = ['for', 'while', 'if', 'proc'].includes(nodo?.tipo) && nodo.fin ? nodo.fin : n;
    this.seleccion = null;
    this.reemplazarLineas(n, fin - n + 1, []);
  },

  // ------------------------------------------------------------ puntos
  poseActual() {
    const ps = this.app.cadena.pose(this.app.qManual);
    return [ps.p.x * 1000, ps.p.y * 1000, ps.p.z * 1000, ps.cab / GRADO, this.app.qManual[4] / GRADO].map(r1);
  },

  ensenar(nombre) {
    const d = this.analisis.decls.find((x) => x.nombre.toLowerCase() === nombre.toLowerCase());
    if (!d) return aviso(`El punto ${nombre} no está declarado.`, 'mal');
    const ln = this.analisis.lineas[d.linea - 1];
    const sangria = /^\s*/.exec(ln.texto)[0];
    const prefijo = /^\s*((VAR|CONST|PERS)\s+)?/i.exec(ln.texto)[1] || 'CONST ';
    let valores;
    if (d.clase === 'jointtarget') valores = this.app.qManual.slice(0, 5).map((v) => r1(v / GRADO));
    else valores = this.poseActual();
    const comentario = /!.*$/.exec(ln.texto)?.[0];
    this.reemplazarLineas(d.linea, 1, [`${sangria}${prefijo}${d.clase} ${d.nombre} := [${valores.join(', ')}];${comentario ? ' ' + comentario : ''}`]);
    aviso(`${d.nombre} = [${valores.join(', ')}]`, 'ok');
  },

  pintarPuntos() {
    const decls = (this.analisis?.decls || []).filter((d) => d.clase !== 'num');
    if (!decls.length) {
      this.listaPuntos.replaceChildren(el('div', { class: 'nota' }, 'El programa no declara puntos.'));
      return;
    }
    this.listaPuntos.replaceChildren(...decls.map((d) => el('div', { class: 'punto-prog' },
      el('b', {}, d.nombre), el('span', { class: 'tipo' }, d.clase === 'robtarget' ? 'pose' : 'ángulos'),
      el('span', { class: 'valores' }, `[${d.valor.map((e) => exprTexto(e)).join(', ')}]`),
      el('button', { class: 'boton pequeno silencioso', onclick: () => this.irA({ destino: { tipo: 'ref', nombre: d.nombre }, instr: 'MoveJ' }) }, 'Ir'),
      el('button', { class: 'boton pequeno', onclick: () => this.ensenar(d.nombre) }, 'Enseñar'))));
  },

  // Lleva el robot virtual al destino de una instrucción (sin ejecutar el programa).
  irA(n) {
    try {
      const ex = this.ejecutor;
      ex.g = { senales: this.celda.senales };
      ex.vars = new Map();
      for (const d of this.analisis.decls) ex.declarar(d);
      const dest = ex.destino(n.destino, n.linea);
      const q = ex.plan.articulacionesDe(dest, this.app.qManual.slice(0, 5), n.linea);
      this.app.fijarManual([...q, this.app.qManual[5]]);
    } catch (e) { aviso(e.message, 'mal'); }
  },

  // ------------------------------------------------------------ mover a mano
  pintarJog() {
    [...this.segJog.children].forEach((x) => x.classList.toggle('activo', x.dataset.v === this.modoJog));
    const b = (t, f) => {
      const x = el('button', { class: 'boton pequeno' }, t);
      let rep = null;
      const parar = () => { clearInterval(rep); rep = null; };
      x.addEventListener('pointerdown', () => { f(); rep = setInterval(f, 180); });
      x.addEventListener('pointerup', parar);
      x.addEventListener('pointerleave', parar);
      return x;
    };
    const celdas = [];
    if (this.modoJog === 'cart') {
      for (const [eje, nombre] of [['x', 'X'], ['y', 'Y'], ['z', 'Z'], ['cab', 'Cabeceo'], ['giro', 'Giro']]) {
        celdas.push(el('span', { class: 'etq' }, nombre), b('−', () => this.jogCart(eje, -1)), b('+', () => this.jogCart(eje, 1)));
      }
    } else {
      this.app.modelo.articulaciones.slice(0, 5).map((n) => this.app.modelo.juntas.find((j) => j.nombre === n)).forEach((j, i) => {
        celdas.push(el('span', { class: 'etq' }, `J${i + 1} · ${j.etiqueta}`), b('−', () => this.jogArt(i, -1)), b('+', () => this.jogArt(i, 1)));
      });
    }
    celdas.push(el('span', { class: 'etq' }, 'Pinza'),
      el('button', { class: 'boton pequeno', onclick: () => this.pinzaManual(PINZA.cerrada) }, 'Cerrar'),
      el('button', { class: 'boton pequeno', onclick: () => this.pinzaManual(PINZA.abierta) }, 'Abrir'));
    this.rejillaJog.replaceChildren(...celdas);
  },

  jogArt(i, s) {
    const q = this.app.qManual.slice();
    const j = this.app.modelo.juntas.find((x) => x.nombre === this.app.modelo.articulaciones[i]);
    q[i] = Math.max(j.limite[0], Math.min(j.limite[1], q[i] + s * this.pasoJog * GRADO));
    this.app.fijarManual(q);
  },

  jogCart(eje, s) {
    const q0 = this.app.qManual;
    const ps = this.app.cadena.pose(q0);
    const p = ps.p.clone();
    let cab = ps.cab, giro = q0[4];
    const d = this.pasoJog;
    if (eje === 'cab') cab += s * d * GRADO;
    else if (eje === 'giro') giro += s * d * GRADO;
    else p[eje] += (s * d) / 1000;
    const r = this.app.cadena.ikPose(p, cab, giro, q0.slice(0, 5));
    if (!r.alcanzado) return aviso('El robot no llega ahí con esa orientación.', 'mal');
    this.app.fijarManual([...r.q, q0[5]]);
  },

  pinzaManual(v) {
    const q = this.app.qManual.slice();
    q[5] = v;
    this.app.fijarManual(q);
    if (v === PINZA.cerrada) { if (this.celda.agarrar(this.robotVisible())) { q[5] = PINZA.conPieza; this.app.fijarManual(q); } }
    else this.celda.soltar();
    this.pintarCelda();
  },

  pintarPose() {
    if (!this.lecturaPose) return;
    const [x, y, z, cab, giro] = this.poseActual();
    this.lecturaPose.textContent = `Pinza  x ${x}  y ${y}  z ${z} mm   cabeceo ${cab}°   giro ${giro}°`;
  },

  // ------------------------------------------------------------ celda y señales
  pintarCelda() {
    this.listaCelda.replaceChildren(...this.celda.resumen().map((p) => el('div', { class: 'pieza' },
      el('b', {}, p.nombre), ` [${p.x.toFixed(0)}, ${p.y.toFixed(0)}, ${p.z.toFixed(0)}] mm`, p.sujeta ? el('span', { class: 'dato' }, 'en la pinza') : null)));
    this.pintarSenales();
  },

  pintarSenales() {
    const s = this.celda.senales;
    const entrada = (n, texto, auto) => el('button', { class: `senal ${s[n] ? 'on' : ''}`, disabled: auto, title: auto ? 'La enciende el sensor al detectar una pieza' : 'Pulse para cambiarla',
      onclick: () => { this.celda.fijarSenal(n, !s[n]); } }, el('i'), `${n} ${texto}`);
    const salida = (n, texto) => el('span', { class: `senal salida ${n} ${s[n] ? 'on' : ''}` }, el('i'), `${n} ${texto}`);
    this.senalesNodo.replaceChildren(
      el('div', { class: 'grupo-senales' }, el('span', { class: 'etq' }, 'Entradas'),
        entrada('di1', 'sensor', true), entrada('di2', 'botón'), entrada('di3', ''), entrada('di4', '')),
      el('div', { class: 'grupo-senales' }, el('span', { class: 'etq' }, 'Salidas'),
        salida('do1', 'lima'), salida('do2', 'durazno'), salida('do3', 'fucsia'), salida('do4', '')));
  },

  // ------------------------------------------------------------ retos
  pintarRetos(recien = []) {
    if (!this.listaRetos) return;
    const hechos = retosHechos();
    this.listaRetos.replaceChildren(...RETOS.map((r) => el('div', { class: `reto ${hechos.has(r.id) ? 'hecho' : ''} ${recien.includes(r.id) ? 'recien' : ''}` },
      el('span', { class: 'marca' }, hechos.has(r.id) ? 'Logrado' : r.nivel),
      el('div', {}, el('b', {}, r.titulo), el('span', {}, r.texto), el('span', { class: 'pista' }, `Pista: ${r.pista}`)))));
  },

  comprobarRetos(manual) {
    const piezas = Object.fromEntries(this.celda.resumen().map((p) => [p.nombre, p]));
    const hechos = retosHechos();
    const nuevos = RETOS.filter((r) => !hechos.has(r.id) && r.cumple(piezas)).map((r) => r.id);
    nuevos.forEach((id) => hechos.add(id));
    try { localStorage.setItem('soarm-retos', JSON.stringify([...hechos])); } catch { /* sin almacenamiento */ }
    this.pintarRetos(nuevos);
    if (nuevos.length) aviso(`Reto logrado: ${RETOS.find((r) => r.id === nuevos[0]).titulo}.`, 'ok');
    else if (manual) {
      const ahora = RETOS.filter((r) => r.cumple(piezas)).map((r) => r.titulo);
      aviso(ahora.length ? `La celda cumple: ${ahora.join(', ')}.` : 'La celda todavía no cumple ningún reto.', ahora.length ? 'ok' : '');
    }
  },

  // ------------------------------------------------------------ destino
  sesionLista() {
    const e = this.app.estado;
    return !!(e && e.ros.disponible && e.sesion.estado === 'menu' && this.app.fuenteViva());
  },

  fijarDestino(d) {
    this.destino = d;
    this.pintarDestino();
  },

  pintarDestino() {
    if (!this.segDestino) return;
    [...this.segDestino.children].forEach((x) => x.classList.toggle('activo', x.dataset.v === this.destino));
    const e = this.app.estado;
    let msg, tipo = '';
    if (this.destino === 'virtual') msg = 'Se mueve sólo el modelo 3D. Sirve para probar sin riesgo.';
    else if (this.sesionLista()) {
      const m = e.sesion.modo;
      msg = `Se moverá ${m === 'sim' ? 'el robot de Gazebo' : m === 'real' ? 'el brazo físico' : 'el brazo físico y Gazebo'}. Verifique antes y tenga a mano la fuente.`;
      tipo = 'ok';
    } else {
      msg = 'Para mover el brazo o Gazebo: en Sesión pulse Iniciar y luego «Cerrar teleoperación». Cuando el brazo quede en init, vuelva aquí.';
      tipo = 'aviso';
    }
    this.notaDestino.className = `mensaje ${tipo}`;
    this.notaDestino.textContent = msg;
  },

  robotVisible() {
    // Con una sesión en vivo, el sólido muestra el robot real; el virtual va en el fantasma.
    return this.app.fuenteViva() && this.destino === 'virtual' ? this.app.escena.fantasma : this.app.escena.robot;
  },

  // ------------------------------------------------------------ verificar y ejecutar
  mensaje(texto, clase = '') {
    this.consola.append(el('div', { class: clase }, texto));
    this.consola.scrollTop = this.consola.scrollHeight;
  },

  marcarLinea(n) {
    if (this.lineaActual === n) return;
    this.lineaActual = n;
    this.lista.querySelectorAll('.fila-prog.actual').forEach((x) => x.classList.remove('actual'));
    const f = this.lista.querySelector(`.fila-prog[data-linea="${n}"]`);
    if (f) { f.classList.add('actual'); f.scrollIntoView({ block: 'nearest' }); }
    if (this.vista === 'codigo') this.pintarEditor();
  },

  limpiarCamino() {
    this.camino.children.slice().forEach((c) => { c.geometry?.dispose(); c.removeFromParent(); });
  },

  dibujarCamino(tr, instrs) {
    // Un trazo por movimiento, con el color de su tipo.
    let ini = 0;
    for (let i = 1; i <= tr.p.length; i++) {
      if (i === tr.p.length || tr.linea[i] !== tr.linea[ini]) {
        const pts = tr.p.slice(Math.max(0, ini - 1), i);
        if (pts.length > 1) {
          const color = COLOR_CAMINO[instrs[tr.linea[ini]]] ?? 0xffffff;
          this.camino.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 })));
        }
        ini = i;
      }
    }
  },

  instrPorLinea() {
    const m = {};
    this.analisis.lineas.forEach((l, i) => { if (l.nodo?.tipo === 'move') m[i + 1] = l.nodo.instr; });
    return m;
  },

  estadoInicial() {
    const q = this.destino === 'robot' ? this.app.posturaActual() : this.app.qManual.slice();
    return { q0: q.slice(0, 5), pinza0: q[5] ?? PINZA.abierta };
  },

  async verificar({ silencioso = false } = {}) {
    if (this.corriendo) return false;
    this.consola.replaceChildren();
    this.limpiarCamino();
    const instrs = this.instrPorLinea();
    let tiempo = 0, largo = 0, movs = 0, esperas = 0;
    const avisos = new Set();
    const senales = { ...this.celda.senales };
    const { q0, pinza0 } = this.estadoInicial();
    try {
      await this.ejecutor.ejecutar(this.analisis, {
        q0, pinza0, senales,
        mover: async (tr) => { tiempo += tr.duracion; largo += tr.largo; movs++; this.dibujarCamino(tr, instrs); },
        pinza: async () => { tiempo += 0.5; },
        esperar: async (s) => { tiempo += s; },
        esperarEntrada: async (s, v) => { esperas++; if (senales[s] !== v) avisos.add(`WaitDI ${s}, ${v}: al verificar se supuso que la señal ya vale ${v}.`); senales[s] = v; },
        salida: (s, v) => { senales[s] = v; },
        escribir: (t) => this.mensaje(`TPWrite: ${t}`),
        pausa: async () => { avisos.add('Stop: al ejecutar, el programa se pausará ahí hasta pulsar Continuar.'); },
      }, { override: this.override, maxPasos: 20000 });
    } catch (e) {
      this.mensaje(`${e.linea != null ? `Línea ${e.linea}: ` : ''}${e.message}`, 'l-error');
      if (e.linea) { this.seleccion = e.linea; this.marcarLinea(null); this.pintarLista(); }
      this.estado.textContent = 'La verificación encontró un problema.';
      if (!silencioso) aviso(`${e.linea != null ? `Línea ${e.linea}: ` : ''}${e.message}`, 'mal');
      return false;
    }
    avisos.forEach((a) => this.mensaje(a, 'l-aviso'));
    this.mensaje(`OK. Tiempo de ciclo ${tiempo.toFixed(1)} s a ${Math.round(this.override * 100)} % · recorrido de la punta ${(largo * 1000).toFixed(0)} mm · ${movs} tramos.`, 'l-ok');
    this.estado.textContent = `Verificado: ${tiempo.toFixed(1)} s de ciclo.`;
    return true;
  },

  async ejecutar(pasoAPaso) {
    if (this.corriendo) return;
    if (this.analisis.errores.length) return aviso('Corrija los errores del programa antes de ejecutarlo.', 'mal');
    if (this.destino === 'robot') {
      if (!this.sesionLista()) return aviso('Para mover el brazo o Gazebo hace falta una sesión con la teleoperación cerrada (estado «en init»).', 'mal');
      if (!(await this.verificar({ silencioso: true }))) return aviso('La verificación encontró un problema; revise la consola.', 'mal');
      const m = this.app.estado.sesion.modo;
      const ok = await confirmar('Ejecutar en el robot', `El programa moverá ${m === 'sim' ? 'el robot de Gazebo' : '<b>el brazo físico</b>'} a ${Math.round(this.override * 100)} % de velocidad. Deje libre el espacio de trabajo y tenga a mano el interruptor de la fuente.`, { aceptar: 'Ejecutar' });
      if (!ok) return;
    } else {
      this.limpiarCamino();
    }
    this.corriendo = true;
    this.pasoAPaso = pasoAPaso;
    this.seleccion = null;
    this.pintarLista();
    this.consola.replaceChildren();
    this.bSiguiente.classList.toggle('oculto', !pasoAPaso);
    [this.bVerificar, this.bEjecutar, this.bPaso].forEach((x) => { x.disabled = true; });
    const robot = this.destino === 'robot';
    const instrs = this.instrPorLinea();
    const t0 = performance.now();
    this.estado.textContent = robot ? 'Ejecutando en el robot…' : 'Ejecutando en el robot virtual…';
    try {
      const { q0, pinza0 } = this.estadoInicial();
      this.qPinza = pinza0;
      await this.ejecutor.ejecutar(this.analisis, {
        q0, pinza0, senales: this.celda.senales,
        linea: (n) => this.marcarLinea(n),
        antes: async (n) => { if (this.pasoAPaso && n.tipo !== 'decl') { this.estado.textContent = `Paso a paso: línea ${n.linea}. Pulse Siguiente.`; await this.puerta(); } },
        mover: (tr) => { if (!robot) this.dibujarCamino(tr, instrs); return robot ? this.moverRobot(tr) : this.moverVirtual(tr); },
        pinza: (accion, valor) => this.accionPinza(accion, valor, robot),
        esperar: (s) => this.esperar(s),
        esperarEntrada: (s, v) => this.esperarEntrada(s, v),
        salida: (s, v) => this.celda.fijarSenal(s, v),
        escribir: (t) => this.mensaje(t),
        pausa: async () => { this.estado.textContent = 'Programa en pausa (Stop). Pulse Siguiente para continuar.'; this.bSiguiente.classList.remove('oculto'); await this.puerta(); if (!this.pasoAPaso) this.bSiguiente.classList.add('oculto'); },
        ceder: () => new Promise((r) => setTimeout(r, 0)),
      }, { override: this.override });
      this.mensaje(`Fin del programa (${((performance.now() - t0) / 1000).toFixed(1)} s).`, 'l-ok');
      this.estado.textContent = 'Programa terminado.';
      if (!robot) setTimeout(() => this.comprobarRetos(false), 900);
    } catch (e) {
      if (e instanceof Detenido) { this.mensaje('Programa detenido.', 'l-aviso'); this.estado.textContent = 'Detenido.'; }
      else {
        this.mensaje(`${e.linea != null ? `Línea ${e.linea}: ` : ''}${e.message}`, 'l-error');
        this.estado.textContent = 'Se detuvo por un error.';
        aviso(`${e.linea != null ? `Línea ${e.linea}: ` : ''}${e.message}`, 'mal');
      }
    } finally {
      this.corriendo = false;
      this.marcarLinea(null);
      this.bSiguiente.classList.add('oculto');
      [this.bVerificar, this.bEjecutar, this.bPaso].forEach((x) => { x.disabled = false; });
      this.pintarLista();
      this.pintarCelda();
      this.pintarPose();
    }
  },

  detener() {
    if (!this.corriendo) return;
    this.ejecutor.parar();
    this.soltarPuerta();
    if (this.destino === 'robot') enviar('/api/parar').catch(() => {});
  },

  puerta() { return new Promise((r) => { this._puerta = r; }); },
  soltarPuerta() { const r = this._puerta; this._puerta = null; r?.(); },

  aplicarPostura(q) {
    const q6 = [...q, this.qPinza];
    this.app.qManual = q6;
    if (this.app.fuenteViva()) this.app.escena.fijarFantasma(q6);
    else this.app.escena.fijarPostura(q6);
  },

  moverVirtual(tr) {
    return new Promise((resolver, rechazar) => {
      const t0 = performance.now();
      const paso = () => {
        if (this.ejecutor.detener) return rechazar(new Detenido());
        const t = (performance.now() - t0) / 1000;
        const m = muestrear(tr, t);
        this.aplicarPostura(m.q);
        this.marcarLinea(tr.linea[m.i]);
        if (t >= tr.duracion) { this.pintarPose(); return resolver(); }
        requestAnimationFrame(paso);
      };
      paso();
    });
  },

  async moverRobot(tr) {
    // Se envía una muestra cada 50 ms como mínimo; el controlador interpola entre ellas.
    const puntos = [];
    let ultimo = -1;
    for (let i = 1; i < tr.t.length; i++) {
      if (tr.t[i] - ultimo >= 0.05 || i === tr.t.length - 1) { puntos.push({ q: tr.q[i], t: Math.max(tr.t[i], 0.02) }); ultimo = tr.t[i]; }
    }
    await enviar('/api/trayectoria', { puntos });
    const t0 = performance.now();
    await new Promise((resolver, rechazar) => {
      const paso = () => {
        if (this.ejecutor.detener) return rechazar(new Detenido());
        const t = (performance.now() - t0) / 1000;
        const m = muestrear(tr, t);
        this.marcarLinea(tr.linea[m.i]);
        this.app.qManual = [...m.q, this.qPinza];
        if (t >= tr.duracion + 0.3) return resolver();
        requestAnimationFrame(paso);
      };
      paso();
    });
  },

  async accionPinza(accion, valor, robot) {
    const robotObj = robot ? this.app.escena.robot : this.robotVisible();
    if (robot) await enviar('/api/pinza', { valor });
    const desde = this.qPinza;
    let hasta = valor;
    if (accion === 'cerrar' || (accion === 'fijar' && valor < desde)) {
      if (this.celda.agarrar(robotObj)) { hasta = PINZA.conPieza; this.mensaje('La pinza sujetó una pieza.'); }
    } else if (this.celda.soltar()) this.mensaje('La pinza soltó la pieza.');
    const dur = robot ? 0.8 : 0.4;
    const t0 = performance.now();
    await new Promise((r) => {
      const paso = () => {
        const s = Math.min(1, (performance.now() - t0) / 1000 / dur);
        this.qPinza = desde + (hasta - desde) * s;
        if (!robot) this.aplicarPostura(this.app.qManual.slice(0, 5));
        if (s >= 1 || this.ejecutor.detener) return r();
        requestAnimationFrame(paso);
      };
      paso();
    });
    this.pintarCelda();
  },

  esperar(s) {
    return new Promise((resolver, rechazar) => {
      const fin = performance.now() + s * 1000;
      const t = setInterval(() => {
        if (this.ejecutor.detener) { clearInterval(t); rechazar(new Detenido()); } else if (performance.now() >= fin) { clearInterval(t); resolver(); }
      }, 20);
    });
  },

  esperarEntrada(s, v) {
    if (this.celda.senales[s] === v) return Promise.resolve();
    this.estado.textContent = `Esperando ${s} = ${v}${s === 'di1' ? ' (una pieza sobre el sensor)' : ' (pulse la entrada en la tarjeta Celda de trabajo)'}.`;
    return new Promise((resolver, rechazar) => {
      const t = setInterval(() => {
        if (this.ejecutor.detener) { clearInterval(t); rechazar(new Detenido()); } else if (this.celda.senales[s] === v) { clearInterval(t); resolver(); }
      }, 50);
    });
  },

  // ------------------------------------------------------------ archivos
  async cargarLista() {
    try {
      const l = await obtener('/api/programas');
      this.selGuardados.replaceChildren(el('option', { value: '' }, l.length ? 'Mis programas…' : 'Mis programas (ninguno guardado)'),
        ...l.map((p) => el('option', { value: p.nombre }, `${p.nombre} · ${p.fecha}`)));
    } catch { /* sin servidor */ }
  },

  async abrirGuardado(nombre) {
    try {
      const p = await obtener(`/api/programas/${encodeURIComponent(nombre)}`);
      this.abrirTexto(p.texto, p.nombre);
    } catch (e) { aviso(e.message, 'mal'); }
  },

  async guardar(como) {
    let nombre = this.nombre;
    if (como || !nombre) {
      nombre = await preguntar('Guardar el programa', 'Nombre (letras, números, espacios y guiones). Se guarda en ~/.local/share/soarm/programas.', nombre || 'mi_programa');
      if (!nombre) return;
    }
    try {
      const r = await enviar('/api/programas/guardar', { nombre, texto: this.texto });
      this.nombre = r.nombre;
      this.fijarTexto(this.texto);
      aviso(`Guardado en ${r.ruta}`, 'ok');
      this.cargarLista();
    } catch (e) { aviso(e.message, 'mal'); }
  },

  async nuevo() {
    if (this.texto !== NUEVO && !(await confirmar('Programa nuevo', 'Se reemplaza el programa abierto. Si no lo ha guardado, se pierde (el borrador sólo guarda el último).', { aceptar: 'Empezar uno nuevo' }))) return;
    this.abrirTexto(NUEVO, null);
  },

  exportar() {
    const a = el('a', { href: URL.createObjectURL(new Blob([this.texto], { type: 'text/plain' })), download: `${this.nombre || 'programa'}.mod` });
    document.body.append(a);
    a.click();
    a.remove();
  },

  async importar(archivo) {
    if (!archivo) return;
    const texto = await archivo.text();
    this.abrirTexto(texto, archivo.name.replace(/\.(mod|txt|prg)$/i, ''));
    this.archivo.value = '';
  },
};

export default seccion;
