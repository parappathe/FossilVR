# FossilVR

Fóssil: disputa de escavação por turnos em VR para o Meta Quest 3 no navegador (WebXR), sem instalar
nada. Num acampamento no deserto, uma caixa de areia na altura da cintura, com grade de barbante, esconde
6 esqueletos de dinossauro. Você e um paleontólogo rival cavam uma casa por vez: com o **pincel** (esfrega
de verdade com a mão; o osso sai inteiro, vale ponto e você cava de novo) ou com a **picareta** (bate e
abre 5 casas de uma vez, mas o osso que ela pega quebra e tira ponto). Casa vazia mostra quantos ossos há
em volta, como num campo minado. Esqueleto completo dá bônus a quem tem mais peças inteiras dele. Partida
contra 3 rivais e 10 desafios com 3 estrelas. Também joga no PC com mouse e teclado. Tudo em português.

## Como rodar / jogar

**No Quest:** depois de publicado, abrir no navegador do óculos `https://parappathe.github.io/FossilVR/` e
apertar "Entrar em VR". (Publicação: `python publicar.py FossilVR` na pasta `C:\claude code`.)

**No PC:** `python serve.py` nesta pasta e abrir `http://localhost:8887` (o painel de visualização usa
`.claude/launch.json`). `python serve.py --https` serve para abrir no Quest pela rede de casa (porta 8443).

### Controles

| | VR (Quest) | PC |
|---|---|---|
| Pegar ferramenta | Botão lateral (ou pinça) no pincel ou na picareta, no suporte à direita da caixa | 1 = pincel, 2 = picareta, ou clicar nela |
| Pincel | Encostar as cerdas na areia de uma casa e esfregar (22 cm de pincelada) | Clicar na casa |
| Picareta | Erguer e bater de cima na casa (descendo rápido) | Clicar na casa |
| Atalho | Raio + gatilho na casa, com a ferramenta escolhida; A/X troca a ferramenta | |
| Pausa | B ou Y | Esc ou P |
| Câmera | (sua cabeça) | Botão direito arrastando, roda = zoom |
| FPS | Menu → FPS | Tecla F |

Antes de cavar, as casas que vão abrir ficam realçadas (branco = pincel, laranja = picareta).

### Regras

- Sítio de 10 x 8 casas (colunas A a J) com 6 esqueletos (`js/rules.js`, `SPECIES`): Tiranossauro (6),
  Tricerátops (5), Velocirraptor (4), Pterossauro (4), Tartaruga (3), Amonite (2). As formas podem girar
  e espelhar; esqueletos nunca se sobrepõem nem encostam de lado.
- Pincel: abre 1 casa. Osso: +1 (fica inteiro) e quem achou cava de novo. Terra: passa a vez.
- Picareta: abre a casa e as 4 vizinhas. Cada osso que ela pega quebra: -1. Sempre passa a vez.
- Terra aberta mostra o número de ossos nas 8 casas em volta (bandeirinha colorida; 0 fica sem número).
- Osso aberto mostra a cor da espécie. Esqueleto completo (todas as peças abertas, inteiras ou quebradas):
  + o tamanho dele para quem tem mais peças inteiras dele (empate: quem completou).
- Fim quando os 6 esqueletos estão completos. Ganha quem tem mais pontos.
- Rivais (`js/ai.js`): estimam a chance de osso em cada casa enumerando onde cada esqueleto ainda pode estar
  e cruzando com os números, **só com o que está à vista** (o teste confere). **Professor Pá** (adora a
  picareta e estima mal), **Doutora Lupa** (só pincel), **Mestre Âmbar** (calcula certo e só usa a
  picareta em terra segura).
- Desafios (`js/challenges.js`): sozinho, sítio fixo com pistas abertas; estrelas pelo número de
  escavações (meta = o que o robô fez + 2). 1 Primeiro osso, 2 Leia os números, 3 Só pincel, 4 Terra
  solta, 5 Mão leve (quebrou, perdeu), 6 Rei escondido, 7 Ninho de amonites, 8 Vizinhos (sem quebrar),
  9 Pressa, 10 O grande sítio.
- Progresso salvo no navegador (localStorage, chave `fossilvr.v1`).

## Como testar

- `npm test` (ou `node tests/run.js`): regras (formas, 40 sítios válidos, números, pincel, picareta,
  bônus, fim, vista pública sem nada escondido); IA (escavação válida em menos de 100 ms, **não espia**:
  mesma vista com sítios escondidos diferentes dá a mesma escolha, deduções do número 0 e perto do osso);
  IA contra IA em 16 partidas por dupla (Âmbar ganha dos dois, Lupa do Pá); robô tira 3 estrelas nos 10
  desafios; e fumaça do `main.js` (carrega o jogo no Node com navegador e WebGL de mentira: clique com
  pincel e picareta, osso dá vez de novo, picareta quebra, controle de VR de mentira esfrega o pincel e bate
  a picareta, robô termina a partida, os 10 desafios com 3 estrelas dentro do jogo, "Só pincel" bloqueia a
  picareta, `dev.win()`, pausa). Tem que terminar com "Tudo certo"; sai com código 1 se algo falhar (ou
  200 s). Não toca som. Node 22.15+.
- No navegador (console): `dev.autoplay = true`, `dev.advance(5)`, `dev.state()`, `dev.dig(12, 'pick')`,
  `dev.loadLevel(3)`, `dev.startMatch(2)`, `dev.win()`, `dev.cheat()` (casas com osso), `dev.screenOf(i)`,
  `dev.resetSave()`. `window.fossil` tem `game`, `challenge`, `world`, `shell`.

## Estrutura

- `js/rules.js`: espécies e formas, sítio, números, escavação, pontos, vista pública.
- `js/ai.js`: probabilidades por casa, escolha de casa e ferramenta, estilos dos 3 rivais.
- `js/challenges.js`: os 10 desafios (sítio fixo por semente), metas calculadas pelo robô.
- `js/scene.js`: deserto, caixa de areia, montes e números, ossos, ferramentas, rival, lousa.
- `js/main.js`: estados, menus, entrada (ferramenta na mão no VR, clique no PC), animações, `window.dev`.
- `js/shell.js`, `js/ui.js`, `js/visual3d.js`, `js/materiais3d.js`, `js/audio.js`, `js/save.js`.
- `tests/`: `run.js`, `smoke.js`, `three-stub.js`. `vendor/three`: Three.js r170.

## Decisões

- **Direção de arte:** acampamento de paleontologia: areia ocre (dominante), madeira e lona (secundária),
  azul do céu e as cores das espécies e dos dois jogadores (azul você, laranja o rival) como destaque.
  Tarde clara, sol em 3/4 por trás, sombra fria do céu.
- "Achou osso com o pincel, cava de novo" e a picareta que quebra dão a escolha do jogo: rápido e sujo ou
  lento e certo.
- Esqueletos não encostam de lado: os números ficam mais legíveis e a IA usa isso como regra conhecida.
- Metas dos desafios vêm do robô (sítio fixo por semente); dá 3 estrelas com até 2 escavações a mais.

## Pendências / problemas conhecidos

- Falta testar no Quest: esfregar o pincel (22 cm) e bater a picareta (velocidade de 0,8 m/s para baixo),
  orientação das ferramentas na mão, ler os números de pé.
