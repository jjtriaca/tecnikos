# Estudo Completo: SPED Fiscal (EFD-ICMS/IPI)

**Data do estudo:** 06/03/2026
**Objetivo:** Documentacao tecnica para implementacao em sistema ERP brasileiro (Tecnikos)
**Leiaute vigente:** 020 (a partir de 01/01/2026, Ato Cotepe 79/2025)
**Guia Pratico vigente:** Versao 3.2.1 (publicada 18/11/2025)

---

## 1. OBRIGATORIEDADE POR REGIME TRIBUTARIO

### 1.1. Regra Geral
A obrigatoriedade da EFD-ICMS/IPI e definida pelas **administracoes tributarias estaduais (SEFAZs)**, NAO pelo regime de apuracao do IR (Lucro Real/Presumido/SN). Cada UF define quais contribuintes devem entregar.

### 1.2. Simples Nacional (SN)
- **Regra geral: DISPENSADO** (Protocolo ICMS 03/2011)
- Desde 01/01/2014, a obrigatoriedade se aplica apenas a contribuintes NAO optantes pelo SN
- Excecao: estados podem exigir em casos especificos (ex: ST, substituido tributario)
- **SLS Obras LTDA: DISPENSADA** (optante SN, EPP)

### 1.3. Lucro Presumido
- **Depende da UF** — a maioria dos estados obriga contribuintes de ICMS no Lucro Presumido
- Verificar legislacao estadual especifica
- Em geral obrigados desde 2014 na maioria dos estados

### 1.4. Lucro Real
- **Obrigatorio na maioria dos estados**
- Contribuintes de ICMS e/ou IPI devem entregar
- Perfil A (mais detalhado) normalmente exigido para grandes contribuintes

### 1.5. Prazos de Entrega
- **Prazo geral:** Ate o dia **20 do mes seguinte** ao periodo de apuracao
- Sem prorrogacao para feriados/fins de semana (maioria dos estados)
- Periodo: mensal (1o ao ultimo dia do mes)

### 1.6. Multas por Atraso

#### Federal (Lei 8.218/1991, alterada pela Lei 13.670/2018):
- **0,02% ao dia** sobre receita bruta no periodo, **limitada a 1%** — atraso na entrega
- **0,5% da receita bruta** — arquivo fora das especificacoes
- **5% sobre valor da operacao** (limitado a 1% da receita bruta) — omissao/informacao incorreta
- Codigo de Receita: **3630**

#### Estadual (exemplos):
- **ES:** 1.000 VRTEs por arquivo atrasado; 250 VRTEs retificacao fora do prazo
- **PE:** R$ 938,01 (2026), com reducao de 50% = R$ 469,01
- **Cada UF tem legislacao propria** — consultar SEFAZ do estado

---

## 2. LAYOUT TECNICO DO ARQUIVO

### 2.1. Codificacao
- **Encoding:** ASCII ISO 8859-1 (Latin-1)
- NAO aceita: packed decimal, EBCDIC, binario, float point, UTF-8

### 2.2. Delimitador
- Caractere **pipe** `|` (barra vertical, ASCII 124)
- Inserido no **inicio do registro** e ao **final de cada campo**
- O pipe NAO pode fazer parte do conteudo de nenhum campo
- Exemplo: `|C100|0|1|FORN01|55|00||000001|...|`

### 2.3. Formato de Datas
- Padrao: **ddmmaaaa** (sem separadores)
- Exemplo: 01 de janeiro de 2026 = `01012026`
- Campos de mes/ano: **mmaaaa** (ex: `012026`)
- Formato hora: **hhmmss** (24h, sem separadores)

### 2.4. Formato de Valores Numericos
- **SEM separadores de milhar**
- **Virgula como separador decimal** (ASCII 44)
- **SEM sinais** (+, -, %)
- Exemplos: `1234,56` (correto) | `1.234,56` (ERRADO) | `1234.56` (ERRADO)
- Quantidade de casas decimais: conforme campo (geralmente 2 para valores, 5 para quantidades)
- Valores percentuais: sem simbolo % (ex: 18% = `18,00`)

### 2.5. Campos Alfanumericos (tipo C)
- Tamanho maximo: 255 caracteres (salvo indicacao contraria)
- Caracteres permitidos: ASCII imprimivel, exceto pipe `|`
- Campos tipo C com tamanho fixo indicados com `*` na tabela

### 2.6. Campos Numericos (tipo N)
- SEM limite de caracteres (salvo indicacao contraria)
- Apenas algarismos 0-9 e virgula decimal
- Casas decimais conforme especificacao do campo (Dec.)

### 2.7. Estrutura dos Registros
- Registros iniciam na posicao 1 (primeira coluna)
- Tamanho variavel
- Todos os campos previstos DEVEM existir (mesmo vazios: `||`)
- Organizacao hierarquica (pai-filho)
- Dentro de cada bloco: ordem sequencial ascendente

### 2.8. Obrigatoriedade de Campos
- **O** = Obrigatorio (sempre preenchido)
- **OC** = Obrigatorio Condicional (preenchido quando houver informacao)
- **N** = Nao pode ser preenchido

### 2.9. Perfis de Enquadramento
- **Perfil A:** mais detalhado (grandes contribuintes)
- **Perfil B:** sintetico (totalizacoes por periodo)
- **Perfil C:** mais simplificado possivel
- Definido pelo Fisco Estadual; arquivo rejeitado se perfil incorreto

---

## 3. ESTRUTURA DE BLOCOS

| Bloco | Descricao | Conteudo Principal |
|-------|-----------|-------------------|
| **0** | Abertura, Identificacao e Referencias | Cadastro da empresa, participantes, itens, unidades |
| **B** | Escrituracao e Apuracao do ISS | ISS (usado por prestadores de servico — desde 2019) |
| **C** | Documentos Fiscais I — Mercadorias | NFe, NF, NFC-e (entradas e saidas com ICMS/IPI) |
| **D** | Documentos Fiscais II — Servicos | CT-e, NFSC (transporte e comunicacao) |
| **E** | Apuracao do ICMS e IPI | Debitos, creditos, ajustes, saldos, guias recolhimento |
| **G** | CIAP — Controle de Credito de Ativo Permanente | Ativo imobilizado com credito ICMS |
| **H** | Inventario Fisico | Estoque em 31/12 ou outras datas |
| **K** | Controle da Producao e do Estoque | Producao, consumo, movimentacao insumos |
| **1** | Outras Informacoes | GIA-ST, exportacao, combustiveis, medicamentos |
| **9** | Controle e Encerramento | Totalizacao de registros e encerramento do arquivo |

