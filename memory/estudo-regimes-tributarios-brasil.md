# Estudo Completo: Regimes Tributarios Brasileiros e Obrigacoes Acessorias
# Data: 06/03/2026
# Foco: O que um sistema ERP/fiscal precisa implementar

---

## 1. SIMPLES NACIONAL

### 1.1 Visao Geral
- Regime simplificado para ME e EPP
- Limite de faturamento: **R$ 4.800.000,00/ano**
- MEI: ate R$ 81.000,00/ano (nao faz PGDAS-D)
- Todos os tributos unificados em uma unica guia (DAS)
- Tributos inclusos no DAS: IRPJ, CSLL, PIS/Pasep, COFINS, CPP, ICMS, ISS, IPI

### 1.2 Anexos e Aliquotas

#### Anexo I - Comercio
| Faixa | Faturamento 12 meses | Aliquota Nominal | Valor a Deduzir |
|-------|----------------------|------------------|-----------------|
| 1a | Ate R$ 180.000 | 4,00% | R$ 0 |
| 2a | R$ 180.000,01 a R$ 360.000 | 7,30% | R$ 5.940 |
| 3a | R$ 360.000,01 a R$ 720.000 | 9,50% | R$ 13.860 |
| 4a | R$ 720.000,01 a R$ 1.800.000 | 10,70% | R$ 22.500 |
| 5a | R$ 1.800.000,01 a R$ 3.600.000 | 14,30% | R$ 87.300 |
| 6a | R$ 3.600.000,01 a R$ 4.800.000 | 19,00% | R$ 378.000 |
Tributos: IRPJ, CSLL, COFINS, PIS/Pasep, CPP, ICMS

#### Anexo II - Industria
| Faixa | Faturamento 12 meses | Aliquota Nominal | Valor a Deduzir |
|-------|----------------------|------------------|-----------------|
| 1a | Ate R$ 180.000 | 4,50% | R$ 0 |
| 2a | R$ 180.000,01 a R$ 360.000 | 7,80% | R$ 5.940 |
| 3a | R$ 360.000,01 a R$ 720.000 | 10,00% | R$ 13.860 |
| 4a | R$ 720.000,01 a R$ 1.800.000 | 11,20% | R$ 22.500 |
| 5a | R$ 1.800.000,01 a R$ 3.600.000 | 14,70% | R$ 85.500 |
| 6a | R$ 3.600.000,01 a R$ 4.800.000 | 30,00% | R$ 720.000 |
Tributos: IRPJ, CSLL, COFINS, PIS/Pasep, CPP, ICMS, IPI

#### Anexo III - Servicos (aliquotas menores)
| Faixa | Faturamento 12 meses | Aliquota Nominal | Valor a Deduzir |
|-------|----------------------|------------------|-----------------|
| 1a | Ate R$ 180.000 | 6,00% | R$ 0 |
| 2a | R$ 180.000,01 a R$ 360.000 | 11,20% | R$ 9.360 |
| 3a | R$ 360.000,01 a R$ 720.000 | 13,50% | R$ 17.640 |
| 4a | R$ 720.000,01 a R$ 1.800.000 | 16,00% | R$ 35.640 |
| 5a | R$ 1.800.000,01 a R$ 3.600.000 | 21,00% | R$ 125.640 |
| 6a | R$ 3.600.000,01 a R$ 4.800.000 | 33,00% | R$ 648.000 |
Tributos: IRPJ, CSLL, COFINS, PIS/Pasep, CPP, ISS
Atividades: instalacoes eletricas, contabilidade, clinicas medicas, etc.

#### Anexo IV - Servicos (sem CPP)
| Faixa | Faturamento 12 meses | Aliquota Nominal | Valor a Deduzir |
|-------|----------------------|------------------|-----------------|
| 1a | Ate R$ 180.000 | 4,50% | R$ 0 |
| 2a | R$ 180.000,01 a R$ 360.000 | 9,00% | R$ 8.100 |
| 3a | R$ 360.000,01 a R$ 720.000 | 10,20% | R$ 12.420 |
| 4a | R$ 720.000,01 a R$ 1.800.000 | 14,00% | R$ 39.780 |
| 5a | R$ 1.800.000,01 a R$ 3.600.000 | 22,00% | R$ 183.780 |
| 6a | R$ 3.600.000,01 a R$ 4.800.000 | 33,00% | R$ 828.000 |
Tributos: IRPJ, CSLL, COFINS, PIS/Pasep, ISS (SEM CPP — paga separado)
Atividades: CONSTRUCAO CIVIL (obras), limpeza, vigilancia, servicos advocaticios

#### Anexo V - Servicos (aliquotas maiores)
| Faixa | Faturamento 12 meses | Aliquota Nominal | Valor a Deduzir |
|-------|----------------------|------------------|-----------------|
| 1a | Ate R$ 180.000 | 15,50% | R$ 0 |
| 2a | R$ 180.000,01 a R$ 360.000 | 18,00% | R$ 4.500 |
| 3a | R$ 360.000,01 a R$ 720.000 | 19,50% | R$ 9.900 |
| 4a | R$ 720.000,01 a R$ 1.800.000 | 20,50% | R$ 17.100 |
| 5a | R$ 1.800.000,01 a R$ 3.600.000 | 23,00% | R$ 62.100 |
| 6a | R$ 3.600.000,01 a R$ 4.800.000 | 30,50% | R$ 540.000 |
Tributos: IRPJ, CSLL, COFINS, PIS/Pasep, CPP, ISS
Atividades: auditoria, engenharia, jornalismo, publicidade, TI

