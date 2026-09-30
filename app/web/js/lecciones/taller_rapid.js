// Taller de programación RAPID: seis lecciones en las que casi cada paso es un
// programa que hay que escribir. Se corrigen solas en el robot virtual con la
// celda de trabajo (ver taller.js). Coordenadas en mm del marco de la base.
import { ejercicio, C, E, SIN_CUBO1, aLoLargoDeHerramienta } from './taller.js';

const REF_RAPID = 'ABB. <i>Technical reference manual — RAPID Instructions, Functions and Data types</i> y <i>RAPID overview</i> (MoveJ, MoveL, MoveC, MoveAbsJ, Offs, RelTool, speeddata, zonedata, FOR, WHILE, IF, PROC, SetDO, WaitDI).';
const REF_SICILIANO = (cap) => `Siciliano, B., Sciavicco, L., Villani, L. y Oriolo, G. (2009). <i>Robotics: Modelling, Planning and Control</i>. Springer. ${cap}`;
const REF_PROGRAMACION = 'Pan, Z., Polden, J., Larkin, N., Van Duin, S. y Norrish, J. (2012). Recent progress on programming methods for industrial robots. <i>Robotics and Computer-Integrated Manufacturing</i>, 28(2), 87-94.';
const REF_BIGGS = 'Biggs, G. y MacDonald, B. (2003). A survey of robot programming systems. <i>Proceedings of the Australasian Conference on Robotics and Automation</i>.';

const celda = { preparar(app) { app.celda?.mostrar(true); app.celda?.reiniciar(); app.escena.fijarPostura([0, 0, 0, 0, 0, 1.2]); }, vista: 'programa' };
const cercaQ = (q, ref, tol = 0.03) => q.every((v, i) => Math.abs(v - ref[i]) <= tol);
const pasaPorPostura = (nombre) => C.propia(`Llega a la postura ${nombre}`, (r) => r.paradas.some((s) => cercaQ(s.q, r.poses[nombre])) || `No se detuvo en ${nombre}.`);
const paradaCon = (p, cab, tol = 4) => (r, desde = 0) => r.paradas.findIndex((s, k) => k >= desde && Math.hypot(s.p[0] - p[0], s.p[1] - p[1], s.p[2] - p[2]) <= tol && Math.abs(s.cab - cab) <= 3);

// Puntos de uso frecuente
const A = [-100, -200, 80], Bp = [100, -200, 80];
const TRI = [[-60, -160, 60], [60, -160, 60], [0, -260, 60]];
const ESQ = [-40, -170, 70];
const CUAD = [ESQ, [40, -170, 70], [40, -250, 70], [-40, -250, 70], ESQ];
const TOMA1 = [-110, -150, 10], TOMA2 = [-110, -200, 10], TOMA3 = [-110, -250, 10], BANDEJA = [110, -200, 13];
const ARRIBA = (p, dz = 60) => [p[0], p[1], p[2] + dz];
const PR = [0, -220, 60];
const PR_ATRAS = aLoLargoDeHerramienta(PR, -60, 0, -50);

