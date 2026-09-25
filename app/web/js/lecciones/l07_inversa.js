// Lección 7: cinemática inversa. Solución geométrica (dos soluciones o
// ninguna) y método numérico por mínimos cuadrados amortiguados.
import * as THREE from 'three';
import { el } from '../ui.js';
import { deslizador, lectura, figura, grafica, esfera, linea, geometriaPlana, GRADO, grados } from './comun.js';

const COSENOS = `<svg viewBox="0 0 520 210" xmlns="http://www.w3.org/2000/svg" font-family="Rubik, sans-serif" font-size="13">
<circle cx="70" cy="170" r="6" fill="#fd44b0"/><text x="30" y="195" fill="#bdb8c0">hombro</text>
<circle cx="380" cy="120" r="6" fill="#ffb287"/><text x="392" y="124" fill="#ffb287">muñeca (r_w, z_w)</text>
<line x1="70" y1="170" x2="380" y2="120" stroke="#8f879a" stroke-dasharray="5 4"/><text x="210" y="160" fill="#8f879a">distancia ρ</text>
<line x1="70" y1="170" x2="190" y2="40" stroke="#c2ef4e" stroke-width="6" stroke-linecap="round"/><line x1="190" y1="40" x2="380" y2="120" stroke="#c2ef4e" stroke-width="6" stroke-linecap="round"/>
<text x="92" y="92" fill="#c2ef4e">L₂</text><text x="290" y="70" fill="#c2ef4e">L₃</text><text x="176" y="30" fill="#c2ef4e">codo arriba</text>
<line x1="70" y1="170" x2="245" y2="200" stroke="#7553ff" stroke-width="6" stroke-linecap="round" opacity="0.8"/><line x1="245" y1="200" x2="380" y2="120" stroke="#7553ff" stroke-width="6" stroke-linecap="round" opacity="0.8"/>
<text x="250" y="208" fill="#a597ff">codo abajo</text>
</svg>`;

