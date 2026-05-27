# TAREFA ATUAL

## Sessao 213 — em aberto (27/05/2026)

### Ja em prod (v1.12.61)
- **`backend/src/nfse-emission/nfse-emission.service.ts:111`** — `mapFocusError` para 401 cita 2 causas (token invalido OU mensalidade Focus em atraso)
- **`backend/src/tenant/tenant.service.ts:368-394`** — `block()` e `suspend()` early-return se `tenant.isMaster=true` (defense in depth)
- **`backend/src/tenant/asaas.service.ts:1280`** — webhook `SUBSCRIPTION_DELETED/INACTIVATED` ignora tenant master
- **`frontend/src/app/(dashboard)/nfe/saida/page.tsx`** — item "Reenviar NFS-e" no menu de acoes quando status=ERROR

**Bug detectado pos-deploy v1.12.61:** click em "Reenviar NFS-e" nao disparava nada — `NfseEmissionModal` importado de outro modulo (`finance/components/`) nao bundla/monta corretamente em outra rota. JULIANA RPS 29 foi reenviada pelo modal de Financas (autorizada como NFS-e 76). WILSON RPS 28 continua em ERROR — aguarda fix.

### Local — aguardando deploy v1.12.62
- **`backend/src/nfse-emission/nfse-emission.controller.ts`** — novo endpoint `POST /nfse-emission/emissions/:id/retry`
- **`backend/src/nfse-emission/nfse-emission.service.ts:1341+`** — novo metodo `retryEmission()` reaproveita `getEmissionPreview` + snapshot da NfseEmission antiga, monta DTO e chama `emit()`. Backend faz tudo, sem precisar abrir modal no frontend
- **`frontend/src/app/(dashboard)/nfe/saida/page.tsx`** — `handleRetry` agora faz `POST /retry` direto + confirm + toast. ActionsDropdown refatorado com `createPortal` + `pos.right` direto + listener checa `menuRef.contains` (fix: menu deslocado e clicks ignorados)
- **`backend/src/pool-budget/solar-budget.service.ts:setSelectedBomba`** + **`pool-budget.controller.ts`** — aceita `manual: boolean` (default true), salva `bombaManuallySelected` em `environmentParams.solarReport`
- **`frontend/src/components/pool/HeatingSimulatorModal.tsx`** — `useEffect` da bomba solar so preserva a selecao se `bombaManuallySelected===true` E ainda na lista. Caso contrario adota primeiro candidato (default da regra) — sem persistir. Fix bug v1.12.43: reduzir coletores nao recalculava bomba ja escolhida (ficava super-dimensionada)

Bug raiz que motivou os guards:
- SLS tinha Subscription Asaas ativa apesar de `isMaster=true` (bypass interno nao cancela sub Asaas externa)
- Cancelei sub `sub_uae6vnrmtrpuowz8` via API → webhook chegou e suspendeu SLS (`status=SUSPENDED`, `blockReason='Assinatura cancelada'`) por ~30min
- Revertido manualmente via SQL. Guards agora previnem repeticao
- Cobranca vencida R$ 397 cancelada pelo usuario no painel Asaas

Memorias atualizadas:
- [memory/project_ismaster_bypass_billing.md](memory/project_ismaster_bypass_billing.md) — adicionado incidente v1.12.61 + SQL de reversao
- [memory/feedback_perguntar_antes_deploy.md](memory/feedback_perguntar_antes_deploy.md) — NOVA: perguntar antes de deploy

## Versao atual em prod: v1.12.60 — Sessao 212 fechada (22 releases)

Sessao 212 (26/05/2026) foi maratona no modulo Piscina, focada em **3 frentes principais**:

1. **Bomba do Coletor Solar (auto-select)** — cadeia completa do bug "Nenhum candidato passa"
2. **Formula de vazao oficial Solis** — confirmacao tecnica + algoritmo simetrico de baterias
3. **UI do Simulador Solar** — dropdown de candidatos, diagrama visual de instalacao, compactacao geral

22 releases: v1.12.39 → **v1.12.60**.

## Cronologia das 22 releases