// ================================================================ Taller 1
export const taller1 = {
  titulo: 'Taller 1 · Mover el robot: MoveAbsJ, MoveJ y MoveL',
  resumen: 'Estructura de un programa RAPID, puntos <code>robtarget</code> y <code>jointtarget</code>, y las tres maneras básicas de moverse. Cada ejercicio se escribe a la derecha y se corrige solo en el robot virtual.',
  conceptos: [
    ['robtarget', 'Pose de la herramienta en el espacio: dónde está la punta y hacia dónde apunta. Aquí: <code>[x, y, z, cabeceo, giro]</code> en mm y grados.'],
    ['jointtarget', 'Ángulos de las articulaciones, en grados. <code>init</code> y <code>home</code> ya existen.'],
    ['speeddata', 'Velocidad del movimiento: <code>v50</code> = 50 mm/s de la punta. <code>vmax</code> = la mayor posible.'],
    ['zonedata', '<code>fine</code>: el robot se detiene exactamente en el punto. <code>z10</code>: puede pasar a 10 mm redondeando.'],
    ['MoveJ / MoveL', 'MoveJ interpola las articulaciones (curva); MoveL interpola la punta en línea recta.'],
  ],
  referencias: [REF_RAPID, REF_SICILIANO('Cap. 4, «Trajectory Planning» (espacio articular frente a espacio operacional).'), REF_BIGGS],
  pasos: [
    { ...celda, titulo: 'Anatomía de un programa RAPID',
      texto: 'Un programa de robot industrial es una lista de instrucciones que se ejecutan en orden. Antes de escribir el primero, vea sus partes a la derecha.',
      detalle: `<p>RAPID es el lenguaje de los robots ABB, uno de los fabricantes más extendidos. Lo que aprenda aquí se traslada casi sin cambios a KUKA (KRL), FANUC (TP) o Universal Robots (URScript): todos tienen puntos, movimientos articulares y lineales, velocidades, zonas, bucles, condiciones y señales. La lección 15 compara los cuatro.</p>
<pre class="codigo">MODULE MainModule                       ! módulo: un archivo .mod
  CONST robtarget p1 := [0, -200, 100, -90, 0];   ! datos: puntos, números
  VAR num contador := 0;

  PROC main()                           ! procedimiento principal
    MoveAbsJ init, v500, fine;          ! instrucción  argumento, velocidad, zona;
    MoveJ p1, v500, fine;
    TPWrite "Listo";                    ! mensaje en la consola (Teach Pendant)
  ENDPROC
ENDMODULE</pre>
<ul>
<li><b>Datos arriba, instrucciones abajo.</b> Los puntos se declaran con nombre (<code>CONST robtarget</code>) y se usan por ese nombre. En la industria casi nunca se escriben coordenadas dentro de un movimiento: se <i>enseñan</i> puntos y se reutilizan.</li>
<li><b>Una instrucción por línea</b>, terminada en <code>;</code> (aquí el punto y coma es opcional). <code>!</code> empieza un comentario.</li>
<li><b>MODULE</b> y <b>PROC main()</b> son opcionales en esta aplicación: si no están, el programa empieza en la primera instrucción. En un robot ABB son obligatorios.</li>
<li><b>Mayúsculas y minúsculas</b> dan igual: <code>movej</code> y <code>MoveJ</code> son lo mismo.</li>
</ul>
<p><b>Diferencia con un ABB real.</b> Un <code>robtarget</code> de ABB lleva la posición, la orientación como cuaternión, la configuración del brazo (<code>confdata</code>) y los ejes externos. El SO-ARM100 tiene cinco articulaciones: no puede elegir cualquier orientación, sólo el <b>cabeceo</b> (hacia dónde apunta la pinza, −90° = hacia abajo) y el <b>giro</b> de la muñeca; el rumbo lo fija la posición $(x, y)$ porque la base gira hacia el punto. Por eso aquí un punto es <code>[x, y, z, cabeceo, giro]</code>.</p>
<p><b>Marco de la base.</b> x hacia la derecha, y negativa hacia el frente del brazo, z hacia arriba desde la mesa, en milímetros desde el centro de la base. La tarjeta «Celda de trabajo» de Programar lo dibuja en planta.</p>` },
    ejercicio({
      id: 't1-home', titulo: 'A home y de vuelta',
      enunciado: 'Escriba un programa que lleve el robot a la postura <code>home</code> y después lo devuelva a <code>init</code>, las dos con <code>MoveAbsJ</code>.',
      inicial: '! Taller 1, ejercicio 1: a home y de vuelta a init.\n\n',
      pistas: ['<code>MoveAbsJ</code> lleva cada articulación a un ángulo guardado. <code>home</code> e <code>init</code> ya están declarados.', 'La forma es <code>MoveAbsJ destino, velocidad, zona;</code>. Por ejemplo <code>MoveAbsJ home, v500, fine;</code>.'],
      solucion: 'MoveAbsJ home, v500, fine;\nMoveAbsJ init, v500, fine;\n',
      comprobar: [C.ejecuta('MoveAbsJ', 2, 'Ejecuta dos MoveAbsJ'), pasaPorPostura('home'), C.propia('Termina en init', (r) => cercaQ(r.final.q, r.poses.init) || 'No termina en init.')],
      detalle: `<p><code>MoveAbsJ</code> (<i>Move Absolute Joint</i>) es el movimiento más seguro para empezar o terminar un programa: no depende de la cinemática inversa, así que siempre llega igual, sea cual sea la postura de partida. Se usa para ir a la postura de reposo o de servicio.</p>
<p><code>init</code> es la postura de todos los ángulos en cero (el brazo estirado hacia arriba y adelante). <code>home</code> es la postura de reposo en la que el brazo puede quedar sin par al apagar. Los dos son <code>jointtarget</code>: seis números en un ABB (uno por eje), cinco aquí.</p>
<p><code>v500</code> es la velocidad (en un MoveAbsJ, la de la punta que resulta; el planificador además limita cada articulación a 1,5 rad/s). <code>fine</code> pide que el robot se detenga por completo en el punto antes de seguir.</p>` }),
    ejercicio({
      id: 't1-punto', titulo: 'Declarar un punto y llegar a él',
      enunciado: 'Declare un punto <code>p1</code> en <b>[0, −200, 100]</b> mm con la pinza hacia abajo (cabeceo −90°, giro 0) y lleve el robot ahí con <code>MoveJ</code>. El movimiento debe usar el punto por su nombre.',
      inicial: '! Taller 1, ejercicio 2: un punto con nombre.\n\n',
      pistas: ['Se declara arriba: <code>CONST robtarget p1 := [x, y, z, cabeceo, giro];</code>', 'Después: <code>MoveJ p1, v500, fine;</code>. Conviene empezar con <code>MoveAbsJ init, v500, fine;</code>.'],
      solucion: 'CONST robtarget p1 := [0, -200, 100, -90, 0];\n\nMoveAbsJ init, v500, fine;\nMoveJ p1, v500, fine;\n',
      comprobar: [C.usa('robtarget', 1, 'Declara un robtarget'), C.usa('MoveJ'), C.noMas('literales', 0, 'Los movimientos usan el punto por su nombre, sin coordenadas sueltas'), C.llega([0, -200, 100]), C.cabeceoFinal(-90)],
      detalle: `<p>Un <code>robtarget</code> es una <b>pose</b>: posición de la punta y orientación de la herramienta. Para llegar a una pose, el controlador resuelve la <b>cinemática inversa</b> (lección 7): qué ángulos ponen la punta ahí con esa orientación. Si no hay solución, el programa se detiene con «fuera del alcance».</p>
<p><code>CONST</code> dice que el valor no cambia durante el programa. RAPID también tiene <code>VAR</code> (cambia, se reinicia al cargar) y <code>PERS</code> (persistente: el último valor se guarda en el módulo).</p>
<p><b>Por qué con nombre.</b> Si mañana la mesa se mueve 5 mm, se corrige una línea (la declaración) y todas las instrucciones que usan <code>p1</code> se corrigen solas. Con coordenadas sueltas habría que buscarlas una por una.</p>` }),
    ejercicio({
      id: 't1-recta', titulo: 'Una línea recta',
      enunciado: 'Lleve la punta a <b>a = [−100, −200, 80]</b> y de ahí, en <b>línea recta</b>, a <b>b = [100, −200, 80]</b>; pinza hacia abajo en los dos. Encienda «Rastro» abajo para ver el camino.',
      inicial: '! Taller 1, ejercicio 3: de a a b en línea recta.\n\n',
      pistas: ['Dos puntos declarados, <code>a</code> y <code>b</code>. Al primero se puede ir con MoveJ.', 'La recta la hace <code>MoveL</code>: <code>MoveL b, v100, fine;</code>.'],
      solucion: 'CONST robtarget a := [-100, -200, 80, -90, 0];\nCONST robtarget b := [100, -200, 80, -90, 0];\n\nMoveAbsJ init, v500, fine;\nMoveJ a, v500, fine;\nMoveL b, v100, fine;\n',
      comprobar: [C.paraEn([A, Bp]), C.recto(A, Bp), C.usa('MoveL')],
      detalle: `<p><code>MoveL</code> interpola la <b>posición de la punta</b> en línea recta, a la velocidad pedida (mm/s), y la orientación de forma continua. En cada instante el controlador calcula la cinemática inversa del punto intermedio: por eso una recta puede fallar a mitad de camino si pasa cerca de una <b>singularidad</b> (lección 8), aunque sus dos extremos sean alcanzables.</p>
<p>Se usa MoveL cuando importa el camino de la punta: acercarse a una pieza, soldar, pegar, dibujar. Se usa MoveJ cuando sólo importa llegar (más rápido y sin singularidades).</p>
<p>La aplicación planifica la recta en muestras de 2 mm, les aplica un perfil de velocidad con aceleración limitada (lección 10) y comprueba que ninguna articulación supere 1,5 rad/s.</p>` }),
    ejercicio({
      id: 't1-curva', titulo: 'Ida en recta, vuelta en curva',
      enunciado: 'Desde <b>a</b>, vaya a <b>b</b> con <code>MoveL</code> y vuelva a <b>a</b> con <code>MoveJ</code>. Compare los dos caminos en la escena: la corrección exige que la vuelta <b>no</b> sea recta.',
      inicial: '! Taller 1, ejercicio 4: MoveL de ida, MoveJ de vuelta.\nCONST robtarget a := [-100, -200, 80, -90, 0];\nCONST robtarget b := [100, -200, 80, -90, 0];\n\nMoveAbsJ init, v500, fine;\nMoveJ a, v500, fine;\n',
      pistas: ['Faltan dos líneas: una MoveL a b y una MoveJ a a.'],
      solucion: 'CONST robtarget a := [-100, -200, 80, -90, 0];\nCONST robtarget b := [100, -200, 80, -90, 0];\n\nMoveAbsJ init, v500, fine;\nMoveJ a, v500, fine;\nMoveL b, v100, fine;\nMoveJ a, v500, fine;\n',
      comprobar: [C.paraEn([A, Bp, A]), C.recto(A, Bp),
        C.propia('La vuelta con MoveJ se aparta de la recta (curva)', (r) => {
          const i = r.tcp.findIndex((s) => Math.hypot(s[0] - Bp[0], s[1] - Bp[1], s[2] - Bp[2]) < 3);
          const vuelta = r.tcp.slice(i);
          const peor = Math.max(0, ...vuelta.map((s) => Math.hypot(s[1] - A[1], s[2] - A[2])));
          return peor > 5 || `Se apartó sólo ${peor.toFixed(1)} mm: ¿la vuelta es un MoveL?`;
        })],
      detalle: `<p>Con <code>MoveJ</code> cada articulación va de su ángulo inicial al final <b>a la vez</b>, todas empiezan y terminan juntas. La base gira de un lado al otro mientras el hombro, el codo y la muñeca cambian lo necesario; la punta describe una curva que se aleja de la recta (aquí, hacia la base, porque en el medio el brazo está más recogido).</p>
<p>MoveJ suele ser más rápido: la duración la fija la articulación que más tiene que girar, sin frenar por la geometría del camino. En una celda se usa para los traslados largos por el aire, <b>lejos</b> de las piezas y los obstáculos; cerca de ellos, MoveL.</p>
$$\\text{MoveJ: } q(s) = q_0 + s\\,(q_1 - q_0) \\qquad \\text{MoveL: } p(s) = p_0 + s\\,(p_1 - p_0),\\; q(s) = \\mathrm{IK}(p(s))$$` }),
    ejercicio({
      id: 't1-vel', titulo: 'Lento y rápido',
      enunciado: 'De <b>a</b> a <b>b</b> en recta a <b>50 mm/s</b> y de vuelta a <b>a</b> en recta a <b>200 mm/s</b>. La ida debe tardar al menos 4 s y la vuelta como mucho 2,1 s.',
      inicial: '! Taller 1, ejercicio 5: velocidades.\nCONST robtarget a := [-100, -200, 80, -90, 0];\nCONST robtarget b := [100, -200, 80, -90, 0];\n\nMoveAbsJ init, v500, fine;\nMoveJ a, v500, fine;\n',
      pistas: ['La velocidad es el segundo argumento: <code>v50</code>, <code>v200</code>.', '200 mm a 50 mm/s son 4 s de crucero más la aceleración y el frenado; a 200 mm/s, 1 s más lo mismo.'],
      solucion: 'CONST robtarget a := [-100, -200, 80, -90, 0];\nCONST robtarget b := [100, -200, 80, -90, 0];\n\nMoveAbsJ init, v500, fine;\nMoveJ a, v500, fine;\nMoveL b, v50, fine;\nMoveL a, v200, fine;\n',
      comprobar: [C.paraEn([A, Bp, A]), C.tramo((t) => t.instr === 'MoveL' && t.duracion >= 4, 'Un MoveL tarda 4 s o más'), C.tramo((t) => t.instr === 'MoveL' && t.duracion <= 2.1, 'Un MoveL tarda 2,1 s o menos'), C.usa('MoveL', 2)],
      detalle: `<p><code>speeddata</code> en RAPID es un dato de cuatro campos: velocidad de la punta (mm/s), de reorientación (°/s) y de los ejes externos. <code>v50</code>, <code>v100</code>… <code>v7000</code>, <code>vmax</code> son valores predefinidos. En esta aplicación sólo cuenta el primero.</p>
<p>La duración real no es sólo <i>distancia / velocidad</i>: el perfil trapezoidal (lección 10) acelera y frena. Con aceleración $a$ y velocidad $v$ sobre una distancia $L$:</p>
$$t = \\frac{L}{v} + \\frac{v}{a} \\quad (\\text{si } L > v^2/a)$$
<p>Además, si alguna articulación tendría que superar 1,5 rad/s, el tramo se alarga: la velocidad pedida es un máximo, no una promesa. Un programador industrial piensa en <b>tiempo de ciclo</b>: rápido en el aire, lento cerca de la pieza (taller 3).</p>` }),
    ejercicio({
      id: 't1-triangulo', titulo: 'Un triángulo',
      enunciado: 'Con la pinza hacia abajo, recorra en rectas el triángulo <b>[−60, −160, 60] → [60, −160, 60] → [0, −260, 60]</b> y vuelva al primer vértice.',
      inicial: '! Taller 1, ejercicio 6: triángulo con MoveL.\n\n',
      pistas: ['Declare los tres vértices. Al primero, MoveJ; después tres MoveL.'],
      solucion: 'CONST robtarget v1 := [-60, -160, 60, -90, 0];\nCONST robtarget v2 := [60, -160, 60, -90, 0];\nCONST robtarget v3 := [0, -260, 60, -90, 0];\n\nMoveAbsJ init, v500, fine;\nMoveJ v1, v500, fine;\nMoveL v2, v100, fine;\nMoveL v3, v100, fine;\nMoveL v1, v100, fine;\n',
      comprobar: [C.paraEn([...TRI, TRI[0]]), C.recto(TRI[0], TRI[1]), C.recto(TRI[1], TRI[2]), C.recto(TRI[2], TRI[0]), C.usa('robtarget', 3, 'Declara los tres vértices')],
      detalle: '<p>Una figura cerrada es la prueba clásica de <b>exactitud de trayectoria</b> de un robot (ISO 9283, lección 17): se programa un cuadrado o un círculo y se mide cuánto se aparta el camino real del programado. Con <code>fine</code> el robot se detiene en cada vértice; en el taller 3 verá cómo redondearlos para ganar tiempo.</p>' }),
    ejercicio({
      id: 't1-cabeceo', titulo: 'Mismo punto, otra orientación',
      enunciado: 'Lleve la punta a <b>[0, −220, 90]</b> con la pinza hacia abajo (−90°) y, sin mover la punta de ahí, inclínela a <b>−45°</b>.',
      inicial: '! Taller 1, ejercicio 7: reorientar la herramienta.\n\n',
      pistas: ['Son dos puntos con las mismas x, y, z y distinto cabeceo.', 'Para reorientar sin mover la punta, use MoveL: interpola también la orientación.'],
      solucion: 'CONST robtarget abajo := [0, -220, 90, -90, 0];\nCONST robtarget inclinada := [0, -220, 90, -45, 0];\n\nMoveAbsJ init, v500, fine;\nMoveJ abajo, v500, fine;\nMoveL inclinada, v100, fine;\n',
      comprobar: [
        C.propia('Se detiene en [0, −220, 90] con cabeceo −90°', (r) => paradaCon([0, -220, 90], -90)(r) >= 0 || 'No hubo parada ahí con −90°.'),
        C.propia('Después, en el mismo punto con cabeceo −45°', (r) => { const i = paradaCon([0, -220, 90], -90)(r); return (i >= 0 && paradaCon([0, -220, 90], -45)(r, i + 1) >= 0) || 'No hubo una parada posterior con −45°.'; }),
        C.llega([0, -220, 90])],
      detalle: `<p>La orientación de la herramienta es tan parte del punto como su posición. Un soldador tiene que mantener la antorcha a 45° del cordón; una ventosa, perpendicular a la cara de la caja. Con un MoveL entre dos puntos de igual posición y distinta orientación el robot gira la herramienta alrededor de la punta (el TCP): eso es lo que hace útil definir bien el TCP (lección 16).</p>
<p>En este brazo de 5 grados de libertad, el cabeceo se consigue repartiendo el giro entre hombro, codo y muñeca, con la restricción $\\theta_2 + \\theta_3 + \\theta_4 = $ ángulo de la herramienta en el plano del brazo (lección 7).</p>` }),
    { ...celda, titulo: 'Repaso', texto: 'Antes de seguir, una pregunta.',
      pregunta: { enunciado: 'Hay que acercar la pinza a una pieza por encima sin golpear la de al lado, que está a 15 mm. ¿Qué instrucción usa para el último tramo?',
        opciones: ['<code>MoveJ</code>, porque es más rápido', '<code>MoveL</code>, porque el camino de la punta es una recta conocida', '<code>MoveAbsJ</code>, porque no usa cinemática inversa'], correcta: 1,
        explicacion: 'Cerca de las piezas importa el camino, no sólo el destino: MoveL garantiza la recta. MoveJ puede curvar la punta hacia la pieza vecina.' } },
  ],
};

