// Liga as regras do Fóssil à cena, ao Quest (ferramentas na mão) e ao mouse/teclado.
import * as THREE from '../vendor/three/three.module.js';
import { PLAYER, CPU, SPECIES, makeSite, newGame, dig, legal, area, publicView, winner, heat, rng } from './rules.js';
import { OPPONENTS, ROBOT, chooseDig } from './ai.js';
import { CHALLENGES, setupChallenge, finished, failed, starsFor, goalText, robotDig } from './challenges.js';
import { buildWorld, TRAY, SAND_Y, SOIL_Y, CELL, TEAMC } from './scene.js';
import { createShell } from './shell.js';
import { setTheme } from './ui.js';
import { Sfx } from './audio.js';
import { loadSave, storeSave } from './save.js';

setTheme({
  bg: 'rgba(250,240,220,0.97)', edge: '#a8542a', text: '#3a2414', dim: '#86684a', btn: '#f0dcb8', btnHover: '#ffc85a',
  btnOn: '#a8542a', btnOnText: '#ffffff', lock: '#e8dcc6', star: '#e8a020', labelBg: 'rgba(42,58,46,0.96)',
  title: 'bold 60px Georgia, serif',
});

const save = loadSave();
const sfx = new Sfx();
sfx.on = save.sound;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const GRAB_DIST = 0.09;
const BRUSH_NEED = 0.22;     // metros de pincelada para tirar a terra de uma casa
const STAND = { x: 0, z: 0.0 };

const shell = createShell({ scene: new THREE.Scene(), sfx, save, storeSave, stand: STAND, exposure: 1.0, statusPos: new THREE.Vector3(0.62, 1.45, TRAY.z - 0.3), statusWidth: 0.6, shadows: true, hooks: {} });
const world = buildWorld(shell.renderer);
const { scene } = world;
{ const old = shell.scene; for (const o of [...old.children]) scene.add(o); shell.scene = scene; shell.render = () => shell.renderer.render(scene, shell.camera); }
const { renderer, camera, panel } = shell;
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = 1.05;
shell.statusLabel.mesh.rotation.set(-0.1, -0.5, 0);
shell.orbit.target.set(TRAY.x, SAND_Y + 0.05, TRAY.z - 0.1);
shell.orbit.dist = 1.25; shell.orbit.pitch = 0.8; shell.orbit.yaw = 0; shell.orbit.keys = 'none';
shell.orbit.minPitch = 0.3; shell.orbit.maxPitch = 1.45; shell.orbit.minDist = 0.45; shell.orbit.maxDist = 2.2;
const menuCam = (t) => ({ pos: new THREE.Vector3(Math.sin(t * 0.12) * 1.6, 1.5, TRAY.z + Math.cos(t * 0.12) * 1.6), look: new THREE.Vector3(TRAY.x, 0.9, TRAY.z) });

// ---------- Estado ----------
let app = 'menu', mode = 'match', g = null, ch = null, oppIndex = 0, phase = 'idle';
let time = 0, msg = null, random = rng((Date.now() % 100000) + 1), chResult = null, timerAuto = 0;
let tool = 'brush';
let busy = null;           // animação de escavação do PC/IA: { t, dur, i, tool, who }
let held = null;           // VR: { entry, kind, last: Vector3, acc, cell, armed }
let hover = -1;
const timers = [];
const later = (sec, fn) => timers.push({ at: time + sec, fn });
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion();
const opponent = () => OPPONENTS[oppIndex];
const isMatch = () => mode === 'match';

