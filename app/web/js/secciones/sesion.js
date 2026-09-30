// Sesión: arrancar y cerrar la teleoperación, elegir la cámara y el modo.
import { obtener, enviar } from '../api.js';
import { el, aviso, confirmar, linea } from '../ui.js';

const MODOS = [
  ['auto', 'Auto', 'Brazo conectado → ambos; si no, simulación.'],
  ['sim', 'Simulación', 'Sólo el gemelo digital en Gazebo.'],
  ['real', 'Brazo', 'Sólo el brazo físico, sin Gazebo.'],
  ['ambos', 'Ambos', 'Gazebo y brazo físico siguen el mismo gesto.'],
];
const VERSIONES = [
  ['13', 'v13', 'La versión presentada en la defensa.'],
  ['14', 'v14', 'Arranca y reanuda desde la postura medida del brazo.'],
  ['15', 'v15', 'v14 + confianza, ganancia por referencia y giro de muñeca 3D.'],
];
const ESTADOS = {
  detenida: ['Listo para empezar', 'Elija el modo y la cámara y pulse Iniciar.', 'sesion'],
  arrancando: ['Arrancando…', 'Gazebo, el controlador y los espejos tardan unos segundos.', 'refrescar'],
  teleop: ['Teleoperando', 'Muévase frente a la cámara. C calibra, P pausa y Q cierra (en la ventana de la cámara).', 'robot'],
  moviendo: ['Llevando el brazo a init…', 'Movimiento lento y seguro al cerrar la teleoperación.', 'casa'],
  menu: ['Teleoperación cerrada', 'El brazo está en init y sostenido. Puede reabrir, moverlo desde «Mover», ejecutar ensayos o apagar.', 'casa'],
  cerrando: ['Cerrando la sesión…', 'Se detienen todos los procesos.', 'stop'],
};

