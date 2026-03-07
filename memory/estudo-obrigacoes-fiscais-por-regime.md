# Estudo Completo: Obrigacoes Fiscais Brasileiras por Regime Tributario

> Data: 2026-03-06
> Objetivo: Base para modelagem do modulo fiscal do Tecnikos
> Fontes: Pesquisa web atualizada (legislacao vigente 2025/2026)

---

## 1. SIMPLES NACIONAL

### 1.1 PGDAS-D (Programa Gerador do DAS - Declaratorio)

**O que e**: Declaracao mensal obrigatoria onde a empresa informa a receita bruta e calcula os tributos devidos no Simples Nacional.

**Prazo**: Ate o dia 20 de cada mes, referente ao faturamento do mes anterior. Obrigatorio mesmo nos meses SEM faturamento.

**Como calcular**:
1. Segregar faturamento por atividade (CNAE) no mes
2. Identificar o Anexo correspondente (I a V) pelo CNAE
3. Calcular a RBT12 (Receita Bruta acumulada dos ultimos 12 meses)
4. Localizar a faixa do RBT12 no anexo
5. Aplicar formula: **Aliquota Efetiva = (RBT12 x ALIQ - PD) / RBT12**
   - ALIQ = aliquota nominal da faixa
   - PD = parcela a deduzir da faixa
6. Multiplicar receita do mes pela aliquota efetiva
7. Somar resultados de cada atividade = DAS do mes

**Fator R** (para servicos Anexo III/V):
- Formula: Folha 12 meses / Receita 12 meses
- >= 28%: tributa no Anexo III (aliquotas menores, a partir de 6%)
- < 28%: tributa no Anexo V (aliquotas maiores, a partir de 15,5%)
- Avaliacao e MENSAL (pode alternar entre anexos)

**Anexos resumidos**:
| Anexo | Atividade | Aliquotas nominais |
|-------|-----------|-------------------|
| I | Comercio | 4% a 19% |
| II | Industria | 4,5% a 30% |
| III | Servicos (fator R >= 28%) | 6% a 33% |
| IV | Servicos especificos (construcao civil, vigilancia, limpeza) | 4,5% a 33% |
| V | Servicos intelectuais/tecnicos (fator R < 28%) | 15,5% a 30,5% |

**IMPORTANTE para construcao civil**: Construcao civil geralmente cai no Anexo IV (nao inclui CPP no DAS — recolhe INSS separado).

**Multa por atraso (NOVIDADE 2026)**: 2% ao mes, limitada a 20%, minimo R$ 50 por mes de referencia. Vale desde 01/01/2026.

### 1.2 DEFIS (Declaracao de Informacoes Socioeconomicas e Fiscais)

**O que e**: Declaracao ANUAL obrigatoria para ME e EPP do Simples Nacional (exceto MEI).

**Prazo**: Ate 31 de marco do ano seguinte (ex: DEFIS 2025 ate 31/03/2026).

**Quem entrega**: Todas as empresas que foram SN em qualquer momento do ano, inclusive inativas.

**Campos obrigatorios por estabelecimento**:
1. Estoque inicial (Livro Registro de Inventario)
2. Estoque final (Livro Registro de Inventario)
3. Saldo em caixa/banco inicio do periodo
4. Saldo em caixa/banco final do periodo
5. Total aquisicoes mercadorias (mercado interno + importacoes)
6. Total entradas por transferencia (entre estabelecimentos)
7. Total saidas por transferencia
8. Total devolucoes de vendas
9. Entradas/saidas interestaduais por UF
10. Total de despesas no periodo
11. Aquisicoes de contribuintes dispensados de inscricao
12. Valor ISS retido na fonte por municipio
13. Prestacao de servicos de comunicacao (por UF/municipio)

**Campos globais da empresa**:
- Doacoes a campanhas eleitorais
- Rendimentos dos socios (pro-labore, lucros distribuidos)
- Dados economicos gerais

