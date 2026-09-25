// Lección 5: transformaciones homogéneas, encadenamiento de marcos y D-H.
import * as THREE from 'three';
import { el } from '../ui.js';
import { mini, marco, matriz, filas4, deslizador, formula, figura, botones, linea, vaciar, BRAZO, grados } from './comun.js';

const POSE = [0.25, 0.3, -0.5, 0.5, 0.3, 0.5];
const claseT = (i, j) => (i === 3 ? 'u' : j === 3 ? 'p' : 'r');

const DH_SVG = `<svg viewBox="0 0 560 200" xmlns="http://www.w3.org/2000/svg" font-family="Rubik, sans-serif" font-size="13">
<defs><marker id="dh" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#bdb8c0"/></marker></defs>
<line x1="90" y1="180" x2="90" y2="30" stroke="#7553ff" stroke-width="3" marker-end="url(#dh)"/><text x="98" y="36" fill="#7553ff">z₍ᵢ₋₁₎ (eje de la articulación i)</text>
<line x1="90" y1="140" x2="170" y2="140" stroke="#fd44b0" stroke-width="3" marker-end="url(#dh)"/><text x="130" y="158" fill="#fd44b0">x₍ᵢ₋₁₎</text>
<line x1="90" y1="140" x2="90" y2="80" stroke="#ffb287" stroke-width="7" opacity="0.5"/><text x="20" y="114" fill="#ffb287">dᵢ</text>
<path d="M 128 140 A 38 38 0 0 0 119 113" fill="none" stroke="#c2ef4e" stroke-width="2"/><text x="132" y="122" fill="#c2ef4e">θᵢ</text>
<line x1="90" y1="80" x2="330" y2="80" stroke="#bdb8c0" stroke-dasharray="5 4"/>
<line x1="90" y1="80" x2="330" y2="80" stroke="#ffb287" stroke-width="7" opacity="0.5"/><text x="200" y="72" fill="#ffb287">aᵢ (normal común)</text>
<line x1="330" y1="80" x2="420" y2="80" stroke="#fd44b0" stroke-width="3" marker-end="url(#dh)"/><text x="424" y="84" fill="#fd44b0">xᵢ</text>
<line x1="330" y1="110" x2="380" y2="20" stroke="#7553ff" stroke-width="3" marker-end="url(#dh)"/><text x="386" y="26" fill="#7553ff">zᵢ (eje i+1)</text>
<path d="M 330 50 A 30 30 0 0 1 346 54" fill="none" stroke="#c2ef4e" stroke-width="2"/><text x="350" y="46" fill="#c2ef4e">αᵢ</text>
<text x="20" y="196" fill="#bdb8c0" font-size="12">θ: giro sobre z₍ᵢ₋₁₎ · d: avance sobre z₍ᵢ₋₁₎ · a: avance sobre xᵢ · α: giro sobre xᵢ</text>
</svg>`;

// T de D-H: Rot_z(θ) · Trans_z(d) · Trans_x(a) · Rot_x(α)
export function dh(theta, d, a, alfa) {
  const ct = Math.cos(theta), st = Math.sin(theta), ca = Math.cos(alfa), sa = Math.sin(alfa);
  return new THREE.Matrix4().set(ct, -st * ca, st * sa, a * ct, st, ct * ca, -ct * sa, a * st, 0, sa, ca, d, 0, 0, 0, 1);
}

