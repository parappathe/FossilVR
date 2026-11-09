// Adversários do Fóssil. A IA recebe só a vista pública (publicView): casas abertas, números e
// ossos à mostra. Ela estima a chance de osso em cada casa escondida enumerando onde cada esqueleto
// ainda pode estar (a forma e o "não encostam de lado" são regras conhecidas) e cruzando com os números.
import { SPECIES, placements, neighbors4, neighbors8, orientations } from './rules.js';

export const OPPONENTS = [
  { name: 'Professor Pá', title: 'o apressado', desc: 'Adora a picareta. Abre muito chão e quebra muito osso.', color: 0xc8742a, info: 0.34, noise: 0.28, pick: true, think: 0.9 },
  { name: 'Doutora Lupa', title: 'a cuidadosa', desc: 'Só usa o pincel e lê os números com calma.', color: 0x3a8a6a, info: 0, noise: 0.12, pick: false, think: 1.2 },
  { name: 'Mestre Âmbar', title: 'o calculista', desc: 'Calcula onde cada esqueleto pode estar. Picareta só na terra certa.', color: 0x8a5ad8, info: 0.16, noise: 0, pick: true, think: 1.4 },
];
export const ROBOT = { name: 'Robô', info: 0.16, noise: 0, pick: true, think: 0.3 };

// Chance de osso em cada casa (1 = certeza, 0 = terra certa). Só usa a vista pública.
export function probabilities(view) {
  const { W, H, cells, kinds, done } = view;
  const N = W * H;
  const hidden = (i) => cells[i].s === 'hidden';
  const isBone = (i) => cells[i].s === 'bone' || cells[i].s === 'broken';
  // ossos já vistos ao redor de cada número
  const p = new Float64Array(N);
  const miss = new Float64Array(N).fill(1);
  for (let k = 0; k < kinds.length; k++) {
    if (done[k]) continue;
    const mine = []; for (let i = 0; i < N; i++) if (isBone(i) && cells[i].b === k) mine.push(i);
    const cover = new Float64Array(N);
    let total = 0;
    for (const pl of placementsCached(kinds[k], W, H)) {
      let okp = true;
      for (const c of pl) { if (!hidden(c) && !(isBone(c) && cells[c].b === k)) { okp = false; break; } }
      if (!okp) continue;
      if (mine.some(m => !pl.includes(m))) continue;
      // não encosta de lado em osso de outro esqueleto
      for (const c of pl) { for (const n of neighbors4(c, W, H)) if (isBone(n) && cells[n].b !== k) { okp = false; break; } if (!okp) break; }
      if (!okp) continue;
      // números: não pode passar do que o número permite
      for (const c of pl) {
        if (!hidden(c)) continue;
        for (const n of neighbors8(c, W, H)) {
          if (cells[n].s !== 'dirt') continue;
          const seen = neighbors8(n, W, H).filter(isBone).length;
          const mineHere = pl.filter(q => hidden(q) && neighbors8(n, W, H).includes(q)).length;
          if (seen + mineHere > cells[n].n) { okp = false; break; }
        }
        if (!okp) break;
      }
      if (!okp) continue;
      total++;
      for (const c of pl) if (hidden(c)) cover[c]++;
    }
    if (!total) continue;
    for (let i = 0; i < N; i++) if (cover[i]) miss[i] *= 1 - cover[i] / total;
  }
  for (let i = 0; i < N; i++) p[i] = hidden(i) ? 1 - miss[i] : 0;
  // deduções diretas dos números (repete até parar)
  for (let pass = 0; pass < 6; pass++) {
    let changed = false;
    for (let n = 0; n < N; n++) {
      if (cells[n].s !== 'dirt') continue;
      const nb = neighbors8(n, W, H);
      const seen = nb.filter(isBone).length;
      const unk = nb.filter(hidden);
      const sure = unk.filter(i => p[i] >= 0.999).length;
      const rem = cells[n].n - seen;
      if (rem - sure <= 0) for (const i of unk) if (p[i] < 0.999 && p[i] > 0) { p[i] = 0; changed = true; }
      if (rem === unk.length) for (const i of unk) if (p[i] < 0.999) { p[i] = 1; changed = true; }
    }
    if (!changed) break;
  }
  return p;
}
const plCache = new Map();
function placementsCached(kind, W, H) {
  const k = `${kind}|${W}|${H}`;
  if (!plCache.has(k)) plCache.set(k, placements(kind, W, H));
  return plCache.get(k);
}

// Escolhe { i, tool }. random só desempata e põe o "erro" do estilo.
export function chooseDig(view, style, random = Math.random, { allowPick = true } = {}) {
  const { W, H, cells } = view;
  const N = W * H;
  const p = probabilities(view);
  const est = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    if (cells[i].s !== 'hidden') { est[i] = -1; continue; }
    est[i] = p[i] >= 0.999 || p[i] <= 0.001 ? p[i] : Math.min(0.98, Math.max(0.02, p[i] + (random() - 0.5) * 2 * style.noise));
  }
  let best = -1, bv = -1;
  for (let i = 0; i < N; i++) if (est[i] >= 0) { const v = est[i] + random() * 1e-6; if (v > bv) { bv = v; best = i; } }
  const brushValue = bv * 1.5;
  if (style.pick && allowPick && bv < 0.98) {
    let pi = -1, pv = -1e9;
    for (let i = 0; i < N; i++) {
      if (cells[i].s !== 'hidden') continue;
      const ar = [i, ...neighbors4(i, W, H)].filter(c => cells[c].s === 'hidden');
      const risk = ar.reduce((s, c) => s + Math.max(0, est[c]), 0);
      const v = style.info * ar.length - risk * 1.3 + random() * 1e-6;
      if (v > pv) { pv = v; pi = i; }
    }
    if (pv > brushValue) return { i: pi, tool: 'pick', p: p[pi] };
  }
  return { i: best, tool: 'brush', p: p[best] };
}
export { SPECIES, orientations };
