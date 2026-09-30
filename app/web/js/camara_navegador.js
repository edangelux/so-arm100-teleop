// Cámara de Windows abierta por el navegador (WSL2).
//
// Ubuntu en WSL2 no ve las cámaras de Windows, pero el navegador sí: abre la
// integrada, una USB o la OBS Virtual Camera de forma nativa con getUserMedia
// (http://127.0.0.1 cuenta como origen seguro). Aquí se toma cada imagen, se
// recorta al centro a 640×480 (4:3, sin deformar la mano), se comprime a JPEG
// y se envía al servidor, que la publica como MJPEG en /camara/video para la
// teleoperación.
//
// Ritmo: una imagen en vuelo como máximo y siempre la más reciente, así el
// retraso no se acumula. Sin lectores en el servidor (X-Lectores: 0) se envía
// una imagen por segundo; con la teleoperación leyendo, todas las de la cámara.
// Se usa MediaStreamTrackProcessor cuando existe, que sigue entregando imágenes
// con la ventana minimizada, y un trabajador (camara_trabajador.js) que recorta,
// comprime y envía fuera del hilo de la escena 3D; si no, un <video> con
// requestVideoFrameCallback en el hilo principal.
import { enviar } from './api.js';

const ANCHO = 640;
const ALTO = 480;
const CALIDAD = 0.8;
const PAUSA_SIN_LECTORES = 1000;   // ms entre imágenes cuando nadie lee el video

class CamaraNavegador {
  constructor() {
    this.stream = null;
    this.id = null;
    this.nombre = '';
    this.token = null;
    this.enviadas = 0;
    this.error = '';
    this._lectores = 0;
    this._enVuelo = false;
    this._ultimoEnvio = 0;
    this._marcas = [];
    this._oyentes = new Set();
    this._lienzo = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(ANCHO, ALTO) : Object.assign(document.createElement('canvas'), { width: ANCHO, height: ALTO });
    this._ctx = this._lienzo.getContext('2d', { alpha: false });
    this._vuelta = 0;
  }

  get activa() { return !!this.stream && !!this.token; }
  get fps() { const t = performance.now(); this._marcas = this._marcas.filter((m) => t - m < 2000); return this._marcas.length / 2; }
  al(f) { this._oyentes.add(f); return () => this._oyentes.delete(f); }
  _avisar() { this._oyentes.forEach((f) => { try { f(this); } catch { /* nada */ } }); }

  // Pide permiso una vez y devuelve las cámaras con su nombre real.
  async listar() {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Este navegador no permite abrir cámaras. Abra la aplicación en Edge o Chrome de Windows: http://127.0.0.1:8642');
    let dispositivos = await navigator.mediaDevices.enumerateDevices();
    if (!dispositivos.some((d) => d.kind === 'videoinput' && d.label)) {
      // Los nombres sólo aparecen después de conceder el permiso.
      const s = await navigator.mediaDevices.getUserMedia({ video: true }).catch((e) => { throw new Error(textoError(e)); });
      s.getTracks().forEach((t) => t.stop());
      dispositivos = await navigator.mediaDevices.enumerateDevices();
    }
    return dispositivos.filter((d) => d.kind === 'videoinput').map((d, i) => ({
      id: d.deviceId, nombre: d.label || `Cámara ${i + 1}`,
      clase: /obs|virtual|droidcam|snap|manycam|xsplit/i.test(d.label) ? 'virtual' : 'fisica',
    }));
  }

  // Abre la cámara y empieza a enviarla. Devuelve cuando el servidor aceptó la primera imagen.
  // Las aperturas van de una en una: la de la página al cargar y la del usuario no se pisan.
  abrir(id, nombre = '') {
    if (this._abriendo && this._abriendoId === id) return this._abriendo;
    const previa = this._abriendo || Promise.resolve();
    this._abriendoId = id;
    const p = previa.catch(() => {}).then(() => (this.activa && this.id === id ? this : this._abrir(id, nombre)));
    this._abriendo = p;
    p.finally(() => { if (this._abriendo === p) { this._abriendo = null; this._abriendoId = null; } }).catch(() => {});
    return p;
  }

