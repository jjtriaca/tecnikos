# TAREFA ATUAL

## Versao atual em prod: v1.12.43 — Dropdown de Bombas Candidatas no Simulador Solar

**v1.12.43 (26/05/2026)** — substitui o card "Bomba recomendada" (string fixa hardcoded por vazao em `solar-constants.ts`) por DROPDOWN com candidatos reais do catalogo do tenant, ordenados pela regra de auto-selecao.

### Backend
- `SolarBudgetService.listSolarBombaCandidates(budgetId, companyId)` — retorna ate 20 candidatos que passam na `solarBombaRule` (filterPoolType + filterDescription + where), ordenados pelo `orderBy`. Interpola `pumpCurve` em vazaoM3h/pressaoTrabalhoMca quando o candidato tem curva cadastrada. Inclui `indicator` avaliado (ex: "Folga vazao: +25%").
- `SolarBudgetService.setSelectedBomba(budgetId, companyId, productId)` — persiste a escolha do operador em `environmentParams.solarReport.selectedBombaId`.
- Endpoints: `GET /pool-budgets/:id/solar-bomba-candidates` e `POST /pool-budgets/:id/solar-bomba-selection`.
- Mensagem do aviso reescrita (`computeWarnings`): explica os filtros aplicados e aponta pro **botao ✨ ao lado de "Bomba recomendada"** (nao mais "Configuracoes > Piscina > Bomba Solar", que era hardcode equivocado).

### Frontend (HeatingSimulatorModal)
- Card "Bomba recomendada" virou `<select>` com 1 opcao por candidato.
- Formato da opcao: `Descricao · X cv · Y m³/h · Z mca · 📈 curva · folga N%`.
- Default = primeiro pelo `orderBy` (ja ordenado pelo backend).
- Mudanca persistida automaticamente via POST.
- Hint embaixo: "X bomba(s) atendem · ordem definida pela regra ✨ · vazao Y m³/h + altura Z mca".
- Fallback quando vazio: mensagem explica vazao/altura exigidas + aponta pro ✨.

### Presets de orderBy (ORDER_BY_PRESETS em quotes/pool/[id]/page.tsx)
Adicionados: `potenciaCv asc/desc` (menor/maior cv primeiro) e `pressaoTrabalhoMca asc/desc` (menor/maior pressao primeiro).

### IMPORTANTE — configuracao do tenant SLS
A `solarBombaRule` cadastrada no tenant esta com `filterPoolType="Bomba"` mas as bombas do catalogo tem `poolType="Bombas diversas"`. **Acao necessaria:** abrir o ✨, mudar o filtro para "Bombas diversas" e salvar — depois disso o dropdown vai aparecer com as bombas que atendem.

**TESTAR em prod (Ctrl+Shift+R):**
- [ ] Aba Solar mostra dropdown em vez do card unico
- [ ] Apos ajustar a regra (filterPoolType="Bombas diversas"), aparecem multiplas bombas no dropdown
- [ ] Trocar bomba no dropdown salva automaticamente em `solarReport.selectedBombaId`
- [ ] Modal ✨ tem presets novos de orderBy (potenciaCv, pressaoTrabalhoMca)
- [ ] Aviso amarelo (quando 0 bombas) agora aponta pro botao ✨ e explica os filtros

---

## Versao anterior: v1.12.42 — Fix preview do AutoSelectModal

**v1.12.42 (26/05/2026)** — terceiro fix do caso "Bomba do Coletor Solar". v1.12.40 corrigiu backend (`extractSolarVars` populando `vazaoSolarM3h`); v1.12.41 implementou interpolacao da `pumpCurve` no backend; v1.12.42 corrige o **FRONTEND** que avaliava o criterio em PREVIEW antes da chamada ao backend.

**Causa raiz:** `evalCondition` em `frontend/src/app/(dashboard)/quotes/pool/[id]/page.tsx:3289` substitui apenas variaveis presentes no objeto `vars`. Se uma variavel referenciada no criterio ficar de fora, o evaluator detecta (`if (/[a-zA-Z_]/.test(stripped)) return false`) e rejeita o candidato.

