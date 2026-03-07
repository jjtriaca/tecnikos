# Estudo Completo — EFD-Contribuicoes (SPED PIS/COFINS)

> Pesquisa realizada em 06/03/2026 para o sistema Tecnikos (ERP SaaS B2B)
> Atualizado com detalhes tecnicos de campos para implementacao em codigo
> Foco: atender empresas do Lucro Presumido e Lucro Real

---

## 1. OBRIGATORIEDADE

### Quem deve entregar

| Regime Tributario | Obrigatorio? | Observacoes |
|---|---|---|
| **Lucro Real** | SIM | Sempre obrigatorio |
| **Lucro Presumido** | SIM | Obrigatorio (desde 2013 para fatos a partir de jan/2013) |
| **Simples Nacional** | NAO | Dispensado (usar PGDAS-D) |
| **Imunes/Isentas** | CONDICIONAL | Obrigatorio se sujeitas a PIS folha de salarios |
| **MEI** | NAO | Dispensado |

### Situacao Especial: Sem Movimento

- Empresas SEM movimento devem transmitir escrituracao "sem dados"
- Obrigatorio enviar ao menos em DEZEMBRO de cada ano
- Usar Registro 0120 para indicar meses sem movimentacao

### Prazo de Entrega

**10o dia util do 2o mes subsequente ao periodo de apuracao.**

Exemplos:
- Janeiro/2026 -> entrega ate 10o dia util de Marco/2026
- Fevereiro/2026 -> entrega ate 10o dia util de Abril/2026

### Multas por Atraso ou Incorrecao

| Infração | Multa | Base Legal |
|---|---|---|
| Atraso na entrega | 0,02% por dia sobre receita bruta, limitada a 1% | Art. 12, III, Lei 8.218/91 |
| Nao atendimento requisitos | 0,5% da receita bruta | Art. 12, I, Lei 8.218/91 |
| Omissao/info incorreta | 5% por operacao, limitado a 1% receita bruta | Art. 12, II, Lei 8.218/91 |

**Reducoes:**
- 50% se corrigido antes de procedimento de oficio
- 25% se corrigido dentro do prazo de intimacao

**Multa alternativa (controversa):** R$ 500/mes (Lucro Presumido) ou R$ 1.500/mes (Lucro Real) conforme Art. 57 MP 2.158-35/2001.

A multa e calculada automaticamente pelo sistema no momento da transmissao em atraso (desde jan/2020).

---

## 2. FORMATO DO ARQUIVO

### Especificacoes Tecnicas

- **Encoding:** ASCII ISO 8859-1 (Latin-1)
- **Delimitador:** `|` (pipe, char 124 ASCII)
- **Terminador de linha:** CR+LF
- **Formato:** Texto plano, registros de tamanho variavel
- **Periodicidade:** Mensal (um arquivo por mes)
- **Geracao:** Centralizada pelo estabelecimento MATRIZ

### Regras de Campos

- Campos numericos: SEM separador de milhar, virgula como decimal
- Campos alfanumericos: max 255 chars (exceto se indicado)
- Campo vazio: delimitado por `||` (pipe pipe)
- Datas: formato ddmmaaaa (8 digitos numericos)
- Valores monetarios: 2 casas decimais (ex: 1500,00 -> `1500,00`)
- Aliquotas percentuais: 4 casas decimais (ex: 1,6500)
- Todo registro comeca e termina com `|`

### Exemplo de linha
```
|C100|0|1|FORN001|55|00||000001234|35260112345678000199550010000012341000012340|05012026||15000,00|0|||15000,00|0|0|0|0|0|0|0|0|247,50|1140,00|0|0|
```

---

## 3. ESTRUTURA DE BLOCOS

| Bloco | Descricao | Registros Principais |
|---|---|---|
| **0** | Abertura, identificacao e cadastros | 0000, 0001, 0100, 0110, 0120, 0140, 0150, 0190, 0200, 0400, 0450, 0500, 0990 |
| **A** | Documentos Fiscais - Servicos (ISS/NFS-e) | A001, A010, A100, A110, A120, A170, A990 |
| **C** | Documentos Fiscais I - Mercadorias (ICMS/IPI/NFe) | C001, C010, C100, C110, C120, C170, C180, C181, C185, C190, C191, C195, C380, C381, C385, C395, C396, C400, C405, C481, C485, C490, C491, C495, C500, C501, C505, C600, C601, C605, C990 |
| **D** | Documentos Fiscais II - Transporte/Comunicacao | D001, D010, D100, D101, D105, D200, D201, D205, D300, D309, D350, D359, D500, D501, D505, D600, D601, D605, D990 |
| **F** | Demais documentos e operacoes | F001, F010, F100, F111, F120, F129, F130, F139, F150, F200, F205, F210, F211, F500, F509, F510, F519, F525, F550, F559, F560, F569, F600, F700, F800, F990 |
| **M** | Apuracao PIS/COFINS | M001, M100, M105, M110, M115, M200, M205, M210, M211, M215, M220, M225, M230, M300, M350, M400, M410, M500, M505, M510, M515, M600, M605, M610, M611, M615, M620, M625, M630, M700, M800, M810, M990 |
| **1** | Complemento da escrituracao | 1001, 1010, 1011, 1020, 1050, 1100, 1101, 1102, 1200, 1210, 1220, 1300, 1500, 1501, 1502, 1600, 1610, 1620, 1700, 1800, 1809, 1900, 1990 |
| **9** | Controle e encerramento | 9001, 9900, 9990, 9999 |

### Hierarquia de Blocos (obrigatoria)
Ordem sequencial: 0 -> A -> C -> D -> F -> M -> 1 -> 9

Todos os blocos devem estar presentes. Se nao ha dados, usar registro de abertura com indicador `1` (sem dados) + registro de encerramento.

---

## 4. CAMPOS DOS REGISTROS PRINCIPAIS

### 4.1. BLOCO 0 — Abertura e Cadastros

#### Registro 0000 — Abertura do Arquivo Digital (OBRIGATORIO, 1 por arquivo)