const seccion = {
  id: 'sesion', titulo: 'Sesión y teleoperación', corto: 'Sesión', icono: 'sesion',
  eleccion: { modo: 'auto', version: '14', moveit: true, velocidad: '', camara: null, tipoCam: 'telefono' },

  montar(nodo, app) {
    this.app = app;
    this.nodo = nodo;
    this.estadoNodo = el('div');
    this.acciones = el('div', { class: 'col' });
    this.consola = el('div', { class: 'consola' });
    this.camNodo = el('div');
    this.formNodo = el('div');
    nodo.append(
      el('h2', {}, 'Sesión'),
      el('p', { class: 'sub' }, 'Arranca la teleoperación, la simulación y MoveIt sin abrir la terminal.'),
      this.estadoNodo, this.acciones, this.formNodo, this.camNodo,
      el('div', { class: 'tarjeta' }, el('h3', { html: `Registro` }), this.consola),
    );
    app.on('estado', (e) => this.actualizar(e));
    app.on('log', (d) => this.agregarLinea(d));
    this._cargado = false;
  },

  agregarLinea(d) {
    const pref = d.fuente === 'tarea' ? `[${d.nombre}] ` : '';
    this.consola.append(linea(pref + d.linea));
    while (this.consola.childElementCount > 600) this.consola.firstChild.remove();
    this.consola.scrollTop = this.consola.scrollHeight;
  },

  actualizar(e) {
    const s = e.sesion;
    if (!this._cargado) {
      const c = e.conf;
      Object.assign(this.eleccion, { version: c.SOARM_VERSION || '14', moveit: c.SOARM_MOVEIT !== '0', velocidad: c.SOARM_VELOCIDAD || '',
        camara: c.SOARM_CAM, tipoCam: (c.SOARM_CAM || '').includes('/camara/video') ? 'windows' : (c.SOARM_CAM || '').startsWith('http') ? 'telefono'
          : (c.SOARM_CAM_TIPO || '').includes('virtual') ? 'virtual' : e.entorno === 'wsl' ? 'windows' : 'local' });
      for (const l of s.log) this.agregarLinea({ fuente: 'sesion', linea: l });
      this._cargado = true;
      this.pintarFormulario();
      this.pintarCamara();
    }
    if (this._ultimoEstado === s.estado && this._ultimaTarea === e.tarea.activa) return;
    this._ultimoEstado = s.estado;
    this._ultimaTarea = e.tarea.activa;
    const [t, d] = ESTADOS[s.estado] || [s.estado, '', 'info'];
    this.estadoNodo.replaceChildren(el('div', { class: 'estado-grande' },
      el('div', {}, el('strong', {}, t + (s.modo && s.estado !== 'detenida' ? ` · ${s.modo}` : '')), el('span', {}, d))));
    this.pintarAcciones(s, e);
    const libre = s.estado === 'detenida';
    this.formNodo.classList.toggle('oculto', !libre);
    this.camNodo.classList.toggle('oculto', !libre);
  },

  pintarAcciones(s, e) {
    const b = (clase, icono, texto, f, extra = {}) => el('button', { class: `boton ${clase}`, html: texto, onclick: f, ...extra });
    const acc = [];
    if (s.estado === 'detenida') {
      acc.push(b('primario grande ancho', 'play', 'Iniciar', () => this.iniciar()));
      acc.push(el('div', { class: 'fila' },
        b('crece', 'enchufe', 'Conectar', () => this.conectar()),
        b('crece', 'casa', 'Centrar', () => this.tarea('centrar', 'Centrar servos', 'Los seis servos irán despacio a 2048 pasos (la postura init). Sostenga el brazo.')),
        b('', 'buscar', 'Servos', () => this.tarea('servos'), { title: 'Lista posición, carga y temperatura de cada servo' })));
    } else {
      if (s.estado === 'teleop') acc.push(b('ancho', 'stop', 'Cerrar teleoperación (Q)', () => this.post('/api/sesion/cerrar-teleop')));
      if (s.estado === 'menu') {
        acc.push(b('primario ancho', 'play', 'Reabrir teleoperación', () => this.menu('reabrir')));
        acc.push(el('div', { class: 'fila' },
          b('exito crece', 'casa', 'Home y apagar', () => this.menu('home')),
          b('crece', 'stop', 'Apagar', async () => {
            if (await confirmar('Apagar sin mover', 'El brazo perderá el par en la postura en que esté y puede caer. <b>Sosténgalo.</b>', { aceptar: 'Apagar', peligro: true })) this.menu('apagar');
          })));
      }
      acc.push(b('peligro ancho', 'alerta', 'Parada inmediata', async () => {
        if (await confirmar('Parada inmediata', 'Equivale a Ctrl+C: apaga todo en el acto <b>sin mover el brazo</b>. Si no está en home, caerá al perder el par. La parada de emergencia física sigue siendo el interruptor de la fuente.', { aceptar: 'Detener ya', peligro: true })) this.post('/api/sesion/detener');
      }));
    }
    if (e.tarea.activa) acc.push(el('div', { class: 'mensaje aviso' }, `Ejecutando: ${e.tarea.nombre}…`));
    this.acciones.replaceChildren(...acc);
  },

  segmentos(opciones, valor, alElegir) {
    const cont = el('div', { class: 'segmentos' });
    for (const [v, t, ayuda] of opciones) {
      cont.append(el('button', { class: v === valor ? 'activo' : '', title: ayuda, onclick: () => { alElegir(v); } }, t));
    }
    return cont;
  },

  pintarFormulario() {
    const e = this.eleccion;
    const redibujar = () => this.pintarFormulario();
    const ayudaModo = MODOS.find((m) => m[0] === e.modo)[2];
    const ayudaVer = VERSIONES.find((m) => m[0] === e.version)[2];
    this.formNodo.replaceChildren(el('div', { class: 'tarjeta' },
      el('h3', { html: `Qué se opera` }),
      this.segmentos(MODOS, e.modo, (v) => { e.modo = v; redibujar(); }),
      el('p', { class: 'nota' }, ayudaModo),
      el('div', { class: 'etq' }, 'Versión de la teleoperación'),
      this.segmentos(VERSIONES, e.version, (v) => { e.version = v; redibujar(); }),
      el('p', { class: 'nota' }, ayudaVer),
      el('div', { class: 'fila' },
        el('label', { class: 'fila crece', style: 'gap:8px;cursor:pointer' },
          el('input', { type: 'checkbox', checked: e.moveit, onchange: (ev) => { e.moveit = ev.target.checked; } }), 'Abrir MoveIt y RViz'),
        el('select', { class: 'campo', style: 'width:auto', title: 'Tope de velocidad articular', onchange: (ev) => { e.velocidad = ev.target.value; } },
          ...[['', 'Velocidad 8 rad/s'], ['2', '2 rad/s'], ['1', '1 rad/s'], ['0.5', '0.5 rad/s (primera vez)']]
            .map(([v, t]) => el('option', { value: v, selected: v === e.velocidad }, t)))),
    ));
  },

  async pintarCamara() {
    const e = this.eleccion;
    const conf = this.app.estado?.conf || {};
    clearInterval(this._fotoTimer);
    const wsl = this.app.estado?.entorno === 'wsl';
    // En WSL2 Ubuntu no ve las cámaras de Windows: la opción recomendada es «Cámara de Windows»,
    // que las envía a la aplicación (integrada, USB u OBS Virtual Camera) sin usbipd.
    const tipos = wsl ? [
      ['windows', 'camara', 'Cámara de Windows', 'Integrada del portátil, webcam USB u OBS Virtual Camera'],
      ['telefono', 'telefono', 'Teléfono por Wi-Fi', 'DroidCam o IP Webcam, con su IP'],
      ['local', 'camara', 'USB pasada a Ubuntu', 'Con usbipd (avanzado)'],
    ] : [
      ['local', 'camara', 'Integrada o USB', 'La cámara del portátil o una webcam'],
      ['virtual', 'virtual', 'Virtual', 'OBS, cliente de DroidCam para Linux'],
      ['telefono', 'telefono', 'Teléfono por Wi-Fi', 'DroidCam o IP Webcam, con su IP'],
    ];
    if (!tipos.some((t) => t[0] === e.tipoCam)) e.tipoCam = tipos[0][0];
    const opciones = el('div', { class: 'opciones' }, ...tipos.map(([id, i, t, d]) =>
      el('button', { class: `opcion ${e.tipoCam === id ? 'activa' : ''}`, onclick: () => { e.tipoCam = id; this.pintarCamara(); } },
        el('div', {}, el('strong', {}, t), el('span', {}, d)))));
    const detalle = el('div', { style: 'margin-top:12px' });
    this.msgCam = el('div');
    if (e.tipoCam === 'windows') {
      this.pintarCamaraWindows(detalle);
    } else if (e.tipoCam === 'telefono') {
      const ip = el('input', { class: 'campo', placeholder: 'IP que muestra la app, p. ej. 192.168.1.38', value: conf.SOARM_CAM_IP || '' });
      const encontrados = el('div', { class: 'opciones', style: 'margin-top:8px' });
      detalle.append(
        el('div', { class: 'etq' }, 'La IP cambia con la red, por eso se pide cada vez.'),
        el('div', { class: 'fila' }, ip,
          el('button', { class: 'boton primario', html: `Probar`, onclick: () => this.probarCamara({ ip: ip.value }) })),
        el('button', { class: 'boton ancho', style: 'margin-top:8px', html: `Buscar el teléfono en la red`, onclick: async (ev) => {
          ev.target.disabled = true;
          this.mensajeCam('aviso', 'Buscando teléfonos con DroidCam o IP Webcam… (unos segundos)');
          try {
            const r = await enviar('/api/camaras/buscar');
            encontrados.replaceChildren(...r.encontrados.map((t) => el('button', { class: 'opcion', onclick: () => { ip.value = `${t.ip}${t.puerto === 4747 ? '' : ':' + t.puerto}`; this.probarCamara({ ip: ip.value }); } },
              el('div', {}, el('strong', {}, `${t.ip}:${t.puerto}`), el('span', {}, `${t.app} · ${t.estado === 'libre' ? 'libre' : 'ocupado por otro cliente'}`)))));
            this.mensajeCam(r.encontrados.length ? 'ok' : 'mal', r.encontrados.length ? `Se encontraron ${r.encontrados.length}. Toque uno para usarlo.`
              : `No se encontró ningún teléfono en ${r.subredes.map((s) => s + '.x').join(', ') || 'la red'}. Compruebe que la app esté abierta y en la misma Wi-Fi.`);
          } catch (err) { this.mensajeCam('mal', err.message); }
          ev.target.disabled = false;
        } }),
        encontrados);
    } else {
      let lista = [];
      try { lista = (await obtener('/api/camaras')).locales.filter((c) => c.clase === (e.tipoCam === 'virtual' ? 'virtual' : 'fisica')); } catch { /* sin servidor */ }
      if (!lista.length) {
        const ayuda = { wsl: 'En WSL2 las cámaras USB, incluida la integrada, se pasan desde Windows con usbipd. Un teléfono por Wi-Fi no lo necesita.',
          vm: 'Conecte la cámara a la máquina virtual desde su menú Dispositivos → Cámaras web o USB.', nativo: 'Revise que esté conectada y que ninguna otra aplicación la use.' }[this.app.estado?.entorno];
        detalle.append(el('div', { class: 'mensaje aviso' }, `No se encontró ninguna cámara ${e.tipoCam === 'virtual' ? 'virtual' : 'integrada ni USB'}. ${ayuda || ''}`),
          el('button', { class: 'boton ancho', style: 'margin-top:8px', html: `Buscar de nuevo`, onclick: () => this.pintarCamara() }));
      } else {
        detalle.append(el('div', { class: 'opciones' }, ...lista.map((c) =>
          el('button', { class: `opcion ${String(e.camara) === String(c.indice) ? 'activa' : ''}`, onclick: () => this.probarCamara({ dev: c.dev, tipo: e.tipoCam }) },
            el('div', {}, el('strong', {}, c.nombre), el('span', {}, c.dev))))));
      }
    }
    const nombreCam = String(e.camara || '').includes('/camara/video') ? `Windows · ${conf.SOARM_CAM_WIN_NOMBRE || 'cámara ' + (conf.SOARM_CAM_WIN || 0)}`
      : String(e.camara).startsWith('http') ? e.camara : '/dev/video' + e.camara;
    this.camActual = el('p', { class: 'nota' }, e.camara ? `Cámara elegida: ${nombreCam}` : '');
    this.camNodo.replaceChildren(el('div', { class: 'tarjeta' }, el('h3', { html: `Cámara` }), opciones, detalle, this.msgCam, this.camActual));
  },

  pintarCamaraWindows(detalle) {
    const e = this.eleccion;
    const lista = el('div', { class: 'opciones', style: 'margin-top:8px' });
    const foto = el('img', { class: 'foto-camara oculto', alt: 'Vista de la cámara' });
    foto.onerror = () => {       // la cámara de Windows dejó de enviar (se apaga sola tras un minuto sin uso)
      clearInterval(this._fotoTimer);
      foto.classList.add('oculto');
      this.mensajeCam('aviso', 'La cámara de Windows está apagada. Se abre sola al iniciar la sesión; para verla ahora, búsquela y tóquela.');
    };
    const verFoto = () => {
      foto.classList.remove('oculto');
      clearInterval(this._fotoTimer);
      this._fotoTimer = setInterval(() => { if (document.body.contains(foto)) foto.src = `/camara/foto?t=${Date.now()}`; else clearInterval(this._fotoTimer); }, 700);
    };
    const preparar = el('button', { class: 'boton ancho oculto', style: 'margin-top:8px', html: 'Preparar Windows (instala OpenCV y pygrabber, una sola vez)', onclick: async () => {
      try { await enviar('/api/camwin/preparar'); this.mensajeCam('aviso', 'Instalando OpenCV y pygrabber en el Python de Windows (unos minutos). El avance aparece en el Registro, abajo. Al terminar, pulse «Buscar cámaras de Windows».'); } catch (err) { this.mensajeCam('mal', err.message); }
    } });
    const buscar = el('button', { class: 'boton primario ancho', html: 'Buscar cámaras de Windows', onclick: async (ev) => {
      ev.target.disabled = true;
      this.mensajeCam('aviso', 'Buscando las cámaras de Windows… (unos segundos; la luz de la cámara puede encenderse)');
      try {
        const r = await obtener('/api/camwin/listar');
        preparar.classList.toggle('oculto', r.falta !== 'opencv' && !r.sin_nombres);
        if (!r.ok) this.mensajeCam('mal', r.mensaje);
        else if (!r.camaras.length) this.mensajeCam('mal', 'Windows no encontró ninguna cámara. Si es OBS, pulse «Iniciar cámara virtual» en OBS y busque de nuevo. Cierre Zoom, Teams o el navegador si usan la cámara.');
        else {
          const activa = (c) => String(conf().SOARM_CAM_WIN) === String(c.indice) && String(e.camara).includes('/camara/video');
          lista.replaceChildren(...r.camaras.map((c) => el('button', { class: `opcion opcion-camara ${activa(c) ? 'activa' : ''}`, onclick: (ev) => this.usarCamaraWindows(c, verFoto, ev.currentTarget) },
            c.miniatura ? el('img', { class: 'mini-camara', alt: '', src: `data:image/jpeg;base64,${c.miniatura}` }) : el('div', { class: 'mini-camara vacia' }, 'sin imagen'),
            el('div', {}, el('strong', {}, c.nombre), el('span', {}, `${c.clase === 'virtual' ? 'Virtual' : 'Física'} · ${c.entrega ? `entrega ${c.ancho}×${c.alto}` : 'no entregó imagen: la usa otro programa o, si es OBS, falta «Iniciar cámara virtual»'}`)))));
          this.mensajeCam('ok', `Windows tiene ${r.camaras.length} cámara(s). Reconózcala por la miniatura y tóquela.`
            + (r.sin_nombres ? ' (Para ver sus nombres, pulse «Preparar Windows» una vez.)' : ''));
        }
      } catch (err) { this.mensajeCam('mal', err.message); }
      ev.target.disabled = false;
    } });
    const conf = () => this.app.estado?.conf || {};
    detalle.append(
      el('p', { class: 'nota' }, 'Ubuntu (WSL2) no ve las cámaras de Windows. La aplicación abre la cámara en Windows y la recibe aquí. Para OBS: en OBS pulse «Iniciar cámara virtual» antes de buscar.'),
      buscar, preparar, lista, foto);
    if (String(e.camara || '').includes('/camara/video')) {
      obtener('/api/camaras').then((r) => { if (r.camwin?.activa) verFoto(); }).catch(() => {});
    }
  },

  async usarCamaraWindows(c, verFoto, boton) {
    this.mensajeCam('aviso', `Abriendo «${c.nombre}» en Windows…`);
    try {
      const r = await enviar('/api/camwin/usar', { indice: c.indice, nombre: c.nombre });
      if (r.ok) {
        this.eleccion.camara = r.camara;
        this.mensajeCam('ok', r.mensaje);
        verFoto();
        this.camActual.textContent = `Cámara elegida: Windows · ${c.nombre}`;
        boton?.parentNode?.querySelectorAll('.opcion-camara').forEach((b) => b.classList.toggle('activa', b === boton));
        this.app.refrescar();
      }
      else this.mensajeCam('mal', r.mensaje);
    } catch (err) { this.mensajeCam('mal', err.message); }
  },

  mensajeCam(tipo, texto) { this.msgCam.replaceChildren(el('div', { class: `mensaje ${tipo}` }, texto)); },

  async probarCamara(datos) {
    this.mensajeCam('aviso', 'Probando la cámara…');
    try {
      const r = await enviar('/api/camaras/probar', datos);
      if (r.ok) { this.eleccion.camara = r.camara; this.pintarCamara().then(() => this.mensajeCam('ok', r.mensaje)); } else this.mensajeCam('mal', r.mensaje);
    } catch (err) { this.mensajeCam('mal', err.message); }
  },

  async iniciar() {
    const e = this.eleccion;
    if (!e.camara) { aviso('Elija y pruebe una cámara primero.', 'mal'); return; }
    if (e.modo !== 'sim' && e.version === '13' && !await confirmar('Versión 13 con el brazo',
      'La v13 arranca ordenando cero a todas las articulaciones. Centre antes los servos (botón «Centrar servos») y sostenga el brazo la primera vez.', { aceptar: 'Ya está centrado' })) return;
    try {
      const r = await enviar('/api/sesion/iniciar', { modo: e.modo, version: e.version, moveit: e.moveit, velocidad: e.velocidad, camara: e.camara });
      aviso(`Arrancando en modo ${r.modo}.`, 'ok');
      this.app.refrescar();
    } catch (err) { aviso(err.message, 'mal'); }
  },

  async menu(accion) { await this.post('/api/sesion/menu', { accion }); },

  async post(ruta, datos) {
    try { await enviar(ruta, datos); this.app.refrescar(); } catch (err) { aviso(err.message, 'mal'); }
  },

  async conectar() {
    try {
      const r = await enviar('/api/brazo/conectar');
      aviso(r.mensaje, r.ok ? 'ok' : 'mal');
      this.app.refrescar();
    } catch (err) { aviso(err.message, 'mal'); }
  },

  async tarea(nombre, titulo, texto) {
    if (titulo && !await confirmar(titulo, texto)) return;
    this.post('/api/tarea', { nombre });
  },
};
export default seccion;
