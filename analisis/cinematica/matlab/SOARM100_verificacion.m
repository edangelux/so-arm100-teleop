%% SOARM100_VERIFICACION
%  Reproduce todas las comprobaciones del capitulo de analisis cinematico.
%  No necesita ningun toolbox: solo MATLAB base.
%
%  QUE SE DEBE INTERPRETAR DE CADA APARTADO
%    1. Tabla D-H .............. los cinco renglones con sus cuatro parametros.
%                               Es la tabla que aparece en el documento.
%    2. Cinematica directa ..... la pose del efector en la configuracion cero.
%                               Las tres primeras filas de la ultima columna son
%                               la posicion en metros.
%    3. Ejes paralelos ......... los productos vectoriales z2xz3 y z3xz4 tienen
%                               que dar CERO: es lo que prueba que la cadena
%                               central es plana.
%    4. Independencia de q5 .... al barrer solo la quinta articulacion, el efector
%                               no debe moverse.  Si se moviera, la tabla estaria mal.
%    5. Manipulabilidad ........ det(J*J') sale cero SIEMPRE (matriz 6x6 de rango 5).
%                               El valor con sentido es sqrt(det(J'*J)).
%    6. Singularidad ........... el minimo de manipulabilidad tiene que caer en
%                               q3 = -73.825 grados, y el rango bajar de 5 a 4.
%    7. Cinematica inversa ..... tiene que resolver 100 %% de las poses alcanzables,
%                               con error del orden de 1e-16 m.  Cada candidata se
%                               comprueba contra la pose pedida antes de aceptarla.
%    8. Poses SE(3) arbitrarias  tiene que resolver 0 %%.  NO es un fallo: es la
%                               demostracion de que cinco grados de libertad no
%                               alcanzan una pose de seis.
%    9. Espacio de trabajo ..... las dimensiones que se declaran en el documento.
%
%  Si algun error impreso sale del orden de 1e-3 o mayor, hay un parametro mal.
%  Lo normal es ver 1e-15 o menos: eso es redondeo de doble precision.
clc; clear; close all
P = SOARM100_parametros();
rng(7)

fprintf('====================================================================\n');
fprintf(' ANALISIS CINEMATICO DEL SO-ARM100 -- VERIFICACION NUMERICA\n');
fprintf('====================================================================\n\n');

%% 1. Tabla D-H
fprintf('1) TABLA DENAVIT-HARTENBERG (convencion clasica)\n\n');
fprintf('   %-3s %-24s %10s %10s %10s\n','i','theta_i','d_i (m)','a_i (m)','alpha_i');
for i = 1:5
    fprintf('   %-3d q%d %+9.4f deg %10.4f %10.4f %9.2f deg\n', ...
        i, i, rad2deg(P.DH(i,1)), P.DH(i,2), P.DH(i,3), rad2deg(P.DH(i,4)));
end

%% 2. Cinematica directa en la configuracion cero
fprintf('\n2) CINEMATICA DIRECTA EN q = 0\n\n');
T0 = SOARM100_fk(zeros(5,1));
disp(T0)

%% 3. Estructura: ejes paralelos
fprintf('3) ESTRUCTURA DE LA CADENA\n\n');
[~,Ti] = SOARM100_fk(zeros(5,1));
Z = zeros(3,5);
for i = 1:5, Z(:,i) = Ti{i}(1:3,3); end
for i = 1:4
    fprintf('   |z%d x z%d| = %.6f   %s\n', i, i+1, norm(cross(Z(:,i),Z(:,i+1))), ...
        ternario(norm(cross(Z(:,i),Z(:,i+1)))<1e-6,'PARALELOS','no paralelos'));
end
fprintf('   -> 1 giro vertical + 3 cabeceos paralelos + 1 giro de herramienta\n');
fprintf('   -> no hay tres ejes que se corten en un punto: NO hay muneca esferica\n');

%% 4. La posicion no depende de q5
fprintf('\n4) LA POSICION DEL EFECTOR NO DEPENDE DE q5\n\n');
d = 0;
for k = 1:500
    q = P.lim(:,1) + rand(5,1).*(P.lim(:,2)-P.lim(:,1));
    q2 = q; q2(5) = P.lim(5,1) + rand*(P.lim(5,2)-P.lim(5,1));
    T1 = SOARM100_fk(q); T2 = SOARM100_fk(q2);
    d = max(d, norm(T1(1:3,4)-T2(1:3,4)));
end
fprintf('   variacion maxima de posicion al cambiar solo q5: %.3e m\n', d);

%% 5. Manipulabilidad: la formula correcta para un jacobiano 6x5
fprintf('\n5) INDICE DE MANIPULABILIDAD CON JACOBIANO 6x5\n\n');
J = SOARM100_jacobiano(zeros(5,1));
fprintf('   det(J*J'')  = %.3e   <- SIEMPRE cero (6x6 de rango <= 5)\n', det(J*J'));
fprintf('   det(J''*J)  = %.6f   <- el correcto cuando hay mas filas que columnas\n', det(J'*J));
fprintf('   w = sqrt(det(J''*J)) = %.6f = producto de los 5 valores singulares (%.6f)\n', ...
        sqrt(det(J'*J)), prod(svd(J)));

%% 6. Singularidad de codo
fprintf('\n6) SINGULARIDAD DE CODO\n\n');
q3 = linspace(P.lim(3,1), P.lim(3,2), 2001);
w  = zeros(size(q3)); smin = zeros(size(q3));
for k = 1:numel(q3)
    Jk = SOARM100_jacobiano([0 0 q3(k) 0 0]');
    s = svd(Jk); w(k) = prod(s); smin(k) = s(end);
end
[~,i0] = min(w);
fprintf('   minimo de w en q3 = %+.3f deg   (predicho: -theta3_off = %+.3f deg)\n', ...
        rad2deg(q3(i0)), -rad2deg(P.DH(3,1)));
fprintf('   w        = %.3e   (mediana fuera de la singularidad: %.3e)\n', w(i0), median(w));
fprintf('   sigma_5  = %.3e\n', smin(i0));
Js = SOARM100_jacobiano([0 0 -P.DH(3,1) 0 0]');
fprintf('   rango del jacobiano en la singularidad exacta: %d  (fuera de ella: %d)\n', ...
        rank(Js,1e-9), rank(SOARM100_jacobiano(zeros(5,1)),1e-9));

%% 7. Cinematica inversa cerrada: ida y vuelta
fprintf('\n7) CINEMATICA INVERSA CERRADA -- PRUEBA DE IDA Y VUELTA\n\n');
N = 2000; ep = 0; eR = 0; ok = 0; nsol = 0;
for k = 1:N
    q  = P.lim(:,1) + rand(5,1).*(P.lim(:,2)-P.lim(:,1));
    T  = SOARM100_fk(q);
    Q  = SOARM100_ik(T);
    bien = false;
    for j = 1:size(Q,1)
        Tj = SOARM100_fk(Q(j,:)');
        e1 = norm(Tj(1:3,4)-T(1:3,4)); e2 = max(max(abs(Tj(1:3,1:3)-T(1:3,1:3))));
        if e1 < 1e-8 && e2 < 1e-6
            ep = max(ep,e1); eR = max(eR,e2); bien = true; nsol = nsol + 1;
        end
    end
    ok = ok + bien;
end
fprintf('   poses resueltas            : %d/%d (%.2f %%)\n', ok, N, 100*ok/N);
fprintf('   error de posicion maximo   : %.3e m\n', ep);
fprintf('   error de orientacion maximo: %.3e\n', eR);
fprintf('   soluciones exactas por pose: %.2f  (ramas de base x ramas de codo)\n', nsol/N);

%% 8. Poses SE(3) arbitrarias: no alcanzables
fprintf('\n8) POSES SE(3) ARBITRARIAS\n\n');
M = 500; ok2 = 0;
for k = 1:M
    q = P.lim(:,1) + rand(5,1).*(P.lim(:,2)-P.lim(:,1));
    T = SOARM100_fk(q);
    [Qr,~] = qr(randn(3)); if det(Qr)<0, Qr(:,1) = -Qr(:,1); end
    Tg = eye(4); Tg(1:3,1:3) = Qr; Tg(1:3,4) = T(1:3,4);
    Q  = SOARM100_ik(Tg);
    for j = 1:size(Q,1)
        Tj = SOARM100_fk(Q(j,:)');
        if norm(Tj(1:3,4)-Tg(1:3,4))<1e-8 && max(max(abs(Tj(1:3,1:3)-Qr)))<1e-6
            ok2 = ok2 + 1; break
        end
    end
end
fprintf('   poses SE(3) arbitrarias resueltas: %d/%d (%.2f %%)\n', ok2, M, 100*ok2/M);
fprintf('   -> la orientacion no es libre: el eje de la herramienta esta obligado\n');
fprintf('      a vivir en el plano vertical que definen el eje de la base y el efector.\n');

%% 9. Espacio de trabajo
%  La posicion del efector depende solo de q2, q3 y q4: la primera articulacion
%  gira el plano completo del brazo y la quinta no desplaza el efector, asi que
%  basta barrer tres variables.
%  Los extremos se obtienen por mallas sucesivas que se van estrechando alrededor
%  del mejor punto, SIEMPRE dentro de los limites articulares.  Un optimizador sin
%  restricciones se sale del recorrido mecanico y devuelve extremos que el
%  manipulador no puede alcanzar; ese error dio una altura minima de -282 mm en
%  lugar de los -213 mm reales.
fprintf('\n9) ESPACIO DE TRABAJO\n\n');
lo = P.lim(2:4,1);  hi = P.lim(2:4,2);
fprintf('   alcance radial maximo desde el eje de la base : %8.2f mm\n', 1000*extremo(P,lo,hi,1,+1));
fprintf('   distancia maxima al origen del modelo         : %8.2f mm\n', 1000*extremo(P,lo,hi,2,+1));
fprintf('   altura maxima sobre el plano de montaje       : %8.2f mm\n', 1000*extremo(P,lo,hi,3,+1));
fprintf('   altura minima                                 : %8.2f mm\n', 1000*extremo(P,lo,hi,3,-1));
fprintf('   recorrido angular de la base                  : %+8.1f a %+.1f grados\n', ...
        rad2deg(P.lim(1,1)), rad2deg(P.lim(1,2)));

% datos para la grafica de la seccion meridiana
rng(9); Nw = 40000;
Qw = P.lim(:,1)' + rand(Nw,5).*(P.lim(:,2)-P.lim(:,1))';
Pw = zeros(Nw,3);
for k = 1:Nw
    Tw = SOARM100_fk(Qw(k,:)');
    Pw(k,:) = Tw(1:3,4)';
end
r = hypot(Pw(:,1)-P.Tb(1,4), Pw(:,2)-P.Tb(2,4));
h = Pw(:,3);

%% Graficas
figure('Color','w','Position',[80 80 1180 460]);
subplot(1,2,1)
  semilogy(rad2deg(q3), w, 'LineWidth', 1.6); grid on; hold on
  xline(-rad2deg(P.DH(3,1)),'--r','LineWidth',1.2);
  xlabel('q_3 (grados)'); ylabel('w = sqrt(det(J^T J))');
  title({'Manipulabilidad a lo largo de q_3', 'el minimo marca la singularidad de codo extendido'}, ...
        'FontWeight','normal')
  set(gca,'FontSize',10)
subplot(1,2,2)
  plot(r*1000, h*1000, '.', 'MarkerSize', 1); grid on; axis equal
  xlabel('radio desde el eje de la base (mm)'); ylabel('altura (mm)');
  title({'Seccion meridiana del espacio de trabajo', ...
         'cada punto es una pose alcanzable del efector'}, 'FontWeight','normal')
  set(gca,'FontSize',10)

fprintf('\n====================================================================\n');
fprintf(' FIN\n');
fprintf('====================================================================\n');

function s = ternario(c,a,b)
if c, s = a; else, s = b; end
end

%% ---------------------------------------------------------------- auxiliares
function A = dhA_local(th, d, a, al)
%DHA_LOCAL  Matriz de Denavit-Hartenberg clasica, sin releer los parametros.
A = [ cos(th), -sin(th)*cos(al),  sin(th)*sin(al), a*cos(th) ;
      sin(th),  cos(th)*cos(al), -cos(th)*sin(al), a*sin(th) ;
            0,          sin(al),          cos(al),         d ;
            0,                0,                0,         1 ];
end

function v = extremo(P, lo, hi, cual, signo)
%EXTREMO  Maximo (signo +1) o minimo (signo -1) de una magnitud del efector,
%   obtenido por mallas sucesivas que se estrechan alrededor del mejor punto y
%   siempre dentro de los limites articulares.
%       cual = 1 -> distancia al eje de la base
%       cual = 2 -> distancia al origen del modelo
%       cual = 3 -> altura
n = 21;  vueltas = 7;
c = (lo+hi)/2;  paso = (hi-lo)/2;  v = -signo*inf;
A1 = dhA_local(P.DH(1,1), P.DH(1,2), P.DH(1,3), P.DH(1,4));
T0 = P.Tb * A1;
A5 = dhA_local(P.DH(5,1), P.DH(5,2), P.DH(5,3), P.DH(5,4)) * P.Tt;
for it = 1:vueltas
    g2 = min(max(linspace(c(1)-paso(1), c(1)+paso(1), n), lo(1)), hi(1));
    g3 = min(max(linspace(c(2)-paso(2), c(2)+paso(2), n), lo(2)), hi(2));
    g4 = min(max(linspace(c(3)-paso(3), c(3)+paso(3), n), lo(3)), hi(3));
    mejor = -signo*inf;  cm = c;
    for a = 1:n
        T2 = T0 * dhA_local(P.DH(2,1)+g2(a), P.DH(2,2), P.DH(2,3), P.DH(2,4));
        for b = 1:n
            T3 = T2 * dhA_local(P.DH(3,1)+g3(b), P.DH(3,2), P.DH(3,3), P.DH(3,4));
            for d = 1:n
                T4 = T3 * dhA_local(P.DH(4,1)+g4(d), P.DH(4,2), P.DH(4,3), P.DH(4,4));
                p  = T4 * A5;  p = p(1:3,4);
                switch cual
                    case 1, val = hypot(p(1)-P.Tb(1,4), p(2)-P.Tb(2,4));
                    case 2, val = norm(p);
                    case 3, val = p(3);
                end
                if signo*val > signo*mejor
                    mejor = val;  cm = [g2(a); g3(b); g4(d)];
                end
            end
        end
    end
    v = mejor;  c = cm;  paso = paso/floor(n/2);
end
end