// ================================================================ Taller 2
export const taller2 = {
  titulo: 'Taller 2 · Offs, RelTool y tomar y dejar',
  resumen: 'Puntos relativos a otros puntos, aproximación y retirada, y el ciclo básico de manipulación: tomar una pieza y dejarla en otro sitio.',
  conceptos: [
    ['Offs(p, dx, dy, dz)', 'El punto p desplazado en mm sobre los ejes de la <b>base</b>. La orientación no cambia.'],
    ['RelTool(p, dx, dy, dz)', 'El punto p desplazado sobre los ejes de la <b>herramienta</b>: dz negativo retrocede en la dirección en que apunta la pinza.'],
    ['Aproximación', 'Punto encima de la pieza desde el que se baja en recta. Se llega rápido por el aire y se baja despacio.'],
    ['Retirada', 'Subir en recta después de tomar o dejar, antes de ir a otro lado.'],
  ],
  referencias: [REF_RAPID, REF_SICILIANO('Cap. 2, «Kinematics» (marcos y transformaciones: por qué un desplazamiento depende del marco en que se expresa).'), REF_PROGRAMACION],
  pasos: [
    { ...celda, titulo: 'Un punto y todo lo demás relativo a él',
      texto: 'Un programa de manipulación se escribe con muy pocos puntos enseñados; el resto se calcula a partir de ellos con Offs y RelTool.',
      detalle: `<p>Para tomar un cubo hacen falta al menos tres poses: encima (aproximación), abajo (toma) y otra vez encima (retirada). Si se enseñaran las tres a mano, un error de un milímetro entre ellas haría que la bajada no fuera vertical. En su lugar se enseña <b>una</b> y las demás se calculan:</p>
<pre class="codigo">CONST robtarget toma := [-110, -150, 10, -90, 0];
MoveJ Offs(toma, 0, 0, 60), v500, z10;   ! 60 mm encima, rápido por el aire
MoveL toma, v80, fine;                   ! baja en recta, despacio, y se detiene
GripperClose;
MoveL Offs(toma, 0, 0, 60), v150, z10;   ! sube en recta</pre>
<p><b>Offs</b> suma en el marco de la base: $p' = p + (\\Delta x, \\Delta y, \\Delta z)$. <b>RelTool</b> suma en el marco de la herramienta: $p' = p + R_{herr}\\,(\\Delta x, \\Delta y, \\Delta z)$, donde $R_{herr}$ es la orientación de la pinza. Con la pinza hacia abajo, <code>RelTool(p, 0, 0, -60)</code> y <code>Offs(p, 0, 0, 60)</code> dan lo mismo; con la pinza inclinada, no (ejercicio 5).</p>
<p>En un ABB real esto se completa con el <b>objeto de trabajo</b> (<code>wobjdata</code>): un marco pegado a la mesa. Si la mesa se mueve, se vuelve a medir el marco (tres puntos) y todos los puntos del programa, expresados respecto de él, se corrigen solos.</p>` },
    ejercicio({
      id: 't2-offs', titulo: 'Bajar y subir con Offs',
      enunciado: 'Con un solo punto declarado, <code>mesa := [0, −200, 20, −90, 0]</code>, llegue 60 mm encima, baje en recta a la mesa y vuelva a subir 60 mm en recta.',
      inicial: '! Taller 2, ejercicio 1: aproximación y retirada.\nCONST robtarget mesa := [0, -200, 20, -90, 0];\n\nMoveAbsJ init, v500, fine;\n',
      pistas: ['<code>Offs(mesa, 0, 0, 60)</code> es el punto 60 mm encima de <code>mesa</code>.', 'MoveJ a la aproximación, MoveL a <code>mesa</code>, MoveL a la aproximación.'],
      solucion: 'CONST robtarget mesa := [0, -200, 20, -90, 0];\n\nMoveAbsJ init, v500, fine;\nMoveJ Offs(mesa, 0, 0, 60), v500, fine;\nMoveL mesa, v80, fine;\nMoveL Offs(mesa, 0, 0, 60), v150, fine;\n',
      comprobar: [C.paraEn([[0, -200, 80], [0, -200, 20], [0, -200, 80]]), C.recto([0, -200, 80], [0, -200, 20]), C.usa('offs', 2), C.noMas('robtarget', 1, 'Declara un solo punto'), C.noMas('literales', 0, 'Sin coordenadas sueltas en los movimientos')],
      detalle: '<p>La bajada vertical es la regla de oro de la manipulación: la pinza entra sin rozar los costados de la pieza y sin empujarla. Por eso el último tramo es un MoveL y la aproximación está exactamente encima (mismo x e y). La altura de aproximación se elige para librar las piezas vecinas y los bordes: 60 mm aquí; en una caja honda, más.</p>' }),
    ejercicio({
      id: 't2-cuadrado', titulo: 'Un cuadrado desde una esquina',
      enunciado: 'Declare sólo la esquina <code>e := [−40, −170, 70, −90, 0]</code> y recorra en rectas un cuadrado de 80 mm: <b>e → 80 mm en +x → 80 mm en −y → 80 mm en −x → e</b>.',
      inicial: '! Taller 2, ejercicio 2: un cuadrado con Offs.\n\n',
      pistas: ['Las esquinas son <code>Offs(e, 80, 0, 0)</code>, <code>Offs(e, 80, -80, 0)</code> y <code>Offs(e, 0, -80, 0)</code>.'],
      solucion: 'CONST robtarget e := [-40, -170, 70, -90, 0];\n\nMoveAbsJ init, v500, fine;\nMoveJ e, v500, fine;\nMoveL Offs(e, 80, 0, 0), v100, fine;\nMoveL Offs(e, 80, -80, 0), v100, fine;\nMoveL Offs(e, 0, -80, 0), v100, fine;\nMoveL e, v100, fine;\n',
      comprobar: [C.paraEn(CUAD), C.recto(CUAD[1], CUAD[2]), C.recto(CUAD[3], CUAD[4]), C.noMas('robtarget', 1, 'Declara un solo punto'), C.noMas('literales', 0, 'Sin coordenadas sueltas en los movimientos'), C.usa('MoveL', 4)],
      detalle: '<p>Cambiando una sola línea (la esquina) el cuadrado entero se traslada. Éste es el principio del <b>programa paramétrico</b>: la geometría en función de pocos datos. En el taller 4 el lado también será una variable.</p>' }),
    ejercicio({
      id: 't2-tomar', titulo: 'Tomar cubo1',
      enunciado: 'Tome <b>cubo1</b> (el fucsia, en <b>[−110, −150]</b>, se agarra en z = 10 con la pinza hacia abajo) y levántelo 60 mm. El programa termina con el cubo en la pinza.',
      inicial: '! Taller 2, ejercicio 3: tomar una pieza.\n\n',
      pistas: ['Abra la pinza antes de bajar: <code>GripperOpen;</code>', 'Aproximación con Offs, bajada con MoveL, <code>GripperClose;</code>, subida con MoveL.'],
      solucion: 'CONST robtarget toma := [-110, -150, 10, -90, 0];\n\nMoveAbsJ init, v500, fine;\nGripperOpen;\nMoveJ Offs(toma, 0, 0, 60), v500, fine;\nMoveL toma, v80, fine;\nGripperClose;\nWaitTime 0.3;\nMoveL Offs(toma, 0, 0, 60), v150, fine;\n',
      comprobar: [C.sujeta('cubo1'), C.llega(ARRIBA(TOMA1), 5, 'Termina 60 mm encima de la toma'), C.orden([E.agarra('cubo1')], 'La pinza se cierra con cubo1 entre los dedos'), C.usa('offs')],
      detalle: `<p>La pinza sujeta una pieza si se cierra con el centro de los dedos a menos de 25 mm del centro del cubo. En un robot real la condición es más estricta: el error de posición de la pieza, de la toma y del TCP deben sumar menos que la holgura de los dedos. De ahí la importancia de la calibración (lección 16).</p>
<p><code>WaitTime 0.3</code> después de cerrar no es de adorno: en un robot real la pinza tarda en cerrarse y el programa no debe levantar antes. Los robots ABB con pinzas neumáticas suelen esperar una señal del sensor de la pinza (<code>WaitDI</code>, taller 6) en lugar de un tiempo fijo.</p>` }),
    ejercicio({
      id: 't2-tomar-dejar', titulo: 'Tomar y dejar en la bandeja',
      enunciado: 'Lleve <b>cubo1</b> a la bandeja (centro en <b>[110, −200]</b>, el fondo está en z = 13) y retírese hacia arriba con la pinza abierta. Los otros dos cubos no se tocan.',
      inicial: '! Taller 2, ejercicio 4: el ciclo completo.\n\n',
      pistas: ['Son dos puntos: la toma y la bandeja, cada uno con su aproximación y retirada.', 'Orden: abrir, aproximar, bajar, cerrar, subir, ir encima de la bandeja, bajar, abrir, subir.'],
      solucion: 'CONST robtarget toma := [-110, -150, 10, -90, 0];\nCONST robtarget deja := [110, -200, 13, -90, 0];\n\nMoveAbsJ init, v500, fine;\nGripperOpen;\nMoveJ Offs(toma, 0, 0, 60), v500, z10;\nMoveL toma, v80, fine;\nGripperClose;\nWaitTime 0.3;\nMoveL Offs(toma, 0, 0, 60), v150, z10;\nMoveJ Offs(deja, 0, 0, 60), v500, z10;\nMoveL deja, v80, fine;\nGripperOpen;\nWaitTime 0.3;\nMoveL Offs(deja, 0, 0, 60), v150, fine;\n',
      comprobar: [C.enBandeja(['cubo1']), C.enSitio('cubo2', -110, -200, 'cubo2 sigue en su sitio'), C.enSitio('cubo3', -110, -250, 'cubo3 sigue en su sitio'), C.orden([E.agarra('cubo1'), E.suelta('cubo1')], 'Toma cubo1 y lo suelta'), C.nuncaBajo(8)],
      detalle: '<p>Éste es el programa que más se escribe en la industria: <i>pick and place</i>. Todo lo demás (paletizar, clasificar, alimentar una máquina) son variaciones. Observe la estructura simétrica: aproximación, bajada fina, acción de la pinza, retirada. Los traslados por el aire pueden redondear (<code>z10</code>); las bajadas y la acción, nunca (<code>fine</code>).</p>' }),
    ejercicio({
      id: 't2-reltool', titulo: 'Retroceder a lo largo de la herramienta',
      enunciado: 'Con la pinza inclinada a <b>−60°</b>, llegue a <code>p := [0, −220, 60, −60, 0]</code> entrando en la dirección en que apunta la pinza: aproxímese desde 50 mm atrás <b>sobre el eje de la herramienta</b> y retírese por el mismo camino.',
      inicial: '! Taller 2, ejercicio 5: RelTool.\nCONST robtarget p := [0, -220, 60, -60, 0];\n\nMoveAbsJ init, v500, fine;\n',
      pistas: ['<code>RelTool(p, 0, 0, -50)</code> es el punto 50 mm detrás de p en el eje z de la herramienta.', 'Con Offs(p, 0, 0, 50) llegaría desde arriba, no en la dirección de la pinza.'],
      solucion: 'CONST robtarget p := [0, -220, 60, -60, 0];\n\nMoveAbsJ init, v500, fine;\nMoveJ RelTool(p, 0, 0, -50), v500, fine;\nMoveL p, v80, fine;\nMoveL RelTool(p, 0, 0, -50), v150, fine;\n',
      comprobar: [C.paraEn([PR_ATRAS, PR, PR_ATRAS], 4, 'Se detiene 50 mm atrás sobre el eje de la pinza, en p y otra vez atrás'), C.recto(PR_ATRAS, PR), C.usa('reltool')],
      detalle: `<p>En atornillado, inserción de pernos, soldadura por puntos o encolado, la herramienta debe entrar en su propia dirección, no en vertical. <code>RelTool</code> expresa el desplazamiento en el marco de la herramienta:</p>
$$p' = p + R\\,\\begin{bmatrix}\\Delta x\\\\ \\Delta y\\\\ \\Delta z\\end{bmatrix}, \\qquad R = \\begin{bmatrix}\\hat x_h & \\hat y_h & \\hat z_h\\end{bmatrix}$$
<p>Con el cabeceo $\\beta = -60°$, el eje $\\hat z_h$ apunta hacia adelante y abajo; retroceder 50 mm sobre él sube $50\\sin 60° \\approx 43$ mm y retrocede $50\\cos 60° = 25$ mm hacia la base.</p>` }),
    ejercicio({
      id: 't2-lima', titulo: 'Reto: el cubo lima a la bandeja',
      enunciado: 'Lleve <b>cubo2</b> (lima, en <b>[−110, −200]</b>) a la bandeja. cubo1 y cubo3 no se mueven. Escríbalo sin copiar el ejercicio anterior.',
      inicial: '! Taller 2, ejercicio 6: reto.\n\n',
      pistas: ['Es el ejercicio 4 con otro punto de toma.'],
      solucion: 'CONST robtarget toma := [-110, -200, 10, -90, 0];\nCONST robtarget deja := [110, -200, 13, -90, 0];\n\nMoveAbsJ init, v500, fine;\nGripperOpen;\nMoveJ Offs(toma, 0, 0, 60), v500, z10;\nMoveL toma, v80, fine;\nGripperClose;\nWaitTime 0.3;\nMoveL Offs(toma, 0, 0, 60), v150, z10;\nMoveJ Offs(deja, 0, 0, 60), v500, z10;\nMoveL deja, v80, fine;\nGripperOpen;\nWaitTime 0.3;\nMoveL Offs(deja, 0, 0, 60), v150, fine;\n',
      comprobar: [C.enBandeja(['cubo2']), C.enSitio('cubo1', -110, -150, 'cubo1 sigue en su sitio'), C.enSitio('cubo3', -110, -250, 'cubo3 sigue en su sitio')],
      detalle: '<p>Mismo patrón, otro dato. Si al escribirlo notó que copiaba diez líneas cambiando un número, ya sabe lo que resolverán las variables y los procedimientos de los talleres 4 y 5.</p>' }),
  ],
};

