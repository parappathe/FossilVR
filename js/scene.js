// Cena do Fóssil: acampamento de escavação no deserto à tarde (mesas de pedra vermelha ao longe,
// barraca de lona, caixotes), uma caixa de areia na altura da cintura com a grade de barbante,
// os ossos que aparecem, as ferramentas (pincel e picareta), o colega do outro lado e a lousa.
import * as THREE from '../vendor/three/three.module.js';
import { SPECIES, neighbors8 } from './rules.js';
import { ceuGradiente, ambienteDoCeu, solPrincipal, luzCeuChao, neblina, caixaArredondada, escurecerBase, sombraContato, halo, espalhar } from './visual3d.js';
import { madeira, tecido } from './materiais3d.js';
import { Label } from './ui.js';

export const CELL = 0.08;
export const TRAY = { x: 0, z: -0.62, top: 0.82 };
export const SAND_Y = TRAY.top + 0.035;            // topo da areia fechada
export const SOIL_Y = TRAY.top + 0.008;            // fundo de casa escavada
export const TEAMC = ['#2f7ad8', '#e07a2a'];
const IS_QUEST = typeof navigator !== 'undefined' && /OculusBrowser|Quest/i.test(navigator.userAgent || '');
const CAN_TEX = typeof ImageData !== 'undefined';
const NUMC = ['#ffffff', '#2a6ad8', '#2a9a4a', '#d83a2a', '#6a2ab8', '#a8442a', '#2aa8a8', '#222222', '#888888'];
function hash(i) { let h = Math.imul(i ^ 0x9e3779b9, 2654435761); h ^= h >>> 15; return (h >>> 0) / 4294967296; }