**Multa por atraso (NOVIDADE 2026)**: 2% ao mes sobre valor nao declarado, limitada a 20%, minimo R$ 200. R$ 100 por grupo de 10 informacoes incorretas/omitidas.

### 1.3 DeSTDA (Declaracao de ST, DIFAL e Antecipacao)

**O que e**: Obrigacao mensal do ICMS para empresas do Simples Nacional que realizam operacoes sujeitas a Substituicao Tributaria, Diferencial de Aliquotas (DIFAL) ou Antecipacao Tributaria.

**Base legal**: Ajuste SINIEF 12/2015, Resolucao CGSN 140/2018 art. 76.

**Quem esta obrigado**: ME e EPP do Simples Nacional que sejam contribuintes de ICMS, EXCETO:
- MEI
- Empresas ja obrigadas a EFD ICMS/IPI

**Formato/Aplicativo**: SEDIF-SN (Sistema Eletronico de Documentos e Informacoes Fiscais). Aplicativo gratuito disponibilizado pelo CONFAZ. Aceita digitacao manual ou importacao de arquivo digital conforme leiaute do Ato COTEPE 47/2015.

**Prazo**: Ate o dia 28 do mes subsequente ao periodo de apuracao.

**O que declara**:
- ICMS-ST (Substituicao Tributaria) devido
- DIFAL (diferencial de aliquotas) — operacoes interestaduais para consumidor final
- Antecipacao tributaria nas entradas interestaduais

**Sem movimento**: Regra geral, deve enviar com "sem dados informados" (varia por estado).

**Retificacao**: Ate o prazo legal, sem autorizacao. Apos prazo, conforme regras estaduais. Sempre arquivo substituto completo.

**Dispensa GIA-ST**: Quem entrega DeSTDA esta dispensado da GIA-ST.

### 1.4 DAS (Documento de Arrecadacao do Simples Nacional)

**O que e**: Guia unica de pagamento que consolida ate 8 tributos (IRPJ, CSLL, PIS, COFINS, IPI, ICMS, ISS, CPP).

**Como gerar**: Automaticamente apos preencher o PGDAS-D no portal do Simples Nacional.

**Prazo de pagamento**: Ate o dia 20 do mes subsequente ao periodo de apuracao.

**Excecao Anexo IV**: CPP (Contribuicao Previdenciaria Patronal) NAO esta inclusa no DAS para atividades do Anexo IV (construcao civil, vigilancia, limpeza). Deve ser recolhida separadamente via GPS/DARF.

### 1.5 Livros Obrigatorios do Simples Nacional

1. **Livro Caixa**: Toda movimentacao financeira e bancaria (ou Livro Diario, que o substitui)
2. **Livro Registro de Inventario**: Estoques ao final de cada ano-calendario (contribuintes ICMS)
3. **Livro Registro de Entradas** (modelo 1 ou 1-A): Documentos fiscais de entradas (contribuintes ICMS)
4. **Livro Registro dos Servicos Prestados**: Documentos fiscais de servicos prestados (contribuintes ISS)
5. **Livro Registro de Servicos Tomados**: Documentos fiscais de servicos tomados (contribuintes ISS)
6. **Livro Registro Entrada/Saida Selo de Controle**: Se exigido pelo IPI

**Observacoes**:
- Livro Diario substitui Livro Caixa (Diario e mais completo)
- Legislacao tributaria exige minimo Livro Caixa, mas legislacao comercial (CC art. 1.179) exige Livro Diario
- SN esta DISPENSADO do Livro Registro de Saidas
- Falta de escrituracao do Livro Caixa = motivo para exclusao do SN

---

## 2. LUCRO PRESUMIDO

### 2.1 EFD-Contribuicoes (PIS/COFINS Cumulativo)

**O que e**: Escrituracao digital mensal de PIS e COFINS no regime CUMULATIVO.

**Regime**: No Lucro Presumido, PIS/COFINS sao CUMULATIVOS (sem creditos).
- Aliquota PIS: 0,65%
- Aliquota COFINS: 3,00%
- Total: 3,65% sobre receita bruta