#### Fator R (Anexo V → Anexo III)
- Formula: Fator R = Folha de Pagamento (12m) / Faturamento (12m)
- Se Fator R >= 28%: tributa pelo Anexo III (aliquotas menores)
- Se Fator R < 28%: tributa pelo Anexo V (aliquotas maiores)
- Calculado MES A MES — pode variar

#### Formula da Aliquota Efetiva
```
Aliquota Efetiva = (RBT12 x Aliquota Nominal - Parcela a Deduzir) / RBT12
```
Exemplo: Faturamento R$ 300.000 (12m), Anexo III, 2a faixa:
(300.000 x 11,20% - 9.360) / 300.000 = 8,08%

### 1.3 PGDAS-D (Declaracao Mensal)
- **O que e**: Programa Gerador do Documento de Arrecadacao do Simples Nacional — Declaratorio
- **Quem**: Todas ME e EPP do SN (exceto MEI)
- **Prazo**: Dia 20 do mes seguinte ao periodo de apuracao
- **Mesmo sem faturamento**: Obrigatorio informar R$ 0,00
- **Campos principais**:
  - Receita bruta do mes
  - Segregacao de receitas por natureza/atividade
  - Tipo: comercio, industria, servico (cada um vai para um anexo)
  - Vendas com/sem ST de ICMS
  - Receitas de exportacao
  - Receitas com ISS retido
- **Calculo**: O sistema do PGDAS-D faz automatico apos segregacao
- **Acesso**: Portal do Simples Nacional > PGDAS-D e DEFIS 2018

#### Multas PGDAS-D (NOVIDADE 2026 — LC 214/2025):
- **2% ao mes**, limitada a 20%
- Minimo: **R$ 50 por mes** de referencia
- Aplicada AUTOMATICAMENTE no dia seguinte ao vencimento (dia 21)
- Reducao de 50% se entregue espontaneamente antes de fiscalizacao

### 1.4 DEFIS (Declaracao Anual)
- **O que e**: Declaracao de Informacoes Socioeconomicas e Fiscais
- **Quem**: Todas ME e EPP do SN (inclusive inativas)
- **Prazo**: 31 de marco do ano seguinte (ex: DEFIS 2025 ate 31/03/2026)
- **O que declara**:
  - Receita bruta total do ano por estabelecimento
  - Informacoes sobre empregados
  - Ganho de capital
  - Exportacao
  - Rendimentos dos socios
  - Mudancas de endereco, atividade, socios
- **Acesso**: Mesmo portal do PGDAS-D

#### Multas DEFIS (NOVIDADE 2026):
- **2% ao mes**, limitada a 20%
- Minimo: **R$ 200**
- Antes de 2026 NAO tinha multa

### 1.5 DeSTDA (Declaracao Estadual)
- **O que e**: Declaracao de Substituicao Tributaria, Diferencial de Aliquota e Antecipacao
- **Quem**: Contribuintes do ICMS optantes pelo SN (exceto MEI e quem ja faz EFD)
- **Prazo**: Dia 28 do mes seguinte
- **Aplicativo**: SEDIF-SN (Sistema Eletronico de Documentos e Informacoes Fiscais do SN)
- **O que declara**:
  - ICMS retido como substituto tributario (ST)
  - Diferencial de Aliquota (DIFAL) — compras interestaduais
  - Antecipacao tributaria
  - Fundo de Combate a Pobreza (FCP)
- **Obrigatoria mesmo sem movimento** (exceto SP que dispensa)
- **Base legal**: Ajuste SINIEF 12/2015, LC 123/2006 art. 26 §12
- **Penalidade**: Multa estadual + possivel suspensao da IE apos 3 meses consecutivos ou 6 alternados

### 1.6 DAS (Guia de Pagamento)
- Guia unica gerada pelo PGDAS-D
- Vencimento: dia 20 do mes seguinte
- Pode ser pago via boleto, debito automatico ou PIX
- Valores abaixo de R$ 10 sao acumulados para o mes seguinte

### 1.7 Sublimite Estadual
- **Sublimite 2026**: R$ 3.600.000,00 (Portaria CGSN 54/2025)
- **Nenhum estado reduziu** o sublimite para 2026
- **O que acontece ao ultrapassar**:
  - Continua no SN para tributos FEDERAIS (IRPJ, CSLL, PIS, COFINS)
  - Passa a recolher ICMS e ISS pelo REGIME NORMAL (fora do DAS)
  - Se excesso < 20% (ate R$ 4,32M): efeito a partir de 1o de janeiro do ano seguinte
  - Se excesso > 20% (acima R$ 4,32M): efeito IMEDIATO (mes seguinte)
- **Novas obrigacoes**: EFD Fiscal (SPED), GIA, escrituracao completa de ICMS
- **Retorno**: Se no ano seguinte ficar abaixo do sublimite, volta a recolher ICMS/ISS no DAS

