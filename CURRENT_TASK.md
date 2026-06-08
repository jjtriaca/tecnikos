# TAREFA ATUAL

## 📌 Frente "Bomba de recirculacao da Bomba de Calor" — CONCLUIDA + DOCUMENTADA (v1.13.14→v1.13.17). Doc completa: [memory/bomba_recirculacao_calor.md]. Testes PARQUEADOS (usuario vai validar depois).
## 📌 Frente ATUAL: **FISCAL (NFS-e)** — v1.13.18→v1.13.26 NO AR. **v1.13.22 = fix do 495 (Cenario B)**. **ACHADO (v1.13.24/25)**: SLS = setup MANUAL na Focus (`focusNfeCompanyId` vazio + tokens colados) → o botao "Registrar empresa" (caminho da plataforma/token de revenda) **NAO se aplica** ao SLS (da `requisicao_invalida`). **Pro SLS o Cenario B se faz NO PAINEL da Focus**: desabilitar "Ambiente da NFSe Nacional" (manter NFSe padrao ON) — com Layout=Nacional aqui, emite via Rlz. v1.13.24=provider expoe corpo do erro; v1.13.25=botao detecta setup manual; **v1.13.26=tirou `pTotTribSN` (XSD)**. **✅ RESOLVIDO (08/06/2026):** o 495 era **config NOSSA** — `nfseLayout` estava em **NACIONAL** (-> `/v2/nfsen` -> Focus postava DPS direto no ADN -> 495, SLS nao credenciada no ADN). **Voltar pra MUNICIPAL** (`/v2/nfse` -> municipio Rlz/ABRASF) resolveu: **RPS 28 -> NF 79, RPS 33 -> NF 80 autorizadas.** Config que funciona: `nfseLayout=MUNICIPAL` + painel Focus (Ambiente Nacional OFF + Certificado Exclusivo ON). Certificado da SLS = sadio (testado: valido 26/08/2026, nao revogado, cadeia completa) — nunca foi o cert. LICAO: suspeitar da config propria ANTES de culpar o provedor (Juliano cravou). Transicao Rlz: ABRASF vale ate jun/2026; jul+ so DPS Nacional (confirmar roteamento com Focus antes de julho). Pendencia: RPS 32 (R$5.430 errada) segue ERROR = EXCLUIR. Doc: [memory/nfse-nacional-cenario-b.md].

## ✅ DEPLOYED v1.13.22 (06/06) — NFS-e NACIONAL Cenario B (resolve o 495) + solidez de erros
## - **Causa do 495**: Primavera do Leste usa FORMATO nacional mas NAO opera no Ambiente Nacional (ADN). `registerEmpresa` em NACIONAL ligava `habilita_nfsen` (ADN) — e o flag ligado fazia o Focus rotear pro ADN ate em MUNICIPAL -> "495 invalid certificate" (recusa no TLS; NAO e validade do cert). Guia Focus: `/v2/nfsen` + `habilita_nfse` ON, `habilita_nfsen` OFF.
## - **Fix**: (1) registerEmpresa NACIONAL = Cenario B (liga habilita_nfse, desliga habilita_nfsen EXPLICITO); (2) payload ganhou `indicador_total_tributacao` (obrigatorio, faltava); (3) guards NACIONAL (IBGE + cTribNac 6 digitos) + cTribNac limpo; (4) `mapFocusError` +6 erros conhecidos + parametro `stage` (erro nao catalogado mostra a ETAPA: emissao/consulta/cadastro/certificado + texto cru).
## - **TESTE PENDENTE (3 passos no painel)**: Config>Fiscal Layout="Nacional" -> "Registrar empresa" -> retentar RPS 33. SLS ja tem IBGE 5107040 + cTribNac 070202/140601 + IM (passa nos guards).
## - Cenario C (ADN puro/MEI) = follow-up (flag nfseAmbienteNacional). Doc: [memory/nfse-nacional-cenario-b.md].

