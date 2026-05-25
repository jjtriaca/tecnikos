# TAREFA ATUAL

## Versao atual em prod: v1.12.38 — Defaults 10/4, Tubulacao acima da Bomba, contador pontos curva

Sessao 211 (25/05/2026), 20 releases:

**v1.12.38** — 4 ajustes de UX e regra:
- **Defaults hardcoded** atualizados: joelhos 4 -> **10**, tês 1 -> **4**. Instalacoes reais de coletor solar tem mais conexoes (joelhos de entrada/saida em cada coletor).
- **Tubulacao acima da Bomba** no Simulador Solar — operador ve a altura manometrica calculada ANTES da Bomba Recomendada (ordem natural: calcula perda -> escolhe bomba). Descricao da Bomba tambem mostra altura manometrica calculada inline.
- **Contador de pontos da curva** no cadastro do Produto: titulo do card agora mostra "(X/6 pontos · faltam Y)" quando tipo exige. Card de aviso vermelho quando faltam, verde quando atinge minimo. Operador ve em tempo real quanto falta sem precisar tentar salvar.
- **Tipos do tenant no dropdown** ja foi implementado em v1.12.37 — operador precisa recarregar a pagina pra ver os tipos novos (cache do frontend).

**v1.12.37** — Tipos do tenant + velocidade ≥ 2.5 + curva da bomba obrigatoria

Sessao 211 (25/05/2026), 19 releases:

**v1.12.37** — 4 ajustes na suite Solar/Bomba:
- **Dropdown de tipo na auto-selecao** agora mostra TODOS os Product.poolType cadastrados no tenant (DISTINCT via `/products/pool-types`), nao so os que ja tem entrada em PoolCatalogConfig. Resolve bug onde tipo recem-cadastrado nao aparecia na regra. Mesclagem feita no `poolTypes` interno do AutoSelectModal.
- **Velocidade ≥ 2,5 m/s** (era > 2,5) ja dispara alerta vermelho — alinha com o limite Solis. `pickOptimalDiameter` agora aceita apenas v < 2,5 (estritamente menor) pra ser considerado suficiente. Aviso no compute usa `>=`.
- **Curva da bomba** virou spec selecionavel no gerenciador de tipos obrigatorios (PRODUCT_SPECS_GROUPED bloco "📈 Curva da bomba"). Operador marca como obrigatoria pra tipo "Bomba" e o save de Product valida.
- **Minimo de pontos da curva** = 6 por default, configuravel via `Company.systemConfig.pool.pumpCurveMinPoints`. Validador rejeita save com mensagem clara: "Curva da bomba (minimo 6 pontos)".

**v1.12.36** — Dropdown de tubo + alerta vermelho quando velocidade > 2,5 m/s

Sessao 211 (25/05/2026), 18 releases:

**v1.12.36** — UX da calculadora de tubulação refinada:
- "Tubo escolhido" vira **dropdown** com diametros disponiveis (`[32, 40, 50, 60, 75]` por default). Operador troca manualmente e recalcula no momento.
- Quando operador deixa em branco -> badge verde "auto" (sistema escolhe pela vazao). Quando muda manualmente -> badge laranja "manual" + botao "↺ deixar automatico" pra voltar.
- Quando velocidade > 2,5 m/s (limite Solis): card vira **vermelho** com alerta destacado "⚠ Velocidade X m/s acima do limite — AUMENTE O DIAMETRO DO TUBO". Igual a planilha Solis em vermelho.
- Fallback de retrocompat: se o `solarPipe` salvo eh antigo (v1.12.34 nao tinha `diametroDnMm` no result), pega do `inputs.diametroMm` ou usa 50 como fallback. Evita "mm DN" vazio na UI.

**v1.12.35** — Auto-pick de diametro PVC [32,40,50,60,75]

Sessao 211 (25/05/2026), 17 releases:

**v1.12.35** — sistema escolhe automaticamente o diametro de tubulacao conforme a vazao do Simulador. Mudancas:
- Material default agora eh PVC (era CPVC).
- Lista de diametros disponiveis embutida (hardcoded por enquanto): `[32, 40, 50, 60, 75]` mm DN externo. Operador configura defaults pelo tenant em fase futura.
- Novo `PipeHeadLossService.pickOptimalDiameter(material, vazao, available[])`: itera do menor pro maior, escolhe o primeiro DN cuja velocidade <= 2,5 m/s (regra Solis). Se nenhum atende, usa o maior + marca como subdimensionado.
- `SolarPipeDto.diametroMm` continua opcional. Sem ele -> auto-pick. Com ele -> forca o valor (futuro override).
- UI no Simulador mostra "📏 Tubo escolhido: PVC 50mm DN (auto) (DI 44mm)" + badge verde "auto" quando foi escolhido pelo sistema. Quando o operador forca diametro manual, badge desaparece.
- Result do compute agora inclui `diametroDnMm`, `diametroInternoMm`, `material` pra exibicao precisa na UI.

**v1.12.34** — Calculadora de perda de carga (Darcy-Weisbach + Haaland)

Sessao 211 (25/05/2026), 16 releases:

**v1.12.34** — replica o metodo da planilha Solis pra calcular perda de carga em tubulacao. Antes: input "Altura do telhado" tinha só a altura geometrica (1m=1MCA grosseiro). Agora: bloco "🚰 Tubulacao" no Simulador com Comprimento + Desnivel, e backend calcula a altura manometrica TOTAL (perda dinamica + desnivel) usando Darcy-Weisbach + aproximacao de Haaland — exatamente como a Solis.

Tabelas embarcadas em `backend/src/pool-budget/pipe-head-loss.service.ts`:
- Rugosidade por material (PVC, CPVC, PPR, COBRE) em mm
- Diametro interno (DI) por material × DN externo (9 tamanhos cada)
- Comprimentos equivalentes (joelho 90, tê, registro gaveta, válvula retenção) por DN
- Densidade + viscosidade da agua por temperatura (0-50°C, lookup table)

Fluxo:
- Operador no Simulador informa Comprimento (m) e Desnivel (m). Onblur dispara `POST /pool-budgets/:id/solar-pipe/recompute`.
- Backend: pega vazaoTotalM3h do solarReport, busca defaults do tenant (`Company.systemConfig.pool.pipeDefaults`) ou usa hardcoded (CPVC 50mm, 20% seguranca, 4 joelhos, 1 tê, 1 registro, 1 valvula), calcula e persiste em `environmentParams.solarPipe = { inputs, result }`. Tambem grava `alturaTelhadoM = alturaManometricaTotal` pra alimentar a var `alturaTelhadoMca` usada na auto-selecao.
- Resultado exibido no Simulador em card amber: "Altura manometrica total: X mca" + breakdown (perda dinamica + desnivel + velocidade m/s) + alerta se velocidade > 2.5 m/s ("aumente diametro").
- `recalculateTotals` chamado apos cada recomputacao — linha "Bomba do Coletor Solar" reavalia automaticamente.

Pendente pra v1.12.35:
- Modal "Configurar tubulacao" pra editar material/diametro/conexoes/fator. Hoje so defaults.
- Configuracoes > Piscina: pipeDefaults editaveis pelo operador (uma vez por tenant).
- Auto-selecao da bomba interpola pumpCurve cadastrada (em vez de comparar com pressaoTrabalhoMca).

**v1.12.33** — Ajustes UX da curva da bomba + modal arrastavel

Sessao 211 (25/05/2026), 15 releases:

**v1.12.33** — ajustes UX no cadastro do v1.12.32:
- **Posicao**: secao "📈 Curva da bomba" movida pra DEPOIS do "🚿 Hidraulico" (ordem natural — primeiro specs principais, depois curva detalhada).
- **Tamanho**: linhas da tabela compactadas (py-0.5, text-xs, padding reduzido). Cabia 4 pontos antes — agora cabe 8+ sem rolar.
- **Redundancia**: campo "Pressao de trabalho (MCA)" do Hidraulico fica ESCONDIDO quando ha curva cadastrada (curva tem mais precisao — a altura maxima eh o primeiro/ultimo ponto). Sem curva, campo aparece como fallback.
- **Modal arrastavel**: header do modal "Editar Produto" agora eh `cursor-move` — clique e arraste pra mover o modal de lugar. Permite olhar informacoes atras dele sem fechar. Cone ⋮⋮ no titulo indica que eh arrastavel. Botao X continua funcionando normal (drag ignora click no botao).

**v1.12.32** — Curva da bomba (cadastro)

Sessao 211 (25/05/2026), 14 releases:

**v1.12.32** — base do calculo correto da bomba (replica metodo Solis). Cadastro de Produto ganha secao "📈 Curva da bomba" com tabela inline de pares (vazao, altura) — aparece somente quando `poolType` comeca com "Bomba". Schema: `Product.pumpCurve Json?` (array de `{vazaoM3h, alturaMca}`). Operador insere os pontos da tabela do manual do fabricante. Auto-selecao vai interpolar a curva na altura manometrica calculada pra ver vazao entregue (v1.12.34). Plano completo em 3 fases: v1.12.32 (cadastro), v1.12.33 (calculadora de perda de carga Darcy-Weisbach no Simulador), v1.12.34 (auto-selecao via curva).

**v1.12.31** — Pressao MCA + Altura do telhado na auto-selecao da bomba

Sessao 211 (25/05/2026), 13 releases:

**v1.12.31** — auto-selecao da bomba do coletor solar agora considera pressao hidraulica alem de vazao. Mudancas:
- **Cadastro Produto** (aba Piscina, card Hidraulico): novo campo "Pressao de trabalho (MCA)" entre Vazao e Tubo de entrada. Grava em `technicalSpecs.pressaoTrabalhoMca`. Disponivel tambem no gerenciador de tipos obrigatorios.
- **Simulador Solar** (lado da Bomba recomendada): novo input "Altura do telhado (m)". Persistido em `environmentParams.alturaTelhadoM` ao perder foco. Cada metro de altura geometrica ≈ 1 MCA estatica.
- **Backend** (DTO + service + formula-eval): aceita `alturaTelhadoM` no recompute do Solar. Expoe `alturaTelhadoMca` como var disponivel em formulas/auto-select via `extractEnvVars`. Whitelist `FORMULA_VARS` atualizada.
- **Template "Bomba do Coletor Solar"**: where ampliado pra `vazaoM3h >= vazaoSolarM3h && pressaoTrabalhoMca >= alturaTelhadoMca`. Bomba so eh selecionada se atender ambos os criterios.

**v1.12.30** — Fix universal de upload (FormData via api.post)

Sessao 211 (25/05/2026), 12 releases:

**v1.12.30** — bugfix critico universal: `api.post(path, fd)` em todo o sistema dava erro "Cannot read properties of undefined (reading 'mimetype')" no backend. Causa: `lib/api.ts` linha 87 fazia `JSON.stringify(options.body)` em TODO body — incluindo `FormData`, que vira `"{}"`. O Multer/UploadedFile do NestJS ficava sem nada pra parsear. Fix: detectar `body instanceof FormData` antes do stringify; quando FormData, passar direto pro fetch e NAO setar Content-Type (browser seta multipart/form-data com boundary correto). Afeta 12 telas de upload (produtos, NFe, simulador solar, signup, settings, fotos OS, etc).

**v1.12.29** — Avisos no Simulador Solar (bombas sem vazao)

Sessao 211 (25/05/2026), 11 releases:

**v1.12.29** — Simulador Solar agora exibe avisos quando o catalogo do tenant nao suporta a auto-selecao da bomba:
- ⚠ Se a regra `solarBombaRule` nao retorna candidatos: avisa qual filtro foi usado e instrui a cadastrar bombas / ajustar a regra.
- ⚠ Se ha candidatos mas nenhum atende a vazaoTotal: mostra a maior vazao cadastrada e a necessaria.
- ℹ Lista N primeiras bombas sem `vazaoM3h` cadastrado (ate 5 nomes) pra operador completar o cadastro.