**Regra:** Todos os blocos devem estar presentes, mesmo sem dados (abertura + encerramento).

---

## 4. BLOCO 0 — ABERTURA, IDENTIFICACAO E REFERENCIAS

### 4.1. Registro 0000 — Abertura do Arquivo Digital

Primeiro registro do arquivo. Obrigatorio. Uma ocorrencia.

| No | Campo | Descricao | Tipo | Tam | Dec | Obrig |
|----|-------|-----------|------|-----|-----|-------|
| 01 | REG | Texto fixo "0000" | C | 004 | - | O |
| 02 | COD_VER | Codigo versao leiaute (020 para 2026) | N | 003 | - | O |
| 03 | COD_FIN | Finalidade: 0=original; 1=substituto | N | 001 | - | O |
| 04 | DT_INI | Data inicial (ddmmaaaa) | N | 008 | - | O |
| 05 | DT_FIN | Data final (ddmmaaaa) | N | 008 | - | O |
| 06 | NOME | Nome empresarial | C | 100 | - | O |
| 07 | CNPJ | CNPJ (14 digitos) | N | 014 | - | OC |
| 08 | CPF | CPF (11 digitos) — mutuamente exclusivo com CNPJ | N | 011 | - | OC |
| 09 | UF | Sigla UF | C | 002 | - | O |
| 10 | IE | Inscricao Estadual | C | 014 | - | O |
| 11 | COD_MUN | Codigo municipio IBGE (7 digitos) | N | 007 | - | O |
| 12 | IM | Inscricao Municipal | C | - | - | OC |
| 13 | SUFRAMA | Inscricao SUFRAMA (DV verificado) | C | 009 | - | OC |
| 14 | IND_PERFIL | Perfil: A, B ou C | C | 001 | - | O |
| 15 | IND_ATIV | Atividade: 0=industrial; 1=outros | N | 001 | - | O |

**Validacoes:**
- COD_VER validado conforme DT_FIN (leiaute 020 para 2026)
- DT_INI = primeiro dia do mes (exceto inicio de atividades)
- DT_FIN = ultimo dia do mes
- DT_INI e DT_FIN devem ser do mesmo mes/ano
- CNPJ e CPF sao mutuamente exclusivos (um dos dois obrigatorio)
- COD_MUN deve existir na tabela IBGE

### 4.2. Registro 0001 — Abertura do Bloco 0

| No | Campo | Descricao | Tipo | Tam | Dec | Obrig |
|----|-------|-----------|------|-----|-----|-------|
| 01 | REG | Texto fixo "0001" | C | 004 | - | O |
| 02 | IND_MOV | Indicador: 0=com dados; 1=sem dados | C | 001 | - | O |

### 4.3. Registro 0005 — Dados Complementares da Entidade

Obrigatorio. Uma ocorrencia.

| No | Campo | Descricao | Tipo | Tam | Dec | Obrig |
|----|-------|-----------|------|-----|-----|-------|
| 01 | REG | Texto fixo "0005" | C | 004 | - | O |
| 02 | FANTASIA | Nome fantasia | C | 060 | - | O |
| 03 | CEP | CEP (8 digitos) | N | 008 | - | O |
| 04 | END | Logradouro e endereco | C | 060 | - | O |
| 05 | NUM | Numero do imovel | C | 010 | - | OC |
| 06 | COMPL | Complemento | C | 060 | - | OC |
| 07 | BAIRRO | Bairro | C | 060 | - | O |
| 08 | FONE | Telefone (DDD+numero) | C | 011 | - | OC |
| 09 | FAX | Fax | C | 011 | - | OC |
| 10 | EMAIL | E-mail | C | - | - | OC |

### 4.4. Registro 0100 — Dados do Contabilista

Obrigatorio para perfis A e B.

| No | Campo | Descricao | Tipo | Tam | Dec | Obrig |
|----|-------|-----------|------|-----|-----|-------|
| 01 | REG | Texto fixo "0100" | C | 004 | - | O |
| 02 | NOME | Nome do contabilista | C | 100 | - | O |
| 03 | CPF | CPF do contabilista | N | 011 | - | O |
| 04 | CRC | Numero CRC | C | 015 | - | O |
| 05 | CNPJ | CNPJ do escritorio | N | 014 | - | OC |
| 06 | CEP | CEP | N | 008 | - | OC |
| 07 | END | Endereco | C | 060 | - | OC |
| 08 | NUM | Numero | C | 010 | - | OC |
| 09 | COMPL | Complemento | C | 060 | - | OC |
| 10 | BAIRRO | Bairro | C | 060 | - | OC |
| 11 | FONE | Telefone | C | 011 | - | OC |
| 12 | FAX | Fax | C | 011 | - | OC |
| 13 | EMAIL | E-mail | C | - | - | OC |
| 14 | COD_MUN | Codigo municipio IBGE | N | 007 | - | O |

### 4.5. Registro 0150 — Tabela de Cadastro do Participante

Obrigatorio condicional. Ocorrencia variavel.

| No | Campo | Descricao | Tipo | Tam | Dec | Obrig |
|----|-------|-----------|------|-----|-----|-------|
| 01 | REG | Texto fixo "0150" | C | 004 | - | O |
| 02 | COD_PART | Codigo do participante | C | 060 | - | O |
| 03 | NOME | Nome pessoal ou empresarial | C | 100 | - | O |
| 04 | COD_PAIS | Codigo do pais (tabela 5.4) | N | 005 | - | O |
| 05 | CNPJ | CNPJ | N | 014 | - | OC |
| 06 | CPF | CPF | N | 011 | - | OC |
| 07 | IE | Inscricao Estadual | C | 014 | - | OC |
| 08 | COD_MUN | Codigo municipio IBGE | N | 007 | - | OC |
| 09 | SUFRAMA | Inscricao SUFRAMA | C | 009 | - | OC |
| 10 | END | Endereco | C | 060 | - | O |
| 11 | NUM | Numero | C | 010 | - | OC |
| 12 | COMPL | Complemento | C | 060 | - | OC |
| 13 | BAIRRO | Bairro | C | 060 | - | OC |

**Validacoes:**
- COD_PART deve existir em pelo menos um registro dos demais blocos
- Mesmo codigo nao pode representar participantes diferentes
- Mudanca de IE requer novo registro 0150

### 4.6. Registro 0190 — Unidades de Medida

