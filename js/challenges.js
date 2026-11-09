// Desafios do Fóssil: escavação sozinho num sítio montado (sempre o mesmo), com pistas já abertas.
// Estrelas pelo número de escavações para completar todos os esqueletos.
import { makeSite, newGame, dig, publicView, rng, PLAYER } from './rules.js';
import { chooseDig, ROBOT } from './ai.js';

export const CHALLENGES = [
  { name: 'Primeiro osso', desc: 'Uma amonite e uma tartaruga. Os números dizem quantos ossos há em volta.', W: 6, H: 5, set: ['amonite', 'tartaruga'], seed: 3, hints: 6 },
  { name: 'Leia os números', desc: 'Muito chão já aberto. Deduza onde está o raptor.', W: 7, H: 6, set: ['raptor'], seed: 11, hints: 16 },
  { name: 'Só pincel', desc: 'A picareta ficou no acampamento. Tricerátops e amonite.', W: 8, H: 6, set: ['tricera', 'amonite'], seed: 5, hints: 6, noPick: true },
  { name: 'Terra solta', desc: 'Sítio grande e pouco osso: a picareta abre caminho rápido.', W: 9, H: 7, set: ['tartaruga', 'amonite'], seed: 21, hints: 2 },
  { name: 'Mão leve', desc: 'Quebrou um osso, perdeu o desafio. Raptor e pterossauro.', W: 8, H: 6, set: ['raptor', 'ptero'], seed: 8, hints: 6, noBreak: true },
  { name: 'Rei escondido', desc: 'Só o tiranossauro, num sítio fundo.', W: 9, H: 7, set: ['trex'], seed: 14, hints: 4 },
  { name: 'Ninho de amonites', desc: 'Quatro amonites pequenas espalhadas.', W: 8, H: 6, set: ['amonite', 'amonite', 'amonite', 'amonite'], seed: 9, hints: 5 },
  { name: 'Vizinhos', desc: 'Três bichos perto um do outro. Cuidado com a picareta.', W: 8, H: 7, set: ['tricera', 'raptor', 'tartaruga'], seed: 30, hints: 6, noBreak: true },
  { name: 'Pressa', desc: 'Pterossauro e tartaruga num sítio largo, com poucas pistas.', W: 10, H: 6, set: ['ptero', 'tartaruga'], seed: 41, hints: 1 },
  { name: 'O grande sítio', desc: 'Todos os seis esqueletos. A prova final.', W: 10, H: 8, set: ['trex', 'tricera', 'raptor', 'ptero', 'tartaruga', 'amonite'], seed: 7, hints: 8 },
];

// Monta o desafio: sítio fixo e algumas casas de terra já abertas (pistas).
export function setupChallenge(c) {
  const random = rng(c.seed * 7919 + 13);
  const site = makeSite({ W: c.W, H: c.H, set: c.set, random });
  const g = newGame(site, { starter: PLAYER, players: 1 });
  const dirt = [];
  for (let i = 0; i < site.W * site.H; i++) if (site.bone[i] < 0) dirt.push(i);
  for (let k = 0; k < c.hints && dirt.length; k++) {
    const j = Math.floor(random() * dirt.length);
    const i = dirt.splice(j, 1)[0];
    g.open[i] = 1; g.owner[i] = -1;
  }
  return g;
}
export const failed = (c, g) => !!(c.noBreak && g.broken > 0);
export const finished = (c, g) => g.over || failed(c, g);
export function starsFor(c, g) {
  if (!g.over || failed(c, g)) return 0;
  const n = g.actions[PLAYER];
  return n <= c.par[0] ? 3 : n <= c.par[1] ? 2 : 1;
}
export const goalText = (c) => `3 estrelas: até ${c.par[0]} escavações · 2: até ${c.par[1]}${c.noBreak ? ' · sem quebrar osso' : ''}${c.noPick ? ' · só pincel' : ''}`;

// Escavação do robô (o mesmo cálculo do Mestre Âmbar, sem erro).
export function robotDig(c, g) {
  return chooseDig(publicView(g), ROBOT, rng(g.actions[PLAYER] + 1), { allowPick: !c.noPick && !c.noBreak });
}
export function solve(c) {
  const g = setupChallenge(c);
  const moves = [];
  while (!finished(c, g) && moves.length < 200) { const d = robotDig(c, g); moves.push(d); dig(g, d.i, d.tool); }
  return { g, moves };
}
// Metas: o que o robô conseguiu (3 estrelas) e uma folga para a 2ª.
for (const c of CHALLENGES) {
  const r = solve(c);
  const n = r.g.actions[PLAYER];
  c.par = [n + 2, n + 6];
}
