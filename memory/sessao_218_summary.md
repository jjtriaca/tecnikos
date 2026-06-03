# Sessao 218 (02-03/06/2026) — v1.13.10 → v1.13.12

Continuacao da sessao 217 (FASE 2 Borda Infinita + Cadastrar/Editar freeze + Duplicar,
v1.13.08-09 — ver [sessao_217_summary.md](sessao_217_summary.md)). Esta sessao seguiu com:

## v1.13.10 — Editar linha + Modelo preserva formulas
- **Editar linha:** icone ✎ abaixo do ✕ de excluir → abre AddItemModal em modo EDICAO
  (nome/tipo PRODUCT-SERVICE/etapa).
- **Modelo preserva formulas:** `saveAsTemplate` agora captura `kind`/`cellRef`/`autoSelectRule`
  (o `autoSelectRule` NAO era salvo — era bug); `applyItemsSnapshot` PRESERVA `cellRef`, entao
  formulas entre linhas (`qty(LX)`/`prod(LX)`) seguem validas em qualquer orcamento novo.
- ⚠️ Modelos salvos ANTES da v1.13.10 nao tem `autoSelectRule`/`cellRef` — RE-SALVAR pra capturar.
- ⚠️ **LICAO DE DEPLOY:** `tsc --noEmit` com cache incremental (`.tsbuildinfo`) deu FALSE-PASS
  (prop `onEdit` desestruturada faltando passou local, quebrou no `next build` do servidor). 1o
  deploy abortou no build (prod intacta), fix+redeploy OK. **Pre-deploy: `tsc --noEmit --incremental
  false`** (apagar .tsbuildinfo). Erros em `.next/` sao falsos — filtrar com `grep -v "\.next"`.
  Ver [gotcha-tsc-incremental-false-pass.md](gotcha-tsc-incremental-false-pass.md).

## v1.13.11 — Vento + Cisterna + Bomba de circulacao (aba Bomba de Calor)
- **Vento:** HelpHint "?" + opcoes (editor + simulador) Fraco=abrigado / Moderado=parc.aberto /
  Forte=exposto. Caso Inacio Ruaro: demanda da bomba de calor e DOMINADA pelo vento (MODERADO
  ~96kW→3maq vs FRACO ~67kW→2maq, ~43% na evaporacao); clima quase nao muda. Decisao: NAO embutir
  turbo 120% brand-specific; manter default MODERADO; so dica do vento. Modelo VALIDADO.
  Ver [heating_dimensioning_field_validation.md](heating_dimensioning_field_validation.md).
- **Cisterna master:** mensagem distingue ABAIXO DO MINIMO (vermelho, bloqueia) de
  abaixo-do-recomendado-mas-acima-do-min (ambar, nao bloqueia); mostra deficit.
- **Bomba de circulacao + tubos na aba Bomba de Calor:** porte do mecanismo da aba Solar.
  Vazao-alvo = bomba de calor selecionada `vazaoMinM3h × qtd`; avisa se faltar vazao. Backend
  expoe `vazaoMin/MaxM3h` no `report.selectedEquipment`; reusa endpoints `trocador-pipe/recompute`
  + `trocador-bomba-candidates` + a regra de bomba do Solar. Componente `TrocadorPumpPipeCard`.
  🟡 PENDENTE: inputs do tubo NAO persistem (efemero, resetam ao reabrir); validar runtime na prod.

## v1.13.12 — Cadastro Bomba de Calor BRAND-AGNOSTIC (esta seccao)
Doc completa: [cadastro_bomba_calor_brand_agnostic.md](cadastro_bomba_calor_brand_agnostic.md).
- **Auto-converter** capacidade kcal/kW/BTU (`syncCapacity`, toggle 🔗 default ON; kW=kcal/860,
  BTU=kcal×3,9683). Dicas "?" + placeholders apontando secoes do datasheet.
- **Deriva COP** no `heating.service` quando NAO ha COP cadastrado: COP=cap_kW÷consumo_kW clamp
  [2.5,8] (FALLBACK; equip com COP nao muda). O campo "Consumo medio" (`ratedInputPowerKW`) era
  IGNORADO — agora e usado.
- **Obrigatorios** de "Bomba de calor" (config tenant `Company.systemConfig.pool.typeRequiredFields`,
  SQL prod LIVE) = `[kcalHNominal, ratedInputPowerKW]`. COP fica OPCIONAL. ACHADO: o tipo nao tinha
  NENHUM obrigatorio (dava pra salvar bomba vazia, caso do 32c); o "✓" nos rotulos era DECORATIVO.
- **Auditoria dados (prod tenant_sls):** 6 Tholz X23 completas+consistentes (BTU=kW×3412, kcal=kW×860);
  X23-32c (PRD-00251) estava VAZIA → preenchida; 3 nao-Tholz (Top+9/Top+7/Ultra19) seguem vazias.

## Estado no fim da sessao
- **Prod = v1.13.12**, alinhado com local. Tudo desta sessao NO AR.
- 🟡 Pendencias abertas: (1) inputs do tubo da bomba de circulacao nao persistem + validar runtime;
  (2) preencher 3 bombas nao-Tholz vazias; (3) auditoria responsividade MOBILE system-wide;
  (4) PDF do orcamento (botao Imprimir hoje desabilitado "em breve"); (5) remover painel debug
  violeta (aguardando Solis 7+ baterias).