| No | Campo | Descricao | Tipo | Tam | Dec | Obrig |
|----|-------|-----------|------|-----|-----|-------|
| 01 | REG | Texto fixo "0190" | C | 004 | - | O |
| 02 | UNID | Codigo da unidade de medida | C | 006 | - | O |
| 03 | DESCR | Descricao | C | - | - | O |

### 4.7. Registro 0200 — Tabela de Identificacao do Item

| No | Campo | Descricao | Tipo | Tam | Dec | Obrig |
|----|-------|-----------|------|-----|-----|-------|
| 01 | REG | Texto fixo "0200" | C | 004 | - | O |
| 02 | COD_ITEM | Codigo do item | C | 060 | - | O |
| 03 | DESCR_ITEM | Descricao do item | C | - | - | O |
| 04 | COD_BARRA | Codigo de barras (GTIN) | C | - | - | OC |
| 05 | COD_ANT_ITEM | Codigo anterior do item | C | 060 | - | OC |
| 06 | UNID_INV | Unidade de medida para inventario | C | 006 | - | O |
| 07 | TIPO_ITEM | Tipo do item (tabela 4.2.1) | N | 002 | - | O |
| 08 | COD_NCM | Codigo NCM (8 digitos) | C | 008 | - | OC |
| 09 | EX_IPI | Codigo EX da TIPI | C | 003 | - | OC |
| 10 | COD_GEN | Codigo genero (posicoes 1-2 NCM) | N | 002 | - | OC |
| 11 | COD_LST | Codigo servico (LC 116/2003) | C | 005 | - | OC |
| 12 | ALIQ_ICMS | Aliquota ICMS aplicavel | N | 006 | 02 | OC |
| 13 | CEST | Codigo CEST | C | 007 | - | OC |

**Tipo Item (campo 07):**
- 00 = Mercadoria para revenda
- 01 = Materia-prima
- 02 = Embalagem
- 03 = Produto em processo
- 04 = Produto acabado
- 05 = Subproduto
- 06 = Produto intermediario
- 07 = Material de uso e consumo
- 08 = Ativo imobilizado
- 09 = Servicos
- 10 = Outros insumos
- 99 = Outras

**Validacoes:**
- NCM obrigatorio para industrial/equiparado (exceto tipos 07,08,09,10,99)
- Codigo item nao pode ser duplicado
- So apresentar itens referenciados em outros blocos

### 4.8. Registro 0990 — Encerramento do Bloco 0

| No | Campo | Descricao | Tipo | Tam | Dec | Obrig |
|----|-------|-----------|------|-----|-----|-------|
| 01 | REG | Texto fixo "0990" | C | 004 | - | O |
| 02 | QTD_LIN_0 | Quantidade total de linhas do Bloco 0 | N | - | - | O |

---

## 5. BLOCO C — DOCUMENTOS FISCAIS (MERCADORIAS/ICMS/IPI)

### 5.1. Registro C001 — Abertura do Bloco C

| No | Campo | Descricao | Tipo | Tam | Dec | Obrig |
|----|-------|-----------|------|-----|-----|-------|
| 01 | REG | Texto fixo "C001" | C | 004 | - | O |
| 02 | IND_MOV | 0=com dados; 1=sem dados | C | 001 | - | O |

### 5.2. Registro C100 — Nota Fiscal / NF-e / NFC-e

Registra documentos modelos 01 (NF), 1B (NF Avulsa), 04 (NF Produtor), 55 (NF-e), 65 (NFC-e).
Nivel hierarquico 2. Ocorrencia: varios por arquivo.

| No | Campo | Descricao | Tipo | Tam | Dec | Entr | Saida |
|----|-------|-----------|------|-----|-----|------|-------|
| 01 | REG | Texto fixo "C100" | C | 004 | - | O | O |
| 02 | IND_OPER | 0=Entrada; 1=Saida | C | 001 | - | O | O |
| 03 | IND_EMIT | 0=Emissao propria; 1=Terceiros | C | 001 | - | O | O |
| 04 | COD_PART | Codigo participante (reg 0150) | C | 060 | - | O | O |
| 05 | COD_MOD | Modelo do documento (01/1B/04/55/65) | C | 002 | - | O | O |
| 06 | COD_SIT | Situacao do documento (tab 4.1.2) | N | 002 | - | O | O |
| 07 | SER | Serie | C | 003 | - | OC | OC |
| 08 | NUM_DOC | Numero do documento | N | 009 | - | O | O |
| 09 | CHV_NFE | Chave da NF-e (44 digitos) | N | 044 | - | OC | OC |
| 10 | DT_DOC | Data emissao (ddmmaaaa) | N | 008 | - | O | O |
| 11 | DT_E_S | Data entrada/saida (ddmmaaaa) | N | 008 | - | O | OC |
| 12 | VL_DOC | Valor total do documento | N | - | 02 | O | O |
| 13 | IND_PGTO | Tipo pagamento (0=vista;1=prazo;2=outros;9=sem) | C | 001 | - | O | O |
| 14 | VL_DESC | Valor desconto | N | - | 02 | OC | OC |
| 15 | VL_ABAT_NT | Abatimento nao tributado | N | - | 02 | OC | OC |
| 16 | VL_MERC | Valor mercadorias/servicos | N | - | 02 | O | OC |
| 17 | IND_FRT | Tipo frete (0=emitente;1=destinatario;2=terceiros;9=sem) | C | 001 | - | O | O |
| 18 | VL_FRT | Valor frete | N | - | 02 | OC | OC |
| 19 | VL_SEG | Valor seguro | N | - | 02 | OC | OC |
| 20 | VL_OUT_DA | Outras despesas acessorias | N | - | 02 | OC | OC |
| 21 | VL_BC_ICMS | Base de calculo ICMS | N | - | 02 | OC | OC |
| 22 | VL_ICMS | Valor ICMS | N | - | 02 | OC | OC |
| 23 | VL_BC_ICMS_ST | BC do ICMS-ST | N | - | 02 | OC | OC |
| 24 | VL_ICMS_ST | Valor ICMS-ST retido | N | - | 02 | OC | OC |
| 25 | VL_IPI | Valor IPI | N | - | 02 | OC | OC |
| 26 | VL_PIS | Valor PIS | N | - | 02 | OC | OC |
| 27 | VL_COFINS | Valor COFINS | N | - | 02 | OC | OC |
| 28 | VL_PIS_ST | Valor PIS retido por ST | N | - | 02 | OC | OC |
| 29 | VL_COFINS_ST | Valor COFINS retido por ST | N | - | 02 | OC | OC |