| N | Campo | Descricao | Tipo | Tam | Dec | Obrig |
|---|---|---|---|---|---|---|
| 01 | REG | Fixo "0000" | C | 4 | - | S |
| 02 | COD_VER | Versao do leiaute (ex: "006") | N | 3 | - | S |
| 03 | TIPO_ESCRIT | 0=Original, 1=Retificadora | N | 1 | - | S |
| 04 | IND_SIT_ESP | Situacao especial: 0=Abertura, 1=Cisao, 2=Fusao, 3=Incorporacao, 4=Encerramento | N | 1 | - | OC |
| 05 | NUM_REC_ANTERIOR | Recibo da escrituracao anterior (retificacao) | C | 41 | - | OC |
| 06 | DT_INI | Data inicial (ddmmaaaa) | N | 8 | - | S |
| 07 | DT_FIN | Data final (ddmmaaaa) | N | 8 | - | S |
| 08 | NOME | Nome empresarial (sem acentos) | C | 100 | - | S |
| 09 | CNPJ | CNPJ (14 digitos, sem pontuacao) | N | 14 | - | S |
| 10 | UF | Sigla UF | C | 2 | - | S |
| 11 | COD_MUN | Codigo municipio IBGE (7 digitos) | N | 7 | - | S |
| 12 | SUFRAMA | Inscricao SUFRAMA | C | 9 | - | OC |
| 13 | IND_NAT_PJ | Natureza PJ: 00=Geral, 01=Cooperativa, 02=Entidade PIS folha | N | 2 | - | S |
| 14 | IND_ATIV | Atividade: 0=Industrial, 1=Servicos, 2=Comercio, 3=Especiais, 4=Imobiliaria, 9=Outros | N | 1 | - | S |

#### Registro 0001 — Abertura do Bloco 0 (OBRIGATORIO)

| N | Campo | Descricao | Tipo | Tam | Dec | Obrig |
|---|---|---|---|---|---|---|
| 01 | REG | Fixo "0001" | C | 4 | - | S |
| 02 | IND_MOV | 0=Contem dados, 1=Nao contem | C | 1 | - | S |

#### Registro 0100 — Dados do Contabilista (OBRIGATORIO)

| N | Campo | Descricao | Tipo | Tam | Dec | Obrig |
|---|---|---|---|---|---|---|
| 01 | REG | Fixo "0100" | C | 4 | - | S |
| 02 | NOME | Nome do contabilista | C | 100 | - | S |
| 03 | CPF | CPF (11 digitos) | N | 11 | - | S |
| 04 | CRC | Numero CRC | C | 15 | - | S |
| 05 | CNPJ | CNPJ escritorio contabil | N | 14 | - | OC |
| 06 | CEP | CEP (8 digitos) | N | 8 | - | OC |
| 07 | END | Logradouro | C | 60 | - | OC |
| 08 | NUM | Numero | C | 10 | - | OC |
| 09 | COMPL | Complemento | C | 60 | - | OC |
| 10 | BAIRRO | Bairro | C | 60 | - | OC |
| 11 | FONE | Telefone (DDD+numero) | C | 11 | - | OC |
| 12 | FAX | Fax | C | 11 | - | OC |
| 13 | EMAIL | E-mail | C | 250 | - | OC |
| 14 | COD_MUN | Codigo municipio IBGE | N | 7 | - | OC |

#### Registro 0110 — Regime de Apuracao (OBRIGATORIO)

| N | Campo | Descricao | Tipo | Tam | Dec | Obrig |
|---|---|---|---|---|---|---|
| 01 | REG | Fixo "0110" | C | 4 | - | S |
| 02 | COD_INC_TRIB | 1=Nao-cumulativo, 2=Cumulativo, 3=Ambos | N | 1 | - | S |
| 03 | IND_APRO_CRED | 1=Apropriacao Direta, 2=Rateio Proporcional | N | 1 | - | OC |
| 04 | COD_TIPO_CONT | 1=Aliquota Basica, 2=Aliquotas Especificas | N | 1 | - | OC |
| 05 | IND_REC_CUM | 1=Regime Caixa, 2=Competencia Consolidada, 9=Competencia Detalhada | N | 1 | - | OC |

**Mapeamento por regime:**
- Lucro Real: COD_INC_TRIB = 1 (nao-cumulativo) ou 3 (ambos)
- Lucro Presumido: COD_INC_TRIB = 2 (cumulativo)

#### Registro 0120 — Meses sem Movimento (CONDICIONAL)

| N | Campo | Descricao | Tipo | Tam | Dec | Obrig |
|---|---|---|---|---|---|---|
| 01 | REG | Fixo "0120" | C | 4 | - | S |
| 02 | MES_REFER | Mes de referencia sem dados (mmaaaa) | C | 6 | - | S |

#### Registro 0140 — Cadastro de Estabelecimento (OBRIGATORIO, 1 por estabelecimento)

| N | Campo | Descricao | Tipo | Tam | Dec | Obrig |
|---|---|---|---|---|---|---|
| 01 | REG | Fixo "0140" | C | 4 | - | S |
| 02 | COD_EST | Codigo do estabelecimento | C | 60 | - | S |
| 03 | NOME | Nome empresarial | C | 100 | - | S |
| 04 | CNPJ | CNPJ do estabelecimento | N | 14 | - | S |
| 05 | UF | Sigla UF | C | 2 | - | S |
| 06 | IE | Inscricao Estadual | C | 14 | - | OC |
| 07 | COD_MUN | Codigo municipio IBGE | N | 7 | - | S |
| 08 | IM | Inscricao Municipal | C | - | - | OC |
| 09 | SUFRAMA | Inscricao SUFRAMA | C | 9 | - | OC |

#### Registro 0150 — Cadastro de Participantes (CONDICIONAL)

| N | Campo | Descricao | Tipo | Tam | Dec | Obrig |
|---|---|---|---|---|---|---|
| 01 | REG | Fixo "0150" | C | 4 | - | S |
| 02 | COD_PART | Codigo do participante | C | 60 | - | S |
| 03 | NOME | Nome/Razao social | C | 100 | - | S |
| 04 | COD_PAIS | Codigo do pais (tabela BACEN) | N | 5 | - | S |
| 05 | CNPJ | CNPJ | N | 14 | - | OC |
| 06 | CPF | CPF | N | 11 | - | OC |
| 07 | IE | Inscricao Estadual | C | 14 | - | OC |
| 08 | COD_MUN | Codigo municipio IBGE | N | 7 | - | OC |
| 09 | SUFRAMA | SUFRAMA | C | 9 | - | OC |
| 10 | END | Logradouro | C | 60 | - | OC |
| 11 | NUM | Numero | C | 10 | - | OC |
| 12 | COMPL | Complemento | C | 60 | - | OC |
| 13 | BAIRRO | Bairro | C | 60 | - | OC |

#### Registro 0190 — Unidades de Medida (CONDICIONAL)

| N | Campo | Descricao | Tipo | Tam | Dec | Obrig |
|---|---|---|---|---|---|---|
| 01 | REG | Fixo "0190" | C | 4 | - | S |
| 02 | UNID | Codigo da unidade de medida | C | 6 | - | S |
| 03 | DESCR | Descricao | C | 255 | - | S |

#### Registro 0200 — Cadastro de Itens (CONDICIONAL)