- **AutoSelectModal** (`dimVars`, linha 3271): populava `vazaoSolarM3h` mas **NAO** `alturaTelhadoMca`. Criterio `pressaoTrabalhoMca >= alturaTelhadoMca` virava `pressaoTrabalhoMca >= alturaTelhadoMca` (variavel literal) → false pra todo candidato → "Nenhum candidato passa nos filtros + criterio".
- **CatalogPickModal** (`ruleVars`, linha 4020): nao populava nem `vazaoSolarM3h` nem `alturaTelhadoMca`. Mesmo bug latente no checkbox "Apenas que passam no criterio".

Fix: adicionar `alturaTelhadoMca: Number(environmentParams.alturaTelhadoM) || 0` (e `vazaoSolarM3h` no CatalogPickModal). Ambos lem de `environmentParams.alturaTelhadoM` (= alturaManometricaTotal apos calculo da tubulacao) e `environmentParams.solarReport.vazaoTotalM3h`.

**Licao:** sempre que uma nova variavel for adicionada ao motor de auto-select (backend `extractSolarVars` em v1.12.40), o frontend de preview tambem precisa atualizar `dimVars`/`ruleVars`. Sem essa atualizacao, o backend pode aceitar mas o modal sempre mostra "Nenhum candidato passa".

**TESTAR em prod (Ctrl+F5):**
- [ ] Modal ✨ Bomba do Simulador Solar → template "Bomba do Coletor Solar" → deve mostrar bombas que atendem (1/2cv pra cima com altura 6.28 mca: vazao 8.4 e pressao 8 mca → passa)
- [ ] CatalogPickModal → checkbox "Apenas que passam no criterio" tambem deve funcionar

---

## Versao anterior: v1.12.41 — Auto-select da bomba via pumpCurve interpolada

**v1.12.41 (26/05/2026)** — fecha o ciclo Solis: auto-select da bomba passa a usar a curva caracteristica real em vez de specs estaticos.

1. **Cadastro de Produto (aba Piscina)** — campo "Vazao (m³/h)" renomeado pra **"Vazao maxima (m³/h)"** + tooltip novo explicando que esse campo so dimensiona ralo de fundo e tempo de filtragem. Para perdas/altura manometrica, o sistema usa a `pumpCurve` cadastrada no card abaixo. Arquivo: `products/page.tsx:2022`.

2. **Engine de auto-select** — quando candidato tem `pumpCurve` (>= 2 pontos validos) E baseVars tem `alturaTelhadoMca > 0`, agora interpola linearmente:
   - `specVars.vazaoM3h` ← vazao entregue na altura alvo (interpolacao linear entre pontos vizinhos; 0 se altura > shut-off head; vazao maxima se altura < minima cadastrada)
   - `specVars.pressaoTrabalhoMca` ← shut-off head (altura maxima da curva = ponto onde vazao -> 0)

   Bombas SEM curva mantem o comportamento legado (`technicalSpecs` estaticos). Template "Bomba do Coletor Solar (vazao + pressao do simulador)" NAO precisou ser alterado — a logica eh transparente.

   Arquivos: `backend/src/pool-budget/auto-select.helper.ts` (`interpolatePumpCurve`, `extractCandidateSpecs`, refactor de `filterByWhere`/`orderCandidates`), `pool-budget.service.ts:758` (adiciona `pumpCurve: true` no select de `allProducts`).

**TESTAR em prod (Ctrl+F5):**
- [ ] Cadastro de Produto → aba Piscina → campo agora diz "Vazao maxima (m³/h)" com tooltip novo
- [ ] Modal ✨ Bomba do Simulador Solar → template "Bomba do Coletor Solar" → bomba que tem pumpCurve cobrindo 13.70 mca deve aparecer como candidata
- [ ] Bomba SEM curva: continua sendo filtrada pelos specs estaticos (pressaoTrabalhoMca fixo)

**NOTA do diagnostico:** as bombas atuais do tenant SLS (Pre-filtro 1/3cv ate 3cv) tem `pressaoTrabalhoMca` entre 6 e 12 mca — nenhuma vence os 13.70 mca calculados. Pra a auto-select funcionar nesse caso, precisa:
1. Cadastrar bomba maior com pumpCurve cobrindo >= 14 mca, OU
2. Trocar tubulacao pra 50mm (reduz perda dinamica de 8.70 pra ~3-4 mca → altura total ~8-9 mca, ai as bombas 1cv-3cv passam).