**Prazo**: Ate o 10o dia util do 2o mes subsequente ao periodo de apuracao.

**Multa**: Ate 3% do valor das transacoes omitidas.

**Vigencia 2026**: Ainda obrigatoria (PIS/COFINS seguem vigentes em paralelo ao CBS em testes). Extincao prevista para 2027.

### 2.2 DCTF / DCTFWeb

**O que e**: Declaracao de Debitos e Creditos Tributarios Federais. Confissao formal dos tributos devidos e pagos.

**Situacao atual**: DCTF Mensal (PGD) foi EXTINTA e unificada com a DCTFWeb. Todos os tributos federais agora declarados em plataforma unica (IRPJ, CSLL, PIS, COFINS, IPI, IOF, CIDE).

**Prazo**: Ultimo dia util do mes seguinte ao periodo de apuracao.

**Dependencia**: eSocial → EFD-Reinf → DCTFWeb (nessa ordem).

### 2.3 ECF (Escrituracao Contabil Fiscal) — Anual

**O que e**: Substituiu a DIPJ desde 2014. Detalha informacoes contabeis e fiscais com foco na apuracao de IRPJ e CSLL.

**Prazo 2026**: Ate 31/07/2026 (ref. ano-calendario 2025).

**Obrigatoriedade**: Todas as PJ exceto SN, MEI e orgaos publicos.

**Dependencia**: Usa dados da ECD como base — ECD deve ser entregue ANTES.

### 2.4 ECD (Escrituracao Contabil Digital) — Anual

**O que e**: Substitui livros contabeis em papel (Diario, Razao, Balancetes) pelo formato digital SPED.

**Prazo 2026**: Ate 31/05/2026 (ref. ano-calendario 2025).

**Obrigatoriedade no LP**: Obrigatoria para empresas do Lucro Presumido que distribuirem lucros ACIMA do lucro presumido sem retencao de IRRF na fonte.

### 2.5 IRPJ e CSLL Trimestrais — Bases de Presuncao

**Apuracao**: TRIMESTRAL (trimestres encerrados em 31/3, 30/6, 30/9, 31/12).

**Aliquotas sobre a base presumida**:
- IRPJ: 15% + adicional de 10% sobre parcela que exceder R$ 60.000/trimestre
- CSLL: 9%

**Tabela de percentuais de presuncao — IRPJ**:

| Atividade | % IRPJ |
|-----------|--------|
| Revenda de combustiveis | 1,6% |
| Comercio, industria em geral | 8% |
| Servicos hospitalares | 8% |
| Transporte de cargas | 8% |
| **Construcao civil com TODOS os materiais (empreitada total)** | **8%** |
| Transporte de passageiros | 16% |
| Servicos em geral | 32% |
| Servicos profissionais (advocacia, contabilidade, etc) | 32% |
| **Construcao civil so mao de obra ou material parcial** | **32%** |
| Intermediacao de negocios | 32% |
| Locacao de bens moveis | 32% |

**Tabela de percentuais de presuncao — CSLL**:

| Atividade | % CSLL |
|-----------|--------|
| Comercio, industria, servicos hospitalares, transporte de cargas | 12% |
| **Construcao civil com TODOS os materiais** | **12%** |
| Transporte de passageiros | 12% |
| Revenda de combustiveis | 12% |
| Servicos em geral | 32% |
| **Construcao civil so mao de obra ou material parcial** | **32%** |

**CONFIRMADO para construcao civil**:
- Empreitada total (TODOS os materiais indispensaveis): **8% IRPJ / 12% CSLL**
- Empreitada parcial, administracao, so mao de obra: **32% IRPJ / 32% CSLL**
- Requisito: contrato deve especificar e empresa deve fornecer TODOS os materiais indispensaveis