export function buildWorld(renderer) {
  const scene = new THREE.Scene();
  const SKY = { zenite: '#3a78c8', horizonte: '#f2d2a8', chao: '#c89a6a', dirSol: new THREE.Vector3(-0.5, 0.55, 0.65) };
  scene.add(ceuGradiente(SKY));
  if (renderer && CAN_TEX && renderer.capabilities) ambienteDoCeu(renderer, scene, SKY, 0.6);
  solPrincipal(scene, { dir: SKY.dirSol, cor: '#ffe6c0', intensidade: 2.7, raioArea: 1.6, alvo: new THREE.Vector3(TRAY.x, TRAY.top, TRAY.z), mapa: IS_QUEST ? 1024 : 2048 });
  luzCeuChao(scene, { ceu: '#a8c8f2', chao: '#d8a878', intensidade: 0.75 });
  neblina(scene, SKY.horizonte, 40, 320);

  // ---------- Deserto ----------
  const sandMat = new THREE.MeshStandardMaterial({ color: 0xd8b07a, roughness: 0.95, vertexColors: true });
  const gGeo = new THREE.PlaneGeometry(500, 500, 120, 120); gGeo.rotateX(-Math.PI / 2);
  { const p = gGeo.attributes.position; const col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z);
      const h = r < 6 ? 0 : (Math.sin(x * 0.07 + z * 0.03) * 1.2 + Math.sin(z * 0.11) * 0.6) * Math.min(1, (r - 6) / 30);
      p.setY(i, h); const k = 0.9 + hash(i) * 0.12; col[i * 3] = k; col[i * 3 + 1] = k * 0.98; col[i * 3 + 2] = k * 0.95; }
    gGeo.setAttribute('color', new THREE.BufferAttribute(col, 3)); gGeo.computeVertexNormals(); }
  const ground = new THREE.Mesh(gGeo, sandMat); ground.receiveShadow = true; scene.add(ground);
  // mesas de pedra vermelha no horizonte
  const mesaMat = new THREE.MeshStandardMaterial({ color: 0xb8643a, roughness: 0.95, flatShading: true });
  for (let k = 0; k < 11; k++) {
    const a = k / 11 * Math.PI * 2 + 0.3, r = 120 + hash(k) * 80;
    const w = 15 + hash(k + 2) * 30, h = 12 + hash(k + 5) * 22;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.8, w, h, 7), mesaMat);
    m.position.set(Math.cos(a) * r, h / 2 - 1, Math.sin(a) * r); m.rotation.y = hash(k + 9) * 3;
    scene.add(m);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.82, w * 0.8, h * 0.12, 7), new THREE.MeshStandardMaterial({ color: 0xd8946a, roughness: 0.95, flatShading: true }));
    cap.position.set(m.position.x, h - 1 + h * 0.06, m.position.z); cap.rotation.y = m.rotation.y; scene.add(cap);
  }
  // pedras, arbustos secos e cactos
  scene.add(espalhar(new THREE.IcosahedronGeometry(0.15, 1), new THREE.MeshStandardMaterial({ color: 0xa8704a, roughness: 0.9, flatShading: true }), 60, { raio: 14, raioMin: 2.2, escala: [0.3, 1.6], semente: 4, sombra: true }));
  scene.add(espalhar(new THREE.IcosahedronGeometry(0.18, 0), new THREE.MeshStandardMaterial({ color: 0x8a8a4a, roughness: 0.9, flatShading: true }), 50, { raio: 16, raioMin: 2.5, escala: [0.5, 1.2], semente: 8 }));
  const cactusMat = new THREE.MeshStandardMaterial({ color: 0x5a8a4a, roughness: 0.8 });
  for (let k = 0; k < 9; k++) {
    const a = hash(k + 30) * Math.PI * 2, r = 6 + hash(k + 40) * 16;
    const c = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 1.4, 4, 10), cactusMat); trunk.position.y = 0.85; c.add(trunk);
    for (const s of [-1, 1]) { const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.5, 4, 8), cactusMat); arm.position.set(s * 0.32, 1.0 + hash(k + s) * 0.3, 0); c.add(arm); const el = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.22, 4, 8), cactusMat); el.rotation.z = Math.PI / 2; el.position.set(s * 0.2, 0.8 + hash(k + s) * 0.3, 0); c.add(el); }
    c.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    c.traverse(o => { if (o.isMesh) o.castShadow = true; });
    scene.add(c);
  }
  // barraca de lona e caixotes
  const canvas = CAN_TEX ? tecido({ cor: '#e8dcc0', leve: true }) : new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.9 });
  canvas.side = THREE.DoubleSide;
  const tent = new THREE.Mesh(new THREE.ConeGeometry(2.2, 2.4, 4, 1, true), canvas);
  tent.position.set(-3.6, 1.2, -2.6); tent.rotation.y = Math.PI / 4; tent.castShadow = true; scene.add(tent);
  const crateMat = CAN_TEX ? madeira({ clara: '#c89a5a', escura: '#7a5a32', tabuas: 4, leve: true }) : new THREE.MeshStandardMaterial({ color: 0xb0864a });
  for (const [x, z, s, ry] of [[1.6, -1.6, 0.5, 0.3], [1.9, -1.0, 0.4, -0.2], [1.75, -1.5, 0.35, 0.8], [-2.0, 0.6, 0.45, 0.4]]) {
    const c = new THREE.Mesh(caixaArredondada(s, s * 0.8, s, 0.02, 2), crateMat);
    c.position.set(x, s * 0.4 + (x === 1.75 ? 0.4 : 0), z); c.rotation.y = ry; c.castShadow = c.receiveShadow = true; scene.add(c);
  }
  // guarda-sol sobre a caixa de areia
  const umbMat = new THREE.MeshStandardMaterial({ color: 0xc84a3a, roughness: 0.8, side: THREE.DoubleSide });
  const umb = new THREE.Mesh(new THREE.ConeGeometry(1.6, 0.45, 12, 1, true), umbMat);
  umb.position.set(1.5, 2.55, -0.9); umb.rotation.z = 0.25; scene.add(umb);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.6, 8), new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 1, roughness: 0.4 }));
  pole.position.set(1.7, 1.3, -0.9); pole.rotation.z = 0.12; scene.add(pole);

  // ---------- Caixa de areia (refeita a cada sítio) ----------
  const tray = new THREE.Group(); scene.add(tray);
  const frameMat = CAN_TEX ? madeira({ clara: '#a8743f', escura: '#5e3a1c', tabuas: 1, leve: IS_QUEST }) : new THREE.MeshStandardMaterial({ color: 0x8a5a30, roughness: 0.7 });
  const sandCellMat = new THREE.MeshStandardMaterial({ color: 0xe2bf86, roughness: 0.95 });
  const soilMat = new THREE.MeshStandardMaterial({ color: 0x8a6440, roughness: 0.95 });
  const boneMat = new THREE.MeshStandardMaterial({ color: 0xf2e8d0, roughness: 0.55 });
  const brokenMat = new THREE.MeshStandardMaterial({ color: 0x9a8e7a, roughness: 0.8 });
  const moundGeo = (() => { const g = caixaArredondada(CELL * 0.98, 0.03, CELL * 0.98, 0.008, 2); g.translate(0, 0.015, 0); return g; })();
  const soilGeo = new THREE.BoxGeometry(CELL * 0.98, 0.008, CELL * 0.98);
  let site = null, W = 0, H = 0, origin = new THREE.Vector3();
  let mounds = null, soils = null;
  const cellObjs = [];   // por casa: { mound progress, num flag, bone mesh, owner peg }
  const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1);
  const cellPos = (i, out = new THREE.Vector3()) => out.set(origin.x + (i % W + 0.5) * CELL, SOIL_Y, origin.z + (Math.floor(i / W) + 0.5) * CELL);

  function setSite(s) {
    while (tray.children.length) tray.remove(tray.children[0]);
    cellObjs.length = 0;
    site = s; W = s.W; H = s.H;
    origin.set(TRAY.x - W * CELL / 2, 0, TRAY.z - H * CELL / 2);
    // moldura e pés
    const fw = W * CELL + 0.08, fd = H * CELL + 0.08;
    const box = new THREE.Mesh(caixaArredondada(fw, 0.06, fd, 0.01, 2), frameMat);
    box.position.set(TRAY.x, TRAY.top - 0.01, TRAY.z); box.castShadow = box.receiveShadow = true;
    tray.add(box);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(caixaArredondada(0.06, TRAY.top - 0.04, 0.06, 0.01, 1), frameMat);
      leg.position.set(TRAY.x + sx * (fw / 2 - 0.05), (TRAY.top - 0.04) / 2, TRAY.z + sz * (fd / 2 - 0.05)); leg.castShadow = true; tray.add(leg);
    }
    for (const [x, z, w, d] of [[0, -fd / 2, fw, 0.025], [0, fd / 2, fw, 0.025], [-fw / 2, 0, 0.025, fd], [fw / 2, 0, 0.025, fd]]) {
      const rim = new THREE.Mesh(caixaArredondada(w, 0.05, d, 0.006, 1), frameMat);
      rim.position.set(TRAY.x + x, TRAY.top + 0.03, TRAY.z + z); rim.castShadow = true; tray.add(rim);
    }
    const sh = sombraContato(fw * 1.4, fd * 1.4, 0.45); sh.position.set(TRAY.x, 0.004, TRAY.z); tray.add(sh);
    // casas: monte de areia por cima, chão escuro por baixo
    mounds = new THREE.InstancedMesh(moundGeo, sandCellMat, W * H);
    soils = new THREE.InstancedMesh(soilGeo, soilMat, W * H);
    mounds.castShadow = true; mounds.receiveShadow = true; soils.receiveShadow = true;
    for (let i = 0; i < W * H; i++) {
      cellPos(i, _p);
      soils.setMatrixAt(i, _m.compose(_p.clone().setY(SOIL_Y - 0.004), _q.identity(), _s.set(1, 1, 1)));
      const h = 0.9 + hash(i) * 0.25;
      mounds.setMatrixAt(i, _m.compose(_p.clone().setY(SOIL_Y), _q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (hash(i + 3) - 0.5) * 0.2), _s.set(1, h, 1)));
      const c = new THREE.Color().setHSL(0.1, 0.5, 0.66 + (hash(i + 7) - 0.5) * 0.06);
      mounds.setColorAt(i, c);
      cellObjs.push({ prog: 0, h, flag: null, bone: null, peg: null });
    }
    mounds.instanceColor.needsUpdate = true;
    tray.add(mounds, soils);
    // grade de barbante com estacas
    const lineMat = new THREE.LineBasicMaterial({ color: 0xf8f0e0, transparent: true, opacity: 0.85 });
    const pts = [];
    const y = SAND_Y + 0.012;
    for (let x = 0; x <= W; x++) pts.push(new THREE.Vector3(origin.x + x * CELL, y, origin.z), new THREE.Vector3(origin.x + x * CELL, y, origin.z + H * CELL));
    for (let z = 0; z <= H; z++) pts.push(new THREE.Vector3(origin.x, y, origin.z + z * CELL), new THREE.Vector3(origin.x + W * CELL, y, origin.z + z * CELL));
    tray.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
    const stakeMat = new THREE.MeshStandardMaterial({ color: 0x7a5a32, roughness: 0.8 });
    for (let x = 0; x <= W; x++) for (const z of [0, H]) { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.003, 0.05, 6), stakeMat); st.position.set(origin.x + x * CELL, SAND_Y, origin.z + z * CELL); tray.add(st); }
    for (let z = 1; z < H; z++) for (const x of [0, W]) { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.003, 0.05, 6), stakeMat); st.position.set(origin.x + x * CELL, SAND_Y, origin.z + z * CELL); tray.add(st); }
    // etiquetas das colunas/linhas (A..J, 1..8), como num sítio de verdade
    for (let x = 0; x < W; x++) { const l = new Label(0.04, 64, 64); l.set([{ text: String.fromCharCode(65 + x), size: 0.8, color: '#5a3a1a' }]); l.mesh.position.set(origin.x + (x + 0.5) * CELL, TRAY.top + 0.062, origin.z + H * CELL + 0.028); l.mesh.rotation.x = -Math.PI / 2; l.mesh.material.depthTest = true; tray.add(l.mesh); }
    pickPlane.position.set(TRAY.x, SAND_Y, TRAY.z);
  }
  const pickPlane = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ visible: false }));
  pickPlane.rotation.x = -Math.PI / 2;
  scene.add(pickPlane);

  // altura do monte de areia de uma casa (1 = cheio, 0 = escavado)
  function setMound(i, k) {
    const o = cellObjs[i];
    cellPos(i, _p); _p.y = SOIL_Y;
    mounds.setMatrixAt(i, _m.compose(_p, _q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (hash(i + 3) - 0.5) * 0.2), _s.set(1, Math.max(0.001, o.h * k), 1)));
    mounds.instanceMatrix.needsUpdate = true;
  }
  // mostra uma casa aberta: número (bandeirinha), osso inteiro ou quebrado, pino de quem achou
  function reveal(i, kind, { n = 0, species = null, owner = -1, instant = false } = {}) {
    const o = cellObjs[i];
    o.prog = 1; o.anim = instant ? 1 : 0;
    o.kind = kind;
    setMound(i, instant ? 0 : 1);
    cellPos(i, _p);
    if (kind === 'dirt' && n > 0) {
      const f = new THREE.Group();
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.06, 5), new THREE.MeshStandardMaterial({ color: 0x8a6a3a }));
      stick.position.y = 0.03;
      const lab = new Label(0.042, 64, 64);
      lab.set([{ text: String(n), size: 0.85, color: NUMC[n] }]);
      lab.mesh.position.set(0, 0.062, 0);
      lab.mesh.material.depthTest = true;
      f.add(stick, lab.mesh);
      f.userData.label = lab.mesh;
      f.position.copy(_p);
      tray.add(f); o.flag = f;
    }
    if (kind === 'bone' || kind === 'broken') {
      const b = makeBone(species, kind === 'broken', i);
      b.position.copy(_p); b.position.y += 0.006;
      tray.add(b); o.bone = b;
      if (owner >= 0) {
        const peg = new THREE.Mesh(new THREE.SphereGeometry(0.007, 8, 6), new THREE.MeshStandardMaterial({ color: TEAMC[owner], roughness: 0.4, emissive: TEAMC[owner], emissiveIntensity: 0.3 }));
        peg.position.set(_p.x + CELL * 0.36, SOIL_Y + 0.012, _p.z - CELL * 0.36);
        tray.add(peg); o.peg = peg;
      }
    }
  }
  const SP = {};
  function makeBone(species, broken, i) {
    const g = new THREE.Group();
    const tint = new THREE.Color(SPECIES[species].color);
    const mat = broken ? brokenMat : boneMat.clone();
    if (!broken) mat.color.lerp(tint, 0.18);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, CELL * 0.62, 8), mat);
    shaft.rotation.z = Math.PI / 2;
    g.add(shaft);
    for (const s of [-1, 1]) for (const d of [-1, 1]) { const k = new THREE.Mesh(new THREE.SphereGeometry(0.0105, 8, 6), mat); k.position.set(s * CELL * 0.31, 0, d * 0.006); g.add(k); }
    if (broken) { g.children[0].scale.y = 0.55; g.children[0].position.x = -CELL * 0.12; const crack = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.004, 0.02), new THREE.MeshBasicMaterial({ color: 0xc83a2a })); crack.position.set(CELL * 0.06, 0.009, 0); crack.rotation.y = 0.6; g.add(crack); }
    g.rotation.y = hash(i) * Math.PI;
    // marca de cor da espécie (pequeno disco na terra)
    const disc = new THREE.Mesh(new THREE.CircleGeometry(CELL * 0.42, 16), new THREE.MeshBasicMaterial({ color: tint, transparent: true, opacity: 0.32, depthWrite: false }));
    disc.rotation.x = -Math.PI / 2; disc.position.y = -0.0045;
    g.add(disc);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.userData.disc = disc;
    return g;
  }
  // esqueleto completo: os ossos ficam dourados por um instante e a marca fica forte
  function glowSkeleton(cells, to) {
    for (const i of cells) { const o = cellObjs[i]; if (!o.bone) continue; o.glow = 1.5; o.bone.userData.disc.material.opacity = 0.7; if (to >= 0) o.bone.userData.disc.material.color.set(TEAMC[to]).lerp(new THREE.Color('#ffffff'), 0.2); }
  }

  // pré-visualização de onde a ferramenta vai cavar (realce nas casas)
  const hl = new THREE.InstancedMesh(new THREE.PlaneGeometry(CELL * 0.94, CELL * 0.94).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false, toneMapped: false }), 5);
  hl.count = 0; hl.frustumCulled = false; hl.renderOrder = 3; scene.add(hl);
  function highlight(cells, color = 0xffffff) {
    hl.material.color.set(color);
    let k = 0;
    for (const i of cells || []) { cellPos(i, _p); _p.y = SAND_Y + 0.004 + (cellObjs[i]?.prog >= 1 ? -0.02 : 0); hl.setMatrixAt(k++, _m.compose(_p, _q.identity(), _s.set(1, 1, 1))); }
    hl.count = k; hl.instanceMatrix.needsUpdate = true;
  }

  // ---------- Ferramentas ----------
  const tools = { brush: makeBrush(), pick: makePick() };
  const rack = new THREE.Group();
  const rackTop = new THREE.Mesh(caixaArredondada(0.3, 0.03, 0.2, 0.008, 2), crateMat);
  rackTop.castShadow = rackTop.receiveShadow = true;
  rack.add(rackTop);
  const rackLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.78, 8), crateMat); rackLeg.position.y = -0.4; rack.add(rackLeg);
  rack.position.set(TRAY.x + 0.62, 0.8, TRAY.z + 0.28);
  scene.add(rack);
  const toolHome = { brush: new THREE.Vector3(rack.position.x - 0.07, 0.84, rack.position.z), pick: new THREE.Vector3(rack.position.x + 0.07, 0.84, rack.position.z) };
  for (const k of ['brush', 'pick']) { tools[k].position.copy(toolHome[k]); tools[k].rotation.set(0, 0, Math.PI / 2); scene.add(tools[k]); }
  const toolRing = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.004, 6, 24), new THREE.MeshBasicMaterial({ color: 0xffd24a, toneMapped: false }));
  toolRing.rotation.x = Math.PI / 2; scene.add(toolRing);

  // ---------- Colega do outro lado ----------
  const rival = makeRival();
  rival.position.set(TRAY.x, 0, TRAY.z - 0.62);
  scene.add(rival);

  // ---------- Lousa ----------
  const board = new Label(0.62, 640, 440);
  board.mesh.position.set(TRAY.x - 0.78, 1.25, TRAY.z - 0.1);
  board.mesh.rotation.y = 0.55;
  board.mesh.material.depthTest = true;
  scene.add(board.mesh);
  const easel = new THREE.Mesh(caixaArredondada(0.66, 0.48, 0.03, 0.01, 1), new THREE.MeshStandardMaterial({ color: 0x2a3a2e, roughness: 0.8 }));
  easel.position.copy(board.mesh.position); easel.rotation.y = 0.55; easel.translateZ(-0.02); easel.castShadow = true;
  scene.add(easel);
  for (const s of [-1, 1]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.3, 6), crateMat); leg.position.copy(easel.position); leg.position.y = 0.62; leg.rotation.y = 0.55; leg.translateX(s * 0.28); leg.rotation.z = -s * 0.08; scene.add(leg); }
  function drawBoard(lines) { board.set(lines); }

  // poeira
  const PUFFS = 24;
  const puffTex = halo('#ffffff', 1).material.map;
  const puffs = Array.from({ length: PUFFS }, () => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, color: 0xe8c890, transparent: true, opacity: 0, depthWrite: false })); s.visible = false; scene.add(s); return { s, life: 0, max: 1 }; });
  let puffNext = 0;
  function dust(pos, size = 0.08, n = 3) {
    for (let k = 0; k < n; k++) {
      const p = puffs[puffNext++ % PUFFS];
      p.s.visible = true; p.life = p.max = 0.9 + Math.random() * 0.5;
      p.s.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 0.03, Math.random() * 0.02, (Math.random() - 0.5) * 0.03));
      p.s.userData.size = size * (0.7 + Math.random() * 0.6);
    }
  }

  function animate(dt, time) {
    for (let i = 0; i < cellObjs.length; i++) {
      const o = cellObjs[i];
      if (o.anim != null && o.anim < 1) { o.anim = Math.min(1, o.anim + dt / 0.35); setMound(i, 1 - o.anim); if (o.bone) o.bone.position.y = SOIL_Y + 0.006 - (1 - o.anim) * 0.01; }
      else if (o.prog > 0 && o.prog < 1) setMound(i, 1 - o.prog * 0.8);
      if (o.glow > 0) { o.glow -= dt; const k = Math.max(0, o.glow); o.bone.scale.setScalar(1 + Math.sin(time * 10) * 0.08 * k); }
      if (o.flag) o.flag.userData.label.quaternion.copy(camQ);
    }
    for (const pf of puffs) {
      if (pf.life <= 0) continue;
      pf.life -= dt;
      const k = 1 - pf.life / pf.max;
      pf.s.scale.setScalar(pf.s.userData.size * (0.5 + k));
      pf.s.position.y += dt * 0.04;
      pf.s.material.opacity = 0.6 * (1 - k);
      if (pf.life <= 0) pf.s.visible = false;
    }
    rival.userData.update(dt, time);
  }
  const camQ = new THREE.Quaternion();
  function faceCamera(q) { camQ.copy(q); }

  function cellOf(p) {
    if (!site) return -1;
    const x = Math.floor((p.x - origin.x) / CELL), y = Math.floor((p.z - origin.z) / CELL);
    if (x < 0 || y < 0 || x >= W || y >= H) return -1;
    return y * W + x;
  }
  return { scene, setSite, reveal, setMound, cellObjs, cellPos, cellOf, pickPlane, highlight, tools, toolHome, toolRing, rival, drawBoard, dust, glowSkeleton, animate, faceCamera };
}

