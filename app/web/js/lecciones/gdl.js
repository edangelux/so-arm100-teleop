// Lección 1: ¿qué es un robot manipulador? Eslabones, articulaciones y grados de libertad.
import * as THREE from 'three';
import { el, grados } from '../ui.js';
import { COLORES } from '../escena.js';

const BRAZO = ['Shoulder_Rotation', 'Shoulder_Pitch', 'Elbow', 'Wrist_Pitch', 'Wrist_Roll'];
const NOMBRE = { Shoulder_Rotation: 'Giro de la base', Shoulder_Pitch: 'Hombro', Elbow: 'Codo', Wrist_Pitch: 'Flexión de muñeca', Wrist_Roll: 'Giro de muñeca', Gripper: 'Pinza' };
const POSE = [0.35, 0.35, -0.55, 0.45, 0, 0.5];

function animar(f) {
  let vivo = true;
  const t0 = performance.now();
  const paso = () => { if (!vivo) return; f((performance.now() - t0) / 1000); requestAnimationFrame(paso); };
  paso();
  return () => { vivo = false; };
}

function mini(app, q, alCambiar) {
  // Cinco deslizadores compactos que mueven el robot virtual.
  const cont = el('div', { style: 'display:grid;grid-template-columns:auto 1fr;gap:4px 10px;align-items:center;margin-top:6px' });
  BRAZO.forEach((n, i) => {
    const j = app.modelo.juntas.find((x) => x.nombre === n);
    const r = el('input', { type: 'range', min: j.limite[0], max: j.limite[1], step: 0.01, value: q[i] });
    r.addEventListener('input', () => { q[i] = +r.value; app.escena.fijarPostura(q); alCambiar?.(); });
    r.addEventListener('pointerenter', () => app.escena.resaltar(n));
    r.addEventListener('pointerleave', () => app.escena.resaltar(null));
    cont.append(el('span', { style: 'font-size:12.5px;display:flex;align-items:center;gap:6px' },
      el('i', { style: `width:9px;height:9px;border-radius:3px;background:${COLORES[n]};display:inline-block` }), NOMBRE[n]), r);
  });
  return cont;
}

const BRAZO_HUMANO = `
<svg viewBox="0 0 460 190" class="figura" xmlns="http://www.w3.org/2000/svg" font-family="inherit">
  <text x="115" y="22" fill="#ffffff" font-size="14" text-anchor="middle" font-weight="700">Su brazo · 7 GDL</text>
  <circle cx="40" cy="95" r="15" fill="none" stroke="#bdb8c0" stroke-width="2"/>
  <path d="M40 110 V170" stroke="#bdb8c0" stroke-width="2"/>
  <path d="M40 118 L100 118 L160 90 L200 78" stroke="#ffffff" stroke-width="7" stroke-linecap="round" fill="none"/>
  <circle cx="45" cy="118" r="9" fill="#fd44b0"/><text x="45" y="148" fill="#fd44b0" font-size="11" text-anchor="middle">Hombro 3</text>
  <circle cx="100" cy="118" r="8" fill="#ffb287"/><text x="100" y="148" fill="#ffb287" font-size="11" text-anchor="middle">Codo 1</text>
  <circle cx="130" cy="104" r="6" fill="#79628c"/><text x="130" y="76" fill="#bdb8c0" font-size="11" text-anchor="middle">Antebrazo 1</text>
  <circle cx="160" cy="90" r="8" fill="#7553ff"/><text x="178" y="120" fill="#7553ff" font-size="11" text-anchor="middle">Muñeca 2</text>
  <line x1="230" y1="30" x2="230" y2="175" stroke="#362d59"/>
  <text x="345" y="22" fill="#ffffff" font-size="14" text-anchor="middle" font-weight="700">SO-ARM100 · 5 GDL</text>
  <rect x="265" y="160" width="60" height="10" rx="3" fill="#efefef"/>
  <path d="M295 160 L295 120 L330 80 L385 80 L420 70" stroke="#efefef" stroke-width="7" stroke-linecap="round" fill="none"/>
  <circle cx="295" cy="160" r="7" fill="#fd44b0"/><text x="265" y="185" fill="#fd44b0" font-size="11">Base 1</text>
  <circle cx="295" cy="120" r="7" fill="#c2ef4e"/><text x="270" y="112" fill="#c2ef4e" font-size="11" text-anchor="end">Hombro 1</text>
  <circle cx="330" cy="80" r="7" fill="#ffb287"/><text x="330" y="66" fill="#ffb287" font-size="11" text-anchor="middle">Codo 1</text>
  <circle cx="385" cy="80" r="7" fill="#7553ff"/><text x="390" y="110" fill="#7553ff" font-size="11" text-anchor="middle">Muñeca 2</text>
</svg>`;

