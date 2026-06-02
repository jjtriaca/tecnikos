# TAREFA ATUAL

## Prod: v1.12.99 (alinhado local == prod). Sessao 216 — Sistema de Borda Infinita FASE 1 NO AR.

## CONCLUIDO na sessao 215 (Aba Bomba de Calor — clone visual da Solar)
- ✅ **A** (v1.12.96) vazao min/max no cadastro Bomba de Calor.
- ✅ **B** (v1.12.96) auto-selecao configuravel: heatingRule + GET/POST /pool-budgets/heating/rule.
- ✅ **C** (v1.12.97) `BombaCalorTab` = datasheet A4 de bomba (HeatingSimulatorModal.tsx ~3259):
     toolbar/zoom/print bomba-pdf 1 pagina, Cliente/Obra, Dimensoes, Configuracao, Dimensionamento
     (calor + Equipamento + COP + ✨ regra), Simulacao consumo, footer NBR.
- ✅ **C2** (v1.12.98) imagem do produto selecionado no datasheet + cards Cascata/SPA/Borda (ExtraImpactCard) na Configuracao.

## VALIDACAO DO MOTOR DE AQUECIMENTO (01/06)
- Diferenca vs planilha Tholz TAB006 era INPUTS (vento Forte vs Moderado; cidade Primavera do Leste, mais
  fria, vs MT-generico/Cuiaba; extras cascata/SPA), NAO bug. Formula validada. Usuario confirmou mudando vento.
- Auto-selecao bomba: filtrar por TIPO (poolType "Bomba de calor"), nao so descricao (produtos Tholz = "Trocador").

## FRENTE ATUAL: SISTEMA DE BORDA INFINITA — FASE 1 DEPLOYED em prod (v1.12.99) (sessao 216)
**Plano completo:** [memory/plano_sistema_borda_infinita.md](memory/plano_sistema_borda_infinita.md)
Multi-linha no orcamento (estilo "Dimensoes"): linhas MASTER/SLAVE; captacao = reservatorio OU canaleta+ralos;
caimento = desnivel/comprimento; curvas roubam caimento; topologia estrela. Objetivo: numeros prontos -> FASE 2 (aquecimento).
Checklist FASE 1:
- ✅ Estudo volume reservatorio: [study_borda_infinita_reservatorio.md](memory/study_borda_infinita_reservatorio.md).
- ✅ Estudo tubulacao gravidade (Manning): [study_borda_infinita_tubulacao_gravidade.md](memory/study_borda_infinita_tubulacao_gravidade.md).
- ✅ Modelo de linha + 3 decisoes travadas (desnivel / curvas roubam caimento / estrela) — sessao 216.
- ✅ **`backend/src/pool-budget/gravity-flow.service.ts`** (Injectable, irmao do pipe-head-loss): Manning tubo
  parcial + `sizeGravityPipe` (dimensiona DN). VERIFICADO numericamente (meio-cheio=0,5×cheio; 8m->DN150).
- ✅ **`reservoir-volume.service.ts`**: volume do master (surge + banhistas + 450 L/m) + ALERTA (bomba puxa direto -> cavitacao/transbordo se baixo). VERIFICADO (4×8 -> rec 3,6 / min 1,6 m³).
- ✅ **`borda-infinita.service.ts`** (orquestrador: compoe gravity+reservoir; 3 modos de captacao + totais) + `dto/borda-infinita-simulate.dto.ts` + endpoint **`POST /pool-budgets/borda-infinita/simulate`** + registrado no module. Typecheck OK + smoke-test 4 cenarios (reservatorio/DIRETO/curvas/master BAIXO) VERDE.
- ✅ Storage: `poolDimensions.bordaInfinita[]` (JSON livre — modal salva via PUT /pool-budgets/:id; sem model Prisma, sem migration).
- ✅ Frontend: `components/pool/BordaInfinitaModal.tsx` (multi-linha, calculo ao vivo, alerta do master) + gatilho "🌊 Sistema de Borda Infinita" logo abaixo do bloco de Dimensoes em `quotes/pool/[id]`. (Campo antigo `environmentParams.bordaInfinitaM` MANTIDO ate FASE 2.)
- ✅ DEPLOY **v1.12.99** (01/06) — health OK. O `next build` no servidor validou TS limpo (rota /quotes/pool/[id]); backend validado e2e via curl com token. Bug de foco no modal (componentes aninhados) pego na revisao e corrigido ANTES do deploy.
- ⬜ FASE 2: integrar volume/evaporacao no Simulador de Aquecimento (religar do `bordaInfinita[]` novo; aposentar `bordaInfinitaM`).
- ⚠ PENDENTE validar a TELA em prod (modulo Piscina = teste em prod; preview local nao renderiza tela de tenant).

## Outros pendentes (menores)
- Conferir valores Tholz JA cadastrados no SLS vs datasheet (kcal/h/COP/vazao).
- Remover painel debug violeta apos validacao final. Aguardando Solis (7+ baterias).
- Melhoria: template auto-select "Bomba de Calor" filtrar por Tipo (poolType) em vez de descricao.
- Roadmap: vazao min/max -> bomba de circulacao por curva; defaults tubulacao configuraveis.

## Sessoes anteriores
- Sessao 214 (v1.12.94): modelo consumo bomba solar calibrado, thermal-demand unificado, PDF fixes.
