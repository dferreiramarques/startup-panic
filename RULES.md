# Startup Panic — Livro de Regras

> Este documento foi destilado diretamente da lógica em [server.js](server.js) (não existia um livro de regras separado no projeto — o jogo inteiro está codificado no servidor). Serve como referência para continuar o desenvolvimento.

## Conceito

Cada jogador é um **Business Angel** a investir em 10 startups fictícias, espalhadas por 5 setores, enquanto **CEOs caóticos** (Elon V., Sam A., Mark Z., etc.) entram e saem, empurrando o valor dos setores para cima e para baixo — e por vezes fazendo startups **implodir**. Ganha quem tiver mais valor total (cash + ações) no fim do jogo.

## Componentes

### Setores (5)
`ia`, `fintech`, `seguranca`, `biotech`, `energia`

### Startups (10 — 2 por setor)

| Startup | Setor | Preço base |
|---|---|---|
| DeePanic | IA | 3M |
| HalluciNet | IA | 2M |
| CashBurn | Fintech | 4M |
| TokenStonks | Fintech | 3M |
| HackShield | Segurança | 3M |
| ZeroTrustUs | Segurança | 2M |
| CRISPRash | Biotech | 4M |
| PharmaRush | Biotech | 3M |
| FusionFail | Energia | 2M |
| SolarScam | Energia | 3M |

O preço de mercado de uma startup = `preço base + valor acumulado do seu setor` (mínimo 1M). Startups do mesmo setor sobem/descem sempre juntas.

### CEOs (12 cartas, baralhadas no início — 1 por ronda, 12 rondas no total)

Cada CEO tem um **setor de afinidade** (+1M permanente a esse setor sempre que aparece) e um **efeito próprio**. Alguns exigem um lançamento de dado (1–6, automático).

| CEO | Arquétipo | Setor | Dado? | Efeito |
|---|---|---|---|---|
| Elon V. | Caótico Visionário | Energia | Sim | IA +⌊dado/2⌋M; se dado ≥5, implode startup aleatória |
| Mark Z. | Metódico Controlador | Fintech | Não | Fintech +2M, IA −1M |
| Sam A. | Hype Master | IA | Sim | IA +dado M, Biotech −1M |
| Jensen H. | Técnico Preciso | IA | Não | IA +3M, Energia −1M |
| Reed H. | Pivot Constante | Fintech | Sim | Setor aleatório (dado%5) +2M, outro setor −2M |
| Travis K. | Disruptivo | Segurança | Sim | Segurança (dado−2)M; implode startup aleatória (salvo "seguro") |
| Elizabeth H. | Fraude Elegante | Biotech | Não | Biotech +4M agora, **−4M na ronda seguinte** (efeito diferido) |
| Brian C. | Partilha de Risco | Energia | Não | Todos os setores +1M; nenhuma startup implode esta ronda |
| Adam N. | Wellness Caótico | Biotech | Sim | Biotech (dado−3)M; salários +1M este turno |
| Patrick C. | Crescimento Metódico | Fintech | Não | Fintech +2M, Segurança +1M |
| Sam B. | Colapso Espectacular | Fintech | Sim | Dado ≥4 → implode startup aleatória; dado <4 → Fintech +4M |
| Whitney W. | Exit Queen | Segurança | Não | Multiplicador do próximo Gate de Venda +1 nível |

O setor de afinidade do CEO recebe sempre **+1M** antes de o efeito ser aplicado, independentemente do resultado do dado.

### Trabalhadores (Workers)

Pool partilhada de 12 trabalhadores (3 de cada tipo), disponíveis para contratar:

| Tipo | Dividendo base/ação/ronda |
|---|---|
| Engenheiro | 2M |
| Advogado | 1M |
| PR | 1M |
| CFO | 1M |

- **Estagiário**: grátis para contratar, gera o dividendo base.
- **Sénior**: custa 2M à contratação + 1M/ronda de salário, gera **dividendo em dobro**.

## Estrutura do jogo

- 12 rondas no total (uma por CEO do baralho).
- Cada ronda: **um CEO é revelado automaticamente** (com dado, se aplicável) e o seu efeito aplicado a todos.
- Dentro de cada ronda, **cada jogador joga o seu turno** em sequência. Um turno tem duas fases:
  1. **MARKET** (Mercado)
  2. **MAINTENANCE** (Manutenção da equipa)
- Quando o último jogador termina o turno, a ronda acaba: pagam-se dividendos, avança-se o baralho de CEOs e começa a ronda seguinte.
- Após a 12ª ronda, o jogo termina e o vencedor é apurado.

### Fase MARKET (Mercado)

Ações disponíveis para quem tem o turno:

- **Comprar ações** (`SP_BUY`): compra `qty` ações de uma startup viva ao preço atual (`preço × qty`), pagando em cash.
- **Vender startup** (`SP_SELL_STARTUP`) — só se o **Gate de Venda** estiver aberto e o jogador tiver a **maioria** de ações dessa startup. Ganha `preço × ações × multiplicador do gate` em cash, e perde todas as ações dessa startup.
- **Trocar ações** (`SP_TRADE`) — só durante um Gate de Venda. Troca *todas* as ações que tens numa startup pelas de outro jogador noutra startup (ambos precisam de ter ações nas respetivas startups).
- **Fechar Mercado** (`SP_END_MARKET`): avança para a fase de Manutenção.

