// Regras do Fóssil, sem navegador. Um sítio em grade esconde esqueletos (peças em forma de
// poliminó). Na vez, o jogador escava com o pincel (1 casa, osso sai inteiro: +1, e cava de novo)
// ou com a picareta (a casa e as 4 vizinhas de uma vez, mas osso que ela pega quebra: -1).
// Casa sem osso mostra quantos ossos há nas 8 vizinhas. Esqueleto completo dá bônus a quem tem
// mais peças inteiras dele. Tudo determinístico (o acaso vem do rng passado de fora).

export const PLAYER = 0, CPU = 1;
export const PICK_PENALTY = 1;

// Esqueletos: nome, cor e a forma (casas relativas). A forma pode girar.
export const SPECIES = {
  trex: { name: 'Tiranossauro', short: 'T-rex', color: '#d8643a', cells: [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1], [1, 1]] },
  tricera: { name: 'Tricerátops', short: 'Tricerátops', color: '#3a8ad8', cells: [[0, 0], [1, 0], [2, 0], [1, 1], [0, 1]] },
  raptor: { name: 'Velocirraptor', short: 'Raptor', color: '#8a4ad8', cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
  ptero: { name: 'Pterossauro', short: 'Pterossauro', color: '#2aa88a', cells: [[0, 0], [1, 0], [2, 0], [1, 1]] },
  tartaruga: { name: 'Tartaruga', short: 'Tartaruga', color: '#a8a02a', cells: [[0, 0], [1, 0], [2, 0]] },
  amonite: { name: 'Amonite', short: 'Amonite', color: '#d84a8a', cells: [[0, 0], [1, 0]] },
};
export const MATCH_SET = ['trex', 'tricera', 'raptor', 'ptero', 'tartaruga', 'amonite'];

export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

// As 4 rotações (e o espelho) de uma forma, normalizadas.
const shapeCache = new Map();
export function orientations(kind) {
  if (shapeCache.has(kind)) return shapeCache.get(kind);
  const base = SPECIES[kind].cells;
  const out = [], seen = new Set();
  for (const mirror of [false, true]) for (let r = 0; r < 4; r++) {
    let c = base.map(([x, y]) => (mirror ? [-x, y] : [x, y]));
    for (let k = 0; k < r; k++) c = c.map(([x, y]) => [-y, x]);
    const mx = Math.min(...c.map(p => p[0])), my = Math.min(...c.map(p => p[1]));
    c = c.map(([x, y]) => [x - mx, y - my]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const key = JSON.stringify(c);
    if (!seen.has(key)) { seen.add(key); out.push(c); }
  }
  shapeCache.set(kind, out);
  return out;
}
// Todas as posições possíveis de uma espécie na grade.
export function placements(kind, W, H) {
  const out = [];
  for (const o of orientations(kind)) {
    const w = Math.max(...o.map(p => p[0])) + 1, h = Math.max(...o.map(p => p[1])) + 1;
    for (let y = 0; y + h <= H; y++) for (let x = 0; x + w <= W; x++) out.push(o.map(([a, b]) => (y + b) * W + x + a));
  }
  return out;
}

// Monta um sítio: esqueletos sem se sobrepor nem encostar de lado (para os números ajudarem).
export function makeSite({ W = 10, H = 8, set = MATCH_SET, random = Math.random, fixed = null }) {
  const bone = new Int16Array(W * H).fill(-1);   // índice do esqueleto em cada casa (-1 = terra)
  const skeletons = [];
  const place = (kind, cells) => { const id = skeletons.length; skeletons.push({ id, kind, cells }); for (const c of cells) bone[c] = id; };
  if (fixed) for (const f of fixed) place(f.kind, f.cells.map(([x, y]) => y * W + x));
  else {
    for (const kind of set) {
      const opts = placements(kind, W, H).filter(cells => cells.every(c => bone[c] < 0 && neighbors4(c, W, H).every(n => bone[n] < 0 || cells.includes(n))));
      if (!opts.length) return makeSite({ W, H, set, random });
      place(kind, opts[Math.floor(random() * opts.length)]);
    }
  }
  return { W, H, bone, skeletons };
}
export function neighbors4(i, W, H) {
  const x = i % W, y = Math.floor(i / W), out = [];
  if (x > 0) out.push(i - 1); if (x < W - 1) out.push(i + 1); if (y > 0) out.push(i - W); if (y < H - 1) out.push(i + W);
  return out;
}
export function neighbors8(i, W, H) {
  const x = i % W, y = Math.floor(i / W), out = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue;
    const xx = x + dx, yy = y + dy;
    if (xx >= 0 && yy >= 0 && xx < W && yy < H) out.push(yy * W + xx);
  }
  return out;
}
export const heat = (site, i) => neighbors8(i, site.W, site.H).filter(n => site.bone[n] >= 0).length;

