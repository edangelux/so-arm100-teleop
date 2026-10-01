// Escenas 1 a 6: gancho, problema, solución, el robot, cómo funciona y la matemática.
// Cada escena dura 8 compases (16 s) y recibe tl, el tiempo dentro de ella.
import katex from '/app/web/vendor/katex/katex.mjs';
import {
  el, palabras, animarPalabras, opacidad, mover, teclear, imagen, Secuencia, numero,
  prog, ventana, mix, suave, salida3, salidaExpo, entradaSalida, golpe, clamp,
} from './motor.js';
import { orbita } from './plato3d.js';

const FOTOS = '../recursos/fotos';
const CLIPS = '../salida/clips';
export const INIT = [0, 0, 0, 0, 0, 0];
export const HOME = [0, -1.4, 1.4, 1.0, 1.5708, 0];
const lerpQ = (a, b, s) => a.map((v, i) => mix(v, b[i], s));
const tex = (f, grande = false) => katex.renderToString(f, { displayMode: grande, throwOnError: false });

function etiqueta(texto, x = 120, y = 110) {
  return el('div', { class: 'etiqueta abs', style: { left: `${x}px`, top: `${y}px` } }, texto);
}

// Un pequeño temblor de postura para que el brazo nunca quede muerto en pantalla.
export const respirar = (q, t, a = 1) => q.map((v, i) => v + a * 0.035 * Math.sin(t * (0.7 + i * 0.23) + i));

// ======================================================================= 1
export const intro = {
  nombre: 'Gancho',
  montar(r) {
    this.linea = el('div', { class: 'abs', style: { left: '960px', top: '539px', height: '2px', width: '0px', background: 'var(--lima)', boxShadow: '0 0 24px var(--lima)' } });
    this.lugar = el('div', { class: 'abs mono', style: { left: '0', width: '1920px', textAlign: 'center', top: '480px', fontSize: '24px', letterSpacing: '.35em', color: 'var(--tenue)' } });
    this.chips = ['5 grados de libertad', '6 servos STS3215', '1 cámara web'].map((t) => el('div', { class: 'pastilla' }, t));
    this.filaChips = el('div', { class: 'abs', style: { left: '120px', top: '940px', display: 'flex', gap: '18px' } }, ...this.chips);
    this.pregunta = palabras('¿Y si un robot<br>pudiera <b>copiar</b><br><b>tu brazo?</b>', 'titulo abs');
    Object.assign(this.pregunta.style, { left: '120px', top: '300px', fontSize: '128px' });
    this.marca = palabras('SO-ARM100', 'titulo abs');
    Object.assign(this.marca.style, { left: '112px', top: '380px', fontSize: '200px', letterSpacing: '-.04em' });
    this.sub = palabras('Teleoperación por <b>visión artificial</b>', 'texto abs');
    Object.assign(this.sub.style, { left: '120px', top: '590px', fontSize: '52px' });
    this.sub2 = el('div', { class: 'abs mono tenue', style: { left: '120px', top: '680px', fontSize: '26px', letterSpacing: '.08em' } },
      'Manipulador de 5 GDL · código abierto · ULSA 2026');
    r.append(this.linea, this.lugar, this.filaChips, this.pregunta, this.marca, this.sub, this.sub2);
  },
  cuadro(tl, t) {
    const w = salidaExpo(prog(tl, 0.15, 1.4)) * 1500 * (1 - prog(tl, 2.2, 2.8));
    Object.assign(this.linea.style, { width: `${w}px`, left: `${960 - w / 2}px` });
    opacidad(this.lugar, ventana(tl, 0.5, 0.7, 2.2, 2.6));
    teclear(this.lugar, 'ULSA · LEÓN, NICARAGUA · 2026', tl, 0.6, 0.03, false);
    this.chips.forEach((c, i) => {
      const s = salida3(prog(tl, 4 + i * 0.5, 4.5 + i * 0.5));
      mover(c, { y: (1 - s) * 30, o: s * (1 - prog(tl, 11, 11.5)) });
    });
    animarPalabras(this.pregunta, tl, 7, { paso: 0.09, salida: 11.2 });
    animarPalabras(this.marca, tl, 12.1, { dur: 0.8, paso: 0.0 });
    animarPalabras(this.sub, tl, 12.7, { paso: 0.07 });
    opacidad(this.sub2, prog(tl, 13.5, 14));
    teclear(this.sub2, 'Manipulador de 5 GDL · código abierto · ULSA 2026', tl, 13.5, 0.02, false);
    // El brazo despierta: de home (apoyado) a init, con la cámara alejándose.
    const s = entradaSalida(prog(tl, 2.6, 7));
    const q = respirar(lerpQ(HOME, [0.15, -0.15, 0.25, -0.2, 0, 0.35], s), tl, s);
    const a = entradaSalida(prog(tl, 1.6, 12));
    const giro = tl > 12 ? (tl - 12) ** 2 * 0.06 : 0;
    const exposicion = salida3(prog(tl, 1.6, 3.6));
    const desplazar = [mix(0, 330, entradaSalida(prog(tl, 6, 7.5))), 0];
    return {
      gl: { q, cam: orbita(mix(1.25, 0.55, a), mix(0.22, 0.4, a), mix(0.42, 0.95, a), [0, mix(0.2, 0.17, a), 0], mix(26, 30, a)), giro, desplazar, rejilla: 0.6 * exposicion },
      exposicion,
      opacidad3d: exposicion,
    };
  },
};