**NOVIDADE 2026 — LC 224/2025**: Acrescimo de 10% nos percentuais de presuncao sobre parcela da receita bruta anual que EXCEDER R$ 5 milhoes:
- Ate R$ 5 mi/ano: percentuais normais
- Acima R$ 5 mi/ano: percentual x 1,10 (ex: 8% → 8,8%, 32% → 35,2%)
- IRPJ: vigente 01/01/2026
- CSLL: vigente 01/04/2026 (anterioridade nonagesimal)

**Pagamento**: Cota unica no prazo OU 3 cotas mensais iguais (2a e 3a com juros SELIC).

### 2.6 EFD-Reinf e eSocial

- EFD-Reinf: retencoes federais (IRRF, CSLL, PIS/COFINS sobre servicos tomados). Prazo: dia 15 do mes seguinte.
- eSocial: informacoes trabalhistas e previdenciarias.
- Ambos alimentam a DCTFWeb.

---

## 3. LUCRO REAL

### 3.1 Tudo do Lucro Presumido, MAIS:

O Lucro Real herda TODAS as obrigacoes do Lucro Presumido (DCTFWeb, ECD, ECF, EFD-Reinf, eSocial) com diferencas na complexidade.

### 3.2 EFD ICMS/IPI (SPED Fiscal)

**O que e**: Escrituracao fiscal digital detalhando documentos fiscais, apuracao de ICMS, IPI, ST e controle de estoque.

**Obrigatoriedade**: Contribuintes de ICMS e/ou IPI (independente do regime federal).

**Prazo**: Ate o dia 25 do mes subsequente.

**Conteudo**: Registros de NF-e, NFS-e, apuracao ICMS (normal + ST), IPI, controle de estoque, CIAP (credito ativo imobilizado).

**Novidade 2026**: Guia Pratico versao 3.1.9 (Ato COTEPE/ICMS 79/2025). Valores CBS e IBS NAO devem ser incluidos no Campo 12 (VL_DOC) do registro C100 durante 2026.

### 3.3 EFD-Contribuicoes NAO-CUMULATIVO

**Diferenca do Presumido**: No Lucro Real, PIS/COFINS sao NAO-CUMULATIVOS (com creditos):
- Aliquota PIS: 1,65%
- Aliquota COFINS: 7,60%
- Total: 9,25% sobre receita bruta, MENOS creditos

**Creditos admissiveis (conceito STJ — essencialidade/relevancia)**:
- Insumos (materias-primas, produtos intermediarios, embalagens)
- Energia eletrica e agua (processo produtivo)
- Alugueis de predios e equipamentos
- Depreciacao de ativo imobilizado (maquinas/equipamentos)
- Servicos contratados de PJ (manutencao, consultoria, transporte)
- Armazenagem e frete (quando onus do vendedor)
- Mao de obra temporaria (diretamente na producao)

**NAO geram credito**:
- Despesas administrativas genericas
- Folha de pagamento (pessoas fisicas)
- IPI recuperavel
- ICMS-ST pago na aquisicao

**Mudanca 01/04/2026 (LC 224/2025)**: Aliquotas de PIS/COFINS sobem para produtos antes isentos/aliquota zero (10% das aliquotas padrao). Creditos presumidos/financeiros limitados a 90% do valor original.

### 3.4 LALUR/LACS (dentro da ECF)

**O que e**: Livro de Apuracao do Lucro Real (LALUR) e Livro de Apuracao da CSLL (LACS). Registram adicoes, exclusoes e compensacoes que ajustam o lucro contabil para o lucro fiscal.

**Obrigatoriedade**: EXCLUSIVA do Lucro Real. Integrados a ECF (e-LALUR/e-LACS).

**Estrutura**:
- Parte A: Demonstracao do lucro real (adicoes e exclusoes)
- Parte B: Controle de valores que excedem o periodo (prejuizos fiscais, depreciacoes diferidas, etc.)

### 3.5 Apuracao IRPJ/CSLL — Trimestral vs Anual