### 1.8 Retencoes no Simples Nacional
| Tributo | Prestador SN | Tomador SN | Observacao |
|---------|-------------|------------|------------|
| **INSS 11%** | SIM, apenas Anexo IV (obras construcao civil) | N/A | Cessao mao de obra ou empreitada |
| **INSS 3,5%** | SIM, se optou pela desoneracao | N/A | Construcao civil com CPRB |
| **ISS** | SIM — retencao na fonte pelo tomador | SIM | Aliquota efetiva do SN informada na NF |
| **IRRF** | **NAO** (dispensado — IN 765/2007) | SIM (retém do prestador nao-SN) | |
| **CSLL/PIS/COFINS** | **NAO** (dispensado) | **NAO** | |

### 1.9 Causas de Exclusao do Simples Nacional
1. **Excesso de faturamento**: Ultrapassar R$ 4,8M/ano
2. **Debitos fiscais**: INSS, RFB, estados ou municipios em aberto
3. **Atividade vedada**: Exercer atividade nao permitida pela LC 123/2006
4. **Socio PJ**: Ter pessoa juridica como socia
5. **Socio no exterior**: Ter socio residente no exterior
6. **Irregularidades cadastrais**: CNPJ inapto, IE suspensa
7. **Omissao de declaracoes**: Nao entregar PGDAS-D por 3 meses consecutivos ou 6 alternados

**Prazo para regularizacao (debitos)**: 90 dias (LC 216/2025 — antes era 30 dias)
**Reenquadramento**: Ate 31/01 do ano seguinte, se regularizado

---

## 2. LUCRO PRESUMIDO

### 2.1 Visao Geral
- Limite de faturamento: **R$ 78.000.000,00/ano**
- Base de calculo PRESUMIDA (nao precisa apurar lucro real)
- Apuracao TRIMESTRAL (jan-mar, abr-jun, jul-set, out-dez)
- Opcao irretratavel para o ano-calendario

### 2.2 Percentuais de Presuncao — IRPJ

| Atividade | % Presuncao IRPJ |
|-----------|------------------|
| Comercio e industria | 8% |
| Transporte de cargas | 8% |
| Servicos hospitalares | 8% |
| Construcao civil (empreitada com materiais) | 8% |
| Transporte de passageiros | 16% |
| Revenda de combustiveis | 1,6% |
| Prestacao de servicos em geral | 32% |
| Intermediacao de negocios | 32% |
| Administracao/locacao de imoveis | 32% |
| Construcao civil (sem materiais, apenas mao de obra) | 32% |

### 2.3 Percentuais de Presuncao — CSLL

| Atividade | % Presuncao CSLL |
|-----------|------------------|
| Comercio e industria | 12% |
| Transporte (cargas e passageiros) | 12% |
| Servicos hospitalares | 12% |
| Construcao civil / Atividades imobiliarias | 12% |
| Prestacao de servicos em geral | 32% |

### 2.4 NOVIDADE 2026 — Aumento de presuncao (LC 224/2025)
- Para faturamento **acima de R$ 5.000.000/ano** (ou R$ 1.250.000/trimestre):
  - Acrescimo de **10%** nos percentuais de presuncao APENAS sobre a parcela excedente
  - Servicos: 32% → **35,2%** (na parcela excedente)
  - Comercio/industria IRPJ: 8% → **8,8%** (parcela excedente)
  - Comercio/industria CSLL: 12% → **13,2%** (parcela excedente)
  - Combustiveis: 1,6% → **1,76%** (parcela excedente)
- **Vigencia IRPJ**: 01/01/2026
- **Vigencia CSLL**: 01/04/2026 (noventena)

### 2.5 Calculo dos Tributos

#### IRPJ
- **Aliquota**: 15% sobre a base presumida
- **Adicional**: 10% sobre a parcela que exceder R$ 60.000/trimestre (R$ 20.000/mes)
- **Exemplo**: Servicos, receita R$ 500.000/tri
  - Base: 32% x 500.000 = R$ 160.000
  - IRPJ: 15% x 160.000 = R$ 24.000
  - Adicional: 10% x (160.000 - 60.000) = R$ 10.000
  - **Total IRPJ: R$ 34.000**

#### CSLL
- **Aliquota**: 9% sobre a base presumida
- **Sem adicional**
- **Exemplo**: Servicos, receita R$ 500.000/tri
  - Base: 32% x 500.000 = R$ 160.000
  - CSLL: 9% x 160.000 = R$ 14.400

#### PIS (Cumulativo)
- **Aliquota**: 0,65% sobre a receita bruta
- **Sem creditos** (regime cumulativo)
- **Apuracao mensal**

#### COFINS (Cumulativa)
- **Aliquota**: 3% sobre a receita bruta
- **Sem creditos** (regime cumulativo)
- **Apuracao mensal**

### 2.6 ICMS e ISS
- **ICMS**: Escrituracao normal, creditos e debitos, ST, DIFAL
  - Regras do estado onde opera
  - Apuracao mensal
- **ISS**: Aliquota municipal (2% a 5%)
  - Retencao na fonte quando servico em outro municipio
  - Base de calculo: preco do servico

### 2.7 Obrigacoes Acessorias — Lucro Presumido