// ======================================================================= 2
export const problema = {
  nombre: 'El problema',
  montar(r) {
    this.foto = el('div', { class: 'abs', style: { inset: '0', overflow: 'hidden' } }, imagen(`${FOTOS}/laboratorio.png`));
    Object.assign(this.foto.firstChild.style, { width: '100%', height: '100%', objectFit: 'cover', filter: 'saturate(.85) brightness(.7)' });
    this.sombra = el('div', { class: 'abs', style: { inset: '0', background: 'linear-gradient(0deg, rgba(11,8,20,.96) 8%, rgba(11,8,20,.35) 55%, rgba(11,8,20,.75))' } });
    this.eti = etiqueta('01 · El problema');
    this.frase = palabras('En el laboratorio hay<br><b>una sola estación</b> de robótica.', 'titulo2 abs');
    Object.assign(this.frase.style, { left: '120px', top: '700px' });
    // Infografía
    this.info = el('div', { class: 'abs', style: { inset: '0' } });
    this.puntos = [];
    const rejilla = el('div', { class: 'abs', style: { left: '730px', top: '330px', width: '430px', display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '18px' } });
    for (let i = 0; i < 35; i++) {
      const p = el('div', { style: { width: '46px', height: '46px', borderRadius: '50%', background: 'var(--violeta)', boxShadow: '0 0 18px rgba(117,83,255,.6)' } });
      this.puntos.push(p);
      rejilla.append(p);
    }
    this.n35 = el('div', { class: 'abs', style: { left: '730px', top: '700px' } }, el('div', { class: 'cifra', style: { fontSize: '120px' } }, '35'), el('div', { class: 'chico' }, 'estudiantes por estación'));
    this.barra = el('div', { class: 'abs', style: { left: '150px', top: '470px', width: '420px', height: '60px', borderRadius: '30px', background: 'rgba(255,255,255,.07)', overflow: 'hidden' } },
      el('div', { style: { height: '100%', width: '0%', background: 'linear-gradient(90deg, var(--violeta), var(--lima))' } }));
    this.n450 = el('div', { class: 'abs', style: { left: '150px', top: '560px' } }, el('div', { class: 'cifra', style: { fontSize: '120px' } }, '450'), el('div', { class: 'chico' }, 'minutos de práctica disponibles'));
    this.div = el('div', { class: 'abs titulo', style: { left: '1180px', top: '440px', fontSize: '150px', color: 'var(--tenue)' } }, '=');
    this.res = el('div', { class: 'abs', style: { left: '1300px', top: '370px' } },
      el('div', { class: 'cifra lima', style: { fontSize: '180px' } }, '0'), el('div', { class: 'texto', style: { fontSize: '40px' } }, 'minutos por estudiante'));
    this.entre = el('div', { class: 'abs titulo', style: { left: '610px', top: '420px', fontSize: '130px', color: 'var(--tenue)' } }, '÷');
    this.info.append(rejilla, this.n35, this.entre, this.barra, this.n450, this.div, this.res);
    this.cierre = palabras('12,86 minutos<br><b>no alcanzan</b> para<br>aprender robótica.', 'titulo abs');
    Object.assign(this.cierre.style, { left: '120px', top: '200px', fontSize: '118px' });
    this.puntosCierre = [
      el('div', { class: 'texto abs', style: { left: '120px', top: '720px', width: '1500px', color: 'var(--tenue)' } }, '— Los equipos industriales son caros, cerrados y no se pueden replicar.'),
      el('div', { class: 'texto abs', style: { left: '120px', top: '800px', width: '1500px', color: 'var(--tenue)' } }, '— Sin práctica suficiente, la teoría no se consolida.'),
    ];
    r.append(this.foto, this.sombra, this.eti, this.frase, this.info, this.cierre, ...this.puntosCierre);
  },
  cuadro(tl) {
    const f = ventana(tl, -1, 0, 4.6, 5);
    opacidad(this.foto, f);
    opacidad(this.sombra, f);
    this.foto.firstChild.style.transform = `scale(${mix(1.12, 1.0, salida3(prog(tl, 0, 5)))})`;
    opacidad(this.eti, ventana(tl, 0.2, 0.5, 15.5, 15.9));
    animarPalabras(this.frase, tl, 0.6, { paso: 0.08, salida: 4.4 });
    opacidad(this.info, ventana(tl, 4.8, 5.0, 10.6, 11));
    this.puntos.forEach((p, i) => {
      const s = rebote(prog(tl, 6.5 + i * 0.045, 6.85 + i * 0.045));
      p.style.transform = `scale(${Math.max(0, s)})`;
    });
    opacidad(this.n35, prog(tl, 7.7, 8.0));
    opacidad(this.entre, prog(tl, 6.2, 6.5));
    opacidad(this.barra, prog(tl, 5.0, 5.3));
    this.barra.firstChild.style.width = `${salida3(prog(tl, 5.1, 6.2)) * 100}%`;
    opacidad(this.n450, prog(tl, 5.3, 5.7));
    opacidad(this.div, prog(tl, 8.3, 8.6));
    opacidad(this.res, prog(tl, 8.5, 8.8));
    this.res.firstChild.textContent = numero(450 / 35 * salida3(prog(tl, 8.5, 9.8)), 2);
    this.res.style.transform = `scale(${1 + 0.06 * golpe(tl) * prog(tl, 10, 10.1)})`;
    animarPalabras(this.cierre, tl, 11.1, { paso: 0.07 });
    this.puntosCierre.forEach((p, i) => mover(p, { x: (1 - salida3(prog(tl, 12.8 + i * 0.6, 13.4 + i * 0.6))) * -40, o: prog(tl, 12.8 + i * 0.6, 13.3 + i * 0.6) }));
    return {};
  },
};

