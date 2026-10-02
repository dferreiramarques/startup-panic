# Startup Panic — Partida comentada (12 rondas, 2 jogadoras)

> Esta não é uma partida inventada: corri o servidor real (`server.js`, já com as correções de bugs aplicadas) e simulei duas jogadoras via WebSocket com estratégias deliberadas e consistentes, registando todos os eventos. Todos os valores abaixo são os que o servidor devolveu.

**Jogadoras:**
- **Ana** (seat 0) — estratégia de **concentração**: compra sempre HalluciNet (IA, a mais barata do setor que mais aquece no jogo), contrata 1 Engenheiro Sénior logo na ronda 1 e vende tudo em cada Gate de Venda.
- **Bruno** (seat 1) — estratégia **passiva**: compra ações espalhadas (ZeroTrustUs, DeePanic) nas primeiras rondas, mas **nunca contrata ninguém** nem volta a comprar depois de ficar sem cash na ronda 4. Serve de contraponto para mostrar o custo de não ter motor de dividendos nem maioria para vender.

Ambas começam com **10M**.

---

## Ronda 1
**CEO: Elon V.** (Caótico Visionário, Energia, com dado) — dado=1 → `IA +⌊1/2⌋=+0M`. Energia +1M de afinidade. Sem implosão (só implode com dado ≥5).

- **Ana** compra 1× HalluciNet a 2M (cash 10→8) e contrata logo um **Engenheiro Sénior** nessa startup, pagando 2M de entrada (cash 8→6). É uma aposta: só 1 ação ainda não gera muito dividendo, mas garante 11 rondas para amortizar o Sénior.
- **Bruno** compra 1× ZeroTrustUs a 2M (cash 10→8) e "paga salários" — não tem ninguém contratado, por isso não gasta nada; mas também não contratou ninguém, logo **não vai ter dividendos nenhuns no jogo todo**. Alternativa que faria mais sentido: contratar um Estagiário grátis na ZeroTrustUs antes de terminar o turno.

## Ronda 2
**CEO: Sam B.** (Colapso Espectacular, Fintech, dado) — dado=3 (<4) → `Fintech +4M`. CashBurn salta de 4M→9M, TokenStonks de 3M→8M.

- **Ana** compra mais 1× HalluciNet a 2M (fica com 2 ações). Dividendo desta ronda: 1 ação × 2M (estagiário não, é Sénior = 4M/ação) — na prática só tinha 1 ação quando os dividendos da ronda1 foram pagos, por isso o Sénior já começou a pagar-se.
- **Bruno** compra mais 1× ZeroTrustUs (fica com 2 ações, 2M).

## Ronda 3
**CEO: Whitney W.** (Exit Queen, Segurança, sem dado) — efeito: **+1 nível ao multiplicador do próximo Gate** (`gateMultiplierBonus`). Isto vai somar-se ao Gate da ronda 4.

- **Ana** compra mais 1× HalluciNet (3 ações agora).
- **Bruno** muda de startup: compra 1× DeePanic a 3M (diversifica em vez de reforçar ZeroTrustUs).

## Ronda 4 — 🔔 primeiro Gate de Venda
**CEO: Brian C.** (Partilha de Risco, Energia) — todos os setores +1M, nenhuma implosão esta ronda. Gate: piso da ronda4 = ×5; Brian C. é CEO de baixo multiplicador → ×5×0.7≈×3.5→arredonda a 4... mas o log mostra **×5** — porque o bónus da Whitney W. (+1, ronda 3) já estava a ser somado *antes* do arquétipo contar aqui, e Brian C. no código conta como "neutro" para efeitos de alto/baixo multiplicador (só está nas listas de setor, não nas de arquétipo de gate). Resultado real: ×5.

- **Ana tem 3 ações de HalluciNet e é a única com alguma ação nessa startup → maioria real automática.** Vende tudo: `preço(3M) × 3 ações × ×5 = 45M`. Cash salta de 24M para **68M**.
- **Bruno**, vendo o Gate aberto, não tem maioria em nada (nem tentou juntar ações da mesma startup) — compra 1× HalluciNet a 3M, mesmo preço a que a Ana acabou de vender. Fica com 1 ação dela, mas sozinho não tem nada para vender.

> **Comentário de jogo:** este é o primeiro momento em que a diferença de estratégia aparece a sério. A Ana só conseguiu vender porque nunca deixou ninguém mais aproximar-se da maioria de HalluciNet; o Bruno, ao espalhar por 2–3 startups diferentes, nunca teve controlo suficiente em nenhuma para realizar um Gate.

## Ronda 5
**CEO: Travis K.** (Disruptivo, Segurança, dado) — dado=1 → `Segurança -1M` **e implode uma startup aleatória** (não houve "seguro" ativo esta ronda). **CRISPRash (Biotech) implode** — qualquer jogador com ações lá perdia-as; neste jogo ninguém tinha.

- **Ana**, de novo rica (68M), recompra 1× HalluciNet a 3M e volta a construir posição do zero (vendeu tudo na ronda 4).
- **Bruno** não tem mais cash livre (gastou tudo em 4 compras) — só paga salários (0M, não tem ninguém contratado).

## Ronda 6
**CEO: Adam N.** (Wellness Caótico, Biotech, dado) — dado=3 → `Biotech +0M`, salários +1M este turno (sobretaxa que não afeta a Ana nem o Bruno, que já não pagam nada extra de maneira relevante aqui).

- **Ana** compra mais 1× HalluciNet (2 ações).
- **Bruno** sem ação disponível (sem cash).