## ✅ DEPLOYED v1.13.19 (05/06) — branding da pagina /rate DENTRO do card
## - Logo do tenant no LUGAR da estrela azul do card + RAZAO SOCIAL (Company.name, ex "SLS OBRAS LTDA") embaixo. Removido logo/nome que ficava ACIMA do card (rate/layout.tsx). Em todos os estados (form/sucesso/ja-avaliado/erro). Backend `tenant-branding.controller` branding agora devolve `razaoSocial` (companyName seguia = tradeName "SLS"). Pagina busca branding client-side pelo subdominio; generateMetadata (OG) mantido.

## ✅ DEPLOYED v1.13.18 (05/06) — aviso de VALIDADE do certificado digital
## - Tela Fiscal mostra validade (`certificado_valido_ate` via Focus getEmpresa, token de revenda; cache 1h, `?force=true` na tela atualiza). Card na barra superior (HeaderBilling): AMARELO ≤15 dias, VERMELHO no vencimento/vencido, persiste ate atualizar. Endpoint `GET /nfse-emission/cert-status` (sem @Roles, qualquer user logado).

## ✅ DEPLOYED v1.13.21 (06/06) — fix cron NFS-e PROCESSING (rodava SEM contexto de tenant)
## - Os 2 crons (poll 2min + timeout 1h) que destravariam notas em PROCESSING faziam `this.prisma.nfseEmission.findMany` SEM contexto de tenant -> caiam no schema `public` (0 linhas) -> NUNCA tocavam notas dos tenants. Sintoma: RPS 28 do SLS travada PROCESSING ha 11 dias; RPS 33 nao saia sozinha. ScheduleModule ESTAVA registrado (crons disparavam, so olhavam o schema errado). Fix: ambos iteram `tenantResolver.getActiveTenants()` + `runInTenantContext` (igual webhook); injetado TenantResolverService no service. GERAL (todos os tenants). Pos-deploy: RPS 28 vira ERROR no proximo timeout (≤30min); RPS 33 quando passar de 1h.

## ✅ DEPLOYED v1.13.20 (05/06) — botao "Excluir nota com erro"
## - `deleteErrorEmission` (SO status==ERROR; desvincula financialEntries -> "sem nota", NAO apaga lancamento; libera rpsNextNumber se for o ultimo da seq, senao deixa gap — prefeitura aceita p/ RPS rejeitada). `DELETE emissions/:id` (Roles ADMIN/FINANCEIRO/FISCAL+FiscalGuard). Front: item "Excluir nota" no dropdown so p/ ERROR (nfe/saida). Uso: RPS 32 (R$5.430 errada) -> excluir; RPS 33 (R$3.620) CORRETA -> manter.

## 📋 Erro 495 (NFS-e) — **RESOLVIDO em v1.13.22** (era config de Cenario B, NAO chamado Focus). Ver bloco v1.13.22 + [memory/nfse-nacional-cenario-b.md].