function rebote(s) { return s <= 0 ? 0 : 1 + 2.70158 * (s - 1) ** 3 + 1.70158 * (s - 1) ** 2; }

// ======================================================================= 3
export const solucion = {
  nombre: 'La solución',
  montar(r) {
    this.eti = etiqueta('02 · La solución');
    this.tit = palabras('Una estación<br><b>abierta</b> y<br>replicable', 'titulo abs');
    Object.assign(this.tit.style, { left: '120px', top: '250px' });
    this.chips = ['Código abierto', 'Hardware accesible', 'Documentado', 'Escalable por módulos'].map((t, i) =>
      el('div', { class: 'pastilla abs', style: { left: `${120 + [0, 270, 590, 830][i]}px`, top: '760px' } }, t));
    // Construcción real
    this.clip = new Secuencia(`${CLIPS}/brazo_init`, 362);
    this.marcoClip = el('div', { class: 'marco', style: { left: '150px', top: '80px', width: '518px', height: '920px' } }, this.clip.img);
    this.foto1 = el('div', { class: 'marco', style: { left: '760px', top: '80px', width: '600px', height: '431px' } }, imagen(`${FOTOS}/piezas_impresas.jpg`));
    this.foto2 = el('div', { class: 'marco', style: { left: '1400px', top: '80px', width: '400px', height: '536px' } }, imagen(`${FOTOS}/construccion.png`));
    this.textoConst = palabras('Impreso en 3D,<br>armado y cableado<br><b>por el equipo.</b>', 'titulo2 abs');
    Object.assign(this.textoConst.style, { left: '760px', top: '660px' });
    // CAD
    this.cad = new Secuencia(`${CLIPS}/ensamble_cad`, 250);
    this.marcoCad = el('div', { class: 'marco', style: { left: '160px', top: '190px', width: '1600px', height: '722px', background: '#fff' } }, this.cad.img);
    this.etiCad = etiqueta('Diseño CAD · SolidWorks', 160, 120);
    this.leyCad = el('div', { class: 'leyenda', style: { left: '160px', bottom: '90px' } }, 'Cinco eslabones, pinza independiente y ensamble con relaciones e interferencias verificadas');
    // Costo
    this.costo = el('div', { class: 'abs', style: { left: '0', width: '1920px', top: '300px', textAlign: 'center' } },
      el('div', { class: 'mono tenue', style: { fontSize: '30px', letterSpacing: '.3em' } }, 'COSTO DIRECTO DE LA ESTACIÓN COMPLETA'),
      el('div', { class: 'cifra', style: { fontSize: '260px', marginTop: '30px' } }, ''),
      el('div', { class: 'texto tenue', style: { marginTop: '30px' } }, 'C$ 12 456,42 · servos, electrónica, impresión 3D, cámara y documentación'));
    r.append(this.eti, this.tit, ...this.chips, this.marcoClip, this.foto1, this.foto2, this.textoConst, this.marcoCad, this.etiCad, this.leyCad, this.costo);
  },
  cuadro(tl) {
    const a = ventana(tl, -1, 0, 3.8, 4);
    opacidad(this.eti, a);
    animarPalabras(this.tit, tl, 0.05, { paso: 0.06, salida: 3.6 });
    this.chips.forEach((c, i) => { const s = salida3(prog(tl, 1 + i * 0.5, 1.4 + i * 0.5)); mover(c, { y: (1 - s) * 40, s: 1 + 0.05 * golpe(tl) * s, o: s * (1 - prog(tl, 3.7, 3.9)) }); });
    // Construcción (4–8)
    const b = ventana(tl, 4, 4.01, 7.95, 8);
    for (const [n, d] of [[this.marcoClip, 0], [this.foto1, 0.15], [this.foto2, 0.3]]) {
      const s = salida3(prog(tl, 4 + d, 4.6 + d));
      mover(n, { y: (1 - s) * 80, o: b * s });
    }
    this.clip.ir(1.8 + (tl - 4) * 1.6);
    this.foto1.firstChild.style.transform = `scale(${mix(1.0, 1.1, prog(tl, 4, 8))})`;
    this.foto2.firstChild.style.transform = `scale(${mix(1.12, 1.0, prog(tl, 4, 8))})`;
    animarPalabras(this.textoConst, tl, 4.8, { paso: 0.07, salida: 7.7 });
    // CAD (8–12)
    const c = ventana(tl, 8, 8.01, 11.95, 12);
    mover(this.marcoCad, { s: mix(0.94, 1, salida3(prog(tl, 8, 8.8))), o: c });
    this.cad.ir((tl - 8) * 2.0);
    opacidad(this.etiCad, c);
    opacidad(this.leyCad, c * prog(tl, 8.6, 9));
    // Costo (12–16)
    opacidad(this.costo, ventana(tl, 12, 12.2, 15.7, 16));
    this.costo.children[1].textContent = 'USD ' + numero(336.66 * salidaExpo(prog(tl, 12.1, 13.6)), 2);
    this.costo.children[1].style.transform = `scale(${1 + 0.035 * golpe(tl) * prog(tl, 13.6, 13.7)})`;
    if (tl < 4) {
      return { gl: { q: respirar([0.25 * Math.sin(tl * 1.4), -0.2, 0.35, -0.3, tl * 0.9, 0.3], tl), cam: orbita(0.5 + tl * 0.35, 0.38, 1.0, [0, 0.16, 0]), desplazar: [330, 30], borde: 1 + golpe(tl) * 0.8 } };
    }
    return {};
  },
};

