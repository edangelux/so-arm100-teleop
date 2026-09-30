// Retos de la celda. Cada uno dice qué hay que lograr, cómo debe quedar la
// celda (para el dibujo) y qué falta todavía (revisar devuelve una lista de
// pendientes; vacía = logrado). Posiciones en mm del marco de la base.
import { DISPOSICION } from './celda.js';

const B = DISPOSICION.bandeja;
const enBandeja = (p) => p && !p.sujeta && Math.abs(p.x - B.x) < B.ancho / 2 - 4 && Math.abs(p.y - B.y) < B.largo / 2 - 4;
const cerca = (p, x, y, tol = 10) => p && !p.sujeta && Math.hypot(p.x - x, p.y - y) < tol;
const FILA = { cubo1: [-110, -150], cubo2: [-110, -200], cubo3: [-110, -250] };
const donde = (p) => (!p ? 'no está' : p.sujeta ? 'sigue en la pinza' : `está en [${Math.round(p.x)}, ${Math.round(p.y)}]`);

export const RETOS = [
  {
    id: 'lima', nivel: 'Fácil', titulo: 'El cubo lima a la bandeja',
    objetivo: 'Lleve cubo2 (lima, el del medio de la fila) a la bandeja. Los otros dos cubos no se tocan.',
    aprende: 'MoveJ para acercarse, MoveL para bajar y subir en recta, GripperClose y GripperOpen, y Offs para el punto de aproximación.',
    pista: 'La toma de cubo2 es [-110, -200, 10, -90, 0] y la bandeja [110, -200, 13, -90, 0]. Acérquese 60 mm por encima con Offs(punto, 0, 0, 60), baje con MoveL, cierre la pinza y suba otra vez con MoveL. El ejemplo 2 hace lo mismo con cubo1.',
    meta: [{ nombre: 'cubo1', x: -110, y: -150 }, { nombre: 'cubo2', x: 110, y: -200 }, { nombre: 'cubo3', x: -110, y: -250 }],
    revisar: (c) => [
      !enBandeja(c.cubo2) && `cubo2 (lima) no está dentro de la bandeja: ${donde(c.cubo2)}.`,
      !cerca(c.cubo1, ...FILA.cubo1) && `cubo1 (fucsia) se movió de su sitio: ${donde(c.cubo1)}.`,
      !cerca(c.cubo3, ...FILA.cubo3) && `cubo3 (durazno) se movió de su sitio: ${donde(c.cubo3)}.`,
    ].filter(Boolean),
  },
  {
    id: 'todos', nivel: 'Medio', titulo: 'Los tres a la bandeja',
    objetivo: 'Lleve los tres cubos a la bandeja, cada uno en un sitio distinto (sin apilarlos), con un solo programa.',
    aprende: 'Repetir con FOR en lugar de copiar tres veces las mismas instrucciones, y calcular puntos con Offs y una variable.',
    pista: 'En la fila los cubos están cada 50 mm en y: Offs(toma, 0, -50 * k, 0) con k = 0, 1, 2. En la bandeja cabe uno cada 30 mm en x: Offs(deja, -30 + 30 * k, 0, 0).',
    meta: [{ nombre: 'cubo1', x: 80, y: -200 }, { nombre: 'cubo2', x: 110, y: -200 }, { nombre: 'cubo3', x: 140, y: -200 }],
    revisar: (c) => {
      const f = ['cubo1', 'cubo2', 'cubo3'].filter((n) => !enBandeja(c[n])).map((n) => `${n} no está en la bandeja: ${donde(c[n])}.`);
      const t = ['cubo1', 'cubo2', 'cubo3'].map((n) => c[n]);
      if (!f.length && t.some((p) => p.z > 30)) f.push('Hay cubos apilados: deben quedar uno al lado del otro.');
      return f;
    },
  },
  {
    id: 'torre', nivel: 'Medio', titulo: 'Una torre en la bandeja',
    objetivo: 'Apile los tres cubos, uno encima del otro, dentro de la bandeja.',
    aprende: 'Cambiar la altura de destino en cada vuelta (25 mm por cubo) y acercarse a una pila sin chocarla.',
    pista: 'El primer cubo se deja en [110, -200, 13]; cada uno siguiente, 25 mm más arriba: Offs(deja, 0, 0, 25 * k). Con la pinza hacia abajo el brazo sube hasta unos 100 mm, así que la aproximación a la pila debe ser corta (35 mm). El ejemplo 6 lo hace.',
    meta: [{ nombre: 'cubo1', x: 110, y: -200, z: 12.5 }, { nombre: 'cubo2', x: 110, y: -200, z: 37.5 }, { nombre: 'cubo3', x: 110, y: -200, z: 62.5 }],
    revisar: (c) => {
      const t = ['cubo1', 'cubo2', 'cubo3'];
      const f = t.filter((n) => !enBandeja(c[n])).map((n) => `${n} no está en la bandeja: ${donde(c[n])}.`);
      if (f.length) return f;
      const p = t.map((n) => c[n]);
      const z = p.map((q) => q.z).sort((a, b) => a - b);
      if (z[2] - z[0] < 40) f.push('Los cubos están en la bandeja pero no forman una torre de tres pisos.');
      else if (Math.max(...p.map((q) => Math.hypot(q.x - p[0].x, q.y - p[0].y))) > 15) f.push('La torre quedó torcida: los cubos no están uno encima del otro.');
      return f;
    },
  },
  {
    id: 'inversa', nivel: 'Difícil', titulo: 'La fila al revés',
    objetivo: 'Deje la fila en orden inverso: cubo3 (durazno) donde estaba cubo1, y cubo1 (fucsia) donde estaba cubo3. El lima termina en su sitio.',
    aprende: 'Planificar el orden de los movimientos con un lugar de paso, como en un intercambio de variables.',
    pista: 'Hace falta un lugar libre para dejar un cubo mientras se mueve el otro: la bandeja sirve. Por ejemplo: cubo1 a la bandeja, cubo3 al sitio de cubo1, y cubo1 de la bandeja al sitio de cubo3.',
    meta: [{ nombre: 'cubo3', x: -110, y: -150 }, { nombre: 'cubo2', x: -110, y: -200 }, { nombre: 'cubo1', x: -110, y: -250 }],
    revisar: (c) => [
      !cerca(c.cubo3, ...FILA.cubo1) && `cubo3 (durazno) debe quedar en [-110, -150]: ${donde(c.cubo3)}.`,
      !cerca(c.cubo2, ...FILA.cubo2) && `cubo2 (lima) debe quedar en [-110, -200]: ${donde(c.cubo2)}.`,
      !cerca(c.cubo1, ...FILA.cubo3) && `cubo1 (fucsia) debe quedar en [-110, -250]: ${donde(c.cubo1)}.`,
    ].filter(Boolean),
  },
];

// Programa con el que empieza un reto: sólo el enunciado como comentario.
export function plantilla(r) {
  return `! Reto: ${r.titulo} (${r.nivel.toLowerCase()})
! ${r.objetivo}
! Datos de la celda y pista: botón «Ver el reto», arriba.
! Escriba aquí su programa.

`;
}

export const retosHechos = () => { try { return new Set(JSON.parse(localStorage.getItem('soarm-retos') || '[]')); } catch { return new Set(); } };
export const marcarHecho = (id) => {
  const h = retosHechos();
  h.add(id);
  try { localStorage.setItem('soarm-retos', JSON.stringify([...h])); } catch { /* sin almacenamiento */ }
};