**COD_SIT (Situacao do documento):**
- 00 = Regular
- 01 = Extemporaneo
- 02 = Cancelado
- 03 = Cancelado extemporaneo
- 04 = NF-e denegada
- 05 = NF-e inutilizada
- 06 = Complementar
- 07 = Complementar extemporaneo
- 08 = Regime especial/norma especifica

**Regras importantes:**
- Docs cancelados (02,03,04): preencher apenas REG,IND_OPER,IND_EMIT,COD_MOD,COD_SIT,SER,NUM_DOC,CHV_NFE
- NF-e emissao propria (saida): apenas C100 + C190 (sem C170)
- NFC-e (mod 65): sem COD_PART, VL_BC_ICMS_ST, VL_ICMS_ST, VL_IPI, VL_PIS, VL_COFINS
- VL_DOC = soma VL_OPR do registro C190

### 5.3. Registro C170 — Itens do Documento

Detalha itens da nota. Nivel 3 (filho do C100).
**OBRIGATORIO para entradas de terceiros. NAO informar para saidas de emissao propria (exceto C176).**

| No | Campo | Descricao | Tipo | Tam | Dec | Entr | Saida |
|----|-------|-----------|------|-----|-----|------|-------|
| 01 | REG | Texto fixo "C170" | C | 004 | - | O | O |
| 02 | NUM_ITEM | Numero sequencial do item | N | 003 | - | O | O |
| 03 | COD_ITEM | Codigo item (reg 0200) | C | 060 | - | O | O |
| 04 | DESCR_COMPL | Descricao complementar | C | - | - | OC | OC |
| 05 | QTD | Quantidade | N | - | 05 | O | O |
| 06 | UNID | Unidade (reg 0190) | C | 006 | - | O | O |
| 07 | VL_ITEM | Valor total do item | N | - | 02 | O | O |
| 08 | VL_DESC | Desconto comercial | N | - | 02 | OC | OC |
| 09 | IND_MOV | Movimentacao fisica: 0=sim; 1=nao | C | 001 | - | O | O |
| 10 | CST_ICMS | CST ICMS (3 digitos: origem + tributacao) | N | 003 | - | O | O |
| 11 | CFOP | Codigo Fiscal de Operacao | N | 004 | - | O | O |
| 12 | COD_NAT | Codigo natureza operacao | C | 010 | - | OC | OC |
| 13 | VL_BC_ICMS | Base de calculo ICMS | N | - | 02 | OC | OC |
| 14 | ALIQ_ICMS | Aliquota ICMS | N | 006 | 02 | OC | OC |
| 15 | VL_ICMS | Valor ICMS | N | - | 02 | OC | OC |
| 16 | VL_BC_ICMS_ST | BC ICMS-ST | N | - | 02 | OC | OC |
| 17 | ALIQ_ST | Aliquota ICMS-ST | N | - | 02 | OC | OC |
| 18 | VL_ICMS_ST | Valor ICMS-ST | N | - | 02 | OC | OC |
| 19 | IND_APUR | Apuracao IPI: 0=mensal; 1=decendial | C | 001 | - | OC | OC |
| 20 | CST_IPI | CST IPI | C | 002 | - | OC | OC |
| 21 | COD_ENQ | Enquadramento legal IPI | C | 003 | - | OC | OC |
| 22 | VL_BC_IPI | BC IPI (inclui frete+desp.acessorias) | N | - | 02 | OC | OC |
| 23 | ALIQ_IPI | Aliquota IPI (da TIPI) | N | 006 | 02 | OC | OC |
| 24 | VL_IPI | Valor IPI | N | - | 02 | OC | OC |
| 25 | CST_PIS | CST PIS | N | 002 | - | OC | OC |
| 26 | VL_BC_PIS | BC PIS | N | - | 02 | OC | OC |
| 27 | ALIQ_PIS_PERC | Aliquota PIS (%) | N | 008 | 04 | OC | OC |
| 28 | QUANT_BC_PIS | Quantidade BC PIS | N | - | 03 | OC | OC |
| 29 | ALIQ_PIS_RS | Aliquota PIS (R$) | N | - | 04 | OC | OC |
| 30 | VL_PIS | Valor PIS | N | - | 02 | OC | OC |
| 31 | CST_COFINS | CST COFINS | N | 002 | - | OC | OC |
| 32 | VL_BC_COFINS | BC COFINS | N | - | 02 | OC | OC |
| 33 | ALIQ_COFINS_PERC | Aliquota COFINS (%) | N | 008 | 04 | OC | OC |
| 34 | QUANT_BC_COFINS | Quantidade BC COFINS | N | - | 03 | OC | OC |
| 35 | ALIQ_COFINS_RS | Aliquota COFINS (R$) | N | - | 04 | OC | OC |
| 36 | VL_COFINS | Valor COFINS | N | - | 02 | OC | OC |
| 37 | COD_CTA | Conta contabil analitica | C | - | - | OC | OC |
| 38 | VL_ABAT_NT | Abatimento nao tributado (por item) | N | - | 02 | OC | OC |

**Validacoes:**
- Soma VL_ITEM dos C170 = VL_MERC do C100
- NUM_ITEM sequencial unico dentro do mesmo C100
- Valores totalizam para C190 por CST_ICMS + CFOP + ALIQ_ICMS
- Campos PIS/COFINS (25-36): podem ser vazios se EFD-Contribuicoes ja entregue

### 5.4. Registro C190 — Registro Analitico do Documento

Totalizacao por CST + CFOP + aliquota ICMS. Nivel 3 (filho do C100).
**OBRIGATORIO para todos os modelos (01, 1B, 04, 55, 65).**

| No | Campo | Descricao | Tipo | Tam | Dec | Obrig |
|----|-------|-----------|------|-----|-----|-------|
| 01 | REG | Texto fixo "C190" | C | 004 | - | O |
| 02 | CST_ICMS | CST ICMS (3 digitos) | N | 003 | - | O |
| 03 | CFOP | CFOP | N | 004 | - | O |
| 04 | ALIQ_ICMS | Aliquota ICMS | N | 006 | 02 | OC |
| 05 | VL_OPR | Valor da operacao (merc+frete+seg+desp+ICMS_ST+IPI-desc-abat) | N | - | 02 | O |
| 06 | VL_BC_ICMS | Base calculo ICMS | N | - | 02 | O |
| 07 | VL_ICMS | Valor ICMS (inclui FCP) | N | - | 02 | O |
| 08 | VL_BC_ICMS_ST | BC ICMS-ST | N | - | 02 | O |
| 09 | VL_ICMS_ST | Valor ICMS-ST | N | - | 02 | O |
| 10 | VL_RED_BC | Valor nao tributado (reducao BC) | N | - | 02 | O |
| 11 | VL_IPI | Valor IPI | N | - | 02 | O |
| 12 | COD_OBS | Codigo observacao (reg 0460) | C | 006 | - | OC |