function loadGame(game) {
  g = game;
  world.setSite(g.site);
  for (let i = 0; i < g.open.length; i++) if (g.open[i]) revealCell(i, true);
  busy = null; held = null; hover = -1; timers.length = 0;
  resetTools();
}
function revealCell(i, instant = false) {
  const o = g.open[i];
  if (o === 1) world.reveal(i, 'dirt', { n: heat(g.site, i), instant });
  else if (o >= 2) world.reveal(i, o === 2 ? 'bone' : 'broken', { species: g.site.skeletons[g.site.bone[i]].kind, owner: g.owner[i], instant });
}
function newMatch(i) {
  mode = 'match';
  oppIndex = clamp(i, 0, OPPONENTS.length - 1);
  const site = makeSite({ random });
  loadGame(newGame(site, { starter: random() < 0.5 ? PLAYER : CPU }));
  ch = null;
  world.rival.visible = true; world.rival.userData.setColor(TEAMC[1]);
  startPlay();
  msg = { text: g.turn === PLAYER ? 'Sorteio: você começa.' : `Sorteio: ${opponent().name} começa.`, t: 3.5 };
  beginTurn();
}
function newChallenge(i, skipIntro = false) {
  mode = 'challenge';
  const k = clamp(i, 0, CHALLENGES.length - 1);
  ch = { i: k, c: CHALLENGES[k] };
  loadGame(setupChallenge(ch.c));
  world.rival.visible = false;
  chResult = null;
  startPlay();
  if (ch.c.noPick) tool = 'brush';
  if (skipIntro || dev.autoplay) beginTurn();
  else { phase = 'intro'; showScreen('chIntro'); }
}
function startPlay() {
  app = 'play'; shell.hidePanel();
  shell.orbit.menu = null; shell.orbit.snap = true;
  if (shell.vr && !rigPlaced) { shell.recenter(); rigPlaced = true; }
}
let rigPlaced = false;

function beginTurn() {
  if (isMatch() ? g.over : finished(ch.c, g)) return endGame();
  if (!isMatch() || g.turn === PLAYER) {
    phase = 'dig';
    world.rival.userData.st.think = false;
    if (!msg || msg.t > 20) msg = { text: 'Sua vez: escolha a ferramenta e cave uma casa.', t: 30 };
  } else {
    phase = 'think';
    world.rival.userData.st.think = true;
    later(opponent().think, () => {
      if (phase !== 'think') return;
      const d = chooseDig(publicView(g), opponent(), random);
      startDigAnim(d.i, d.tool, CPU);
    });
  }
  updateHint();
}
function startDigAnim(i, t, who) {
  phase = 'anim';
  busy = { t: 0, dur: t === 'brush' ? 0.7 : 0.4, i, tool: t, who };
  if (who === CPU) { world.rival.userData.st.dig = busy.dur; world.rival.userData.st.think = false; }
  if (t === 'brush') sfx.brushStart(); else sfx.swing();
}
// Escava de verdade e mostra o resultado.
function doDig(i, t) {
  const who = isMatch() ? g.turn : PLAYER;
  const r = dig(g, i, t);
  if (!r) return false;
  for (const c of r.opened) revealCell(c);
  const p = world.cellPos(i, new THREE.Vector3()); p.y = SAND_Y;
  world.dust(p, t === 'pick' ? 0.12 : 0.07, t === 'pick' ? 6 : 3);
  if (t === 'pick') sfx.pick(); else sfx.brush();
  const name = who === PLAYER ? 'Você' : opponent().name;
  const intact = r.found.filter(f => !f.broken).length, broken = r.found.filter(f => f.broken).length;
  if (broken) { later(0.15, () => sfx.crack()); shell.pulseAll(0.5, 60); }
  if (intact) later(0.2, () => sfx.bone());
  if (intact && broken) msg = { text: `${name} achou ${intact} osso(s) e quebrou ${broken}.`, t: 3 };
  else if (intact) msg = { text: r.again ? `${name} achou osso! Cava de novo.` : `${name} achou osso!`, t: 3 };
  else if (broken) msg = { text: `${name} quebrou ${broken} osso(s) com a picareta: -${broken}.`, t: 3 };
  else msg = null;
  for (const c of r.completed) {
    const s = g.site.skeletons[c.id];
    world.glowSkeleton(s.cells, c.to);
    later(0.5, () => sfx.complete());
    const toName = c.to === PLAYER ? 'você' : c.to === CPU ? opponent().name : 'ninguém (todo quebrado)';
    msg = { text: `${SPECIES[c.kind].name} completo! +${c.bonus} para ${toName}.`, t: 4 };
    if (c.to === CPU && isMatch()) world.rival.userData.st.mood = 1.5;
  }
  if (!isMatch() && failed(ch.c, g)) msg = { text: 'Quebrou um osso: desafio perdido.', t: 4 };
  phase = 'wait';
  later(0.5, () => beginTurn());
  updateHint();
  return true;
}
function endGame() {
  phase = 'over';
  world.rival.userData.st.think = false;
  if (isMatch()) {
    save.games[oppIndex]++;
    const w = winner(g);
    if (w === PLAYER) { save.wins[oppIndex]++; sfx.fanfare(); } else if (w === CPU) { sfx.bad(); world.rival.userData.st.mood = 3; }
    storeSave(save);
    later(1.2, () => { if (app === 'play' && phase === 'over') showScreen('over'); });
  } else {
    const stars = starsFor(ch.c, g);
    chResult = { stars, n: g.actions[PLAYER], failed: failed(ch.c, g) };
    save.ch[ch.i] = Math.max(save.ch[ch.i] || 0, stars);
    storeSave(save);
    for (let k = 0; k < stars; k++) later(0.3 + 0.25 * k, () => sfx.star(k));
    if (stars === 3) later(1.1, () => sfx.fanfare());
    later(1.0, () => { if (app === 'play' && phase === 'over') showScreen('chResult'); });
  }
  timerAuto = 3;
  updateHint();
}
function goMenu() {
  app = 'menu'; phase = 'idle';
  shell.orbit.menu = menuCam; shell.orbit.snap = true;
  mode = 'match'; ch = null;
  const demo = newGame(makeSite({ random: rng(4) }));
  for (let i = 0; i < demo.open.length; i++) if (rng(i + 9)() < 0.4) { demo.open[i] = demo.site.bone[i] >= 0 ? 2 : 1; demo.owner[i] = i % 2; }
  loadGame(demo);
  world.rival.visible = true;
  if (shell.vr) shell.recenter();
  showScreen('main');
  updateHint();
}
function togglePause() {
  if (app === 'play' && !panel.visible) { app = 'paused'; dropHeld(); showScreen('pause'); }
  else if (app === 'paused') { app = 'play'; shell.hidePanel(); }
  updateHint();
}