// ================================================================ Taller 3
const CUAD_FINE = 'CONST robtarget e := [-40, -170, 70, -90, 0];\n\nMoveAbsJ init, v500, fine;\nMoveJ e, v500, fine;\nMoveL Offs(e, 80, 0, 0), v200, fine;\nMoveL Offs(e, 80, -80, 0), v200, fine;\nMoveL Offs(e, 0, -80, 0), v200, fine;\nMoveL e, v200, fine;\n';
const PICK_LENTO = 'CONST robtarget toma := [-110, -150, 10, -90, 0];\nCONST robtarget deja := [110, -200, 13, -90, 0];\n\nMoveAbsJ init, v100, fine;\nGripperOpen;\nMoveL Offs(toma, 0, 0, 60), v50, fine;\nMoveL toma, v50, fine;\nGripperClose;\nWaitTime 0.3;\nMoveL Offs(toma, 0, 0, 60), v50, fine;\nMoveL Offs(deja, 0, 0, 60), v50, fine;\nMoveL deja, v50, fine;\nGripperOpen;\nWaitTime 0.3;\nMoveL Offs(deja, 0, 0, 60), v50, fine;\n';
export const taller3 = {
  titulo: 'Taller 3 · Zonas, velocidad y tiempo de ciclo',
  resumen: 'Cómo hacer un programa rápido sin perder precisión donde importa: zonas de redondeo, velocidades por tramo y VelSet.',
  conceptos: [
    ['Tiempo de ciclo', 'Lo que tarda el programa en hacer una pieza. Es el número que mira la planta: define cuántas piezas por hora salen.'],
    ['zN', 'Zona de N mm: al llegar a N mm del punto, el robot empieza el siguiente movimiento sin detenerse.'],
    ['fine', 'Parada exacta: obligatoria donde se toma o se deja, o donde se activa una herramienta.'],
    ['VelSet', 'Escala todas las velocidades del programa, por ejemplo al 50 % para la primera prueba.'],
  ],
  referencias: [REF_RAPID, REF_SICILIANO('Cap. 4, «Trajectory Planning»: trayectorias por puntos de paso y enlace de tramos.'), 'ISO 9283:1998. Manipulating industrial robots — Performance criteria and related test methods (exactitud y repetibilidad de trayectoria y de redondeo de esquinas).', 'Biagiotti, L. y Melchiorri, C. (2008). <i>Trajectory Planning for Automatic Machines and Robots</i>. Springer.'],
  pasos: [
    { ...celda, titulo: 'Por qué el robot se detiene', texto: 'Con fine el robot frena hasta cero en cada punto. Con una zona, empieza a girar hacia el siguiente antes de llegar.',
      detalle: `<p>Un movimiento con <code>fine</code> termina cuando el robot está <b>parado</b> en el punto. Frenar y volver a acelerar cuesta tiempo: con una aceleración de 0,6 m/s² y 200 mm/s, cada parada añade unos $2v/a \\approx 0{,}7$ s.</p>
<p>Con <code>z10</code>, cuando la punta llega a 10 mm del punto el controlador ya planifica el tramo siguiente y los une con una curva: la punta no pasa por el punto, pasa a menos de 10 mm, y no se detiene. El redondeo se hace en la aplicación con una parábola entre las dos rectas (lección 10).</p>
<p><b>Regla práctica</b>: zonas grandes en el aire (<code>z50</code>, <code>z100</code> en robots grandes), zonas pequeñas cerca de obstáculos, <code>fine</code> donde la pinza actúa. Un error común es poner una zona en el punto de toma: el robot cerraría la pinza pasando, sin haber llegado.</p>
<p>Además de la zona, el <b>look-ahead</b> importa: el controlador lee varias instrucciones por adelantado. Si entre dos movimientos hay una instrucción que no es de movimiento (<code>GripperClose</code>, <code>WaitTime</code>, <code>SetDO</code>), el robot llega con <code>fine</code> aunque haya pedido una zona, porque no puede seguir sin ejecutarla.</p>` },
    ejercicio({
      id: 't3-zonas', titulo: 'Esquinas redondeadas',
      enunciado: 'El programa de la derecha recorre un cuadrado deteniéndose en cada esquina. Cambie las zonas para que el ciclo baje a <b>5,5 s o menos</b>, pasando a menos de 20 mm de cada esquina y terminando con <code>fine</code> en la esquina inicial.',
      inicial: '! Taller 3, ejercicio 1: el mismo cuadrado, más rápido.\n' + CUAD_FINE,
      pistas: ['Cambie <code>fine</code> por <code>z20</code> en las tres esquinas intermedias.', 'El último MoveL debe seguir con fine: el programa termina ahí.'],
      solucion: CUAD_FINE.replace(/(Offs\(e, [^)]*\), v200), fine/g, '$1, z20'),
      comprobar: [C.ciclo(5.5), C.pasaPor(CUAD.slice(1, 4), 20, 'Pasa a menos de 20 mm de las tres esquinas intermedias'), C.usa('zonas', 3, 'Usa zona en al menos tres movimientos'), C.llega(ESQ, 3, 'Termina exactamente en la esquina inicial')],
      detalle: '<p>Compare el tiempo de ciclo que muestra el resultado con el del programa original (pulse «Comprobar sin animar» antes de cambiarlo). En una línea de producción de 20 000 piezas al día, cada décima de segundo por ciclo son más de media hora de máquina.</p>' }),
    ejercicio({
      id: 't3-rapido', titulo: 'Tomar y dejar, en menos tiempo',
      enunciado: 'El programa lleva cubo1 a la bandeja pero es lentísimo. Hágalo en <b>9 s o menos</b> sin dejar de funcionar: velocidades altas en el aire, zonas en los traslados, <code>fine</code> donde actúa la pinza.',
      inicial: '! Taller 3, ejercicio 2: acelerar sin romper.\n' + PICK_LENTO,
      pistas: ['Los traslados por el aire pueden ser MoveJ a v500 con z10.', 'Las bajadas a la pieza y a la bandeja, MoveL con fine; las subidas pueden llevar zona.'],
      solucion: 'CONST robtarget toma := [-110, -150, 10, -90, 0];\nCONST robtarget deja := [110, -200, 13, -90, 0];\n\nMoveAbsJ init, v500, fine;\nGripperOpen;\nMoveJ Offs(toma, 0, 0, 60), v500, z10;\nMoveL toma, v150, fine;\nGripperClose;\nWaitTime 0.3;\nMoveL Offs(toma, 0, 0, 60), v300, z10;\nMoveJ Offs(deja, 0, 0, 60), v500, z10;\nMoveL deja, v150, fine;\nGripperOpen;\nWaitTime 0.3;\nMoveL Offs(deja, 0, 0, 60), v300, fine;\n',
      comprobar: [C.enBandeja(['cubo1']), C.ciclo(9), C.enSitio('cubo2', -110, -200, 'cubo2 sigue en su sitio')],
      detalle: '<p>Optimizar un ciclo es el trabajo diario del integrador. El orden habitual: (1) quitar paradas innecesarias con zonas, (2) subir la velocidad de los traslados, (3) acortar los caminos (aproximaciones más bajas si no hay obstáculos), (4) mover la pinza mientras el robot se desplaza (en un robot real, con disparos por posición: <code>TriggL</code>). No se toca la bajada a la pieza hasta el final: es donde se pierde precisión.</p>' }),
    ejercicio({
      id: 't3-suave', titulo: 'Llegar despacio a la pieza',
      enunciado: 'Tome cubo1 así: rápido hasta 60 mm encima, a v200 hasta 20 mm encima y los últimos 20 mm a <b>v20</b>. Termine con el cubo levantado 60 mm. El último tramo de bajada debe durar al menos 0,9 s.',
      inicial: '! Taller 3, ejercicio 3: velocidades por tramo.\nCONST robtarget toma := [-110, -150, 10, -90, 0];\n\nMoveAbsJ init, v500, fine;\nGripperOpen;\n',
      pistas: ['Son tres movimientos de bajada: MoveJ a Offs(toma,0,0,60), MoveL a Offs(toma,0,0,20) y MoveL a toma con v20.'],
      solucion: 'CONST robtarget toma := [-110, -150, 10, -90, 0];\n\nMoveAbsJ init, v500, fine;\nGripperOpen;\nMoveJ Offs(toma, 0, 0, 60), v500, z10;\nMoveL Offs(toma, 0, 0, 20), v200, z5;\nMoveL toma, v20, fine;\nGripperClose;\nWaitTime 0.3;\nMoveL Offs(toma, 0, 0, 60), v200, fine;\n',
      comprobar: [C.sujeta('cubo1'), C.llega(ARRIBA(TOMA1)), C.pasaPor([ARRIBA(TOMA1, 20)], 6, 'Pasa por 20 mm encima de la toma'), C.tramo((t) => t.instr === 'MoveL' && t.duracion >= 0.9, 'Un tramo de MoveL dura 0,9 s o más (la bajada lenta)')],
      detalle: '<p>Entrar despacio los últimos milímetros reduce el impacto si la pieza no está exactamente donde se esperaba, y da tiempo a un sensor de contacto o de fuerza a detener el robot. En robots colaborativos es además una exigencia de seguridad: la ISO/TS 15066 limita la energía de un contacto (lección 17).</p>' }),
    ejercicio({
      id: 't3-velset', titulo: 'Primera prueba al 50 %',
      enunciado: 'Antes de probar un programa nuevo en el robot real se ejecuta más despacio. Sin cambiar ninguna velocidad de los movimientos, agregue una instrucción al principio para que todos los movimientos vayan a la mitad. El original dura unos 7,7 s; con el cambio, el ciclo debe quedar entre 9 y 22 s. (¿Por qué no se duplica? Mire qué tiempos no dependen de la velocidad.)',
      inicial: '! Taller 3, ejercicio 4: VelSet.\nCONST robtarget toma := [-110, -150, 10, -90, 0];\nCONST robtarget deja := [110, -200, 13, -90, 0];\n\nMoveAbsJ init, v500, fine;\nGripperOpen;\nMoveJ Offs(toma, 0, 0, 60), v500, z10;\nMoveL toma, v150, fine;\nGripperClose;\nWaitTime 0.3;\nMoveL Offs(toma, 0, 0, 60), v300, z10;\nMoveJ Offs(deja, 0, 0, 60), v500, z10;\nMoveL deja, v150, fine;\nGripperOpen;\nWaitTime 0.3;\nMoveL Offs(deja, 0, 0, 60), v300, fine;\n',
      pistas: ['<code>VelSet 50;</code> al principio del programa.'],
      solucion: 'VelSet 50;\nCONST robtarget toma := [-110, -150, 10, -90, 0];\nCONST robtarget deja := [110, -200, 13, -90, 0];\n\nMoveAbsJ init, v500, fine;\nGripperOpen;\nMoveJ Offs(toma, 0, 0, 60), v500, z10;\nMoveL toma, v150, fine;\nGripperClose;\nWaitTime 0.3;\nMoveL Offs(toma, 0, 0, 60), v300, z10;\nMoveJ Offs(deja, 0, 0, 60), v500, z10;\nMoveL deja, v150, fine;\nGripperOpen;\nWaitTime 0.3;\nMoveL Offs(deja, 0, 0, 60), v300, fine;\n',
      comprobar: [C.usa('velset'), C.enBandeja(['cubo1']), C.ciclo(22, 9)],
      detalle: '<p>El ciclo no se duplica porque <code>WaitTime</code> y el cierre de la pinza tardan lo mismo a cualquier velocidad: sólo se escalan los movimientos. <code>VelSet</code> escala todas las velocidades programadas (en ABB, también limita un máximo). La otra manera es la perilla de <b>override</b> de la consola, que aquí es el deslizador «Velocidad del programa» de Programar. En la puesta en marcha se prueba primero al 10-25 % en modo manual reducido (250 mm/s como máximo, ISO 10218-1) y paso a paso.</p>' }),
    { ...celda, titulo: 'Repaso', texto: 'Una pregunta sobre zonas.',
      pregunta: { enunciado: 'Un programa hace <code>MoveL toma, v100, z10;</code> seguido de <code>GripperClose;</code>. ¿Qué pasa?',
        opciones: ['La pinza se cierra a 10 mm de la pieza, en el aire', 'Nada raro: antes de una instrucción que no es de movimiento, el robot termina el tramo y se detiene en el punto', 'El programa da error'], correcta: 1,
        explicacion: 'Como GripperClose no es un movimiento, el robot no puede empalmar con el siguiente tramo: llega al punto y se detiene. Aun así, se escribe fine en la toma para que el programa diga lo que hace.' } },
  ],
};