**Validacoes:**
- Nao repetir combinacao CST_ICMS + CFOP + ALIQ_ICMS
- CFOP: entrada comeca com 1/2/3; saida com 5/6/7
- NFC-e: CFOP so com 5.xxx
- Soma VL_OPR do C190 = VL_DOC do C100

### 5.5. Registro C990 — Encerramento do Bloco C

| No | Campo | Descricao | Tipo | Tam | Dec | Obrig |
|----|-------|-----------|------|-----|-----|-------|
| 01 | REG | Texto fixo "C990" | C | 004 | - | O |
| 02 | QTD_LIN_C | Quantidade total de linhas do Bloco C | N | - | - | O |

---

## 6. BLOCO E — APURACAO DO ICMS E IPI

### 6.1. Registro E001 — Abertura do Bloco E

| No | Campo | Descricao | Tipo | Tam | Dec | Obrig |
|----|-------|-----------|------|-----|-----|-------|
| 01 | REG | Texto fixo "E001" | C | 004 | - | O |
| 02 | IND_MOV | 0=com dados; 1=sem dados | C | 001 | - | O |

### 6.2. Registro E100 — Periodo da Apuracao do ICMS

| No | Campo | Descricao | Tipo | Tam | Dec | Obrig |
|----|-------|-----------|------|-----|-----|-------|
| 01 | REG | Texto fixo "E100" | C | 004 | - | O |
| 02 | DT_INI | Data inicial do periodo (ddmmaaaa) | N | 008 | - | O |
| 03 | DT_FIN | Data final do periodo (ddmmaaaa) | N | 008 | - | O |

### 6.3. Registro E110 — Apuracao do ICMS — Operacoes Proprias

| No | Campo | Descricao | Tipo | Tam | Dec | Obrig |
|----|-------|-----------|------|-----|-----|-------|
| 01 | REG | Texto fixo "E110" | C | 004 | - | O |
| 02 | VL_TOT_DEBITOS | Total debitos (saidas com debito) | N | - | 02 | O |
| 03 | VL_AJ_DEBITOS | Ajustes a debito (do documento fiscal) | N | - | 02 | O |
| 04 | VL_TOT_AJ_DEBITOS | Total ajustes a debito | N | - | 02 | O |
| 05 | VL_ESTORNOS_CRED | Total estornos de creditos | N | - | 02 | O |
| 06 | VL_TOT_CREDITOS | Total creditos (entradas com credito ICMS) | N | - | 02 | O |
| 07 | VL_AJ_CREDITOS | Ajustes a credito (do documento fiscal) | N | - | 02 | O |
| 08 | VL_TOT_AJ_CREDITOS | Total ajustes a credito | N | - | 02 | O |
| 09 | VL_ESTORNOS_DEB | Total estornos de debitos | N | - | 02 | O |
| 10 | VL_SLD_CREDOR_ANT | Saldo credor do periodo anterior | N | - | 02 | O |
| 11 | VL_SLD_APURADO | Saldo devedor apurado | N | - | 02 | O |
| 12 | VL_TOT_DED | Total deducoes | N | - | 02 | O |
| 13 | VL_ICMS_RECOLHER | ICMS a recolher (11 - 12) | N | - | 02 | O |
| 14 | VL_SLD_CREDOR_TRANSPORTAR | Saldo credor a transportar | N | - | 02 | O |
| 15 | DEB_ESP | Debitos especiais (extemporaneos + complementares) | N | - | 02 | O |

**Calculo:**
- VL_SLD_APURADO = (02+03+04+05) - (06+07+08+09+10)
- Se >= 0: VL_SLD_APURADO = resultado; VL_SLD_CREDOR_TRANSPORTAR = 0
- Se < 0: VL_SLD_APURADO = 0; VL_SLD_CREDOR_TRANSPORTAR = |resultado|
- VL_ICMS_RECOLHER = VL_SLD_APURADO - VL_TOT_DED
- DEB_ESP + VL_ICMS_RECOLHER = soma VL_OR dos E116

### 6.4. Registro E111 — Ajuste/Beneficio/Incentivo da Apuracao do ICMS

| No | Campo | Descricao | Tipo | Tam | Dec | Obrig |
|----|-------|-----------|------|-----|-----|-------|
| 01 | REG | Texto fixo "E111" | C | 004 | - | O |
| 02 | COD_AJ_APUR | Codigo do ajuste (tabela 5.1.1) | C | 008 | - | O |
| 03 | DESCR_COMPL_AJ | Descricao complementar | C | - | - | OC |
| 04 | VL_AJ_APUR | Valor do ajuste | N | - | 02 | O |

**Codigo COD_AJ_APUR (8 digitos):**
- Posicao 1-2: UF
- Posicao 3: Tipo apuracao (0=ICMS proprio)
- Posicao 4: Tipo ajuste (0=debito especial; 1=ajuste debito; 2=estorno credito; 3=credito especial; 4=ajuste credito; 5=estorno debito)
- Posicao 5-8: Sequencial

### 6.5. Registro E116 — Obrigacoes do ICMS a Recolher

| No | Campo | Descricao | Tipo | Tam | Dec | Obrig |
|----|-------|-----------|------|-----|-----|-------|
| 01 | REG | Texto fixo "E116" | C | 004 | - | O |
| 02 | COD_OR | Codigo da obrigacao (tabela 5.4) | C | 003 | - | O |
| 03 | VL_OR | Valor da obrigacao | N | - | 02 | O |
| 04 | DT_VCTO | Data de vencimento (ddmmaaaa) | N | 008 | - | O |
| 05 | COD_REC | Codigo da receita (estadual) | C | - | - | O |
| 06 | NUM_PROC | Numero do processo (se houver) | C | 015 | - | OC |
| 07 | IND_PROC | Indicador do processo: 0=SEFAZ; 1=Justica Federal; 2=Justica Estadual; 9=Outros | C | 001 | - | OC |
| 08 | PROC | Descricao do processo | C | - | - | OC |
| 09 | TXT_COMPL | Texto complementar | C | - | - | OC |
| 10 | MES_REF | Mes de referencia (mmaaaa) | N | 006 | - | OC |

**Validacao:** Soma VL_OR dos E116 = VL_ICMS_RECOLHER + DEB_ESP do E110

### 6.6. Registro E990 — Encerramento do Bloco E