| Obrigacao | Descricao | Prazo | Periodicidade |
|-----------|-----------|-------|---------------|
| **DCTFWeb** | Declaracao de debitos/creditos federais | Ultimo dia util do mes seguinte | Mensal |
| **EFD-Contribuicoes** | Escrituracao PIS/COFINS | 10o dia util do 2o mes seguinte | Mensal |
| **EFD ICMS/IPI** | SPED Fiscal (se contribuinte ICMS) | Dia 25 do mes seguinte | Mensal |
| **ECD** | Escrituracao Contabil Digital | 30/06/2026 (ref. 2025) | Anual |
| **ECF** | Escrituracao Contabil Fiscal | 31/07/2026 (ref. 2025) | Anual |
| **eSocial** | Eventos trabalhistas | Conforme evento | Mensal |
| **EFD-Reinf** | Retencoes e informacoes | Dia 15 do mes seguinte | Mensal |
| **DIRF** | **EXTINTA** a partir de fatos 2025 | N/A | Substituida por eSocial + EFD-Reinf |

### 2.8 Contribuicao Previdenciaria Patronal
- **20% sobre a folha de pagamento** (CPP)
- RAT (1% a 3%) + Terceiros (5,8%)
- Ou CPRB (desoneracao): aliquota sobre receita bruta (construcao civil: 4,5%)

---

## 3. LUCRO REAL

### 3.1 Visao Geral
- Obrigatorio para: faturamento > R$ 78M/ano, bancos, seguradoras, quem tem lucro exterior
- Base de calculo: **lucro contabil ajustado** (adições + exclusoes + compensacoes)
- Pode ser **trimestral** ou **anual** (com estimativas mensais)
- Permite compensar **prejuizos fiscais** (limitado a 30% do lucro)

### 3.2 IRPJ
- **Aliquota**: 15% sobre o lucro real
- **Adicional**: 10% sobre parcela que exceder R$ 20.000/mes (ou R$ 60.000/tri)
- **Base**: Lucro liquido contabil + adicoes - exclusoes - compensacoes

### 3.3 CSLL
- **Aliquota**: 9% sobre a base de calculo da CSLL
- **Base**: Similar ao IRPJ, com ajustes proprios

### 3.4 PIS Nao-Cumulativo
- **Aliquota**: 1,65%
- **Com creditos** (regime nao-cumulativo)
- **Base legal**: Lei 10.637/2002

### 3.5 COFINS Nao-Cumulativa
- **Aliquota**: 7,6%
- **Com creditos** (regime nao-cumulativo)
- **Base legal**: Lei 10.833/2003

### 3.6 Creditos de PIS/COFINS (9,25% combinados)

#### O que GERA credito:
1. **Bens para revenda** (exceto monofasicos e ST)
2. **Insumos** (bens e servicos essenciais/relevantes para a atividade — REsp 1.221.170/PR STJ)
3. **Energia eletrica e termica** consumida nos estabelecimentos
4. **Alugueis** de predios, maquinas e equipamentos (PJ)
5. **Leasing** (arrendamento mercantil de PJ)
6. **Depreciacao** de maquinas/equipamentos do imobilizado
7. **Frete** na compra, venda e producao
8. **Mercadorias importadas** (base = valor que serviu para PIS/COFINS-Importacao)
9. **Devolucoes** de vendas
10. **Armazenagem e frete na venda**

#### O que NAO gera credito:
1. Mao de obra (folha de pagamento)
2. Despesas administrativas sem vinculo com atividade-fim
3. Bens/servicos de PJ optante pelo SN
4. Bens com isencao ou aliquota zero
5. ICMS destacado na aquisicao
6. Brindes, despesas pessoais

#### Conceito de insumo (STJ):
- **Essencialidade**: sem o item, a producao/servico e inviavel
- **Relevancia**: integra o processo de forma significativa
- Ampliou consideravelmente o rol de creditos

### 3.7 LALUR e LACS
- **LALUR**: Livro de Apuracao do Lucro Real
- **LACS**: Livro de Apuracao da CSLL
- Registram adicoes, exclusoes e compensacoes
- **Integrados a ECF** desde o SPED
- Parte A: ajustes do lucro liquido
- Parte B: controle de valores que afetam periodos futuros (prejuizo fiscal, etc.)

### 3.8 Obrigacoes Acessorias — Lucro Real

| Obrigacao | Descricao | Prazo | Periodicidade |
|-----------|-----------|-------|---------------|
| **DCTFWeb** | Todos os tributos federais | Ultimo dia util do mes seguinte | Mensal |
| **EFD-Contribuicoes** | PIS/COFINS detalhado com creditos | 10o dia util do 2o mes seguinte | Mensal |
| **EFD ICMS/IPI** | SPED Fiscal completo | Dia 25 do mes seguinte | Mensal |
| **ECD** | Escrituracao Contabil Digital | 30/06/2026 (ref. 2025) | Anual |
| **ECF** | Escrituracao Contabil Fiscal (inclui LALUR/LACS) | 31/07/2026 (ref. 2025) | Anual |
| **eSocial** | Eventos trabalhistas | Conforme evento | Mensal |
| **EFD-Reinf** | Retencoes e informacoes | Dia 15 do mes seguinte | Mensal |
| **DIRF** | **EXTINTA** a partir de fatos 2025 | N/A | Substituida por eSocial + EFD-Reinf |

