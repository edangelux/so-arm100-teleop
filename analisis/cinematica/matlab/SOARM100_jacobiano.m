function J = SOARM100_jacobiano(q)
%SOARM100_JACOBIANO  Jacobiano geometrico 6x5 del efector, en el marco base.
%   Filas 1-3: velocidad lineal.  Filas 4-6: velocidad angular.
%
%   Para un jacobiano NO cuadrado con mas filas que columnas, el indice de
%   manipulabilidad de Yoshikawa es  w = sqrt(det(J'*J)),  NO  sqrt(det(J*J')),
%   porque J*J' es 6x6 de rango <= 5 y su determinante es identicamente cero.
%
%   Llamado SIN argumentos usa la configuracion cero, de modo que puede ejecutarse
%   directamente para comprobar que todo esta en orden.
%
%   Ejemplo:
%       J = SOARM100_jacobiano([0.35; -0.35; 0.75; -0.55; 0.60])
if nargin < 1
    q = zeros(5,1);
    fprintf('SOARM100_jacobiano sin argumentos: se usa q = 0.\n');
end
P = SOARM100_parametros();
[T, Ti] = SOARM100_fk(q);
on = T(1:3,4);
J  = zeros(6,5);
for i = 1:5
    Ai = Ti{i};                 % marco D-H i-1: su eje z es el eje de giro de q_i
    z  = Ai(1:3,3);
    o  = Ai(1:3,4);
    J(1:3,i) = cross(z, on - o);
    J(4:6,i) = z;
end
end
