# Cadastro Bomba de Calor — Brand-agnostic (v1.13.12, 03/06/2026)

## Contexto / problema
Datasheets de bomba de calor variam muito por marca: alguns trazem kcal/h, outros so kW
ou BTU; alguns dao COP por condicao, outros so "consumo medio". O cadastro exigia campos
que nem todo datasheet tem (ex.: Kcal/h nominal, COP 50% inverno), travando o operador.
Objetivo do usuario: cadastro preenchivel a partir de QUALQUER datasheet, **sem amarrar a
uma marca/modelo** ("nao ficar soldado a uma marca ou modelo").

## 3 mudancas (v1.13.12)

### 1. Auto-converter capacidade (kcal · kW · BTU) — FRONTEND
- `syncCapacity(source, raw)` em `frontend/src/app/(dashboard)/products/page.tsx` (~L1116).
  Toggle `autoSyncCapacity` (chip "🔗 Auto-converter", default ON, accent-cyan-600, ~L2301).
- Preencheu QUALQUER um dos 3 (kcal/kW/BTU) → os outros 2 auto-preenchem. **Desmarca o 🔗
  pra editar individual** (so seta o campo de origem).
- Conversoes: **kW = kcal/860**; **BTU = kcal × 3,9683** (1 kW = 860 kcal/h = 3412 BTU/h).
- Os 3 inputs (specKcalHNominal/specKwNominal/specBtuH) chamam `syncCapacity('kcal'|'kw'|'btu', ...)`.

### 2. Derivacao de COP brand-agnostic — BACKEND (`heating.service.ts` ~L764, dentro do selectEquipment)
- O campo "Consumo medio (kW)" (`ratedInputPowerKW`) ANTES era **IGNORADO** no calculo de
  consumo. Agora e usado.
- **FALLBACK** (so age quando faltam TODOS os COPs cadastrados — equipamento com COP nao muda):
  `copDerivado = capacidade_kW ÷ consumo_kW`, **clamp [2.5, 8]**.
  - capacidade_kW = `kwNominal ?? kcalHNominal/860`
  - consumo_kW = `ratedInputPowerKW ?? consumoMedioW/1000`
- Prioridade: `copEstimated = copAt50Air15 ?? copAt50Capacity ?? copNominal ?? copDerivado ?? 0`.
  Idem na copCurve: `copMax = copMax ?? copDerivado`, `copAt50 = copAt50Air15 ?? copAt50Capacity ?? copNominal ?? copDerivado`.
- Verificado: kw40/consumo5,7 → 7,0; com copAt50=7,5 usa 7,5 (deriva ignorada); sem consumo → 0;
  consumo medio baixo → clamp em 8.
- **Limitacao conhecida:** consumo de datasheet costuma ser do ponto FAVORAVEL (ar quente / baixa
  carga) → COP derivado fica OTIMISTA. E so fallback; quem tem COP cadastrado nao usa. Operador
  deve preencher COP por condicao se tiver.

### 3. Campos obrigatorios de "Bomba de calor" — CONFIG do tenant (SQL prod, LIVE sem deploy)
- Storage: `Company.systemConfig.pool.typeRequiredFields[<tipo>]` (setado via
  `product.service.setTypeRequiredFields`, endpoint `/products/pool-types/manage`).
  O front le isso em `currentRequiredSpecs = poolTypeRequiredMap[form.poolType]`.
- **ACHADO IMPORTANTE:** "Bomba de calor" nao tinha NENHUM campo obrigatorio → dava pra salvar
  bomba **vazia** (foi o caso do X23-32c). O **"✓" nos rotulos** (Kcal/h nominal ✓, COP inverno ✓)
  e **DECORATIVO** (texto fixo no JSX), NAO obrigatoriedade. A obrigatoriedade real vem do config.
- **APLICADO** (SQL direto, tenant_sls): `typeRequiredFields["Bomba de calor"] = ["kcalHNominal","ratedInputPowerKW"]`
  (capacidade + consumo). COP **fica opcional**.
- **Case-sensitive:** os produtos usam `poolType = "Bomba de calor"` (d minusculo). A chave do
  config TEM que bater exatamente, senao o front nao acha os obrigatorios.
- **LIVE imediato** (config no banco, nao precisa deploy). Descompasso: o auto-converter (item 1)
  so entrou na v1.13.12 — antes dela a regra ja exigia kcal mas sem auto-fill (operador digitava na mao).

## Dados das maquinas X23 (auditoria prod tenant_sls, poolType='Bomba de calor')
6 Tholz X23 **completas + consistentes** (BTU=kW×3412, kcal=kW×860 batem; todas com
tipoEquipamento=BOMBA_CALOR + vazaoMin/Max + consumo + copAt50Air15/26 + copMax):

| Modelo | code | BTU | kW | kcal/h | vazao m³/h | consumo kW | copMax | cop15 | cop26 |
|---|---|---|---|---|---|---|---|---|---|
| X23-09c | XLS-31608 | 32.420 | 9,5 | 8.170 | 2~4 | 0,97 | 22,0 | 7,2 | 14,6 |
| X23-14c | XLS-31609 | 46.000 | 13,48 | 11.592 | 3~4 | 0,955 | 22,5 | 7,3 | 14,5 |
| X23-18c | XLS-31610 | 63.100 | 18,49 | 15.901 | 4~6 | 1,465 | 16,4 | 7,0 | 13,5 |
| X23-26c | XLS-31611 | 87.000 | 25,5 | 21.924 | 8~10 | 2,04 | 22,2 | 7,3 | 14,1 |
| X23-32c | PRD-00251 | 109.200 | 32,0 | 27.518 | 10~12 | 2,29 | 23,5 | 7,6 | 15,1 |
| X23-40c | XLS-31612 | 136.500 | 40,0 | 34.400 | 12~18 | 3,145 | 23,0 | 7,5 | 15,0 |

- **X23-32c (PRD-00251) estava VAZIA → preenchida** nesta sessao (era a bomba salva sem dados).
- Correcoes anteriores na sessao: vazao (09c 2~4, 14c 3~4, 26c 8~10), btuH (varios), copMax 09c→22,0.
- **3 nao-Tholz seguem 100% VAZIAS** (sem datasheet): Top+9 (XLS-30997), Top+7 (XLS-31015),
  Ultra 19 (XLS-31453). Passam a exigir cap+consumo no proximo save (nao bloqueia enquanto nao editar).
- Detalhe a conferir um dia: consumo do 14c (0,955) ficou um tiquinho abaixo do 09c (0,97) — e o
  consumo MINIMO de modulacao do inversor (nao escala linear com capacidade); nao afeta calculo
  porque o 14c ja tem COP cadastrado.

## Regra geral que reforca o CLAUDE.md
- Dimensionamento NAO deve embutir comportamento de marca/modelo (ex.: turbo 120% Tholz). Manter
  no nominal; preencher campos genericos do datasheet. Ver tambem
  `heating_dimensioning_field_validation.md` (vento domina demanda da bomba de calor).