#### Opcao 1: TRIMESTRAL
- Trimestres: 31/3, 30/6, 30/9, 31/12
- Recolhimento DEFINITIVO a cada trimestre
- Compensacao de prejuizos fiscais entre trimestres: LIMITADA A 30%
- Permite compensar IRPJ/CSLL com creditos tributarios federais via PER/DCOMP
- Melhor para: empresas consistentemente lucrativas com creditos a compensar

#### Opcao 2: ANUAL (Estimativa Mensal)
- Recolhimento mensal por ESTIMATIVA (base = receita bruta x percentuais ou balanco reducao/suspensao)
- Ajuste final anual em 31/12
- Compensacao de prejuizos no MESMO ano: INTEGRAL (sem trava de 30%)
- Permite suspender/reduzir pagamento mensal via balancete
- NAO permite compensar estimativas mensais com creditos federais
- Melhor para: empresas com sazonalidade ou prejuizos em alguns meses

**Aliquotas** (igual ao Presumido):
- IRPJ: 15% + adicional 10% sobre excedente (R$ 20.000/mes ou R$ 60.000/trimestre)
- CSLL: 9%

### 3.6 Creditos de ICMS

**Na industria (contribuintes de ICMS)**:
- Materias-primas, insumos, produtos intermediarios
- Energia eletrica (processo produtivo): credito integral
- Ativo imobilizado (maquinas/equipamentos): credito proporcional em 48 meses (CIAP)
- Embalagens de produtos vendidos
- Servicos de transporte (ICMS sobre frete)

### 3.7 Creditos de IPI

- Materias-primas, produtos intermediarios, material de embalagem
- Credito na entrada para compensar debito na saida
- Saldo credor: compensacao ou ressarcimento

---

## 4. OBRIGACOES ESTADUAIS (Foco Mato Grosso)

### 4.1 GIA (Guia de Informacao e Apuracao)

**Status em MT**: DISPENSADA.
- Para contribuintes obrigados a EFD: dispensada desde 01/01/2011
- Para Simples Nacional: dispensada desde 01/01/2015 (Decreto 2676/2014)

### 4.2 SINTEGRA

**Status em MT**: DISPENSADO para quem entrega EFD.
- Portaria 166/2008-SEFAZ: contribuintes da EFD ficam dispensados dos arquivos SINTEGRA (Convenio ICMS 57/95)
- Simples Nacional tambem dispensado (LC 123/2006 veda obrigacoes nao autorizadas pelo CGSN)

### 4.3 EFD ICMS/IPI — Perfil em MT

- Mato Grosso segue definicoes da SEFAZ-MT
- Perfil A: mais detalhado (registros analiticos obrigatorios)
- Perfil B: menos detalhado (permitido para alguns contribuintes)
- Consultar SEFAZ-MT para enquadramento especifico

**Prazo em MT**: Ate o dia 20 do mes subsequente (regra estadual pode diferir do nacional dia 25).

**Portaria base**: Portaria 166/2008-SEFAZ regulamenta EFD em MT.

### 4.4 Substituicao Tributaria (ICMS-ST) em MT

**Como funciona**:
- Fabricante/importador (substituto) recolhe ICMS de TODA a cadeia ate o consumidor final
- Base de calculo: preco de pauta, MVA (Margem de Valor Agregado), ou preco sugerido
- Debitos de ICMS-ST devem ser lancados na EFD (NAO mais na GIA-ST, que foi dispensada)
- Manual de preenchimento do ICMS-ST na EFD disponivel no Portal do Conhecimento da SEFAZ-MT

**Transicao (Reforma Tributaria)**: ST caminha para extincao gradual ate 2032, exceto combustiveis.

**Mudancas 2026**: Revogacao de protocolos entre estados (ex: cosmeticos SP-MT, eletronicos).

### 4.5 DeSTDA em MT

- Obrigatoria para SN contribuintes de ICMS (exceto MEI)
- Base: art. 2-A do Anexo IX do RICMS/MT
- Prazo: dia 28 do mes subsequente
- Formato: SEDIF-SN