// ---------- Menus ----------
const challengeUnlocked = (i) => i === 0 || (save.ch[i - 1] || 0) >= 1;
function showScreen(name) {
  const vr = shell.vr;
  shell.showPanel((p) => {
    if (name === 'main') {
      p.title('Fóssil', 72);
      p.text('Escavação por turnos: ache os ossos antes do outro paleontólogo', 512, 130, { size: 26, color: '#86684a' });
      p.button('Partida contra o computador', () => showScreen('opponents'), 212, 172, 600, 92, { size: 36 });
      p.button('Desafios', () => showScreen('challenges'), 212, 280, 600, 80);
      p.button('Como jogar', () => showScreen('help'), 212, 376, 600, 80);
      p.button(`Som: ${save.sound ? 'sim' : 'não'}`, () => { save.sound = !save.sound; sfx.setOn(save.sound); storeSave(save); showScreen('main'); }, 212, 474, 290, 66, { size: 26 });
      p.button(`FPS: ${save.fps ? 'sim' : 'não'}`, () => { save.fps = !save.fps; storeSave(save); showScreen('main'); }, 522, 474, 290, 66, { size: 26 });
      const stars = Object.values(save.ch).reduce((a, b) => a + b, 0);
      p.text(`Vitórias: ${save.wins.reduce((a, b) => a + b, 0)}   ·   Estrelas nos desafios: ${stars} de ${CHALLENGES.length * 3}`, 512, 594, { size: 26, color: '#a8542a' });
      p.text(vr ? 'Aponte com o controle e aperte o gatilho' : 'No Quest: abra esta página no navegador do óculos e aperte "Entrar em VR"', 512, 656, { size: 22, color: '#86684a' });
    } else if (name === 'opponents') {
      p.title('Escolha o colega', 62);
      OPPONENTS.forEach((o, i) => p.button(`${o.name}  ·  ${o.title}`, () => newMatch(i), 72, 116 + i * 156, 880, 136, { size: 34, sub: o.desc }));
      p.text(`Vitórias: ${save.wins.join(' / ')}`, 512, 600, { size: 24, color: '#86684a' });
      p.button('Voltar', () => showScreen('main'), 362, 632, 300, 66, { size: 28 });
    } else if (name === 'challenges') {
      p.title('Desafios', 56);
      CHALLENGES.forEach((c, i) => p.tile(52 + (i % 5) * 186, 110 + Math.floor(i / 5) * 200, 172, 176, { num: i + 1, name: c.name, stars: save.ch[i] || 0, done: save.ch[i] != null, locked: !challengeUnlocked(i), action: () => newChallenge(i) }));
      p.text('Passe um desafio (1 estrela) para liberar o próximo.', 512, 540, { size: 24, color: '#86684a' });
      p.button('Voltar', () => showScreen(app === 'paused' ? 'pause' : 'main'), 362, 600, 300, 70, { size: 30 });
    } else if (name === 'help') {
      p.title('Como jogar', 60);
      const rows = [
        'Debaixo da areia há 6 esqueletos. Na sua vez, cave uma casa.',
        'Terra vazia mostra um número: quantos ossos há nas 8 casas em volta.',
        'Pincel: 1 casa, osso sai inteiro (+1) e você cava de novo.',
        'Picareta: a casa e as 4 vizinhas de uma vez, mas osso que ela pega quebra (-1).',
        'Esqueleto completo: + o tamanho dele para quem tem mais peças inteiras.',
        'Os esqueletos nunca encostam de lado um no outro.',
        vr ? 'VR: pegue o pincel e esfregue a casa; pegue a picareta e bata.' : 'PC: 1 = pincel, 2 = picareta, clique na casa. Botão direito: câmera.',
        vr ? 'Ou raio + gatilho na casa com a ferramenta escolhida. B ou Y: pausa.' : 'Esc: pausa. Roda: zoom.',
      ];
      rows.forEach((t, i) => p.text(t, 40, 124 + i * 54, { size: 23, align: 'left' }));
      p.button('Voltar', () => showScreen(app === 'paused' ? 'pause' : 'main'), 362, 586, 300, 80);
    } else if (name === 'pause') {
      p.title('Pausa', 66);
      p.text(isMatch() ? `Contra ${opponent().name} · você ${g.score[0]} x ${g.score[1]}` : `Desafio ${ch.i + 1}: ${ch.c.name}`, 512, 130, { size: 28, color: '#86684a' });
      p.button('Continuar', () => togglePause(), 262, 176, 500, 84);
      p.button(isMatch() ? 'Recomeçar a partida' : 'Recomeçar o desafio', () => (isMatch() ? newMatch(oppIndex) : newChallenge(ch.i, true)), 262, 276, 500, 84);
      p.button('Como jogar', () => showScreen('help'), 262, 376, 245, 84, { size: 30 });
      p.button('Recentralizar', () => { togglePause(); shell.recenter(); }, 517, 376, 245, 84, { size: 30, locked: !vr });
      p.button('Menu principal', () => goMenu(), 262, 476, 500, 84);
    } else if (name === 'over') {
      const w = winner(g);
      p.title(w === PLAYER ? 'Você venceu!' : w === CPU ? `${opponent().name} venceu` : 'Empate!', 72);
      p.text(`Você ${g.score[0]} x ${g.score[1]} ${opponent().name}`, 512, 150, { size: 40, bold: true });
      const mine = g.bonusTo.filter(x => x === PLAYER).length, his = g.bonusTo.filter(x => x === CPU).length;
      p.text(`Esqueletos: você ${mine} x ${his} · ossos quebrados: ${g.broken}`, 512, 210, { size: 28, color: '#86684a' });
      p.text(`Contra ${opponent().name}: ${save.wins[oppIndex]} vitória(s) em ${save.games[oppIndex]} partida(s)`, 512, 258, { size: 24, color: '#86684a' });
      p.button('Jogar de novo', () => newMatch(oppIndex), 262, 310, 500, 92, { size: 36 });
      p.button('Outro colega', () => showScreen('opponents'), 262, 420, 500, 80);
      p.button('Menu principal', () => goMenu(), 262, 520, 500, 80);
    } else if (name === 'chIntro') {
      const c = ch.c;
      p.title(`Desafio ${ch.i + 1}: ${c.name}`, 66);
      p.text(c.desc, 512, 150, { size: 26 });
      p.text(`Sítio ${c.W} x ${c.H} · ${c.set.map(k => SPECIES[k].short).join(', ')}`, 512, 200, { size: 25, color: '#86684a' });
      p.text(goalText(c), 512, 252, { size: 23, color: '#a8542a' });
      p.button('Começar', () => { shell.hidePanel(); beginTurn(); }, 262, 320, 500, 96, { size: 38 });
      p.button('Desafios', () => showScreen('challenges'), 262, 440, 500, 80);
    } else if (name === 'chResult') {
      const c = ch.c;
      p.title(chResult.failed ? 'Osso quebrado!' : chResult.stars ? 'Sítio escavado!' : 'Não foi dessa vez', 66);
      p.stars(chResult.stars, 512, 160, 80);
      p.text(chResult.failed ? 'Neste desafio não pode quebrar nenhum osso.' : `Escavações: ${chResult.n}`, 512, 232, { size: 30, bold: true });
      p.text(goalText(c), 512, 276, { size: 22, color: '#86684a' });
      p.text(`Melhor: ${save.ch[ch.i] || 0} estrela(s)`, 512, 314, { size: 24 });
      p.button('Tentar de novo', () => newChallenge(ch.i, true), 262, 350, 245, 84, { size: 30 });
      p.button('Próximo', () => newChallenge(ch.i + 1), 517, 350, 245, 84, { size: 30, locked: ch.i >= CHALLENGES.length - 1 || !challengeUnlocked(ch.i + 1) });
      p.button('Desafios', () => showScreen('challenges'), 262, 454, 500, 80);
      p.button('Menu principal', () => goMenu(), 262, 554, 500, 80);
    }
  });
  updateHint();
}