## ✅ DEPLOYED v1.13.17 (05/06) — Bomba de RECIRCULACAO da Bomba de Calor (paridade Solar) + horas por DEMANDA LIQUIDA
## - **v1.13.17 (templates da recirc):** (1) template de REGRA "🚰 Bomba de circulacao (Bomba de Calor) — vazao + altura/inercia" em AUTOSELECT_TEMPLATES (where `vazaoM3h >= vazaoSolarM3h && pressaoTrabalhoMca >= alturaTelhadoMca`; a altura ja vem com inercia = max(atrito,desnivel)). (2) template de INDICADOR "Vazao dentro x fora da faixa (Bomba de Calor)" em INDICATOR_TEMPLATES — value = % FORA da faixa [min,max]: negativo=abaixo do min, 0=dentro, positivo=acima do max (igual folga% solar). (3) **threading `vazaoMaxM3h`** (var NOVA): backend `listBombaCandidatesByFlow(...,vazaoMaxAlvoM3h)` baseVars + controller `trocador-bomba-candidates?vazaoMax=` + card URL + siblingVars do modal + allowed-vars FORMULA list. Preview do modal injeta vazaoSolarM3h/vazaoMaxM3h via siblingVars (senao pegava a vazao da solar=0). Tudo ADITIVO.
## - **v1.13.16 (3 coisas):** (1) **✨ regra INDEPENDENTE** da bomba de circulacao do calor — `Company.systemConfig.pool.trocadorBombaRule` (separada da solarBombaRule), endpoints `GET/POST /pool-budgets/heating/bomba-rule`, `listBombaCandidatesByFlow(...,ruleKey)` com FALLBACK pra solar quando vazia. ✨ no card + `ruleVersion` re-busca candidatos ao salvar. (2) **Card "Vazão de água (mín–máx)"** abaixo do Equivalente Btu (cadastro `vazaoMin/MaxM3h` × qtd, soma paralelo). (3) **Restyle card equipamento** (verde border-2 emerald → SectionLabel "Bomba de calor selecionada" + dropdown ambar + card branco). Tudo aditivo/visual — nenhum calculo existente alterado.
## - **v1.13.15:** layout do card recirculacao EMPILHADO (igual Solar): "Tubulacao — perda de carga" (largura total) + "Bomba de circulacao recomendada" (dropdown + card). Antes grid 2-col.
## - **Card recirculacao = igual ao Solar:** imagem + specs (cv/vazao/pressao/preco) + indicador "Dimensionamento: X%" + 💡 tarifa (tenant global, mesma do Solar) + CONSUMO ELETRICO MENSAL = media anual ÷ 12 (`P=cv×0.7355/0.65 × horas_mes × dias`, soma 12 meses /12).
## - **Horas reais por mes = DEMANDA LIQUIDA (perda − ganho solar):** `horas/dia = (qtotalKw×24 − ganhoSolar) ÷ capacidade`, cap na janela `horasFuncionamentoDia`. Inverno↑ / verao↓ (capa+alvo baixo → perto de zero) / alvo↑→ΔT↑→mais horas / bomba maior→menos horas. Ganho solar reusa `radSolMonthly` do clima (mesma base do Solar). Constantes `POOL_SOLAR_GAIN` em heating-constants (absorcao 0.8; **capa azul transmite 0.5** — calibravel; capa azul ≠ coletor preto). Backend: `heating.service` computeReport expoe `operatingHoursPerMonth/Avg/Debug`.
## - **Validacao visivel:** tabela "Perda termica mensal" ganhou linhas **☀ Ganho solar (kWh/d)** + **⏱ Horas/dia bomba**.
## - **Tubulacao = circuito FECHADO:** opera no ATRITO (sifao cancela o estatico depois que circula), MAS a SELECAO usa `max(atrito, desnivel)` pra ROMPER A INERCIA (encher a coluna pra comecar). Aviso "⚠ nao rompe a inercia: X mca < desnivel Y m — nao circula". Headline "Altura manometrica (bomba)" = max. (`pipe-head-loss` ganhou flag `closedLoop`; trocador usa.)
## - ⚠️ **PENDENTE — calibracao PARQUEADA (usuario vai trazer dados de campo, NAO e acao imediata):** (1) validar ☀ Ganho solar / ⏱ Horas/dia → calibrar absorcao da agua aberta (0,8) e/ou transmissao da capa (0,5). Modelo de demanda liquida (perda − ganho solar) JA DIRIGE a bomba de RECIRCULACAO no ar. ATENCAO: capa so reduz o ganho COM capa (`capa ? 0,5 : 1,0`) — ORCP-00003 e SEM capa (ganho a 0,8, sol cheio; nao testa o 0,5). (2) SO depois de calibrar: LIGAR a mesma demanda liquida na tabela de consumo da PROPRIA bomba de calor (hoje usa hora fixa `horasFuncionamentoDia` × qtotal/COP — 1 flag; muda custo de TODOS os orcamentos, por isso espera validacao). (3) opcional: reordenar secoes na ordem exata do Solar.
## - **LICAO build (2x):** gate local confiavel = `rm -rf .next && npm run build` (tsc local da false-pass por `.next/dev/types` stale). Ver [memory/gotcha-tsc-incremental-false-pass.md]. 1o deploy abortou no build (faltava `operatingHoursDebug` na interface do frontend); prod ficou intacta; fix + redeploy OK.

