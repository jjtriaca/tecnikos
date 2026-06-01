---
name: study_borda_infinita_reservatorio
description: Estudo de engenharia — volume do reservatorio de compensacao (tanque de transbordo) em piscina de borda infinita, via vasos comunicantes. Base pra calcular o volume extra de agua no Simulador de Aquecimento (afeta tempo de aquecimento + evaporacao da lamina). Pesquisado 01/06/2026.
metadata:
  type: study
  date: 2026-06-01
---

# Estudo — Reservatorio de compensacao (tanque de transbordo) — piscina de borda infinita

**Motivo:** o Simulador de Aquecimento precisa do volume EXTRA de agua (reservatorio + transbordo)
porque ela tambem precisa ser aquecida (tempo de aquecimento + massa termica) e a lamina de
transbordo aumenta a evaporacao. Usuario pediu o calculo do volume do reservatorio "via vasos
comunicantes".

## Como funciona (vasos comunicantes)
- Piscina de transbordo: a agua transborda pela(s) borda(s) -> calha/canaleta perimetral ->
  **reservatorio de compensacao** (tanque de transbordo) -> a bomba puxa do tanque -> filtra ->
  devolve a piscina -> transborda de novo (ciclo continuo).
- Piscina + reservatorio = **vasos comunicantes** (ligados pela sucao). Bomba DESLIGA -> a agua
  acima do nivel estatico (lamina em operacao + calha + deslocamento de banhistas) escoa por
  GRAVIDADE pro reservatorio. Bomba LIGA -> puxa do tanque e enche a piscina ate transbordar.
- O reservatorio dimensiona pra: (a) ABSORVER esse "surge" quando a bomba para (sem transbordar
  pro esgoto); (b) NAO SECAR (evitar cavitacao da bomba) quando roda no maximo + maximo de banhistas.

## Volume do reservatorio — metodos (convergem pra ~5-10% do volume da piscina)
1. **Lamina sobre a superficie (surge/drawback) — o mais fisico:**
   `V = area_espelho_dagua x h`, com **h ≈ 5 a 20 cm** (consenso pratico ~10 cm).
   - PT: "area x 15-20 cm" pro tanque; "o nivel baixa 5-10 cm" => `Larg x Comp x 0,05-0,10 m`; calha 10-20 cm.
   - EN: **4-5 m³ por 100 m²** (= 4-5 cm); regra "2 polegadas (5 cm) de deslocamento"; PWTAG/comercial "1 galao/ft²" (~4 cm).
2. **+ Deslocamento de banhistas:** `V = N_banhistas x ~0,075 m³` (≈ 75 L/banhista).
   - PoolDial: `Surge(gal) = MaxBanhistas x (peso_medio/62,4) x 7,48` -> 170 lb/pessoa ≈ 77 L. N_banhistas ~ 1 a cada 2-3 m².
3. **Regra rapida:** **5 a 10% do volume da piscina** (residencial costuma somar +~400 gal de reserva).
4. **Regra PT por borda:** ~**450 L por metro linear** de borda infinita.
5. **Reservas extras (PoolDial):** evaporacao (4-15 gal/ft/dia conforme clima), onda 1% do volume, fator seguranca +25%.
6. **Profundidade do tanque:** 3-5 ft; >=30 cm (12") de agua acima da sucao pra evitar vortice/ar.

## Recomendacao PRA O NOSSO SISTEMA (Simulador de Aquecimento)
- **Volume termico total = volume da piscina + volume do reservatorio** -> entra no tempo de aquecimento
  inicial e na massa termica (NAO muda a perda termica continua da superficie, exceto evaporacao — ver abaixo).
- **Estimar o reservatorio** (quando o operador nao sabe as dimensoes do tanque):
  `V_reserv ≈ area_espelho x 0,10 m  (+ N_banhistas x 0,075)`, **limitado a ~5-10% do volume da piscina**.
  (10 cm de lamina = meio do intervalo; banhistas opcional.)
- **OU** o operador entra as dimensoes reais do tanque: `comp x larg x prof`.
- **Evaporacao:** borda infinita = MAIOR taxa de evaporacao (filme fino exposto). Somar a perda da
  **lamina de transbordo** (modelo atual: comprimento x alt.queda x vazao x horas) + (se o reservatorio
  for ABERTO/exposto) a superficie do reservatorio na area de evaporacao. Reservatorio TAMPADO/enterrado
  = so o volume conta (sem evaporacao da superficie dele).

## Aplicacao na feature multi-linha de borda (proposta do usuario)
Cada linha de borda infinita captura:
- **Reservatorio:** `comp x larg x prof` (volume) — OU auto-estimar `area x 0,10 m`.
- **Lamina de transbordo:** comprimento da lamina, altura de queda, vazao (L/min/m), horas/dia.
Soma das linhas -> (volume reservatorio somado ao volume termico) + (filme/lamina somado a evaporacao).
Decisao pendente do usuario: superficie do reservatorio evapora (aberto) ou so volume conta (tampado).

**IMPLEMENTADO (sessao 216):** `backend/src/pool-budget/reservoir-volume.service.ts` (`@Injectable`) —
`computeMasterVolume` retorna recomendado/minimo/% do volume + ALERTA (BAIXO=cavitacao/transbordo, OK, ALTO=superdimensionado).
A bomba do filtro puxa DIRETO do master, entao volume baixo = bomba seca/puxa ar. Verificado: piscina 4×8 -> rec 3,6 m³,
min 1,6 m³ (9% do volume). Caso novo da topologia: a borda pode derramar DIRETO no master (sem reservatorio/canaleta intermediario).

## Fontes
- [Sanches Engenharia — Borda Infinita: sistema hidraulico](https://sanchesengenhariaonline.com.br/blog/borda-infinita)
- [Piscinas de Borda Infinita — Calculo de Vazao (LinkedIn, S. Tarzia)](https://pt.linkedin.com/pulse/piscinas-de-borda-infinita-c%C3%A1lculo-vaz%C3%A3o-sinderval-tarzia)
- [Hidraulicart — Esquema piscina transbordo / tanque compensacao (PDF)](https://www.hidraulicart.pt/wp-content/uploads/ESQUEMA%20DE%20PRINC%C3%8DPIO_tanque_compensacao.pdf)
- [Poolset — Piscina de Transbordo](https://poolset.pt/construcaopiscinas/piscina-transbordo/)
- [PoolDial — Balance Tank Calculator](https://pooldial.com/balance-tank-calculator)
- [Morana Water Design — Balancing Tank for Infinity Pools](https://moranawaterdesign.com/overflow-b/)
- [PWTAG — Balance tank design for deck-level pools](https://www.pwtag.org/balance-tank-design-for-deck-level-pools-january-2016/)
- [AQUA Magazine — Vanishing Edges 101](https://www.aquamagazine.com/builder/article/15117937/vanishing-edges-101)
- [IPDJ — Cadernos Tecnicos Instalacoes Desportivas: Piscinas (PDF)](https://ipdj.gov.pt/documents/20123/125428/1.+Caderno+T%C3%A9cnico_Inst_Trat_Agua_V3bb.pdf)