### 3.9 Reducao de Beneficios Fiscais 2026 (LC 224/2025)
- Corte linear de **10%** nos beneficios existentes
- Isencao/aliquota zero: passa a cobrar 10% da aliquota padrao
- Aliquota reduzida: 90% da reduzida + 10% da padrao
- Reducao de base de calculo: limitada a 90% da reducao original
- Creditos presumidos: limitados a 90% do valor
- **NAO aplica**: imunidades constitucionais, ZFM, Cesta Basica Nacional
- **Vigencia IRPJ**: 01/01/2026
- **Vigencia CSLL/PIS/COFINS**: 01/04/2026

---

## 4. TABELA COMPARATIVA COMPLETA

### 4.1 Impostos e Aliquotas

| Item | Simples Nacional | Lucro Presumido | Lucro Real |
|------|-----------------|----------------|------------|
| **Limite faturamento** | R$ 4,8M/ano | R$ 78M/ano | Sem limite |
| **IRPJ** | Incluso no DAS | 15% + 10% adicional (base presumida) | 15% + 10% adicional (lucro real) |
| **CSLL** | Incluso no DAS | 9% (base presumida) | 9% (base real) |
| **PIS** | Incluso no DAS | 0,65% cumulativo | 1,65% nao-cumulativo |
| **COFINS** | Incluso no DAS | 3% cumulativo | 7,6% nao-cumulativo |
| **ICMS** | Incluso no DAS (ate sublimite) | Normal (credito/debito) | Normal (credito/debito) |
| **ISS** | Incluso no DAS (ate sublimite) | Aliquota municipal 2%-5% | Aliquota municipal 2%-5% |
| **IPI** | Incluso no DAS (Anexo II) | Normal | Normal |
| **CPP** | Incluso no DAS (exceto Anexo IV) | 20% sobre folha | 20% sobre folha |
| **Carga efetiva tipica** | 4% a 19% (comercio) | 10% a 15% (servicos) | Variavel |

### 4.2 Direito a Creditos

| Credito | Simples Nacional | Lucro Presumido | Lucro Real |
|---------|-----------------|----------------|------------|
| **ICMS** | NAO (dentro do DAS) | SIM (credito/debito) | SIM (credito/debito + ST) |
| **PIS** | NAO | NAO (cumulativo) | SIM (nao-cumulativo) |
| **COFINS** | NAO | NAO (cumulativo) | SIM (nao-cumulativo) |
| **IPI** | NAO | SIM (na entrada) | SIM (na entrada) |
| **Prejuizo fiscal** | NAO | NAO | SIM (compensacao 30%) |

### 4.3 Obrigacoes Acessorias Comparadas

| Obrigacao | Simples Nacional | Lucro Presumido | Lucro Real |
|-----------|-----------------|----------------|------------|
| **PGDAS-D** | SIM (mensal) | NAO | NAO |
| **DEFIS** | SIM (anual) | NAO | NAO |
| **DeSTDA** | SIM (mensal, ICMS) | NAO | NAO |
| **DAS** | SIM (guia unica) | NAO | NAO |
| **DCTFWeb** | NAO | SIM (mensal) | SIM (mensal) |
| **EFD-Contribuicoes** | NAO | SIM (mensal) | SIM (mensal, com creditos) |
| **EFD ICMS/IPI** | NAO (salvo sublimite) | SIM (se contribuinte ICMS) | SIM |
| **ECD** | NAO | SIM (se distribuir lucros > presuncao) | SIM |
| **ECF** | NAO | SIM (anual) | SIM (anual, com LALUR/LACS) |
| **LALUR/LACS** | NAO | NAO | SIM (integrado na ECF) |
| **eSocial** | SIM | SIM | SIM |
| **EFD-Reinf** | SIM | SIM | SIM |
| **DIRF** | **EXTINTA** | **EXTINTA** | **EXTINTA** |

### 4.4 Livros Fiscais Obrigatorios

| Livro | Simples Nacional | Lucro Presumido | Lucro Real |
|-------|-----------------|----------------|------------|
| Livro Caixa | SIM | Opcional | NAO |
| Livro Diario | Opcional | SIM | SIM |
| Livro Razao | Opcional | SIM | SIM |
| Registro de Entradas | SIM | SIM | SIM |
| Registro de Saidas | NAO | SIM | SIM |
| Registro de Inventario | SIM | SIM | SIM |
| LALUR (Parte A e B) | NAO | NAO | SIM |
| LACS | NAO | NAO | SIM |
| Livro de Servicos Prestados | SIM (ISS) | SIM (ISS) | SIM (ISS) |
| Livro de Servicos Tomados | SIM (ISS) | SIM (ISS) | SIM (ISS) |

### 4.5 Arquivos Digitais Obrigatorios

| Arquivo | Simples Nacional | Lucro Presumido | Lucro Real |
|---------|-----------------|----------------|------------|
| NF-e / NFC-e | SIM | SIM | SIM |
| NFS-e | SIM | SIM | SIM |
| CT-e | Se transportador | SIM | SIM |
| SPED Fiscal (EFD) | NAO (salvo sublimite) | SIM | SIM |
| EFD-Contribuicoes | NAO | SIM | SIM |
| ECD (.txt SPED) | NAO | Condicional | SIM |
| ECF (.txt SPED) | NAO | SIM | SIM |

### 4.6 Retencoes na Fonte