### 4.6 Centralizacao de Inscricao (Portaria 059/2025-SEFAZ)

- Estabelecimento centralizador concentra: emissao de NF-e, EFD, apuracao ICMS, informacoes economico-fiscais
- Uma unica inscricao estadual valida em MT

---

## 5. OBRIGACOES MUNICIPAIS

### 5.1 ISS — Declaracao Mensal

**O que e**: Imposto Sobre Servicos, competencia municipal. Aliquotas de 2% a 5% conforme municipio e atividade.

**Declaracao**: Varia por municipio. Geralmente mensal, via portal da prefeitura.

**Retencao**: Tomador pode ser obrigado a reter ISS na fonte (conforme legislacao municipal).

**Para SN**: ISS ja esta incluso no DAS (calculado pelo PGDAS-D), exceto quando ha retencao.

### 5.2 NFS-e — Obrigacao de Emissao

**Obrigatoriedade**: A partir de janeiro de 2026, NFS-e de PADRAO NACIONAL e obrigatoria para TODOS os municipios (LC 214/2025, art. 62, par. 1).

**Historico**: Antes havia mais de 5.500 sistemas municipais distintos. Agora padrao unico.

**Consequencia para municipios nao aderentes**: Perda de transferencias voluntarias do governo federal.

**Adesao (dados ago/2025)**: 1.463 municipios ja aderiram, 3.772 ainda pendentes.

**Layouts de emissao (2026)**:
- Layout 1: ISS (formato atual, compatibilidade)
- Layout 2: ISS + IBS + CBS (novo, preparacao para reforma)

**Em 2026**: CBS e IBS sao apenas INFORMATIVOS (sem recolhimento real). Mas documentos fiscais devem conter campos.

### 5.3 DES (Declaracao Eletronica de Servicos)

**O que e**: Obrigacao municipal para declarar servicos prestados e tomados. Varia por municipio.

**Tendencia**: Com a NFS-e Nacional, informacoes de deducoes passam a ser exigidas diretamente na NF-e, reduzindo necessidade da DES separada.

**Status**: Ainda exigida em alguns municipios (verificar legislacao local). Tendencia de extincao com padronizacao nacional.

---

## 6. QUADRO COMPARATIVO COMPLETO

### 6.1 Obrigacoes FEDERAIS

| Obrigacao | Simples Nacional | Lucro Presumido | Lucro Real | Obs |
|-----------|:---:|:---:|:---:|-----|
| **PGDAS-D** | OBRIGATORIO | N/A | N/A | Mensal, dia 20 |
| **DEFIS** | OBRIGATORIO | N/A | N/A | Anual, 31/mar |
| **DAS** | OBRIGATORIO | N/A | N/A | Guia unica, dia 20 |
| **DCTFWeb** | DISPENSADO* | OBRIGATORIO | OBRIGATORIO | Mensal, ultimo dia util |
| **EFD-Contribuicoes** | DISPENSADO | OBRIGATORIO (cumulativo) | OBRIGATORIO (nao-cumulativo) | Mensal, 10o dia util 2o mes |
| **ECD** | DISPENSADO** | CONDICIONAL*** | OBRIGATORIO | Anual, 31/mai |
| **ECF** | DISPENSADO | OBRIGATORIO | OBRIGATORIO | Anual, 31/jul |
| **LALUR/LACS** | N/A | N/A | OBRIGATORIO | Dentro da ECF |
| **EFD-Reinf** | CONDICIONAL**** | OBRIGATORIO | OBRIGATORIO | Mensal, dia 15 |
| **eSocial** | OBRIGATORIO***** | OBRIGATORIO | OBRIGATORIO | Mensal, prazos variados |
| **IRPJ/CSLL** | Incluso no DAS | Trimestral | Trimestral ou Anual | Aliquotas sobre base presumida/real |
| **PIS/COFINS** | Incluso no DAS | Cumulativo (3,65%) | Nao-cumulativo (9,25% - creditos) | — |
| **DARF avulsos** | So excecoes****** | IRPJ, CSLL, PIS, COFINS | IRPJ, CSLL, PIS, COFINS | Via DCTFWeb |