---

## Versao anterior: v1.12.40 — Fix auto-select Bomba Solar

**v1.12.40 (26/05/2026)** — 3 bugs reportados na tela do Simulador Solar:
1. Texto "Defaults: PVC, fator 20%, 4 joelhos, 1 tê..." estava desatualizado (backend usa 10 joelhos e 4 tês desde v1.12.38). Fix em `HeatingSimulatorModal.tsx:2030`.
2. Auto-select da bomba retornava "Nenhum candidato passa" mesmo com bombas no catalogo. Causa: `extractSolarVars()` em `backend/src/pool-budget/formula-eval.ts:289` populava `solarQty` e `solarNumBaterias` mas NAO `vazaoSolarM3h` — o criterio `vazaoM3h >= vazaoSolarM3h` sempre falhava (variavel undefined ≈ 0). Fix: ler `solarReport.vazaoTotalM3h` e expor como `vars.vazaoSolarM3h`.
3. Bug #3 ("calculo nao leva em conta vazao dos coletores") era consequencia do #2 — resolvido pelo mesmo fix.

**TESTAR em prod (apos Ctrl+F5):**
- [ ] Texto da tubulacao agora diz "10 joelhos, 4 tês"
- [ ] Modal ✨ Bomba → template "Bomba do Coletor Solar" encontra candidatos (precisa ter bomba cadastrada com `vazaoM3h >= 5.97` no technicalSpecs E `usedInPool=true`)
- [ ] Se ainda nao achar: verificar `poolType` das bombas vs filtro do template ("Bombas diversas") e regra `Company.systemConfig.pool.solarBombaRule`

---

## Versao anterior: v1.12.39 — Sessao 211 fechada (21 releases)

Sessao 211 (25/05/2026) — maratona de modulo Piscina cobriu 3 frentes principais:
1. Tela de orcamento (etapas custom, modal +Linha, tipos PRODUCT/SERVICE, ordem das linhas)
2. Simulador Solar (coletor do simulador, perda de carga Darcy-Weisbach, curva da bomba)
3. Bugs universais (FormData upload, sortOrder negativo, dropdown tipos)

Detalhes de cada release em `git log` (tags v1.12.19 → v1.12.39).

## ✅ Pendentes pra TESTAR (em prod)

Apos o usuario recarregar a pagina (Ctrl+F5), validar:

### Orcamento de Piscina (/quotes/pool/[id])
- [ ] Card vazio mostra 3 botoes (+ Adicionar linha, + Nova etapa, Carregar template Linear)
- [ ] Modal "+ Linha" pede so Nome + Tipo (Produto/Servico) + Etapa
- [ ] Dropdown de etapa lista TODAS (padrao + custom criadas)
- [ ] "+ Nova etapa" dentro do modal reabre o modal ja na etapa criada
- [ ] Linha em etapa CUSTOM_* salva certo (poolSection=String puro, sem bandagem)
- [ ] Mover linha ▲▼ funciona sem erro "sortOrder less than 0"
- [ ] Nova linha entra no FINAL da etapa (max+1)
- [ ] Coluna ITEM mostra slotName, DESCRICAO mostra "Sem produto"/"Sem servico" quando livre
- [ ] Icone ✨ violeta (produto) / 🛠 verde (servico)
- [ ] Auto-link silencioso REMOVIDO: nova linha sempre livre (testar — nao deve auto-vincular por descricao)

### Cadastro de Produto (/products)
- [ ] Modal arrastavel pelo header (cursor-move + ⋮⋮)
- [ ] Aba Piscina → "Servico vinculado" no card Tempo de instalacao
- [ ] Aba Piscina → "Pressao de trabalho (MCA)" entre Vazao e Tubo (ESCONDIDO se ha curva)
- [ ] Aba Piscina → Card "📈 Curva da bomba" aparece se poolType comeca com "Bomba"
- [ ] Contador "X/6 pontos · faltam Y" no titulo do card quando curva obrigatoria
- [ ] Aviso vermelho no card se obrigatorio e faltam pontos; verde quando OK
- [ ] Salvar produto sem curva (quando obrigatoria) erra com mensagem clara
- [ ] Upload de imagem funciona (fix universal FormData v1.12.30)