### Gate de Venda

Abre automaticamente nas rondas 4, 8 e 12 (contadas pelo índice global do CEO, 1-indexado). O multiplicador de venda depende do arquétipo do CEO dessa ronda:

- CEOs de **alto multiplicador** (Sam A., Elon V., Whitney W., Sam B.) → ×20
- CEOs **neutros** → ×5
- CEOs de **baixo multiplicador** (Mark Z., Jensen H., Patrick C., Brian C.) → ×1

Whitney W. pode ainda somar +1 "nível" de multiplicador (efeito acumulável, `gateMultiplierBonus`).

### Fase MAINTENANCE (Manutenção)

- **Contratar** (`SP_HIRE`): tira um trabalhador disponível da pool e atribui-o a uma das tuas startups (precisas de ter ações nela para receber dividendos, mas a contratação em si não o exige). Escolhe Estagiário (grátis) ou Sénior (2M).
- **Despedir** (`SP_FIRE`): remove um trabalhador teu, que volta à pool partilhada.
- **Mover trabalhador** (`SP_MOVE_WORKER`): muda um trabalhador de startup, pagando uma indemnização (1M Estagiário / 2M Sénior).
- **Pagar Salários** (`SP_PAY_SALARY`): paga 1M (+ sobretaxa, se ativa) por cada trabalhador Sénior teu. Se não tiveres cash suficiente para algum, esse Sénior abandona-te e volta à pool.
- **Terminar Turno** (`SP_END_TURN`): passa a vez ao próximo jogador. Se for o último jogador, fecha-se a ronda (dividendos + próximo CEO).

### Dividendos (fim de ronda, automático)

Para cada jogador, para cada startup viva onde tem ações **e** pelo menos um trabalhador alocado:

```
dividendo_por_ação = Σ (dividendo_base_do_tipo × (2 se Sénior, senão 1)) dos teus trabalhadores nessa startup
ganho = ações × dividendo_por_ação
```

Este valor é somado ao cash do jogador.

Sem trabalhadores alocados a uma startup, essa startup não paga dividendos a esse jogador, mesmo tendo ações.

### Fim de jogo

Pontuação de cada jogador = `cash + Σ (ações × preço atual)` de todas as startups não implodidas. Ganha quem tiver a pontuação mais alta.

## Turno de exemplo (passo a passo)

Suponhamos uma partida a 2 jogadores, **Ana** e **Bruno**, na Ronda 3.

1. **Início da ronda 3** (automático): sai a carta de **Sam A.** (Hype Master, setor IA, tem dado). O setor IA recebe +1M de afinidade. É lançado o dado → sai 5. O efeito de Sam A. aplica-se: IA +5M, Biotech −1M. Log: *"📋 Sam A. (IA +1M) 🎲5: IA +5M, Biotech -1M"*. Como não é ronda 4/8/12, o Gate de Venda **não** abre.
2. **Turno da Ana (fase MARKET)**: DeePanic (IA) agora custa `3 + 6 = 9M` (1 de afinidade + 5 do efeito). Ana tem 12M. Compra 1× HalluciNet (IA, agora `2+6=8M`), ficando com 4M em cash e 1 ação de HalluciNet. Fecha o mercado (`SP_END_MARKET`).
3. **Turno da Ana (fase MAINTENANCE)**: contrata um Engenheiro Estagiário grátis, atribuído a HalluciNet. Não tem Séniores, por isso não precisa de pagar salários. Termina o turno (`SP_END_TURN`) → passa para Bruno.
4. **Turno do Bruno**: compra 1× PharmaRush (Biotech, agora `3-1=2M`) por 2M. Fecha o mercado, contrata um CFO Sénior (paga 2M) para PharmaRush, paga o salário desse Sénior (1M), termina o turno.
5. Como Bruno era o último jogador, a ronda fecha automaticamente:
   - **Dividendos**: Ana recebe `1 ação × 2M (engenheiro) = 2M`. Bruno recebe `1 ação × 2M (CFO Sénior, 1M×2) = 2M`.
   - A ronda avança para 4, e uma nova carta de CEO é revelada automaticamente — e como é a ronda 4, o **Gate de Venda abre** com o multiplicador determinado pelo arquétipo desse CEO.
6. **Ronda 4, turno da Ana**: com o Gate aberto, se a Ana tiver a maioria de ações numa startup, pode vendê-la a `preço × multiplicador` em vez de simplesmente negociar no mercado normal — ou trocar ações com o Bruno via `SP_TRADE`.

## Notas para desenvolvimento

- Toda a lógica de regras vive em [server.js](server.js); não existe um documento de regras "canónico" separado — este ficheiro é esse documento agora.
- O front-end ([public/index.html](public/index.html)) é um cliente fino que renderiza o `GAME_STATE` recebido por WebSocket e envia mensagens de ação (`SP_BUY`, `SP_HIRE`, etc.) — a validação de regras é sempre feita no servidor (`spHandle`).
- Os bots (`spBot`) seguem uma heurística simples: vendem se tiverem maioria num Gate aberto, senão compram a startup mais cara que possam pagar; na Manutenção, pagam salários pendentes ou contratam um engenheiro grátis.
- Modo solo usa uma sala dedicada (`sp-solo`) com 1 bot "IA Angel"; salas multiplayer suportam 2–4 jogadores humanos.
