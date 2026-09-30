// Utilidades de las pruebas: el modelo del brazo (el mismo que sirve la aplicación,
// leído del URDF con app/estudio/modelo.py) y un ejecutor que sólo calcula.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Cadena } from '../../app/web/js/cinematica.js';
import { Ejecutor } from '../../app/web/js/programa/ejecutor.js';
import { analizar } from '../../app/web/js/programa/lenguaje.js';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../app');
const modelo = JSON.parse(execFileSync('python3', ['-c', 'import json; from estudio.modelo import cargar_modelo; print(json.dumps(cargar_modelo()))'], { cwd: APP, encoding: 'utf-8' }));
export const cadena = new Cadena(modelo);

// Ejecuta un programa sin animar y devuelve los tramos planificados y lo que escribió.
export async function ejecutar(texto, { senales = { di1: 1, di2: 1, di3: 0, di4: 0 } } = {}) {
  const ej = new Ejecutor(cadena, modelo.poses);
  const r = { tramos: [], mensajes: [], salidas: [], pinza: [] };
  await ej.ejecutar(analizar(texto), {
    q0: [0, 0, 0, 0, 0], pinza0: 1.2, senales: { ...senales },
    mover: async (tr) => { r.tramos.push(tr); },
    pinza: async (accion) => { r.pinza.push(accion); },
    esperar: async () => {}, esperarEntrada: async () => {},
    salida: (s, v) => { r.salidas.push([s, v]); },
    escribir: (t) => { r.mensajes.push(t); }, pausa: async () => {},
  }, { override: 1, maxPasos: 20000 });
  return r;
}