| Retencao | Simples Nacional | Lucro Presumido | Lucro Real |
|----------|-----------------|----------------|------------|
| **IRRF (1,5% servicos)** | Dispensado como prestador | Reter e recolher | Reter e recolher |
| **CSRF (4,65%)** | Dispensado | Reter PIS+COFINS+CSLL | Reter PIS+COFINS+CSLL |
| **INSS (11%)** | Apenas Anexo IV (obras) | SIM (cessao mao de obra) | SIM (cessao mao de obra) |
| **INSS (3,5%)** | Se desoneracao (construcao) | Se desoneracao | Se desoneracao |
| **ISS** | SIM (retencao na fonte) | SIM (retencao na fonte) | SIM (retencao na fonte) |

---

## 5. CONSTRUCAO CIVIL — ESPECIFICIDADES

### 5.1 INSS sobre Mao de Obra

#### Retencao de 11%
- Contratante de empresa que presta servico em obra **DEVE reter 11%** sobre o valor bruto da NF
- Aplica-se a: empreitada e subempreitada
- Objetivo: elidir a responsabilidade solidaria do contratante
- O valor retido e antecipacao — compensavel com INSS da folha do prestador

#### Retencao de 3,5% (Desoneracao da Folha)
- Empresas optantes pela CPRB (Contribuicao Previdenciaria sobre Receita Bruta)
- Substitui a retencao de 11% por 3,5%
- **Transicao 2025-2027**: reducao gradual (Lei 14.973/2024)
- A partir de 2028: volta ao 11% para todos

#### Simples Nacional — Construcao Civil
- **Anexo IV** (obras): CPP NAO esta inclusa no DAS → paga 20% sobre folha separado
- Retencao de 11% ou 3,5% aplica-se normalmente para atividades do Anexo IV
- Prestador deve fornecer declaracao de opcao pela desoneracao para aplicar 3,5%

### 5.2 CEI / CNO (Cadastro Nacional de Obras)
- Toda obra de construcao civil deve ser inscrita no CEI/CNO
- **Responsavel pela inscricao**:
  - Proprietario do imovel
  - Dono da obra
  - Incorporador
  - Construtora (empreitada total)
  - Empresa lider (consorcio)
- **Obrigacoes vinculadas ao CEI/CNO**:
  - Recolhimento de INSS individualizado por obra
  - GFIP com matricula CEI
  - NF com retencao vinculada a matricula CEI
- **Exigido para CND de obra** (certidao negativa para averbacao)

### 5.3 Nota Fiscal de Servico em Obra
- NFS-e emitida pelo prestador (construtora/empreiteira)
- Deve conter:
  - Dados da obra (endereco, CNO/CEI)
  - Valor bruto do servico
  - Retencoes: INSS (11% ou 3,5%), ISS
  - Materiais aplicados (quando dedutivel da base do ISS)
- **Material fornecido pelo prestador**: pode ser deduzido da base do ISS (LC 116/2003, item 7.02)

### 5.4 CFOPs Especificos para Construcao Civil

| CFOP | Descricao | Uso |
|------|-----------|-----|
| **1.128** | Compra para prestacao de servico (ISS) | Entrada de materiais para obra |
| **1.126** | Compra para prestacao de servico (ICMS) | Entrada quando sujeito ao ICMS |
| **1.556** | Compra de material para uso/consumo | Entrada para consumo na obra |
| **1.407** | Compra com ST para uso/consumo | Entrada com substituicao tributaria |
| **5.949** | Simples remessa | Movimentacao de materiais para obra |
| **5.210** | Devolucao de compra para prestacao servico | Devolucao ao fornecedor |
| **5.101** | Venda producao propria | Produto fabricado FORA da obra (com ICMS) |
| **6.107/6.108** | Venda interestadual para nao contribuinte | Fornecimento interestadual |

### 5.5 Material Aplicado em Obra — ICMS
- Regra geral: construtora **NAO e contribuinte de ICMS** (atividade de servico)
- **NAO incide ICMS** sobre materiais adquiridos de terceiros e aplicados em obra
- **INCIDE ICMS** quando: material e fabricado PELO PRESTADOR fora do local da obra
- NF de saida para obra: CFOP 5.949, sem destaque de ICMS, CST 41
- Escrituracao: sem debito e sem credito

### 5.6 Subempreitada — Tratamento Fiscal
- Subempreitada: contrato entre a empreiteira e uma terceira empresa para parte da obra
- **INSS**: subempreiteira sofre retencao de 11% (ou 3,5%) na NF
- **ISS**: incide normalmente sobre o servico da subempreiteira
- **GFIP**: cada subempreiteira recolhe suas contribuicoes
- **Base ISS**: valor do servico (material fornecido pode ser deduzido se previsto em lei municipal)
- **Responsabilidade solidaria**: contratante principal responde por INSS de toda a cadeia

### 5.7 ISS na Construcao Civil
- **Aliquota**: 2% a 5% (definida por cada municipio)
- **Item LC 116/2003**: 7.02 (execucao por administracao, empreitada ou subempreitada)
- **Base de calculo**: Preco do servico
- **Deducao de materiais**: SIM — materiais fornecidos pelo prestador deduzidos da base (item 7.02)
- **Retencao na fonte**: Obrigatoria quando sede da empresa != local da obra
- **ISS devido**: No municipio onde a obra e executada (regra geral para construcao civil)
- **Nota fiscal**: Deve discriminar separadamente servico e materiais

---

## 6. REFORMA TRIBUTARIA 2026-2033