// ---------- Entrada ----------
const canDig = () => app === 'play' && phase === 'dig' && !panel.visible && !dev.autoplay;
const pickAllowed = () => !(mode === 'challenge' && ch.c.noPick);
function setTool(t) {
  if (t === 'pick' && !pickAllowed()) { sfx.deny(); msg = { text: 'Neste desafio a picareta ficou no acampamento.', t: 2.5 }; return; }
  if (tool !== t) sfx.click();
  tool = t;
}
function clickDig(i) {
  if (!canDig() || i < 0 || !legal(g, i, tool)) return false;
  startDigAnim(i, tool, PLAYER);
  return true;
}
function cellFromRay(rc) { const h = rc.intersectObject(world.pickPlane, false)[0]; return h ? world.cellOf(h.point) : -1; }
function toolFromRay(rc) {
  const h = rc.intersectObjects([world.tools.brush, world.tools.pick], true)[0];
  if (!h) return null;
  let o = h.object; while (o && !o.userData.kind) o = o.parent;
  return o?.userData.kind || null;
}
function resetTools() {
  for (const k of ['brush', 'pick']) { const t = world.tools[k]; t.position.copy(world.toolHome[k]); t.rotation.set(0, 0, Math.PI / 2); }
}
function tryGrab(e) {
  const p = shell.grabPoint(e);
  for (const k of ['brush', 'pick']) {
    world.tools[k].getWorldPosition(_v);
    if (_v.distanceTo(p) < GRAB_DIST * 1.4 && !(held && held.kind === k)) {
      if (k === 'pick' && !pickAllowed()) { setTool('pick'); return true; }
      held = { entry: e, kind: k, last: null, acc: 0, cell: -1, armed: true };
      setTool(k); sfx.pickUp(); shell.pulse(e, 0.3, 20);
      return true;
    }
  }
  return false;
}
function releaseHeld() {
  if (!held) return;
  const k = held.kind; held = null;
  const t = world.tools[k]; t.position.copy(world.toolHome[k]); t.rotation.set(0, 0, Math.PI / 2);
  for (const o of world.cellObjs) if (o.prog > 0 && o.prog < 1) o.prog = 0;
}
function dropHeld() { if (held) releaseHeld(); }
const _tip = new THREE.Vector3();
function updateHeld(dt) {
  if (!held) return;
  const e = held.entry;
  const t = world.tools[held.kind];
  const p = shell.grabPoint(e, new THREE.Vector3());
  e.grip.getWorldQuaternion(_q);
  t.position.copy(p);
  t.quaternion.copy(_q).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(held.kind === 'brush' ? -Math.PI / 2 : -Math.PI / 2, 0, held.kind === 'pick' ? Math.PI / 2 : 0)));
  t.updateMatrixWorld(true);
  t.userData.tip.getWorldPosition(_tip);
  const i = world.cellOf(_tip);
  if (held.kind === 'brush') {
    if (canDig() && i >= 0 && g.open[i] === 0 && _tip.y < SAND_Y + 0.03 && _tip.y > SOIL_Y - 0.02) {
      if (held.cell !== i) { if (held.cell >= 0 && world.cellObjs[held.cell].prog < 1) world.cellObjs[held.cell].prog = 0; held.cell = i; held.acc = 0; }
      if (held.last) {
        const d = Math.hypot(_tip.x - held.last.x, _tip.z - held.last.z);
        if (d < 0.05) held.acc += d;
        world.cellObjs[i].prog = Math.min(0.99, held.acc / BRUSH_NEED);
        if (d > 0.002 && Math.random() < 0.3) { sfx.brushTick(); shell.pulse(e, 0.08, 10); }
        if (held.acc >= BRUSH_NEED) { held.acc = 0; held.cell = -1; world.cellObjs[i].prog = 0; doDig(i, 'brush'); }
      }
    } else if (held.cell >= 0) { if (world.cellObjs[held.cell].prog < 1) world.cellObjs[held.cell].prog = 0; held.cell = -1; held.acc = 0; }
  } else {
    const vy = held.last ? (_tip.y - held.last.y) / Math.max(dt, 1e-3) : 0;
    if (_tip.y > SAND_Y + 0.05) held.armed = true;
    if (held.armed && canDig() && i >= 0 && g.open[i] === 0 && _tip.y < SAND_Y + 0.005 && vy < -0.8) {
      held.armed = false; shell.pulse(e, 0.8, 50); doDig(i, 'pick');
    }
  }
  held.last = _tip.clone();
  world.highlight(i >= 0 && g.open[i] === 0 ? area(g.site, i, held.kind).filter(c => g.open[c] === 0) : [], held.kind === 'pick' ? 0xff9a5a : 0xffffff);
}