| No | Campo | Descricao | Tipo | Tam | Dec | Obrig |
|----|-------|-----------|------|-----|-----|-------|
| 01 | REG | Texto fixo "E990" | C | 004 | - | O |
| 02 | QTD_LIN_E | Total de linhas do Bloco E | N | - | - | O |

---

## 7. BLOCO H — INVENTARIO FISICO

### 7.1. Registro H001 — Abertura do Bloco H

| No | Campo | Descricao | Tipo | Tam | Dec | Obrig |
|----|-------|-----------|------|-----|-----|-------|
| 01 | REG | Texto fixo "H001" | C | 004 | - | O |
| 02 | IND_MOV | 0=com dados; 1=sem dados | C | 001 | - | O |

### 7.2. Registro H005 — Totais do Inventario

| No | Campo | Descricao | Tipo | Tam | Dec | Obrig |
|----|-------|-----------|------|-----|-----|-------|
| 01 | REG | Texto fixo "H005" | C | 004 | - | O |
| 02 | DT_INV | Data do inventario (ddmmaaaa) | N | 008 | - | O |
| 03 | VL_INV | Valor total do estoque | N | - | 02 | O |
| 04 | MOT_INV | Motivo do inventario | C | 002 | - | O |

**MOT_INV:**
- 01 = No final no periodo
- 02 = Na mudanca de forma de tributacao da mercadoria
- 03 = Na solicitacao da baixa cadastral
- 04 = Na alteracao de regime de pagamento
- 05 = Por determinacao dos fiscos
- 06 = Controle de mercadorias sujeitas a ST (obrigatorio desde 2020 para ST)

**Regras:**
- EFD de fevereiro DEVE conter H005 com DT_INV = 31/12 do ano anterior e MOT_INV = 01
- Se houver registros C180/C185/etc. (ST): obrigatorio H005 com MOT_INV = 06

### 7.3. Registro H010 — Inventario (Itens)

| No | Campo | Descricao | Tipo | Tam | Dec | Obrig |
|----|-------|-----------|------|-----|-----|-------|
| 01 | REG | Texto fixo "H010" | C | 004 | - | O |
| 02 | COD_ITEM | Codigo do item (reg 0200) | C | 060 | - | O |
| 03 | UNID | Unidade do item (reg 0190) | C | 006 | - | O |
| 04 | QTD | Quantidade do item em estoque | N | - | 03 | O |
| 05 | VL_UNIT | Valor unitario do item | N | - | 06 | O |
| 06 | VL_ITEM | Valor total do item (QTD * VL_UNIT) | N | - | 02 | O |
| 07 | IND_PROP | Indicador de propriedade/posse | C | 001 | - | O |
| 08 | COD_PART | Codigo do participante (se prop. terceiros ou posse terceiros) | C | 060 | - | OC |
| 09 | TXT_COMPL | Descricao complementar | C | - | - | OC |
| 10 | COD_CTA | Conta contabil | C | - | - | OC |
| 11 | VL_ITEM_IR | Valor do item para IR (se diferente) | N | - | 02 | OC |

**IND_PROP (campo 07):**
- 0 = Propriedade do informante, em seu poder
- 1 = Propriedade do informante, em poder de terceiros
- 2 = Propriedade de terceiros, em poder do informante

### 7.4. Registro H990 — Encerramento do Bloco H

| No | Campo | Descricao | Tipo | Tam | Dec | Obrig |
|----|-------|-----------|------|-----|-----|-------|
| 01 | REG | Texto fixo "H990" | C | 004 | - | O |
| 02 | QTD_LIN_H | Total de linhas do Bloco H | N | - | - | O |

---

## 8. BLOCO 9 — CONTROLE E ENCERRAMENTO

### 8.1. Registro 9001 — Abertura do Bloco 9

| No | Campo | Descricao | Tipo | Tam | Dec | Obrig |
|----|-------|-----------|------|-----|-----|-------|
| 01 | REG | Texto fixo "9001" | C | 004 | - | O |
| 02 | IND_MOV | 0=com dados (sempre 0) | C | 001 | - | O |

### 8.2. Registro 9900 — Registros do Arquivo

Um registro 9900 para CADA tipo de registro presente no arquivo.

| No | Campo | Descricao | Tipo | Tam | Dec | Obrig |
|----|-------|-----------|------|-----|-----|-------|
| 01 | REG | Texto fixo "9900" | C | 004 | - | O |
| 02 | REG_BLC | Registro que esta sendo totalizado | C | 004 | - | O |
| 03 | QTD_REG_BLC | Quantidade de registros daquele tipo | N | - | - | O |

**Exemplo:**
- `|9900|0000|1|` — 1 registro tipo 0000
- `|9900|C100|5|` — 5 registros tipo C100
- `|9900|9999|1|` — 1 registro tipo 9999

### 8.3. Registro 9990 — Encerramento do Bloco 9

| No | Campo | Descricao | Tipo | Tam | Dec | Obrig |
|----|-------|-----------|------|-----|-----|-------|
| 01 | REG | Texto fixo "9990" | C | 004 | - | O |
| 02 | QTD_LIN_9 | Total de linhas do Bloco 9 | N | - | - | O |

### 8.4. Registro 9999 — Encerramento do Arquivo Digital

Ultimo registro do arquivo.

| No | Campo | Descricao | Tipo | Tam | Dec | Obrig |
|----|-------|-----------|------|-----|-----|-------|
| 01 | REG | Texto fixo "9999" | C | 004 | - | O |
| 02 | QTD_LIN | Total de linhas do arquivo | N | - | - | O |

---

## 9. REGRAS DE ESCRITURACAO

### 9.1. CST ICMS — Codigo de Situacao Tributaria

Composto por 3 digitos: **[Origem][Tributacao]**

#### Tabela A — Origem da Mercadoria:
| Cod | Descricao |
|-----|-----------|
| 0 | Nacional, exceto codigos 3/4/5 |
| 1 | Estrangeira — importacao direta |
| 2 | Estrangeira — adquirida mercado interno |
| 3 | Nacional, conteudo importacao > 40% e <= 70% |
| 4 | Nacional, conforme processos produtivos basicos |
| 5 | Nacional, conteudo importacao <= 40% |
| 6 | Estrangeira — importacao direta, sem similar (CAMEX) |
| 7 | Estrangeira — mercado interno, sem similar (CAMEX) |
| 8 | Nacional, conteudo importacao > 70% |