### 6.1 Timeline de Transicao

| Ano | O que acontece |
|-----|---------------|
| **2026** | FASE DE TESTE: CBS 0,9% + IBS 0,1% = 1% (simbolico, compensavel com PIS/COFINS) |
| **2027** | CBS entra em vigor PLENO (~8,8%), extingue PIS/COFINS. IS (Imposto Seletivo) comeca. IPI zerado (exceto ZFM) |
| **2028** | IBS em fase de calibracao. Desoneracao da folha encerra transicao |
| **2029** | IBS comeca transicao real — ICMS e ISS reduzem 10%/ano |
| **2030** | ICMS e ISS reduzem mais 10% |
| **2031** | ICMS e ISS reduzem mais 10% |
| **2032** | ICMS e ISS reduzem mais 10% |
| **2033** | ICMS e ISS EXTINTOS. IBS + CBS = IVA Dual em vigor pleno |

### 6.2 CBS (Contribuicao sobre Bens e Servicos)
- **Substitui**: PIS e COFINS
- **Esfera**: Federal (administrado pela Receita Federal)
- **Aliquota de referencia**: ~8,8%
- **Em 2026**: Aliquota de teste 0,9% (compensavel com PIS/COFINS)
- **Em 2027**: Entra em vigor definitivamente
- **Caracteristicas**: Nao-cumulativo, IVA por dentro, base ampla

### 6.3 IBS (Imposto sobre Bens e Servicos)
- **Substitui**: ICMS (estadual) + ISS (municipal)
- **Esfera**: Estadual + Municipal (administrado pelo Comite Gestor do IBS)
- **Aliquota de referencia**: ~17,7%
- **Em 2026**: Aliquota de teste 0,1%
- **Em 2029-2032**: Transicao gradual (ICMS/ISS reduzem, IBS sobe)
- **Em 2033**: Substituicao definitiva do ICMS e ISS
- **Caracteristicas**: Nao-cumulativo, cobranca no DESTINO (fim da guerra fiscal)

### 6.4 IS (Imposto Seletivo) — "Imposto do Pecado"
- **Substitui parcialmente**: IPI
- **Funcao**: Extrafiscal — desestimular consumo nocivo
- **Produtos sujeitos**:
  - Cigarros e fumo
  - Bebidas alcoolicas
  - Bebidas acucaradas
  - Combustiveis fosseis
  - Veiculos (mais poluentes = mais imposto)
  - Embarcacoes e aeronaves
  - Loterias e apostas
  - **NAO inclui**: armas e municoes (removidas do texto final)
- **Aliquota**: 25% a 26,5% (padrao); minerais max 2,5%
- **Pode ser**: ad valorem e/ou ad rem (especifica)
- **Inicio**: 2027 (definicao de aliquotas por lei ordinaria, ainda nao enviada)

### 6.5 Aliquota Total do IVA Brasileiro
- **Projecao**: 26,5% a 28% (CBS + IBS)
- **Reducoes previstas**:
  - Operacoes com imoveis: reducao de 50%
  - Educacao e saude: reducao de 60%
  - Profissionais liberais: reducao de 30%
  - Cesta basica: isencao ou aliquota zero
- **Trava constitucional**: Se combinacao CBS+IBS exceder teto, governo deve ajustar

### 6.6 Split Payment
- **O que e**: Separacao automatica do imposto no momento do pagamento
- **Mecanismo**: Valor da venda vai para o fornecedor; tributo vai direto para o Fisco
- **Meios de pagamento**: PIX, cartao de credito/debito, boleto
- **Cronograma**:
  - 2026: Teste (facultativo)
  - 2027: Implementacao efetiva com CBS
  - 2029-2033: Expansao com IBS
- **Obrigatorio no varejo** a partir de 2027
- **Motor de apuracao**: Calcula e distribui tributos em tempo real
- **Impacto**: Empresas NAO terao mais o dinheiro do imposto em caixa — vai direto ao governo

### 6.7 Impacto nos Sistemas Fiscais (o que um ERP precisa fazer)

#### Ja em 2026 (URGENTE):
1. **NF-e/NFC-e/NFS-e**: Incluir campos CBS (0,9%) e IBS (0,1%) nos XMLs
2. **Nota Tecnica**: Adaptar leiaute conforme NT da SEFAZ (novos campos obrigatorios)
3. **Calculo dual**: Manter calculo PIS/COFINS/ICMS/ISS + novo calculo CBS/IBS
4. **Compensacao**: Permitir compensar CBS/IBS pago com debitos de PIS/COFINS
5. **Relatorios**: Gerar relatorios com os dois sistemas em paralelo

#### A partir de 2027:
6. **Extincao PIS/COFINS**: Substituir por CBS cheia (~8,8%)
7. **Creditos**: Novo sistema de creditos CBS (substituindo PIS/COFINS nao-cumulativo)
8. **Split Payment**: Integrar com meios de pagamento para separacao automatica
9. **IS**: Calcular Imposto Seletivo para produtos aplicaveis

#### 2029-2033:
10. **IBS progressivo**: Aumentar aliquota IBS conforme ICMS/ISS diminuem
11. **Cobranca no destino**: Mudar logica de ICMS (origem) para IBS (destino)
12. **Extincao gradual**: Remover calculos de ICMS/ISS conforme forem extintos
13. **Livros fiscais**: Adaptar escrituracao para novo modelo

