// Fumaça do main.js: carrega o jogo inteiro no Node com um navegador de mentira (sem WebGL, sem som)
// e confere que menu, partida (com o robô), pincel e picareta pelo PC e pelo VR, partida e desafios funcionam.
import * as nodeModule from 'node:module';

// ---- navegador de mentira ----
function fakeCtx() {
  const fn = () => proxy;
  const proxy = new Proxy(fn, {
    get(_, k) {
      if (k === 'measureText') return (t) => ({ width: String(t).length * 12 });
      if (k === 'canvas') return null;
      return fn;
    },
    set() { return true; },
    apply() { return proxy; },
  });
  return proxy;
}
function fakeElement(tag = 'div') {
  const listeners = {};
  return {
    tagName: tag.toUpperCase(), style: {}, dataset: {}, children: [], textContent: '', innerHTML: '', width: 300, height: 150,
    listeners,
    addEventListener(t, f) { (listeners[t] ||= []).push(f); },
    removeEventListener() {},
    appendChild(c) { this.children.push(c); return c; },
    getContext() { return fakeCtx(); },
    setPointerCapture() {}, releasePointerCapture() {},
    getBoundingClientRect() { return { left: 0, top: 0, width: 1280, height: 720 }; },
    dispatch(t, e) { for (const f of listeners[t] || []) f(e); },
  };
}
function installDom() {
  const els = {};
  const winListeners = {};
  const store = new Map();
  const doc = {
    createElement: (t) => fakeElement(t),
    createElementNS: (_, t) => fakeElement(t),
    getElementById: (id) => (els[id] ||= fakeElement('div')),
    body: fakeElement('body'),
    addEventListener() {},
  };
  const win = {
    innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1, isSecureContext: false,
    addEventListener(t, f) { (winListeners[t] ||= []).push(f); },
    removeEventListener() {},
    dispatch(t, e) { for (const f of winListeners[t] || []) f(e); },
    requestAnimationFrame: () => 0, cancelAnimationFrame() {},
  };
  globalThis.window = win;
  globalThis.document = doc;
  globalThis.self = win;
  Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'node-teste' }, configurable: true, writable: true });
  globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  globalThis.requestAnimationFrame = win.requestAnimationFrame;
  return { els, win, store };
}

// Troca só o WebGLRenderer do Three.js por um de mentira (o resto do Three.js é o de verdade).
function installThreeStub() {
  const stub = new URL('./three-stub.js', import.meta.url).href;
  const resolve = (spec, ctx, next) => {
    if (spec.endsWith('vendor/three/three.module.js') && !String(ctx.parentURL || '').endsWith('three-stub.js')) return { url: stub, shortCircuit: true };
    return next(spec, ctx);
  };
  if (nodeModule.registerHooks) nodeModule.registerHooks({ resolve });
  else throw new Error('Node sem module.registerHooks (precisa do Node 22.15 ou mais novo)');
}