const hooks = {
  tick,
  pause: () => togglePause(),
  button: (e, k) => { if (k === 4) setTool(tool === 'brush' ? 'pick' : 'brush'); },
  squeezeStart: (e) => { tryGrab(e); },
  squeezeEnd: (e) => { if (held?.entry === e) releaseHeld(); },
  selectStart: (e) => {
    if (e.isHand && tryGrab(e)) return;
    const rc = shell.entryRay(e);
    const tk = toolFromRay(rc);
    if (tk) { setTool(tk); return; }
    clickDig(cellFromRay(shell.entryRay(e)));
  },
  selectEnd: (e) => { if (e.isHand && held?.entry === e) releaseHeld(); },
  disconnected: (e) => { if (held?.entry === e) dropHeld(); },
  sessionStart: () => { rigPlaced = false; updateHint(); },
  sessionEnd: () => { dropHeld(); updateHint(); },
  pointerDown: () => {
    const tk = toolFromRay(shell.mouseRay());
    if (tk) { setTool(tk); return; }
    clickDig(cellFromRay(shell.mouseRay()));
  },
  key: (k) => {
    if (k === '1') { setTool('brush'); return true; }
    if (k === '2') { setTool('pick'); return true; }
    return false;
  },
};
Object.assign(shell.hooks, hooks);