### Caso "Bomba do Coletor Solar — Nenhum candidato passa" (5 releases)
- **v1.12.40** — Backend: `extractSolarVars` populou `vazaoSolarM3h` (faltava)
- **v1.12.41** — Backend: `auto-select.helper` passou a interpolar `pumpCurve` quando candidato tem curva cadastrada
- **v1.12.42** — Frontend: `dimVars` do AutoSelectModal e `ruleVars` do CatalogPickModal populaA m `alturaTelhadoMca` (bug visivel intermediario)
- **v1.12.43** — Backend `listSolarBombaCandidates` + endpoint `GET /pool-budgets/:id/solar-bomba-candidates` + dropdown na pagina (substitui string fixa `getBombaRecomendadaSolar`)
- **v1.12.46/47** — `/products/for-pool-simulator` + frontend mescla Products do tenant no `catalog` do AutoSelectModal (resolveu dessincronizacao fonte preview vs backend)

Memoria: [feedback_autoselect_vars_frontend_backend.md](memory/feedback_autoselect_vars_frontend_backend.md) — regra de ouro pra adicionar variavel nova no motor (atualizar nos **4 lugares**: backend `extractXVars` + `ALLOWED_VARS`, frontend `dimVars` + `ruleVars`).

### Formula de vazao Solis oficial (1 release central + 2 fixes UX)
- **v1.12.48** — formula validada contra 2 exemplos da Solis (15col/3bat=2,8m³/h, 20col/4bat-2serie=5,64m³/h). Regras: max 7 col/bat, max 30 m²/bat, max 3 bat/serie, vazao=`num_ramos × col_por_bat × area × 0,252`.
- **v1.12.49** — 3 cards de baterias (total/serie/paralelo) + backend respeita area/volume override no recompute.
- **v1.12.51** — Botao Recalcular passa `dispArea/dispVolume` no body quando modo MANUAL.
- **v1.12.52** — **Algoritmo SIMETRICO de baterias**: forca distribuicao igual em todos os ramos (sem 3+3+1). Botoes "Salvar/Limpar override" persistem area/volume manuais em `environmentParams.solarOverride` (NAO altera `poolDimensions`).

Memoria: [study_solar_vazao_base_teorica.md](memory/study_solar_vazao_base_teorica.md) — estudo completo + sources industriais.

### Bugs UX intermediarios (3 releases)
- **v1.12.39 → v1.12.40 (texto)** — Defaults da tubulacao no aviso (10 joelhos, 4 tes) — fix em `HeatingSimulatorModal:2030`.
- **v1.12.50** — Card "Baterias em paralelo: 0" quando ha 1 ramo unico (era "1" matematicamente, mas conceitualmente confuso).

### Diagrama da instalacao + Imagem da bomba (8 releases)
- **v1.12.53** — Card "Coletores por bateria" + imagem da bomba selecionada (96x96, mesma estetica do coletor) + **diagrama SVG inicial** (ramos verticais).
- **v1.12.54** — Compactacao da UI: header, toolbar, tubulacao 50% menos altura.
- **v1.12.55** — Container do diagrama com tamanho **FIXO** (170px) + Kpis super compactos + stepper −/+ no extra coletores + comprimento/desnivel inline.
- **v1.12.56** — Diagrama refeito no padrao Solis: baterias HORIZONTAIS em serie + ramos EMPILHADOS verticalmente + troncos azul/vermelho.
- **v1.12.57** — Labels ALIMENTACAO/RETORNO 75% menores + ancoragem start/end pra nao cortar.
- **v1.12.58** — Container 140px (era 220) + **placas solares visuais** dentro de cada bateria (N coletores reais).
- **v1.12.59** — Coletor preto + cabecotes + mangueiras verticais paralelas (estilo Solis Tropicos).
- **v1.12.60** — Coletor v2: 8 mangueiras (em vez de 5) + cabecotes mais espessos com highlight 3D + corpo preto puro. ✅ Aprovado pelo usuario.

## Estado da regra `solarBombaRule` no tenant SLS
Atualmente: `filterPoolType="Bomba"`, `filterDescription="Bomba"`, `where="vazaoM3h >= vazaoSolarM3h && pressaoTrabalhoMca >= alturaTelhadoMca"`, `orderBy="vazaoM3h asc"`, indicator de folga.

