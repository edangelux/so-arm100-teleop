// Escena 3D: el SO-ARM100 construido desde el URDF con sus mallas reales.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { transformacionOrigen, BRAZO } from './cinematica.js';

export const COLORES = {
  Shoulder_Rotation: '#fd44b0', Shoulder_Pitch: '#c2ef4e', Elbow: '#ffb287',
  Wrist_Pitch: '#7553ff', Wrist_Roll: '#ffffff', Gripper: '#bdb8c0',
};

export class Escena {
  constructor(contenedor, modelo) {
    this.contenedor = contenedor;
    this.modelo = modelo;
    this.alCambiarEfector = null;
    this.alClicArticulacion = null;
    this.alArrastrar = null;

    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 0.95;
    contenedor.append(r.domElement);
    this.etiquetas = new CSS2DRenderer();
    Object.assign(this.etiquetas.domElement.style, { position: 'absolute', inset: '0', pointerEvents: 'none' });
    contenedor.append(this.etiquetas.domElement);

    const e = this.escena = new THREE.Scene();
    e.environment = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.04).texture;
    e.environmentIntensity = 0.55;
    e.fog = new THREE.Fog(0x2a1850, 1.6, 4.5);
    this.camara = new THREE.PerspectiveCamera(38, 1, 0.01, 20);
    this.camara.position.set(0.3, 0.42, 0.95);
    this.orbita = new OrbitControls(this.camara, r.domElement);
    this.orbita.target.set(0.13, 0.13, 0);
    this.orbita.enableDamping = true;
    this.orbita.minDistance = 0.25;
    this.orbita.maxDistance = 2.5;
    this.orbita.maxPolarAngle = Math.PI * 0.495;

    const sol = new THREE.DirectionalLight(0xffffff, 2.2);
    sol.position.set(0.8, 1.6, 0.6);
    sol.castShadow = true;
    sol.shadow.mapSize.set(2048, 2048);
    Object.assign(sol.shadow.camera, { left: -0.6, right: 0.6, top: 0.6, bottom: -0.6, near: 0.1, far: 4 });
    sol.shadow.bias = -0.0004;
    e.add(sol, new THREE.HemisphereLight(0xf0eeff, 0x150f23, 0.6));
    const contra = new THREE.DirectionalLight(0x6a5fc1, 1.4);
    contra.position.set(-1, 0.6, -0.8);
    e.add(contra);
    this._suelo();

    // El URDF usa z hacia arriba; three.js usa y. Además se gira la base para que
    // el brazo, que en el URDF apunta hacia −y, quede hacia la derecha de la vista.
    this.soporte = new THREE.Group();
    this.soporte.rotation.y = Math.PI / 2;
    this.raiz = new THREE.Group();
    this.raiz.rotation.x = -Math.PI / 2;
    this.soporte.add(this.raiz);
    e.add(this.soporte);
    this.materiales = {};
    this.robot = this._construir(false);
    this.fantasma = this._construir(true);
    this.fantasma.grupo.visible = false;
    this.raiz.add(this.robot.grupo, this.fantasma.grupo);
    this._cargarMallas();
    this._ayudas();