\* SN usa PGDAS-D em vez de DCTFWeb para tributos unificados. eSocial/DCTFWeb obrigatorio para contribuicoes previdenciarias.
\** ECD obrigatoria para SN que receber aporte investidor-anjo.
\*** ECD obrigatoria no LP quando distribui lucros acima do presumido.
\**** EFD-Reinf para SN com retencoes sobre servicos.
\***** eSocial simplificado para ME/EPP.
\****** Excecoes SN: INSS do Anexo IV, ISS retido, ICMS-ST/DIFAL.

### 6.2 Obrigacoes ESTADUAIS (ICMS)

| Obrigacao | Simples Nacional | Lucro Presumido | Lucro Real | Obs |
|-----------|:---:|:---:|:---:|-----|
| **EFD ICMS/IPI** | DISPENSADO* | OBRIGATORIO** | OBRIGATORIO | Mensal, dia 20 (MT) ou 25 (nacional) |
| **GIA** | DISPENSADO (MT) | DISPENSADO (MT) | DISPENSADO (MT) | Substituida pela EFD |
| **SINTEGRA** | DISPENSADO (MT) | DISPENSADO (MT) | DISPENSADO (MT) | Substituido pela EFD |
| **DeSTDA** | OBRIGATORIO*** | N/A | N/A | Mensal, dia 28 |
| **ICMS-ST** | Via DeSTDA/DAS | Via EFD | Via EFD | Conforme protocolos/convenios |
| **DIFAL** | Via DeSTDA | Via EFD/DARF | Via EFD/DARF | Operacoes interestaduais |

\* SN dispensado da EFD ICMS/IPI, usa DeSTDA.
\** Se contribuinte de ICMS e/ou IPI.
\*** Exceto MEI e quem ja entrega EFD.

### 6.3 Obrigacoes MUNICIPAIS (ISS)

| Obrigacao | Simples Nacional | Lucro Presumido | Lucro Real | Obs |
|-----------|:---:|:---:|:---:|-----|
| **NFS-e** | OBRIGATORIO | OBRIGATORIO | OBRIGATORIO | Padrao Nacional desde 01/2026 |
| **Declaracao ISS** | Via PGDAS-D | OBRIGATORIO (mensal) | OBRIGATORIO (mensal) | Varia por municipio |
| **DES** | CONDICIONAL* | CONDICIONAL* | CONDICIONAL* | Varia por municipio, tendencia extincao |
| **ISS retido** | Declarar no PGDAS-D | DCTFWeb | DCTFWeb | Tomador retém na fonte |

\* DES depende da legislacao do municipio especifico.

### 6.4 Livros Obrigatorios

| Livro | Simples Nacional | Lucro Presumido | Lucro Real | Obs |
|-------|:---:|:---:|:---:|-----|
| **Livro Caixa** | OBRIGATORIO* | N/A | N/A | Pode ser substituido pelo Diario |
| **Livro Diario** | OPCIONAL** | OBRIGATORIO | OBRIGATORIO | Via ECD no LP/LR |
| **Livro Razao** | OPCIONAL | OBRIGATORIO | OBRIGATORIO | Via ECD |
| **Registro de Entradas** | OBRIGATORIO*** | Via EFD | Via EFD | Contribuintes ICMS |
| **Registro de Saidas** | DISPENSADO | Via EFD | Via EFD | SN dispensado |
| **Registro de Inventario** | OBRIGATORIO*** | Via EFD | Via EFD | Estoque final anual |
| **Servicos Prestados** | OBRIGATORIO**** | N/A | N/A | Contribuintes ISS |
| **Servicos Tomados** | OBRIGATORIO**** | N/A | N/A | Contribuintes ISS |
| **LALUR/LACS** | N/A | N/A | OBRIGATORIO | Dentro da ECF |