// ======================================================================= 4
const JUNTAS = [
  ['Shoulder_Rotation', 'Giro de la base', 0.9, 'var(--rosa)'],
  ['Shoulder_Pitch', 'Hombro', -0.55, 'var(--lima)'],
  ['Elbow', 'Codo', 0.75, 'var(--durazno)'],
  ['Wrist_Pitch', 'Flexión de muñeca', 0.95, 'var(--violeta)'],
  ['Wrist_Roll', 'Giro de muñeca', 1.6, '#5ee7ff'],
];

export const robot = {
  nombre: 'El robot',
  montar(r) {
    this.eti = etiqueta('03 · El robot');
    this.tit = palabras('¿Qué es un<br><b>manipulador?</b>', 'titulo2 abs');
    Object.assign(this.tit.style, { left: '120px', top: '200px' });
    this.def = palabras('Una cadena de <b>eslabones</b> unidos por <b>articulaciones,</b> con una herramienta en la punta.', 'texto abs');
    Object.assign(this.def.style, { left: '120px', top: '420px', width: '700px' });
    this.cuenta = el('div', { class: 'abs', style: { left: '120px', top: '600px' } },
      el('div', { class: 'cifra', style: { fontSize: '200px' } }, '0'),
      el('div', { class: 'texto', style: { marginTop: '10px' } }, 'grados de libertad'),
      el('div', { class: 'chico', style: { width: '640px', marginTop: '14px' } }, 'Un grado de libertad es cada movimiento independiente que puede hacer el robot.'));
    this.rotulo = el('div', { class: 'flecha3d' }, '');
    this.pinza = el('div', { class: 'flecha3d', style: { borderLeftColor: '#fff' } }, 'Pinza: herramienta independiente, no cuenta como GDL');
    this.alc = el('div', { class: 'abs', style: { left: '120px', top: '640px' } },
      el('div', { class: 'cifra lima', style: { fontSize: '130px' } }, '431,70 mm'),
      el('div', { class: 'texto' }, 'de alcance máximo'));
    this.servos = ['Servos Feetech STS3215', 'Bus serie por USB, sin microcontrolador'].map((t, i) =>
      el('div', { class: 'pastilla abs', style: { left: '120px', top: `${880 + i * 70}px` } }, t));
    r.append(this.eti, this.tit, this.def, this.cuenta, this.rotulo, this.pinza, this.alc, ...this.servos);
  },
  cuadro(tl) {
    opacidad(this.eti, ventana(tl, -1, 0, 15.6, 16));
    animarPalabras(this.tit, tl, 0.05, { paso: 0.08, salida: 11.6 });
    animarPalabras(this.def, tl, 0.6, { paso: 0.035, salida: 11.6 });
    opacidad(this.cuenta, ventana(tl, 2, 2.3, 11.6, 12));
    const k = clamp(Math.floor((tl - 2) / 2), -1, 4);
    const q = [0, 0, 0, 0, 0, 0.3];
    let resaltado = null;
    let intensidad = 0;
    if (tl >= 2 && tl < 12) {
      const [junta, nombre, amp, color] = JUNTAS[k];
      const u = (tl - 2 - k * 2) / 2;
      q[k] = amp * Math.sin(u * Math.PI * 2) * suave(prog(u, 0, 0.15)) * (1 - suave(prog(u, 0.85, 1)));
      resaltado = junta;
      intensidad = ventana(u, 0, 0.08, 0.9, 1);
      this.cuenta.firstChild.textContent = String(k + 1);
      this.cuenta.firstChild.style.color = color;
      this.cuenta.firstChild.style.transform = `scale(${1 + 0.12 * Math.exp(-u * 10)})`;
      this.rotulo.textContent = `${k + 1} · ${nombre}`;
      this.rotulo.style.borderLeftColor = color;
      this._junta = junta;
    }
    if (tl >= 12 && tl < 14) q[5] = 0.2 + 1.1 * Math.abs(Math.sin((tl - 12) * Math.PI));
    const e = entradaSalida(prog(tl, 14, 15.3));
    const cam = tl < 14 ? orbita(0.62 + tl * 0.02, 0.4, 1.12, [0, 0.17, 0], 30)
      : orbita(0.9 + (tl - 14) * 0.15, mix(0.38, 1.25, e), mix(1.0, 0.75, e), [0, mix(0.17, 0.0, e), 0], 34);
    const gl = { q: respirar(q, tl, 0.4), cam, desplazar: [mix(180, 380, e), mix(30, 60, e)], alcance: salida3(prog(tl, 14.3, 15)) };
    return { gl, resaltar: [resaltado, intensidad], despues: (plato) => {
      if (this._junta && tl >= 2 && tl < 12) {
        const p = plato.pantalla(this._junta);
        mover(this.rotulo, { x: Math.min(p.x + 70, 1480), y: p.y - 90, o: intensidad });
      } else opacidad(this.rotulo, 0);
      if (tl >= 12 && tl < 14) {
        const p = plato.pantalla('Gripper');
        mover(this.pinza, { x: Math.min(p.x - 200, 1060), y: p.y + 150, o: ventana(tl, 12, 12.3, 13.7, 14) });
      } else opacidad(this.pinza, 0);
      opacidad(this.alc, prog(tl, 14.4, 14.8));
      this.servos.forEach((s, i) => opacidad(s, prog(tl, 14.8 + i * 0.25, 15.1 + i * 0.25)));
    } };
  },
};