| N | Campo | Descricao | Tipo | Tam | Dec | Obrig |
|---|---|---|---|---|---|---|
| 01 | REG | Fixo "0200" | C | 4 | - | S |
| 02 | COD_ITEM | Codigo do item | C | 60 | - | S |
| 03 | DESCR_ITEM | Descricao do item | C | 255 | - | S |
| 04 | COD_BARRA | Codigo de barras EAN | C | 14 | - | OC |
| 05 | COD_ANT_ITEM | Codigo anterior do item | C | 60 | - | OC |
| 06 | UNID_INV | Unidade de inventario | C | 6 | - | S |
| 07 | TIPO_ITEM | 00=Mercadoria, 01=MP, 02=Embalagem, 03=Prod.Processo, 04=Prod.Acabado, 05=Subproduto, 06=Prod.Intermediario, 07=Mat.Uso/Consumo, 08=Ativo Imobilizado, 09=Servicos, 10=Outros, 99=Outras | N | 2 | - | S |
| 08 | COD_NCM | NCM (8 digitos) | C | 8 | - | OC |
| 09 | EX_IPI | Codigo excecao na TIPI | C | 3 | - | OC |
| 10 | COD_GEN | Codigo genero item (tabela IBGE) | N | 2 | - | OC |
| 11 | COD_LST | Codigo servico LC 116/03 | N | 4 | - | OC |
| 12 | ALIQ_ICMS | Aliquota ICMS | N | 6 | 02 | OC |

#### Registro 0990 — Encerramento do Bloco 0

| N | Campo | Descricao | Tipo | Tam | Dec | Obrig |
|---|---|---|---|---|---|---|
| 01 | REG | Fixo "0990" | C | 4 | - | S |
| 02 | QTD_LIN_0 | Quantidade total de linhas do Bloco 0 | N | - | - | S |

---

### 4.2. BLOCO A — Documentos de Servicos (NFS-e)

#### Registro A001 — Abertura do Bloco A

| N | Campo | Descricao | Tipo | Tam | Dec | Obrig |
|---|---|---|---|---|---|---|
| 01 | REG | Fixo "A001" | C | 4 | - | S |
| 02 | IND_MOV | 0=Contem dados, 1=Nao contem | C | 1 | - | S |

#### Registro A010 — Identificacao do Estabelecimento

| N | Campo | Descricao | Tipo | Tam | Dec | Obrig |
|---|---|---|---|---|---|---|
| 01 | REG | Fixo "A010" | C | 4 | - | S |
| 02 | CNPJ | CNPJ do estabelecimento | N | 14 | - | S |

#### Registro A100 — Documento NFS-e (PAI)

| N | Campo | Descricao | Tipo | Tam | Dec | Obrig |
|---|---|---|---|---|---|---|
| 01 | REG | Fixo "A100" | C | 4 | - | S |
| 02 | IND_OPER | 0=Servico Contratado (entrada), 1=Servico Prestado (saida) | C | 1 | - | S |
| 03 | IND_EMIT | 0=Emissao Propria, 1=Terceiros | C | 1 | - | S |
| 04 | COD_PART | Codigo participante (Reg 0150) | C | 60 | - | OC |
| 05 | COD_SIT | 00=Regular, 02=Cancelado | N | 2 | - | S |
| 06 | SER | Serie | C | 20 | - | OC |
| 07 | SUB | Subserie | C | 20 | - | OC |
| 08 | NUM_DOC | Numero do documento | C | 60 | - | S |
| 09 | CHV_NFSE | Chave/Codigo verificacao NFS-e | C | 60 | - | OC |
| 10 | DT_DOC | Data emissao (ddmmaaaa) | N | 8 | - | S |
| 11 | DT_EXE_SERV | Data execucao/conclusao servico | N | 8 | - | OC |
| 12 | VL_DOC | Valor total do documento | N | - | 02 | S |
| 13 | IND_PGTO | 0=A vista, 1=A prazo, 9=Sem pagamento | C | 1 | - | S |
| 14 | VL_DESC | Valor desconto | N | - | 02 | OC |
| 15 | VL_BC_PIS | Base de calculo PIS | N | - | 02 | S |
| 16 | VL_PIS | Valor PIS | N | - | 02 | S |
| 17 | VL_BC_COFINS | Base de calculo COFINS | N | - | 02 | S |
| 18 | VL_COFINS | Valor COFINS | N | - | 02 | S |
| 19 | VL_PIS_RET | PIS retido na fonte | N | - | 02 | OC |
| 20 | VL_COFINS_RET | COFINS retido na fonte | N | - | 02 | OC |
| 21 | VL_ISS | Valor ISS | N | - | 02 | OC |

**Regras:**
- Obrigatorio ao menos 1 registro A170 filho para cada A100
- Soma VL_PIS dos A170 filhos = VL_PIS do A100
- Soma VL_COFINS dos A170 filhos = VL_COFINS do A100
- Para NFS-e cancelada (COD_SIT=02), so preencher campos de identificacao

#### Registro A170 — Itens do Documento de Servico (FILHO do A100)

| N | Campo | Descricao | Tipo | Tam | Dec | Obrig |
|---|---|---|---|---|---|---|
| 01 | REG | Fixo "A170" | C | 4 | - | S |
| 02 | NUM_ITEM | Numero sequencial do item | N | 3 | - | S |
| 03 | COD_ITEM | Codigo item (Reg 0200) | C | 60 | - | S |
| 04 | DESCR_COMPL | Descricao complementar | C | - | - | OC |
| 05 | VL_ITEM | Valor total do item | N | - | 02 | S |
| 06 | VL_DESC | Valor desconto | N | - | 02 | OC |
| 07 | NAT_BC_CRED | Codigo base calculo credito (Tabela 4.3.7) | C | 2 | - | OC |
| 08 | IND_ORIG_CRED | 0=Mercado Interno, 1=Importacao | C | 1 | - | OC |
| 09 | CST_PIS | Codigo Sit. Tributaria PIS | N | 2 | - | S |
| 10 | VL_BC_PIS | Base calculo PIS | N | - | 02 | OC |
| 11 | ALIQ_PIS | Aliquota PIS (%) | N | 8 | 04 | OC |
| 12 | VL_PIS | Valor PIS | N | - | 02 | OC |
| 13 | CST_COFINS | Codigo Sit. Tributaria COFINS | N | 2 | - | S |
| 14 | VL_BC_COFINS | Base calculo COFINS | N | - | 02 | OC |
| 15 | ALIQ_COFINS | Aliquota COFINS (%) | N | 8 | 04 | OC |
| 16 | VL_COFINS | Valor COFINS | N | - | 02 | OC |
| 17 | COD_CTA | Conta analitica contabil | C | 255 | - | OC |
| 18 | COD_CCUS | Centro de custos | C | 255 | - | OC |

#### Registro A990 — Encerramento do Bloco A

| N | Campo | Descricao | Tipo | Tam | Dec | Obrig |
|---|---|---|---|---|---|---|
| 01 | REG | Fixo "A990" | C | 4 | - | S |
| 02 | QTD_LIN_A | Quantidade linhas do Bloco A | N | - | - | S |

---

