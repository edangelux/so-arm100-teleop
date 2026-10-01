// Escenas 7 a 11: resultados, SO-ARM100 Estudio (dos partes), el repositorio y el cierre.
import {
  el, palabras, animarPalabras, opacidad, mover, teclear, imagen, Secuencia, numero,
  prog, ventana, mix, salida3, salidaExpo, entradaSalida, golpe, clamp,
} from './motor.js';
import { orbita } from './plato3d.js';
import { respirar } from './escenas_1.js';

const FOTOS = '../recursos/fotos';
const CLIPS = '../salida/clips';
const APP = '../salida/app';

function etiqueta(texto, x = 120, y = 110) {
  return el('div', { class: 'etiqueta abs', style: { left: `${x}px`, top: `${y}px` } }, texto);
}

// ======================================================================= 7
const CIFRAS = [
  [34.05, 2, 'FPS', 'Visión en tiempo real', 'umbral ≥ 25 FPS'],
  [21.87, 2, 'ms', 'Procesamiento + escritura serial', 'umbral ≤ 150 ms'],
  [0.492, 3, '°', 'Desviación angular media', 'umbral ≤ 1,5°'],
];
const ENSAYOS = [
  ['2,30 mm', 'Repetibilidad', 'ISO 9283, 30 llegadas'],
  ['227 g', 'Carga sostenida', 'en las tres posturas de prueba'],
  ['54 °C', 'Temperatura máxima', 'límite del servo: 55 °C'],
  ['≤ 1,1 %', 'Sobrepaso al escalón', 'respuesta sin oscilación'],
];