export default {
  titulo: 'Cinemática inversa',
  resumen: 'El problema al revés: dada la pose deseada de la pinza, encontrar los ángulos. Puede tener dos soluciones, una o ninguna.',
  conceptos: [
    ['Cinemática inversa', 'Encontrar $q$ tal que $f(q) = x_{\\text{deseada}}$. Es no lineal y puede tener varias soluciones o ninguna.'],
    ['Solución cerrada (geométrica)', 'Fórmulas explícitas; exactas y rápidas, pero dependen de la forma del robot.'],
    ['Solución numérica', 'Parte de una postura y la corrige paso a paso con el jacobiano hasta anular el error. Sirve para cualquier robot.'],
    ['Codo arriba / codo abajo', 'Las dos posturas del brazo que dejan la muñeca en el mismo punto.'],
    ['Mínimos cuadrados amortiguados', 'Método numérico robusto cerca de singularidades: $\\Delta q = J^\\top (J J^\\top + \\lambda^2 I)^{-1} e$.'],
  ],
  referencias: [
    'analisis/cinematica: cinemática inversa en forma cerrada, 3000 de 3000 casos con error de $10^{-16}$ m.',
    'Buss, S. (2004). «Introduction to inverse kinematics with Jacobian transpose, pseudoinverse and damped least squares methods».',
    'Wampler, C. (1986). Mínimos cuadrados amortiguados aplicados a manipuladores.',
  ],
  pasos: [
    {
      titulo: 'Diga dónde, el robot calcula cómo',
      texto: 'Arrastre las flechas de la esfera o mueva los deslizadores. El robot sólido muestra la solución <b>codo arriba</b> y la silueta, la de <b>codo abajo</b>: dos posturas para la misma pose de la pinza.',
      ancho: true,
      preparar(app, cuerpo) {
        const g = geometriaPlana(app);
        const v = { x: 0.06, y: -0.25, z: 0.12, cab: -60 * GRADO };
        const lec = lectura();
        const resolver = () => {
          const s = g.inversa(v.x, v.y, v.z, v.cab);
          const validas = s.soluciones.filter((x) => x.dentro);
          const arriba = validas.find((x) => x.codo === 'arriba') || validas[0];
          const abajo = validas.find((x) => x !== arriba);
          if (arriba) app.escena.fijarPostura([...arriba.q, 0, 0.5]);
          app.escena.fijarFantasma(abajo ? [...abajo.q, 0, 0.5] : null);
          app.escena.objetivo.material.color.set(validas.length ? 0xc2ef4e : 0xfd44b0);
          const txt = (x) => `[${x.q.map((a) => grados(a).toFixed(1).padStart(6)).join(',')}]°${x.dentro ? '' : '  (fuera de límites)'}`;
          lec.textContent = `D = ${s.D.toFixed(3)}   →   ${Math.abs(s.D) > 1 ? 'sin solución: la muñeca no llega' : `${validas.length} solución(es) dentro de los límites`}\n${s.soluciones.map((x) => `codo ${x.codo.padEnd(6)} ${txt(x)}`).join('\n')}`;
        };
        const mm = (x) => `${(x * 1000).toFixed(0)} mm`;
        const dx = deslizador('x', { min: -0.3, max: 0.3, paso: 0.001, valor: v.x, formato: mm, alCambiar: (a) => { v.x = a; mover(); } });
        const dy = deslizador('y', { min: -0.45, max: 0.0, paso: 0.001, valor: v.y, formato: mm, alCambiar: (a) => { v.y = a; mover(); } });
        const dz = deslizador('z', { min: -0.05, max: 0.4, paso: 0.001, valor: v.z, formato: mm, alCambiar: (a) => { v.z = a; mover(); } });
        const dc = deslizador('Cabeceo', { min: -1.57, max: 1.2, paso: 0.01, valor: v.cab, formato: (a) => `${grados(a).toFixed(0)}°`, alCambiar: (a) => { v.cab = a; resolver(); } });
        const mover = () => { app.escena.objetivo.position.set(v.x, v.y, v.z); resolver(); };
        app.escena.mostrarObjetivo(true, new THREE.Vector3(v.x, v.y, v.z));
        app.escena.alArrastrar = (p) => { v.x = p.x; v.y = p.y; v.z = p.z; dx.fijar(p.x); dy.fijar(p.y); dz.fijar(p.z); resolver(); };
        cuerpo.append(dx, dy, dz, dc, lec);
        resolver();
        return () => { app.escena.mostrarObjetivo(false); app.escena.alArrastrar = null; app.escena.fijarFantasma(null); };
      },
      detalle: `<p>La <b>cinemática inversa</b> es el problema que resuelve cualquier robot al que se le pide «ve a este punto»: encontrar los ángulos $q$ que producen la pose deseada $x_d$:</p>
$$f(q) = x_d \\quad\\Rightarrow\\quad q = f^{-1}(x_d)\\;?$$
<p>A diferencia de la directa, la inversa:</p>
<ul><li>puede tener <b>varias soluciones</b> (aquí, codo arriba y codo abajo; con la base girada 180° aparecen dos más «por detrás»),</li>
<li>puede <b>no tener ninguna</b> (punto fuera del alcance, u orientación imposible),</li>
<li>puede tener <b>infinitas</b> en un robot redundante (con más GDL que los necesarios, como el brazo humano).</li></ul>
<p>Para elegir entre varias soluciones, un controlador suele tomar la más cercana a la postura actual, para que el brazo no dé un giro innecesario. La pestaña <b>Programar</b> hace eso en cada <code>MoveL</code>: cada punto del camino se resuelve partiendo del anterior.</p>`,
    },
    {
      titulo: 'La solución geométrica',
      texto: 'Con el cabeceo fijado, la <b>muñeca</b> queda en un punto conocido. Llegar a ella con brazo y antebrazo es un triángulo: el <b>teorema del coseno</b> da el ángulo del codo, con dos signos posibles.',
      ancho: true,
      preparar(app, cuerpo) {
        cuerpo.append(figura(COSENOS));
        app.escena.fijarPostura([0, 0.4, -0.2, 0.9, 0, 0.5]);
        app.escena.fijarFantasma(null);
      },
      detalle: (app) => {
        const g = geometriaPlana(app);
        const f = (v) => (v * 1000).toFixed(1).replace('.', '{,}');
        return `<p>El SO-ARM100 admite una solución cerrada en cuatro pasos, porque hombro, codo y muñeca trabajan en un plano. Datos: punta $(x, y, z)$ y cabeceo $\\varphi$.</p>
<h4>1. Giro de la base</h4>
$$q_1 = \\operatorname{atan2}\\big(-x,\\; -(y - y_{eje})\\big), \\qquad r = \\sqrt{x^2 + (y - y_{eje})^2}$$
<h4>2. Posición de la muñeca</h4>
<p>La muñeca está ${f(g.L4)} mm detrás de la punta, en la dirección del cabeceo. Respecto del hombro:</p>
$$r_w = r - L_4\\cos\\varphi - r_0, \\qquad z_w = z - L_4\\sin\\varphi - z_0$$
<h4>3. Ángulo del codo (teorema del coseno)</h4>
$$D = \\cos\\delta = \\frac{r_w^2 + z_w^2 - L_2^2 - L_3^2}{2 L_2 L_3}, \\qquad \\delta = \\pm\\arccos D$$
<p>Si $|D| > 1$ la muñeca está más lejos de lo que miden brazo y antebrazo juntos (o más cerca de lo que permiten): <b>no hay solución</b>. Si $D = \\pm 1$, hay una sola (brazo estirado o plegado). Si no, hay dos: $\\delta$ positivo y negativo.</p>
<h4>4. Hombro y muñeca</h4>
$$\\varphi_2 = \\operatorname{atan2}(z_w, r_w) - \\operatorname{atan2}(L_3\\sin\\delta,\\; L_2 + L_3\\cos\\delta),\\qquad \\varphi_3 = \\varphi_2 + \\delta$$
$$q_2 = \\varphi_2^0 - \\varphi_2, \\qquad q_3 = \\varphi_3^0 - q_2 - \\varphi_3, \\qquad q_4 = -q_2 - q_3 - \\varphi$$
<p>con $\\varphi_2^0$ y $\\varphi_3^0$ de la lección 6. Por último $q_5$ = giro pedido. La aplicación comprobó estas fórmulas contra la cinemática directa en 3000 posturas al azar: todas coinciden con error menor que $10^{-9}$ mm.</p>
<p>La singularidad del codo aparece cuando $\\delta = 0$: brazo y antebrazo alineados, $q_3 = \\varphi_3^0 - \\varphi_2^0 \\approx -73{,}8^\\circ$. Es el valor que obtuvo el análisis cinemático del proyecto.</p>`;
      },
    },
    {
      titulo: 'El método numérico, paso a paso',
      texto: 'Sin fórmulas: se parte de <b>init</b> y se corrige la postura con el jacobiano hasta que la punta llega. Mire cómo el error baja en cada iteración.',
      ancho: true,
      preparar(app, cuerpo) {
        const meta = new THREE.Vector3(0.12, -0.22, 0.08);
        esfera(app, meta, 0.014, 0xc2ef4e, 0.8);
        const q = [0, 0, 0, 0, 0, 0.5];
        app.escena.fijarPostura(q);
        const gr = grafica({ ancho: 600, alto: 180, x: [0, 25], y: [0, 350], xEtq: 'iteración', yEtq: 'error de posición (mm)' });
        const lec = lectura();
        const rastro = [app.cadena.efector(q)];
        const l = linea(app, rastro, 0xffb287);
        cuerpo.append(gr, lec);
        const errores = [];
        let k = 0, vivo = true;
        const paso = () => {
          if (!vivo || k > 25) return;
          const p = app.cadena.efector(q);
          const e = meta.clone().sub(p);
          errores.push([k, e.length() * 1000]);
          gr.dibujar([{ color: '#c2ef4e', puntos: errores, marca: errores[errores.length - 1] }]);
          lec.textContent = `iteración ${k}   error ${(e.length() * 1000).toFixed(2)} mm   q = [${q.slice(0, 4).map((v) => grados(v).toFixed(1)).join(', ')}]°`;
          if (e.length() < 0.0005) return;
          const r = app.cadena.ik(meta, q.slice(0, 5), { iteraciones: 1 });
          r.q.slice(0, 4).forEach((v, i) => { q[i] = v; });
          app.escena.fijarPostura(q);
          rastro.push(app.cadena.efector(q)); l.fijar(rastro);
          k++;
          setTimeout(paso, 450);
        };
        paso();
        return () => { vivo = false; };
      },
      detalle: `<p>El método numérico no necesita conocer la forma del robot: sólo la cinemática directa. La idea es linealizar alrededor de la postura actual con el <b>jacobiano</b> $J$ (lección 8), que dice cuánto se mueve la punta por cada pequeño cambio de cada ángulo:</p>
$$\\Delta x \\approx J(q)\\,\\Delta q$$
<p>Se quiere un $\\Delta q$ que lleve la punta hacia el objetivo, es decir $J\\Delta q \\approx e = x_d - f(q)$. Con <b>mínimos cuadrados amortiguados</b> (Levenberg–Marquardt):</p>
$$\\Delta q = J^\\top \\left(J J^\\top + \\lambda^2 I\\right)^{-1} e$$
<p>Se aplica $q \\leftarrow q + \\Delta q$, se recalcula el error y se repite hasta que sea menor que una tolerancia. El término $\\lambda^2 I$ evita que $\\Delta q$ se dispare cerca de una singularidad, donde $J J^\\top$ casi no tiene inversa.</p>
<p>Ventajas: sirve para cualquier robot y cualquier combinación de objetivos (la aplicación lo usa para posición + cabeceo en <code>ikPose</code>). Desventajas: da <b>una</b> solución, la más cercana a la semilla, y puede quedarse atascado si el objetivo es inalcanzable. Por eso <code>ikPose</code> prueba varias semillas.</p>
<p>En la gráfica se ve la convergencia típica: grandes correcciones al principio y un final rápido cuando la linealización se vuelve exacta.</p>`,
    },
    {
      titulo: 'Compruebe lo aprendido',
      texto: 'Una pregunta.',
      pregunta: {
        enunciado: 'Al resolver la inversa, el cálculo da $D = \\cos\\delta = 1{,}08$. ¿Qué significa?',
        opciones: ['Hay dos soluciones', 'Hay una sola solución, con el brazo estirado', 'No hay solución: la muñeca está más lejos de lo que alcanzan brazo y antebrazo', 'El codo está en su límite'],
        correcta: 2,
        explicacion: 'Ningún ángulo tiene coseno mayor que 1. Geométricamente, el triángulo hombro–codo–muñeca no se puede cerrar.',
      },
      preparar(app) { app.escena.fijarPostura([0, 0.3, 0.2, 0.4, 0, 0.5]); },
    },
    {
      titulo: 'Numérico o geométrico',
      texto: 'Última.',
      pregunta: {
        enunciado: '¿Por qué los robots industriales de 6 ejes suelen tener <b>muñeca esférica</b> (tres ejes que se cruzan en un punto)?',
        opciones: ['Porque es más barata', 'Porque así posición y orientación se separan y la inversa tiene solución cerrada', 'Porque evita todas las singularidades', 'Porque la exige ISO 10218'],
        correcta: 1,
        explicacion: 'Con los tres ejes de la muñeca cortándose en un punto, los tres primeros ejes fijan la posición de ese punto y la muñeca la orientación (desacoplamiento de Pieper): la inversa se resuelve con fórmulas.',
      },
      preparar(app) { app.escena.fijarPostura([0, 0.3, 0.2, 0.4, 0, 0.5]); },
    },
  ],
};