### 4.3. BLOCO C — Documentos de Mercadorias (NFe)

#### Registro C001 — Abertura do Bloco C

Mesmo layout do A001.

#### Registro C010 — Identificacao do Estabelecimento

| N | Campo | Descricao | Tipo | Tam | Dec | Obrig |
|---|---|---|---|---|---|---|
| 01 | REG | Fixo "C010" | C | 4 | - | S |
| 02 | CNPJ | CNPJ do estabelecimento | N | 14 | - | S |
| 03 | IND_ESCRI | Tipo escrituracao: 1=Consolidada, 2=Individualizada | C | 1 | - | OC |

#### Registro C100 — Documento NFe (PAI) - Escrituracao Individualizada

| N | Campo | Descricao | Tipo | Tam | Dec | Obrig |
|---|---|---|---|---|---|---|
| 01 | REG | Fixo "C100" | C | 4 | - | S |
| 02 | IND_OPER | 0=Entrada, 1=Saida | C | 1 | - | S |
| 03 | IND_EMIT | 0=Emissao Propria, 1=Terceiros | C | 1 | - | S |
| 04 | COD_PART | Codigo participante (Reg 0150) | C | 60 | - | S |
| 05 | COD_MOD | Modelo (01, 1B, 04, 55, 65) | C | 2 | - | S |
| 06 | COD_SIT | Situacao: 00=Regular, 01=Extemporaneo, 02=Cancelado, 03=Cancelado extemporaneo, 06=Compl, 07=Compl extemporaneo, 08=Denegado | N | 2 | - | S |
| 07 | SER | Serie | C | 3 | - | OC |
| 08 | NUM_DOC | Numero documento (9 digitos) | N | 9 | - | S |
| 09 | CHV_NFE | Chave NFe/NFCe (44 digitos) | N | 44 | - | OC |
| 10 | DT_DOC | Data emissao (ddmmaaaa) | N | 8 | - | S |
| 11 | DT_E_S | Data entrada/saida | N | 8 | - | OC |
| 12 | VL_DOC | Valor total documento | N | - | 02 | S |
| 13 | IND_PGTO | 0=A vista, 1=Prazo, 9=Sem | C | 1 | - | S |
| 14 | VL_DESC | Valor desconto | N | - | 02 | OC |
| 15 | VL_ABAT_NT | Abatimento nao tributado | N | - | 02 | OC |
| 16 | VL_MERC | Valor total mercadorias | N | - | 02 | OC |
| 17 | IND_FRT | Tipo frete (0-9) | C | 1 | - | S |
| 18 | VL_FRT | Valor frete | N | - | 02 | OC |
| 19 | VL_SEG | Valor seguro | N | - | 02 | OC |
| 20 | VL_OUT_DA | Outras despesas acessorias | N | - | 02 | OC |
| 21 | VL_BC_ICMS | Base calculo ICMS | N | - | 02 | OC |
| 22 | VL_ICMS | Valor ICMS | N | - | 02 | OC |
| 23 | VL_BC_ICMS_ST | Base ICMS ST | N | - | 02 | OC |
| 24 | VL_ICMS_ST | Valor ICMS ST | N | - | 02 | OC |
| 25 | VL_IPI | Valor IPI | N | - | 02 | OC |
| 26 | VL_PIS | Valor total PIS | N | - | 02 | OC |
| 27 | VL_COFINS | Valor total COFINS | N | - | 02 | OC |
| 28 | VL_PIS_ST | PIS retido ST | N | - | 02 | OC |
| 29 | VL_COFINS_ST | COFINS retido ST | N | - | 02 | OC |

#### Registro C170 — Itens do Documento NFe (FILHO do C100)

| N | Campo | Descricao | Tipo | Tam | Dec | Obrig |
|---|---|---|---|---|---|---|
| 01 | REG | Fixo "C170" | C | 4 | - | S |
| 02 | NUM_ITEM | Numero sequencial item | N | 3 | - | S |
| 03 | COD_ITEM | Codigo item (Reg 0200) | C | 60 | - | S |
| 04 | DESCR_COMPL | Descricao complementar | C | - | - | OC |
| 05 | QTD | Quantidade | N | - | 05 | OC |
| 06 | UNID | Unidade (Reg 0190) | C | 6 | - | OC |
| 07 | VL_ITEM | Valor total item | N | - | 02 | S |
| 08 | VL_DESC | Valor desconto | N | - | 02 | OC |
| 09 | IND_MOV | Movimentacao fisica: 0=SIM, 1=NAO | C | 1 | - | OC |
| 10 | CST_ICMS | CST ICMS | N | 3 | - | OC |
| 11 | CFOP | CFOP (4 digitos) | N | 4 | - | S |
| 12 | COD_NAT | Natureza operacao (Reg 0400) | C | 10 | - | OC |
| 13 | VL_BC_ICMS | Base calculo ICMS | N | - | 02 | OC |
| 14 | ALIQ_ICMS | Aliquota ICMS | N | 6 | 02 | OC |
| 15 | VL_ICMS | Valor ICMS | N | - | 02 | OC |
| 16 | VL_BC_ICMS_ST | Base ICMS ST | N | - | 02 | OC |
| 17 | ALIQ_ST | Aliquota ICMS ST | N | 6 | 02 | OC |
| 18 | VL_ICMS_ST | Valor ICMS ST | N | - | 02 | OC |
| 19 | IND_APUR | Periodo apuracao IPI | C | 1 | - | OC |
| 20 | CST_IPI | CST IPI | C | 2 | - | OC |
| 21 | COD_ENQ | Enquadramento legal IPI | C | 3 | - | OC |
| 22 | VL_BC_IPI | Base calculo IPI | N | - | 02 | OC |
| 23 | ALIQ_IPI | Aliquota IPI | N | 6 | 02 | OC |
| 24 | VL_IPI | Valor IPI | N | - | 02 | OC |
| 25 | CST_PIS | **CST PIS** | N | 2 | - | **S** |
| 26 | VL_BC_PIS | Base calculo PIS | N | - | 02 | OC |
| 27 | ALIQ_PIS | Aliquota PIS (%) | N | 8 | 04 | OC |
| 28 | QUANT_BC_PIS | Qtd base PIS (unidade produto) | N | - | 03 | OC |
| 29 | ALIQ_PIS_QUANT | Aliquota PIS (R$/unidade) | N | - | 04 | OC |
| 30 | VL_PIS | Valor PIS | N | - | 02 | OC |
| 31 | CST_COFINS | **CST COFINS** | N | 2 | - | **S** |
| 32 | VL_BC_COFINS | Base calculo COFINS | N | - | 02 | OC |
| 33 | ALIQ_COFINS | Aliquota COFINS (%) | N | 8 | 04 | OC |
| 34 | QUANT_BC_COFINS | Qtd base COFINS (unidade produto) | N | - | 03 | OC |
| 35 | ALIQ_COFINS_QUANT | Aliquota COFINS (R$/unidade) | N | - | 04 | OC |
| 36 | VL_COFINS | Valor COFINS | N | - | 02 | OC |
| 37 | COD_CTA | Conta analitica contabil | C | 255 | - | OC |