Catalogo SLS tem 12 bombas usaveis (poolType="Bombas diversas"). Pro filtro funcionar, o usuario PRECISA mudar `filterPoolType="Bombas diversas"` no botao ✨ do Simulador (ou via SQL direto).

## Mudancas estruturais importantes

### Backend
- `solar.service.ts:140-195` — algoritmo de baterias SIMETRICO (busca combinacao `(ramos × bat × col)` com menor excesso)
- `solar.service.ts` SolarReport adicionou `numRamosParalelos` + `batPorRamo`
- `solar-budget.service.ts:listSolarBombaCandidates` + `setSelectedBomba` + `setSolarOverride` (3 metodos novos)
- `solar-constants.ts` — constantes Solis oficiais (0.252, max 7 col, max 30m², max 3 serie)
- `dto/solar-simulate.dto.ts` — DTO aceita `areaPiscinaM2`, `volumeM3` override
- `pool-budget.controller.ts` — 3 endpoints novos: `solar-bomba-candidates` (GET), `solar-bomba-selection` (POST), `solar-override` (POST)
- `product.service.ts:listForPoolSimulator` + `product.controller.ts` GET `/products/for-pool-simulator`
- `auto-select.helper.ts:interpolatePumpCurve` + `extractCandidateSpecs` (refator de `filterByWhere`/`orderCandidates`)
- `formula-eval.ts:extractSolarVars` populou `vazaoSolarM3h`

### Frontend
- `HeatingSimulatorModal.tsx` — dropdown bomba + imagem + diagrama SVG + override area/volume + stepper +/-
- `quotes/pool/[id]/page.tsx` — dimVars e ruleVars com `alturaTelhadoMca` + `vazaoSolarM3h`. Catalog mescla Products do tenant.
- `products/page.tsx:2022` — "Vazao maxima (m³/h)" + tooltip novo (so dimensiona ralo de fundo)

## Pendentes pra proxima sessao

### Aguardando Solis
- Confirmar comportamento com 7+ baterias (3 ramos paralelos) — testar caso real
- Validar se `volume` deveria entrar no dimensionamento de coletores (hoje so afeta simulacao termica mensal)

### Roadmap
- **Configuracoes > Piscina > Defaults de tubulacao** — hoje hardcoded em `solar-constants.ts` (PVC, [32,40,50,60,75], 10 joelhos, 4 tes, 1 reg, 1 valv, fator 20%). Tela em Configuracoes pra editar e salvar em `Company.systemConfig.pool.pipeDefaults`.
- **Auto-selecao de servico: "Seguir produto da linha X"** — schema ja tem `Product.linkedServiceId`. Falta `autoSelectRule.followProductLine: cellRef` + UI + backend.
- **Pendentes legado (sessao 209):** SQL `update-solis-procel-sls.sql` (manual), configurar regra do Coletor Solar no SLS, persistir overrides modo MANUAL em environmentParams, motor aplicar inclinacao otima ≈ latitude

## Memorias atualizadas/criadas
- [memory/feedback_autoselect_vars_frontend_backend.md](memory/feedback_autoselect_vars_frontend_backend.md) — incidente v1.12.40 → v1.12.47 (vars duplicadas + fonte de candidatos duplicada)
- [memory/study_solar_vazao_base_teorica.md](memory/study_solar_vazao_base_teorica.md) — base teorica + validacao oficial Solis + implementacao v1.12.48

---

## Versao anterior: v1.12.39 — Sessao 211 fechada (21 releases)

Sessao 211 (25/05/2026) — maratona de modulo Piscina cobriu 3 frentes principais:
1. Tela de orcamento (etapas custom, modal +Linha, tipos PRODUCT/SERVICE, ordem das linhas)
2. Simulador Solar (coletor do simulador, perda de carga Darcy-Weisbach, curva da bomba)
3. Bugs universais (FormData upload, sortOrder negativo, dropdown tipos)

Detalhes de cada release em `git log` (tags v1.12.19 → v1.12.39).