## ✅ DEPLOYED v1.13.13 (03/06) — branding pagina de avaliacao + fix campo Modelo
## - **Pagina /rate (avaliacao publica):** `rate/layout.tsx` virou server component que resolve slug pelo host + busca branding (mesma infra do /q/, fallback Tecnikos) e renderiza LOGO + NOME da empresa acima do card. + `generateMetadata` (conserta preview do link no WhatsApp). Cliente agora sabe de qual empresa e.
## - **Bug campo "Modelo" nao limpava:** payload mandava `model: f.model || undefined` -> "" virava undefined -> Prisma ignorava (campo nunca zerava). Fix: `model: f.model?.trim() || null` (products/page.tsx). DTO @IsOptional aceita null.
## - **Seletor bomba de calor mostrava "X23" (model) em vez do nome:** `heating-budget.service` L1049 tinha prioridade INVERTIDA (`p.model || p.description`). Fix: `p.description?.trim() || p.model?.trim() || p.code` (igual Solar L125/Trocador L73). `model` e campo de AGRUPAMENTO de linha (varios produtos compartilham), NUNCA usar como label. + `code` add ao select. Header do equipamento truncado (nome agora completo/longo) com tooltip.
## - Relacao dos 2 bugs: ambos no campo `model`. Orcamentos salvos: header "2× X23" se corrige no proximo recalculo; dropdown ja certo.