export const resultados = {
  nombre: 'Resultados',
  montar(r) {
    this.eti = etiqueta('06 · Resultados');
    this.tit = palabras('Se midió.<br><b>Cumple.</b>', 'titulo2 abs');
    Object.assign(this.tit.style, { left: '120px', top: '170px' });
    this.cols = CIFRAS.map(([, , u, d, umbral], i) => el('div', { class: 'abs', style: { left: `${120 + i * 590}px`, top: '420px', width: '560px' } },
      el('div', {}, el('span', { class: 'cifra' }, '0'), el('span', { class: 'unidad' }, u)),
      el('div', { class: 'texto', style: { fontSize: '36px', marginTop: '12px' } }, d),
      el('div', { style: { marginTop: '20px', display: 'flex', gap: '14px', alignItems: 'center' } },
        el('span', { class: 'check' }, '✓ Cumple'), el('span', { class: 'chico', style: { fontSize: '24px' } }, umbral))));
    this.pie = el('div', { class: 'leyenda' }, 'Recalculadas desde los registros originales: python3 pruebas/recalcular_resultados.py');
    // Modelo cinemático
    this.dh = el('div', { class: 'marco', style: { left: '120px', top: '150px', width: '860px', height: '800px', background: '#fff' } }, imagen(`${FOTOS}/marcos_dh.png`));
    this.dh.firstChild.style.objectFit = 'contain';
    this.etiDh = etiqueta('Modelo cinemático', 1060, 160);
    this.lista = ['Parámetros de Denavit-Hartenberg derivados del URDF', 'Cinemática directa: error de 10⁻¹⁵ m (redondeo)',
      'Cinemática inversa cerrada: 3000 de 3000 poses', 'Verificado contra tres implementaciones independientes'].map((t, i) =>
      el('div', { class: 'abs', style: { left: '1060px', top: `${250 + i * 165}px`, width: '760px', display: 'flex', gap: '20px' } },
        el('div', { class: 'mono lima', style: { fontSize: '40px', fontWeight: 500 } }, `0${i + 1}`), el('div', { class: 'texto', style: { fontSize: '38px' } }, t)));
    // Ensayos del brazo real
    this.clip = new Secuencia(`${CLIPS}/brazo_estacion`, 421);
    this.marcoClip = el('div', { class: 'marco', style: { left: '120px', top: '100px', width: '486px', height: '880px' } }, this.clip.img);
    this.etiEns = etiqueta('Ensayos del brazo real · 25 sep 2026', 700, 120);
    this.tarjetas = ENSAYOS.map(([c, n, d], i) => el('div', { class: 'tarjeta', style: { left: `${700 + (i % 2) * 560}px`, top: `${220 + Math.floor(i / 2) * 370}px`, width: '520px', height: '330px' } },
      el('div', { class: 'cifra', style: { fontSize: '104px' } }, c),
      el('div', { class: 'texto', style: { fontSize: '36px', marginTop: '18px' } }, n),
      el('div', { class: 'chico', style: { fontSize: '24px', marginTop: '6px' } }, d)));
    r.append(this.eti, this.tit, ...this.cols, this.pie, this.dh, this.etiDh, ...this.lista, this.marcoClip, this.etiEns, ...this.tarjetas);
  },
  cuadro(tl) {
    const a = ventana(tl, -1, 0, 4.8, 5);
    opacidad(this.eti, a);
    animarPalabras(this.tit, tl, 0.05, { paso: 0.1, salida: 4.6 });
    this.cols.forEach((c, i) => {
      const t0 = 0.5 + i * 1.0;
      const s = salidaExpo(prog(tl, t0, t0 + 1.0));
      mover(c, { y: (1 - salida3(prog(tl, t0, t0 + 0.4))) * 60, o: a * prog(tl, t0, t0 + 0.2) });
      c.firstChild.firstChild.textContent = numero(CIFRAS[i][0] * s, CIFRAS[i][1]);
      c.firstChild.firstChild.style.color = s > 0.999 ? 'var(--lima)' : 'var(--texto)';
      opacidad(c.lastChild, prog(tl, t0 + 1.0, t0 + 1.2));
    });
    opacidad(this.pie, a * prog(tl, 3.6, 4));
    const b = ventana(tl, 5, 5.01, 9.95, 10);
    mover(this.dh, { x: (1 - salida3(prog(tl, 5, 5.6))) * -60, o: b });
    this.dh.firstChild.style.transform = `scale(${mix(1.0, 1.08, prog(tl, 5, 10))})`;
    opacidad(this.etiDh, b);
    this.lista.forEach((n, i) => mover(n, { x: (1 - salida3(prog(tl, 5.4 + i * 0.5, 5.9 + i * 0.5))) * 50, o: b * prog(tl, 5.4 + i * 0.5, 5.8 + i * 0.5) }));
    const c = ventana(tl, 10, 10.01, 15.7, 16);
    mover(this.marcoClip, { y: (1 - salida3(prog(tl, 10, 10.6))) * 70, o: c });
    this.clip.ir(1 + (tl - 10) * 1.3);
    opacidad(this.etiEns, c);
    this.tarjetas.forEach((n, i) => {
      const t0 = 10.5 + i * 0.5;
      mover(n, { y: (1 - salida3(prog(tl, t0, t0 + 0.45))) * 50, s: 1 + 0.03 * golpe(tl) * prog(tl, t0 + 0.5, t0 + 0.6), o: c * prog(tl, t0, t0 + 0.3) });
    });
    return {};
  },
};

// ======================================================================= 8 y 9
// Ventana de la aplicación con el video de una toma (1600×900).
function ventanaApp(r, x, y, ancho) {
  const seq = new Secuencia('', 1);
  const v = el('div', { class: 'ventana', style: { left: `${x}px`, top: `${y}px`, width: `${ancho}px` } },
    el('div', { class: 'barra' }, el('i'), el('i'), el('i'), el('span', { style: { marginLeft: '12px' } }, 'SO-ARM100 Estudio  ·  soarm-app')), seq.img);
  r.append(v);
  return { v, seq };
}

function usarToma(seq, toma, total) {
  if (seq.carpeta !== `${APP}/${toma}`) { seq.carpeta = `${APP}/${toma}`; seq.total = total; seq.actual = -1; }
}