**Regras:**
- Soma VL_ITEM dos C170 = VL_DOC do C100 pai
- Se aliquota por valor (%) -> usar campos VL_BC + ALIQ (26-27 para PIS, 32-33 para COFINS)
- Se aliquota por unidade -> usar campos QUANT_BC + ALIQ_QUANT (28-29 para PIS, 34-35 para COFINS)

#### Registro C180/C181/C185 — Consolidacao de Vendas por NF-e (alternativa ao C100/C170 para saidas)

Dispensa escrituracao individualizada nos C100/C170 para vendas. Consolida por item vendido (Reg 0200).

#### Registro C990 — Encerramento do Bloco C

Mesmo layout do A990.

---

### 4.4. BLOCO D — Servicos Transporte/Comunicacao

Registros D001, D010, D100, D101, D105, D200, D500, etc.
Estrutura similar ao Bloco C. Usado para CTe (Conhecimento de Transporte), NF transporte.

**Para a maioria dos clientes de prestacao de servicos tecnicos, este bloco fica vazio (IND_MOV=1).**

---

### 4.5. BLOCO F — Demais Documentos e Operacoes

#### Registro F001 — Abertura do Bloco F

Mesmo layout do A001.

#### Registro F010 — Identificacao do Estabelecimento

Mesmo layout do A010.

#### Registro F100 — Demais Documentos/Operacoes (PRINCIPAL do Bloco F)

| N | Campo | Descricao | Tipo | Tam | Dec | Obrig |
|---|---|---|---|---|---|---|
| 01 | REG | Fixo "F100" | C | 4 | - | S |
| 02 | IND_OPER | 0=Entrada/aquisicao, 1=Saida/prestacao, 2=Ajuste (sem credito/debito) | C | 1 | - | S |
| 03 | COD_PART | Codigo participante (Reg 0150) | C | 60 | - | OC |
| 04 | COD_ITEM | Codigo item (Reg 0200) | C | 60 | - | OC |
| 05 | DT_OPER | Data da operacao (ddmmaaaa) | N | 8 | - | S |
| 06 | VL_OPER | Valor da operacao | N | - | 02 | S |
| 07 | CST_PIS | CST PIS | N | 2 | - | S |
| 08 | VL_BC_PIS | Base calculo PIS | N | - | 04 | OC |
| 09 | ALIQ_PIS | Aliquota PIS (%) | N | 8 | 04 | OC |
| 10 | VL_PIS | Valor PIS | N | - | 02 | OC |
| 11 | CST_COFINS | CST COFINS | N | 2 | - | S |
| 12 | VL_BC_COFINS | Base calculo COFINS | N | - | 04 | OC |
| 13 | ALIQ_COFINS | Aliquota COFINS (%) | N | 8 | 04 | OC |
| 14 | VL_COFINS | Valor COFINS | N | - | 02 | OC |
| 15 | NAT_BC_CRED | Natureza base calculo credito (Tabela 4.3.7) | C | 2 | - | OC |
| 16 | IND_ORIG_CRED | 0=Mercado Interno, 1=Importacao | C | 1 | - | OC |
| 17 | COD_CTA | Conta contabil | C | 255 | - | OC |
| 18 | COD_CCUS | Centro de custos | C | 255 | - | OC |
| 19 | DESC_DOC_OPER | Descricao documento/operacao | C | - | - | OC |

**Uso tipico do F100:**
- Receitas financeiras (juros, descontos obtidos)
- Alugueis recebidos/pagos
- Servicos contratados sem NFS-e (frete, informatica, manutencao)
- Consolidacao de NFS-e de alto volume

---

### 4.6. BLOCO M — Apuracao PIS/COFINS

#### Registro M001 — Abertura do Bloco M

Mesmo layout do A001.

#### Registro M100 — Credito de PIS/PASEP Relativo ao Periodo

| N | Campo | Descricao | Tipo | Tam | Dec | Obrig |
|---|---|---|---|---|---|---|
| 01 | REG | Fixo "M100" | C | 4 | - | S |
| 02 | COD_CRED | Tipo credito (Tabela 4.3.6, 3 digitos: ex "101") | C | 3 | - | S |
| 03 | IND_CRED_ORI | 0=Operacoes proprias, 1=Evento sucessao | N | 1 | - | S |
| 04 | VL_BC_PIS | Base calculo credito PIS | N | - | 02 | OC |
| 05 | ALIQ_PIS | Aliquota PIS (%) | N | 8 | 04 | OC |
| 06 | QUANT_BC_PIS | Qtd base PIS | N | - | 03 | OC |
| 07 | ALIQ_PIS_QUANT | Aliquota PIS (R$) | N | - | 04 | OC |
| 08 | VL_CRED | Valor credito apurado | N | - | 02 | S |
| 09 | VL_AJUS_ACRES | Ajuste acrescimo | N | - | 02 | S |
| 10 | VL_AJUS_REDUC | Ajuste reducao | N | - | 02 | S |
| 11 | VL_CRED_DIF | Credito diferido no periodo | N | - | 02 | S |
| 12 | VL_CRED_DISP | Credito disponivel = 08+09-10-11 | N | - | 02 | S |
| 13 | IND_DESC_CRED | 0=Utilizacao total, 1=Parcial | C | 1 | - | S |
| 14 | VL_CRED_DESC | Credito descontado no periodo | N | - | 02 | OC |
| 15 | SLD_CRED | Saldo credito futuro = 12-14 | N | - | 02 | S |

**OBS:** Somente para regime NAO-CUMULATIVO (Lucro Real). Um registro M100 por tipo de credito (Tabela 4.3.6).

Grupos de Credito:
- 1XX = Vinculado a receita tributada mercado interno (CST 50,60,53,63,54,64,56,66)
- 2XX = Vinculado a receita nao tributada (CST 51,61,53,63,55,65,56,66)
- 3XX = Vinculado a exportacao (CST 52,62,54,64,55,65,56,66)

Tipo XX:
- 01=Aliquota basica, 02=Diferenciadas, 03=Por unidade, 04=Estoque abertura, 05=Embalagem revenda, 06=Presumido agroindustria, 08=Importacao, 99=Outros

#### Registro M105 — Detalhamento da Base do Credito PIS