export default {
  titulo: 'Transformaciones homogéneas y D-H',
  resumen: 'Una sola matriz 4×4 para posición y orientación, cómo se encadenan los marcos de cada eslabón y la convención de Denavit–Hartenberg.',
  conceptos: [
    ['Transformación homogénea', '$T = \\begin{bmatrix} R & p \\\\ 0 & 1\\end{bmatrix}$: rotación y traslación en una matriz 4×4.'],
    ['Composición', '$T_{0}^{2} = T_{0}^{1}\\,T_{1}^{2}$: la pose de un marco respecto de otro se obtiene multiplicando las intermedias.'],
    ['Inversa', '$T^{-1} = \\begin{bmatrix} R^\\top & -R^\\top p \\\\ 0 & 1\\end{bmatrix}$, sin invertir numéricamente.'],
    ['Denavit–Hartenberg', 'Convención que describe cada eslabón con cuatro números: $\\theta_i$, $d_i$, $a_i$, $\\alpha_i$.'],
    ['URDF', 'Formato de ROS que describe cada articulación con un origen (xyz, rpy) y un eje. Es más general que D-H.'],
  ],
  referencias: [
    'Denavit, J. y Hartenberg, R. S. (1955). «A kinematic notation for lower-pair mechanisms based on matrices», J. Applied Mechanics.',
    'Craig, J. J. <i>Introduction to Robotics</i>, cap. 3 (convención D-H modificada).',
    'analisis/cinematica/Capitulo_analisis_cinematico.md: tabla D-H del SO-ARM100 derivada del URDF.',
  ],
  pasos: [
    {
      titulo: 'Posición y orientación en una matriz',
      texto: 'La pose de la pinza cabe en una matriz 4×4: arriba a la izquierda, la <b style="color:#a597ff">rotación</b> $R$; a la derecha, la <b style="color:#c2ef4e">posición</b> $p$ en metros; abajo, la fila fija $[0\\;0\\;0\\;1]$.',
      ancho: true,
      preparar(app, cuerpo) {
        const q = POSE.slice();
        app.escena.fijarPostura(q);
        const m = marco(app, app.cadena.fk(q).efector, { largo: 0.07 });
        const t = matriz(filas4(app.cadena.fk(q).efector), { clases: claseT });
        const act = () => { const T = app.cadena.fk(q).efector; m.fijar(T); t.fijar(filas4(T)); };
        cuerpo.append(el('div', { class: 'fila', style: 'gap:16px;align-items:center' }, formula('T_{0}^{\\,pinza} ='), t), mini(app, q, act));
        act();
      },
      detalle: `<p>Una <b>transformación homogénea</b> junta la rotación $R$ y la traslación $p$ en una sola matriz:</p>
$$T = \\begin{bmatrix} R & p \\\\ 0\\;0\\;0 & 1 \\end{bmatrix} = \\begin{bmatrix} r_{11} & r_{12} & r_{13} & p_x\\\\ r_{21} & r_{22} & r_{23} & p_y\\\\ r_{31} & r_{32} & r_{33} & p_z\\\\ 0&0&0&1 \\end{bmatrix}$$
<p>Para transformar un punto se le agrega un 1 como cuarta coordenada (coordenadas <b>homogéneas</b>):</p>
$$\\begin{bmatrix} x' \\\\ 1 \\end{bmatrix} = T \\begin{bmatrix} x \\\\ 1 \\end{bmatrix} = \\begin{bmatrix} R x + p \\\\ 1 \\end{bmatrix}$$
<p>Así, girar y trasladar es <b>una sola multiplicación</b>. Un vector de dirección (no un punto) lleva un 0 en lugar del 1, de modo que sólo gira y no se traslada.</p>
<p>La inversa también tiene forma cerrada, gracias a $R^{-1} = R^\\top$:</p>
$$T^{-1} = \\begin{bmatrix} R^\\top & -R^\\top p \\\\ 0 & 1\\end{bmatrix}$$
<p>En ROS, cada marco de <code>/tf</code> es esto mismo, con la rotación guardada como cuaternión.</p>`,
    },
    {
      titulo: 'Un marco por eslabón',
      texto: 'Cada articulación tiene su marco. La pose de la pinza se obtiene <b>multiplicando</b> las transformaciones de un marco al siguiente, de la base a la punta. Pulse <b>Siguiente eslabón</b>.',
      ancho: true,
      preparar(app, cuerpo) {
        const q = POSE.slice();
        app.escena.fijarPostura(q);
        const nombres = [...BRAZO, 'efector'];
        const f = app.cadena.fk(q);
        let k = 0;
        const formulaNodo = el('div');
        const tabla = matriz(filas4(new THREE.Matrix4()), { clases: claseT });
        const pintar = () => {
          vaciar(app);
          marco(app, new THREE.Matrix4(), { largo: 0.05, nombre: '0 (base)' });
          const pts = [new THREE.Vector3()];
          for (let i = 0; i <= k; i++) {
            const n = nombres[i];
            marco(app, f[n], { largo: 0.04, nombre: `${i + 1}`, etiquetas: false });
            pts.push(new THREE.Vector3().setFromMatrixPosition(f[n]));
          }
          linea(app, pts, 0xffb287);
          app.escena.resaltar(BRAZO[k] ?? null);
          const factores = nombres.slice(0, k + 1).map((_, i) => `T_{${i}}^{${i + 1}}`).join('\\,');
          formulaNodo.replaceChildren(formula(`T_{0}^{${k + 1}} = ${factores}`));
          tabla.fijar(filas4(f[nombres[k]]));
        };
        cuerpo.append(formulaNodo, tabla, botones(['Siguiente eslabón', () => { k = Math.min(nombres.length - 1, k + 1); pintar(); }], ['Volver al primero', () => { k = 0; pintar(); }]));
        pintar();
      },
      detalle: `<p>Si se conoce la pose del marco 1 respecto de la base ($T_0^1$) y la del marco 2 respecto del 1 ($T_1^2$), la del marco 2 respecto de la base es el <b>producto</b>:</p>
$$T_0^2 = T_0^1\\,T_1^2$$
<p>El orden importa y se lee como un camino: base → 1 → 2. Para el brazo completo:</p>
$$T_0^{\\,pinza} = T_0^1\\,T_1^2\\,T_2^3\\,T_3^4\\,T_4^5\\,T_5^{\\,pinza}$$
<p>Cada factor tiene una parte <b>fija</b> (la geometría del eslabón: dónde está la siguiente articulación y cómo está girado su eje) y una parte que <b>depende del ángulo</b> de la articulación. En el URDF del SO-ARM100 cada factor es</p>
$$T_{i-1}^{i}(q_i) = T_{\\text{origen}}(xyz,\\,rpy)\\;\\operatorname{Rot}(\\hat{e}_i,\\,q_i)$$
<p>donde $\\hat{e}_i$ es el eje declarado en <code>&lt;axis xyz="…"/&gt;</code>. La aplicación calcula exactamente esto en <code>cinematica.js</code> (función <code>fk</code>), y es lo que hace <code>robot_state_publisher</code> en ROS para publicar <code>/tf</code>.</p>
<p>En la figura, la línea durazno une los orígenes de los marcos: es el «esqueleto» cinemático del brazo, que no tiene por qué coincidir con la forma de las piezas.</p>`,
    },
    {
      titulo: 'La convención de Denavit–Hartenberg',
      texto: 'D-H describe cada eslabón con <b>cuatro números</b>: dos giros ($\\theta$, $\\alpha$) y dos distancias ($d$, $a$). Mueva los cuatro y vea cómo se ubica el marco $i$ respecto del $i-1$.',
      ancho: true,
      preparar(app, cuerpo) {
        app.escena.fijarPostura([1.0, -0.35, 0.7, 0.5, 0, 0.5]);
        const base = new THREE.Matrix4().setPosition(0.0, -0.3, 0.12);
        marco(app, base, { largo: 0.05, nombre: 'i−1' });
        const m = marco(app, base, { largo: 0.05, nombre: 'i' });
        const v = { th: 0.6, d: 0.06, a: 0.08, al: 0.8 };
        const t = matriz(filas4(new THREE.Matrix4()), { clases: claseT });
        const l = linea(app, [new THREE.Vector3(), new THREE.Vector3()], 0xffb287);
        const act = () => {
          const T = base.clone().multiply(dh(v.th, v.d, v.a, v.al));
          m.fijar(T);
          t.fijar(filas4(dh(v.th, v.d, v.a, v.al)));
          const o = new THREE.Vector3().setFromMatrixPosition(base);
          const med = o.clone().add(new THREE.Vector3(0, 0, v.d));
          l.fijar([o, med, new THREE.Vector3().setFromMatrixPosition(T)]);
        };
        const g = (x) => `${grados(x).toFixed(0)}°`, mm = (x) => `${(x * 1000).toFixed(0)} mm`;
        cuerpo.append(figura(DH_SVG), formula('T_{i-1}^{i} = \\operatorname{Rot}_z(\\theta_i)\\,\\operatorname{Trans}_z(d_i)\\,\\operatorname{Trans}_x(a_i)\\,\\operatorname{Rot}_x(\\alpha_i)'),
          deslizador('θ (giro en z)', { min: -3.14, max: 3.14, valor: v.th, formato: g, alCambiar: (x) => { v.th = x; act(); } }),
          deslizador('d (avance en z)', { min: 0, max: 0.12, paso: 0.001, valor: v.d, formato: mm, alCambiar: (x) => { v.d = x; act(); } }),
          deslizador('a (avance en x)', { min: 0, max: 0.15, paso: 0.001, valor: v.a, formato: mm, alCambiar: (x) => { v.a = x; act(); } }),
          deslizador('α (giro en x)', { min: -3.14, max: 3.14, valor: v.al, formato: g, alCambiar: (x) => { v.al = x; act(); } }), t);
        act();
      },
      detalle: `<p>La convención de <b>Denavit–Hartenberg</b> (1955) reduce cada transformación entre eslabones a cuatro parámetros, eligiendo los marcos con dos reglas: el eje $z_{i-1}$ va sobre el eje de la articulación $i$, y el eje $x_i$ va sobre la <b>normal común</b> entre $z_{i-1}$ y $z_i$.</p>
<table><tr><th>Parámetro</th><th>Qué es</th><th>Tipo</th></tr>
<tr><td>$\\theta_i$</td><td>giro alrededor de $z_{i-1}$</td><td>variable si la articulación es giratoria</td></tr>
<tr><td>$d_i$</td><td>avance a lo largo de $z_{i-1}$</td><td>variable si es prismática</td></tr>
<tr><td>$a_i$</td><td>longitud de la normal común (a lo largo de $x_i$)</td><td>constante</td></tr>
<tr><td>$\\alpha_i$</td><td>giro alrededor de $x_i$ entre $z_{i-1}$ y $z_i$</td><td>constante</td></tr></table>
$$T_{i-1}^{i} = \\begin{bmatrix} c_{\\theta} & -s_{\\theta}c_{\\alpha} & s_{\\theta}s_{\\alpha} & a\\,c_{\\theta}\\\\ s_{\\theta} & c_{\\theta}c_{\\alpha} & -c_{\\theta}s_{\\alpha} & a\\,s_{\\theta}\\\\ 0 & s_{\\alpha} & c_{\\alpha} & d\\\\ 0&0&0&1 \\end{bmatrix}$$
<p>La ventaja es la compacidad: una tabla de 4 columnas describe todo el robot. La desventaja es que los marcos D-H no coinciden con las piezas, y elegirlos bien requiere práctica (y existen dos variantes, la clásica y la modificada de Craig).</p>`,
    },
    {
      titulo: 'La tabla D-H del SO-ARM100',
      texto: 'El repositorio oficial del brazo no publica parámetros D-H. El análisis cinemático del proyecto los <b>derivó del URDF</b> y los validó contra tres implementaciones independientes.',
      ancho: true,
      preparar(app, cuerpo) {
        app.escena.fijarPostura([0, 0, 0, 0, 0, 0.5]);
        app.escena.verEtiquetas(true);
        const tabla = el('div', { class: 'texto-largo', html: `<table><tr><th>i</th><th>Articulación</th><th>θᵢ</th><th>dᵢ (m)</th><th>aᵢ (m)</th><th>αᵢ</th></tr>
<tr><td>1</td><td>Giro de la base</td><td>q₁</td><td>−0,1025</td><td>0,0306</td><td>+90°</td></tr>
<tr><td>2</td><td>Hombro</td><td>q₂ − 76,032°</td><td>0</td><td>0,1160</td><td>0°</td></tr>
<tr><td>3</td><td>Codo</td><td>q₃ + 73,825°</td><td>0</td><td>0,1350</td><td>0°</td></tr>
<tr><td>4</td><td>Flexión de muñeca</td><td>q₄ − 87,792°</td><td>0</td><td>0</td><td>+90°</td></tr>
<tr><td>5</td><td>Giro de muñeca</td><td>q₅ + 180°</td><td>0</td><td>0</td><td>0°</td></tr></table>` });
        cuerpo.append(tabla);
      },
      detalle: `<p>La tabla procede de <code>analisis/cinematica/Capitulo_analisis_cinematico.md</code>. Se obtuvo aplicando el procedimiento de la normal común a los ejes y anclajes declarados en <code>so_arm_100_5dof_arm.urdf.xacro</code>, y se contrastó contra el propio URDF, contra el Robotics Toolbox de Peter Corke y contra una cadena de transformadas elementales: coinciden con errores del orden de $10^{-15}$, que es el redondeo de la aritmética de punto flotante.</p>
<p>Lo que muestra la tabla:</p>
<ul><li>$a_2 = 0{,}1160$ m y $a_3 = 0{,}1350$ m son las <b>longitudes del brazo y del antebrazo</b>.</li>
<li>$\\alpha_2 = \\alpha_3 = 0$: los ejes del hombro, el codo y la muñeca son <b>paralelos</b>. Es la razón de que el brazo trabaje en un plano (lección 3).</li>
<li>Los desfases constantes de $\\theta$ (−76,032°, +73,825°, −87,792°, +180°) convierten el cero mecánico del URDF (brazo en <code>init</code>) al cero que impone la convención.</li>
<li>La distancia de la muñeca a la punta (150,1 mm) no aparece en la tabla: se agrega como una transformación fija de herramienta al final.</li></ul>
<p>La aplicación no usa esta tabla: calcula con los orígenes del URDF, que es lo que usan Gazebo y MoveIt. Las dos descripciones dan la misma pose de la pinza.</p>`,
    },
    {
      titulo: 'Compruebe lo aprendido',
      texto: 'Una pregunta.',
      pregunta: {
        enunciado: 'En la tabla D-H del SO-ARM100, ¿qué indica que $\\alpha_2 = \\alpha_3 = 0$?',
        opciones: ['Que el hombro y el codo no giran', 'Que los ejes del hombro, el codo y la muñeca son paralelos', 'Que el brazo y el antebrazo miden lo mismo', 'Que son articulaciones prismáticas'],
        correcta: 1,
        explicacion: '$\\alpha$ es el ángulo entre ejes consecutivos. Si vale 0, los ejes son paralelos, y esas articulaciones mueven la punta dentro de un mismo plano.',
      },
      preparar(app) { app.escena.fijarPostura(POSE); },
    },
    {
      titulo: 'El orden importa',
      texto: 'Última.',
      pregunta: {
        enunciado: 'Se conocen $T_0^1$ (base → hombro) y $T_1^2$ (hombro → codo). ¿Qué producto da la pose del codo en la base?',
        opciones: ['$T_1^2\\,T_0^1$', '$T_0^1\\,T_1^2$', '$T_0^1 + T_1^2$', '$(T_0^1)^{-1}\\,T_1^2$'],
        correcta: 1,
        explicacion: 'Se multiplica siguiendo el camino base → 1 → 2: $T_0^2 = T_0^1 T_1^2$. El producto de matrices no es conmutativo.',
      },
      preparar(app) { app.escena.fijarPostura(POSE); },
    },
  ],
};
