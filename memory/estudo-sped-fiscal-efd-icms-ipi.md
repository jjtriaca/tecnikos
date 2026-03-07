# Estudo Completo — SPED Fiscal (EFD-ICMS/IPI)

**Data**: 06/03/2026
**Objetivo**: Base tecnica para implementacao de geracao de arquivo SPED Fiscal em ERP brasileiro
**Regimes cobertos**: Simples Nacional, Lucro Presumido, Lucro Real
**Versao do Guia Pratico**: 3.2.1 (outubro/2025) — Leiaute 020 (vigente 01/2026)

---

## INDICE

1. [Obrigatoriedade por Regime](#1-obrigatoriedade-por-regime)
2. [Formato do Arquivo](#2-formato-do-arquivo)
3. [Blocos e Registros — Detalhamento Completo](#3-blocos-e-registros)
4. [Regras de Escrituracao](#4-regras-de-escrituracao)
5. [Validacoes do PVA](#5-validacoes-do-pva)
6. [Layout Tecnico](#6-layout-tecnico)
7. [Exemplo de Arquivo Minimo Valido](#7-exemplo-de-arquivo-minimo-valido)
8. [Recomendacoes para Implementacao](#8-recomendacoes-para-implementacao)

---

## 1. Obrigatoriedade por Regime

### 1.1 Quem e obrigado

A obrigatoriedade da EFD ICMS/IPI depende da **legislacao estadual** e da condicao de **contribuinte do ICMS**, NAO do regime de tributacao do IRPJ (Lucro Real/Presumido).

| Regime | Obrigado? | Observacao |
|--------|-----------|------------|
| **Simples Nacional** | **NAO** (em regra) | Dispensado pelo Protocolo ICMS 03/2011. Excecao: empresas impedidas de recolher ICMS pelo SN (art. 20 §1 LC 123/2006) |
| **Lucro Presumido** | **SIM** | Se for contribuinte do ICMS inscrito no estado |
| **Lucro Real** | **SIM** | Se for contribuinte do ICMS inscrito no estado |
| **MEI** | **NAO** | Dispensado |

**Regra geral**: Todos os contribuintes do ICMS NAO optantes pelo Simples Nacional estao obrigados desde 01/01/2014.

### 1.2 Perfis de Enquadramento

Os estados determinam o perfil de apresentacao:

| Perfil | Nivel de Detalhe | Descricao |
|--------|-----------------|-----------|
| **A** | Mais detalhado | Registros analiticos completos (C170 obrigatorio) |
| **B** | Sintetico | Totalizacoes por periodo (diario/mensal) |
| **C** | Mais sintetico | Versao simplificada |

### 1.3 Prazos de Entrega por Estado

| Estado | Prazo | Base Legal |
|--------|-------|------------|
| **MT** (Mato Grosso) | Dia **20** do mes subsequente | Art. 430 RICMS/MT |
| **SP** (Sao Paulo) | Dia **20** do mes subsequente | Portaria CAT 22/2016 |
| **MG** (Minas Gerais) | Dia **15** do mes subsequente | Decreto 47.829/2019 |
| **RJ** (Rio de Janeiro) | Dia **20** do mes subsequente | Independente de ser dia util |

**Observacao MG 2026**: DAPI sendo substituida por "DAPI Virtual" gerada automaticamente pela EFD. Comunicados SAIF dispensando DAPI progressivamente a partir de 01/2026.

### 1.4 Multas por Atraso ou Nao Entrega

#### Multa Federal (RFB)
- **0,02% por dia de atraso** sobre a receita bruta, limitada a **1%**
- **5% sobre o valor da operacao** por omissoes/incorrecoes, limitado a 1% da receita bruta
- Codigo de Receita: **3630**

#### Multas Estaduais (variam por estado)

| Estado | Multa | Observacao |
|--------|-------|------------|
| **SP** | Art. 527, V RICMS/SP | Variavel conforme situacao fiscal |
| **MG** | Definida pelo RICMS/MG | Atenuada por denuncia espontanea |
| **ES** | 250 VRTEs/arquivo | Reduzida para 25 VRTEs com pagamento espontaneo |
| **PE** | R$ 938,01 (2026) | Reducao legal de 50% = R$ 469,01 |

**Impacto adicional**: Atraso impede emissao de CND, travando licitacoes, financiamentos e distribuicao de lucros.

---

## 2. Formato do Arquivo

### 2.1 Especificacoes Tecnicas

| Aspecto | Especificacao |
|---------|---------------|
| **Encoding** | ASCII ISO 8859-1 (Latin-1) |
| **Delimitador** | `\|` (pipe / barra vertical) |
| **Fim de linha** | CR+LF (Windows) ou LF (Unix) |
| **Formato de data** | `ddmmaaaa` (ex: 01032026) |
| **Numeros decimais** | Ponto como separador decimal (ex: `1234.56`) |
| **Separador de milhar** | NAO usar |
| **Campos vazios** | `\|\|` (dois pipes consecutivos) |
| **Tamanho de linha** | Variavel |
| **Inicio de registro** | Sempre na posicao 1 da linha |
| **Campos alfanumericos** | Max 255 caracteres (exceto indicacao contraria) |
| **Compactacao** | NAO aceita (packed decimal, binario, float proibidos) |

### 2.2 Regras de Formatacao

- Cada campo DEVE ser delimitado por `|` no inicio e no final
- O caracter `|` NAO pode fazer parte do conteudo dos campos
- Campos numericos (tipo "N"): apenas algarismos 0-9
- Campos alfanumericos (tipo "C"): ASCII posicoes 32-126 (exceto `|`)
- PIS e COFINS: campos podem ser enviados VAZIOS na EFD-ICMS/IPI

### 2.3 Formato de Linha

```
|REG|CAMPO1|CAMPO2|CAMPO3|...|CAMPO_N|\r\n
```

Exemplo real:
```
|0000|020|0|01012026|31012026|EMPRESA LTDA|12345678000190||SP|123456789|1234567|12345678||A|0|
```

---

## 3. Blocos e Registros

### 3.0 Visao Geral dos Blocos

| Bloco | Descricao | Obrigatorio |
|-------|-----------|-------------|
| **0** | Abertura, Identificacao e Referencias | SIM |
| **B** | Escrituracao e Apuracao do ISS | SIM (exclusivo DF, a partir 2019) |
| **C** | Documentos Fiscais I — Mercadorias (ICMS/IPI) | SIM |
| **D** | Documentos Fiscais II — Transporte/Comunicacao | SIM |
| **E** | Apuracao do ICMS e do IPI | SIM |
| **G** | CIAP — Credito Ativo Permanente | SIM |
| **H** | Inventario Fisico | SIM |
| **K** | Controle da Producao e do Estoque | SIM |
| **1** | Outras Informacoes | SIM |
| **9** | Controle e Encerramento | SIM |

**TODOS os blocos sao obrigatorios**, mesmo sem dados (neste caso, apenas abertura + encerramento).

A ordem dos blocos no arquivo DEVE ser: 0 → B → C → D → E → G → H → K → 1 → 9.

---

### 3.1 BLOCO 0 — Abertura, Identificacao e Referencias

#### Hierarquia de Registros

```
0000 (Nivel 0, Ocorr. 1) — Abertura do Arquivo
  0001 (Nivel 1, Ocorr. 1) — Abertura do Bloco 0
    0002 (Nivel 2, Ocorr. 0:1) — Classificacao do Estabelecimento
    0005 (Nivel 2, Ocorr. 1) — Dados Complementares da Entidade
    0015 (Nivel 2, Ocorr. V) — Inscricoes Estaduais em Outras UFs
    0100 (Nivel 2, Ocorr. 1) — Dados do Contabilista
    0150 (Nivel 2, Ocorr. V) — Tabela de Cadastro do Participante
      0175 (Nivel 3, Ocorr. 1:N) — Alteracao de Cadastro de Participante
    0190 (Nivel 2, Ocorr. V) — Identificacao das Unidades de Medida
    0200 (Nivel 2, Ocorr. V) — Tabela de Identificacao do Item
      0205 (Nivel 3, Ocorr. 1:N) — Alteracao do Item
      0206 (Nivel 3, Ocorr. 0:1) — Codigo ANP do Combustivel
      0210 (Nivel 3, Ocorr. 1:N) — Consumo Especifico Padronizado
      0220 (Nivel 3, Ocorr. 1:N) — Fatores de Conversao de Unidades
      0221 (Nivel 3, Ocorr. 1:N) — Correlacao NCM x NBS
    0300 (Nivel 2, Ocorr. V) — Cadastro de Bens/Componentes Ativo Imobilizado
      0305 (Nivel 3, Ocorr. 1:1) — Informacao sobre Utilizacao do Bem
    0400 (Nivel 2, Ocorr. V) — Tabela de Natureza da Operacao/Prestacao
    0450 (Nivel 2, Ocorr. V) — Tabela de Informacao Complementar
    0460 (Nivel 2, Ocorr. V) — Tabela de Observacoes do Lancamento Fiscal
    0500 (Nivel 2, Ocorr. V) — Plano de Contas Contabeis
    0600 (Nivel 2, Ocorr. V) — Centro de Custos
  0990 (Nivel 1, Ocorr. 1) — Encerramento do Bloco 0
```

#### Registro 0000 — Abertura do Arquivo Digital (OBRIGATORIO)

| Nro | Campo | Tipo | Tam | Obrig | Descricao |
|-----|-------|------|-----|-------|-----------|
| 01 | REG | C | 4 | O | Texto fixo "0000" |
| 02 | COD_VER | N | 3 | O | Codigo da versao do leiaute (020 para 2026) |
| 03 | COD_FIN | N | 1 | O | 0=Original, 1=Substituto |
| 04 | DT_INI | N | 8 | O | Data inicial (ddmmaaaa) — 1o dia do mes |
| 05 | DT_FIN | N | 8 | O | Data final (ddmmaaaa) — ultimo dia do mes |
| 06 | NOME | C | 100 | O | Nome empresarial |
| 07 | CNPJ | N | 14 | OC | CNPJ (sem formatacao) |
| 08 | CPF | N | 11 | OC | CPF (sem formatacao) |
| 09 | UF | C | 2 | O | Sigla da UF |
| 10 | IE | C | 14 | O | Inscricao Estadual |
| 11 | COD_MUN | N | 7 | O | Codigo do municipio (IBGE) |
| 12 | IM | C | - | OC | Inscricao Municipal |
| 13 | SUFRAMA | C | 9 | OC | Inscricao SUFRAMA |
| 14 | IND_PERFIL | C | 1 | O | Perfil: A, B ou C |
| 15 | IND_ATIV | N | 1 | O | 0=Industrial, 1=Outros |

**Validacoes**:
- DT_INI deve ser 1o dia do mes (exceto inicio de atividades)
- DT_FIN deve ser ultimo dia do mesmo mes
- CNPJ e IE sao validados (digito verificador)

#### Registro 0001 — Abertura do Bloco 0 (OBRIGATORIO)

| Nro | Campo | Tipo | Tam | Obrig | Descricao |
|-----|-------|------|-----|-------|-----------|
| 01 | REG | C | 4 | O | Texto fixo "0001" |
| 02 | IND_MOV | N | 1 | O | 0=Com dados, 1=Sem dados |

#### Registro 0005 — Dados Complementares da Entidade (OBRIGATORIO)

| Nro | Campo | Tipo | Tam | Obrig | Descricao |
|-----|-------|------|-----|-------|-----------|
| 01 | REG | C | 4 | O | Texto fixo "0005" |
| 02 | FANTASIA | C | 60 | O | Nome fantasia |
| 03 | CEP | N | 8 | O | CEP |
| 04 | END | C | 60 | O | Endereco |
| 05 | NUM | C | 10 | OC | Numero |
| 06 | COMPL | C | 60 | OC | Complemento |
| 07 | BAIRRO | C | 60 | O | Bairro |
| 08 | FONE | C | 11 | OC | Telefone (DDD+numero) |
| 09 | FAX | C | 11 | OC | Fax |
| 10 | EMAIL | C | - | OC | Email |

#### Registro 0100 — Dados do Contabilista (OBRIGATORIO)

| Nro | Campo | Tipo | Tam | Obrig | Descricao |
|-----|-------|------|-----|-------|-----------|
| 01 | REG | C | 4 | O | Texto fixo "0100" |
| 02 | NOME | C | 100 | O | Nome do contabilista |
| 03 | CPF | N | 11 | O | CPF (validado DV) |
| 04 | CRC | C | 15 | O | No. CRC |
| 05 | CNPJ | N | 14 | OC | CNPJ do escritorio |
| 06 | CEP | N | 8 | OC | CEP |
| 07 | END | C | 60 | OC | Endereco |
| 08 | NUM | C | 10 | OC | Numero |
| 09 | COMPL | C | 60 | OC | Complemento |
| 10 | BAIRRO | C | 60 | OC | Bairro |
| 11 | FONE | C | 11 | OC | Telefone |
| 12 | FAX | C | 11 | OC | Fax |
| 13 | EMAIL | C | - | O | Email |
| 14 | COD_MUN | N | 7 | O | Codigo municipio (IBGE) |

#### Registro 0150 — Tabela de Cadastro do Participante (OBRIGATORIO quando referenciado)

| Nro | Campo | Tipo | Tam | Obrig | Descricao |
|-----|-------|------|-----|-------|-----------|
| 01 | REG | C | 4 | O | Texto fixo "0150" |
| 02 | COD_PART | C | 60 | O | Codigo do participante |
| 03 | NOME | C | 100 | O | Nome/Razao Social |
| 04 | COD_PAIS | N | 5 | O | Codigo do pais (1058=Brasil) |
| 05 | CNPJ | N | 14 | OC | CNPJ |
| 06 | CPF | N | 11 | OC | CPF |
| 07 | IE | C | 14 | OC | Inscricao Estadual |
| 08 | COD_MUN | N | 7 | OC | Codigo municipio (IBGE) |
| 09 | SUFRAMA | C | 9 | OC | SUFRAMA |
| 10 | END | C | 60 | O | Endereco |
| 11 | NUM | C | 10 | OC | Numero |
| 12 | COMPL | C | 60 | OC | Complemento |
| 13 | BAIRRO | C | 60 | OC | Bairro |

**Validacoes**:
- COD_PART deve ser referenciado em pelo menos 1 registro dos demais blocos
- Participante deve ter codigo UNICO (mesmo participante cliente+fornecedor = 1 registro)
- Campos 04 a 09 NAO preenchidos para participante exterior (COD_PAIS != 1058)

#### Registro 0190 — Identificacao das Unidades de Medida (OBRIGATORIO quando referenciado)

| Nro | Campo | Tipo | Tam | Obrig | Descricao |
|-----|-------|------|-----|-------|-----------|
| 01 | REG | C | 4 | O | Texto fixo "0190" |
| 02 | UNID | C | 6 | O | Codigo da unidade (ex: UN, KG, CX) |
| 03 | DESCR | C | - | O | Descricao da unidade |

**Validacoes**: UNID deve existir em pelo menos 1 registro dos demais blocos; nao duplicar UNID.

#### Registro 0200 — Tabela de Identificacao do Item (OBRIGATORIO quando referenciado)

| Nro | Campo | Tipo | Tam | Obrig | Descricao |
|-----|-------|------|-----|-------|-----------|
| 01 | REG | C | 4 | O | Texto fixo "0200" |
| 02 | COD_ITEM | C | 60 | O | Codigo do item |
| 03 | DESCR_ITEM | C | - | O | Descricao do item |
| 04 | COD_BARRA | C | - | OC | GTIN (EAN) |
| 05 | COD_ANT_ITEM | C | 60 | OC | Codigo anterior |
| 06 | UNID_INV | C | 6 | OC | Unidade de inventario |
| 07 | TIPO_ITEM | N | 2 | O | Tipo: 00=Mercadoria, 01=Mat. Prima, 02=Embalagem, 03=Prod. Processo, 04=Prod. Acabado, 05=Subproduto, 06=Prod. Intermediario, 07=Mat. Uso/Consumo, 08=Ativo Imobilizado, 09=Servicos, 10=Outros, 99=Outras |
| 08 | COD_NCM | C | 8 | OC | NCM (obrig. para industria e operacoes com exterior) |
| 09 | EX_IPI | C | 3 | OC | Codigo EX da TIPI |
| 10 | COD_GEN | N | 2 | OC | Codigo genero do item (2 primeiros digitos NCM) |
| 11 | COD_LST | C | 5 | OC | Codigo servico (LC 116/2003) |
| 12 | ALIQ_ICMS | N | 6 | OC | Aliquota ICMS aplicavel |

#### Registro 0220 — Fatores de Conversao de Unidades (CONDICIONAL)

| Nro | Campo | Tipo | Tam | Obrig | Descricao |
|-----|-------|------|-----|-------|-----------|
| 01 | REG | C | 4 | O | Texto fixo "0220" |
| 02 | UNID_CONV | C | 6 | O | Unidade comercial a ser convertida |
| 03 | FAT_CONV | N | - | O | Fator de conversao (ex: 0.10 = 1 UN = 0.10 CX) |
| 04 | COD_BARRA | C | - | OC | GTIN da unidade comercial |

**Quando informar**: Quando a unidade comercial na nota for diferente da UNID_INV do registro 0200.

#### Registro 0990 — Encerramento do Bloco 0 (OBRIGATORIO)

| Nro | Campo | Tipo | Tam | Obrig | Descricao |
|-----|-------|------|-----|-------|-----------|
| 01 | REG | C | 4 | O | Texto fixo "0990" |
| 02 | QTD_LIN_0 | N | - | O | Qtd total de linhas do Bloco 0 |

---

### 3.2 BLOCO B — Escrituracao e Apuracao do ISS

Exclusivo para contribuintes do **Distrito Federal** (a partir de 2019).

```
B001 (Nivel 1, Ocorr. 1) — Abertura do Bloco B
  B020 ... B990 — Registros de ISS
B990 (Nivel 1, Ocorr. 1) — Encerramento do Bloco B
```

Para demais UFs: apenas B001 (IND_MOV=1) + B990.

---

### 3.3 BLOCO C — Documentos Fiscais de Mercadorias (ICMS/IPI)

Bloco mais volumoso. Registra NFe (modelo 55), NFCe (65), NF modelo 1/1A, NF Produtor (04).

#### Hierarquia Principal (NFe — Modelo 55)

```
C001 (Nivel 1, Ocorr. 1) — Abertura do Bloco C
  C100 (Nivel 2, Ocorr. V) — Nota Fiscal / NFe / NFCe
    C101 (Nivel 3, Ocorr. 0:1) — Inf. complementar FCP/DIFAL (a partir leiaute 020)
    C105 (Nivel 3, Ocorr. 0:1) — Operacoes com ICMS-ST recolhido para UF diversa
    C110 (Nivel 3, Ocorr. 1:N) — Informacao complementar da NF
      C111 (Nivel 4, Ocorr. 1:N) — Processo referenciado
      C112 (Nivel 4, Ocorr. 1:N) — Documento arrecadacao referenciado
      C113 (Nivel 4, Ocorr. 1:N) — Documento fiscal referenciado
      C114 (Nivel 4, Ocorr. 1:N) — Cupom fiscal referenciado
      C115 (Nivel 4, Ocorr. 1:N) — Local coleta/entrega
      C116 (Nivel 4, Ocorr. 1:N) — Cupom fiscal eletronico referenciado
    C170 (Nivel 3, Ocorr. 1:N) — Itens do Documento
      C171 (Nivel 4, Ocorr. 0:1) — Armazenamento de combustiveis
      C172 (Nivel 4, Ocorr. 0:1) — Operacoes com ISSQN
      C173 (Nivel 4, Ocorr. 0:1) — Operacoes com medicamentos
      C174 (Nivel 4, Ocorr. 0:1) — Operacoes com armas de fogo
      C175 (Nivel 4, Ocorr. 0:1) — Operacoes com veiculos novos
      C176 (Nivel 4, Ocorr. 0:1) — Ressarcimento ICMS-ST
      C177 (Nivel 4, Ocorr. 0:1) — Operacoes com produtos sujeitos a selo
      C178 (Nivel 4, Ocorr. 0:1) — Inf. complementar ST
      C179 (Nivel 4, Ocorr. 0:1) — Inf. complementar ST (cod. prod.)
      C180 (Nivel 4, Ocorr. 0:1) — Inf. complementar FCP operacao propria
      C181 (Nivel 4, Ocorr. 0:1) — Inf. complementar FCP ST
    C190 (Nivel 3, Ocorr. 1:N) — Registro Analitico (OBRIGATORIO)
    C195 (Nivel 3, Ocorr. 1:N) — Observacoes lancamento fiscal
      C197 (Nivel 4, Ocorr. 1:N) — Outras obrigacoes tributarias/ajustes/inf. valores
    C199 (Nivel 3, Ocorr. 0:1) — Complemento documento FCP Difal (leiaute 020)
  ...outros modelos (C300, C400, C500, C600, C700, C800, C860)...
C990 (Nivel 1, Ocorr. 1) — Encerramento do Bloco C
```

#### Registro C100 — Nota Fiscal / NFe (OBRIGATORIO se houver documentos)

| Nro | Campo | Tipo | Tam | Obrig | Descricao |
|-----|-------|------|-----|-------|-----------|
| 01 | REG | C | 4 | O | "C100" |
| 02 | IND_OPER | C | 1 | O | 0=Entrada, 1=Saida |
| 03 | IND_EMIT | C | 1 | O | 0=Emissao propria, 1=Terceiros |
| 04 | COD_PART | C | 60 | O | Codigo participante (ref. 0150) |
| 05 | COD_MOD | C | 2 | O | Modelo: 01, 1B, 04, 55, 65 |
| 06 | COD_SIT | N | 2 | O | 00=Regular, 01=Extemp, 02=Cancelado, etc. |
| 07 | SER | C | 3 | OC | Serie |
| 08 | NUM_DOC | N | 9 | O | Numero do documento |
| 09 | CHV_NFE | N | 44 | OC | Chave de acesso NFe (obrig. se mod. 55/65) |
| 10 | DT_DOC | N | 8 | O | Data emissao (ddmmaaaa) |
| 11 | DT_E_S | N | 8 | OC | Data entrada/saida |
| 12 | VL_DOC | N | - | O | Valor total do documento |
| 13 | IND_PGTO | C | 1 | OC | 0=Vista, 1=Prazo, 2=Outros, 9=Sem pgto |
| 14 | VL_DESC | N | - | OC | Valor desconto |
| 15 | VL_ABAT_NT | N | - | OC | Valor abatimento nao tributado |
| 16 | VL_MERC | N | - | OC | Valor mercadorias |
| 17 | IND_FRT | C | 1 | O | 0=Emitente, 1=Destinatario, 2=Terceiros, 9=Sem |
| 18 | VL_FRT | N | - | OC | Valor frete |
| 19 | VL_SEG | N | - | OC | Valor seguro |
| 20 | VL_OUT_DA | N | - | OC | Outras despesas acessorias |
| 21 | VL_BC_ICMS | N | - | OC | Base de calculo ICMS |
| 22 | VL_ICMS | N | - | OC | Valor ICMS |
| 23 | VL_BC_ICMS_ST | N | - | OC | Base calculo ICMS-ST |
| 24 | VL_ICMS_ST | N | - | OC | Valor ICMS-ST |
| 25 | VL_IPI | N | - | OC | Valor IPI |
| 26 | VL_PIS | N | - | OC | Valor PIS |
| 27 | VL_COFINS | N | - | OC | Valor COFINS |
| 28 | VL_PIS_ST | N | - | OC | Valor PIS-ST |
| 29 | VL_COFINS_ST | N | - | OC | Valor COFINS-ST |

**Regras importantes**:
- NFe emissao propria (IND_EMIT=0): obrigatorios apenas C100 + C190 (+ C195/C197 se ajustes)
- NFe entrada de terceiros (IND_EMIT=1): C100 + C170 + C190
- Documento cancelado (COD_SIT=02): preencher apenas campos 01-09, demais vazios

#### Registro C170 — Itens do Documento (CONDICIONAL)

Obrigatorio para notas de ENTRADA de terceiros. NAO informar para NFe de emissao propria (exceto se houver C176/C177/C180/C181).

| Nro | Campo | Tipo | Tam | Obrig | Descricao |
|-----|-------|------|-----|-------|-----------|
| 01 | REG | C | 4 | O | "C170" |
| 02 | NUM_ITEM | N | 3 | O | Numero sequencial do item |
| 03 | COD_ITEM | C | 60 | O | Codigo do item (ref. 0200) |
| 04 | DESCR_COMPL | C | - | OC | Descricao complementar |
| 05 | QTD | N | - | O | Quantidade |
| 06 | UNID | C | 6 | O | Unidade (ref. 0190) |
| 07 | VL_ITEM | N | - | O | Valor total do item |
| 08 | VL_DESC | N | - | OC | Valor desconto |
| 09 | IND_MOV | C | 1 | O | 0=Sim (gera estoque), 1=Nao |
| 10 | CST_ICMS | N | 3 | O | CST (3 digitos: origem + tributacao) |
| 11 | CFOP | N | 4 | O | CFOP |
| 12 | COD_NAT | C | 10 | OC | Codigo natureza operacao (ref. 0400) |
| 13 | VL_BC_ICMS | N | - | OC | Base calculo ICMS |
| 14 | ALIQ_ICMS | N | - | OC | Aliquota ICMS |
| 15 | VL_ICMS | N | - | OC | Valor ICMS |
| 16 | VL_BC_ICMS_ST | N | - | OC | Base calculo ICMS-ST |
| 17 | ALIQ_ST | N | - | OC | Aliquota ICMS-ST |
| 18 | VL_ICMS_ST | N | - | OC | Valor ICMS-ST |
| 19 | IND_APUR | C | 1 | OC | 0=Mensal, 1=Decendial |
| 20 | CST_IPI | C | 2 | OC | CST do IPI |
| 21 | COD_ENQ | C | 3 | OC | Codigo enquadramento IPI |
| 22 | VL_BC_IPI | N | - | OC | Base calculo IPI |
| 23 | ALIQ_IPI | N | - | OC | Aliquota IPI |
| 24 | VL_IPI | N | - | OC | Valor IPI |
| 25 | CST_PIS | N | 2 | OC | CST PIS |
| 26 | VL_BC_PIS | N | - | OC | Base calculo PIS |
| 27 | ALIQ_PIS | N | - | OC | Aliquota PIS (%) |
| 28 | QUANT_BC_PIS | N | - | OC | Qtd base calculo PIS |
| 29 | ALIQ_PIS_QUANT | N | - | OC | Aliquota PIS (R$/un) |
| 30 | VL_PIS | N | - | OC | Valor PIS |
| 31 | CST_COFINS | N | 2 | OC | CST COFINS |
| 32 | VL_BC_COFINS | N | - | OC | Base calculo COFINS |
| 33 | ALIQ_COFINS | N | - | OC | Aliquota COFINS (%) |
| 34 | QUANT_BC_COFINS | N | - | OC | Qtd base calculo COFINS |
| 35 | ALIQ_COFINS_QUANT | N | - | OC | Aliquota COFINS (R$/un) |
| 36 | VL_COFINS | N | - | OC | Valor COFINS |
| 37 | COD_CTA | C | - | OC | Conta contabil |
| 38 | VL_ABAT_NT | N | - | OC | Abatimento nao tributado |

#### Registro C190 — Registro Analitico (SEMPRE OBRIGATORIO como filho de C100)

| Nro | Campo | Tipo | Tam | Obrig | Descricao |
|-----|-------|------|-----|-------|-----------|
| 01 | REG | C | 4 | O | "C190" |
| 02 | CST_ICMS | N | 3 | O | CST ICMS (3 digitos) |
| 03 | CFOP | N | 4 | O | CFOP |
| 04 | ALIQ_ICMS | N | 6 | OC | Aliquota ICMS |
| 05 | VL_OPR | N | - | O | Valor total operacao (CST+CFOP+ALIQ) |
| 06 | VL_BC_ICMS | N | - | O | Base calculo ICMS |
| 07 | VL_ICMS | N | - | O | Valor ICMS |
| 08 | VL_BC_ICMS_ST | N | - | O | Base calculo ICMS-ST |
| 09 | VL_ICMS_ST | N | - | O | Valor ICMS-ST |
| 10 | VL_RED_BC | N | - | O | Reducao base calculo |
| 11 | VL_IPI | N | - | O | Valor IPI |
| 12 | COD_OBS | C | 6 | OC | Codigo observacao (ref. 0460) |

**Validacoes criticas**:
- NAO podem existir 2+ registros com mesma combinacao CST_ICMS + CFOP + ALIQ_ICMS
- Soma de VL_OPR dos C190 deve bater com VL_DOC do C100 pai
- Soma de VL_BC_ICMS dos C190 deve bater com VL_BC_ICMS do C100
- Campos numericos DEVEM ser preenchidos (com 0 se nao houver valor)

---

### 3.4 BLOCO D — Documentos Fiscais de Transporte e Comunicacao

#### Registros Principais

```
D001 (Nivel 1) — Abertura do Bloco D
  D100 (Nivel 2) — CTe (cod. 57), CTe-OS (cod. 67), NFST (07), CTRC (08), etc.
    D101 (Nivel 3) — Inf. complementar DIFAL/FCP (leiaute 020)
    D110 (Nivel 3) — Itens do servico de transporte
    D190 (Nivel 3, OBRIGATORIO) — Registro analitico
    D195/D197 — Observacoes/ajustes
  D500 (Nivel 2) — NFe Comunicacao/Telecomunicacao (cod. 21/22)
    D590 (Nivel 3, OBRIGATORIO) — Registro analitico
  D700 (Nivel 2) — NFCom (cod. 62, a partir leiaute 020)
    D730 (Nivel 3, OBRIGATORIO) — Registro analitico
D990 (Nivel 1) — Encerramento do Bloco D
```

- **D100 + D190** obrigatorios para tomadores de servico de transporte (mesma logica C100+C190)
- CTe emissao propria: apenas D100 + D190

---

### 3.5 BLOCO E — Apuracao do ICMS e do IPI

#### Hierarquia

```
E001 (Nivel 1, Ocorr. 1) — Abertura do Bloco E
  E100 (Nivel 2, Ocorr. V) — Periodo de Apuracao ICMS — Operacoes Proprias
    E110 (Nivel 3, Ocorr. 1:1) — Apuracao ICMS — Operacoes Proprias
      E111 (Nivel 4, Ocorr. 1:N) — Ajuste/Beneficio/Incentivo Apuracao
        E112 (Nivel 5, Ocorr. 1:N) — Inf. adicionais ajuste — doc. fiscais
        E113 (Nivel 5, Ocorr. 1:N) — Inf. adicionais ajuste
      E115 (Nivel 4, Ocorr. 1:N) — Valores Declaratorios
      E116 (Nivel 4, Ocorr. 1:N) — Obrigacoes ICMS a Recolher
  E200 (Nivel 2, Ocorr. V) — Periodo de Apuracao ICMS-ST
    E210 (Nivel 3, Ocorr. 1:1) — Apuracao ICMS-ST
      E220 (Nivel 4, Ocorr. 1:N) — Ajustes ST
      E230 (Nivel 4, Ocorr. 1:N) — Inf. adicionais
      E240 (Nivel 4, Ocorr. 1:N) — Inf. adicionais (documentos)
      E250 (Nivel 4, Ocorr. 1:N) — Obrigacoes ICMS-ST a Recolher
  E300 (Nivel 2, Ocorr. V) — Periodo de Apuracao DIFAL/FCP (EC 87/15)
    E310 (Nivel 3, Ocorr. 1:1) — Apuracao DIFAL/FCP
      E311 (Nivel 4, Ocorr. 1:N) — Ajustes DIFAL/FCP
        E312 (Nivel 5, Ocorr. 1:N) — Inf. adicionais
        E313 (Nivel 5, Ocorr. 1:N) — Inf. adicionais (doc. fiscais)
      E316 (Nivel 4, Ocorr. 1:N) — Obrigacoes DIFAL/FCP a Recolher
  E500 (Nivel 2, Ocorr. V) — Periodo de Apuracao IPI
    E510 (Nivel 3, Ocorr. 1:N) — Consolidacao IPI
    E520 (Nivel 3, Ocorr. 1:1) — Apuracao IPI
      E530 (Nivel 4, Ocorr. 1:N) — Ajustes Apuracao IPI
      E531 (Nivel 4, Ocorr. 1:N) — Inf. adicionais ajuste IPI
E990 (Nivel 1, Ocorr. 1) — Encerramento do Bloco E
```

#### Registro E100 — Periodo de Apuracao ICMS (OBRIGATORIO)

| Nro | Campo | Tipo | Tam | Obrig | Descricao |
|-----|-------|------|-----|-------|-----------|
| 01 | REG | C | 4 | O | "E100" |
| 02 | DT_INI | N | 8 | O | Data inicio do periodo (ddmmaaaa) |
| 03 | DT_FIN | N | 8 | O | Data fim do periodo (ddmmaaaa) |

#### Registro E110 — Apuracao ICMS Operacoes Proprias (OBRIGATORIO)

| Nro | Campo | Tipo | Tam | Obrig | Descricao |
|-----|-------|------|-----|-------|-----------|
| 01 | REG | C | 4 | O | "E110" |
| 02 | VL_TOT_DEBITOS | N | - | O | Total debitos por saidas |
| 03 | VL_AJ_DEBITOS | N | - | O | Ajustes a debito (doc. fiscal) |
| 04 | VL_TOT_AJ_DEBITOS | N | - | O | Ajustes a debito (apuracao) |
| 05 | VL_ESTORNOS_CRED | N | - | O | Estornos de credito |
| 06 | VL_TOT_CREDITOS | N | - | O | Total creditos por entradas |
| 07 | VL_AJ_CREDITOS | N | - | O | Ajustes a credito (doc. fiscal) |
| 08 | VL_TOT_AJ_CREDITOS | N | - | O | Ajustes a credito (apuracao) |
| 09 | VL_ESTORNOS_DEB | N | - | O | Estornos de debito |
| 10 | VL_SLD_CREDOR_ANT | N | - | O | Saldo credor periodo anterior |
| 11 | VL_SLD_APURADO | N | - | O | Saldo devedor apurado |
| 12 | VL_TOT_DED | N | - | O | Total deducoes |
| 13 | VL_ICMS_RECOLHER | N | - | O | ICMS a recolher (VL_SLD_APURADO - VL_TOT_DED) |
| 14 | VL_SLD_CREDOR_TRANSPORTAR | N | - | O | Saldo credor para proximo periodo |
| 15 | DEB_ESP | N | - | O | Debitos especiais |

**Validacoes criticas**:
- VL_TOT_DEBITOS deve bater com soma dos debitos dos blocos C e D
- VL_TOT_CREDITOS deve bater com soma dos creditos dos blocos C e D
- Se VL_ICMS_RECOLHER > 0 OU DEB_ESP > 0, DEVE existir registro E116

#### Registro E111 — Ajuste da Apuracao ICMS (CONDICIONAL)

| Nro | Campo | Tipo | Tam | Obrig | Descricao |
|-----|-------|------|-----|-------|-----------|
| 01 | REG | C | 4 | O | "E111" |
| 02 | COD_AJ_APUR | C | 8 | O | Codigo ajuste (tabela 5.1.1) |
| 03 | DESCR_COMPL_AJ | C | - | OC | Descricao complementar |
| 04 | VL_AJ_APUR | N | - | O | Valor do ajuste |

O 3o e 4o digitos do COD_AJ_APUR determinam o campo do E110 que sera impactado:
- `x0` → VL_TOT_AJ_DEBITOS (campo 04)
- `x1` → VL_ESTORNOS_CRED (campo 05)
- `x2` → VL_TOT_AJ_CREDITOS (campo 08)
- `x3` → VL_ESTORNOS_DEB (campo 09)
- `x4` → VL_TOT_DED (campo 12)
- `x5` → DEB_ESP (campo 15)

#### Registro E116 — Obrigacoes do ICMS a Recolher (CONDICIONAL)

| Nro | Campo | Tipo | Tam | Obrig | Descricao |
|-----|-------|------|-----|-------|-----------|
| 01 | REG | C | 4 | O | "E116" |
| 02 | COD_OR | C | 3 | O | Codigo da obrigacao (tabela 5.4) |
| 03 | VL_OR | N | - | O | Valor da obrigacao |
| 04 | DT_VCTO | N | 8 | O | Data vencimento (ddmmaaaa) |
| 05 | COD_REC | C | - | O | Codigo de receita (estadual) |
| 06 | NUM_PROC | C | 15 | OC | Numero processo |
| 07 | IND_PROC | C | 1 | OC | Indicador processo: 0=SEFAZ, 1=Justica |
| 08 | PROC | C | - | OC | Descricao processo |
| 09 | TXT_COMPL | C | - | OC | Descricao complementar |
| 10 | MES_REF | N | 6 | OC | Mes referencia (mmaaaa) |

**Validacao critica**: Soma VL_OR dos E116 DEVE ser igual a VL_ICMS_RECOLHER + DEB_ESP do E110.

---

### 3.6 BLOCO G — CIAP (Controle Credito Ativo Permanente)

```
G001 (Nivel 1) — Abertura do Bloco G
  G110 (Nivel 2) — ICMS — Ativo Permanente — CIAP
    G125 (Nivel 3) — Movimentacao de bem/componente CIAP
      G126 (Nivel 4) — Outros creditos CIAP
      G130 (Nivel 4) — Identificacao documento fiscal (entrada do bem)
        G140 (Nivel 5) — Identificacao item do documento fiscal
G990 (Nivel 1) — Encerramento do Bloco G
```

**Obrigatoriedade**: Obrigatorio desde 01/2011 para contribuintes que apropriam credito ICMS do ativo imobilizado.
Se nao houver credito CIAP no periodo: apenas G001 (IND_MOV=1) + G990.

**Calculo da fracao 1/48**:
```
Credito mensal = (Valor total credito ICMS) x (1/48) x (Saidas tributadas / Total saidas)
```
- 48 parcelas mensais a partir da entrada do bem
- Saldo nao apropriado apos 48 meses deve ser cancelado
- Direito ao credito extingue-se apos 5 anos da emissao da NF

---

### 3.7 BLOCO H — Inventario Fisico

```
H001 (Nivel 1) — Abertura do Bloco H
  H005 (Nivel 2) — Totais do Inventario
    H010 (Nivel 3) — Inventario — Itens
      H020 (Nivel 4) — Informacao complementar
      H030 (Nivel 4) — Informacao complementar (condicional)
H990 (Nivel 1) — Encerramento do Bloco H
```

**Obrigatoriedade**: Anual, com base em 31/12 do ano. Deve ser informado ate a escrituracao de fevereiro (entregue em marco).

**Tambem obrigatorio nos eventos**: cisao, fusao, incorporacao, encerramento de atividades, etc.

---

### 3.8 BLOCO K — Controle da Producao e do Estoque

```
K001 (Nivel 1) — Abertura do Bloco K
  K100 (Nivel 2) — Periodo de Apuracao
    K200 (Nivel 3) — Estoque escriturado
    K210 (Nivel 3) — Desmontagem de mercadorias
    K215 (Nivel 4) — Desmontagem — itens de destino
    K220 (Nivel 3) — Outras movimentacoes internas
    K230 (Nivel 3) — Itens produzidos
      K235 (Nivel 4) — Insumos consumidos
    K250 (Nivel 3) — Industrializacao efetuada por terceiros
      K255 (Nivel 4) — Industrializacao por terceiros — itens
    K260 (Nivel 3) — Reprocessamento/Reparo
      K265 (Nivel 4) — Reprocessamento — itens
    K270 (Nivel 3) — Correcao de apontamento
      K275 (Nivel 4) — Correcao — itens
    K280 (Nivel 3) — Correcao de apontamento — estoque
    K290 (Nivel 3) — Producao conjunta — ordem producao
      K291 (Nivel 4) — Producao conjunta — itens
      K292 (Nivel 4) — Producao conjunta — insumos
    K300 (Nivel 3) — Producao conjunta — industrializacao
      K301/K302 (Nivel 4) — itens/insumos
    K310 (Nivel 3) — Producao conjunta — industrializacao 2
K990 (Nivel 1) — Encerramento do Bloco K
```

**Obrigatoriedade**: Vigente desde 01/2017 (Ajuste SINIEF 01/2016).
- Leiaute completo: faturamento >= R$ 300 milhoes
- Leiaute simplificado (K200/K280): demais
- **SN e MEI: dispensados**

---

### 3.9 BLOCO 1 — Outras Informacoes

```
1001 (Nivel 1) — Abertura do Bloco 1
  1010 (Nivel 2) — Obrigatoriedade de Registros do Bloco 1
  1100 (Nivel 2) — Exportacao
    1105/1110 (Nivel 3) — Documentos fiscais exportacao
  1200 (Nivel 2) — Controle de Creditos Fiscais ICMS
    1210 (Nivel 3) — Utilizacao de Creditos
  1250 (Nivel 2) — Saldos restituicao/ressarcimento/complementacao ICMS
    1255 (Nivel 3) — Resumo por motivo
  1300 (Nivel 2) — Combustiveis (varejista)
    1310/1320 (Nivel 3) — Bombas/volume
  1390 (Nivel 2) — Usinas acucar/alcool
  1400 (Nivel 2) — Valores Agregados
  1500 (Nivel 2) — Energia eletrica
  1600 (Nivel 2) — Total operacoes cartao credito/debito
  1700 (Nivel 2) — Documentos fiscais em papel
    1710 (Nivel 3) — Numeracao utilizada
  1800 (Nivel 2) — Transporte aereo
  1900 (Nivel 2) — Indicador de sub-apuracao ICMS
    1910/1920/1921/1925/1926 — Sub-apuracao
1990 (Nivel 1) — Encerramento do Bloco 1
```

#### Registro 1010 — Obrigatoriedade (OBRIGATORIO a partir 07/2012)

Formato de perguntas S/N que determinam quais registros do Bloco 1 devem ser preenchidos:

| Campo | Registro controlado | Descricao |
|-------|-------------------|-----------|
| IND_EXP | 1100 | Houve exportacao? |
| IND_CCRF | 1200 | Controle de creditos fiscais ICMS? |
| IND_COMB | 1300 | Varejista de combustiveis? |
| IND_USINA | 1390 | Usina acucar/alcool? |
| IND_VA | 1400 | Valores agregados? |
| IND_EE | 1500 | Energia eletrica? |
| IND_CART | 1600 | Operacoes com cartao? |
| IND_FORM | 1700 | Documentos fiscais em papel? |
| IND_AER | 1800 | Transporte aereo? |

---

### 3.10 BLOCO 9 — Controle e Encerramento

```
9001 (Nivel 1, Ocorr. 1) — Abertura do Bloco 9
  9900 (Nivel 2, Ocorr. V) — Registros do Arquivo (totalizacao)
9990 (Nivel 1, Ocorr. 1) — Encerramento do Bloco 9
9999 (Nivel 0, Ocorr. 1) — Encerramento do Arquivo Digital
```

#### Registro 9001 — Abertura do Bloco 9 (OBRIGATORIO)

| Nro | Campo | Tipo | Tam | Obrig | Descricao |
|-----|-------|------|-----|-------|-----------|
| 01 | REG | C | 4 | O | "9001" |
| 02 | IND_MOV | N | 1 | O | 0=Com dados (sempre 0 no Bloco 9) |

#### Registro 9900 — Registros do Arquivo (OBRIGATORIO)

| Nro | Campo | Tipo | Tam | Obrig | Descricao |
|-----|-------|------|-----|-------|-----------|
| 01 | REG | C | 4 | O | "9900" |
| 02 | REG_BLC | C | 4 | O | Registro que esta sendo totalizado |
| 03 | QTD_REG_BLC | N | - | O | Quantidade total desse registro no arquivo |

Um registro 9900 para CADA tipo de registro presente no arquivo (incluindo o proprio 9900).

**Validacoes criticas**:
- Todos os tipos de registros existentes no arquivo DEVEM ter um 9900 correspondente
- A quantidade informada DEVE bater com a quantidade real de linhas daquele registro

#### Registro 9990 — Encerramento do Bloco 9 (OBRIGATORIO)

| Nro | Campo | Tipo | Tam | Obrig | Descricao |
|-----|-------|------|-----|-------|-----------|
| 01 | REG | C | 4 | O | "9990" |
| 02 | QTD_LIN_9 | N | - | O | Qtd total de linhas do Bloco 9 (incluindo 9999) |

#### Registro 9999 — Encerramento do Arquivo (OBRIGATORIO)

| Nro | Campo | Tipo | Tam | Obrig | Descricao |
|-----|-------|------|-----|-------|-----------|
| 01 | REG | C | 4 | O | "9999" |
| 02 | QTD_LIN | N | - | O | Qtd total de linhas do arquivo inteiro |

---

## 4. Regras de Escrituracao

### 4.1 CST vs CSOSN — Quando Usar

#### Tabela A — Origem da Mercadoria (1o digito do CST)

| Cod | Descricao |
|-----|-----------|
| 0 | Nacional |
| 1 | Estrangeira — importacao direta |
| 2 | Estrangeira — adquirida no mercado interno |
| 3 | Nacional — conteudo importacao > 40% e <= 70% |
| 4 | Nacional — producao conforme Decreto-Lei 288/67 |
| 5 | Nacional — conteudo importacao <= 40% |
| 6 | Estrangeira — importacao direta, sem similar (CAMEX) |
| 7 | Estrangeira — mercado interno, sem similar (CAMEX) |
| 8 | Nacional — conteudo importacao > 70% |

#### Tabela B — Tributacao pelo ICMS (2o e 3o digitos do CST)

| Cod | Descricao | Uso Comum |
|-----|-----------|-----------|
| **00** | Tributada integralmente | Venda normal, compra tributada |
| **10** | Tributada com cobranca de ICMS-ST | Venda com ST (substituto) |
| **20** | Com reducao de base de calculo | Beneficio fiscal |
| **30** | Isenta/nao tributada com ICMS-ST | Isencao + ST |
| **40** | Isenta | Isencao por lei/convenio |
| **41** | Nao tributada | Exportacao, imunidade |
| **50** | Suspensao | ICMS suspenso (nao isento) |
| **51** | Diferimento | Pagamento adiado |
| **60** | ICMS cobrado anteriormente por ST | Substituido tributario |
| **70** | Reducao BC + ICMS-ST | Reducao + ST |
| **90** | Outras | Situacoes diversas |

#### CSOSN (Simples Nacional) — EXTINTO desde abril/2023

| Cod | Descricao | Equivalente CST |
|-----|-----------|----------------|
| 101 | Tributada com permissao de credito | ~00 |
| 102 | Tributada sem permissao de credito | ~00 |
| 103 | Isencao para faixa de receita bruta | ~40 |
| 201 | Tributada com credito + ICMS-ST | ~10 |
| 202 | Tributada sem credito + ICMS-ST | ~10 |
| 203 | Isencao faixa + ICMS-ST | ~30 |
| 300 | Imune | ~40/41 |
| 400 | Nao tributada | ~40/41/50 |
| 500 | ICMS cobrado anteriormente por ST | ~60 |
| 900 | Outros | ~90 |

**IMPORTANTE (Ajuste SINIEF 16/2020)**: Desde abril/2023, empresas do SN passaram a usar **CST** no lugar de CSOSN. CSOSN extinto para padronizacao.

Na EFD ICMS/IPI: usar sempre CST (3 digitos). Para SN que ainda usa CSOSN nas notas, o sistema deve mapear CSOSN → CST na escrituracao.

### 4.2 CFOPs por Tipo de Operacao

#### Entradas (compra de mercadoria)

| CFOP | Descricao |
|------|-----------|
| 1.102 / 2.102 | Compra para comercializacao |
| 1.101 / 2.101 | Compra para industrializacao |
| 1.403 / 2.403 | Compra para comercializacao (ST) |
| 1.126 / 2.126 | Compra material uso/consumo (nao credita ICMS) |
| 1.128 | Compra material para aplicacao em obra |
| 1.556 / 2.556 | Compra material uso/consumo (grupo 1.550) |
| 1.551 / 2.551 | Compra ativo imobilizado |
| 1.406 / 2.406 | Compra ativo imobilizado (ST) |
| 1.949 / 2.949 | Outras entradas |

#### Saidas (venda de mercadoria/servico)

| CFOP | Descricao |
|------|-----------|
| 5.102 / 6.102 | Venda de mercadoria |
| 5.101 / 6.101 | Venda de producao |
| 5.405 | Venda mercadoria adquirida com ST |
| 5.551 / 6.551 | Venda ativo imobilizado |
| 5.910 / 6.910 | Remessa bonificacao/doacao/brinde |
| 5.915 / 6.915 | Remessa para conserto/reparo |
| 5.949 / 6.949 | Outras saidas |
| 7.101 / 7.102 | Exportacao |

#### Devolucoes

| CFOP | Descricao |
|------|-----------|
| 1.202 / 2.202 | Devolucao de venda (entrada) |
| 5.202 / 6.202 | Devolucao de compra (saida) |
| 1.411 / 2.411 | Devolucao de venda (ST, entrada) |
| 5.411 / 6.411 | Devolucao de compra (ST, saida) |

### 4.3 Escrituracao de NFe de Entrada

#### Compra de mercadoria para revenda
- CFOP: 1.102 / 2.102
- CST: 000 (tributada) ou 060 (ST cobrado anteriormente)
- Credito ICMS: SIM (se regime normal e operacao tributada)
- Bloco C: C100 + C170 + C190

#### Compra para uso/consumo
- CFOP: 1.556 / 2.556 ou 1.126 / 2.126
- CST: variavel (geralmente 000 ou 090)
- Credito ICMS: NAO (uso/consumo nao gera credito, exceto energia eletrica e telecomunicacao para industria)
- Bloco C: C100 + C170 + C190

#### Compra de ativo imobilizado
- CFOP: 1.551 / 2.551
- CST: 000 (tributada)
- Credito ICMS: SIM, porem **parcelado em 1/48 avos** via CIAP (Bloco G)
- Bloco C: C100 + C170 + C190 + Bloco G (G110/G125/G130/G140)

### 4.4 Escrituracao de NFe de Saida

- C100 (IND_OPER=1, IND_EMIT=0) + C190
- C170 NAO e informado para NFe de emissao propria (regra geral)
- Excecao: C170 se houver C176 (ressarcimento ST) ou C180/C181 (FCP)
- Valores de CBS/IBS/IS (Reforma Tributaria) NAO devem ser incluidos no VL_OPR do C190

### 4.5 Substituicao Tributaria — Escrituracao

#### Como substituto tributario (responsavel pelo recolhimento):
1. Destacar ICMS-ST na nota (campos VL_BC_ICMS_ST e VL_ICMS_ST)
2. C190: CST com digitos 10, 30 ou 70
3. Bloco E: E200/E210 para apuracao ICMS-ST por UF destinataria
4. E250: guias de recolhimento ICMS-ST

#### Como substituido (ICMS ja recolhido):
1. C170/C190: CST 60 (ICMS cobrado anteriormente por ST)
2. Campos VL_BC_ICMS e VL_ICMS zerados
3. Campos VL_BC_ICMS_ST e VL_ICMS_ST com os valores da ST

### 4.6 DIFAL — Diferencial de Aliquota

#### Quando aplicavel:
- Venda interestadual para consumidor final NAO contribuinte (EC 87/2015)
- Compra interestadual para uso/consumo ou ativo imobilizado (contribuinte)

#### Escrituracao:
1. C100: nota fiscal normal
2. C101/D101: informacoes complementares DIFAL/FCP (leiaute 020)
3. Bloco E: E300/E310/E311/E316 por UF de destino
4. Em MG: debitos/creditos do E310 devem ser "transportados" para E110 via ajustes

### 4.7 Credito de ICMS

#### Quem pode tomar credito:
- Apenas regime normal (Lucro Real/Presumido, NAO SN)
- Apenas em operacoes tributadas (CST 00, 10, 20, 70)
- NAO se credita: uso/consumo (exceto energia/telecom industrial), isentas, nao tributadas

#### Calculo do credito:
```
Credito = Base de calculo ICMS x Aliquota ICMS
```

#### Credito CIAP (Ativo Imobilizado):
```
Credito mensal = (ICMS total NF) x (1/48) x (Saidas tributadas / Total saidas do mes)
```

---

## 5. Validacoes do PVA

### 5.1 O que e o PVA

Programa Validador e Assinador da EFD, fornecido pela RFB. Verifica consistencia, permite assinatura digital (cert. A1 ou A3 ICP-Brasil) e transmissao via internet.

### 5.2 Tipos de Mensagens

| Tipo | Impacto |
|------|---------|
| **Erro** | Impede assinatura e transmissao — correcao obrigatoria |
| **Advertencia** | Nao bloqueia, mas indica inconsistencia |

### 5.3 Principais Regras de Validacao

#### Estruturais
- Todos os blocos devem estar presentes (com abertura/encerramento)
- Blocos na ordem correta: 0 → B → C → D → E → G → H → K → 1 → 9
- Registros em ordem sequencial e ascendente dentro de cada bloco
- Campos na ordem exata do leiaute
- Registro 0000 deve ser o primeiro, 9999 o ultimo

#### Cruzamento entre Blocos
- COD_PART do C100/D100 deve existir no 0150
- COD_ITEM do C170 deve existir no 0200
- UNID do C170 deve existir no 0190
- Se C170 usa unidade diferente de UNID_INV do 0200, deve existir 0220
- Soma VL_OPR dos C190 = VL_DOC do C100
- Soma VL_BC_ICMS dos C190 = VL_BC_ICMS do C100
- VL_TOT_DEBITOS do E110 = soma debitos dos blocos C e D
- VL_TOT_CREDITOS do E110 = soma creditos dos blocos C e D
- Soma VL_OR dos E116 = VL_ICMS_RECOLHER + DEB_ESP do E110
- Qtd registros no 9900 deve bater com quantidade real no arquivo
- QTD_LIN do 9999 = total de linhas do arquivo

#### Validacoes de Campos
- CNPJ, CPF, IE: validacao de digito verificador
- DT_INI/DT_FIN: formato ddmmaaaa, DT_INI = 1o dia mes
- CHV_NFE: 44 digitos, validacao de DV
- NUM_ITEM: sequencial unico dentro do C100
- C190: nao duplicar combinacao CST+CFOP+ALIQ_ICMS
- VL_BC_ICMS no C170 NAO pode exceder VL_ITEM
- Registro 0000 deve ocorrer exatamente 1 vez

### 5.4 Erros Mais Comuns

1. **Duplicidade de documentos** — mesmo C100 com chave identica
2. **Cadastros ausentes** — 0150/0200/0190 nao encontrados para referencia usada nos blocos C/D
3. **NUM_DOC divergente de CHV_NFE** — numero na chave nao bate
4. **Inconsistencia de valores** — soma itens C170 != total C100, ou C190 != C100
5. **VL_BC_ICMS > VL_ITEM** — base de calculo excedendo valor do item
6. **Divergencia inventario** — H005 totais != soma H010 itens; itens sem 0200
7. **Blocos vazios nao declarados** — falta abertura/encerramento de blocos sem dados
8. **CFOP invertido** — entrada com CFOP de saida ou vice-versa
9. **NCM incorreto** — codigo nao existente na TIPI vigente
10. **Fator conversao ausente** — unidade diferente no C170 vs 0200 sem registro 0220

### 5.5 Boas Praticas

- Validar internamente ANTES de enviar ao PVA
- Gerar blocos vazios automaticamente (abertura + encerramento)
- Manter cadastros de participantes/itens/unidades sincronizados
- Nunca fazer ajustes manuais no PVA — corrigir no sistema de origem
- Baixar versao mais recente do PVA antes de validar
- Usar checklist pre-transmissao

---

## 6. Layout Tecnico

### 6.1 Resumo das Especificacoes

```
Encoding:           ISO 8859-1 (Latin-1)
Delimitador:        | (pipe, ASCII 124)
Fim de linha:       CR+LF ou LF
Formato data:       ddmmaaaa (ex: 01032026)
Formato numerico:   Sem separador de milhar, PONTO para decimal (ex: 1234.56)
Campos vazios:      || (dois pipes sem nada entre eles)
Tamanho registro:   Variavel
Campos tipo C:      Alfanumerico, max 255 chars
Campos tipo N:      Numerico, apenas 0-9 e ponto decimal
Compactacao:        Proibida
```

### 6.2 Notacao de Obrigatoriedade

| Simbolo | Significado |
|---------|-------------|
| **O** | Obrigatorio — campo deve ser sempre preenchido |
| **OC** | Obrigatorio condicional — preencher se houver informacao |
| **N** | Nao pode ser preenchido |

### 6.3 Tipos de Dados

| Tipo | Descricao | Exemplo |
|------|-----------|---------|
| **C** | Alfanumerico | `EMPRESA LTDA` |
| **N** | Numerico inteiro | `12345678` |
| **N** (decimal) | Numerico com decimais | `1234.56` |

---

## 7. Exemplo de Arquivo Minimo Valido

Arquivo "sem movimento" — empresa obrigada, mas sem operacoes no periodo:

```
|0000|020|0|01012026|31012026|EMPRESA EXEMPLO LTDA|12345678000190||SP|123456789012|3550308|||A|1|
|0001|0|
|0005|EXEMPLO|01310100|RUA DAS FLORES|100||CENTRO|1133334444||contato@exemplo.com.br|
|0100|JOAO SILVA CONTADOR|12345678901|SP-123456|11222333000144|01310100|RUA DOS CONTADORES|200||VILA NOVA|1122223333||joao@contador.com.br|3550308|
|0990|4|
|B001|1|
|B990|2|
|C001|1|
|C990|2|
|D001|1|
|D990|2|
|E001|0|
|E100|01012026|31012026|
|E110|0|0|0|0|0|0|0|0|0|0|0|0|0|0|
|E990|4|
|G001|1|
|G990|2|
|H001|1|
|H990|2|
|K001|1|
|K990|2|
|1001|0|
|1010|N|N|N|N|N|N|N|N|N|
|1990|3|
|9001|0|
|9900|0000|1|
|9900|0001|1|
|9900|0005|1|
|9900|0100|1|
|9900|0990|1|
|9900|B001|1|
|9900|B990|1|
|9900|C001|1|
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
|9900|1010|1|
|9900|1990|1|
|9900|9001|1|
|9900|9900|26|
|9900|9990|1|
|9900|9999|1|
|9990|30|
|9999|34|
```

**Observacoes sobre o exemplo**:
- Leiaute 020 (vigente 2026)
- Perfil A, atividade "Outros"
- Todos os blocos presentes (mesmo sem dados)
- E100/E110 obrigatorios mesmo zerados
- 1010 com todas as respostas "N"
- Bloco 9 totaliza TODOS os registros presentes
- 9990 conta todas as linhas do bloco 9 (incluindo 9999)
- 9999 conta todas as linhas do arquivo inteiro

---

## 8. Recomendacoes para Implementacao

### 8.1 Arquitetura do Gerador

```
1. Coletar dados do periodo (notas, participantes, itens, apuracao)
2. Gerar Bloco 0 (cadastros referenciados)
3. Gerar Bloco C (notas fiscais — C100/C170/C190)
4. Gerar Bloco D (transporte — D100/D190)
5. Gerar Bloco E (apuracao — calcular debitos/creditos dos blocos C e D)
6. Gerar Blocos G, H, K (se aplicavel)
7. Gerar Bloco 1 (1010 + registros condicionais)
8. Gerar Bloco 9 (contar todos os registros gerados)
9. Validar internamente
10. Gravar arquivo com encoding ISO 8859-1
```

### 8.2 Dados Necessarios no ERP

Para gerar o SPED Fiscal, o sistema precisa armazenar:

- **Empresa**: CNPJ, IE, IM, UF, cod. municipio IBGE, endereco completo, perfil (A/B/C), atividade
- **Contabilista**: nome, CPF, CRC, endereco, email
- **Participantes**: cod. unico, CNPJ/CPF, IE, cod. municipio IBGE, endereco
- **Itens/Produtos**: cod. unico, descricao, NCM, unidade, tipo (00-99), cod. barras, cod. servico
- **Unidades de medida**: codigo, descricao
- **Notas fiscais**: todos os campos da NFe (chave, data, valores, ICMS, IPI, ST)
- **Itens da nota**: num. item, cod. item, qtd, unid, valores, CST, CFOP, aliquotas
- **Apuracao ICMS**: debitos, creditos, ajustes, saldo credor anterior
- **Naturezas de operacao**: codigo, descricao
- **Tabela de observacoes**: codigos de observacao fiscal

### 8.3 Tabelas Externas Necessarias

| Tabela | Descricao | Fonte |
|--------|-----------|-------|
| **5.1.1** | Codigos de ajuste da apuracao ICMS | SPED / SEFAZ estadual |
| **5.2** | Codigos de ajuste do documento fiscal | SPED / SEFAZ estadual |
| **5.3** | Valores declaratorios | SPED / SEFAZ estadual |
| **5.4** | Codigos de obrigacao a recolher | SPED / SEFAZ estadual |
| **5.5** | Codigos de tipos de credito | SPED / SEFAZ estadual |
| **CFOP** | Codigos Fiscais de Operacoes | CONFAZ |
| **NCM/SH** | Nomenclatura Comum do Mercosul | Receita Federal |
| **TIPI** | Tabela de IPI | Receita Federal |
| **IBGE** | Codigos de municipios | IBGE |

### 8.4 Regimes Tributarios — Diferenca na Geracao

| Aspecto | Simples Nacional | Lucro Presumido | Lucro Real |
|---------|-----------------|-----------------|------------|
| Obrigado EFD? | NAO (em regra) | SIM | SIM |
| CST nas notas | Pode usar CSOSN (mapeado para CST na EFD) | CST | CST |
| Credito ICMS | NAO | SIM (se tributado) | SIM (se tributado) |
| Bloco K | Dispensado | Condicional | Condicional |
| Bloco G (CIAP) | N/A | Se tiver ativo imobilizado | Se tiver ativo imobilizado |
| PIS/COFINS na EFD | Dispensado | Dispensado (declarar na EFD-Contribuicoes) | Dispensado (declarar na EFD-Contribuicoes) |
| Obrigacao correta | DeSTDA + PGDAS-D + DEFIS | EFD ICMS/IPI + EFD-Contribuicoes + ECF | EFD ICMS/IPI + EFD-Contribuicoes + ECF + ECD |

---

## Fontes

- Guia Pratico EFD-ICMS/IPI v3.2.1 (out/2025): http://sped.rfb.gov.br
- Guia Pratico EFD-ICMS/IPI v3.1.9 (mai/2025): https://www.confaz.fazenda.gov.br
- Portal SPED — Manuais e Guias: http://sped.rfb.gov.br/pasta/show/1573
- SPED MG: https://portalsped.fazenda.mg.gov.br/spedmg/efd/
- SEFAZ-MT FAQ EFD: http://www.sefaz.mt.gov.br
- SEFAZ-PE FAQ EFD: https://www.sefaz.pe.gov.br
- SEFAZ-SP FAQ EFD: https://portal.fazenda.sp.gov.br/servicos/sped/
- VRI Consulting (registros): https://www.vriconsulting.com.br
- Tecnospeed (blocos e registros): https://blog.tecnospeed.com.br
- e-Auditoria (validacao PVA): https://www.e-auditoria.com.br
- Focus NFe (CFOP): https://focusnfe.com.br/blog/cfop-de-entrada/
