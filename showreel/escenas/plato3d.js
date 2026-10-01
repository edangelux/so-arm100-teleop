// El plató 3D: el SO-ARM100 con sus mallas reales, luces de estudio y un piso
// con el anillo del alcance. Las escenas sólo piden cámara, postura y resaltes.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Robot, TODAS } from './robot.js';

const MALLAS = '/entrega/src/SO-100-arm/so_arm_100_description/models/so_arm_100_5dof/meshes';
export const COLOR_JUNTA = {
  Shoulder_Rotation: 0xfd44b0, Shoulder_Pitch: 0xc2ef4e, Elbow: 0xffb287,
  Wrist_Pitch: 0x7553ff, Wrist_Roll: 0x5ee7ff, Gripper: 0xffffff,
};

function texturaRadial(interior, exterior, tam = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = tam;
  const g = c.getContext('2d');
  const d = g.createRadialGradient(tam / 2, tam / 2, 0, tam / 2, tam / 2, tam / 2);
  d.addColorStop(0, interior);
  d.addColorStop(1, exterior);
  g.fillStyle = d;
  g.fillRect(0, 0, tam, tam);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Plato {
  async iniciar(lienzo, modelo) {
    const r = this.renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, alpha: true, preserveDrawingBuffer: true });
    r.setPixelRatio(1);
    r.setSize(1920, 1080, false);
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.setClearColor(0x000000, 0);
    const e = this.escena = new THREE.Scene();
    e.environment = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.04).texture;
    e.environmentIntensity = 0.35;
    e.fog = new THREE.Fog(0x0b0814, 1.4, 3.6);
    this.camara = new THREE.PerspectiveCamera(32, 1920 / 1080, 0.01, 30);

    const clave = this.clave = new THREE.DirectionalLight(0xfff4ea, 2.6);
    clave.position.set(0.9, 1.4, 1.1);
    const borde1 = this.borde1 = new THREE.DirectionalLight(0x7553ff, 4.0);
    borde1.position.set(-1.2, 0.8, -1.0);
    const borde2 = this.borde2 = new THREE.DirectionalLight(0xc2ef4e, 1.8);
    borde2.position.set(1.2, 0.5, -1.2);
    e.add(clave, borde1, borde2, new THREE.HemisphereLight(0xb9b0ff, 0x0b0814, 0.5));

    // Piso: un disco que se desvanece, una sombra de contacto y el anillo del alcance.
    const piso = new THREE.Mesh(new THREE.CircleGeometry(1.4, 96), new THREE.MeshBasicMaterial({ map: texturaRadial('rgba(40,28,72,1)', 'rgba(11,8,20,0)'), transparent: true, depthWrite: false }));
    piso.rotation.x = -Math.PI / 2;
    const sombra = new THREE.Mesh(new THREE.CircleGeometry(0.16, 48), new THREE.MeshBasicMaterial({ map: texturaRadial('rgba(0,0,0,0.75)', 'rgba(0,0,0,0)'), transparent: true, depthWrite: false }));
    sombra.rotation.x = -Math.PI / 2;
    sombra.position.y = 0.001;
    this.rejilla = new THREE.PolarGridHelper(0.9, 16, 8, 128, 0x3a2d6a, 0x231a40);
    this.rejilla.position.y = 0.0015;
    this.rejilla.material.transparent = true;
    this.rejilla.material.opacity = 0.7;
    this.alcance = new THREE.Mesh(new THREE.RingGeometry(0.4287, 0.4347, 160, 1, 0, Math.PI * 2),
      new THREE.MeshBasicMaterial({ color: 0xc2ef4e, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
    this.alcance.rotation.x = -Math.PI / 2;
    this.alcance.position.y = 0.002;
    e.add(piso, sombra, this.rejilla, this.alcance);

    // El robot: z del URDF hacia arriba y el brazo mirando a la derecha de la vista.
    this.materiales = [];
    this.robot = new Robot(modelo, (archivo, junta) => {
      const m = new THREE.MeshPhysicalMaterial({
        color: archivo === 'Base.STL' ? 0x2a1d55 : 0x1e1c26, roughness: 0.42, metalness: 0.25,
        clearcoat: 0.6, clearcoatRoughness: 0.3, emissive: 0x000000,
      });
      m.userData.junta = junta;
      this.materiales.push(m);
      return m;
    });
    await this.robot.cargar(MALLAS);
    const soporte = this.soporte = new THREE.Group();
    soporte.rotation.y = Math.PI / 2;
    const raiz = new THREE.Group();
    raiz.rotation.x = -Math.PI / 2;
    raiz.add(this.robot.grupo);
    soporte.add(raiz);
    e.add(soporte);

    // Anillo que marca una articulación.
    this.aro = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.0028, 12, 96), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true }));
    this.aro.visible = false;
    e.add(this.aro);
    // Orden de padre a hijo, para saber qué eslabones mueve cada articulación.
    this.orden = TODAS;
  }

  // Ilumina los eslabones que mueve la articulación `junta` (y los que cuelgan de ella).
  resaltar(junta, intensidad = 1) {
    const k = junta ? this.orden.indexOf(junta) : -1;
    for (const m of this.materiales) {
      const j = this.orden.indexOf(m.userData.junta);
      const on = k >= 0 && j === k;
      const c = on ? COLOR_JUNTA[junta] : 0x000000;
      m.emissive.setHex(c);
      m.emissiveIntensity = on ? 0.55 * intensidad : 0;
      m.opacity = 1;
    }
    if (k >= 0 && intensidad > 0) {
      this.aro.visible = true;
      this.soporte.updateMatrixWorld(true);
      const p = this.robot.puntoDe(junta);
      const eje = this.robot.ejeMundo(junta);
      this.aro.position.copy(p);
      this.aro.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), eje);
      this.aro.material.color.setHex(COLOR_JUNTA[junta]);
      this.aro.material.opacity = intensidad;
      this.aro.scale.setScalar(0.8 + 0.4 * intensidad);
    } else {
      this.aro.visible = false;
    }
  }

  // Punto de una articulación proyectado a píxeles de la pantalla.
  pantalla(junta, dx = 0, dy = 0, dz = 0) {
    this.soporte.updateMatrixWorld(true);
    const p = this.robot.puntoDe(junta).add(new THREE.Vector3(dx, dy, dz)).project(this.camara);
    return { x: (p.x + 1) / 2 * 1920, y: (1 - p.y) / 2 * 1080 };
  }

  pinza() {
    this.soporte.updateMatrixWorld(true);
    const v = new THREE.Vector3();
    this.robot.eslabones.Fixed_Gripper?.getWorldPosition(v);
    return v;
  }

  // cam: { pos: [x,y,z], mira: [x,y,z], fov }
  dibujar({ q, cam, giro = 0, alcance = 0, rejilla = 0.7, desplazar = [0, 0] }) {
    this.robot.poner(q);
    this.soporte.rotation.y = Math.PI / 2 + giro;
    this.camara.position.set(...cam.pos);
    this.camara.fov = cam.fov || 32;
    this.camara.updateProjectionMatrix();
    this.camara.lookAt(new THREE.Vector3(...cam.mira));
    // Desplaza la imagen en la pantalla sin cambiar la perspectiva (deja sitio al texto).
    if (desplazar[0] || desplazar[1]) this.camara.setViewOffset(1920, 1080, -desplazar[0], -desplazar[1], 1920, 1080);
    else this.camara.clearViewOffset();
    this.alcance.material.opacity = alcance;
    this.rejilla.material.opacity = rejilla;
    this.renderer.render(this.escena, this.camara);
  }

  limpiar() { this.renderer.clear(); }
}

// Cámara en órbita alrededor de un punto: ángulo horizontal, altura y distancia.
export function orbita(angulo, altura, distancia, mira = [0, 0.2, 0], fov = 32) {
  return { pos: [mira[0] + Math.sin(angulo) * distancia, altura, mira[2] + Math.cos(angulo) * distancia], mira, fov };
}