    this.q = [0, 0, 0, 0, 0, 0];
    this.qDestino = null;
    this.reloj = new THREE.Clock();
    this.raycaster = new THREE.Raycaster();
    r.domElement.addEventListener('pointerdown', (ev) => this._clic(ev));
    new ResizeObserver(() => this._ajustar()).observe(contenedor);
    this._ajustar();
    r.setAnimationLoop(() => this._cuadro());
  }

  _suelo() {
    const suelo = new THREE.Mesh(new THREE.CircleGeometry(0.62, 96),
      new THREE.MeshStandardMaterial({ color: 0x150f23, roughness: 1, metalness: 0, envMapIntensity: 0.25 }));
    suelo.rotation.x = -Math.PI / 2;
    suelo.receiveShadow = true;
    const aro = new THREE.Mesh(new THREE.RingGeometry(0.615, 0.625, 128),
      new THREE.MeshBasicMaterial({ color: 0x7553ff, transparent: true, opacity: 0.9 }));
    aro.rotation.x = -Math.PI / 2;
    aro.position.y = 0.0005;
    const rejilla = new THREE.PolarGridHelper(0.6, 12, 6, 96, 0x4a3a80, 0x362d59);
    rejilla.position.y = 0.001;
    this.escena.add(suelo, aro, rejilla);
  }

  _material(fantasma, archivo) {
    if (fantasma) return new THREE.MeshStandardMaterial({ color: 0xc2ef4e, transparent: true, opacity: 0.26, depthWrite: false, emissive: 0x3a4a10 });
    // Base en violeta profundo y eslabones en blanco satinado; los acentos quedan en lima.
    const color = archivo === 'Base.STL' ? 0x422082 : 0xefefef;
    return new THREE.MeshPhysicalMaterial({ color, metalness: 0.1, roughness: 0.48, clearcoat: 0.5, clearcoatRoughness: 0.35 });
  }

  // Árbol de grupos: eslabón → origen de la junta → giro de la junta → eslabón hijo.
  _construir(fantasma) {
    const grupo = new THREE.Group();
    const eslabones = { base_link: grupo };
    const giros = {};
    const mallas = [];
    const pendientes = [...this.modelo.juntas];
    while (pendientes.length) {
      const i = pendientes.findIndex((j) => eslabones[j.padre]);
      const j = pendientes.splice(i, 1)[0];
      const origen = new THREE.Group();
      origen.applyMatrix4(transformacionOrigen(j));
      const giro = new THREE.Group();
      giro.userData = { junta: j.nombre, eje: j.eje ? new THREE.Vector3(...j.eje).normalize() : null };
      const hijo = new THREE.Group();
      hijo.userData.eslabon = j.hijo;
      hijo.userData.junta = j.nombre;
      giro.add(hijo);
      origen.add(giro);
      eslabones[j.padre].add(origen);
      eslabones[j.hijo] = hijo;
      giros[j.nombre] = giro;
      const v = this.modelo.eslabones[j.hijo]?.malla;
      if (v) mallas.push({ grupo: hijo, visual: v, junta: j.nombre });
    }
    const vb = this.modelo.eslabones.Base?.malla;
    return { grupo, eslabones, giros, mallas, fantasma, base: vb };
  }

  _cargarMallas() {
    const cargador = new STLLoader();
    const geometrias = {};
    const archivos = new Set([...this.robot.mallas.map((m) => m.visual.archivo)]);
    return Promise.all([...archivos].map((a) => new Promise((ok) => cargador.load(`/mallas/${a}`, (g) => {
      g.computeVertexNormals(); geometrias[a] = g; ok();
    }, undefined, () => ok())))).then(() => {
      for (const r of [this.robot, this.fantasma]) {
        for (const m of r.mallas) {
          const g = geometrias[m.visual.archivo];
          if (!g) continue;
          const malla = new THREE.Mesh(g, this._material(r.fantasma, m.visual.archivo));
          malla.position.set(...m.visual.xyz);
          malla.rotation.copy(new THREE.Euler(m.visual.rpy[0], m.visual.rpy[1], m.visual.rpy[2], 'ZYX'));
          malla.castShadow = !r.fantasma;
          malla.receiveShadow = !r.fantasma;
          malla.userData.junta = m.junta;
          m.grupo.add(malla);
          m.malla = malla;
        }
      }
      this.cargado = true;
    });
  }

  _ayudas() {
    // Flecha del eje de giro y arco, para señalar una articulación.
    this.flechaEje = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 0.09, 0xffffff, 0.02, 0.012);
    this.flechaEje.visible = false;
    this.arcoEje = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.0022, 8, 64, Math.PI * 1.6),
      new THREE.MeshBasicMaterial({ color: 0xffffff }));
    this.arcoEje.visible = false;
    this.raiz.add(this.flechaEje, this.arcoEje);
    // Ejes de cada articulación y etiquetas.
    this.ejesJuntas = [];
    this.etiquetasJuntas = [];
    for (const n of [...BRAZO, 'Gripper']) {
      const g = this.robot.giros[n];
      const ejes = new THREE.AxesHelper(0.05);
      ejes.visible = false;
      g.add(ejes);
      this.ejesJuntas.push(ejes);
      const j = this.modelo.juntas.find((x) => x.nombre === n);
      const div = document.createElement('div');
      div.className = 'etiqueta3d';
      div.textContent = j.etiqueta;
      div.style.borderLeftColor = COLORES[n];
      const et = new CSS2DObject(div);
      et.visible = false;
      g.add(et);
      this.etiquetasJuntas.push(et);
    }
    // Rastro de la punta.
    this.rastroPuntos = [];
    this.rastro = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xfd44b0, transparent: true, opacity: 0.9 }));
    this.rastro.visible = false;
    this.raiz.add(this.rastro);
    // Esfera objetivo para la cinemática inversa.
    this.objetivo = new THREE.Mesh(new THREE.SphereGeometry(0.012, 24, 16),
      new THREE.MeshStandardMaterial({ color: 0xc2ef4e, emissive: 0x4a5c14, transparent: true, opacity: 0.9 }));
    this.objetivo.visible = false;
    this.raiz.add(this.objetivo);
    this.control = new TransformControls(this.camara, this.renderer.domElement);
    this.control.setSize(0.7);
    this.control.addEventListener('dragging-changed', (ev) => { this.orbita.enabled = !ev.value; });
    this.control.addEventListener('objectChange', () => this.alArrastrar?.(this.objetivo.position.clone()));
    this.escena.add(this.control.getHelper ? this.control.getHelper() : this.control);
    // Marcadores libres para las lecciones.
    this.extras = new THREE.Group();
    this.raiz.add(this.extras);
  }

  _ajustar() {
    const { clientWidth: w, clientHeight: h } = this.contenedor;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.etiquetas.setSize(w, h);
    this.camara.aspect = w / h;
    this.camara.updateProjectionMatrix();
  }

  _aplicar(robot, q) {
    [...BRAZO, 'Gripper'].forEach((n, i) => {
      const g = robot.giros[n];
      if (g?.userData.eje) g.quaternion.setFromAxisAngle(g.userData.eje, q[i] ?? 0);
    });
  }

  // Postura del robot sólido. Con suave=true se interpola (simulación interna).
  fijarPostura(q, suave = false) {
    if (suave) { this.qDestino = q.slice(); return; }
    this.qDestino = null;
    this.q = q.slice();
    this._aplicar(this.robot, this.q);
  }

  fijarFantasma(q) {
    if (!q) { this.fantasma.grupo.visible = false; return; }
    this.fantasma.grupo.visible = true;
    this._aplicar(this.fantasma, q);
  }

  resaltar(nombre) {
    for (const m of this.robot.mallas) {
      if (!m.malla) continue;
      const activo = nombre && this._debajoDe(m.grupo, nombre);
      m.malla.material.emissive?.set(activo ? new THREE.Color(COLORES[nombre]).multiplyScalar(0.7) : 0x000000);
    }
    const g = nombre && this.robot.giros[nombre];
    this.flechaEje.visible = this.arcoEje.visible = !!g?.userData.eje;
    if (g?.userData.eje) {
      this.soporte.updateMatrixWorld(true);
      const inv = new THREE.Matrix4().copy(this.raiz.matrixWorld).invert();
      const m = new THREE.Matrix4().multiplyMatrices(inv, g.matrixWorld);
      const pos = new THREE.Vector3().setFromMatrixPosition(m);
      const eje = g.userData.eje.clone().transformDirection(m);
      this.flechaEje.position.copy(pos).addScaledVector(eje, -0.045);
      this.flechaEje.setDirection(eje);
      this.flechaEje.setColor(COLORES[nombre]);
      this.arcoEje.position.copy(pos);
      this.arcoEje.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), eje);
      this.arcoEje.material.color.set(COLORES[nombre]);
    }
  }

  _debajoDe(obj, junta) {
    for (let o = obj; o; o = o.parent) if (o.userData?.junta === junta && o.userData.eslabon) return true;
    return false;
  }

  verEtiquetas(v) { this.etiquetasJuntas.forEach((e) => { e.visible = v; }); }
  verEjes(v) { this.ejesJuntas.forEach((e) => { e.visible = v; }); }
  verRastro(v) { this.rastro.visible = v; if (!v) { this.rastroPuntos = []; this.rastro.geometry.setFromPoints([]); } }

  mostrarObjetivo(v, pos) {
    this.objetivo.visible = v;
    if (pos) this.objetivo.position.copy(pos);
    if (v) this.control.attach(this.objetivo); else this.control.detach();
  }

  vista(nombre) {
    const t = this.orbita.target;
    const p = { iso: [0.3, 0.42, 0.95], frente: [1.05, 0.2, 0], lado: [0.13, 0.2, 1.0], arriba: [0.13, 1.15, 0.001], leccion: [0.08, 0.42, 1.02] }[nombre];
    const objetivo = nombre === 'leccion' ? new THREE.Vector3(0.07, 0.1, 0) : new THREE.Vector3(0.13, 0.13, 0);
    void t;
    this._animarCamara(new THREE.Vector3(...p), objetivo);
  }

  _animarCamara(destino, objetivo) {
    const inicio = this.camara.position.clone();
    const t0 = performance.now();
    const paso = () => {
      const k = Math.min(1, (performance.now() - t0) / 600);
      const s = k * k * (3 - 2 * k);
      this.camara.position.lerpVectors(inicio, destino, s);
      this.orbita.target.copy(objetivo);
      if (k < 1) requestAnimationFrame(paso);
    };
    paso();
  }

  _clic(ev) {
    if (!this.alClicArticulacion || !this.cargado) return;
    const r = this.renderer.domElement.getBoundingClientRect();
    const p = new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(p, this.camara);
    const hit = this.raycaster.intersectObjects(this.robot.mallas.map((m) => m.malla).filter(Boolean), false)[0];
    if (hit) this.alClicArticulacion(hit.object.userData.junta);
  }

  // Posición de la punta en el marco del URDF (metros).
  posicionEfector() {
    this.soporte.updateMatrixWorld(true);
    const ef = this.robot.eslabones.End_Effector;
    const inv = new THREE.Matrix4().copy(this.raiz.matrixWorld).invert();
    return new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().multiplyMatrices(inv, ef.matrixWorld));
  }

  _cuadro() {
    const dt = Math.min(this.reloj.getDelta(), 0.2);
    if (this.qDestino) {
      let fin = true;
      this.q = this.q.map((v, i) => {
        const d = this.qDestino[i] - v;
        const paso = Math.sign(d) * Math.min(Math.abs(d), 2.2 * dt);
        if (Math.abs(d) > 1e-4) fin = false;
        return v + paso;
      });
      this._aplicar(this.robot, this.q);
      if (fin) this.qDestino = null;
    }
    this.orbita.update();
    const pe = this.posicionEfector();
    if (this.rastro.visible) {
      const u = this.rastroPuntos[this.rastroPuntos.length - 1];
      if (!u || u.distanceTo(pe) > 0.002) {
        this.rastroPuntos.push(pe.clone());
        if (this.rastroPuntos.length > 600) this.rastroPuntos.shift();
        this.rastro.geometry.setFromPoints(this.rastroPuntos);
      }
    }
    this.alCambiarEfector?.(pe);
    this.alCuadro?.(dt);
    this.renderer.render(this.escena, this.camara);
    this.etiquetas.render(this.escena, this.camara);
  }
}