### Cadastro de Servico (/services)
- [ ] Novo card "🏊 Modulo Piscina" com checkbox "Usado em obras de piscina"
- [ ] Campo "Tipo de equipamento" (poolType) quando checkbox marcado

### Simulador Solar
- [ ] Bloco "🚰 Tubulacao" aparece ANTES da Bomba recomendada
- [ ] Preencher Comprimento + Desnivel → calcula Altura Manometrica Total
- [ ] Card amber: perda dinamica + desnivel + velocidade + tubo escolhido (PVC DN)
- [ ] Card VERMELHO quando velocidade ≥ 2,5 m/s + alerta "AUMENTE O DIAMETRO"
- [ ] Auto-pick funciona: vazao baixa → 32mm, vazao alta → 50/60/75mm
- [ ] Dropdown de DN: trocar manual → badge "manual" + botao "↺ deixar automatico"
- [ ] Defaults: 10 joelhos, 4 tes (refletido em comprimento equivalente)
- [ ] Descricao da Bomba mostra inline "+ altura manometrica de X mca"

### Auto-selecao do produto (modal ✨)
- [ ] Dropdown "Tipo (Piscina)" mostra TODOS os tipos do tenant incluindo "Bombas diversas"
- [ ] Recarrega a lista ao abrir o modal (sem precisar F5)
- [ ] Template novo "☀ Coletor do Simulador Solar" na lista de templates prontos
- [ ] Ao clicar no template, regra fica com useSolarCollector=true (sem filtros)
- [ ] Trocar coletor no Simulador → linha do orcamento com regra "Coletor do Simulador" atualiza automaticamente

### Upload em outras telas (FormData fix universal v1.12.30)
- [ ] Upload de imagem em produtos
- [ ] Upload de imagem em servicos
- [ ] Upload do header do Simulador Solar
- [ ] Foto OS, NFe import, signup foto empresa (deve estar funcionando, foram 12 telas afetadas)

## 🚧 PENDENTES (codigo nao implementado)

### Auto-selecao com curva da bomba interpolada (planejado pra v1.12.40+)
Hoje a auto-selecao da bomba ainda compara `pressaoTrabalhoMca >= alturaTelhadoMca` (1 numero vs 1 numero). Pra ficar 100% fiel ao metodo Solis, falta:
1. Backend: ao aplicar regra "Bomba do Coletor Solar", interpolar a curva da bomba (`Product.pumpCurve`) na altura manometrica calculada pra obter vazao entregue.
2. Aceitar bomba se `vazao_interpolada >= vazaoSolarM3h`.
3. Mostrar indicador na linha do orcamento: "Vazao entregue: X m³/h (folga Y%)".
4. Fallback: bombas sem curva cadastrada usam `pressaoTrabalhoMca` (comportamento atual).

### Configuracoes > Piscina > Defaults de tubulacao
Hoje defaults sao hardcoded (PVC, [32,40,50,60,75], 10 joelhos, 4 tes, 1 reg, 1 valv, fator 20%).
Tela em Configuracoes pra editar e salvar em `Company.systemConfig.pool.pipeDefaults`.

### Auto-selecao de servico: "Seguir produto da linha X"
Schema ja tem `Product.linkedServiceId` (v1.12.22). Falta:
1. `autoSelectRule.followProductLine: cellRef` no schema da rule
2. Frontend AutoSelectModal: novo modo "Seguir servico do produto da linha L_X"
3. Backend: quando linha de SERVICE tem `followProductLine`, le produto da linha referenciada, pega `Product.linkedServiceId`, vincula
4. Reavaliacao automatica quando produto muda

### Pendentes legado (sessao 209)
- ⏳ Rodar SQL `update-solis-procel-sls.sql` (manual)
- ⏳ Configurar regra do Coletor Solar no SLS (UI: ✨ Coletor → filterDescription)
- ⏳ Persistir overrides modo MANUAL em environmentParams
- ⏳ Motor usar overrides em modo MANUAL no calculo
- ⏳ Motor aplicar inclinacao otima ≈ latitude

## 🧪 PROXIMA SESSAO — Onde retomar

