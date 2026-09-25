// Celda de trabajo virtual: piezas sobre la mesa, una bandeja, un sensor de
// presencia (di1) y una torre de luces (do1 a do3). Sirve para practicar
// «tomar y colocar» con el robot virtual y como gemelo digital cuando el
// programa se ejecuta en el brazo real.
import * as THREE from 'three';

const COLORES = { fucsia: 0xfd44b0, lima: 0xc2ef4e, durazno: 0xffb287, violeta: 0x7553ff, blanco: 0xf2f2f2 };
export const DISTANCIA_AGARRE = 0.025;         // m entre el centro de la pieza y el punto de agarre
export const ADELANTO_AGARRE = 0.012;          // m desde la punta hacia la muñeca: centro de los dedos

// Distribución inicial. Coordenadas del marco de la base (URDF), en mm; el brazo mira hacia −y.
export const DISPOSICION = {
  piezas: [
    { nombre: 'cubo1', tipo: 'cubo', lado: 25, color: 'fucsia', x: -110, y: -150 },
    { nombre: 'cubo2', tipo: 'cubo', lado: 25, color: 'lima', x: -110, y: -200 },
    { nombre: 'cubo3', tipo: 'cubo', lado: 25, color: 'durazno', x: -110, y: -250 },
  ],
  bandeja: { x: 110, y: -200, ancho: 100, largo: 100 },
  entrada: { x: -110, y: -150, radio: 22 },       // sensor de presencia: di1 = 1 si hay pieza encima
};

export class Celda {
  constructor(escena) {
    this.escena = escena;
    this.grupo = new THREE.Group();
    this.grupo.visible = false;
    escena.raiz.add(this.grupo);
    this.piezas = [];
    this.senales = { di1: 0, di2: 0, di3: 0, di4: 0, do1: 0, do2: 0, do3: 0, do4: 0 };
    this.alCambiarSenales = null;
    this.cayendo = [];
    this._fijos();
    this.reiniciar();
    const anterior = escena.alCuadro;
    escena.alCuadro = (dt) => { anterior?.(dt); this._cuadro(dt); };
  }

  mostrar(v) { this.grupo.visible = v; }