Backend: `solar-budget.service.ts.computeAndSaveReport` agora chama `computeWarnings()` apos gerar o report e injeta `warnings[]` antes de salvar em `environmentParams.solarReport`. Frontend (`HeatingSimulatorModal`) renderiza os avisos em destaque (amber pra warning, slate pra info) logo abaixo do card "Bomba recomendada".

**v1.12.28** — Recomputar Simulador agora atualiza linhas do orcamento

Sessao 211 (25/05/2026), 10 releases:

**v1.12.28** — bugfix: trocar coletor ou qty no Simulador Solar NAO refletia no orcamento. Causa: `solarBudget.computeAndSaveReport` atualiza `environmentParams.solarReport` mas NUNCA chamava `recalculateTotals` do orcamento — entao formulas com `solarQty` continuavam com valor antigo, e regras `useSolarCollector` nao re-vinculavam. Fix simples no controller `:id/solar-report/recompute`: apos `computeAndSaveReport`, chama `service.recalculateTotals(id)`. Isso re-avalia formulas, re-vincula via `useSolarCollector`, atualiza totais. Sem dependencia circular (controller orquestra ambos services).

**v1.12.27** — Refatora "Coletor do Simulador Solar" pra padrao de Templates

Sessao 211 (25/05/2026), 9 releases:

**v1.12.27** — refactor: a opcao "Usar coletor do Simulador Solar" da v1.12.26 estava implementada como checkbox grande no topo do AutoSelectModal — fora do padrao do sistema. O AutoSelectModal ja tem lista `AUTOSELECT_TEMPLATES` com regras pre-configuradas (Filtro de piscina, Bomba do Coletor Solar, Bomba de Calor, Tubo, Kit Cascata, Kit SPA). Fix:
- Removido o checkbox/card grande do topo do modal.
- Adicionado template novo "☀ Coletor do Simulador Solar" na lista AUTOSELECT_TEMPLATES (mesmo padrao dos outros — icon + label + description + rule).
- applyAutoSelectTemplate agora seta `useSolarCollector` no state do form.
- Backend processing (recalculateTotals) mantido — esse era o padrao certo.
- **Nova regra absoluta em CLAUDE.md (regra #9): SEGUIR PADROES DO SISTEMA — NAO INVENTAR HARDCODE.** Antes de criar UI nova, verificar se ja existe padrao (templates/slots/componentes) no codebase. Ver memory/feedback_seguir_padroes_sistema.md.

**v1.12.26** — Auto-select "Usar coletor do Simulador Solar"

Sessao 211 (25/05/2026), 8 releases:

**v1.12.26** — adicionada opcao "☀ Usar coletor selecionado no Simulador Solar" no modal de Auto-selecao do produto. Quando ativa, ignora filtros e criterios e vincula a linha direto ao coletor do Simulador (lido de `environmentParams.solarReport.selectedCollector.productId`). Se voce trocar o coletor no Simulador, a linha acompanha automaticamente no proximo recalc. Campo novo `autoSelectRule.useSolarCollector` (JSON livre, sem migration).

**v1.12.25** — Nova linha vai pro final (sortOrder = max + 1)

Sessao 211 (25/05/2026), 7 releases:

**v1.12.25** — fix UX: nova linha agora entra no FINAL da etapa (sortOrder = max+1) em vez de no inicio (sortOrder=0 colidindo com items existentes). addItem do backend calcula max(sortOrder da secao) e soma 1. "Se ja tem 5 linhas, a proxima eh a 6a" — ordem natural.

**v1.12.24** — Fix moveItem sortOrder negativo

Sessao 211 (25/05/2026), 6 releases:

**v1.12.24** — bugfix: tentar mover linha pra cima ou pra baixo dava erro "sortOrder must not be less than 0". Causa: addItem cria items com sortOrder=0 default; quando todas as linhas da etapa tinham sortOrder=0, a logica antiga de "swap" gerava -1 (a.sortOrder=0 + dir=-1) violando @Min(0) do DTO. Fix em moveItem: troca posicao no array e RENUMERA todos os items da secao em sequencia consecutiva (0,1,2,...). So envia PUT pros items cujo sortOrder mudou.

**v1.12.23** — Badge "extra" removida (toda linha igual)

Sessao 211 (25/05/2026), 5 releases:

**v1.12.23** — pequeno ajuste de UX: badge laranja "extra" abaixo da descricao de linhas adicionadas manualmente foi removida. Nao faz sentido distinguir linhas adicionadas manualmente das que vieram de template — todas sao iguais funcionalmente. Campo `isExtra` continua no banco pra retrocompat.

Pendente pra v1.12.24:
- **Auto-selecao de servico inteligente**: novo modo "Seguir produto da linha L_X" no AutoSelectModal. Quando ativo, le `Product.linkedServiceId` do produto da linha referenciada e vincula o Service. Atualiza automaticamente quando o produto muda.
- **CatalogPicker pra Service**: filtro por poolType (paridade com produtos).

**v1.12.22** — Product.linkedServiceId + Service.poolType + icone 🛠 pra servico

Sessao 211 (25/05/2026), 4 releases:

**v1.12.22** — fundacao pra auto-selecao de servico inteligente. Adiciona vinculo Produto -> Servico no cadastro, tipo (poolType) no Service pra paridade com Product, e icone visual diferenciado pra linhas de servico no orcamento.

Mudancas:
- **Schema**: `Product.linkedServiceId String?` (FK opcional pra Service, ON DELETE SET NULL no public, sem FK nos tenants — TenantMigrator nao propaga FK em ADD COLUMN). `Service.poolType String?` (paridade com Product.poolType).
- **Migration Prisma**: ADD COLUMN + FK no public + indices. Tenants ganham so as colunas via TenantMigratorService (FK opcional, integridade validada pelo backend).
- **DTOs Product**: aceita `linkedServiceId` (Create + Update).
- **DTOs Service**: aceita `poolType`, `useInPool`, `useInServiceOrder`, `technicalSpecs`, `imageUrl` (paridade).
- **Cadastro Produto (UI)**: card "Tempo de instalacao" agora tem 2 colunas — Tempo de montagem + Servico vinculado (select alimentado por `/services?usage=pool&limit=500`).
- **Cadastro Servico (UI)**: novo card "Modulo Piscina" com checkbox "Usado em obras de piscina" e (quando ativo) campo "Tipo de equipamento". Mesma estrategia do Product.poolType.
- **Icone na linha de servico**: trocado ✨ (violeta) por 🛠 (emerald) quando `item.kind === 'SERVICE'`. Modal de auto-selecao agora mostra titulo apropriado (servico vs produto).

Pendente pra v1.12.23:
- **Auto-selecao de servico inteligente**: novo modo "Seguir produto da linha L_X" no AutoSelectModal. Quando ativo, le `Product.linkedServiceId` do produto da linha referenciada e vincula o Service. Atualiza automaticamente quando o produto muda.
- **CatalogPicker pra Service**: filtro por poolType (paridade com produtos).

**v1.12.21** — Linha tem tipo (Produto/Servico) + "Sem produto"/"Sem servico" placeholder

Sessao 211 (25/05/2026), 3 releases:

**v1.12.21** — Linha de orçamento ganha campo `kind` explicito (PRODUCT|SERVICE), removendo heuristica antiga que inferia tipo do productId/serviceId vinculado. Mudancas:
- **Schema**: `PoolBudgetItem.kind String @default("PRODUCT")`. Migration ADD COLUMN com backfill (SERVICE se serviceId not null).
- **Script SQL tenants**: `scripts/sql/v1.12.21-kind-backfill-tenants.sql` — TenantMigratorService propaga ADD COLUMN automaticamente (default NOT NULL), mas backfill SERVICE precisa script manual.
- **DTO**: `kind?: 'PRODUCT'|'SERVICE'` com `@IsIn`. Aceito tanto no create quanto update.
- **Modal**: toggle Produto/Servico (botoes grandes ao lado). Nome digitado agora vai pra `slotName` (coluna ITEM da tabela), nao mais pra `description`. `description` fica vazio — vira o placeholder "Sem produto"/"Sem servico" na tabela.
- **Tabela**: coluna DESCRICAO quando vazia mostra "Sem produto" ou "Sem servico" baseado em kind. Clicar abre picker.
- **Picker (🔍)**: filtra catalogo por kind. Toggle "So produtos"/"So servicos" no header (default ON, operador desativa pra ver tudo).
- **isServicoItem helper**: usa `item.kind === 'SERVICE'` direto. Heuristica unidade hora removida.
- **applyLinearTemplate**: define kind baseado em se o item do template vinculou a service (SERVICE) ou produto (PRODUCT).

## Sessao 211 anteriores: v1.12.19, v1.12.20

**v1.12.20** — usuario pediu refatoracao do v1.12.19. A abordagem do v1.12.19 (`customSectionKey` como bandagem + `poolSection=OUTROS` fallback) criava distincao tecnica entre etapas padrao e custom: siblings de formula misturavam entre etapas custom diferentes (todas com `poolSection=OUTROS`). Regra do usuario: **uma etapa criada nova nao tem distincao de uma que ja existe**.

Fix correto:
- **Schema**: `PoolBudgetItem.poolSection PoolSection` -> `String @default("CONSTRUCAO")`. Coluna `customSectionKey` REMOVIDA. Indice associado dropado.
- **Migration Prisma**: `ALTER COLUMN poolSection TYPE TEXT USING ... ::text` + `DROP COLUMN customSectionKey`. So no schema public — TenantMigratorService nao propaga ALTER COLUMN TYPE.
- **Script SQL standalone**: `scripts/sql/v1.12.20-poolsection-text-tenants.sql` itera schemas `tenant_*` e aplica a mesma mudanca. Rodado manualmente apos o deploy via SSH.
- **DTOs**: `@IsEnum(PoolSection)` -> `@IsString() @MinLength(1) @MaxLength(64) @Matches(/^[A-Z0-9_]+$/i)`. Aceita qualquer chave (enum padrao OU CUSTOM_*).
- **Service**: removido `customSectionKey` do create/update. Removido **auto-link silencioso por descricao** em 3 lugares (addItem PASSO inicial, updateItem, recalculateTotals PASSO -1). Linha sempre vem livre — operador vincula manualmente via ✨.
- **Frontend**: removido helper `effectiveSection`, type `customSectionKey`, transformacao CUSTOM_*->OUTROS+customSectionKey. Volta a usar `it.poolSection` direto. Itens em etapa custom enviam `poolSection: 'CUSTOM_*'` diretamente — backend aceita.
- Outros models (`PoolCatalogConfig`, `PoolProjectStage`, `PoolBudgetTemplate.itemsSnapshot`) continuam usando enum `PoolSection` (nao afetados pelo bug).

Continuam funcionando do v1.12.19:
- Modal `Adicionar item` super simples (Nome + Etapa).
- Orcamento vazio mostra 3 botoes (+ Adicionar linha, + Nova etapa, Carregar template Linear).
- "+ Nova etapa" no modal Adicionar item reabre o modal ja na etapa criada.

**v1.12.19** (substituido pelo v1.12.20) — primeira tentativa: campo `customSectionKey` como bandagem + `poolSection=OUTROS` fallback. Bagulho funcionava na criacao mas misturava siblings de formula entre etapas custom diferentes. Usuario corrigiu o approach. Mantido na historia git pra rastreabilidade.

## Sessao 210 (anterior): v1.12.16 → v1.12.18 — Financeiro

**v1.12.16** — bug do encargo de fatura de cartao quebrando conferencia retroativa (R$ 32,12 em marco e abril/2026 no SLS). Fix em `matchAsCardInvoice`: encargo sem cartao agora recebe `cashAccountId=bankAccountId` pra entrar no balance-compare. `unmatchLine` reverte corretamente. Correcao retroativa do FIN-00577 aplicada via SQL. Criado `ClosedMonthGuardService` que bloqueia qualquer mutacao financeira (match/unmatch/create/update/delete entry, transfer) em mes com conferencia ja batendo. Aplicado em ReconciliationService, FinanceService e TransferService. Ver `memory/bug-encargo-fatura-orfao.md`.

**v1.12.17** — filtro do modal de Conciliacao escondia 16 lancamentos no SLS (FIN-00373 com NFS-e nao aparecia). Causa: `{ notes: { not: { contains: '[REBALANCE_AJUSTE]' } } }` em Prisma+Postgres compila pra `NOT (notes LIKE ...)` que retorna NULL pra rows com `notes=NULL`, e WHERE NULL = FALSE → row excluida silenciosamente. Fix em `finance.service.ts:447` com OR explicito. FIN-00592 (duplicata criada pelo user durante o bug) soft-deletada + saldo TRANSITO ajustado. Ver `memory/bug-filtro-notes-null.md`.

**v1.12.18** — anti-regressao: criado `backend/src/common/util/prisma-null-safe.ts` com helpers `notContainsNullSafe / notEqualsNullSafe / notInNullSafe / notLikeNullSafe`. Aplicado no fix do v1.12.17 como exemplo vivo. Regra obrigatoria adicionada em CLAUDE.md (secao "Filtros Prisma `not:` em Campos Nullable") com tabela perigosos vs seguros. Auditoria do codebase confirmou: nenhum outro bug latente da mesma classe.

## Sessao 209 (anteriores): v1.12.11 → v1.12.15 — Simulador Solar maduro + cadastro de produto alinhado com Procel

Sessao 209 (21/05/2026) entregou 5 releases (v1.12.11 → v1.12.15). Simulador Solar: zoom proporcional auto + manual, catalog real do tenant no AutoSelectModal, cadastro estrito do coletor (description + missingSpecs + erro claro), ✨ Coletor + ✨ Bomba com AutoSelectModal real + persistencia da regra no tenant, vazaoSolarM3h em FORMULA_VARS + template "Bomba do Coletor Solar", aviso amarelo quando sem regra, etapas customizaveis no orcamento (renomear/adicionar/excluir), bug do scroll corrigido, eficiencia em %, alinhamento 100% Procel/Inmetro PBE (Area externa, Producao especifica, Eficiencia, Classificacao A-E, Pressao), imagem do produto (upload no cadastro + uso no header do Simulador), filtro hardcoded de tipoEquipamento substituido por regra do tenant (Company.systemConfig.pool.solarCollectorRule), gerenciador de tipos (poolType) com CRUD + campos obrigatorios por tipo + validacao em camadas, Tab pula '?' do FieldLabel system-wide.

## Pendentes (nao bloqueiam release)

- ⏳ **Rodar SQL `update-solis-procel-sls.sql`** (manual) — atualiza os 5 Solis no SLS pra NEW TROPICOS 2000-6000 oficial Procel (preserva preco, atualiza description + areaM2 + kwhPorM2 + eficiencia + classeEficiencia + pressao). Apos rodar, conferir Simulador.
- ⏳ **Configurar regra do Coletor Solar no SLS** — abrir Simulador, clicar ✨ Coletor, definir `filterDescription: "Coletor solar"` (ou outro filtro), Aplicar regra. Ate la o dropdown fica vazio com aviso amarelo.
- ⏳ Persistir overrides do modo MANUAL em `environmentParams` (tipoConstrucao, modoDimensao, lenOverride, etc — hoje state local UI-only).
- ⏳ Motor usar overrides em modo MANUAL no calculo.
- ⏳ Motor aplicar inclinacao otima ≈ latitude (hoje so persiste).