#### Tabela B — Tributacao ICMS:
| Cod | Descricao |
|-----|-----------|
| 00 | Tributada integralmente |
| 10 | Tributada com cobranca ICMS-ST |
| 20 | Reducao da base de calculo |
| 30 | Isenta/nao tributada com cobranca ICMS-ST |
| 40 | Isenta |
| 41 | Nao tributada |
| 50 | Com suspensao |
| 51 | Com diferimento |
| 60 | ICMS cobrado anteriormente por ST |
| 70 | Reducao BC com cobranca ICMS-ST |
| 90 | Outras |

**Exemplos:** `000` = Nacional, tributada integralmente; `060` = Nacional, ICMS cobrado por ST anterior; `141` = Estrangeira import. direta, nao tributada.

### 9.2. CSOSN — Simples Nacional

Usado quando CRT=1 (Simples Nacional). Substitui Tabela B do CST na emissao de NFe.

| Cod | Descricao | CST Equivalente |
|-----|-----------|-----------------|
| 101 | Tributada SN com permissao credito | 00 |
| 102 | Tributada SN sem permissao credito | 00 |
| 103 | Isencao ICMS SN (faixa receita bruta) | 40 |
| 201 | Tributada SN com credito + ICMS-ST | 10 |
| 202 | Tributada SN sem credito + ICMS-ST | 10 |
| 203 | Isencao SN (faixa) + ICMS-ST | 30 |
| 300 | Imune | 40/41 |
| 400 | Nao tributada pelo SN | 41/50 |
| 500 | ICMS cobrado anteriormente por ST/antecipacao | 60 |
| 900 | Outros | 90 |

**IMPORTANTE:** Ajuste SINIEF 16/2020 previa unificacao CST/CSOSN, mas Ajuste SINIEF 34/2023 REVOGOU a mudanca. CSOSN continua valido para SN.

### 9.3. CFOPs Mais Usados

#### Entradas:
| CFOP | Descricao | Estado | Interestadual |
|------|-----------|--------|---------------|
| 1102/2102 | Compra para comercializacao | 1102 | 2102 |
| 1101/2101 | Compra para industrializacao | 1101 | 2101 |
| 1403/2403 | Compra comercializacao com ST | 1403 | 2403 |
| 1401/2401 | Compra industrializacao com ST | 1401 | 2401 |
| 1406/2406 | Compra ativo imobilizado com ST | 1406 | 2406 |
| 1407/2407 | Compra uso/consumo com ST | 1407 | 2407 |
| 1202/2202 | Devolucao de venda | 1202 | 2202 |
| 1556/2556 | Compra material uso/consumo | 1556 | 2556 |
| 1551/2551 | Compra ativo imobilizado | 1551 | 2551 |
| 3102 | Compra para comercializacao (importacao) | - | 3102 |

#### Saidas:
| CFOP | Descricao | Estado | Interestadual |
|------|-----------|--------|---------------|
| 5102/6102 | Venda de mercadoria | 5102 | 6102 |
| 5101/6101 | Venda producao propria | 5101 | 6101 |
| 5401/6401 | Venda producao propria com ST (substituto) | 5401 | 6401 |
| 5403/6403 | Venda terceiros com ST (substituto) | 5403 | 6403 |
| 5405 | Venda com ST (substituido, dentro UF) | 5405 | - |
| 6404 | Venda interestadual com ST (substituido p/ contrib.) | - | 6404 |
| 6108 | Venda interestadual a consumidor final (DIFAL) | - | 6108 |
| 5202/6202 | Devolucao de compra | 5202 | 6202 |
| 7102 | Venda exportacao | - | 7102 |

### 9.4. Credito de ICMS
- **Direito a credito:** compras para revenda (1102/2102) ou industrializacao (1101/2101) com CST 000 (tributada)
- **Sem direito:** uso/consumo, ativo imobilizado (credito via CIAP no Bloco G)
- **ICMS-ST:** substituido normalmente NAO tem direito a credito, exceto revenda interestadual
- **Simples Nacional:** CSOSN 101/201 permite credito ao destinatario (aliquota indicada na NFe)

### 9.5. Substituicao Tributaria (ST)
- **Substituto tributario:** responsavel pelo recolhimento do ICMS de toda a cadeia
- **Substituido tributario:** operacao posterior ao recolhimento (CST 060, CSOSN 500)
- **CFOPs ST:** grupo x.400 (1401-1407, 2401-2407, 5401-5407, 6401-6404)
- **Base calculo ST:** preco + MVA (Margem de Valor Agregado) ou preco tabelado
- **ICMS-ST = (BC_ST * aliquota interna) - ICMS proprio**

### 9.6. DIFAL — Diferencial de Aliquotas
- Aplica-se em operacoes **interestaduais para consumidor final**
- DIFAL = (aliquota interna destino - aliquota interestadual) * valor operacao
- Para **contribuintes do ICMS:** recolhe DIFAL nas aquisicoes uso/consumo e ativo imobilizado
- Para **nao contribuintes:** EC 87/2015 — remetente recolhe DIFAL (partilha)
- **Simples Nacional:** NAO obrigado a recolher DIFAL para nao-contribuinte (ADI STF)
- Escrituracao: registros E200/E210 (DIFAL/FCP) ou ajustes E111/E220

---

## 10. EXEMPLO DE ARQUIVO MINIMO VALIDO

Arquivo EFD-ICMS/IPI minimo com blocos 0, C, E e 9 (e demais blocos vazios):