// ---------- Jogo ----------
// cell state: 0 escondida, 1 terra aberta, 2 osso inteiro, 3 osso quebrado. owner: quem abriu.
export function newGame(site, { starter = PLAYER, players = 2 } = {}) {
  const N = site.W * site.H;
  return {
    site, players, turn: starter,
    open: new Uint8Array(N), owner: new Int8Array(N).fill(-1),
    score: [0, 0], intact: site.skeletons.map(() => [0, 0]), done: site.skeletons.map(() => false), bonusTo: site.skeletons.map(() => -1),
    actions: [0, 0], log: [], over: false, broken: 0,
  };
}
export function cloneGame(g) {
  return { ...g, open: g.open.slice(), owner: g.owner.slice(), score: g.score.slice(), intact: g.intact.map(a => a.slice()), done: g.done.slice(), bonusTo: g.bonusTo.slice(), actions: g.actions.slice(), log: g.log.slice() };
}
export function area(site, i, tool) { return tool === 'pick' ? [i, ...neighbors4(i, site.W, site.H)] : [i]; }
export function legal(g, i, tool) { return !g.over && i >= 0 && i < g.open.length && g.open[i] === 0 && (tool === 'brush' || tool === 'pick'); }

// Escava. Devolve { found: [...], again, completed: [...] }.
export function dig(g, i, tool) {
  if (!legal(g, i, tool)) return null;
  const who = g.turn, site = g.site;
  const found = [], opened = [];
  for (const c of area(site, i, tool)) {
    if (g.open[c]) continue;
    g.owner[c] = who;
    opened.push(c);
    const b = site.bone[c];
    if (b < 0) { g.open[c] = 1; continue; }
    if (tool === 'pick') { g.open[c] = 3; g.score[who] -= PICK_PENALTY; g.broken++; found.push({ c, b, broken: true }); }
    else { g.open[c] = 2; g.score[who] += 1; g.intact[b][who]++; found.push({ c, b, broken: false }); }
  }
  // esqueletos completos
  const completed = [];
  for (const s of site.skeletons) {
    if (g.done[s.id] || !s.cells.every(c => g.open[c] >= 2)) continue;
    g.done[s.id] = true;
    const [a, b] = g.intact[s.id];
    const to = a > b ? 0 : b > a ? 1 : who;
    const bonus = s.cells.length;
    if (a + b > 0) { g.score[to] += bonus; g.bonusTo[s.id] = to; }
    completed.push({ id: s.id, kind: s.kind, to: a + b > 0 ? to : -1, bonus: a + b > 0 ? bonus : 0 });
  }
  g.actions[who]++;
  const again = tool === 'brush' && found.some(f => !f.broken) && g.players === 2;
  g.log.push({ who, i, tool, found: found.length, again });
  if (g.done.every(Boolean)) g.over = true;
  else if (!again && g.players === 2) g.turn = 1 - who;
  return { found, again, completed, opened };
}
export const winner = (g) => (g.score[0] > g.score[1] ? PLAYER : g.score[1] > g.score[0] ? CPU : null);

// O que qualquer um pode ver (a IA só recebe isto).
export function publicView(g) {
  const site = g.site, N = site.W * site.H;
  const cells = [];
  for (let i = 0; i < N; i++) {
    const o = g.open[i];
    if (o === 0) cells.push({ s: 'hidden' });
    else if (o === 1) cells.push({ s: 'dirt', n: heat(site, i) });
    else cells.push({ s: o === 2 ? 'bone' : 'broken', b: site.bone[i] });
  }
  return { W: site.W, H: site.H, cells, kinds: site.skeletons.map(s => s.kind), done: g.done.slice(), score: g.score.slice(), turn: g.turn, intact: g.intact.map(a => a.slice()) };
}