### 6.8 Simples Nacional na Reforma Tributaria
- **2026**: Sem impacto. Destaque CBS/IBS nas NFs e OPCIONAL
- **2027 em diante**: SN pode optar por recolher CBS/IBS por fora do DAS
  - Se optar: permite que clientes tomem creditos de CBS/IBS
  - Se nao optar: clientes NAO tomam credito (perda de competitividade B2B)
- Estrutura do DAS deve ser adaptada para CBS/IBS

---

## 7. RESUMO PARA IMPLEMENTACAO NO ERP

### 7.1 Dados Cadastrais Necessarios por Empresa
- Regime tributario: SN, Presumido, Real
- Anexo do SN (I a V)
- CNAE principal e secundarios
- Inscricao estadual e municipal
- Optante pelo SN? Optante CPRB (desoneracao)?
- Faturamento 12 meses (para calculo aliquota SN)
- Folha de pagamento 12 meses (para Fator R)
- Percentuais de presuncao (LP)
- Certificado digital A1

### 7.2 Calculos que o ERP Precisa Fazer
1. **SN**: Aliquota efetiva por anexo/faixa, Fator R, DAS
2. **LP**: Base presumida IRPJ/CSLL, PIS/COFINS cumulativos, ICMS debito/credito
3. **LR**: Lucro contabil ajustado, LALUR, PIS/COFINS com creditos, ICMS completo
4. **Retencoes**: INSS (11%/3,5%), IRRF (1,5%), CSRF (4,65%), ISS
5. **Construcao civil**: CEI/CNO, retencoes especificas, deducao material da base ISS
6. **2026+**: CBS 0,9%, IBS 0,1% nos documentos fiscais

### 7.3 Obrigacoes que o ERP Pode Gerar/Auxiliar
- PGDAS-D (segregacao de receitas)
- DAS (guia de pagamento)
- DeSTDA (ICMS ST/DIFAL)
- EFD ICMS/IPI (SPED Fiscal)
- EFD-Contribuicoes (PIS/COFINS)
- DCTFWeb (integracao)
- Escrituracao contabil (suporte ECD/ECF)
- Retencoes na fonte (DIRF substituida por eSocial/EFD-Reinf)

---

## FONTES CONSULTADAS

### Simples Nacional
- Contabilizei: https://www.contabilizei.com.br/contabilidade-online/tabela-simples-nacional-completa/
- Portal do Simples Nacional: https://www8.receita.fazenda.gov.br/simplesnacional/
- Contabeis: https://www.contabeis.com.br/noticias/75213/defis-2026-prazo-regras-e-como-entregar/
- Junior Contador: https://juniorcontador.com.br/pgdas-d/
- FENACON: https://fenacon.org.br/noticias/simples-nacional-sublimite-de-icms-e-iss-e-mantido-em-r-36-milhoes-para-2026/

### Lucro Presumido e Real
- Escola Superior ESN: https://escolasuperioresn.com.br/lucro-presumido-percentuais-distribuicao-lucros/
- Escola Superior ESN: https://escolasuperioresn.com.br/creditos-pis-cofins-lucro-real/
- Escola Superior ESN: https://escolasuperioresn.com.br/obrigacoes-acessorias-lucro-real/
- Paulicon: https://paulicon.com.br/2026/01/23/tributacao-pelo-lucro-presumido-em-2026/
- Contabilidade Scalabrini: https://www.contabilidadescalabrini.com.br/lucro-presumido-2026/
- FENACON: https://fenacon.org.br/noticias/o-jabuti-de-2026-governo-transformou-lucro-presumido-em-beneficio-fiscal/
- Tax Group: https://www.taxgroup.com.br/intelligence/calendario-tributario-2026-confira-os-prazos-e-obrigacoes/

### Construcao Civil
- MLF Consultoria: https://www.mlfconsultoria.com.br/blog-mlf/retencoes-tributarias-na-construcao-civil
- EMEA Martins: https://emea.com.br/publicacoes/a-retencao-sobre-empreitada-e-na-cessao-de-mao-de-obra-na-construcao-civil/
- Open Treinamentos: https://opentreinamentos.com.br/retencao-de-inss-na-construcao-civil-2/
- SEFAZ SP: https://legislacao.fazenda.sp.gov.br/Paginas/RC26668_2022.aspx
- Sienge: https://sienge.com.br/reforma-tributaria-e-construcao-civil/

### Reforma Tributaria
- Tax Group: https://www.taxgroup.com.br/intelligence/reforma-tributaria-2026-guia-completo-sobre-o-que-muda-e-a-transicao/
- Camara dos Deputados: https://www.camara.leg.br/noticias/1237089-reforma-tributaria-comeca-fase-de-transicao-com-testes-de-novos-impostos-em-2026/
- Thomson Reuters: https://www.thomsonreuters.com.br/pt/reforma-tributaria.html
- Contmat: https://blog.contmatic.com.br/linha-do-tempo-da-reforma-tributaria-o-que-acontece-de-2026-a-2033/
- Focus NFe: https://focusnfe.com.br/blog/split-payment/
- EY Brasil: https://www.ey.com/pt_br/newsroom/2026/01/reforma-tributaria-split-payment-vai-alterar-gestao-caixa-empresas
