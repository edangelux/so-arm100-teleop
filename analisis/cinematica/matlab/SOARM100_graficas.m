%% SOARM100_GRAFICAS
%  Figuras del analisis cinematico dibujadas SOLO con MATLAB base.
%  No requiere ningun toolbox: sirve aunque no tengas instalado ni el Robotics
%  System Toolbox ni el de Peter Corke.
%
%  QUE SE DEBE INTERPRETAR DE CADA FIGURA
%    Figura 1  La cadena con sus cinco sistemas de referencia.  Cada terna azul
%              es un eje z (el eje de giro de esa articulacion) y cada flecha
%              roja el eje x correspondiente.  Se ve que z2, z3 y z4 son
%              paralelos: de ahi sale que la cadena central es plana.
%    Figura 2  Los cinco grados de libertad, uno a la vez.  En gris, la postura
%              de partida; en color, el resultado de mover solo esa articulacion.
%    Figura 3  Espacio de trabajo: seccion meridiana y planta.  El solido real es
%              el de revolucion que genera la seccion al girar sobre el eje de la base.
%    Figura 4  Mapa de manipulabilidad en el plano q2-q3.  La franja oscura
%              vertical es la singularidad de codo extendido, en q3 = -73.825 grados.

clc; clear; close all
P = SOARM100_parametros();

COL_Z = [0.12 0.61 0.82];
COL_X = [0.82 0.12 0.12];
COL_L = [0.55 0.11 0.14];

%% ---------------------------------------------------------------- Figura 1
q0 = zeros(5,1);
[O, Zg, Xg] = marcos(P, q0);

figure('Color','w','Position',[60 60 780 640]); hold on; grid on; box on
plot3(O(:,1), O(:,2), O(:,3), '-', 'Color', COL_L, 'LineWidth', 3)
plot3(O(:,1), O(:,2), O(:,3), 'o', 'MarkerSize', 9, ...
      'MarkerFaceColor', [0.17 0.30 0.55], 'MarkerEdgeColor','w', 'LineWidth',1.2)
Lf = 0.045;
for i = 1:size(Zg,1)
    quiver3(O(i,1),O(i,2),O(i,3), Lf*Zg(i,1),Lf*Zg(i,2),Lf*Zg(i,3), 0, ...
            'Color',COL_Z,'LineWidth',2.4,'MaxHeadSize',0.6);
    quiver3(O(i,1),O(i,2),O(i,3), Lf*Xg(i,1),Lf*Xg(i,2),Lf*Xg(i,3), 0, ...
            'Color',COL_X,'LineWidth',2.0,'MaxHeadSize',0.6);
    text(O(i,1)+Lf*Zg(i,1), O(i,2)+Lf*Zg(i,2), O(i,3)+Lf*Zg(i,3), ...
         sprintf('  z_%d', i-1), 'Color', COL_Z, 'FontWeight','bold','FontSize',11);
    text(O(i,1)+Lf*Xg(i,1), O(i,2)+Lf*Xg(i,2), O(i,3)+Lf*Xg(i,3), ...
         sprintf('  x_%d', i-1), 'Color', COL_X, 'FontWeight','bold','FontSize',11);
end
T = SOARM100_fk(q0);
plot3(T(1,4),T(2,4),T(3,4),'kx','MarkerSize',13,'LineWidth',2.2)
text(T(1,4),T(2,4),T(3,4),'  efector','FontSize',10)
axis equal; view(-52,22)
xlabel('x (m)'); ylabel('y (m)'); zlabel('z (m)')
title({'Sistemas de referencia de Denavit-Hartenberg', ...
       'configuracion q = 0'},'FontWeight','normal','FontSize',12)
set(gca,'FontSize',10)

%% ---------------------------------------------------------------- Figura 2
nom = {'Rotacion de hombro','Cabeceo de hombro','Codo','Cabeceo de muneca','Giro de muneca'};
ang = [0.96 -0.79 1.05 -1.22 1.57];
figure('Color','w','Position',[60 60 1500 340]);
for j = 1:5
    subplot(1,5,j); hold on; grid on; box on
    Oa = marcos(P, zeros(5,1));
    plot3(Oa(:,1),Oa(:,2),Oa(:,3),'-','Color',[0.75 0.75 0.75],'LineWidth',2.5)
    q = zeros(5,1); q(j) = ang(j);
    Ob = marcos(P, q);
    plot3(Ob(:,1),Ob(:,2),Ob(:,3),'-','Color',COL_L,'LineWidth',3)
    plot3(Ob(:,1),Ob(:,2),Ob(:,3),'o','MarkerSize',6, ...
          'MarkerFaceColor',[0.17 0.30 0.55],'MarkerEdgeColor','w')
    Tb = SOARM100_fk(q);
    plot3(Tb(1,4),Tb(2,4),Tb(3,4),'kx','MarkerSize',10,'LineWidth',2)
    axis equal; view(-52,22)
    xlim([-0.45 0.25]); ylim([-0.45 0.25]); zlim([-0.05 0.45])
    title({sprintf('q_%d = %+.0f grados', j, rad2deg(ang(j))), nom{j}}, ...
          'FontWeight','normal','FontSize',10)
    set(gca,'FontSize',8)