| N | Campo | Descricao | Tipo | Tam | Dec | Obrig |
|---|---|---|---|---|---|---|
| 01 | REG | Fixo "M105" | C | 4 | - | S |
| 02 | NAT_BC_CRED | Codigo base calculo credito (Tabela 4.3.7) | C | 2 | - | S |
| 03 | CST_PIS | CST PIS | N | 2 | - | S |
| 04 | VL_BC_PIS_TOT | Base calculo total | N | - | 02 | S |
| 05 | VL_BC_PIS_CUM | Base calculo cumulativa | N | - | 02 | OC |
| 06 | VL_BC_PIS_NC | Base calculo nao-cumulativa | N | - | 02 | OC |
| 07 | VL_BC_PIS | Base calculo usada para credito | N | - | 02 | OC |

#### Registro M200 — Consolidacao da Contribuicao PIS do Periodo (1 por arquivo)

| N | Campo | Descricao | Tipo | Tam | Dec | Obrig |
|---|---|---|---|---|---|---|
| 01 | REG | Fixo "M200" | C | 4 | - | S |
| 02 | VL_TOT_CONT_NC_PER | Total contribuicao nao-cumulativa periodo | N | - | 02 | S |
| 03 | VL_TOT_CRED_DESC | Total credito descontado periodo | N | - | 02 | S |
| 04 | VL_TOT_CRED_DESC_ANT | Credito de periodo anterior | N | - | 02 | S |
| 05 | VL_TOT_CONT_NC_DEV | Contribuicao nao-cumulativa devida | N | - | 02 | S |
| 06 | VL_RET_NC | Retencao fonte deduzida (nao-cumulativa) | N | - | 02 | S |
| 07 | VL_OUT_DED_NC | Outras deducoes (nao-cumulativa) | N | - | 02 | S |
| 08 | VL_CONT_NC_REC | **PIS nao-cumulativo A RECOLHER** | N | - | 02 | S |
| 09 | VL_TOT_CONT_CUM_PER | Total contribuicao cumulativa periodo | N | - | 02 | S |
| 10 | VL_RET_CUM | Retencao fonte deduzida (cumulativa) | N | - | 02 | S |
| 11 | VL_OUT_DED_CUM | Outras deducoes (cumulativa) | N | - | 02 | S |
| 12 | VL_CONT_CUM_REC | **PIS cumulativo A RECOLHER** | N | - | 02 | S |
| 13 | VL_TOT_CONT_REC | **TOTAL PIS A RECOLHER** (08+12) | N | - | 02 | S |

#### Registro M210 — Detalhamento da Contribuicao PIS (pos jan/2019)

| N | Campo | Descricao | Tipo | Tam | Dec | Obrig |
|---|---|---|---|---|---|---|
| 01 | REG | Fixo "M210" | C | 4 | - | S |
| 02 | COD_CONT | Codigo contribuicao social (Tabela 4.3.5) | C | 2 | - | S |
| 03 | VL_REC_BRT | Receita bruta | N | - | 02 | S |
| 04 | VL_BC_CONT | Base calculo (antes ajustes) | N | - | 02 | S |
| 05 | VL_AJUS_ACRES_BC_PIS | Ajuste acrescimo na BC | N | - | 02 | S |
| 06 | VL_AJUS_REDUC_BC_PIS | Ajuste reducao na BC | N | - | 02 | S |
| 07 | VL_BC_CONT_AJUS | BC apos ajustes = 04+05-06 | N | - | 02 | S |
| 08 | ALIQ_PIS | Aliquota PIS (%) | N | 8 | 04 | OC |
| 09 | QUANT_BC_PIS | Qtd base PIS | N | - | 03 | OC |
| 10 | ALIQ_PIS_QUANT | Aliquota PIS (R$) | N | - | 04 | OC |
| 11 | VL_CONT_APUR | Contribuicao apurada | N | - | 02 | S |
| 12 | VL_AJUS_ACRES | Ajuste acrescimo contribuicao | N | - | 02 | S |
| 13 | VL_AJUS_REDUC | Ajuste reducao contribuicao | N | - | 02 | S |
| 14 | VL_CONT_DIFER | Contribuicao a diferir | N | - | 02 | OC |
| 15 | VL_CONT_DIFER_ANT | Contribuicao diferida anterior | N | - | 02 | OC |
| 16 | VL_CONT_PER | **Total contribuicao periodo** = 11+12-13-14+15 | N | - | 02 | S |

**Tabela 4.3.5 — Codigos de Contribuicao Social (COD_CONT):**
- 01 = Contribuicao nao-cumulativa apurada a aliquota basica
- 02 = Contribuicao nao-cumulativa apurada a aliquotas diferenciadas
- 03 = Contribuicao nao-cumulativa apurada a aliquota por unidade de produto
- 31 = Contribuicao apurada por ST
- 32 = Contribuicao apurada por ST (aliquota diferenciada)
- 51 = Contribuicao cumulativa a aliquota basica
- 52 = Contribuicao cumulativa a aliquotas diferenciadas
- 53 = Contribuicao cumulativa a aliquota por unidade

#### Registro M500 — Credito de COFINS (mesma estrutura do M100)

Campos identicos ao M100, substituindo PIS por COFINS:
- VL_BC_PIS -> VL_BC_COFINS
- ALIQ_PIS -> ALIQ_COFINS
- etc.

#### Registro M505 — Detalhamento Base Credito COFINS (mesma estrutura M105)

#### Registro M600 — Consolidacao COFINS (mesma estrutura M200)

Campos identicos ao M200. O campo 13 = VL_TOT_CONT_REC = **TOTAL COFINS A RECOLHER**.

#### Registro M610 — Detalhamento Contribuicao COFINS (mesma estrutura M210)

Campos identicos ao M210, substituindo PIS por COFINS.

#### Registro M990 — Encerramento do Bloco M

---

### 4.7. BLOCO 1 — Complemento

- Registro 1001: Abertura
- Registro 1010: Indicadores (processo referenciado, SCP, etc.)
- Registro 1100: Controle de creditos fiscais PIS (saldo periodo anterior, utilizacao, saldo a transferir)
- Registro 1500: Controle de creditos fiscais COFINS
- Registro 1990: Encerramento

### 4.8. BLOCO 9 — Controle e Encerramento

- Registro 9001: Abertura
- Registro 9900: Totalizacao de registros (um para cada tipo de registro no arquivo)
- Registro 9990: Encerramento Bloco 9
- Registro 9999: Encerramento do Arquivo

#### Registro 9900

| N | Campo | Descricao | Tipo | Tam | Dec | Obrig |
|---|---|---|---|---|---|---|
| 01 | REG | Fixo "9900" | C | 4 | - | S |
| 02 | REG_BLC | Registro que esta sendo totalizado | C | 4 | - | S |
| 03 | QTD_REG_BLC | Quantidade de registros daquele tipo | N | - | - | S |

#### Registro 9999

| N | Campo | Descricao | Tipo | Tam | Dec | Obrig |
|---|---|---|---|---|---|---|
| 01 | REG | Fixo "9999" | C | 4 | - | S |
| 02 | QTD_LIN | Quantidade total de linhas do arquivo | N | - | - | S |

---

