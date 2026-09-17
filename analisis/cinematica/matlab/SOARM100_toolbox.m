%% SOARM100_TOOLBOX
%  Construye el SO-ARM100 en DOS bibliotecas ajenas a este trabajo y contrasta su
%  cinematica contra la propia.  La idea no es "dibujar bonito": es que dos
%  implementaciones que nadie de este proyecto escribio den el mismo resultado.
%
%  QUE SE DEBE INTERPRETAR DE LA SALIDA
%    1) Los errores que imprime tienen que salir del orden de 1e-15 o menor.  Ese
%       valor es el redondeo de la aritmetica de doble precision, no un error de
%       modelado.  Si alguno sale del orden de 1e-3 o mayor, hay un parametro mal.
%    2) La figura sirve para comprobar de un vistazo que el brazo tiene la forma
%       que debe: base que gira sobre un eje vertical, tres cabeceos paralelos y
%       un giro final de herramienta.
%    3) El arbol de cuerpos rigidos NO se construye con la forma abreviada de
%       Denavit-Hartenberg de setFixedTransform: esa rutina no compone los cuatro
%       movimientos en el orden de la convencion clasica.  Cada fila de la tabla
%       se reparte entre un cuerpo de revolucion y un cuerpo fijo.  El motivo
%       esta explicado en el comentario que precede a esa seccion.  El programa
%       se autoverifica: si la construccion fuera incorrecta, el error que
%       imprime lo delataria de inmediato.
%
%  DEPENDENCIAS (ninguna es obligatoria; lo que falte se omite con un aviso)
%    - Robotics Toolbox de Peter Corke   https://petercorke.com/toolboxes/robotics-toolbox/
%    - Robotics System Toolbox de MathWorks (rigidBodyTree)

clc; clear; close all
P = SOARM100_parametros();
q_demo = [0.35; -0.35; 0.75; -0.55; 0.60];

fprintf('====================================================================\n');
fprintf(' SO-ARM100 -- CONTRASTE CONTRA BIBLIOTECAS INDEPENDIENTES\n');
fprintf('====================================================================\n\n');

% Directorio de salida de las figuras.  Se escribe ademas de mostrarse en
% pantalla, para que la figura reproducida en el documento sea exactamente la
% que produce el codigo.  Cada figura se guarda solo si su toolbox esta
% instalado, de modo que el guion no falla en una maquina que carezca de uno.
DIRSAL = fullfile(fileparts(mfilename('fullpath')), 'figuras');
if ~exist(DIRSAL,'dir'); mkdir(DIRSAL); end
guardar = @(nombre) exportgraphics(gcf, fullfile(DIRSAL,nombre), 'Resolution', 220);