// ================================================================ Taller 4
const ESC = (k) => [-60 + 20 * Math.floor(k / 2), -200, 40 + 15 * Math.ceil(k / 2)];
export const taller4 = {
  titulo: 'Taller 4 · Variables, expresiones y bucles',
  resumen: 'num, asignación, Incr, operadores, FOR, WHILE, IF/ELSE y funciones. Los programas dejan de ser listas fijas y se vuelven cálculos.',
  conceptos: [
    ['VAR num n := 0', 'Variable numérica. <code>n := n + 1;</code> o <code>Incr n;</code> la cambian.'],
    ['FOR i FROM a TO b DO', 'Repite el bloque con i = a, a+1… b. <code>STEP</code> cambia el paso.'],
    ['WHILE cond DO', 'Repite mientras la condición valga verdadero (distinto de 0).'],
    ['IF / ELSEIF / ELSE', 'Elige un bloque según una condición.'],
    ['Funciones', '<code>Abs, Sqrt, Round, Trunc, Sin, Cos, Tan, Min, Max</code>. Sin, Cos y Tan reciben grados.'],
  ],
  referencias: [REF_RAPID, 'Kernighan, B. W. y Pike, R. (1999). <i>The Practice of Programming</i>. Addison-Wesley (claridad, repetición y abstracción; vale para cualquier lenguaje).', REF_PROGRAMACION],
  pasos: [
    { ...celda, titulo: 'Un robot que calcula', texto: 'Con variables y bucles, un mismo bloque de instrucciones sirve para muchas piezas.',
      detalle: `<pre class="codigo">VAR num n := 0;                  ! declaración con valor inicial
n := n + 5;                      ! asignación (:=, no =)
Incr n;                          ! n := n + 1
FOR i FROM 1 TO 3 DO             ! i = 1, 2, 3 (i no se declara)
  TPWrite "Vuelta " + i;         ! + une texto y números
ENDFOR
WHILE n < 10 DO
  Incr n;
ENDWHILE
IF n = 10 THEN                   ! = compara; también <>, <, >, <=, >=
  TPWrite "diez";
ELSEIF n > 10 THEN
  TPWrite "más";
ELSE
  TPWrite "menos";
ENDIF</pre>
<p><b>Condiciones.</b> Se combinan con <code>AND</code>, <code>OR</code> y <code>NOT</code>. Cero es falso; cualquier otro valor, verdadero. Una entrada digital (<code>di1</code>) se usa como un número que vale 0 o 1.</p>
<p><b>Cuidado con WHILE.</b> Si la condición nunca se vuelve falsa, el programa no termina. La aplicación corta después de 20 000 instrucciones y lo avisa; un robot real se quedaría dando vueltas.</p>
<p><b>Expresiones dentro de un punto.</b> <code>Offs(p, 20 * i, 0, 15 * (i + 1))</code> calcula el desplazamiento en cada vuelta. Así se paletiza: una fila de 10 cajas es un FOR, no diez puntos enseñados.</p>` },
    ejercicio({
      id: 't4-contar', titulo: 'Contar con FOR',
      enunciado: 'Escriba los números del 1 al 5 en la consola, uno por mensaje, con un solo <code>TPWrite</code> dentro de un <code>FOR</code>.',
      inicial: '! Taller 4, ejercicio 1: contar.\n\n',
      pistas: ['<code>FOR i FROM 1 TO 5 DO … ENDFOR</code>', 'Dentro: <code>TPWrite i;</code> (o <code>TPWrite "" + i;</code>).'],
      solucion: 'FOR i FROM 1 TO 5 DO\n  TPWrite i;\nENDFOR\n',
      comprobar: [C.mensajes(['1', '2', '3', '4', '5']), C.usa('for'), C.noMas('tpwrite', 1, 'Un solo TPWrite escrito')],
      detalle: '<p>El contador de un FOR existe sólo dentro del bucle y no se declara. Con <code>STEP</code> se cuenta de otro modo: <code>FOR i FROM 10 TO 0 STEP -2 DO</code> da 10, 8, 6, 4, 2, 0.</p>' }),
    ejercicio({
      id: 't4-suma', titulo: 'Sumar con WHILE',
      enunciado: 'Con un <code>WHILE</code> (no un FOR), sume los enteros del 1 al 10 y escriba <b>«Suma = 55»</b>.',
      inicial: '! Taller 4, ejercicio 2: acumular.\n\n',
      pistas: ['Dos variables: el número que se suma (<code>k</code>) y el total (<code>s</code>), las dos empezando en 0.', 'Mientras <code>k < 10</code>: <code>Incr k; s := s + k;</code>. Al final <code>TPWrite "Suma = " + s;</code>'],
      solucion: 'VAR num k := 0;\nVAR num s := 0;\n\nWHILE k < 10 DO\n  Incr k;\n  s := s + k;\nENDWHILE\nTPWrite "Suma = " + s;\n',
      comprobar: [C.mensajes(['Suma = 55']), C.usa('while'), C.noMas('for', 0, 'Sin FOR'), C.usa('num', 1, 'Declara variables num')],
      detalle: '<p>El patrón <i>acumulador</i> (empezar en 0 y sumar en cada vuelta) aparece en un robot para contar piezas, sumar tiempos de ciclo o promediar lecturas de un sensor. Un WHILE se usa cuando no se sabe cuántas vueltas darán: «mientras haya piezas en la entrada».</p>' }),
    ejercicio({
      id: 't4-par', titulo: 'Pares e impares',
      enunciado: 'Para i de 1 a 6 escriba <b>«1 impar», «2 par», «3 impar»…</b>, con un <code>IF … ELSE</code> y dos TPWrite como mucho.',
      inicial: '! Taller 4, ejercicio 3: decidir.\n\n',
      pistas: ['Un número es par si al dividirlo entre 2 no queda decimal: <code>Trunc(i / 2) * 2 = i</code>.', '<code>TPWrite i + " par";</code> escribe «2 par».'],
      solucion: 'FOR i FROM 1 TO 6 DO\n  IF Trunc(i / 2) * 2 = i THEN\n    TPWrite i + " par";\n  ELSE\n    TPWrite i + " impar";\n  ENDIF\nENDFOR\n',
      comprobar: [C.mensajes(['1 impar', '2 par', '3 impar', '4 par', '5 impar', '6 par']), C.usa('if'), C.usa('else'), C.noMas('tpwrite', 2, 'Dos TPWrite como mucho')],
      detalle: '<p>RAPID no tiene el operador módulo como <code>%</code>; tiene <code>MOD</code> en los robots reales. Aquí se usa <code>Trunc</code>, que quita los decimales. Este tipo de decisión aparece al alternar el sentido de las filas en un paletizado (una fila de ida, otra de vuelta).</p>' }),
    ejercicio({
      id: 't4-escalera', titulo: 'Una escalera con un bucle',
      enunciado: 'Desde <code>s := [−60, −200, 40, −90, 0]</code> dibuje en rectas una escalera de 4 escalones: cada uno <b>sube 15 mm</b> y <b>avanza 20 mm en x</b>. Escriba como mucho <b>dos MoveL</b> en el texto.',
      inicial: '! Taller 4, ejercicio 4: geometría en un FOR.\nCONST robtarget s := [-60, -200, 40, -90, 0];\n\nMoveAbsJ init, v500, fine;\nMoveJ s, v500, fine;\n',
      pistas: ['En el escalón k (0 a 3) la subida termina en <code>Offs(s, 20 * k, 0, 15 * (k + 1))</code>.', 'Y el avance, en <code>Offs(s, 20 * (k + 1), 0, 15 * (k + 1))</code>.'],
      solucion: 'CONST robtarget s := [-60, -200, 40, -90, 0];\n\nMoveAbsJ init, v500, fine;\nMoveJ s, v500, fine;\nFOR k FROM 0 TO 3 DO\n  MoveL Offs(s, 20 * k, 0, 15 * (k + 1)), v100, fine;\n  MoveL Offs(s, 20 * (k + 1), 0, 15 * (k + 1)), v100, fine;\nENDFOR\n',
      comprobar: [C.paraEn([0, 1, 2, 3, 4, 5, 6, 7, 8].map(ESC), 3, 'Se detiene en las 9 esquinas de la escalera, en orden'), C.usa('for'), C.noMas('MoveL', 2, 'Dos MoveL escritos como mucho')],
      detalle: '<p>Escribir la posición como <b>fórmula del índice</b> es la idea detrás de todo patrón repetitivo: paletizado, perforado de una placa, dosificado en una bandeja de pocillos. En un ABB real, además, existen funciones de paletizado ya hechas, pero todas se reducen a esto.</p>' }),
    ejercicio({
      id: 't4-circulo', titulo: 'Un círculo calculado',
      enunciado: 'Recorra con <code>MoveL</code> 12 puntos de un círculo de <b>50 mm</b> de radio con centro en <code>c := [0, −210, 70, −90, 0]</code>, empezando en el ángulo 0 (x = +50) y volviendo a él. Use <code>Cos</code> y <code>Sin</code> (en grados) y un solo MoveL escrito.',
      inicial: '! Taller 4, ejercicio 5: trigonometría.\nCONST robtarget c := [0, -210, 70, -90, 0];\n\nMoveAbsJ init, v500, fine;\nMoveJ Offs(c, 50, 0, 0), v500, fine;\n',
      pistas: ['El punto del ángulo a es <code>Offs(c, 50 * Cos(a), 50 * Sin(a), 0)</code>.', 'Un FOR con <code>STEP 30</code> desde 30 hasta 360.'],
      solucion: 'CONST robtarget c := [0, -210, 70, -90, 0];\n\nMoveAbsJ init, v500, fine;\nMoveJ Offs(c, 50, 0, 0), v500, fine;\nFOR a FROM 30 TO 360 STEP 30 DO\n  MoveL Offs(c, 50 * Cos(a), 50 * Sin(a), 0), v100, z1;\nENDFOR\n',
      comprobar: [C.pasaPor([[50, -210, 70], [0, -160, 70], [-50, -210, 70], [0, -260, 70], [50, -210, 70]], 4, 'Pasa por los cuatro puntos cardinales del círculo y vuelve al inicio'), C.usa('for'), C.noMas('MoveL', 1, 'Un solo MoveL escrito'), C.noMas('MoveC', 0, 'Sin MoveC (se calcula)')],
      detalle: '<p>Con 12 rectas el polígono se aparta del círculo verdadero como mucho $r(1-\\cos 15°) \\approx 1{,}7$ mm. Con <code>MoveC</code> (dos arcos) el controlador haría el círculo exacto; calcularlo punto a punto sirve para curvas que el robot no trae de fábrica: espirales, elipses, perfiles de una leva.</p>' }),
    ejercicio({
      id: 't4-todos', titulo: 'Los tres cubos con un FOR',
      enunciado: 'Lleve los tres cubos a la bandeja, uno al lado del otro (x = 80, 110 y 140; y = −200), con un <code>FOR</code> y en <b>16 líneas de código o menos</b>.',
      inicial: '! Taller 4, ejercicio 6: el ciclo de manipulación en un bucle.\n\n',
      pistas: ['En la fila, el cubo k está en <code>Offs(toma, 0, -50 * k, 0)</code> con toma = cubo1.', 'En la bandeja, en <code>Offs(deja, -30 + 30 * k, 0, 0)</code>.'],
      solucion: 'CONST robtarget toma := [-110, -150, 10, -90, 0];\nCONST robtarget deja := [110, -200, 13, -90, 0];\nMoveAbsJ init, v500, fine;\nGripperOpen;\nFOR k FROM 0 TO 2 DO\n  MoveJ Offs(toma, 0, -50 * k, 60), v500, z10;\n  MoveL Offs(toma, 0, -50 * k, 0), v80, fine;\n  GripperClose;\n  MoveL Offs(toma, 0, -50 * k, 60), v150, z10;\n  MoveJ Offs(deja, -30 + 30 * k, 0, 60), v500, z10;\n  MoveL Offs(deja, -30 + 30 * k, 0, 0), v80, fine;\n  GripperOpen;\n  MoveL Offs(deja, -30 + 30 * k, 0, 60), v150, z10;\nENDFOR\n',
      comprobar: [C.enBandeja(['cubo1', 'cubo2', 'cubo3']), C.propia('Quedan uno al lado del otro, sin apilar', (r) => ['cubo1', 'cubo2', 'cubo3'].every((n) => r.piezas[n].z < 20) || 'Hay cubos apilados.'), C.usa('for'), C.lineas(16)],
      detalle: '<p>Dieciséis líneas para tres piezas; las mismas dieciséis servirían para treinta cambiando un número. Ése es el valor de separar <b>qué</b> se repite (el ciclo) de <b>dónde</b> (la fórmula del punto).</p>' }),
    ejercicio({
      id: 't4-contador', titulo: 'Contar lo que se hizo',
      enunciado: 'Haga lo mismo que en el ejercicio anterior, pero cuente las piezas con una variable y, después de dejar cada una, escriba <b>«Piezas: 1»</b>, <b>«Piezas: 2»</b>, <b>«Piezas: 3»</b>. Use <code>Incr</code>.',
      inicial: '! Taller 4, ejercicio 7: un contador de producción.\n\n',
      pistas: ['<code>VAR num n := 0;</code> arriba; después de soltar, <code>Incr n; TPWrite "Piezas: " + n;</code>'],
      solucion: 'CONST robtarget toma := [-110, -150, 10, -90, 0];\nCONST robtarget deja := [110, -200, 13, -90, 0];\nVAR num n := 0;\nMoveAbsJ init, v500, fine;\nGripperOpen;\nFOR k FROM 0 TO 2 DO\n  MoveJ Offs(toma, 0, -50 * k, 60), v500, z10;\n  MoveL Offs(toma, 0, -50 * k, 0), v80, fine;\n  GripperClose;\n  MoveL Offs(toma, 0, -50 * k, 60), v150, z10;\n  MoveJ Offs(deja, -30 + 30 * k, 0, 60), v500, z10;\n  MoveL Offs(deja, -30 + 30 * k, 0, 0), v80, fine;\n  GripperOpen;\n  Incr n;\n  TPWrite "Piezas: " + n;\n  MoveL Offs(deja, -30 + 30 * k, 0, 60), v150, z10;\nENDFOR\n',
      comprobar: [C.mensajes(['Piezas: 1', 'Piezas: 2', 'Piezas: 3']), C.enBandeja(['cubo1', 'cubo2', 'cubo3']), C.usa('incr'), C.orden([E.suelta(), E.mensaje('Piezas: 1'), E.suelta(), E.mensaje('Piezas: 2')], 'Cada mensaje sale después de soltar la pieza')],
      detalle: '<p>En una celda real el contador se declara <code>PERS</code> para que sobreviva a un reinicio, y se comparte con el PLC por una señal de grupo (<code>SetGO</code>) o por un bus de campo (lección 18). Un contador bien ubicado (después de soltar, no antes) es el que permite calcular el OEE.</p>' }),
  ],
};