\* Exigencia fiscal minima do SN.
\** Exigido pela legislacao comercial (CC art. 1.179), dispensado pela fiscal.
\*** Contribuintes de ICMS.
\**** Contribuintes de ISS.

---

## 7. CALENDARIO RESUMIDO DE PRAZOS (2026)

### Mensais
| Obrigacao | Prazo | Quem |
|-----------|-------|------|
| PGDAS-D | Dia 20 | SN |
| DAS (pagamento) | Dia 20 | SN |
| EFD-Reinf | Dia 15 | LP, LR |
| DCTFWeb | Ultimo dia util | LP, LR |
| EFD-Contribuicoes | 10o dia util 2o mes | LP, LR |
| EFD ICMS/IPI | Dia 20 (MT) / 25 (nacional) | LP, LR (contribuintes ICMS) |
| DeSTDA | Dia 28 | SN (contribuintes ICMS) |

### Trimestrais
| Obrigacao | Prazo | Quem |
|-----------|-------|------|
| IRPJ/CSLL (Lucro Presumido) | Ultimo dia util do mes seguinte ao trimestre | LP |
| IRPJ/CSLL (Lucro Real Trimestral) | Ultimo dia util do mes seguinte ao trimestre | LR (opcao trimestral) |

### Anuais
| Obrigacao | Prazo 2026 | Quem |
|-----------|-----------|------|
| DEFIS (ref. 2025) | 31/03/2026 | SN |
| ECD (ref. 2025) | 31/05/2026 | LP (condicional), LR |
| ECF (ref. 2025) | 31/07/2026 | LP, LR |

---

## 8. IMPACTO DA REFORMA TRIBUTARIA (2026-2033)

### 2026 (ANO DE TESTE):
- CBS (0,9%) e IBS (0,1%) devem ser DESTACADOS nas NF-e/NFS-e
- Sem recolhimento efetivo (apenas informativo)
- Empresas SN: destaque OPCIONAL em 2026
- EFD ICMS/IPI: NAO incluir CBS/IBS no VL_DOC (C100)
- PGDAS-D e DEFIS: novas multas por atraso

### 2027 (INICIO EFETIVO):
- PIS/COFINS deixam de existir → substituidos por CBS
- ISS e ICMS iniciam transicao para IBS
- EFD-Contribuicoes tende a ser extinta
- Regime cumulativo (Lucro Presumido) deixa de existir para PIS/COFINS

### 2033 (FIM DA TRANSICAO):
- ICMS e ISS completamente extintos
- IBS em vigor pleno
- Substituicao tributaria extinta (exceto combustiveis)

---

## 9. RELEVANCIA PARA O TECNIKOS

### Para modelagem do sistema:
1. **Regime tributario da empresa**: Deve ser configuravel (SN, LP, LR) — afeta TODAS as obrigacoes
2. **Modulo fiscal**: Toggle por empresa, cada cliente configura diferente
3. **NFS-e**: Ja implementado (Focus NFe). Padrao Nacional obrigatorio 2026
4. **NFe (entrada)**: Ja implementado (SEFAZ DFe)
5. **Potenciais modulos futuros**:
   - Gerador PGDAS-D / calculo DAS (SN)
   - Integracao EFD-Contribuicoes
   - Integracao DeSTDA (SEDIF-SN)
   - Dashboard de obrigacoes fiscais com prazos e alertas
   - Apuracao IRPJ/CSLL (LP e LR)
   - Controle de creditos PIS/COFINS (LR)
   - Preparacao CBS/IBS (2027)

### Para a SLS Obras (empresa propria):
- Regime: Simples Nacional
- Obrigacoes: PGDAS-D, DEFIS, DAS, DeSTDA, Livro Caixa, Registro Entradas, Inventario, NFS-e
- Construcao civil: Anexo IV (recolhe INSS separado, fora do DAS)
- ICMS-ST/DIFAL: via DeSTDA
- GIA e SINTEGRA: dispensados em MT
- EFD ICMS/IPI: dispensada (SN)
