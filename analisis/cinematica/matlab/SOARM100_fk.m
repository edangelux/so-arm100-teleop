function [T, Ti] = SOARM100_fk(q)
%SOARM100_FK  Cinematica directa del SO-ARM100 por parametros D-H.
%   T  = pose 4x4 del efector respecto de base_link
%   Ti = celda con las 6 transformadas acumuladas (marcos 0 a 5)
%
%   Llamado SIN argumentos usa la configuracion cero, de modo que puede ejecutarse
%   directamente para comprobar que todo esta en orden.
%
%   Ejemplo:
%       T = SOARM100_fk([0.35; -0.35; 0.75; -0.55; 0.60])
if nargin < 1
    q = zeros(5,1);
    fprintf('SOARM100_fk sin argumentos: se usa la configuracion q = 0.\n');
end
P = SOARM100_parametros();
T = P.Tb;  Ti = cell(1,6);  Ti{1} = T;
for i = 1:5
    th = P.DH(i,1) + q(i);
    T  = T * dhA(th, P.DH(i,2), P.DH(i,3), P.DH(i,4));
    Ti{i+1} = T;
end
T = T * P.Tt;
end

function A = dhA(th,d,a,al)
A = [ cos(th), -sin(th)*cos(al),  sin(th)*sin(al), a*cos(th) ;
      sin(th),  cos(th)*cos(al), -cos(th)*sin(al), a*sin(th) ;
            0,          sin(al),          cos(al),         d ;
            0,                0,                0,         1 ];
end
