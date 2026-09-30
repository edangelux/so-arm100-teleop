// Trabajador de la cámara de Windows: recorta, comprime y envía cada imagen
// fuera del hilo principal, para que la escena 3D no la retrase.
// Recibe {token} y {cuadro: VideoFrame}; responde {listo, lectores, ok, estado}.
const ANCHO = 640;
const ALTO = 480;
const CALIDAD = 0.8;
const lienzo = new OffscreenCanvas(ANCHO, ALTO);
const ctx = lienzo.getContext('2d', { alpha: false });
let token = null;

self.onmessage = async ({ data }) => {
  if ('token' in data) { token = data.token; return; }
  const cuadro = data.cuadro;
  let respuesta;
  try {
    const w = cuadro.displayWidth, h = cuadro.displayHeight;
    // Recorte central a 4:3 y escala a 640×480: la mano no se deforma.
    const r = ANCHO / ALTO;
    let sw = w, sh = h;
    if (w / h > r) sw = Math.round(h * r); else sh = Math.round(w / r);
    ctx.drawImage(cuadro, Math.round((w - sw) / 2), Math.round((h - sh) / 2), sw, sh, 0, 0, ANCHO, ALTO);
    cuadro.close();
    const blob = await lienzo.convertToBlob({ type: 'image/jpeg', quality: CALIDAD });
    const res = await fetch(`/api/camwin/cuadro?token=${token}`, { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: blob, signal: AbortSignal.timeout(3000) });
    respuesta = { listo: true, estado: res.status, ok: res.ok, lectores: Number(res.headers.get('X-Lectores') || 0) };
  } catch (e) {
    try { cuadro.close(); } catch { /* ya cerrado */ }
    respuesta = { listo: true, estado: 0, ok: false };
  }
  self.postMessage(respuesta);
};
