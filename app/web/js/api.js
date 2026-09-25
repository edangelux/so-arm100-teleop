// Comunicación con el servidor local.
export async function obtener(ruta) {
  const r = await fetch(ruta, { cache: 'no-store' });
  if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(r.status === 404 && j.error === 'Ruta desconocida.' ? VIEJO : j.error || r.statusText); }
  return r.json();
}

// Un servidor encendido antes de actualizar el repositorio no conoce las rutas nuevas.
const VIEJO = 'El servidor de la aplicación es de una versión anterior a esta página (el repositorio se actualizó con el servidor encendido). Cierre la sesión, ejecute «soarm-app --parar» en la terminal y abra otra vez con «soarm-app».';

export async function enviar(ruta, datos = {}) {
  const r = await fetch(ruta, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(r.status === 404 && j.error === 'Ruta desconocida.' ? VIEJO : j.error || r.statusText);
  return j;
}

// Eventos en vivo del servidor (articulaciones, registros, estado de la sesión).
export function escuchar(manejadores) {
  let fuente;
  const abrir = () => {
    fuente = new EventSource('/api/eventos');
    for (const [evento, f] of Object.entries(manejadores)) fuente.addEventListener(evento, (e) => f(JSON.parse(e.data)));
    fuente.onerror = () => { manejadores.desconectado?.(); fuente.close(); setTimeout(abrir, 2000); };
  };
  abrir();
}