## ✅ DEPLOYED v1.13.12 (03/06) — cadastro bomba de calor BRAND-AGNOSTIC. Doc completa: [memory/cadastro_bomba_calor_brand_agnostic.md]
## - Auto-converter capacidade kcal/kW/BTU (toggle "🔗", default ON, desmarca pra editar individual) — `syncCapacity` em products/page.tsx.
## - Dicas "?" + placeholders apontando o datasheet (cap=secao 18 BTU/condicao/modo; COP="COP a 50% capacidade" Ar15/26; consumo="Potencia de entrada"; vazao="Fluxo de agua" 12~18).
## - DERIVA COP brand-agnostic no calculo de consumo (heating.service): quando NAO ha COP cadastrado, COP = capacidade kW ÷ consumo kW, clamp [2.5, 8]. FALLBACK — equip com COP nao muda (verificado: 40/5.7=7.0; com copAt50=7.5 usa 7.5). Achado: o campo "Consumo medio" era IGNORADO; agora e usado.
## - ✅ CONFIG APLICADO (SQL prod, tenant_sls.Company.systemConfig.pool.typeRequiredFields["Bomba de calor"] = ["kcalHNominal","ratedInputPowerKW"]). COP fica OPCIONAL (nunca foi required — o "✓" nos rotulos era DECORATIVO, texto fixo, nao obrigatoriedade). Antes "Bomba de calor" nao tinha NENHUM obrigatorio -> dava pra salvar bomba vazia (foi o caso do 32c). Agora exige capacidade + consumo.
## - ✅ AUDITORIA dados maquinas (prod): 6 Tholz X23 (09c/14c/18c/26c/32c/40c) COMPLETAS+CONSISTENTES (BTU=kW×3412, kcal=kW×860 batem; todas com tipoEquipamento=BOMBA_CALOR, vazaoMin/Max, consumo, copAt50Air15/26, copMax). 32c (PRD-00251) estava VAZIA -> preenchida. 3 nao-Tholz (Top+9 XLS-30997, Top+7 XLS-31015, Ultra 19 XLS-31453) seguem 100% VAZIAS (sem datasheet — usuario preenche; passarao a exigir cap+consumo no proximo save).
##
## Prod: v1.13.12 (alinhado local == prod). BUNDLE NO AR:
## - Cisterna master: mensagem distingue ABAIXO DO MINIMO (vermelho) de abaixo-do-recomendado-acima-do-min (ambar), mostra deficit; so o grave bloqueia.
## - Vento: HelpHint "?" + opcoes (editor + simulador) Fraco=abrigado/Moderado=parc.aberto/Forte=exposto. Validacao de campo Inacio Ruaro -> [memory/heating_dimensioning_field_validation.md].
## - BOMBA DE CIRCULACAO + TUBOS na aba Bomba de Calor (NOVO): porte do mecanismo solar. Vazao-alvo = bomba de calor selecionada `vazaoMinM3h × qtd`. Avisa se faltar vazao. Backend expos `vazaoMin/MaxM3h` no report.selectedEquipment; reusa endpoints `trocador-pipe/recompute` + `trocador-bomba-candidates` + a regra de bomba do Solar. `TrocadorPumpPipeCard`.
## 🟡 PENDENTE bomba de circulacao: (1) inputs do tubo NAO persistem (efemero — resetam ao reabrir); (2) VERIFICAR RUNTIME na prod (pool=sem preview — testar cadastrando vazao numa bomba de calor).
##
## v1.13.10 e anteriores TUDO NO AR.
## v1.13.10: EDITAR LINHA (icone ✎ abaixo do ✕ -> AddItemModal em modo EDICAO: nome/tipo/etapa) +
## MODELO preserva formulas (saveAsTemplate captura `kind`/`cellRef`/`autoSelectRule` [este era bug — nao salvava]; applyItemsSnapshot PRESERVA cellRef -> formulas entre linhas qty(LX)/prod(LX) seguem validas).
## ⚠️ Modelos salvos ANTES da v1.13.10 nao tem autoSelectRule/cellRef — RE-SALVAR pra capturar.
## ⚠️ DEPLOY: `tsc --noEmit` com cache incremental deu FALSE-PASS (onEdit nao desestruturado passou local, quebrou no build do servidor). Verificar pre-deploy com `tsc --noEmit --incremental false` (ou apagar .tsbuildinfo). 1o deploy v1.13.10 abortou no build (prod intacta), fix + redeploy OK.

## (3) DUPLICAR ORCAMENTO (NOVO, sessao 217)
- Botao **⧉ Duplicar** (sempre visivel, inclusive cadastrado/aprovado). Endpoint `POST :id/duplicate {title?, updatePrices?}`.
- Popup: titulo pre-preenchido `/N` editavel (incrementa /2->/3; embute codigo na 1a vez) + checkbox **Atualizar precos** (marcado=puxa catalogo atual; desmarcado=mantem snapshot).
- COPIA FIEL: mesmas dimensoes/etapas/linhas/qty (NAO re-roda auto-select/formula). Liga via `parentBudgetId` (historico). Copia nasce RASCUNHO descongelada. Totais recalculados direto.
- **Aviso ao Editar** um cadastrado: modal recomenda Duplicar (manter historico); aceita em "Continuar" (descongela).
- **Congelamento robusto:** recalculateTotals + heating/solar computeAndSaveReport + selectEquipmentOverride + setSolarOverride TODOS travados quando frozen -> cobre qualquer etapa/linha de auto-select (atual ou nova).