Se quiser continuar de onde paramos, ordem recomendada:
1. **Validar tudo da sessao 211** (checklist acima) — confirmar que nao ha regressao
2. **Auto-selecao via curva da bomba interpolada** — fecha o ciclo Solis completo (alta prioridade)
3. **Configuracoes > Piscina > Defaults de tubulacao** — permite tenant ajustar sem deploy
4. **Auto-selecao de servico** — fecha o vinculo Product.linkedServiceId que ja foi cadastrado

## 📚 Memorias criadas / atualizadas

- [memory/bug-etapa-custom-linha-orfao.md](memory/bug-etapa-custom-linha-orfao.md) — caso completo (v1.12.19/20)
- [memory/feedback_etapa_nao_tem_distincao.md](.claude/projects/.../memory/feedback_etapa_nao_tem_distincao.md) — categoria custom = categoria padrao
- [memory/feedback_seguir_padroes_sistema.md](.claude/projects/.../memory/feedback_seguir_padroes_sistema.md) — nunca inventar UI hardcode fora dos padroes
- CLAUDE.md regra #9 atualizada — seguir padroes do sistema antes de criar UI

## Sessao 210 (anterior): v1.12.16 → v1.12.18 — Financeiro

**v1.12.16** — bug do encargo de fatura de cartao quebrando conferencia retroativa (R$ 32,12 em marco e abril/2026 no SLS). Fix em `matchAsCardInvoice`: encargo sem cartao agora recebe `cashAccountId=bankAccountId` pra entrar no balance-compare. `unmatchLine` reverte corretamente. Correcao retroativa do FIN-00577 aplicada via SQL. Criado `ClosedMonthGuardService` que bloqueia qualquer mutacao financeira (match/unmatch/create/update/delete entry, transfer) em mes com conferencia ja batendo. Aplicado em ReconciliationService, FinanceService e TransferService. Ver `memory/bug-encargo-fatura-orfao.md`.

**v1.12.17** — filtro do modal de Conciliacao escondia 16 lancamentos no SLS (FIN-00373 com NFS-e nao aparecia). Causa: `{ notes: { not: { contains: '[REBALANCE_AJUSTE]' } } }` em Prisma+Postgres compila pra `NOT (notes LIKE ...)` que retorna NULL pra rows com `notes=NULL`, e WHERE NULL = FALSE → row excluida silenciosamente. Fix em `finance.service.ts:447` com OR explicito. FIN-00592 (duplicata criada pelo user durante o bug) soft-deletada + saldo TRANSITO ajustado. Ver `memory/bug-filtro-notes-null.md`.

**v1.12.18** — anti-regressao: criado `backend/src/common/util/prisma-null-safe.ts` com helpers `notContainsNullSafe / notEqualsNullSafe / notInNullSafe / notLikeNullSafe`. Aplicado no fix do v1.12.17 como exemplo vivo. Regra obrigatoria adicionada em CLAUDE.md (secao "Filtros Prisma `not:` em Campos Nullable") com tabela perigosos vs seguros. Auditoria do codebase confirmou: nenhum outro bug latente da mesma classe.

## Sessao 209 (anteriores): v1.12.11 → v1.12.15 — Simulador Solar maduro + cadastro de produto alinhado com Procel

Sessao 209 (21/05/2026) entregou 5 releases (v1.12.11 → v1.12.15). Simulador Solar: zoom proporcional auto + manual, catalog real do tenant no AutoSelectModal, cadastro estrito do coletor (description + missingSpecs + erro claro), ✨ Coletor + ✨ Bomba com AutoSelectModal real + persistencia da regra no tenant, vazaoSolarM3h em FORMULA_VARS + template "Bomba do Coletor Solar", aviso amarelo quando sem regra, etapas customizaveis no orcamento (renomear/adicionar/excluir), bug do scroll corrigido, eficiencia em %, alinhamento 100% Procel/Inmetro PBE (Area externa, Producao especifica, Eficiencia, Classificacao A-E, Pressao), imagem do produto (upload no cadastro + uso no header do Simulador), filtro hardcoded de tipoEquipamento substituido por regra do tenant (Company.systemConfig.pool.solarCollectorRule), gerenciador de tipos (poolType) com CRUD + campos obrigatorios por tipo + validacao em camadas, Tab pula '?' do FieldLabel system-wide.