// ---------- HUD ----------
function updateHint() {
  let t;
  if (app !== 'play' || panel.visible) t = 'Clique nas opções do painel';
  else if (phase === 'dig') t = `Ferramenta: ${tool === 'brush' ? 'PINCEL' : 'PICARETA'} (1 pincel, 2 picareta) · clique numa casa de areia · botão direito: câmera · Esc: pausa`;
  else t = 'Botão direito arrastando: câmera · roda: zoom · Esc: pausa';
  shell.setHint(t);
}
function statusLines() {
  if (!isMatch()) return { a: `Desafio ${ch.i + 1}: ${ch.c.name} · escavações ${g.actions[0]} (meta ${ch.c.par[0]}) · ferramenta: ${tool === 'brush' ? 'pincel' : 'picareta'}`, b: ch.c.desc };
  const o = opponent();
  return { a: `Você ${g.score[0]} x ${g.score[1]} ${o.name} · ${g.turn === PLAYER ? 'sua vez' : `vez de ${o.name}`} · ferramenta: ${tool === 'brush' ? 'pincel' : 'picareta'}`, b: phase === 'think' ? `${o.name} está pensando...` : '' };
}
let boardKey = '';
function updateBoard() {
  if (!g) return;
  const lines = [];
  if (isMatch() && app !== 'menu') lines.push({ text: `Você ${g.score[0]}  x  ${g.score[1]} ${opponent().name}`, size: 0.14, color: '#ffe8a0' });
  else if (ch) lines.push({ text: `Desafio ${ch.i + 1}: ${g.actions[0]} escavações`, size: 0.13, color: '#ffe8a0' });
  else lines.push({ text: 'Sítio de escavação', size: 0.14, color: '#ffe8a0' });
  for (const s of g.site.skeletons) {
    const got = s.cells.filter(c => g.open[c] >= 2).length;
    const to = g.bonusTo[s.id];
    lines.push({ text: `${SPECIES[s.kind].short}: ${got}/${s.cells.length}${g.done[s.id] ? (to === 0 ? '  ✓ seu' : to === 1 ? '  ✓ dele' : '  ✓') : ''}`, size: 0.11, color: g.done[s.id] ? (to === 0 ? '#8ac8ff' : to === 1 ? '#ffb070' : '#dddddd') : SPECIES[s.kind].color, bold: false });
  }
  const key = JSON.stringify(lines);
  if (key !== boardKey) { boardKey = key; world.drawBoard(lines); }
}