## (2) CADASTRAR/EDITAR — congelar orcamento (NOVO, sessao 217)
- Campo `PoolBudget.frozenAt` (+ `frozenByName`). Migration `20260602160000_add_pool_budget_frozen_at` (nullable, TenantMigrator propaga no boot).
- Botao **Cadastrar** (ao lado de Aprovar) -> congela EDICAO + recalculo automatico (totais/qty/heating/solar) + libera PDF. **Editar** descongela. Reversivel (≠ lock permanente APROVADO).
- Backend: endpoints `POST :id/register` / `:id/unregister`; guard `assertNotFrozen` em update/addItem/updateItem/removeItem/updateSections/applyLinear; recalculateTotals + heating/solar computeAndSaveReport devolvem cache se frozen. Status (aprovar/rejeitar/cancelar) NAO bloqueado (decisao usuario).
- Front: `isEditLocked = isLocked || isFrozen` nas edicoes; selo "🔒 Cadastrado"; botao Imprimir PDF **desabilitado** ("em breve" — PDF do orcamento = proxima frente).
- Motivo: proteger orcamentos finalizados de mudancas FUTURAS de feature/calculo (ex: a propria FASE 2).

## ULTIMA FRENTE (sessao 216, 01-02/06): SISTEMA DE BORDA INFINITA — FASE 1 NO AR + Central de Avisos
**Resumo completo:** [memory/sessao_216_summary.md](memory/sessao_216_summary.md)
**Plano:** [memory/plano_sistema_borda_infinita.md](memory/plano_sistema_borda_infinita.md) · **Estudos:** reservatorio + tubulacao gravidade (Manning / ralos / surge).
- ✅ Backend: `gravity-flow` / `reservoir-volume` / `borda-infinita.service` + endpoint `POST /pool-budgets/borda-infinita/simulate` (tudo VERIFICADO numericamente).
- ✅ Frontend: `BordaInfinitaSection.tsx` (secao inline estilo Excel, dropdowns, "?", cisterna pronta+volume, surge, ralos, multitubo, altura em CM, tubo ✓suficiente/folgado/⚠insuficiente) + `CentralAvisos.tsx` (painel de avisos no topo+rodape, confirma no salvar se ha erro).
- ✅ Deployed v1.12.99 -> v1.13.07. Storage: `poolDimensions.bordaInfinita[]` (JSON livre, sem model Prisma).

## FASE 2 — FEITA (local, aguardando deploy) — ver [memory/sessao_217_summary.md](memory/sessao_217_summary.md)
- ✅ **Evaporacao religada:** lamina(s) da borda (medias ponderadas) + superficies abertas (agua parada, sem capa) voltam a contar no aquecimento. `heatingFeed` no BordaInfinitaService.
- ✅ **Volume TOTAL (global, decisao do usuario):** agua dos reservatorios soma no volume da piscina em TODO consumidor — aquecimento, solar, demanda termica, fórmulas de linha (`volume`), base `POOL_VOLUME`. Via `poolDimensions.bordaVolumeExtraM3` gravado no salvar (pool-budget.service `enrichPoolDimensions`).
- ✅ Sistema multi-linha tem prioridade sobre o campo escalar legado. Orcamentos SEM borda: extra=0, **zero impacto**.
- ✅ Front: simulador Bomba de Calor mostra volume total + quebra; aba Solar usa total no override; card do orcamento mostra "(c/ borda infinita)".
- 🟡 Follow-up opcional: placeholder `{poolVolume}` de layout de impressao CUSTOM ainda usa volume geometrico (nicho).

## PENDENCIA SYSTEM-WIDE
- 🟡 Auditoria de responsividade MOBILE de TODO o sistema (regra ja no CLAUDE.md "Responsividade / Mobile"; spawn task criado).

## Outros pendentes (menores)
- Central de Avisos: levar pra outros cadastros + expandir regras de faixa por campo.
- ✅ Conferido: 6 Tholz X23 vs datasheet (kcal/COP/vazao OK). Pendente ainda: remover painel debug violeta (aguardando Solis 7+ baterias); preencher 3 nao-Tholz vazias.
- Roadmap: vazao min/max -> bomba de circulacao por curva; defaults de tubulacao configuraveis.

## Sessoes anteriores
- Sessao 215 (v1.12.94-98): Aba Bomba de Calor (datasheet clone da Solar). Sessao 214 (v1.12.94): consumo bomba solar calibrado + PDF.