export default {
  titulo: 'Grados de libertad',
  resumen: 'Qué es un robot manipulador, qué es una articulación y por qué este brazo tiene 5 grados de libertad.',
  conceptos: [
    ['Eslabón', 'Cada pieza rígida del brazo. No se deforma: sólo se mueve con la articulación que la sostiene.'],
    ['Articulación', 'La unión entre dos eslabones que permite un movimiento. Aquí todas giran, como una bisagra.'],
    ['Grado de libertad (GDL)', 'Cada movimiento independiente. El número de GDL es cuántos números hacen falta para describir la postura completa.'],
    ['Efector final', 'Lo que el robot usa para trabajar: aquí, la pinza. Su posición es lo que casi siempre interesa.'],
    ['Espacio articular', 'Describir la postura con los ángulos de cada articulación (5 números).'],
  ],
  pasos: [
    {
      titulo: 'Un robot es una cadena',
      texto: 'Piezas rígidas (<b>eslabones</b>) unidas por <b>articulaciones</b>, desde la base hasta la <b>pinza</b>. Mire cómo se ilumina cada una.',
      preparar(app) {
        app.escena.verEtiquetas(true);
        app.escena.fijarPostura(POSE);
        const orden = [...BRAZO, 'Gripper'];
        return animar((t) => app.escena.resaltar(orden[Math.floor(t / 0.9) % orden.length]));
      },
    },
    {
      titulo: 'Una articulación, un movimiento',
      texto: 'El <b>codo</b> sólo puede girar alrededor de su eje (la flecha). Basta <b>un número</b>, su ángulo, para saber dónde está: aporta <b>1 grado de libertad</b>.',
      preparar(app, cuerpo) {
        app.escena.verEtiquetas(false);
        app.escena.resaltar('Elbow');
        const lectura = el('div', { class: 'contador' }, '0°');
        cuerpo.append(lectura);
        const q = POSE.slice();
        return animar((t) => {
          q[2] = -0.55 + 0.6 * Math.sin(t * 1.4);
          app.escena.fijarPostura(q);
          app.escena.resaltar('Elbow');
          lectura.textContent = `Codo: ${grados(q[2]).toFixed(0)}°`;
        });
      },
    },
    {
      titulo: 'Encuentre las articulaciones',
      texto: 'Haga clic en cada pieza del robot para descubrir qué articulación la mueve. ¿Cuántas mueven el <b>brazo</b>?',
      reto: true,
      preparar(app, cuerpo, listo) {
        app.escena.fijarPostura(POSE);
        const halladas = new Set();
        const cont = el('div', { class: 'contador' }, '0 / 5');
        const chips = el('div', { class: 'fila', style: 'flex-wrap:wrap;gap:6px;margin-top:8px' });
        cuerpo.append(cont, chips);
        app.escena.alClicArticulacion = (n) => {
          if (!n || n === 'base_link_joint') return;
          app.escena.resaltar(n);
          if (halladas.has(n)) return;
          halladas.add(n);
          chips.append(el('span', { class: 'chip', style: `border-color:${COLORES[n]};color:${COLORES[n]}` }, NOMBRE[n]));
          const brazo = [...halladas].filter((x) => BRAZO.includes(x)).length;
          cont.textContent = `${brazo} / 5`;
          if (n === 'Gripper') chips.append(el('span', { class: 'nota' }, ' La pinza también gira, pero no mueve el brazo: es la herramienta.'));
          if (brazo === 5) { cont.textContent = '¡5 GDL!'; listo(); }
        };
        return () => { app.escena.alClicArticulacion = null; };
      },
    },
    {
      titulo: 'Cinco números, una postura',
      texto: 'Cada deslizador cambia <b>una sola</b> articulación. Con estos 5 números queda definida toda la postura del brazo: eso es tener <b>5 GDL</b>.',
      preparar(app, cuerpo) {
        const q = POSE.slice();
        app.escena.fijarPostura(q);
        const pos = el('div', { class: 'nota', style: 'font-family:var(--mono);margin-top:6px' });
        const leer = () => { const p = app.cadena.efector(q); pos.textContent = `Pinza en x ${(p.x * 1000).toFixed(0)}  y ${(p.y * 1000).toFixed(0)}  z ${(p.z * 1000).toFixed(0)} mm`; };
        cuerpo.append(mini(app, q, leer), pos);
        leer();
      },
    },
    {
      titulo: 'Su brazo tiene 7',
      texto: 'Su brazo tiene <b>7 GDL</b>; el robot, <b>5</b>. Por eso la teleoperación no puede copiar todas sus posturas: al robot le faltan dos movimientos.',
      preparar(app, cuerpo) {
        cuerpo.append(el('div', { html: BRAZO_HUMANO }));
        app.escena.fijarPostura(POSE);
      },
    },
    {
      titulo: 'Reto: toque la esfera',
      texto: 'Mueva las articulaciones hasta que la pinza toque la <b>esfera lima</b> (a menos de 15 mm).',
      reto: true,
      preparar(app, cuerpo, listo) {
        const qMeta = [0.7, 0.45, -0.35, -0.3, 0];
        const meta = app.cadena.efector(qMeta);
        const esfera = new THREE.Mesh(new THREE.SphereGeometry(0.015, 32, 16),
          new THREE.MeshStandardMaterial({ color: 0xc2ef4e, emissive: 0x4a5c14, transparent: true, opacity: 0.85 }));
        esfera.position.copy(meta);
        app.escena.extras.add(esfera);
        const q = [0, 0, 0, 0, 0, 0];
        app.escena.fijarPostura(q);
        const d = el('div', { class: 'contador' }, '— mm');
        let hecho = false;
        const medir = () => {
          const dist = app.cadena.efector(q).distanceTo(meta) * 1000;
          d.textContent = `${dist.toFixed(0)} mm`;
          if (dist < 15 && !hecho) { hecho = true; d.textContent = '¡Lo logró!'; esfera.material.color.set(0xfa7faa); listo(); }
        };
        cuerpo.append(d, mini(app, q, medir));
        medir();
        return () => app.escena.extras.remove(esfera);
      },
    },
  ],
};
