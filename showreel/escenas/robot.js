// El SO-ARM100 en three.js, armado con el mismo URDF y las mismas mallas STL
// que usan Gazebo, MoveIt y SO-ARM100 Estudio. Sólo dibuja: no anima por su cuenta.
import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';

export const BRAZO = ['Shoulder_Rotation', 'Shoulder_Pitch', 'Elbow', 'Wrist_Pitch', 'Wrist_Roll'];
export const TODAS = [...BRAZO, 'Gripper'];

function origen(j) {
  const m = new THREE.Matrix4();
  m.makeRotationFromEuler(new THREE.Euler(j.rpy[0], j.rpy[1], j.rpy[2], 'ZYX'));
  m.setPosition(j.xyz[0], j.xyz[1], j.xyz[2]);
  return m;
}

export class Robot {
  constructor(modelo, materialPara) {
    this.modelo = modelo;
    this.grupo = new THREE.Group();
    this.giros = {};
    this.ejes = {};
    this.eslabones = { base_link: this.grupo };
    this.mallas = [];
    const pendientes = [...modelo.juntas];
    while (pendientes.length) {
      const i = pendientes.findIndex((j) => this.eslabones[j.padre]);
      const j = pendientes.splice(i, 1)[0];
      const o = new THREE.Group();
      o.applyMatrix4(origen(j));
      const g = new THREE.Group();
      const h = new THREE.Group();
      g.add(h); o.add(g);
      this.eslabones[j.padre].add(o);
      this.eslabones[j.hijo] = h;
      this.giros[j.nombre] = g;
      if (j.eje) this.ejes[j.nombre] = new THREE.Vector3(...j.eje).normalize();
      const v = modelo.eslabones[j.hijo]?.malla;
      if (v) this.mallas.push({ grupo: h, visual: v, junta: j.nombre, eslabon: j.hijo });
    }
    this.materialPara = materialPara;
  }

  async cargar(rutaMallas) {
    const cargador = new STLLoader();
    const archivos = [...new Set(this.mallas.map((m) => m.visual.archivo))];
    const geos = {};
    await Promise.all(archivos.map((a) => cargador.loadAsync(`${rutaMallas}/${a}`).then((g) => {
      g.computeVertexNormals(); geos[a] = g;
    })));
    for (const m of this.mallas) {
      const malla = new THREE.Mesh(geos[m.visual.archivo], this.materialPara(m.visual.archivo, m.junta));
      malla.position.set(...m.visual.xyz);
      malla.rotation.copy(new THREE.Euler(m.visual.rpy[0], m.visual.rpy[1], m.visual.rpy[2], 'ZYX'));
      malla.castShadow = true;
      malla.receiveShadow = true;
      m.grupo.add(malla);
      m.malla = malla;
    }
    return this;
  }

  // q: [5 articulaciones del brazo, pinza] en radianes.
  poner(q) {
    TODAS.forEach((n, i) => {
      const g = this.giros[n];
      if (g && this.ejes[n]) g.quaternion.setFromAxisAngle(this.ejes[n], q[i] ?? 0);
    });
  }

  // Posición en el mundo del origen de una articulación (para etiquetas y anillos).
  puntoDe(nombre) {
    const v = new THREE.Vector3();
    this.giros[nombre].getWorldPosition(v);
    return v;
  }

  ejeMundo(nombre) {
    const q = new THREE.Quaternion();
    this.giros[nombre].getWorldQuaternion(q);
    return this.ejes[nombre].clone().applyQuaternion(q).normalize();
  }
}