  async _abrir(id, nombre) {
    this.cerrar(false);
    this.error = '';
    const restr = { width: { ideal: ANCHO }, height: { ideal: ALTO }, frameRate: { ideal: 30 } };
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: id ? { deviceId: { exact: id }, ...restr } : restr, audio: false });
    } catch (e) {
      this.stream = null;
      throw new Error(textoError(e), { cause: e });
    }
    const pista = this.stream.getVideoTracks()[0];
    this.id = pista.getSettings().deviceId || id;
    this.nombre = pista.label || nombre;
    pista.addEventListener('ended', () => { this.error = 'La cámara se desconectó o la tomó otro programa.'; this.cerrar(); });
    this.token = (await enviar('/api/camwin/emisor', { nombre: this.nombre })).token;
    const vuelta = ++this._vuelta;
    this._bucle(pista, vuelta);
    // Espera la primera imagen aceptada (hasta 8 s).
    const limite = performance.now() + 8000;
    while (this.enviadas === 0 && performance.now() < limite && vuelta === this._vuelta && !this.error) await pausa(100);
    if (this.enviadas === 0) {
      const motivo = this.error || 'La cámara abrió pero no entregó imágenes. Si es OBS, pulse «Iniciar cámara virtual» en OBS.';
      this.cerrar();
      throw new Error(motivo);
    }
    this._avisar();
    return this;
  }

  cerrar(avisarServidor = true) {
    this._vuelta++;
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
    if (avisarServidor && this.token) enviar('/api/camwin/detener', { token: this.token }).catch(() => {});
    this.stream = null;
    this.token = null;
    this.enviadas = 0;
    this._enVuelo = false;
    this._avisar();
  }

  async _bucle(pista, vuelta) {
    if (typeof MediaStreamTrackProcessor !== 'undefined' && typeof OffscreenCanvas !== 'undefined') {
      // Lee imágenes aunque la ventana esté minimizada. El recorte, el JPEG y el envío
      // van en un trabajador aparte; aquí sólo se decide qué imagen pasa.
      const trabajador = this._trabajador ||= new Worker(new URL('./camara_trabajador.js', import.meta.url), { type: 'module' });
      const token = this.token;
      trabajador.postMessage({ token });
      trabajador.onmessage = ({ data }) => { this._enVuelo = false; this._resultado(token, data.estado, data.ok, data.lectores); };
      const lector = new MediaStreamTrackProcessor({ track: pista }).readable.getReader();
      try {
        while (vuelta === this._vuelta) {
          const { value: cuadro, done } = await lector.read();
          if (done) break;
          if (this._toca()) {
            this._enVuelo = true;
            this._ultimoEnvio = performance.now();
            trabajador.postMessage({ cuadro }, [cuadro]);
          } else cuadro.close();
        }
      } catch { /* la pista terminó */ }
      lector.releaseLock?.();
      return;
    }
    const video = Object.assign(document.createElement('video'), { muted: true, playsInline: true, srcObject: this.stream });
    await video.play().catch(() => {});
    const paso = () => {
      if (vuelta !== this._vuelta) { video.srcObject = null; return; }
      if (this._toca() && video.videoWidth) this._enviar(video, video.videoWidth, video.videoHeight);
      if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(paso); else setTimeout(paso, 33);
    };
    paso();
  }

  _toca() {
    if (this._enVuelo || !this.token) return false;
    return this._lectores > 0 || performance.now() - this._ultimoEnvio >= PAUSA_SIN_LECTORES;
  }

  _enviar(fuente, w, h) {
    // Recorte central a 4:3 y escala a 640×480.
    const r = ANCHO / ALTO;
    let sw = w, sh = h;
    if (w / h > r) sw = Math.round(h * r); else sh = Math.round(w / r);
    this._ctx.drawImage(fuente, Math.round((w - sw) / 2), Math.round((h - sh) / 2), sw, sh, 0, 0, ANCHO, ALTO);
    this._enVuelo = true;
    this._ultimoEnvio = performance.now();
    const token = this.token;
    const blob = this._lienzo.convertToBlob
      ? this._lienzo.convertToBlob({ type: 'image/jpeg', quality: CALIDAD })
      : new Promise((ok) => this._lienzo.toBlob(ok, 'image/jpeg', CALIDAD));
    blob.then((b) => fetch(`/api/camwin/cuadro?token=${token}`, { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: b }))
      .then((r) => this._resultado(token, r.status, r.ok, Number(r.headers.get('X-Lectores') || 0)))
      .catch(() => { /* servidor reiniciándose: se reintenta con la próxima imagen */ })
      .finally(() => { this._enVuelo = false; });
  }

  _resultado(token, estado, ok, lectores) {
    if (token !== this.token) return;
    if (estado === 410) { this.error = 'Otra ventana de la aplicación tomó la cámara.'; this.cerrar(false); return; }
    if (ok) {
      this._lectores = lectores || 0;
      this.enviadas++;
      this._marcas.push(performance.now());
    }
  }
}

function pausa(ms) { return new Promise((r) => setTimeout(r, ms)); }

function textoError(e) {
  const n = e?.name || '';
  if (n === 'NotAllowedError') return 'El navegador no tiene permiso para la cámara. Pulse el candado junto a la dirección (127.0.0.1:8642) → Cámara → Permitir, y vuelva a intentar.';
  if (n === 'NotReadableError' || n === 'AbortError') return 'Windows no dejó abrir la cámara: la está usando otro programa (Zoom, Teams, OBS con esa misma cámara, la app Cámara). Ciérrelo y vuelva a intentar.';
  if (n === 'NotFoundError' || n === 'OverconstrainedError') return 'No se encontró esa cámara. Pulse «Buscar cámaras» otra vez.';
  return `No se pudo abrir la cámara: ${e?.message || n || e}`;
}

export const camaraNavegador = new CamaraNavegador();