// ---------- Laço ----------
let robotT = 0;
function tick(dt) {
  const paused = app === 'paused';
  if (!paused) {
    time += dt;
    for (let i = 0; i < timers.length; i++) if (timers[i].at <= time) { const t = timers.splice(i, 1)[0]; i--; t.fn(); }
  }
  if (app === 'play' && !paused) {
    if (busy) {
      busy.t += dt;
      const o = world.cellObjs[busy.i];
      if (busy.tool === 'brush') o.prog = Math.min(0.99, busy.t / busy.dur);
      animateTool(busy);
      if (busy.t >= busy.dur) { const b = busy; busy = null; o.prog = 0; resetTools(); doDig(b.i, b.tool); }
    } else if (phase === 'dig' && dev.autoplay) {
      robotT += dt;
      if (robotT > ROBOT.think) { robotT = 0; const d = isMatch() ? chooseDig(publicView(g), ROBOT, random) : robotDig(ch.c, g); tool = d.tool; startDigAnim(d.i, d.tool, PLAYER); }
    } else if (phase === 'over' && dev.autoplay && isMatch()) { timerAuto -= dt; if (timerAuto <= 0) newMatch(oppIndex); }
  }
  updateHeld(dt);
  if (!held && app === 'play') {
    if (!shell.vr) hover = canDig() ? cellFromRay(shell.mouseRay()) : -1;
    else { hover = -1; for (const e of shell.ctrls) if (e.source && !e.isHand) { const c = cellFromRay(shell.entryRay(e)); if (c >= 0) { hover = c; break; } } }
    world.highlight(hover >= 0 && g.open[hover] === 0 && canDig() ? area(g.site, hover, tool).filter(c => g.open[c] === 0) : [], tool === 'pick' ? 0xff9a5a : 0xffffff);
  } else if (app !== 'play') world.highlight([]);
  // anel na ferramenta escolhida
  world.toolRing.visible = app === 'play' && !held;
  world.tools[tool].getWorldPosition(world.toolRing.position);
  if (shell.vr && app === 'play') for (const e of shell.ctrls) { if (!e.source) continue; const h = shell.entryRay(e).intersectObject(world.pickPlane, false)[0]; if (h) e.laserLen = h.distance; }
  shell.showPinch = app === 'play';
  camera.getWorldQuaternion(_q); world.faceCamera(_q);
  world.animate(dt, time);
  if (msg) { msg.t -= dt; if (msg.t <= 0) msg = null; }
  shell.setStatus(app === 'play' && g ? { ...statusLines(), msg: msg?.text } : null);
  updateBoard();
}
// PC e IA: a ferramenta voa até a casa e faz o movimento
function animateTool(b) {
  if (b.who === CPU && isMatch()) return;   // o colega cava com a mão dele
  const t = world.tools[b.tool];
  const p = world.cellPos(b.i, new THREE.Vector3());
  const k = b.t / b.dur;
  if (b.tool === 'brush') {
    t.position.set(p.x + Math.sin(k * 26) * CELL * 0.3, SAND_Y + 0.05, p.z);
    t.rotation.set(0, 0, Math.sin(k * 26) * 0.3);
  } else {
    const sw = k < 0.6 ? k / 0.6 : 1;
    t.position.set(p.x - 0.09, SAND_Y + 0.12 - sw * 0.06, p.z);
    t.rotation.set(0, 0, -0.9 + sw * 1.6);
  }
}