function rotulo(texto, sub) {
  return el('div', { class: 'abs', style: { left: '310px', top: '962px', width: '1500px', display: 'flex', alignItems: 'baseline', gap: '26px' } },
    el('div', { style: { fontSize: '40px', fontWeight: 800, whiteSpace: 'nowrap' } }, texto),
    el('div', { class: 'chico', style: { fontSize: '27px' } }, sub));
}

// tomas: [inicio, fin, carpeta, cuadros, desde (s), velocidad, título, subtítulo]
function escenaApp(nombre, eti, intro, tomas) {
  return {
    nombre,
    montar(r) {
      this.eti = etiqueta(eti);
      r.append(this.eti);
      if (intro) {
        this.tit = palabras(intro.titulo, 'titulo abs');
        Object.assign(this.tit.style, { left: '120px', top: '330px' });
        this.cmd = el('div', { class: 'abs mono', style: { left: '126px', top: '720px', fontSize: '40px', color: 'var(--lima)' } });
        r.append(this.tit, this.cmd);
      }
      this.app = ventanaApp(r, 310, 160, 1300);
      this.rotulos = tomas.map(([, , , , , , t, s]) => rotulo(t, s));
      r.append(...this.rotulos);
    },
    cuadro(tl) {
      opacidad(this.eti, 1);
      const fin0 = intro ? intro.hasta : 0;
      if (intro) {
        animarPalabras(this.tit, tl, 0.05, { paso: 0.08, salida: fin0 - 0.4 });
        opacidad(this.cmd, ventana(tl, 0.8, 0.9, fin0 - 0.3, fin0));
        teclear(this.cmd, '$ soarm-app', tl, 0.9, 0.06);
      }
      let activa = -1;
      tomas.forEach(([t0, t1], i) => { if (tl >= t0 && tl < t1) activa = i; });
      if (activa >= 0) {
        const [t0, , toma, total, desde, vel] = tomas[activa];
        usarToma(this.app.seq, toma, total);
        this.app.seq.ir(desde + (tl - t0) * vel);
        const s = salida3(prog(tl, t0, t0 + 0.5));
        mover(this.app.v, { y: (1 - s) * 50, s: mix(0.97, 1, s), o: 1 });
      } else opacidad(this.app.v, 0);
      this.rotulos.forEach((n, i) => {
        const [t0, t1] = tomas[i];
        mover(n, { x: (1 - salida3(prog(tl, t0 + 0.15, t0 + 0.6))) * 40, o: ventana(tl, t0 + 0.15, t0 + 0.45, t1 - 0.1, t1) });
      });
      return { destello: tomas.some(([t0]) => t0 > 0 && Math.abs(tl - t0) < 0.12) ? 1 - Math.abs(tl - tomas.find(([t0]) => Math.abs(tl - t0) < 0.12)[0]) / 0.12 : 0 };
    },
  };
}

export const estudio1 = escenaApp('SO-ARM100 Estudio', '07 · SO-ARM100 Estudio',
  { titulo: 'Todo con botones.<br><b>Sin terminal.</b>', hasta: 2.5 }, [
    [2.5, 6.5, 'sesion', 150, 0.5, 1, 'Sesión', 'Simulación, brazo real o ambos; versión de la teleoperación; cámara de Windows en WSL2'],
    [6.5, 10.5, 'mover', 240, 0.4, 1.8, 'Mover', 'Deslizadores, posturas seguras y cinemática inversa arrastrando la pinza'],
    [10.5, 12.5, 'aprender', 120, 0.5, 1, 'Aprender', '18 lecciones, de grados de libertad a una celda industrial'],
    [12.5, 16, 'leccion_gdl', 180, 0.5, 1.3, 'Cada lección se toca en 3D', 'con fórmulas, preguntas y retos que no dejan avanzar sin entender'],
  ]);