export async function smoke() {
  const out = [];
  const ok = (c, m) => out.push([!!c, m]);
  const { els, win, store } = installDom();
  installThreeStub();
  const errors = [];
  const origErr = console.error;
  console.error = (...a) => errors.push(a.join(' '));
  await import('../js/main.js');
  const dev = window.dev;
  const G = window.fossil;
  const THREE = await import('../vendor/three/three.module.js');
  const { SAND_Y } = await import('../js/scene.js');
  ok(dev && typeof dev.advance === 'function', 'main.js carregou e criou window.dev');
  let s = dev.advance(0.5);
  ok(s.tela === 'menu' && s.painel, 'abre no menu principal');
  ok(els.vr.textContent.includes('VR'), `botão de VR avisa que não tem VR aqui ("${els.vr.textContent}")`);
  const canvasEl = G.renderer.domElement;
  const waitFor = (f, max = 200) => { for (let i = 0; i < max && !f(dev.state()); i++) dev.advance(0.25); return dev.advance(0.05); };
  const click = (p) => { canvasEl.dispatch('pointermove', { clientX: p.x, clientY: p.y }); canvasEl.dispatch('pointerdown', { clientX: p.x, clientY: p.y, button: 0 }); win.dispatch('pointerup', {}); return dev.advance(0.05); };
  const hiddenCell = (pred = () => true) => { const g = G.game; for (let i = 0; i < g.open.length; i++) if (!g.open[i] && pred(i)) return i; return -1; };

  s = dev.startMatch(1);
  ok(s.tela === 'play' && s.adversario === 'Professor Pá' && s.abertas === 0, 'partida contra o Professor Pá com o sítio fechado');
  s = waitFor(x => x.fase === 'dig');
  ok(s.fase === 'dig', 'chega a sua vez');
  // PC: pincel numa casa de terra (sem osso) -> passa a vez
  const dirt = hiddenCell(i => G.game.site.bone[i] < 0);
  const a0 = s.acoes[0];
  win.dispatch('keydown', { key: '1' });
  s = click(dev.screenOf(dirt));
  s = dev.advance(1.0);
  ok(G.game.open[dirt] === 1 && s.acoes[0] === a0 + 1, 'clicar com o pincel abre a casa de terra');
  // espera a vez de novo e acha osso com o pincel: cava de novo
  s = waitFor(x => x.fase === 'dig');
  const boneCell = hiddenCell(i => G.game.site.bone[i] >= 0);
  const p0 = s.pontos[0];
  s = click(dev.screenOf(boneCell));
  s = dev.advance(1.0);
  ok(G.game.open[boneCell] === 2 && s.pontos[0] >= p0 + 1 && s.vez === 'você', `osso no pincel: +1 e cava de novo (${s.pontos[0]} pontos)`);
  // picareta numa casa que pega osso: quebra
  s = waitFor(x => x.fase === 'dig');
  win.dispatch('keydown', { key: '2' });
  const g = G.game;
  const target = hiddenCell(i => g.site.bone[i] >= 0);
  const b0 = s.quebrados;
  s = click(dev.screenOf(target));
  s = dev.advance(0.8);
  ok(s.ferramenta === 'pick' && s.quebrados > b0 && g.open[target] === 3, `picareta no osso: quebra (${s.quebrados} quebrado(s))`);

  // VR: pegar o pincel e esfregar uma casa
  s = waitFor(x => x.fase === 'dig');
  const entry = G.shell.ctrls[1];
  entry.source = { handedness: 'right', gamepad: { buttons: [], axes: [0, 0, 0, 0] } };
  entry.side = 'right';
  const rigInv = new THREE.Matrix4().copy(G.shell.rig.matrixWorld).invert();
  const setGrab = (q) => { entry.grip.position.copy(q.clone().add(new THREE.Vector3(0, 0.02, 0.04)).applyMatrix4(rigInv)); entry.ctrl.position.copy(entry.grip.position); G.shell.rig.updateMatrixWorld(true); };
  setGrab(G.world.tools.brush.getWorldPosition(new THREE.Vector3()));
  G.shell.hooks.squeezeStart(entry);
  dev.advance(0.05);
  ok(dev.state().ferramenta === 'brush', 'VR: aperto pega o pincel');
  const vc = hiddenCell();
  const c = G.world.cellPos(vc, new THREE.Vector3());
  // a ponta das cerdas fica a uma distância fixa do punho: corrige para pôr a ponta na casa
  const brushAt = (dx) => { const tip = G.world.tools.brush.userData.tip.getWorldPosition(new THREE.Vector3()); const grip = G.shell.grabPoint(entry, new THREE.Vector3()); const off = grip.clone().sub(tip); setGrab(new THREE.Vector3(c.x + dx, SAND_Y + 0.005, c.z).add(off)); dev.advance(1 / 30); };
  for (let k = 0; k < 6; k++) brushAt(0);
  for (let k = 0; k < 40 && !G.game.open[vc]; k++) brushAt(Math.sin(k * 0.9) * 0.025);
  ok(G.game.open[vc] > 0, `VR: esfregar o pincel na casa tira a terra (casa ${vc})`);
  G.shell.hooks.squeezeEnd(entry);
  // VR: picareta batendo de cima
  s = waitFor(x => x.fase === 'dig');
  setGrab(G.world.tools.pick.getWorldPosition(new THREE.Vector3()));
  G.shell.hooks.squeezeStart(entry);
  dev.advance(0.05);
  const pc = hiddenCell();
  const cp = G.world.cellPos(pc, new THREE.Vector3());
  const pickAt = (y) => { const tip = G.world.tools.pick.userData.tip.getWorldPosition(new THREE.Vector3()); const grip = G.shell.grabPoint(entry, new THREE.Vector3()); const off = grip.clone().sub(tip); setGrab(new THREE.Vector3(cp.x, y, cp.z).add(off)); dev.advance(1 / 60); };
  for (let k = 0; k < 4; k++) pickAt(SAND_Y + 0.15);
  for (let k = 0; k <= 8; k++) pickAt(SAND_Y + 0.15 - k * 0.022);
  ok(G.game.open[pc] > 0, 'VR: bater a picareta de cima abre a casa (e as vizinhas)');
  G.shell.hooks.squeezeEnd(entry);
  entry.source = null; entry.side = null;

  // o resto da partida o robô joga
  dev.autoplay = true;
  s = waitFor(x => !!x.vencedor, 4000);
  ok(s.vencedor && s.completos === s.esqueletos, `partida terminou com os 6 esqueletos (vencedor: ${s.vencedor}, ${s.pontos.join(' x ')})`);
  ok(JSON.parse(store.get('fossilvr.v1') || '{"games":[]}').games[0] === 1, 'resultado salvo no localStorage');

  // Desafios pelo mesmo caminho do menu
  const C = await import('../js/challenges.js');
  const stars = [];
  for (let n = 1; n <= C.CHALLENGES.length; n++) {
    dev.loadLevel(n);
    s = waitFor(x => x.estrelas != null, 1000);
    stars.push(s.estrelas);
  }
  ok(stars.every(x => x === 3), `robô tira 3 estrelas nos ${C.CHALLENGES.length} desafios dentro do jogo (${stars.join(' ')})`);
  dev.autoplay = false;
  dev.loadLevel(3);
  win.dispatch('keydown', { key: '2' });
  ok(dev.state().ferramenta === 'brush', 'desafio "Só pincel" não deixa pegar a picareta');
  s = dev.win();
  ok(s.estrelas === 3, 'dev.win() resolve o desafio');
  dev.startMatch(2);
  s = dev.win();
  ok(s.vencedor === 'você', 'dev.win() ganha a partida');

  dev.startMatch(3);
  dev.advance(0.2);
  win.dispatch('keydown', { key: 'Escape' });
  ok(dev.state().tela === 'paused', 'Esc pausa');
  win.dispatch('keydown', { key: 'Escape' });
  ok(dev.state().tela === 'play', 'Esc de novo continua');
  const loop = G.renderer._loop;
  for (let i = 0; i < 5; i++) loop?.(performance.now() + i * 16);
  ok(typeof loop === 'function', 'laço de animação ligado');
  console.error = origErr;
  ok(errors.length === 0, `sem erros no console (${errors.slice(0, 2).join(' | ')})`);
  return out;
}