%% ================= opcion A: Robotics Toolbox de Peter Corke =================
if exist('SerialLink','class') || exist('SerialLink','file')
    fprintf('A) ROBOTICS TOOLBOX DE PETER CORKE (SerialLink)\n\n');

    L = Link.empty(0,5);
    for i = 1:5
        L(i) = Link('d', P.DH(i,2), 'a', P.DH(i,3), 'alpha', P.DH(i,4), ...
                    'offset', P.DH(i,1), 'qlim', P.lim(i,:));
    end
    rob = SerialLink(L, 'name', 'SO-ARM100', 'base', P.Tb, 'tool', P.Tt);
    rob.display();

    % --- contraste de cinematica directa
    rng(1); e = 0;
    for k = 1:2000
        q = P.lim(:,1) + rand(5,1).*(P.lim(:,2)-P.lim(:,1));
        e = max(e, max(max(abs(double(rob.fkine(q')) - SOARM100_fk(q)))));
    end
    fprintf('   cinematica directa   SerialLink vs propia -> error maximo = %.3e\n', e);

    % --- contraste de jacobiano
    rng(1); ej = 0;
    for k = 1:500
        q = P.lim(:,1) + rand(5,1).*(P.lim(:,2)-P.lim(:,1));
        ej = max(ej, max(max(abs(rob.jacob0(q') - SOARM100_jacobiano(q)))));
    end
    fprintf('   jacobiano geometrico jacob0 vs propia     -> error maximo = %.3e\n', ej);

    % --- manipulabilidad: el punto donde la formula habitual falla
    J = rob.jacob0(zeros(1,5));
    fprintf('\n   manipulabilidad en q = 0\n');
    fprintf('     sqrt(det(J*J''))  = %.6e   <- formula habitual; con J de 6x5 da CERO\n', ...
            sqrt(max(det(J*J'),0)));
    fprintf('     sqrt(det(J''*J))  = %.6f        <- la formulacion valida aqui\n', ...
            sqrt(det(J'*J)));
    fprintf('     prod(svd(J))      = %.6f        <- coincide, como debe\n', prod(svd(J)));
    fprintf('     rob.maniplty(...) = %.6f        <- el toolbox aplica la habitual\n', ...
            rob.maniplty(zeros(1,5)));
    fprintf('\n   >> Esto NO es un fallo del toolbox: es que la formula de la literatura\n');
    fprintf('      exige tantas columnas como filas, y este brazo tiene 5 columnas y 6 filas.\n\n');

    % --- figura legible (la de por omision sale diminuta dentro de ejes enormes)
    figure('Color','w','Position',[80 80 760 620]);
    rob.plot(q_demo', 'workspace', [-0.35 0.20 -0.45 0.15 -0.05 0.40], ...
             'scale', 0.7, 'jointdiam', 0.7, 'jointcolor', [0.12 0.61 0.82], ...
             'linkcolor', [0.75 0.31 0.30], 'tilesize', 0.08, 'noshadow', ...
             'view', [-52 24], 'nobase', 'noname');
    axis equal; grid on; box on
    xlabel('x (m)'); ylabel('y (m)'); zlabel('z (m)')
    title({'SO-ARM100 construido con la tabla D-H', ...
           sprintf('q = (%s) grados', num2str(round(rad2deg(q_demo)',0)))}, ...
          'FontWeight','normal')
    guardar('mlab_fig5_corke_cadena_dh.png');
else
    fprintf('A) Robotics Toolbox de Peter Corke no encontrado; se omite esa parte.\n');
    fprintf('   Instalacion: descargar de petercorke.com y ejecutar startup_rvc.m\n\n');
end

%% ============ opcion B: Robotics System Toolbox de MathWorks ============
%
%  NOTA SOBRE LA CONSTRUCCION DEL ARBOL.
%  Se probaron dos caminos que NO funcionan, y conviene dejar constancia:
%
%    1) setFixedTransform(j, [a alpha d theta], 'dh')  produce una geometria
%       distinta de la tabla de este trabajo.  La rutina de MATLAB no compone
%       los cuatro movimientos en el mismo orden que la convencion clasica
%       Rz(theta) Tz(d) Tx(a) Rx(alpha), de modo que los desplazamientos
%       angulares de montaje de la tabla se pierden y la comprobacion devuelve
%       un error del orden de 2.
%    2) Asignar j.JointToParentTransform o j.ChildToJointTransform directamente
%       tampoco es posible: son propiedades de solo lectura.
%
%  El camino que si funciona, y que ademas no depende de la version de MATLAB ni
%  de cual de las dos propiedades escriba setFixedTransform, consiste en repartir
%  cada fila de la tabla entre DOS cuerpos:
%
%    - un cuerpo de revolucion que lleva la parte  Rz(theta_offset) * Tz(d)
%    - un cuerpo fijo a continuacion que lleva     Tx(a) * Rx(alpha)
%
%  La primera parte puede colocarse indistintamente antes o despues del giro de
%  la articulacion, porque Rz(theta_offset) y Tz(d) conmutan con Rz(q).  El
%  producto de ambos cuerpos reproduce exactamente
%
%      Rz(theta_offset + q) Tz(d) Tx(a) Rx(alpha)
%
%  que es la matriz de la tabla.  Comprobado con una diferencia maxima de 4.4e-16.

if exist('rigidBodyTree','class')
    fprintf('\nB) ROBOTICS SYSTEM TOOLBOX DE MATHWORKS (rigidBodyTree)\n\n');

    rbt = rigidBodyTree('DataFormat','column','MaxNumBodies',16);

    % cuerpo fijo que aplica la transformada de base
    b0 = rigidBody('base0');
    j0 = rigidBodyJoint('fija0','fixed');
    setFixedTransform(j0, P.Tb);
    b0.Joint = j0;
    addBody(rbt, b0, 'base');

    padre = 'base0';
    for i = 1:5
        th = P.DH(i,1);  d = P.DH(i,2);  a = P.DH(i,3);  al = P.DH(i,4);

        % --- cuerpo de revolucion:  Rz(theta_offset) * Tz(d),  giro sobre z
        br = rigidBody(sprintf('giro%d', i));
        jr = rigidBodyJoint(sprintf('q%d', i), 'revolute');
        jr.JointAxis = [0 0 1];
        setFixedTransform(jr, axang2tform([0 0 1 th]) * trvec2tform([0 0 d]));
        jr.PositionLimits = P.lim(i,:);
        br.Joint = jr;
        addBody(rbt, br, padre);

        % --- cuerpo fijo:  Tx(a) * Rx(alpha)
        bf = rigidBody(sprintf('eslabon%d', i));
        jf = rigidBodyJoint(sprintf('fija%d', i), 'fixed');
        setFixedTransform(jf, trvec2tform([a 0 0]) * axang2tform([1 0 0 al]));
        bf.Joint = jf;
        addBody(rbt, bf, br.Name);

        padre = bf.Name;
    end

    % cuerpo fijo de la herramienta
    bt = rigidBody('herramienta');
    jt = rigidBodyJoint('fijaT','fixed');
    setFixedTransform(jt, P.Tt);
    bt.Joint = jt;
    addBody(rbt, bt, padre);

    fprintf('   arbol construido con %d cuerpos (2 por articulacion, mas base y herramienta).\n', ...
            rbt.NumBodies);

    % --- autoverificacion
    rng(2); er = 0;
    for k = 1:500
        q = P.lim(:,1) + rand(5,1).*(P.lim(:,2)-P.lim(:,1));
        er = max(er, max(max(abs(getTransform(rbt, q, 'herramienta') - SOARM100_fk(q)))));
    end
    fprintf('   cinematica directa   rigidBodyTree vs propia -> error maximo = %.3e\n', er);
    if er > 1e-9
        fprintf('   >> ERROR GRANDE: la construccion no reprodujo la tabla.\n');
    else
        fprintf('   >> Coincide: las dos implementaciones describen el mismo mecanismo.\n');
    end

    % --- figura.  El fallo tipico aqui es no fijar los limites de los ejes:
    %     show() elige una escala automatica que puede dejar el brazo invisible.
    figure('Color','w','Position',[860 80 780 640]);
    show(rbt, q_demo, 'Frames','on', 'PreservePlot',false, 'Collisions','off');
    axis equal; grid on
    xlim([-0.35 0.20]); ylim([-0.45 0.15]); zlim([-0.05 0.40]);
    view(-52, 24);
    xlabel('x (m)'); ylabel('y (m)'); zlabel('z (m)')
    title({'SO-ARM100 como arbol de cuerpos rigidos', ...
           'los cuerpos "giro" son las articulaciones; los "eslabon", los tramos fijos'}, ...
          'FontWeight','normal')
    guardar('mlab_fig6_rst_arbol_cuerpos.png');
else
    fprintf('\nB) Robotics System Toolbox no encontrado; se omite esa parte.\n');
    fprintf('   Instalacion: Add-Ons de MATLAB -> "Robotics System Toolbox".\n');
end

fprintf('\nListo.\n');