// ================================================================ Taller 5
const LARGO = ['CONST robtarget toma := [-110, -150, 10, -90, 0];', 'CONST robtarget deja := [110, -200, 13, -90, 0];', 'MoveAbsJ init, v500, fine;', 'GripperOpen;',
  ...[0, 1, 2].flatMap((k) => [`! cubo${k + 1}`, `MoveJ Offs(toma, 0, ${-50 * k}, 60), v500, z10;`, `MoveL Offs(toma, 0, ${-50 * k}, 0), v80, fine;`, 'GripperClose;', `MoveL Offs(toma, 0, ${-50 * k}, 60), v150, z10;`,
    `MoveJ Offs(deja, ${-30 + 30 * k}, 0, 60), v500, z10;`, `MoveL Offs(deja, ${-30 + 30 * k}, 0, 0), v80, fine;`, 'GripperOpen;', `MoveL Offs(deja, ${-30 + 30 * k}, 0, 60), v150, z10;`])].join('\n') + '\nMoveAbsJ init, v500, fine;\n';
export const taller5 = {
  titulo: 'Taller 5 · Procedimientos: programas que se leen',
  resumen: 'PROC y ENDPROC, main, variables compartidas y cómo ordenar un programa para que otra persona (o usted en seis meses) lo entienda y lo cambie sin miedo.',
  conceptos: [
    ['PROC nombre()', 'Un bloque de instrucciones con nombre. Se ejecuta escribiendo su nombre: <code>tomar;</code>'],
    ['main', 'El procedimiento por el que empieza el programa.'],
    ['Variable global', 'Declarada arriba, fuera de los PROC: todos la ven. Aquí hace de parámetro.'],
    ['Refactorizar', 'Cambiar la forma de un programa sin cambiar lo que hace.'],
  ],
  referencias: [REF_RAPID, 'Fowler, M. (2018). <i>Refactoring: Improving the Design of Existing Code</i> (2.ª ed.). Addison-Wesley.', REF_BIGGS],
  pasos: [
    { ...celda, titulo: 'Nombres para las ideas', texto: 'Un procedimiento pone nombre a una idea («tomar», «dejar») y la escribe una sola vez.',
      detalle: `<pre class="codigo">VAR num i := 0;              ! global: la ven main, tomar y dejar

PROC main()
  FOR k FROM 0 TO 2 DO
    i := k;                  ! «parámetro» para tomar y dejar
    tomar;
    dejar;
  ENDFOR
ENDPROC

PROC tomar()
  MoveJ Offs(fila, 0, -50 * i, 60), v500, z10;
  ...
ENDPROC</pre>
<p>En un ABB real los procedimientos reciben parámetros (<code>PROC tomar(robtarget p)</code>) y hay funciones que devuelven valores (<code>FUNC num</code>). Esta aplicación no los tiene: se pasa la información por variables globales, como en los primeros lenguajes de robots. La idea es la misma.</p>
<p><b>Buenas prácticas</b> que se exigen en cualquier planta: un procedimiento hace una sola cosa y se llama por lo que hace (verbo); <code>main</code> se lee como un índice del ciclo; los puntos y los números mágicos van arriba, con nombre; se comenta el <i>por qué</i>, no el <i>qué</i>.</p>
<p>Otros lenguajes: en KUKA KRL, <code>DEF tomar() … END</code>; en FANUC TP, <code>CALL TOMAR</code> a otro programa; en URScript, <code>def tomar(): … end</code>.</p>` },
    ejercicio({
      id: 't5-saludo', titulo: 'Su primer procedimiento',
      enunciado: 'Escriba un procedimiento <code>saludo</code> que escriba <b>«Hola»</b> y llámelo dos veces desde <code>main</code>. Un solo TPWrite en todo el programa.',
      inicial: '! Taller 5, ejercicio 1: PROC.\n\n',
      pistas: ['<code>PROC main() … ENDPROC</code> y <code>PROC saludo() … ENDPROC</code>, uno debajo del otro.', 'Dentro de main: <code>saludo;</code> dos veces.'],
      solucion: 'PROC main()\n  saludo;\n  saludo;\nENDPROC\n\nPROC saludo()\n  TPWrite "Hola";\nENDPROC\n',
      comprobar: [C.mensajes(['Hola', 'Hola']), C.usa('proc'), C.usa('llamada', 2, 'Llama a un procedimiento dos veces'), C.noMas('tpwrite', 1, 'Un solo TPWrite')],
      detalle: '<p>Cuando hay procedimientos, el programa empieza en <code>main</code>; lo que esté fuera de todo PROC (salvo las declaraciones) no se ejecuta. Si no hay <code>main</code>, se ejecuta lo que esté fuera de los procedimientos, de arriba abajo.</p>' }),
    ejercicio({
      id: 't5-tomar-dejar', titulo: 'tomar y dejar',
      enunciado: 'Escriba <code>PROC tomar()</code> y <code>PROC dejar()</code> que usen una variable global <code>i</code>, y un <code>main</code> con un FOR que lleve <b>cubo1 y cubo2</b> a la bandeja (x = 90 y 130; y = −200). cubo3 se queda.',
      inicial: '! Taller 5, ejercicio 2: procedimientos con una variable compartida.\nCONST robtarget fila := [-110, -150, 10, -90, 0];\nCONST robtarget deja := [110, -200, 13, -90, 0];\nVAR num i := 0;\n\n',
      pistas: ['En main: <code>FOR k FROM 0 TO 1 DO i := k; tomar; dejar; ENDFOR</code>', 'En dejar, el punto es <code>Offs(deja, -20 + 40 * i, 0, 0)</code>.'],
      solucion: 'CONST robtarget fila := [-110, -150, 10, -90, 0];\nCONST robtarget deja := [110, -200, 13, -90, 0];\nVAR num i := 0;\n\nPROC main()\n  MoveAbsJ init, v500, fine;\n  GripperOpen;\n  FOR k FROM 0 TO 1 DO\n    i := k;\n    tomar;\n    dejar;\n  ENDFOR\n  MoveAbsJ init, v500, fine;\nENDPROC\n\nPROC tomar()\n  MoveJ Offs(fila, 0, -50 * i, 60), v500, z10;\n  MoveL Offs(fila, 0, -50 * i, 0), v80, fine;\n  GripperClose;\n  WaitTime 0.3;\n  MoveL Offs(fila, 0, -50 * i, 60), v150, z10;\nENDPROC\n\nPROC dejar()\n  MoveJ Offs(deja, -20 + 40 * i, 0, 60), v500, z10;\n  MoveL Offs(deja, -20 + 40 * i, 0, 0), v80, fine;\n  GripperOpen;\n  WaitTime 0.3;\n  MoveL Offs(deja, -20 + 40 * i, 0, 60), v150, z10;\nENDPROC\n',
      comprobar: [C.enBandeja(['cubo1', 'cubo2']), C.enSitio('cubo3', -110, -250, 'cubo3 sigue en su sitio'), C.usa('proc', 2, 'Tiene al menos dos PROC además de main'), C.usa('for')],
      detalle: '<p>Ahora <code>main</code> dice en tres líneas lo que hace la celda. Si mañana cambia la pinza y hay que abrir antes de bajar, se toca sólo <code>tomar</code>. Si cambia el patrón de la bandeja, sólo <code>dejar</code>.</p>' }),
    ejercicio({
      id: 't5-torre', titulo: 'Reto: una torre',
      enunciado: 'Apile los tres cubos en la bandeja, uno encima del otro, usando procedimientos. Cuidado: con la pinza hacia abajo, el brazo sube hasta unos 100 mm, así que la aproximación a la pila debe ser corta.',
      inicial: '! Taller 5, ejercicio 3: apilar.\n\n',
      pistas: ['Cada cubo se deja 25 mm más alto: <code>Offs(pila, 0, 0, 25 * i)</code>.', 'Aproximación a la pila de 35 mm: <code>Offs(pila, 0, 0, 25 * i + 35)</code>.', 'El ejemplo 6 de Programar lo resuelve; intente sin mirarlo.'],
      solucion: 'CONST robtarget fila := [-110, -150, 10, -90, 0];\nCONST robtarget pila := [110, -200, 13, -90, 0];\nVAR num i := 0;\n\nPROC main()\n  MoveAbsJ init, v500, fine;\n  GripperOpen;\n  FOR k FROM 0 TO 2 DO\n    i := k;\n    tomar;\n    dejar;\n  ENDFOR\n  MoveAbsJ home, v500, fine;\nENDPROC\n\nPROC tomar()\n  MoveJ Offs(fila, 0, -50 * i, 60), v500, z10;\n  MoveL Offs(fila, 0, -50 * i, 0), v80, fine;\n  GripperClose;\n  WaitTime 0.3;\n  MoveL Offs(fila, 0, -50 * i, 60), v150, z10;\nENDPROC\n\nPROC dejar()\n  MoveJ Offs(pila, 0, 0, 25 * i + 35), v500, z10;\n  MoveL Offs(pila, 0, 0, 25 * i), v60, fine;\n  GripperOpen;\n  WaitTime 0.3;\n  MoveL Offs(pila, 0, 0, 25 * i + 35), v150, z10;\nENDPROC\n',
      comprobar: [C.enBandeja(['cubo1', 'cubo2', 'cubo3']), C.propia('Forman una torre de tres pisos', (r) => {
        const p = ['cubo1', 'cubo2', 'cubo3'].map((n) => r.piezas[n]);
        const z = p.map((x) => x.z).sort((a, b) => a - b);
        return (z[2] - z[0] > 40 && Math.max(...p.map((x) => Math.hypot(x.x - p[0].x, x.y - p[0].y))) < 15) || 'No están uno encima del otro.';
      }), C.usa('proc', 2)],
      detalle: '<p>El límite de altura es una restricción del espacio de trabajo (lección 3): con la pinza vertical, hombro, codo y muñeca tienen que sumar −90° en el plano del brazo, y eso deja poco alcance hacia arriba. Un programador lo descubre con «fuera del alcance» y lo resuelve acortando la aproximación o inclinando la pinza.</p>' }),
    ejercicio({
      id: 't5-refactor', titulo: 'Refactorizar',
      enunciado: 'El programa de la derecha funciona pero repite tres veces lo mismo (43 líneas). Reescríbalo con un <code>PROC</code> y un <code>FOR</code> para que haga <b>exactamente lo mismo</b> en <b>22 líneas o menos</b>.',
      inicial: '! Taller 5, ejercicio 4: el mismo resultado, la mitad de líneas.\n' + LARGO,
      pistas: ['Lo que cambia entre las copias es sólo k: 0, 1, 2.', 'Un PROC <code>mover_cubo</code> con el ciclo completo usando una global <code>i</code>, y main con el FOR.'],
      solucion: 'CONST robtarget toma := [-110, -150, 10, -90, 0];\nCONST robtarget deja := [110, -200, 13, -90, 0];\nVAR num i := 0;\nPROC main()\n  MoveAbsJ init, v500, fine;\n  GripperOpen;\n  FOR k FROM 0 TO 2 DO\n    i := k;\n    mover_cubo;\n  ENDFOR\n  MoveAbsJ init, v500, fine;\nENDPROC\nPROC mover_cubo()\n  MoveJ Offs(toma, 0, -50 * i, 60), v500, z10;\n  MoveL Offs(toma, 0, -50 * i, 0), v80, fine;\n  GripperClose;\n  MoveL Offs(toma, 0, -50 * i, 60), v150, z10;\n  MoveJ Offs(deja, -30 + 30 * i, 0, 60), v500, z10;\n  MoveL Offs(deja, -30 + 30 * i, 0, 0), v80, fine;\n  GripperOpen;\n  MoveL Offs(deja, -30 + 30 * i, 0, 60), v150, z10;\nENDPROC\n',
      comprobar: [C.enBandeja(['cubo1', 'cubo2', 'cubo3']), C.propia('Quedan donde los dejaba el original (x = 80, 110, 140)', (r) => [['cubo1', 80], ['cubo2', 110], ['cubo3', 140]].every(([n, x]) => Math.abs(r.piezas[n].x - x) < 8) || 'Alguno quedó en otro sitio.'), C.usa('proc'), C.usa('for'), C.lineas(22)],
      detalle: '<p>Refactorizar exige comprobar que el comportamiento no cambió: aquí lo comprueba la corrección automática, igual que una prueba de software comprueba una función. En una planta, antes de cargar un programa refactorizado se ejecuta en el gemelo digital (esta celda virtual) y se compara el resultado.</p>' }),
  ],
};