## 5. REGRAS POR REGIME TRIBUTARIO

### 5.1. Lucro Real — Nao-Cumulativo

| Contribuicao | Aliquota | Creditos |
|---|---|---|
| PIS/PASEP | **1,65%** | SIM — credito sobre insumos, servicos, frete, aluguel, etc. |
| COFINS | **7,60%** | SIM — mesma base do PIS |

**Caracteristicas:**
- COD_INC_TRIB = 1 (exclusivo) ou 3 (misto)
- Permite credito nas ENTRADAS (CST 50 a 66)
- Credito = Base x Aliquota (1,65% PIS / 7,6% COFINS)
- Apuracao: debito sobre receitas MENOS credito sobre insumos
- Bloco M completo: M100 (creditos) + M200 (consolidacao) + M210 (detalhamento)
- Tabela 4.3.6 para tipos de credito

### 5.2. Lucro Presumido — Cumulativo

| Contribuicao | Aliquota | Creditos |
|---|---|---|
| PIS/PASEP | **0,65%** | NAO — sem direito a credito |
| COFINS | **3,00%** | NAO — sem direito a credito |

**Caracteristicas:**
- COD_INC_TRIB = 2 (cumulativo)
- NAO gera registros M100/M500 (creditos)
- Somente M200/M600 (contribuicao devida) e M210/M610 (detalhamento)
- Receitas escrituradas nos blocos A, C, F com CST 01 (aliquota basica)
- IND_REC_CUM: 1=Regime Caixa, 2=Competencia Consolidada, 9=Competencia Detalhada

### 5.3. Regime Misto

Algumas receitas tributadas no nao-cumulativo e outras no cumulativo. COD_INC_TRIB = 3.

---

## 6. CST PIS/COFINS — TABELAS COMPLETAS

### 6.1. CSTs de SAIDA (Receitas) — 01 a 49

| CST | Descricao | Uso Principal |
|---|---|---|
| **01** | Operacao Tributavel - Aliquota Basica | **MAIS USADO** — receita normal (0,65/3% ou 1,65/7,6%) |
| 02 | Aliquota Diferenciada (Monofasica) | Fabricante/importador de combustiveis, farmacos, bebidas |
| 03 | Aliquota por Unidade de Medida | Contribuicao por quantidade (litro, kg) |
| 04 | Monofasica - Revenda Aliquota Zero | **MUITO USADO** — revenda de produtos monofasicos |
| 05 | Substituicao Tributaria | Fabricante/importador de produtos ST |
| **06** | Aliquota Zero | **USADO** — produtos com aliquota zero por lei |
| **07** | Isenta da Contribuicao | Operacoes isentas |
| **08** | Sem Incidencia | Operacoes fora do campo de incidencia |
| 09 | Suspensao | Exportacao, zona franca, etc. |
| **49** | Outras Operacoes de Saida | Remessas, transferencias, sem receita |
| 99 | Outras Operacoes | Residual |

### 6.2. CSTs de ENTRADA (Creditos) — 50 a 99

| CST | Descricao | Uso Principal |
|---|---|---|
| **50** | Credito - Vinculado Exclusivamente a Receita Tributada MI | **MAIS USADO** Lucro Real — insumos gerando credito |
| 51 | Credito - Vinculado a Receita Nao Tributada MI | Entradas vinculadas a receitas nao-tributadas |
| 52 | Credito - Vinculado a Exportacao | Entradas vinculadas a exportacao |
| 53 | Credito - Receitas Tributadas e Nao Tributadas MI | Misto |
| 54 | Credito - Tributadas MI e Exportacao | Misto |
| 55 | Credito - Nao Tributadas MI e Exportacao | Misto |
| 56 | Credito - Tributadas, Nao Tributadas e Exportacao | Misto total |
| 60-66 | Credito Presumido (varias vinculacoes) | Agroindustria, etc. |
| 67 | Credito Presumido - Outras | |
| **70** | Operacao sem Direito a Credito | **MAIS USADO** Lucro Presumido — entradas sem credito |
| 71 | Aquisicao com Isencao | |
| 72 | Aquisicao com Suspensao | |
| **73** | Aquisicao a Aliquota Zero | **USADO** — compra de produto aliquota zero |
| 74 | Aquisicao sem Incidencia | |
| 75 | Aquisicao por ST | Produto com ST de PIS/COFINS |
| 98 | Outras Operacoes de Entrada | Remessas, transferencias |
| 99 | Outras Operacoes | Simples Nacional, residual |

### 6.3. Regra Pratica

| Regime | CST Saida tipico | CST Entrada tipico |
|---|---|---|
| **Lucro Presumido** | 01 (tributado 0,65/3%) | 70 (sem credito) |
| **Lucro Real** | 01 (tributado 1,65/7,6%) | 50 (com credito) |
| **Simples Nacional** | 99 | 99 |

---

## 7. RELACAO COM NFS-e E NFe

### 7.1. NFS-e — Servicos

| Operacao | Bloco | Registro | CST tipico |
|---|---|---|---|
| **Servico PRESTADO** (receita) | A | A100 (IND_OPER=1) + A170 | 01 (saida tributada) |
| **Servico TOMADO** (despesa, Lucro Real) | A | A100 (IND_OPER=0) + A170 | 50 (entrada com credito) |
| **Servico TOMADO** (despesa, Lucro Presumido) | A | A100 (IND_OPER=0) + A170 | 70 (entrada sem credito) |
| **Servico com retencao PIS/COFINS** | A | A100 campos 19-20 | Retencao nos campos VL_PIS_RET e VL_COFINS_RET |
| **Servico consolidado (alto volume)** | F | F100 | Alternativa ao A100 |

### 7.2. NFe — Mercadorias

| Operacao | Bloco | Registro | CST tipico |
|---|---|---|---|
| **Venda mercadoria** (receita) | C | C100 (IND_OPER=1) + C170 | 01 (saida tributada) |
| **Venda consolidada** (NF-e) | C | C180 + C181 + C185 | Alternativa ao C100 para saidas |
| **Compra mercadoria** (Lucro Real) | C | C100 (IND_OPER=0) + C170 | 50 (entrada com credito) |
| **Compra mercadoria** (Lucro Presumido) | C | C100 (IND_OPER=0) + C170 | 70 (entrada sem credito) |
| **Devolucao de venda** (recebida) | C | C100 (IND_OPER=0) | Ajuste no credito |
| **Devolucao de compra** (emitida) | C | C100 (IND_OPER=1) | Estorno do credito |

### 7.3. Receitas Financeiras / Alugueis / Outros

| Operacao | Bloco | Registro |
|---|---|---|
| Receitas financeiras | F | F100 (IND_OPER=1) |
| Alugueis recebidos | F | F100 (IND_OPER=1) |
| Alugueis pagos (credito LR) | F | F100 (IND_OPER=0, CST 50) |
| Ativo imobilizado (credito LR) | F | F120/F130 |

