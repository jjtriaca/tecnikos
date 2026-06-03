---
name: heating_dimensioning_field_validation
description: Validacao de CAMPO do dimensionamento da bomba de calor (caso Inacio Ruaro, Primavera do Leste/MT, 03/06/2026). Conclusao: a demanda e DOMINADA pelo VENTO; o modelo esta certo; o "erro" de superdimensionar era o input vento MODERADO num local abrigado. Turbo NAO entra na selecao (brand-specific).
metadata:
  type: project
  date: 2026-06-03
---

# Validacao de campo — dimensionamento bomba de calor (caso Inacio Ruaro)

Cliente trouxe histórico real (planilha c/ temp ambiente horaria + minutos de aquecedor ligado, Fev-Jun)
porque nosso calc deu **3× Tholz X23-40C** e na pratica **2 maquinas** seguram a piscina (35°C, sem capa,
borda 24h, Primavera do Leste/MT). Investigacao completa:

## Dados reais
- Agua segura ~33-35°C (no alvo). Duty cycle do aquecedor: Abr 64% (folga), **Mai 95% / Jun 100%** (no limite).
- Dias de sol: cai pra 37% ou desliga. Equipamento inverter, modula.
- Temp ambiente sensor: avg ~24-28°C (mas os "max" 47-58°C sao sensor NO SOL = irreal; minimas noturnas ~23°C).

## Diagnostico (o lever e o VENTO, nao o clima nem o turbo)
1. **Clima**: nosso ClimateData Primavera do Leste tem Jun 20,0 / Jul 20,3°C (mais frio que o real). Mas
   recomputando com a temp real, a demanda cai so 96,2 -> 91 kW (~5%). **Clima NAO e o vilao** (no alvo 35°C
   a evaporacao manda mais que o ΔT do ar).
2. **VENTO domina** (evaporacao = termo de 69 kW). WIND_SPEED_BY_LEVEL: FRACO=1, MODERADO=2, FORTE=3 m/s.
   Fator evap = 0.0174·Vw+0.0229 -> MODERADO eh ~43% maior que FRACO.
   - **MODERADO + borda = 96,2 kW -> 3 maquinas**.
   - **FRACO + borda = 67,2 kW -> 2 maquinas** (carga 84% no nominal, "muito bem dimensionada").
3. **A piscina e FRACO, nao MODERADO** (abrigada). Prova: 2 maquinas confortaveis (84% carga) = FRACO; se fosse
   MODERADO seriam 120% (precisaria turbo). O operador tinha setado MODERADO (default), alto demais pro local.

## Decisoes do usuario
- **NAO embutir o turbo (120%) na selecao** — turbo eh especifico do Tholz X23; nao "soldar" o sistema numa marca.
  A selecao continua no NOMINAL (generico). Pro Tholz, o operador baixa a qtd na mao se quiser contar com turbo.
- **Manter default MODERADO** (conservador) — so adicionar DICA clara do vento, pro operador escolher certo
  (Fraco = abrigado/maioria dos quintais; Moderado = parc. aberto; Forte = exposto). Implementado: HelpHint "?"
  no campo Vento do editor + simulador (Solar e Bomba de Calor) + opcoes enriquecidas no editor. v1.13.11.

## Constantes relevantes (heating-constants.ts)
- SAFETY_MARGIN 1.05; EQUIPMENT_SELECTION MAX_LOAD_RATIO 0.9 / MIN 0.3; WINTER_CAPACITY_FACTOR 0.85.
- X23-40C = 34.400 kcal/h = 40 kW nominal cada.

## Licao
O modelo de aquecimento esta VALIDADO contra campo. Quando der "superdimensionado", checar PRIMEIRO o VENTO
(input mais sensivel), depois capa/temp-alvo/borda — antes de suspeitar do motor. Demanda ~certa; turbo e
brand-specific (operador aplica na mao).