// ======================================================================= 5
const PASOS = [
  ['Cámara web', 'Una imagen RGB común: sin sensores en el cuerpo'],
  ['MediaPipe Pose + Hands', '33 puntos del cuerpo y 21 de la mano en cada imagen'],
  ['Ángulos', 'Vectores hombro → codo → muñeca: cinco ángulos'],
  ['Filtro One Euro y límites', 'Sin temblor y siempre dentro de rangos seguros'],
  ['ROS 2 Humble', 'La trayectoria va al controlador del brazo (ros2_control)'],
  ['Brazo real y Gazebo', 'Los servos STS3215 y el gemelo digital, a la vez'],
];

export const funciona = {
  nombre: 'Cómo funciona',
  montar(r) {
    this.eti = etiqueta('04 · Cómo funciona');
    this.tit = palabras('Tú te mueves.<br><b>El robot te copia.</b>', 'titulo abs');
    Object.assign(this.tit.style, { left: '120px', top: '380px' });
    this.clip = new Secuencia(`${CLIPS}/teleop_gazebo`, 480);
    this.marco = el('div', { class: 'marco', style: { left: '90px', top: '250px', width: '1040px', height: '509px' } }, this.clip.img);
    this.ley = el('div', { class: 'leyenda', style: { left: '90px', bottom: 'auto', top: '790px', width: '1040px' } }, 'Grabación real: MediaPipe sobre la cámara y el gemelo digital en Gazebo copiando el brazo');
    this.pasos = PASOS.map(([t, d], i) => el('div', { class: 'abs', style: { left: '1220px', top: `${170 + i * 128}px`, width: '620px', display: 'flex', gap: '22px' } },
      el('div', { class: 'mono', style: { width: '58px', height: '58px', flex: 'none', borderRadius: '50%', border: '2px solid var(--violeta)', display: 'grid', placeItems: 'center', fontSize: '24px' } }, String(i + 1)),
      el('div', {}, el('div', { style: { fontSize: '34px', fontWeight: 700 } }, t), el('div', { class: 'chico', style: { fontSize: '24px' } }, d))));
    this.riel = el('div', { class: 'abs', style: { left: '1248px', top: '200px', width: '2px', height: '640px', background: 'rgba(117,83,255,.35)' } });
    this.chispa = el('div', { class: 'abs', style: { left: '1241px', top: '200px', width: '16px', height: '16px', borderRadius: '50%', background: 'var(--lima)', boxShadow: '0 0 20px var(--lima)' } });
    this.defensa = new Secuencia(`${CLIPS}/defensa`, 661);
    this.marcoDef = el('div', { class: 'marco', style: { left: '210px', top: '150px', width: '1500px', height: '843px' } }, this.defensa.img);
    this.etiDef = etiqueta('En la defensa del proyecto', 210, 80);
    this.leyDef = el('div', { class: 'tarjeta', style: { left: '1180px', top: '760px', width: '600px' } },
      el('div', { style: { fontSize: '34px', fontWeight: 800 } }, 'El brazo real copia al operador en vivo.'),
      el('div', { class: 'chico', style: { fontSize: '24px', marginTop: '8px' } }, 'Mapeo articular directo: se copian ángulos; no hay cinemática inversa en el lazo de control.'));
    r.append(this.eti, this.tit, this.riel, this.chispa, this.marco, this.ley, ...this.pasos, this.marcoDef, this.etiDef, this.leyDef);
  },
  cuadro(tl) {
    opacidad(this.eti, ventana(tl, -1, 0, 9.8, 10));
    animarPalabras(this.tit, tl, 0.05, { paso: 0.08, salida: 2.2 });
    const b = ventana(tl, 2.5, 2.8, 9.8, 10);
    mover(this.marco, { x: (1 - salida3(prog(tl, 2.5, 3.2))) * -60, o: b });
    opacidad(this.ley, b * prog(tl, 3.2, 3.6));
    this.clip.ir(tl - 2.5);
    opacidad(this.riel, b);
    this.pasos.forEach((p, i) => {
      const t0 = 3 + i * 1.0;
      const s = salida3(prog(tl, t0, t0 + 0.4));
      const activo = tl >= t0 && tl < t0 + 1.0;
      mover(p, { x: (1 - s) * 50, o: b * mix(0.0, activo ? 1 : 0.55, s) });
      p.firstChild.style.background = activo ? 'var(--violeta)' : 'transparent';
    });
    const y = 200 + clamp((tl - 3) / 6, 0, 1) * 640;
    mover(this.chispa, { y: y - 200, o: b * (tl > 3 ? 1 : 0) });
    // Defensa (10–16)
    const c = ventana(tl, 10, 10.01, 15.7, 16);
    mover(this.marcoDef, { s: mix(1.04, 1, salida3(prog(tl, 10, 11))), o: c });
    this.defensa.ir(4.5 + (tl - 10));
    opacidad(this.etiDef, c);
    mover(this.leyDef, { y: (1 - salida3(prog(tl, 11, 11.6))) * 40, o: c * prog(tl, 11, 11.4) });
    return {};
  },
};