export const estudio2 = escenaApp('Programar', '07 · SO-ARM100 Estudio · Programar', null, [
  [0, 8.5, 'programar', 660, 0.3, 1.4, 'Programar como un robot industrial', 'MoveJ, MoveL, MoveC, pinza, señales y bucles, en una celda virtual'],
  [8.5, 12, 'apilar', 900, 1.5, 4.0, 'Apilar tres cubos', 'bucles FOR y procedimientos, como en un robot de fábrica'],
  [12, 14, 'taller', 120, 0.5, 1, 'Taller RAPID', '33 programas que se corrigen solos'],
  [14, 16, 'ensayos', 90, 0.5, 1, 'Ensayos A1 a A5', 'las pruebas del brazo real, con un botón'],
]);

// ======================================================================= 10
export const repositorio = {
  nombre: 'El repositorio',
  montar(r, datos) {
    this.g = datos.grafo;
    this.eti = etiqueta('08 · El repositorio');
    this.tit = palabras('Todo el proyecto,<br><b>conectado.</b>', 'titulo2 abs');
    Object.assign(this.tit.style, { left: '120px', top: '170px' });
    this.cifras = el('div', { class: 'abs mono', style: { left: '120px', top: '370px', fontSize: '30px', lineHeight: '1.7' } });
    this.nota = el('div', { class: 'leyenda', style: { left: '120px' } }, `Grafo de conocimiento del código generado con graphify · commit ${this.g.commit}`);
    this.zonas = this.g.zonas.map((z) => el('div', { class: 'abs mono', style: { fontSize: '19px', color: z.color, whiteSpace: 'nowrap', textShadow: '0 2px 10px #000' } }, z.titulo));
    this.destacados = Object.entries(this.g.destacados).filter(([n]) => ['teleop_v13.py', 'SOARM100Interface', 'puente_ros.py', 'OneEuro', 'Ejecutor'].includes(n))
      .map(([n, i]) => ({ i, n: el('div', { class: 'flecha3d', style: { fontSize: '20px', padding: '6px 12px' } }, n) }));
    // Terminal
    this.term = el('div', { class: 'ventana', style: { left: '120px', top: '220px', width: '1050px', height: '560px' } },
      el('div', { class: 'barra' }, el('i'), el('i'), el('i'), el('span', { style: { marginLeft: '12px' } }, 'Terminal de Ubuntu')),
      el('div', { class: 'codigo', style: { padding: '30px 34px', fontSize: '27px' } }));
    this.lineas = [
      '$ git clone https://github.com/Edangelux/so-arm100-teleop',
      '$ cd so-arm100-teleop',
      '$ bash scripts/soarm.sh instalar',
      '$ soarm-app',
    ];
    this.etiCal = etiqueta('Hecho para durar', 1260, 230);
    this.calidad = ['20 capítulos de documentación paso a paso', 'Pruebas unitarias, de extremo a extremo y de mutación', 'Integración continua en GitHub Actions', 'Instalación verificada desde cero'].map((t, i) =>
      el('div', { class: 'abs', style: { left: '1260px', top: `${310 + i * 120}px`, width: '560px', display: 'flex', gap: '18px' } },
        el('div', { class: 'check', style: { flex: 'none', height: '40px' } }, '✓'), el('div', { class: 'texto', style: { fontSize: '32px' } }, t)));
    r.append(this.eti, this.tit, this.cifras, this.nota, ...this.zonas, ...this.destacados.map((d) => d.n), this.term, this.etiCal, ...this.calidad);
  },
  cuadro(tl, t, ctx) {
    const a = ventana(tl, -1, 0, 9.6, 10);
    opacidad(this.eti, ventana(tl, -1, 0, 15.6, 16));
    animarPalabras(this.tit, tl, 0.05, { paso: 0.08, salida: 9.4 });
    opacidad(this.cifras, a * prog(tl, 0.8, 1.1));
    const s = salidaExpo(prog(tl, 0.8, 4));
    this.cifras.innerHTML = `<span class="lima">${numero(2162 * s)}</span> nodos<br><span class="violeta">${numero(4548 * s)}</span> relaciones<br><span class="rosa">${Math.round(14 * s)}</span> zonas`;
    opacidad(this.nota, a * prog(tl, 2, 2.5));
    if (tl < 10) this.grafo(ctx, tl, a);
    else { this.zonas.forEach((z) => opacidad(z, 0)); this.destacados.forEach((d) => opacidad(d.n, 0)); }
    // Terminal y calidad (10–16)
    const b = ventana(tl, 10, 10.2, 15.7, 16);
    mover(this.term, { y: (1 - salida3(prog(tl, 10, 10.5))) * 50, o: b });
    let texto = '';
    let t0 = 10.5;
    for (const l of this.lineas) {
      const n = clamp(Math.floor((tl - t0) / 0.028), 0, l.length);
      if (tl >= t0) texto += `${l.slice(0, n)}\n`;
      t0 += l.length * 0.028 + 0.35;
    }
    this.term.lastChild.innerHTML = texto.replace(/\$/g, '<b>$</b>') + (Math.floor(tl * 2.5) % 2 ? '▌' : '');
    opacidad(this.etiCal, b * prog(tl, 10.5, 10.8));
    this.calidad.forEach((n, i) => mover(n, { x: (1 - salida3(prog(tl, 11 + i * 0.5, 11.5 + i * 0.5))) * 40, o: b * prog(tl, 11 + i * 0.5, 11.4 + i * 0.5) }));
    return { lienzo: tl < 10 };
  },
  grafo(ctx, tl, a) {
    const { nodos, aristas, zonas } = this.g;
    const zoom = mix(370, 430, entradaSalida(prog(tl, 0, 10)));
    const cx = 1300 + mix(0, -40, prog(tl, 0, 10)), cy = 580;
    const rot = mix(-0.04, 0.03, prog(tl, 0, 10));
    const P = (n) => {
      const x = n[0] * Math.cos(rot) - n[1] * Math.sin(rot);
      const y = n[0] * Math.sin(rot) + n[1] * Math.cos(rot);
      return [cx + x * zoom, cy - y * zoom];
    };
    // cada zona aparece en su turno; las aristas cuando sus dos extremos ya están
    const aparece = (z) => salida3(prog(tl, 0.4 + z * 0.22, 1.2 + z * 0.22));
    ctx.save();
    ctx.globalAlpha = a;
    ctx.lineWidth = 0.7;
    const ar = prog(tl, 2.5, 5.5);
    ctx.strokeStyle = 'rgba(154,134,255,0.10)';
    ctx.beginPath();
    const hasta = Math.floor(aristas.length * ar);
    for (let k = 0; k < hasta; k++) {
      const [i, j] = aristas[k];
      const p = P(nodos[i]), q = P(nodos[j]);
      ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]);
    }
    ctx.stroke();
    // Pulso que viaja por algunas aristas al ritmo
    ctx.fillStyle = '#c2ef4e';
    for (let k = 0; k < hasta; k += 23) {
      const [i, j] = aristas[k];
      const f = ((tl * 0.6 + k * 0.137) % 1);
      const p = P(nodos[i]), q = P(nodos[j]);
      ctx.globalAlpha = a * 0.7 * prog(tl, 4, 5);
      ctx.fillRect(mix(p[0], q[0], f) - 1.5, mix(p[1], q[1], f) - 1.5, 3, 3);
    }
    for (const n of nodos) {
      const s = aparece(n[2]);
      if (s <= 0) continue;
      const [x, y] = P(n);
      ctx.globalAlpha = a * s;
      ctx.fillStyle = zonas[n[2]].color;
      ctx.beginPath();
      ctx.arc(x, y, (1.6 + Math.min(n[3], 70) * 0.09) * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // Títulos de las zonas sobre su cúmulo
    const centros = zonas.map(() => [0, 0, 0, 0]);
    for (const n of nodos) { const c = centros[n[2]]; c[0] += n[0]; c[1] += n[1]; c[2]++; c[3] = Math.max(c[3], Math.hypot(n[0], n[1])); }
    const radios = zonas.map(() => 0);
    for (const n of nodos) { const c = centros[n[2]]; radios[n[2]] = Math.max(radios[n[2]], Math.hypot(n[0] - c[0] / c[2], n[1] - c[1] / c[2])); }
    this.zonas.forEach((z, i) => {
      const c = centros[i];
      if (!c[2]) { opacidad(z, 0); return; }
      const [x, y] = P([c[0] / c[2], c[1] / c[2] + radios[i] + 0.02]);
      z.style.transform = `translate(${x}px, ${y - 24}px) translateX(-50%)`;
      opacidad(z, a * prog(tl, 1.2 + i * 0.22, 1.6 + i * 0.22));
    });
    this.destacados.forEach((d, k) => {
      const [x, y] = P(nodos[d.i]);
      const t0 = 5.5 + k * 0.6;
      d.n.style.transform = `translate(${x + 14}px, ${y - 46}px)`;
      opacidad(d.n, a * ventana(tl, t0, t0 + 0.3, 9.3, 9.6));
    });
  },
};

