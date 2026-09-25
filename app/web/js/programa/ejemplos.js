// Programas de ejemplo. Todos usan la celda virtual: tres cubos de 25 mm en
// fila a la izquierda (cubo1 sobre el sensor de entrada), una bandeja a la
// derecha y una torre de luces. Coordenadas en mm del marco de la base; el
// brazo mira hacia −y, así que los puntos de trabajo tienen y negativa.

export const EJEMPLOS = [
  {
    id: 'primeros', titulo: '1. Primeros pasos: MoveJ y MoveL',
    texto: `! Primer programa: dos puntos y dos maneras de ir entre ellos.
! MoveJ mueve todas las articulaciones a la vez: la punta hace una curva.
! MoveL lleva la punta en línea recta, a la velocidad indicada en mm/s.
! Encienda «Rastro» en la barra de abajo para ver el camino de la punta.

CONST robtarget p1 := [-150, -200, 120, -60, 0];
CONST robtarget p2 := [150, -200, 120, -60, 0];

MoveAbsJ init, v500, fine;
MoveJ p1, v500, fine;
MoveJ p2, v500, fine;     ! curva
MoveL p1, v100, fine;     ! recta
MoveAbsJ init, v500, fine;
`,
  },
  {
    id: 'tomar', titulo: '2. Tomar y colocar un cubo',
    texto: `! Toma cubo1 y lo deja en la bandeja.
! Offs(p, dx, dy, dz) es el punto p desplazado en mm: se usa para
! acercarse desde arriba (aproximación) y para retirarse.

CONST robtarget toma := [-110, -150, 10, -90, 0];
CONST robtarget deja := [110, -200, 13, -90, 0];

PROC main()
  MoveAbsJ init, v500, fine;
  GripperOpen;
  MoveJ Offs(toma, 0, 0, 60), v500, z10;   ! encima de la pieza
  MoveL toma, v80, fine;                   ! baja en recta
  GripperClose;
  WaitTime 0.3;
  MoveL Offs(toma, 0, 0, 60), v150, z10;   ! sube
  MoveJ Offs(deja, 0, 0, 60), v500, z10;   ! encima de la bandeja
  MoveL deja, v80, fine;
  GripperOpen;
  WaitTime 0.3;
  MoveL Offs(deja, 0, 0, 60), v150, fine;
  MoveAbsJ init, v500, fine;
ENDPROC
`,
  },
  {
    id: 'cuadrado', titulo: '3. Cuadrado con MoveL',
    texto: `! La punta dibuja un cuadrado de 100 mm sobre un plano horizontal.
! Encienda «Rastro» para verlo. Con «fine» se detiene en cada esquina.

CONST robtarget a := [-50, -160, 80, -90, 0];

MoveAbsJ init, v500, fine;
MoveJ a, v500, fine;
MoveL Offs(a, 100, 0, 0), v100, fine;
MoveL Offs(a, 100, -100, 0), v100, fine;
MoveL Offs(a, 0, -100, 0), v100, fine;
MoveL a, v100, fine;
MoveAbsJ init, v500, fine;
`,
  },
  {
    id: 'zonas', titulo: '4. Zonas: fine contra z20',
    texto: `! El mismo cuadrado, pero con zona z20: el robot no se detiene en las
! esquinas, las redondea empezando 20 mm antes. Es más rápido.
! Compare el tiempo de ciclo con el ejemplo 3 (Verificar lo muestra).

CONST robtarget a := [-50, -160, 80, -90, 0];

MoveAbsJ init, v500, fine;
MoveJ a, v500, fine;
MoveL Offs(a, 100, 0, 0), v100, z20;
MoveL Offs(a, 100, -100, 0), v100, z20;
MoveL Offs(a, 0, -100, 0), v100, z20;
MoveL a, v100, fine;
MoveAbsJ init, v500, fine;
`,
  },
  {
    id: 'circulo', titulo: '5. Círculo con MoveC',
    texto: `! MoveC via, fin: arco que pasa por «via» y termina en «fin».
! Un círculo completo son dos medios arcos.

CONST robtarget centro := [0, -210, 70, -90, 0];

MoveAbsJ init, v500, fine;
MoveJ Offs(centro, -60, 0, 0), v500, fine;
MoveC Offs(centro, 0, 60, 0), Offs(centro, 60, 0, 0), v80, z5;
MoveC Offs(centro, 0, -60, 0), Offs(centro, -60, 0, 0), v80, fine;
MoveAbsJ init, v500, fine;
`,
  },
  {
    id: 'apilar', titulo: '6. Apilar tres cubos (FOR y procedimientos)',
    texto: `! Toma los tres cubos de la fila y los apila en la bandeja.
! FOR repite el bloque; i vale 0, 1 y 2. Cada cubo está 50 mm más
! lejos en la fila y queda 25 mm más alto en la pila.
! Los procedimientos (PROC) agrupan instrucciones con un nombre.
! Con la pinza hacia abajo el brazo sube hasta unos 100 mm; por eso
! la aproximación a la pila es de 35 mm y no de 60.

CONST robtarget fila := [-110, -150, 10, -90, 0];
CONST robtarget pila := [110, -200, 13, -90, 0];
VAR num i := 0;

PROC main()
  MoveAbsJ init, v500, fine;
  GripperOpen;
  FOR k FROM 0 TO 2 DO
    i := k;
    TPWrite "Cubo " + (i + 1);
    tomar;
    dejar;
  ENDFOR
  MoveAbsJ home, v500, fine;
ENDPROC

PROC tomar()
  MoveJ Offs(fila, 0, -50 * i, 60), v500, z10;
  MoveL Offs(fila, 0, -50 * i, 0), v80, fine;
  GripperClose;
  WaitTime 0.3;
  MoveL Offs(fila, 0, -50 * i, 60), v150, z10;
ENDPROC

PROC dejar()
  MoveJ Offs(pila, 0, 0, 25 * i + 35), v500, z10;
  MoveL Offs(pila, 0, 0, 25 * i), v60, fine;
  GripperOpen;
  WaitTime 0.3;
  MoveL Offs(pila, 0, 0, 25 * i + 35), v150, z10;
ENDPROC
`,
  },
  {
    id: 'senales', titulo: '7. Señales: esperar al sensor',
    texto: `! Una celda real se coordina con señales digitales.
! di1: sensor de entrada (vale 1 si hay una pieza sobre el anillo).
! do1 lima = trabajando, do2 durazno = esperando, do3 fucsia = terminado.

CONST robtarget entrada := [-110, -150, 10, -90, 0];
CONST robtarget deja := [110, -200, 13, -90, 0];

MoveAbsJ init, v500, fine;
GripperOpen;
SetDO do3, 0;
SetDO do2, 1;
TPWrite "Esperando pieza en la entrada";
WaitDI di1, 1;
SetDO do2, 0;
SetDO do1, 1;
MoveJ Offs(entrada, 0, 0, 60), v500, z10;
MoveL entrada, v80, fine;
GripperClose;
WaitTime 0.3;
MoveL Offs(entrada, 0, 0, 60), v150, z10;
MoveJ Offs(deja, 0, 0, 60), v500, z10;
MoveL deja, v80, fine;
GripperOpen;
WaitTime 0.3;
MoveL Offs(deja, 0, 0, 60), v150, fine;
MoveAbsJ init, v500, fine;
SetDO do1, 0;
SetDO do3, 1;
TPWrite "Listo";
`,
  },
  {
    id: 'paletizar', titulo: '8. Paletizado en cuadrícula (FOR anidados e IF)',
    texto: `! Coloca los cubos en una cuadrícula de 2 × 2 dentro de la bandeja.
! Dos FOR anidados recorren filas y columnas; IF detiene al tercer cubo.
! n cuenta las piezas colocadas.

CONST robtarget fila := [-110, -150, 10, -90, 0];
CONST robtarget esquina := [85, -175, 13, -90, 0];
VAR num n := 0;

MoveAbsJ init, v500, fine;
GripperOpen;
FOR f FROM 0 TO 1 DO
  FOR c FROM 0 TO 1 DO
    IF n < 3 THEN
      MoveJ Offs(fila, 0, -50 * n, 60), v500, z10;
      MoveL Offs(fila, 0, -50 * n, 0), v80, fine;
      GripperClose;
      WaitTime 0.3;
      MoveL Offs(fila, 0, -50 * n, 60), v150, z10;
      MoveJ Offs(esquina, 50 * c, -50 * f, 60), v500, z10;
      MoveL Offs(esquina, 50 * c, -50 * f, 0), v80, fine;
      GripperOpen;
      WaitTime 0.3;
      MoveL Offs(esquina, 50 * c, -50 * f, 60), v150, z10;
      Incr n;
    ENDIF
  ENDFOR
ENDFOR
TPWrite "Piezas colocadas: " + n;
MoveAbsJ init, v500, fine;
`,
  },
];


export const NUEVO = `! Programa nuevo. Mueva el robot con los botones de «Mover a mano»
! y pulse «+ MoveJ» o «+ MoveL»: cada instrucción guarda la posición actual.

MoveAbsJ init, v500, fine;
`;
