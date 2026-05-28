# Sessao 213 — 27/05/2026 (em andamento)

**Versao em prod ao final:** v1.12.74 (16 releases na sessao: v1.12.59 → v1.12.74)

## Releases por tema

### NFS-e + isMaster guard (v1.12.60 → v1.12.62)
- Botao "Reenviar NFS-e" no menu do `/nfe/saida`
- Endpoint `POST /nfse-emissions/:id/retry` (reutiliza snapshot, atualiza data pra hoje)
- `ActionsDropdown` refatorado com `createPortal` → menu nao desloca + clicks funcionam
- `mapFocusError` 401 cita "mensalidade Focus em atraso OU token invalido"
- `tenant.service.block/suspend` early-return se `tenant.isMaster=true`
- Webhook Asaas `SUBSCRIPTION_DELETED/INACTIVATED` ignora master tenants (defense in depth)

### Bomba solar — manual vs default (v1.12.62)
- `bombaManuallySelected` flag distingue clique do usuario vs escolha padrao
- Antes: reduzir coletores mantinha bomba grande. Agora: recalcula sempre que regra ainda aplica
- Tie-breaker prefere `colPorBat` maior (era `batPorRamo`)

### Solar Rules configuraveis (v1.12.63 → v1.12.65)
- `solar-rules.ts` (novo): interface `SolarRules`, `SYSTEM_DEFAULT_SOLAR_RULES`, `resolveRulesForCollector`
- Antes hardcoded: min 5, max 7 col/bat, max 30 m²/bat, max 3 bat/serie, vazao 252 L/h/m²
- Agora cadastravel por `(poolType, model)` em `Company.systemConfig.pool.solarRules`
- `SolarRulesModal.tsx` (novo) — CRUD com cobertura visual
- Botao "⚙ Regras" no Diagrama de Instalacao + badge "Regra: X" / "Sem regra"
- **Sem regra cadastrada = erro explicito** (nao cai em default silencioso)
- Vinculacao 1:1 (uma regra ↔ um poolType+model)
- Recalcular agora envia `orientacaoTelhado`, `inclinacaoTelhadoGraus`, `temperaturaAguaInicial`

### Fisica solar refinada (v1.12.65 → v1.12.66)
- `SOLAR_INCLINACAO_IDEAL_POR_ORIENTACAO`: N=lat, NE/NO=0.85lat, L/O=0.70lat, SE/SO=0.40lat, S=plano(0°)
- `calcFatorInstalacao(orientacao, inclinacao, latitudeAbs)` — combina os 3 fatores
- **Assimetria L/O por latitude**: Porto Alegre (lat 30°) L≈O. Manaus (lat 3°) O > L (sol tarde aquece mais com ambiente quente, perdas termicas menores no coletor aberto)
- `FATOR_ORIENTACAO_AJUSTAVEL.base + deltaTarde * asymmetryFactor` onde `asymmetryFactor = min(1, lat/30)`

### Indicator folga vazao (v1.12.66 → v1.12.67)
- Texto antes: "Justo: 0% (Justo)" — confuso pra usuario
- Fix: `IndicatorResult.groupLabel` (ex: "Folga vazao") separado do `level.label`
- 1 casa decimal quando < 10%
- Faixas reformuladas pelo usuario:
  - ≤ 0%: Limitado (amber)
  - ≤ 10%: Justo (green)
  - ≤ 15%: Bom (lime — cor nova)
  - ≤ 9999%: Coletores podem romper (red)
- Cores `lime`/`amber` adicionadas no AutoSelectModal

### Diagrama de Instalacao — Coletor v2 (v1.12.59 → v1.12.61)
- Coletor preto puro + 8 mangueiras paralelas (era 5) + cabecotes 3D
- Placas solares visuais dentro de cada bateria (N coletores reais)
- Labels ALIMENTACAO/RETORNO ancoragem start/end

### PDF Profissional (v1.12.67 → v1.12.74) — 8 releases
**Meta:** PDF de venda 1 pagina A4 identico a tela.

| Release | Foco |
|---------|------|
| v1.12.67 | Header gradient azul-preto colorido no print + `color-adjust: exact` |
| v1.12.68 | Logo do tenant no header via `/api/public/tenant/:slug/logo/icon-192` |
| v1.12.69 | Cards alinhados (`height: 32px` + justify-center). Fix SVG gradient duplicate ID (clone prefixa IDs com `clone-`) |
| v1.12.70 | `print:hidden` em "Modo de dimensao" + "Modo de configuracao". Imagem coletor `print:aspect-auto print:h-full` |
| v1.12.71 | Compactacao agressiva: section padding 2px, header 4px, `@page margin: 0` + padding interno |
| v1.12.72 | **Print SEMPRE via clone no body** (`printViaClone()`) — fix 2 paginas idênticas + branco acima header + corte rodape. Original enterrado em modal `fixed inset-0 overflow-hidden` confundia motor de print do Chrome. Ambos botoes "Imprimir" e "Imprimir agora" agora usam o mesmo clone |
| v1.12.73 | Imagem coletor `print:max-h-[58mm]`, grafico `print:max-h-[62mm]`, `print:items-start` na grid (tabela mensal nao estica) |
| v1.12.74 | Imagem 52mm, respiro entre banners azuis e cards (`print:mb-1`), `clone.style.minHeight=0` no JS pra zerar `min-h-[1120px]` da tela. Fixou 2ª pagina em branco |

## Memorias criadas/atualizadas
- [project_solar_regras_configuraveis.md](project_solar_regras_configuraveis.md) — regras solares cadastraveis por modelo
- [feedback_perguntar_antes_deploy.md](feedback_perguntar_antes_deploy.md) — sessao pediu pra perguntar antes de cada deploy

## Pendentes (carregam pra sessao 214)
- Testar PDF v1.12.74 — usuario reportou que ainda tinha 2 paginas em branco antes do fix do `min-h`
- Investigar se imagem do coletor agora alinha corretamente com cards no PDF impresso
- Possivel: print-preview e Chrome divergem em renderizacao final