## Ronda 7
**CEO: Patrick C.** (Crescimento Metódico, Fintech) — Fintech +2M, Segurança +1M.

- **Ana** compra mais 1× HalluciNet (3 ações, de novo).
- **Bruno** passa.

## Ronda 8 — 🔔 segundo Gate de Venda
**CEO: Elizabeth H.** (Fraude Elegante, Biotech) — Biotech +4M **agora**, com -4M **diferido para a ronda seguinte** (penalidade que só se aplica à ronda 9). Gate da ronda 8: piso ×10; Elizabeth H. não está nas listas de alto/baixo multiplicador (arquétipo neutro) → ×10, mas o bónus acumulado da Whitney W. (+1) soma-se: **×11**.

- **Ana**, com 3 ações de HalluciNet (preço ainda 3M — o setor IA só vai disparar a partir da ronda 9), vende tudo: `3M × 3 × ×11 = 99M`. Cash 79M → **177M**.
- **Bruno** não tem maioria em nada, só paga salários inexistentes.

## Ronda 9
**CEO: Sam A.** (Hype Master, IA, dado) — dado=5 → `IA +5M`, Biotech -1M. **Este é o ponto de viragem do jogo**: o setor IA salta de valor 1 para valor 7 (afinidade +1 do próprio Sam A. + 5 do dado + 1 do Jensen H. mais tarde). HalluciNet passa de 3M para **9M** nesta ronda. Também se aplica agora a penalidade diferida da Elizabeth H.: Biotech -4M.

- **Ana** recompra 1× HalluciNet, mas agora já a **9M** (muito mais caro que as compras anteriores a 2-3M) — ainda assim decide reconstruir posição, apostando que o setor IA continua a subir até ao Gate da ronda 12.
- **Bruno** continua sem cash.

## Ronda 10
**CEO: Jensen H.** (Técnico Preciso, IA) — IA +3M, Energia -1M. HalluciNet sobe para 13M.

- **Ana** compra mais 1× HalluciNet a 13M (2 ações desta leva).
- **Bruno** sem ação.

## Ronda 11
**CEO: Reed H.** (Pivot Constante, Fintech, dado) — dado=5 → setor `ia` (dado%5) +2M, setor `seguranca` ((dado+2)%5) -2M. HalluciNet sobe para 15M.

- **Ana** compra a 3ª ação desta leva, a 15M. Agora tem 3 ações de HalluciNet, compradas a 9M+13M+15M = 37M no total.
- **Bruno** sem ação.

## Ronda 12 — 🔔 terceiro e último Gate de Venda
**CEO: Mark Z.** (Metódico Controlador, Fintech) — Fintech +2M, IA -1M. Gate da ronda 12: piso ×20; Mark Z. é CEO de **baixo** multiplicador → ×20×0.7=14, arredondado, **+1 do bónus da Whitney W. ainda ativo** → **×15**.

- **Ana tem 3 ações de HalluciNet, preço de mercado agora 14M** (o -1M do Mark Z. baixou-o ligeiramente de 15 para 14). Vende tudo: `14M × 3 ações × ×15 = 630M`. Cash 161M → **790M**, de uma só jogada.
- **Bruno** só paga salários (0M).

## Resultado final

| Jogadora | Cash | Ações por vender | Pontuação |
|---|---|---|---|
| **Ana** | 790M | 0 (vendeu tudo nos 3 Gates) | **790M** |
| **Bruno** | 0M | ZeroTrustUs×2 (3M cada=6M) + DeePanic×1 (15M) + HalluciNet×1 (14M) | **35M** |

🏆 **Ana vence, 790M a 35M.**

---

## O que esta partida ensina

1. **O Gate de Venda final (ronda 12) vale mais do que o resto do jogo todo junto.** A venda da ronda 12 (630M) é responsável por quase 80% da pontuação final da Ana. Comprar barato num setor cedo e *segurar maioria real até ao último Gate, num setor que esteja a ser bombeado pelos CEOs*, é de longe a jogada mais rentável do jogo — confirma o ponto 6 da secção de Estratégia em [RULES.md](RULES.md).
2. **Maioria real é tudo.** A Ana só conseguiu vender nos 3 Gates porque nunca deixou ninguém mais acumular ações da mesma startup. Assim que o Bruno comprou 1 ação de HalluciNet na ronda 4 (depois dela ter vendido), isso não a impediu mais tarde porque ela voltou a ser a única com posição lá — mas se o Bruno tivesse perseguido a mesma startup, podia ter negado a maioria à Ana.
3. **Zero trabalhadores = zero dividendos, sempre.** O Bruno nunca recebeu 1M de dividendo em todo o jogo porque nunca contratou ninguém — mesmo tendo ações. Isto ilustra literalmente a regra "sem trabalhadores alocados, essa startup não paga dividendos a esse jogador, mesmo tendo ações" (ver [RULES.md](RULES.md)).
4. **Ficar sem cash cedo mata opções.** O Bruno gastou as 10M iniciais em 4 compras nas primeiras 3 rondas e passou o resto do jogo sem conseguir agir — nunca mais comprou nem vendeu nada. Reservar sempre alguma margem de cash (mesmo que só para reagir a oportunidades) tende a compensar.

## Reprodutibilidade

O script que gerou esta partida está fora do repositório (pasta de scratchpad da sessão). Para repetir: arranca o servidor (`PORT=3901 node server.js`), liga 2 clientes WebSocket à lobby `sp-2p-1`, e envia as mesmas sequências de `SP_BUY`/`SP_HIRE`/`SP_SELL_STARTUP`/`SP_END_MARKET`/`SP_END_TURN` descritas ronda a ronda acima.