// ======================================================================= 11
export const cierre = {
  nombre: 'Cierre',
  montar(r) {
    this.f1 = palabras('Construir<br>para <b>entender.</b>', 'titulo abs');
    Object.assign(this.f1.style, { left: '120px', top: '250px' });
    this.f2 = palabras('Medir para<br><b>mejorar.</b>', 'titulo abs');
    Object.assign(this.f2.style, { left: '120px', top: '560px' });
    this.equipo = el('div', { class: 'abs', style: { left: '0', width: '1920px', top: '250px', textAlign: 'center' } },
      el('div', { class: 'etiqueta', style: { justifyContent: 'center' } }, 'Equipo'),
      el('div', { style: { fontSize: '60px', fontWeight: 800, marginTop: '40px', lineHeight: '1.35' } },
        'Cristhian Guido · Eddy Torrez', el('br'), 'Rodrigo Tinoco · Orlando Cisneros'),
      el('div', { class: 'texto tenue', style: { marginTop: '44px', fontSize: '36px' } }, 'Tutor: MSc. Kevin Josué Flores Carvajal'),
      el('div', { class: 'mono', style: { marginTop: '60px', fontSize: '24px', letterSpacing: '.12em', color: 'var(--tenue)' } },
        'INGENIERÍA MECATRÓNICA · UNIVERSIDAD TECNOLÓGICA LA SALLE · LEÓN, NICARAGUA · 2026'));
    this.fin = el('div', { class: 'abs', style: { left: '0', width: '1920px', top: '360px', textAlign: 'center' } },
      el('div', { class: 'titulo', style: { fontSize: '210px', textShadow: '0 0 70px rgba(117,83,255,.6)' } }, 'SO-ARM100'),
      el('div', { class: 'texto', style: { marginTop: '24px' } }, 'Teleoperación por visión · código abierto'),
      el('div', { class: 'pastilla', style: { marginTop: '50px', fontSize: '30px', padding: '14px 30px' } }, 'github.com/Edangelux/so-arm100-teleop'));
    r.append(this.f1, this.f2, this.equipo, this.fin);
  },
  cuadro(tl) {
    animarPalabras(this.f1, tl, 0.3, { paso: 0.09, salida: 5.6 });
    animarPalabras(this.f2, tl, 2.3, { paso: 0.09, salida: 5.6 });
    mover(this.equipo, { y: (1 - salida3(prog(tl, 6, 6.6))) * 40, o: ventana(tl, 6, 6.4, 11.6, 12) });
    mover(this.fin, { s: mix(1.05, 1, salida3(prog(tl, 12, 13))), o: ventana(tl, 12, 12.5, 15.2, 15.95) });
    const negro = prog(tl, 15, 15.95);
    if (tl < 6) {
      return { gl: { q: respirar([0.3 * Math.sin(tl * 0.5), -0.25, 0.45, -0.35, tl * 0.25, 0.35], tl, 1.5), cam: orbita(0.3 + tl * 0.12, mix(0.32, 0.42, tl / 6), mix(1.0, 1.15, tl / 6), [0, 0.17, 0], 30), desplazar: [260, 10] }, negro };
    }
    return { negro };
  },
};