// ================================================================ Taller 6
const OPERADOR = { di2: { valor: 1, tras: 1.5 } };
export const taller6 = {
  titulo: 'Taller 6 · Señales y lógica de celda',
  resumen: 'Entradas y salidas digitales: esperar a un sensor o a un operador, avisar con una torre de luces y decidir con IF. Cierra con un proyecto que junta todo.',
  conceptos: [
    ['di / do', 'Entrada / salida digital: vale 0 o 1. di1 es el sensor de la celda; di2, un botón; do1 a do3, la torre de luces.'],
    ['SetDO do1, 1', 'Enciende una salida. En una celda real, abre una válvula, avisa al PLC o enciende una luz.'],
    ['WaitDI di1, 1', 'Detiene el programa hasta que la entrada tome ese valor.'],
    ['Escenario', 'Una situación distinta de la celda (con o sin pieza). El programa se prueba en todas.'],
  ],
  referencias: [REF_RAPID, 'IEC 60204-1:2016. Safety of machinery — Electrical equipment of machines (colores de indicadores luminosos).', 'IEC 61131-3:2013. Programmable controllers — Programming languages (el otro lado de las señales: el PLC).', REF_SICILIANO('Cap. 6, «Control Architecture» (el robot como parte de un sistema).')],
  pasos: [
    { ...celda, titulo: 'El robot no está solo', texto: 'Una celda real se coordina con señales: el robot espera a que llegue la pieza, avisa cuando termina y no entra si la puerta está abierta.',
      detalle: `<p>Las <b>entradas</b> (<code>di</code>) las cambia el mundo: un sensor de presencia, un botón, el PLC diciendo «pieza lista». Las <b>salidas</b> (<code>do</code>) las cambia el programa: una luz, una válvula, la señal «robot fuera de la máquina».</p>
<pre class="codigo">SetDO do2, 1;          ! luz durazno: esperando
WaitDI di1, 1;         ! hasta que el sensor vea una pieza
SetDO do2, 0;
SetDO do1, 1;          ! luz lima: trabajando
...
IF di1 = 1 THEN        ! una entrada se lee como un número
  ...
ENDIF</pre>
<p><b>Handshake.</b> Entre el robot y una máquina (un torno, una prensa) se usan pares de señales: el robot pide «¿puedo entrar?», la máquina responde «puertas abiertas, entre», el robot avisa «estoy fuera». Nunca se confía en un tiempo fijo: se espera la señal. En un ABB, <code>WaitDI … \\MaxTime</code> evita esperar para siempre si el sensor falla.</p>
<p><b>Torre de luces</b> (IEC 60204-1): verde, funcionamiento normal; amarillo, atención o condición anormal; rojo, emergencia o falla. En esta celda: do1 lima, do2 durazno, do3 fucsia.</p>
<p>En la aplicación, di1 la enciende el anillo del sensor cuando hay un cubo encima (cubo1 empieza sobre él). di2 se pulsa a mano en la tarjeta Celda de trabajo de Programar; en la corrección, un «operador simulado» la pulsa cuando el ejercicio lo dice.</p>` },
    ejercicio({
      id: 't6-semaforo', titulo: 'Semáforo',
      enunciado: 'Encienda do1 un segundo, apáguela; encienda do2 un segundo, apáguela; y termine con do3 encendida.',
      inicial: '! Taller 6, ejercicio 1: salidas y tiempos.\n\n',
      pistas: ['<code>SetDO do1, 1; WaitTime 1; SetDO do1, 0;</code>'],
      solucion: 'SetDO do1, 1;\nWaitTime 1;\nSetDO do1, 0;\nSetDO do2, 1;\nWaitTime 1;\nSetDO do2, 0;\nSetDO do3, 1;\n',
      comprobar: [C.orden([E.salida('do1', 1), E.salida('do1', 0), E.salida('do2', 1), E.salida('do2', 0), E.salida('do3', 1)], 'do1 se enciende y apaga, luego do2, y al final se enciende do3'), C.salidaFinal('do3', 1), C.salidaFinal('do1', 0), C.salidaFinal('do2', 0), C.ciclo(99, 2)],
      detalle: '<p>Las salidas se ven en la torre de luces de la escena. En un robot ABB, además de <code>SetDO</code> están <code>Set</code> y <code>Reset</code> (1 y 0) y <code>PulseDO</code> (un pulso de duración fija), y las salidas se configuran en el controlador asociándolas a un módulo de E/S o a un bus de campo.</p>' }),
    ejercicio({
      id: 't6-operador', titulo: 'Esperar al operador',
      enunciado: 'Vaya a <code>init</code>, espere a que el operador pulse <b>di2</b> y sólo entonces lleve la punta a <b>[0, −200, 100]</b> con la pinza hacia abajo. En la corrección, el operador pulsa a los 1,5 s.',
      inicial: '! Taller 6, ejercicio 2: WaitDI.\n\n',
      pistas: ['<code>WaitDI di2, 1;</code> entre el MoveAbsJ y el MoveJ.'],
      solucion: 'CONST robtarget p := [0, -200, 100, -90, 0];\n\nMoveAbsJ init, v500, fine;\nWaitDI di2, 1;\nMoveJ p, v500, fine;\n',
      escenarios: [{ nombre: 'el operador pulsa di2', entradas: OPERADOR, comprobar: [C.orden([E.entrada('di2', 1), E.mover()], 'Se mueve después de que se pulsa di2'), C.llega([0, -200, 100]), C.usa('waitdi')] }],
      comprobar: [],
      detalle: '<p>Mientras espera, el robot está detenido pero con el programa en marcha. Así arranca muchas celdas: el operador carga la pieza, sale de la zona y pulsa un botón de «ciclo» (o el PLC lo hace al cerrarse una barrera de luz).</p>' }),
    ejercicio({
      id: 't6-si-hay', titulo: 'Sólo si hay pieza',
      enunciado: 'Si el sensor <b>di1</b> ve una pieza, lleve cubo1 a la bandeja; si no, escriba <b>«Sin pieza»</b> y no baje a tomar nada. El programa se prueba en dos escenarios: con cubo1 sobre el sensor y sin él.',
      inicial: '! Taller 6, ejercicio 3: decidir con una entrada.\nCONST robtarget toma := [-110, -150, 10, -90, 0];\nCONST robtarget deja := [110, -200, 13, -90, 0];\n\nMoveAbsJ init, v500, fine;\nGripperOpen;\n',
      pistas: ['<code>IF di1 = 1 THEN … ELSE TPWrite "Sin pieza"; ENDIF</code>', 'Dentro del IF va el ciclo de tomar y dejar del taller 2.'],
      solucion: 'CONST robtarget toma := [-110, -150, 10, -90, 0];\nCONST robtarget deja := [110, -200, 13, -90, 0];\n\nMoveAbsJ init, v500, fine;\nGripperOpen;\nIF di1 = 1 THEN\n  MoveJ Offs(toma, 0, 0, 60), v500, z10;\n  MoveL toma, v80, fine;\n  GripperClose;\n  WaitTime 0.3;\n  MoveL Offs(toma, 0, 0, 60), v150, z10;\n  MoveJ Offs(deja, 0, 0, 60), v500, z10;\n  MoveL deja, v80, fine;\n  GripperOpen;\n  WaitTime 0.3;\n  MoveL Offs(deja, 0, 0, 60), v150, fine;\nELSE\n  TPWrite "Sin pieza";\nENDIF\n',
      escenarios: [
        { nombre: 'con cubo1 sobre el sensor', comprobar: [C.enBandeja(['cubo1']), C.noMensaje('Sin pieza'), C.usa('if')] },
        { nombre: 'sin cubo1', piezas: SIN_CUBO1, comprobar: [C.mensaje('Sin pieza'), C.nuncaBajo(40, 'No baja a tomar (la punta no baja de 40 mm)')] },
      ],
      comprobar: [],
      detalle: '<p>Probar en varios escenarios es la forma honesta de comprobar una decisión: un programa que siempre toma, o que siempre escribe «Sin pieza», pasa uno de los dos pero no ambos. En la industria esto se llama <b>prueba de casos</b>, y en un robot real se hace con el gemelo digital antes de arriesgar la máquina.</p>' }),
    ejercicio({
      id: 't6-luces', titulo: 'Un ciclo con luces',
      enunciado: 'Encienda <b>do2</b> (esperando) y espere a que el operador pulse <b>di2</b>. Entonces apague do2, encienda <b>do1</b> (trabajando), lleve cubo1 a la bandeja, apague do1 y encienda <b>do3</b> (terminado).',
      inicial: '! Taller 6, ejercicio 4: el ciclo de una celda.\nCONST robtarget toma := [-110, -150, 10, -90, 0];\nCONST robtarget deja := [110, -200, 13, -90, 0];\n\n',
      pistas: ['Orden: SetDO do2 1 → WaitDI di2 1 → SetDO do2 0 → SetDO do1 1 → tomar y dejar → SetDO do1 0 → SetDO do3 1.'],
      solucion: 'CONST robtarget toma := [-110, -150, 10, -90, 0];\nCONST robtarget deja := [110, -200, 13, -90, 0];\n\nMoveAbsJ init, v500, fine;\nGripperOpen;\nSetDO do2, 1;\nWaitDI di2, 1;\nSetDO do2, 0;\nSetDO do1, 1;\nMoveJ Offs(toma, 0, 0, 60), v500, z10;\nMoveL toma, v80, fine;\nGripperClose;\nWaitTime 0.3;\nMoveL Offs(toma, 0, 0, 60), v150, z10;\nMoveJ Offs(deja, 0, 0, 60), v500, z10;\nMoveL deja, v80, fine;\nGripperOpen;\nWaitTime 0.3;\nMoveL Offs(deja, 0, 0, 60), v150, fine;\nSetDO do1, 0;\nSetDO do3, 1;\n',
      escenarios: [{ nombre: 'el operador pulsa di2', entradas: OPERADOR, comprobar: [
        C.orden([E.salida('do2', 1), E.entrada('di2', 1), E.salida('do1', 1), E.agarra('cubo1'), E.suelta('cubo1'), E.salida('do1', 0), E.salida('do3', 1)], 'do2 → di2 → do1 → toma → deja → do1 apagada → do3'),
        C.enBandeja(['cubo1']), C.salidaFinal('do2', 0), C.salidaFinal('do1', 0), C.salidaFinal('do3', 1)] }],
      comprobar: [],
      detalle: '<p>Las luces son el estado de la celda visto desde fuera. El mismo estado se manda al PLC y al sistema de supervisión (SCADA): con él se calcula la disponibilidad y se detecta cuánto tiempo pasa la celda esperando al operador (lección 18, OEE).</p>' }),
    ejercicio({
      id: 't6-proyecto', titulo: 'Proyecto final: la fila al revés',
      enunciado: 'Deje la fila en orden inverso (cubo3 donde estaba cubo1 y cubo1 donde estaba cubo3; cubo2 en su sitio) usando la bandeja como lugar de paso. Con <b>un PROC</b> para mover una pieza, <b>do1</b> encendida mientras trabaja, <b>do3</b> al final, y un contador que termine escribiendo <b>«Movimientos: 3»</b>.',
      inicial: '! Taller 6, ejercicio 5: proyecto final.\n\n',
      pistas: ['Orden de los movimientos: cubo1 a la bandeja, cubo3 al sitio de cubo1, cubo1 (de la bandeja) al sitio de cubo3.', 'Un PROC <code>mover</code> que lleve de <code>desde</code> a <code>hasta</code>… sin parámetros: use dos variables num con la y de origen y destino, o tres PROC.', 'Al dejar sobre la mesa (no en la bandeja) baje a z = 13 para no chocar la mesa con la pieza: <code>Offs(p, 0, 0, 3)</code>.'],
      solucion: 'CONST robtarget a := [-110, -150, 10, -90, 0];\nCONST robtarget c := [-110, -250, 10, -90, 0];\nCONST robtarget b := [110, -200, 10, -90, 0];\nVAR num n := 0;\nVAR num ox := 0;\nVAR num oy := 0;\nVAR num dx := 0;\nVAR num dy := 0;\n\nPROC main()\n  MoveAbsJ init, v500, fine;\n  GripperOpen;\n  SetDO do3, 0;\n  SetDO do1, 1;\n  ox := -110;\n  oy := -150;\n  dx := 110;\n  dy := -200;\n  mover;\n  ox := -110;\n  oy := -250;\n  dx := -110;\n  dy := -150;\n  mover;\n  ox := 110;\n  oy := -200;\n  dx := -110;\n  dy := -250;\n  mover;\n  SetDO do1, 0;\n  SetDO do3, 1;\n  TPWrite "Movimientos: " + n;\n  MoveAbsJ init, v500, fine;\nENDPROC\n\nPROC mover()\n  MoveJ Offs(a, ox + 110, oy + 150, 60), v500, z10;\n  MoveL Offs(a, ox + 110, oy + 150, 0), v80, fine;\n  GripperClose;\n  WaitTime 0.3;\n  MoveL Offs(a, ox + 110, oy + 150, 60), v150, z10;\n  MoveJ Offs(a, dx + 110, dy + 150, 60), v500, z10;\n  MoveL Offs(a, dx + 110, dy + 150, 3), v80, fine;\n  GripperOpen;\n  WaitTime 0.3;\n  MoveL Offs(a, dx + 110, dy + 150, 60), v150, z10;\n  Incr n;\nENDPROC\n',
      comprobar: [C.enSitio('cubo3', -110, -150, 'cubo3 queda en [−110, −150]'), C.enSitio('cubo2', -110, -200, 'cubo2 queda en [−110, −200]'), C.enSitio('cubo1', -110, -250, 'cubo1 queda en [−110, −250]'),
        C.mensaje('Movimientos: 3'), C.salidaFinal('do3', 1), C.salidaFinal('do1', 0), C.usa('proc'), C.usa('incr'),
        C.orden([E.salida('do1', 1), E.agarra(), E.suelta(), E.salida('do1', 0), E.salida('do3', 1)], 'do1 encendida durante el trabajo y do3 al terminar')],
      detalle: '<p>Este proyecto junta todo el taller: puntos relativos, el ciclo de tomar y dejar, un procedimiento parametrizado con variables globales, un contador y señales. Es, a pequeña escala, el programa de una celda real de reordenamiento. Si lo resolvió sin mirar la solución, ya puede escribir los programas de la pestaña Programar para el brazo real.</p>' }),
  ],
};

export const TALLERES = [taller1, taller2, taller3, taller4, taller5, taller6];
