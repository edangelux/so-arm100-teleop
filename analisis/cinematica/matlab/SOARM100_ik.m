function Q = SOARM100_ik(T_obj)
%SOARM100_IK  Cinematica inversa EN FORMA CERRADA del SO-ARM100.
%
%   El brazo tiene 5 GDL, asi que no puede alcanzar una pose SE(3) arbitraria.
%   Su espacio de tareas alcanzable tiene 5 dimensiones: posicion (3) + direccion
%   del eje de la herramienta (1 grado libre, porque ese eje esta obligado a vivir
%   en el plano vertical del brazo) + giro sobre ese eje (1).
%   Sobre ese espacio SI existe solucion cerrada, y es la que resuelve esta funcion.
%
%   Q = matriz con una solucion por fila (codo arriba y codo abajo, y las dos
%       ramas de q1 separadas 180 grados). Vacia si la pose no es alcanzable.
%
%   Toda candidata se sustituye en la cinematica directa y se descarta si no
%   reproduce la pose pedida.  Sin esa comprobacion el procedimiento devuelve
%   candidatas para poses que el mecanismo no puede alcanzar, y quien llame a la
%   funcion se lo creeria.
%
%   Llamado SIN argumentos resuelve una pose de prueba generada con la cinematica
%   directa, de modo que puede ejecutarse directamente.
%
%   Ejemplo:
%       Q = SOARM100_ik(SOARM100_fk([0.35; -0.35; 0.75; -0.55; 0.60]))
if nargin < 1
    q_demo = [0.35; -0.35; 0.75; -0.55; 0.60];
    T_obj  = SOARM100_fk(q_demo);
    fprintf('SOARM100_ik sin argumentos: se resuelve la pose de q = [%s].\n', ...
            num2str(q_demo', '%.2f '));
end
P  = SOARM100_parametros();
T0 = P.Tb \ T_obj;                 % pose en el marco D-H 0
p0 = T0(1:3,4);
a0 = T0(1:3,2);                    % eje de la herramienta = eje Y del marco del efector
Q  = [];
base = atan2(p0(2), p0(1));
for th1 = [base, base+pi]
    A1 = dhA(th1, P.DH(1,2), P.DH(1,3), P.DH(1,4));
    Ti = A1 \ eye(4);
    p1 = Ti(1:3,1:3)*p0 + Ti(1:3,4);
    a1 = Ti(1:3,1:3)*a0;
    if abs(p1(3)) > 1e-5, continue; end             % el objetivo debe caer en el plano
    W  = p1(1:2) + P.L3*a1(1:2);                    % punto de la muneca en el plano
    c3 = (W'*W - P.DH(2,3)^2 - P.DH(3,3)^2) / (2*P.DH(2,3)*P.DH(3,3));
    if abs(c3) > 1, continue; end                   % fuera de alcance
    for s = [1 -1]
        th3 = s*acos(max(-1,min(1,c3)));
        th2 = atan2(W(2),W(1)) - atan2(P.DH(3,3)*sin(th3), P.DH(2,3)+P.DH(3,3)*cos(th3));
        phi = atan2(-a1(2), -a1(1));
        th4 = phi - th2 - th3 - pi/2;
        Tp  = P.Tb*A1*dhA(th2,P.DH(2,2),P.DH(2,3),P.DH(2,4)) ...
                    *dhA(th3,P.DH(3,2),P.DH(3,3),P.DH(3,4)) ...
                    *dhA(th4,P.DH(4,2),P.DH(4,3),P.DH(4,4));
        Rr  = Tp(1:3,1:3)' * T_obj(1:3,1:3) / P.Tt(1:3,1:3);
        th5 = atan2(Rr(2,1), Rr(1,1));
        q   = [th1 th2 th3 th4 th5]' - P.DH(:,1);
        q   = mod(q+pi, 2*pi) - pi;
        % Comprobacion obligatoria: la candidata tiene que reproducir la pose.
        % Sin ella el procedimiento devuelve respuestas para poses inalcanzables.
        if max(max(abs(SOARM100_fk(q) - T_obj))) > 1e-7, continue; end
        Q   = [Q; q'];                              %#ok<AGROW>
    end
end
end

function A = dhA(th,d,a,al)
A = [ cos(th), -sin(th)*cos(al),  sin(th)*sin(al), a*cos(th) ;
      sin(th),  cos(th)*cos(al), -cos(th)*sin(al), a*sin(th) ;
            0,          sin(al),          cos(al),         d ;
            0,                0,                0,         1 ];
end
