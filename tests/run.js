// Testes do Fóssil (node tests/run.js): regras, IA (sem espiar), IA contra IA, robô nos desafios e
// fumaça do jogo. Não toca som. Sai com código 1 se algo falhar (ou se passar de 200 s).
import * as R from '../js/rules.js';
import * as A from '../js/ai.js';
import * as C from '../js/challenges.js';

const T0 = Date.now();
const killer = setTimeout(() => { console.error('Demorou demais (200 s): abortado.'); process.exit(1); }, 200000);
let fails = 0, passes = 0;
const ok = (c, m) => { if (c) { passes++; console.log('  ok  ', m); } else { fails++; console.log('  FALHOU', m); } };
const { PLAYER, CPU } = R;

console.log('Regras');
{
  ok(R.orientations('trex').length === 8 && R.orientations('amonite').length === 2 && R.orientations('tartaruga').length === 2, 'formas giram e espelham sem repetir (T-rex 8, amonite 2)');
  let allOk = true;
  for (let s = 1; s <= 40; s++) {
    const site = R.makeSite({ random: R.rng(s) });
    const cells = site.skeletons.flatMap(k => k.cells);
    if (new Set(cells).size !== cells.length) allOk = false;
    for (const k of site.skeletons) for (const c of k.cells) for (const n of R.neighbors4(c, site.W, site.H)) if (site.bone[n] >= 0 && site.bone[n] !== k.id) allOk = false;
    if (site.skeletons.length !== 6 || cells.length !== 24) allOk = false;
  }
  ok(allOk, '40 sítios: 6 esqueletos, 24 ossos, sem sobrepor nem encostar de lado');
  // tartaruga em (1,1)-(3,1) num sítio 5 x 4
  const site = R.makeSite({ W: 5, H: 4, fixed: [{ kind: 'tartaruga', cells: [[1, 1], [2, 1], [3, 1]] }] });
  ok(R.heat(site, 0) === 1 && R.heat(site, 12) === 3 && R.heat(site, 19) === 0, 'número = ossos nas 8 vizinhas');
  const g = R.newGame(site, { starter: PLAYER });
  let r = R.dig(g, 0, 'brush');
  ok(r && g.open[0] === 1 && g.turn === CPU, 'pincel na terra: abre e passa a vez');
  ok(!R.dig(g, 0, 'brush'), 'não cava casa já aberta');
  r = R.dig(g, 6, 'brush');
  ok(r.again && g.score[CPU] === 1 && g.turn === CPU, 'pincel no osso: +1 e cava de novo');
  r = R.dig(g, 8, 'pick');
  ok(g.open[8] === 3 && g.open[7] === 3 && r.opened.length === 5, 'picareta: abre a casa e as 4 vizinhas; os ossos que pega quebram');
  ok(r.completed.length === 1 && g.bonusTo[0] === CPU && g.score[CPU] === 1 - 2 + 3, `esqueleto completo: bônus (3) para quem tem mais peças inteiras (placar ${g.score.join(' x ')})`);
  ok(g.over, 'todos os esqueletos completos: fim');
  const g2 = R.newGame(R.makeSite({ random: R.rng(3) }));
  const v = R.publicView(g2);
  ok(v.cells.every(c => c.s === 'hidden' && c.b === undefined), 'vista pública não mostra nada escondido');
}