```
|0000|020|0|01012026|31012026|EMPRESA EXEMPLO COMERCIO LTDA|12345678000199||MT|1234567890|5107040||A|1|
|0001|0|
|0005|EMPRESA EXEMPLO|78850000|RUA BRASIL|100||CENTRO|6539981234||contato@empresa.com.br|
|0100|JOSE SILVA CONTADOR|12345678901|CRC-MT 012345/O|98765432000199|78850000|AV MATO GROSSO|500||CENTRO|6539981235||jose@contabilidade.com.br|5107040|
|0150|FORN001|FORNECEDOR ABC LTDA|01058|11222333000144||1234567890|5107040|||RUA SAO PAULO|200||CENTRO|
|0190|UN|UNIDADE|
|0190|KG|QUILOGRAMA|
|0200|PROD001|PARAFUSO SEXTAVADO 3/8|7898000000001||UN|00|73181500|||73|||
|0200|PROD002|CABO ELETRICO 2,5MM|7898000000002||KG|00|85444900|||85|||
|0990|10|
|B001|1|
|B990|2|
|C001|0|
|C100|0|1|FORN001|55|00||000001234|12345678901234567890123456789012345678901234|05012026|05012026|1250,00|0|0,00||1250,00|9|||0,00|1250,00|150,00|0,00|0,00|0,00|0,00|0,00|0,00|0,00|
|C170|1|PROD001||100,00000|UN|750,00|0,00|0|010|2102||750,00|12,00|90,00|0,00||0,00|||||||||||||||||
|C170|2|PROD002||50,00000|KG|500,00|0,00|0|000|2101||500,00|12,00|60,00|0,00||0,00|||||||||||||||||
|C190|010|2102|12,00|750,00|750,00|90,00|0,00|0,00|0,00|0,00||
|C190|000|2101|12,00|500,00|500,00|60,00|0,00|0,00|0,00|0,00||
|C990|8|
|D001|1|
|D990|2|
|E001|0|
|E100|01012026|31012026|
|E110|0,00|0,00|0,00|0,00|150,00|0,00|0,00|0,00|0,00|0,00|0,00|0,00|150,00|0,00|
|E990|4|
|G001|1|
|G990|2|
|H001|1|
|H990|2|
|K001|1|
|K990|2|
|1001|1|
|1990|2|
|9001|0|
|9900|0000|1|
|9900|0001|1|
|9900|0005|1|
|9900|0100|1|
|9900|0150|1|
|9900|0190|2|
|9900|0200|2|
|9900|0990|1|
|9900|B001|1|
|9900|B990|1|
|9900|C001|1|
|9900|C100|1|
|9900|C170|2|
|9900|C190|2|
|9900|C990|1|
|9900|D001|1|
|9900|D990|1|
|9900|E001|1|
|9900|E100|1|
|9900|E110|1|
|9900|E990|1|
|9900|G001|1|
|9900|G990|1|
|9900|H001|1|
|9900|H990|1|
|9900|K001|1|
|9900|K990|1|
|9900|1001|1|
|9900|1990|1|
|9900|9001|1|
|9900|9900|29|
|9900|9990|1|
|9900|9999|1|
|9990|33|
|9999|55|
```

**Notas sobre o exemplo:**
- Leiaute 020 (vigente 2026)
- Empresa ficticia em MT (cod. 5107040)
- 1 nota fiscal de entrada (NF-e modelo 55) com 2 itens
- Credito de ICMS de R$ 150,00 (90 + 60) na apuracao
- Saldo credor a transportar de R$ 150,00
- Todos os blocos presentes (mesmo vazios com IND_MOV=1)
- Registro 9900 totaliza cada tipo de registro
- Registro 9999 com total de linhas do arquivo

---

## 11. TABELAS DE REFERENCIA

### 11.1. Versoes do Leiaute (COD_VER do registro 0000)
| Codigo | Vigencia |
|--------|----------|
| 002 | 01/01/2009 a 31/12/2009 |
| 003 | 01/01/2010 a 31/12/2010 |
| ... | ... |
| 016 | 01/01/2022 a 31/12/2022 |
| 017 | 01/01/2023 a 31/12/2023 |
| 018 | 01/01/2024 a 31/12/2024 |
| 019 | 01/01/2025 a 31/12/2025 |
| 020 | 01/01/2026 a 31/12/2026 |

### 11.2. Codigo Situacao Documento (COD_SIT)
| Cod | Descricao |
|-----|-----------|
| 00 | Documento regular |
| 01 | Escrituracao extemporanea de documento regular |
| 02 | Documento cancelado |
| 03 | Escrituracao extemporanea de documento cancelado |
| 04 | NF-e/CT-e/MDF-e denegado |
| 05 | NF-e/CT-e/MDF-e numeracao inutilizada |
| 06 | Documento fiscal complementar |
| 07 | Escrituracao extemporanea de documento complementar |
| 08 | Documento fiscal emitido conforme regime especial |

### 11.3. Tabelas Externas do SPED
- **Tabela 4.1.1:** Modelos de documentos fiscais
- **Tabela 4.1.2:** Situacao do documento fiscal
- **Tabela 4.2.1:** Tipo de item
- **Tabela 4.3.1:** CST ICMS
- **Tabela 4.3.2:** CSOSN
- **Tabela 5.1.1:** Codigos de ajuste da apuracao (por UF)
- **Tabela 5.2:** Informacoes adicionais
- **Tabela 5.3:** Valores declaratorios
- **Tabela 5.4:** Codigos de obrigacoes a recolher
- **CFOP:** Tabela oficial de Codigos Fiscais de Operacoes

---

## 12. CONSIDERACOES PARA IMPLEMENTACAO NO TECNIKOS

### 12.1. Escopo SLS Obras
- SLS Obras LTDA (SN/EPP): **DISPENSADA do SPED Fiscal**
- Obrigacao correta para SN: **DeSTDA** (mensal, dia 28, SEDIF-SN)
- Se clientes do Tecnikos forem Lucro Presumido/Real: precisam do SPED Fiscal

### 12.2. Para Implementacao Generica no ERP
1. **Cadastro base:** necessario ter tabelas de Participantes (0150), Itens/Produtos (0200), Unidades (0190)
2. **Documentos fiscais:** importacao NFe ja existe — mapear para C100/C170/C190
3. **Apuracao ICMS:** calcular debitos/creditos do periodo — gerar E100/E110
4. **Ajustes:** E111 para beneficios, incentivos, estornos
5. **Guias:** E116 para obrigacoes de recolhimento
6. **Inventario:** H005/H010 — estoque em 31/12 obrigatorio em fevereiro
7. **Gerador de arquivo:** montar TXT pipe-delimited com encoding Latin-1

### 12.3. Prioridades Sugeridas
1. Gerador de arquivo TXT (engine de serializacao pipe-delimited)
2. Bloco 0 (dados cadastrais — ja existem no sistema)
3. Bloco C (mapeamento das NFe importadas)
4. Bloco E (apuracao ICMS — calculo automatico baseado nos docs)
5. Bloco H (inventario — quando houver modulo de estoque)
6. Bloco 9 (totalizacao automatica)
7. Validacao contra PVA (programa validador da RFB)

---

## 13. FONTES

- Guia Pratico EFD-ICMS/IPI versao 3.2.1 — Portal SPED (sped.rfb.gov.br)
- Nota Tecnica EFD ICMS IPI 2024.001 / 2025.001
- Ato Cotepe/ICMS 79/2025 (leiaute 020)
- VRi Consulting (vriconsulting.com.br) — registros detalhados
- Lei 8.218/1991 alterada pela Lei 13.670/2018 (multas federais)
- TecnoSpeed Blog (blog.tecnospeed.com.br)
- e-Auditoria (e-auditoria.com.br)
- Focus NFe Blog (focusnfe.com.br)