end

%% ---------------------------------------------------------------- Figura 3
N = 60000; rng(3);
Q = P.lim(:,1)' + rand(N,5).*(P.lim(:,2)-P.lim(:,1))';
Pt = zeros(N,3);
for k = 1:N
    T = SOARM100_fk(Q(k,:)');
    Pt(k,:) = T(1:3,4)';
end
r = hypot(Pt(:,1), Pt(:,2));
figure('Color','w','Position',[60 60 1100 460]);
subplot(1,2,1)
  plot(r*1000, Pt(:,3)*1000, '.', 'MarkerSize', 1, 'Color', [0.25 0.45 0.70]); hold on
  plot(0,0,'k+','MarkerSize',10,'LineWidth',1.5)
  grid on; axis equal
  xlabel('distancia al eje de la base (mm)'); ylabel('altura (mm)')
  title({'Seccion meridiana del espacio de trabajo', ...
         'el solido real es el de revolucion sobre el eje vertical'}, ...
        'FontWeight','normal','FontSize',11)
  set(gca,'FontSize',10)
subplot(1,2,2)
  plot(Pt(:,1)*1000, Pt(:,2)*1000, '.', 'MarkerSize', 1, 'Color', [0.25 0.45 0.70]); hold on
  plot(0,0,'k+','MarkerSize',10,'LineWidth',1.5)
  grid on; axis equal
  xlabel('x (mm)'); ylabel('y (mm)')
  title({'Planta', sprintf('recorrido de la base: %+.1f a %+.1f grados', ...
        rad2deg(P.lim(1,1)), rad2deg(P.lim(1,2)))},'FontWeight','normal','FontSize',11)
  set(gca,'FontSize',10)

%% ---------------------------------------------------------------- Figura 4
n = 121;
g2 = linspace(P.lim(2,1), P.lim(2,2), n);
g3 = linspace(P.lim(3,1), P.lim(3,2), n);
W = zeros(n,n);
for a = 1:n
    for b = 1:n
        J = SOARM100_jacobiano([0; g2(a); g3(b); 0; 0]);
        W(a,b) = sqrt(max(det(J'*J), 0));
    end
end
figure('Color','w','Position',[60 60 720 580]);
imagesc(rad2deg(g3), rad2deg(g2), W); axis xy; colormap(parula); colorbar
hold on
xline(-73.825, 'w--', 'LineWidth', 2);
text(-73.825, rad2deg(g2(end))*0.86, '  q_3 = -73.825^\circ', 'Color','w','FontWeight','bold')
xlabel('q_3 (grados)'); ylabel('q_2 (grados)')
title({'Indice de manipulabilidad  w = sqrt(det(J^T J))', ...
       'la franja oscura es la singularidad de codo extendido'}, ...
      'FontWeight','normal','FontSize',12)
set(gca,'FontSize',10)

fprintf('Cuatro figuras generadas.\n');


%% ---------------------------------------------------------------- auxiliar
function [O, Zg, Xg] = marcos(P, q)
%MARCOS  Origenes de los sistemas D-H y, si se piden, sus ejes z y x en el marco base.
    T = P.Tb;
    O = zeros(7,3); Zg = zeros(5,3); Xg = zeros(5,3);
    O(1,:) = T(1:3,4)';
    Zg(1,:) = T(1:3,3)'; Xg(1,:) = T(1:3,1)';
    for i = 1:5
        th = P.DH(i,1) + q(i);
        A = [cos(th) -sin(th)*cos(P.DH(i,4))  sin(th)*sin(P.DH(i,4))  P.DH(i,3)*cos(th);
             sin(th)  cos(th)*cos(P.DH(i,4)) -cos(th)*sin(P.DH(i,4))  P.DH(i,3)*sin(th);
                   0          sin(P.DH(i,4))          cos(P.DH(i,4))          P.DH(i,2);
                   0                       0                       0                  1];
        T = T*A;
        O(i+1,:) = T(1:3,4)';
        if i < 5
            Zg(i+1,:) = T(1:3,3)'; Xg(i+1,:) = T(1:3,1)';
        end
    end
    Tf = T*P.Tt;
    O(7,:) = Tf(1:3,4)';
end