### 7.4. Fluxo de Dados: Blocos A/C/F -> Bloco M

```
Bloco A (servicos) ──┐
Bloco C (mercadorias) ├──> Bloco M (apuracao)
Bloco D (transporte) ─┤
Bloco F (demais) ─────┘

M100/M500 = soma dos creditos (CST 50-66) dos blocos A/C/D/F
M200/M600 = consolidacao: contribuicao - creditos = valor a recolher
M210/M610 = detalhamento por COD_CONT e aliquota
```

---

## 8. EXEMPLO DE ARQUIVO MINIMO VALIDO

### Cenario: Empresa Lucro Presumido, 1 NFS-e prestada no mes, sem movimento de mercadorias

```
|0000|006|0||01012026|31012026|EMPRESA EXEMPLO LTDA|12345678000199|SP|3550308||00|1|
|0001|0|
|0100|JOAO CONTADOR|12345678901|SP-123456/O-5||||||||11999998888||joao@contabil.com|3550308|
|0110|2||1|9|
|0140|01|EMPRESA EXEMPLO LTDA|12345678000199|SP||3550308|||
|0150|CLI001|CLIENTE EXEMPLO SA|01058|11111111000191||||3550308|||||
|0200|SERV001|SERVICO DE MANUTENCAO TECNICA||||||09||1401||
|0190|UN|UNIDADE|
|0990|9|
|A001|0|
|A010|12345678000199|
|A100|1|0|CLI001|00|||001||05012026||10000,00|1||10000,00|65,00|10000,00|300,00||||
|A170|001|SERV001||10000,00||||||01|10000,00|0,6500|65,00|01|10000,00|3,0000|300,00|||
|A990|5|
|C001|1|
|C990|2|
|D001|1|
|D990|2|
|F001|1|
|F990|2|
|M001|0|
|M200|0,00|0,00|0,00|0,00|0,00|0,00|0,00|65,00|0,00|0,00|65,00|65,00|
|M210|51|10000,00|10000,00|0,00|0,00|10000,00|0,6500|||65,00|0,00|0,00|||65,00|
|M600|0,00|0,00|0,00|0,00|0,00|0,00|0,00|300,00|0,00|0,00|300,00|300,00|
|M610|51|10000,00|10000,00|0,00|0,00|10000,00|3,0000|||300,00|0,00|0,00|||300,00|
|M990|7|
|1001|1|
|1010|0|0|0|0|0|0|0|0|0|0|0|0|
|1990|3|
|9001|0|
|9900|0000|1|
|9900|0001|1|
|9900|0100|1|
|9900|0110|1|
|9900|0140|1|
|9900|0150|1|
|9900|0190|1|
|9900|0200|1|
|9900|0990|1|
|9900|A001|1|
|9900|A010|1|
|9900|A100|1|
|9900|A170|1|
|9900|A990|1|
|9900|C001|1|
|9900|C990|1|
|9900|D001|1|
|9900|D990|1|
|9900|F001|1|
|9900|F990|1|
|9900|M001|1|
|9900|M200|1|
|9900|M210|1|
|9900|M600|1|
|9900|M610|1|
|9900|M990|1|
|9900|1001|1|
|9900|1010|1|
|9900|1990|1|
|9900|9001|1|
|9900|9900|31|
|9900|9990|1|
|9900|9999|1|
|9990|33|
|9999|52|
```

**Explicacao do exemplo:**
- Empresa Lucro Presumido (COD_INC_TRIB=2) em SP
- 1 NFS-e de servico prestado de R$ 10.000,00
- PIS cumulativo: 10.000 x 0,65% = R$ 65,00
- COFINS cumulativa: 10.000 x 3,00% = R$ 300,00
- Sem creditos (regime cumulativo)
- M210 com COD_CONT=51 (cumulativa aliquota basica)
- Blocos C, D, F vazios (sem mercadorias, transporte ou outros)

---

## 9. DECISOES DE IMPLEMENTACAO PARA O TECNIKOS

### 9.1. Escopo Inicial Recomendado

1. **Lucro Presumido** (mais simples, maioria dos clientes)
   - Regime cumulativo (COD_INC_TRIB=2)
   - Sem calculo de creditos
   - Aliquotas fixas: PIS 0,65%, COFINS 3,00%

2. **Blocos obrigatorios minimos:**
   - Bloco 0: Abertura + cadastros
   - Bloco A: NFS-e (servicos prestados e tomados)
   - Bloco C: NFe (se houver mercadorias)
   - Bloco F: Receitas financeiras e outros
   - Bloco M: Apuracao
   - Bloco 1: Complemento
   - Bloco 9: Encerramento

3. **Dados ja disponiveis no Tecnikos:**
   - Partners -> Registro 0150 (participantes)
   - NFS-e emitidas/importadas -> Bloco A (A100/A170)
   - NFe importadas -> Bloco C (C100/C170)
   - Lancamentos financeiros -> Bloco F (F100)
   - Dados da empresa -> Registro 0000, 0140

### 9.2. Fase 2 — Lucro Real

- Adicionar calculo de creditos (M100/M500)
- Implementar CSTs de entrada com credito (50-56)
- Controle de saldo de creditos (Registro 1100/1500)
- Rateio proporcional de creditos comuns

### 9.3. Modelo de Dados Sugerido

```
EfdContribuicao {
  id, companyId, periodo (YYYY-MM), status (RASCUNHO/VALIDADO/TRANSMITIDO),
  codIncTrib, codTipoCont, indRecCum,
  vlPisRecolher, vlCofinsRecolher,
  arquivo (texto do .txt gerado), reciboTransmissao,
  createdAt, updatedAt
}

EfdContribuicaoItem {
  id, efdContribuicaoId, bloco (A/C/D/F), registro,
  tipoOperacao, codParticipante, numDoc, chaveNfe,
  vlDoc, cstPis, vlBcPis, aliqPis, vlPis,
  cstCofins, vlBcCofins, aliqCofins, vlCofins
}
```

---

## 10. FONTES E REFERENCIAS

- Guia Pratico EFD-Contribuicoes v1.35 (RFB): http://sped.rfb.gov.br
- Portal SPED - Tabelas: http://sped.rfb.gov.br/pasta/show/1616
- Tabela 4.3.3 CST-PIS: http://sped.rfb.gov.br/arquivo/show/1629
- Tabela 4.3.4 CST-COFINS: similar
- Tabela 4.3.5 Codigo Contribuicao Social
- Tabela 4.3.6 Tipos de Credito
- Tabela 4.3.7 Base Calculo Credito
- VRI Consulting: https://www.vriconsulting.com.br/guias/
- Lei 8.218/91 art. 12 (multas)
- Lei 10.865/04 (creditos importacao)
- IN RFB 1.009/2010 (CST PIS/COFINS)