// Pincel: cabo de madeira e cerdas. O ponto que cava é a ponta das cerdas (userData.tip).
function makeBrush() {
  const g = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.13, 10), new THREE.MeshStandardMaterial({ color: 0xb8803a, roughness: 0.5 }));
  handle.position.y = 0.065;
  const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.011, 0.02, 12), new THREE.MeshStandardMaterial({ color: 0xc8c8c8, metalness: 1, roughness: 0.3 }));
  ferrule.position.y = -0.005;
  const bristles = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, 0.008), new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.9 }));
  bristles.position.y = -0.033;
  const tip = new THREE.Object3D(); tip.position.y = -0.052;
  g.add(handle, ferrule, bristles, tip);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.userData = { tip, kind: 'brush' };
  return g;
}
// Picareta de mão: cabo e cabeça de ferro. A ponta fica em userData.tip.
function makePick() {
  const g = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.011, 0.24, 10), new THREE.MeshStandardMaterial({ color: 0x8a5a2a, roughness: 0.6 }));
  handle.position.y = 0.06;
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.11, 8), new THREE.MeshStandardMaterial({ color: 0x6a6a72, metalness: 1, roughness: 0.4 }));
  head.rotation.z = Math.PI / 2; head.position.set(0.05, -0.06, 0);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.022), head.material); back.position.set(-0.015, -0.06, 0);
  const tip = new THREE.Object3D(); tip.position.set(0.105, -0.06, 0);
  g.add(handle, head, back, tip);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.userData = { tip, kind: 'pick' };
  return g;
}
// Colega paleontólogo: chapéu de explorador, colete, braço que cava quando é a vez dele.
function makeRival() {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xd8a070, roughness: 0.7 });
  const shirt = new THREE.MeshStandardMaterial({ color: 0xe07a2a, roughness: 0.7 });
  const vest = new THREE.MeshStandardMaterial({ color: 0x8a7a5a, roughness: 0.8 });
  const pants = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.12, 0.8, 12), new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 0.8 })); pants.position.y = 0.4;
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.35, 4, 12), shirt); torso.position.y = 1.08;
  const v = new THREE.Mesh(new THREE.CylinderGeometry(0.185, 0.19, 0.32, 12, 1, true), vest); v.position.y = 1.1;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), skin); head.position.y = 1.5;
  const hat = new THREE.Group(); hat.position.y = 1.6;
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.015, 20), new THREE.MeshStandardMaterial({ color: 0xc8a870, roughness: 0.8 }));
  const crown = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), brim.material); crown.position.y = 0.005;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.132, 0.132, 0.03, 16, 1, true), new THREE.MeshStandardMaterial({ color: 0x5a3a2a })); band.position.y = 0.02;
  hat.add(brim, crown, band);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), eyeMat); e.position.set(s * 0.045, 1.52, 0.115); g.add(e); }
  const glasses = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.004, 6, 16), new THREE.MeshStandardMaterial({ color: 0x2a2a2a }));
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(s * 0.22, 1.25, 0);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.42, 4, 8), shirt); arm.position.y = -0.24; sh.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), skin); hand.position.y = -0.5; sh.add(hand);
    g.add(sh); arms.push(sh);
  }
  void glasses;
  g.add(pants, torso, v, head, hat);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  const st = { dig: 0, think: false, mood: 0 };
  g.userData = {
    st, setColor(c) { shirt.color.set(c); for (const a of arms) a.children[0].material = shirt; },
    update(dt, time) {
      head.rotation.y = Math.sin(time * 0.7) * 0.15;
      if (st.dig > 0) { st.dig -= dt; arms[1].rotation.x = -0.9 - Math.sin(st.dig * 18) * 0.5; arms[0].rotation.x = -0.4; }
      else { arms[1].rotation.x += (-0.25 - arms[1].rotation.x) * Math.min(1, dt * 5); arms[0].rotation.x += ((st.think ? -1.6 : -0.2) - arms[0].rotation.x) * Math.min(1, dt * 5); }
      torso.position.y = 1.08 + Math.sin(time * 2) * 0.005 + (st.mood > 0 ? Math.abs(Math.sin(time * 12)) * 0.03 : 0);
      if (st.mood > 0) st.mood -= dt;
    },
  };
  g.rotation.y = 0;
  return g;
}