// ---------- Depuração (console do navegador) ----------
// dev.autoplay = true   o robô joga por você      dev.advance(5)  avança 5 s na hora
// dev.state()           resumo                    dev.loadLevel(3) abre o desafio 3 (1 a 10)
// dev.startMatch(2)     partida contra o 2 (1 a 3) dev.dig(i, 'brush'|'pick')  cava (com animação)
// dev.win()             ganha partida/desafio      dev.cheat() mostra os ossos   dev.screenOf(i)
const dev = {
  _auto: false,
  get autoplay() { return this._auto; },
  set autoplay(v) { this._auto = !!v; dropHeld(); },
  loadLevel(n) { newChallenge(n - 1, true); return this.state(); },
  startMatch(n = 1) { newMatch(n - 1); return this.state(); },
  advance(sec, stepT = 1 / 60) {
    const frames = Math.round(sec / stepT);
    for (let i = 0; i < frames; i++) shell.step(stepT);
    shell.resetClock(); shell.render();
    return this.state();
  },
  dig(i, t = tool) { setTool(t); clickDig(i); return this.state(); },
  cheat() { return g ? [...g.site.bone].map((b, i) => (b >= 0 ? i : -1)).filter(i => i >= 0) : null; },
  win() {
    if (!g) return this.state();
    timers.length = 0; busy = null;
    if (isMatch()) {
      while (!g.over) { const d = g.turn === PLAYER ? chooseDig(publicView(g), ROBOT, random) : chooseDig(publicView(g), opponent(), random); if (g.turn === CPU) { g.turn = PLAYER; continue; } dig(g, d.i, d.tool); }
      if (g.score[0] <= g.score[1]) g.score[0] = g.score[1] + 1;
    } else { while (!finished(ch.c, g)) { const d = robotDig(ch.c, g); dig(g, d.i, d.tool); } }
    loadGame(g);
    endGame();
    return this.state();
  },
  screenOf(i) {
    const o = world.cellPos(i, new THREE.Vector3()); o.y = SAND_Y;
    const p = o.project(camera);
    return { x: (p.x + 1) / 2 * window.innerWidth, y: (1 - p.y) / 2 * window.innerHeight };
  },
  state() {
    const base = { tela: app, modo: mode, fase: phase, painel: panel.visible };
    if (!g || app === 'menu') return base;
    return {
      ...base, adversario: isMatch() ? opponent().name : null, desafio: ch ? `${ch.i + 1}: ${ch.c.name}` : null,
      vez: !isMatch() || g.turn === PLAYER ? 'você' : 'computador', ferramenta: tool, pontos: g.score.slice(), acoes: g.actions.slice(),
      abertas: [...g.open].filter(Boolean).length, quebrados: g.broken, completos: g.done.filter(Boolean).length, esqueletos: g.done.length,
      estrelas: !isMatch() && chResult ? chResult.stars : null,
      vencedor: isMatch() && g.over && phase === 'over' ? (winner(g) === PLAYER ? 'você' : winner(g) === CPU ? opponent().name : 'empate') : null,
      salvo: { vitorias: save.wins, desafios: save.ch },
    };
  },
  resetSave() { save.wins = [0, 0, 0]; save.games = [0, 0, 0]; save.ch = {}; storeSave(save); },
};
window.dev = dev;
window.fossil = { dev, get game() { return g; }, get challenge() { return ch; }, save, camera, scene, renderer, world, shell };

goMenu();
shell.start();
