function P = SOARM100_parametros()
%SOARM100_PARAMETROS  Parametros cinematicos del manipulador SO-ARM100.
%
%   Los valores se extrajeron del modelo descriptivo publicado por el proyecto
%   so_arm_100_description (paquete brukg/SO-100-arm), archivo
%   so_arm_100_5dof_arm.urdf.xacro, que es el mismo que cargan el simulador y el
%   planificador de movimiento.  El repositorio oficial del robot no publica una
%   tabla de Denavit-Hartenberg, de modo que la tabla se derivo de los ejes y
%   anclajes declarados en ese modelo.
%
%   ESTE ARCHIVO SE GENERA AUTOMATICAMENTE.  No debe editarse a mano: se obtiene
%   con  python codigo/gen_matlab.py  a partir de los mismos modulos que producen los
%   resultados publicados, de modo que las versiones de MATLAB y de Python no
%   pueden discrepar.
%
%   Convencion clasica:  A_i = Rz(theta_i) Tz(d_i) Tx(a_i) Rx(alpha_i)
%
%   P.DH   -> [theta_offset  d  a  alpha]  (rad, m, m, rad), una fila por articulacion
%   P.Tb   -> transformada constante  base_link -> marco 0
%   P.Tt   -> transformada constante  marco 5   -> punto del efector
%   P.lim  -> limites articulares [inferior superior] en rad
%   P.L3   -> extension de la herramienta sobre el eje de giro de la muneca

P.nombres = {'Shoulder_Rotation' 'Shoulder_Pitch' 'Elbow' 'Wrist_Pitch' 'Wrist_Roll'};

%              theta_offset            d                        a                        alpha
P.DH = [
         +0.000000000000000e+00 -1.025000000000000e-01 +3.060000000000000e-02 +1.570796326794897e+00 ;
         -1.327009433614800e+00 +0.000000000000000e+00 +1.160000211206877e-01 +0.000000000000000e+00 ;
         +1.288481436772662e+00 +0.000000000000000e+00 +1.350001851850582e-01 +0.000000000000000e+00 ;
         -1.532262003157862e+00 +0.000000000000000e+00 +0.000000000000000e+00 +1.570796326794897e+00 ;
         +3.141592653589793e+00 +0.000000000000000e+00 +2.279577419298136e-18 +0.000000000000000e+00 ];

P.Tb = [
         +0.000000000000000e+00 -1.000000000000000e+00 +0.000000000000000e+00 +0.000000000000000e+00 ;
         -9.999999999932538e-01 +0.000000000000000e+00 +3.673205103346574e-06 -4.520000000000000e-02 ;
         -3.673205102919006e-06 -0.000000000000000e+00 -9.999999999932538e-01 +1.650000000000000e-02 ;
         +0.000000000000000e+00 +0.000000000000000e+00 +0.000000000000000e+00 +1.000000000000000e+00 ];

P.Tt = [
         +9.999999999799857e-01 -2.398131606996049e-17 -6.326794896607236e-06 +2.775557561562891e-17 ;
         -6.326794896607235e-06 +6.123272736182363e-17 -9.999999999799856e-01 -1.979699700230534e-18 ;
         -4.153635394396934e-16 +9.999999999999999e-01 +6.123535527753375e-17 -1.500999999999999e-01 ;
         +0.000000000000000e+00 +0.000000000000000e+00 +0.000000000000000e+00 +1.000000000000000e+00 ];

P.lim = [
         -1.960000000000000e+00 +1.960000000000000e+00 ;
         -1.745000000000000e+00 +1.745000000000000e+00 ;
         -1.500000000000000e+00 +1.500000000000000e+00 ;
         -1.658000000000000e+00 +1.658000000000000e+00 ;
         -2.750000000000000e+00 +2.750000000000000e+00 ];

P.L3 = 1.500999999999999e-01;
end