  _fijos() {
    const b = DISPOSICION.bandeja;
    const bandeja = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x3a2d6b, roughness: 0.8 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(b.ancho / 1000, b.largo / 1000, 0.003), mat);
    base.position.z = 0.0015;
    bandeja.add(base);
    const borde = new THREE.MeshStandardMaterial({ color: 0x7553ff, roughness: 0.6 });
    for (const [w, l, x, y] of [[b.ancho, 4, 0, (b.largo - 4) / 2], [b.ancho, 4, 0, -(b.largo - 4) / 2], [4, b.largo, (b.ancho - 4) / 2, 0], [4, b.largo, -(b.ancho - 4) / 2, 0]]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w / 1000, l / 1000, 0.012), borde);
      m.position.set(x / 1000, y / 1000, 0.006);
      bandeja.add(m);
    }
    bandeja.position.set(b.x / 1000, b.y / 1000, 0);
    this.grupo.add(bandeja);
    // Sensor de presencia: un anillo en la mesa que se enciende con una pieza encima.
    const e = DISPOSICION.entrada;
    this.anilloSensor = new THREE.Mesh(new THREE.RingGeometry(e.radio / 1000, (e.radio + 3) / 1000, 48),
      new THREE.MeshBasicMaterial({ color: 0x7553ff, transparent: true, opacity: 0.9 }));
    this.anilloSensor.position.set(e.x / 1000, e.y / 1000, 0.0008);
    this.grupo.add(this.anilloSensor);
    // Torre de luces en una esquina de la mesa.
    const torre = new THREE.Group();
    const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.09, 12), new THREE.MeshStandardMaterial({ color: 0x2a2140 }));
    poste.rotation.x = Math.PI / 2; poste.position.z = 0.045;
    torre.add(poste);
    this.luces = {};
    [['do1', 0xc2ef4e], ['do2', 0xffb287], ['do3', 0xfd44b0]].forEach(([s, c], i) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.016, 24),
        new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0, transparent: true, opacity: 0.55 }));
      m.rotation.x = Math.PI / 2;
      m.position.z = 0.1 + i * 0.018;
      torre.add(m);
      this.luces[s] = m;
    });
    torre.position.set(0.2, -0.3, 0);
    this.grupo.add(torre);
  }

  reiniciar(disposicion = DISPOSICION.piezas) {
    this.soltarTodo();
    for (const p of this.piezas) p.malla.removeFromParent();
    this.piezas = disposicion.map((d, i) => {
      const lado = d.lado / 1000;
      const geo = d.tipo === 'cilindro'
        ? new THREE.CylinderGeometry(lado / 2, lado / 2, lado, 32).rotateX(Math.PI / 2)
        : new THREE.BoxGeometry(lado, lado, lado);
      const malla = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: COLORES[d.color] ?? 0xffffff, roughness: 0.45 }));
      malla.castShadow = true;
      malla.receiveShadow = true;
      malla.position.set(d.x / 1000, d.y / 1000, lado / 2);
      this.grupo.add(malla);
      return { id: i, nombre: d.nombre, tipo: d.tipo, lado, malla, sujeta: false };
    });
    this.cayendo = [];
    this._actualizarSensor();
  }

  soltarTodo() { for (const p of this.piezas) if (p.sujeta) this._liberar(p); }

  // Punto de agarre en el marco de la base: la punta, un poco hacia la muñeca.
  puntoAgarre(robot) {
    const esc = this.escena;
    esc.soporte.updateMatrixWorld(true);
    const pinza = robot.eslabones.Fixed_Gripper;
    const inv = new THREE.Matrix4().copy(esc.raiz.matrixWorld).invert();
    const M = new THREE.Matrix4().multiplyMatrices(inv, pinza.matrixWorld);
    return new THREE.Vector3(0, -0.09 + ADELANTO_AGARRE, 0).applyMatrix4(M);
  }

  // Cierra la pinza: sujeta la pieza más cercana al centro de los dedos, si la hay.
  agarrar(robot = this.escena.robot) {
    const p = this.puntoAgarre(robot);
    let mejor = null, dmin = DISTANCIA_AGARRE;
    for (const pz of this.piezas) {
      if (pz.sujeta) continue;
      const d = pz.malla.position.distanceTo(p);
      if (d < dmin) { dmin = d; mejor = pz; }
    }
    if (!mejor) return null;
    this.cayendo = this.cayendo.filter((c) => c.pieza !== mejor);
    robot.eslabones.Fixed_Gripper.attach(mejor.malla);
    mejor.sujeta = true;
    this._actualizarSensor();
    return mejor;
  }

  sujeta() { return this.piezas.find((p) => p.sujeta) || null; }

  // Abre la pinza: la pieza cae recta hasta la mesa o hasta la pieza de abajo.
  soltar() {
    const p = this.sujeta();
    if (!p) return null;
    this._liberar(p);
    return p;
  }

  _liberar(p) {
    this.grupo.attach(p.malla);
    p.sujeta = false;
    // Queda derecha: conserva sólo el giro alrededor de la vertical.
    const e = new THREE.Euler().setFromQuaternion(p.malla.quaternion, 'ZYX');
    p.malla.rotation.set(0, 0, e.z);
    this.cayendo.push({ pieza: p, v: 0 });
  }

  _apoyo(p) {
    let z = 0;
    const { x, y } = p.malla.position;
    for (const o of this.piezas) {
      if (o === p || o.sujeta) continue;
      const dx = Math.abs(o.malla.position.x - x), dy = Math.abs(o.malla.position.y - y);
      const lim = (o.lado + p.lado) / 2 * 0.9;
      if (dx < lim && dy < lim && o.malla.position.z + o.lado / 2 <= p.malla.position.z - p.lado / 2 + 0.004) {
        z = Math.max(z, o.malla.position.z + o.lado / 2);
      }
    }
    return z + p.lado / 2;
  }

  _cuadro(dt) {
    if (this.cayendo.length) {
      this.cayendo = this.cayendo.filter((c) => {
        const suelo = this._apoyo(c.pieza);
        c.v += 9.81 * dt;
        c.pieza.malla.position.z = Math.max(suelo, c.pieza.malla.position.z - c.v * dt);
        return c.pieza.malla.position.z > suelo + 1e-5;
      });
      if (!this.cayendo.length) this._actualizarSensor();
    }
  }

  _actualizarSensor() {
    const e = DISPOSICION.entrada;
    const hay = this.piezas.some((p) => !p.sujeta && Math.hypot(p.malla.position.x * 1000 - e.x, p.malla.position.y * 1000 - e.y) < e.radio
      && p.malla.position.z < p.lado);
    this.fijarSenal('di1', hay ? 1 : 0);
  }

  fijarSenal(s, v) {
    v = v ? 1 : 0;
    const cambio = this.senales[s] !== v;
    this.senales[s] = v;
    if (s === 'di1') this.anilloSensor.material.color.set(v ? 0xc2ef4e : 0x7553ff);
    if (this.luces[s]) {
      this.luces[s].material.emissiveIntensity = v ? 1.6 : 0;
      this.luces[s].material.opacity = v ? 1 : 0.55;
    }
    if (cambio) this.alCambiarSenales?.(this.senales);
  }

  // Estado de las piezas en mm, para la interfaz.
  resumen() {
    return this.piezas.map((p) => {
      const w = new THREE.Vector3();
      p.malla.getWorldPosition(w);
      const inv = new THREE.Matrix4().copy(this.escena.raiz.matrixWorld).invert();
      w.applyMatrix4(inv);
      return { nombre: p.nombre, x: w.x * 1000, y: w.y * 1000, z: w.z * 1000, sujeta: p.sujeta };
    });
  }
}