// ======================================================================= 6
// Brazo derecho del operador: mismas fórmulas que shoulder_elbow_angles() de teleop_v13.py.
function brazoHumano(t) {
  const q1 = 0.55 * Math.sin(t * 0.9);                       // giro del hombro
  const q2 = -0.15 + 0.55 * Math.sin(t * 0.7 + 1);           // elevación
  const q3 = 0.9 + 0.55 * Math.sin(t * 1.1 + 2);             // codo
  return [q1, q2, q3];
}

export const matematica = {
  nombre: 'La matemática',
  montar(r) {
    this.eti = etiqueta('05 · La matemática');
    this.tit = palabras('Del cuerpo<br>a <b>cinco ángulos</b>', 'titulo2 abs');
    Object.assign(this.tit.style, { left: '120px', top: '170px' });
    const ecs = [
      ['Marco del cuerpo', String.raw`\hat d=\frac{\vec h_D-\vec h_I}{\lVert\vec h_D-\vec h_I\rVert},\quad \hat a=\frac{\bar h-\bar c}{\lVert\bar h-\bar c\rVert},\quad \hat f=\hat d\times\hat a`],
      ['Giro del hombro', String.raw`\theta_1=\operatorname{atan2}\left(\vec b\cdot\hat d,\ \vec b\cdot\hat f\right)`],
      ['Elevación del hombro', String.raw`\theta_2=\operatorname{atan2}\left(\vec b\cdot\hat a,\ \sqrt{(\vec b\cdot\hat d)^2+(\vec b\cdot\hat f)^2}\right)`],
      ['Codo', String.raw`\theta_3=\arccos\left(\hat b\cdot\hat e\right)`],
      ['Muñeca, en el plano de la imagen', String.raw`\theta_{4,5}=\operatorname{atan2}\left(\vec u\times\vec v,\ \vec u\cdot\vec v\right)`],
    ];
    this.ecs = ecs.map(([n, f], i) => el('div', { class: 'abs', style: { left: '960px', top: `${150 + i * 158}px`, width: '900px' } },
      el('div', { class: 'mono lima', style: { fontSize: '20px', letterSpacing: '.18em', textTransform: 'uppercase', marginBottom: '8px' } }, n),
      el('div', { class: 'ecuacion', html: tex(f) })));
    this.notas = el('div', { class: 'leyenda', style: { left: '960px', bottom: '60px', width: '900px', fontSize: '19px' } },
      'b: hombro → codo · e: codo → muñeca · h: hombros · c: caderas · u, v: antebrazo y mano (o línea de nudillos) — teleop_v13.py, funciones shoulder_elbow_angles() y wrist_angles_2d()');
    this.lecturas = el('div', { class: 'abs mono', style: { left: '120px', top: '900px', fontSize: '30px', lineHeight: '1.5' } });
    // One Euro
    this.tit2 = palabras('Filtro <b>One Euro</b>', 'titulo2 abs');
    Object.assign(this.tit2.style, { left: '120px', top: '120px' });
    this.ec2 = el('div', { class: 'abs ecuacion', style: { left: '120px', top: '760px', fontSize: '40px' },
      html: tex(String.raw`\hat x_k=\alpha\,x_k+(1-\alpha)\,\hat x_{k-1},\quad \alpha=\frac{1}{1+\tau/\Delta t},\quad \tau=\frac{1}{2\pi f_c},\quad f_c=f_{\min}+\beta\,\lvert\dot{\hat x}\rvert`) });
    this.exp2 = el('div', { class: 'abs', style: { left: '1260px', top: '250px', width: '560px' } },
      el('div', { class: 'texto', style: { fontSize: '38px' } }, 'Quieto, filtra mucho. Rápido, casi nada.'),
      el('div', { class: 'chico', style: { marginTop: '20px', fontSize: '26px' } }, 'La frecuencia de corte sube con la velocidad: el temblor de la mano desaparece sin agregar retraso cuando el movimiento es rápido.'),
      el('div', { class: 'chico', style: { marginTop: '20px', fontSize: '22px' } }, 'Casiez, Roussel y Vogel, CHI 2012.'),
      el('div', { style: { marginTop: '34px', display: 'flex', gap: '24px', fontFamily: 'Plex', fontSize: '22px' } },
        el('span', { class: 'rosa' }, '— ángulo medido'), el('span', { class: 'lima' }, '— ángulo filtrado')));
    this.limites = el('div', { class: 'tarjeta', style: { left: '1260px', top: '640px', width: '560px' } },
      el('div', { style: { fontSize: '30px', fontWeight: 800 } }, 'Después, por seguridad:'),
      el('div', { class: 'chico', style: { fontSize: '24px', marginTop: '6px' } }, 'límites del URDF, zona muerta y tope de velocidad. Nunca se pide un ángulo imposible.'));
    r.append(this.eti, this.tit, ...this.ecs, this.notas, this.lecturas, this.tit2, this.ec2, this.exp2, this.limites);
    // Señal de ejemplo para el filtro (determinista).
    const n = 600;
    let semilla = 7;
    const azar = () => { semilla = (semilla * 16807) % 2147483647; return semilla / 2147483647 - 0.5; };
    this.cruda = [];
    for (let i = 0; i < n; i++) {
      const tt = i / 60;
      const base = tt < 3 ? 0.2 : tt < 4.2 ? 0.2 + 0.9 * suave((tt - 3) / 1.2) : tt < 7 ? 1.1 : 1.1 - 0.8 * suave(Math.min(1, (tt - 7) / 0.8));
      this.cruda.push(base + azar() * 0.09);
    }
    this.filtrada = [];
    let xp = null, dxp = 0;
    const alfa = (fc, dt) => 1 / (1 + 1 / (2 * Math.PI * fc) / dt);
    for (const x of this.cruda) {
      if (xp === null) { xp = x; this.filtrada.push(x); continue; }
      const dt = 1 / 60;
      const dx = (x - xp) / dt;
      const ad = alfa(1.0, dt);
      const dxh = ad * dx + (1 - ad) * dxp;
      const fc = 1.0 + 0.5 * Math.abs(dxh);
      const a = alfa(fc, dt);
      xp = a * x + (1 - a) * xp;
      dxp = dxh;
      this.filtrada.push(xp);
    }
  },
  cuadro(tl, t, ctx) {
    const a = ventana(tl, -1, 0, 7.7, 8);
    opacidad(this.eti, ventana(tl, -1, 0, 15.6, 16));
    animarPalabras(this.tit, tl, 0.1, { paso: 0.08, salida: 7.5 });
    this.ecs.forEach((e, i) => mover(e, { x: (1 - salida3(prog(tl, 0.8 + i * 1.2, 1.4 + i * 1.2))) * 40, o: a * prog(tl, 0.8 + i * 1.2, 1.3 + i * 1.2) }));
    opacidad(this.notas, a * prog(tl, 6.5, 7));
    opacidad(this.lecturas, a * prog(tl, 1, 1.5));
    if (tl < 8) this.esqueleto(ctx, tl, a);
    const [q1, q2, q3] = brazoHumano(tl);
    this.lecturas.innerHTML = `<span class="rosa">θ₁ ${numero(q1 * 57.2958, 1)}°</span>&nbsp;&nbsp; <span class="lima">θ₂ ${numero(q2 * 57.2958, 1)}°</span>&nbsp;&nbsp; <span class="durazno">θ₃ ${numero(q3 * 57.2958, 1)}°</span>`;
    // One Euro (8–16)
    const b = ventana(tl, 8, 8.2, 15.7, 16);
    animarPalabras(this.tit2, tl, 8.1, { paso: 0.08 });
    opacidad(this.ec2, b * prog(tl, 9, 9.5));
    mover(this.exp2, { x: (1 - salida3(prog(tl, 9.4, 10))) * 40, o: b * prog(tl, 9.4, 9.9) });
    mover(this.limites, { y: (1 - salida3(prog(tl, 12.5, 13.1))) * 30, o: b * prog(tl, 12.5, 12.9) });
    if (tl >= 8) this.grafica(ctx, tl, b);
    return { lienzo: true };
  },
  esqueleto(ctx, tl, a) {
    // Vista de frente del operador (su brazo derecho a la izquierda de la imagen).
    ctx.save();
    ctx.globalAlpha = a;
    const cx = 560, hy = 560, ancho = 110, escala = 230;
    const hD = [cx - ancho, hy], hI = [cx + ancho, hy];
    const cD = [cx - 80, hy + 290], cI = [cx + 80, hy + 290];
    const [q1, q2, q3] = brazoHumano(tl);
    // brazo en 3D (d: derecha del operador = −x de la imagen, a: arriba, f: hacia la cámara)
    const b = [Math.sin(q1) * Math.cos(q2), Math.sin(q2), Math.cos(q1) * Math.cos(q2)];
    const codo3 = b.map((v) => v * 0.9);
    // el antebrazo gira q3 respecto del brazo, en el plano vertical que contiene a b
    const giro = (v, ang) => [v[0] * Math.cos(ang) - v[1] * Math.sin(ang), v[0] * Math.sin(ang) + v[1] * Math.cos(ang), v[2]];
    const e = giro(b, q3);
    const mun3 = codo3.map((v, i) => v + e[i] * 0.85);
    const proy = (p) => [hD[0] - p[0] * escala * 0.75 - p[2] * escala * 0.35, hD[1] - p[1] * escala];
    const codo = proy(codo3), mun = proy(mun3);
    const linea = (p, q, color, w) => { ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(...p); ctx.lineTo(...q); ctx.stroke(); };
    const punto = (p, color, r = 9) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(...p, r, 0, Math.PI * 2); ctx.fill(); };
    const flecha = (p, q, color, texto) => {
      linea(p, q, color, 5);
      const ang = Math.atan2(q[1] - p[1], q[0] - p[0]);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(q[0] + Math.cos(ang) * 16, q[1] + Math.sin(ang) * 16);
      ctx.lineTo(q[0] + Math.cos(ang + 2.5) * 16, q[1] + Math.sin(ang + 2.5) * 16);
      ctx.lineTo(q[0] + Math.cos(ang - 2.5) * 16, q[1] + Math.sin(ang - 2.5) * 16);
      ctx.fill();
      if (texto) { ctx.font = '500 28px Plex'; ctx.fillText(texto, q[0] + Math.cos(ang) * 30 - 8, q[1] + Math.sin(ang) * 30 + 8); }
    };
    // tronco
    ctx.globalAlpha = a * 0.5;
    linea(hD, hI, '#a39cbd', 4); linea(cD, cI, '#a39cbd', 4); linea(hD, cD, '#a39cbd', 4); linea(hI, cI, '#a39cbd', 4);
    linea(hI, [hI[0] + 40, hI[1] + 260], '#a39cbd', 4);
    ctx.beginPath(); ctx.strokeStyle = '#a39cbd'; ctx.lineWidth = 4; ctx.arc(cx, hy - 105, 58, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = a;
    for (const p of [hD, hI, cD, cI]) punto(p, '#a39cbd', 7);
    // marco del cuerpo en el centro de los hombros
    const o = [cx, hy + 120];
    const s1 = prog(tl, 0.8, 1.6);
    if (s1 > 0) {
      ctx.globalAlpha = a * s1;
      flecha(o, [o[0] - 120, o[1]], '#fd44b0', 'd');
      flecha(o, [o[0], o[1] - 120], '#c2ef4e', 'a');
      flecha(o, [o[0] + 55, o[1] + 55], '#7553ff', 'f');
      ctx.globalAlpha = a;
    }
    // brazo
    linea(hD, codo, '#ffffff', 12); linea(codo, mun, '#ffffff', 10);
    if (tl > 2.3) { ctx.globalAlpha = a * prog(tl, 2.3, 2.8); flecha(hD, codo, '#ffb287', 'b'); ctx.globalAlpha = a; }
    if (tl > 5.3) { ctx.globalAlpha = a * prog(tl, 5.3, 5.8); flecha(codo, mun, '#5ee7ff', 'e'); ctx.globalAlpha = a; }
    punto(hD, '#fd44b0', 12); punto(codo, '#ffb287', 12); punto(mun, '#5ee7ff', 12);
    ctx.restore();
  },
  grafica(ctx, tl, b) {
    const x0 = 120, y0 = 280, w = 1060, h = 420;
    ctx.save();
    ctx.globalAlpha = b;
    ctx.fillStyle = 'rgba(21,15,35,.8)';
    ctx.strokeStyle = 'rgba(255,255,255,.1)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(x0, y0, w, h, 18); ctx.fill(); ctx.stroke();
    for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x0 + 20, y0 + (h * i) / 4); ctx.lineTo(x0 + w - 20, y0 + (h * i) / 4); ctx.stroke(); }
    ctx.font = '400 20px Plex'; ctx.fillStyle = '#a39cbd';
    ctx.fillText('ángulo del codo (señal de ejemplo)', x0 + 24, y0 + 36);
    ctx.fillText('tiempo →', x0 + w - 130, y0 + h - 18);
    const n = Math.floor(this.cruda.length * clamp((tl - 8.4) / 5));
    const px = (i) => x0 + 30 + (i / (this.cruda.length - 1)) * (w - 60);
    const py = (v) => y0 + h - 50 - v * (h - 120) / 1.25;
    const trazar = (datos, color, ancho) => {
      ctx.strokeStyle = color; ctx.lineWidth = ancho; ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let i = 0; i < n; i++) (i ? ctx.lineTo : ctx.moveTo).call(ctx, px(i), py(datos[i]));
      ctx.stroke();
    };
    trazar(this.cruda, '#fd44b0', 2);
    trazar(this.filtrada, '#c2ef4e', 5);
    ctx.restore();
  },
};