console.log('IA');
{
  const site = R.makeSite({ random: R.rng(5) });
  const g = R.newGame(site, { starter: CPU });
  for (const o of A.OPPONENTS) {
    const t = Date.now();
    const d = A.chooseDig(R.publicView(g), o, R.rng(1));
    ok(R.legal(g, d.i, d.tool) && Date.now() - t < 100, `${o.name}: escavação válida em ${Date.now() - t} ms`);
  }
  // não espia: vistas iguais, sítios escondidos diferentes -> mesma decisão
  let same = true, compared = 0;
  for (let s = 1; s <= 40; s++) {
    const a = R.newGame(R.makeSite({ random: R.rng(s) })), b = R.newGame(R.makeSite({ random: R.rng(s + 500) }));
    for (let i = 0; i < 80; i += 3) if (a.site.bone[i] < 0 && b.site.bone[i] < 0 && R.heat(a.site, i) === R.heat(b.site, i)) { a.open[i] = 1; b.open[i] = 1; }
    const va = R.publicView(a), vb = R.publicView(b);
    if (JSON.stringify(va.cells) !== JSON.stringify(vb.cells)) continue;
    compared++;
    const da = A.chooseDig(va, A.OPPONENTS[2], R.rng(9)), db = A.chooseDig(vb, A.OPPONENTS[2], R.rng(9));
    if (da.i !== db.i || da.tool !== db.tool) same = false;
  }
  ok(same && compared > 3, `a IA não espia: mesma vista, mesma escolha (${compared} pares de sítios diferentes)`);
  // deduções
  const s2 = R.makeSite({ W: 6, H: 5, fixed: [{ kind: 'tartaruga', cells: [[2, 2], [3, 2], [4, 2]] }] });
  const g2 = R.newGame(s2);
  g2.open[0] = 1;
  g2.open[s2.W * 2 + 2] = 2;
  const view = R.publicView(g2);
  view.kinds = ['tartaruga']; view.done = [false];
  const p = A.probabilities(view);
  ok(p[1] === 0 && p[s2.W] === 0 && p[s2.W + 1] === 0, 'número 0: vizinhas sem osso');
  ok(p[s2.W * 2 + 3] > 0.3 && p[s2.W * 2 + 3] > p[s2.W * 4 + 5], `perto do osso achado a chance é maior (${p[s2.W * 2 + 3].toFixed(2)})`);
}

console.log('IA contra IA');
function duel(a, b, seed) {
  const rnd = R.rng(seed);
  const g = R.newGame(R.makeSite({ random: rnd }), { starter: seed % 2 });
  const S = [A.OPPONENTS[a], A.OPPONENTS[b]];
  let n = 0;
  while (!g.over && n++ < 300) { const d = A.chooseDig(R.publicView(g), S[g.turn], rnd); R.dig(g, d.i, d.tool); }
  return g;
}
for (const [a, b] of [[2, 0], [2, 1], [1, 0]]) {
  const w = [0, 0, 0]; const N = 16; let br = 0;
  for (let s = 1; s <= N; s++) { const g = duel(a, b, s * 13 + a); w[R.winner(g) ?? 2]++; br += g.broken; }
  ok(w[0] > w[1], `${A.OPPONENTS[a].name} ganha mais que perde de ${A.OPPONENTS[b].name} (${w[0]} x ${w[1]}, ${w[2]} empates, ${(br / N).toFixed(1)} ossos quebrados por partida)`);
}

console.log('Desafios (robô)');
for (const [i, c] of C.CHALLENGES.entries()) {
  const r = C.solve(c);
  ok(C.starsFor(c, r.g) === 3, `${i + 1}. ${c.name}: robô tira 3 estrelas com ${r.g.actions[0]} escavações (meta ${c.par[0]})`);
}
{
  const c = C.CHALLENGES[4];
  const g = C.setupChallenge(c);
  const bone = [...g.site.bone].findIndex(b => b >= 0);
  R.dig(g, bone, 'pick');
  ok(C.failed(c, g) && C.starsFor(c, g) === 0, '"Mão leve": quebrou osso, perdeu');
}

console.log('Fumaça do jogo (main.js no Node)');
{
  const { smoke } = await import('./smoke.js');
  const res = await smoke();
  for (const [c, m] of res) ok(c, m);
}

clearTimeout(killer);
console.log(`\n${passes} ok, ${fails} falha(s) em ${((Date.now() - T0) / 1000).toFixed(1)} s`);
if (fails) { console.log('Algo falhou.'); process.exit(1); }
console.log('Tudo certo');
process.exit(0);
