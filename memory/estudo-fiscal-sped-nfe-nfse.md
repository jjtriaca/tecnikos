# Estudo Fiscal — SPED, NFe, NFS-e e Obrigacoes Acessorias

**Data**: 06/03/2026
**Contexto**: SLS Obras LTDA | Simples Nacional | Construcao Civil | MT (Primavera do Leste)

---

## 1. SPED Fiscal (EFD-ICMS/IPI) — SLS Obras DISPENSADA

Com base no Protocolo ICMS 03/2011, empresas ME e EPP optantes pelo Simples Nacional estao **dispensadas** de entregar a EFD ICMS/IPI. A unica excecao e para empresas impedidas de recolher ICMS pelo SN (art. 20 ss1 da LC 123/2006), o que NAO se aplica a SLS Obras.

Confirmado por todos os estados pesquisados (MT, SP, MG, ES, PE).

**Consequencia**: ao importar NFe de fornecedores, NAO precisa gerar arquivo EFD ICMS/IPI. A escrituracao e simplificada no Livro Registro de Entradas.

---

## 2. Obrigacoes Acessorias — Quadro Comparativo

| Obrigacao | Quem entrega | O que declara | Aplicavel ao SN? |
|---|---|---|---|
| **EFD ICMS/IPI** (SPED Fiscal) | Lucro Real/Presumido | Escrituracao completa ICMS/IPI | **NAO** (dispensado) |
| **EFD-Contribuicoes** | Lucro Real/Presumido | PIS, COFINS | **NAO** (dispensado) |
| **DeSTDA** (SEDIF-SN) | **Simples Nacional** | ST + DIFAL + Antecipacao ICMS | **SIM** (obrigatorio) |
| **PGDAS-D** | **Simples Nacional** | Apuracao mensal dos tributos | **SIM** (obrigatorio) |
| **DEFIS** | **Simples Nacional** | Informacoes socioeconomicas (anual) | **SIM** (obrigatorio) |

### DeSTDA — A obrigacao correta para o SN

Escopo reduzido, declara apenas:
1. ICMS por Substituicao Tributaria
2. ICMS por Diferencial de Aliquota (DIFAL)
3. ICMS por Antecipacao em aquisicoes interestaduais

Prazo: dia 28 do mes subsequente, via aplicativo SEDIF-SN.

---

## 3. Escrituracao de NFe de Entrada (Livro Registro de Entradas)

Obrigatorio para contribuintes ICMS do Simples Nacional. Escrituracao informativa (SN nao tem credito ICMS na maioria dos casos).

### Campos necessarios:
- **CFOP** — Codigo Fiscal de Operacoes e Prestacoes
- **CST/CSOSN** — Codigo de Situacao Tributaria (nova tabela unificada desde abril/2024)
- **CRT** — Codigo Regime Tributario (1=SN)
- **Base de calculo e valor ICMS** (quando destacado)
- **Valor total da nota**
- **NCM** — Nomenclatura Comum do Mercosul
- **Chave de acesso** (44 digitos)
- **Data emissao e data entrada**
- **Dados emitente** (CNPJ, IE, Razao Social)

### CFOPs comuns para construcao civil:
- 1.126 / 2.126 — Compra material uso/consumo
- 1.128 — Compra material para aplicacao em obra
- 1.551/1.556 — Material uso e consumo
- 1.949/2.949 — Outras entradas

---

## 4. NFS-e de Entrada (Servicos Tomados)

### NFS-e NAO e distribuida pela SEFAZ

O DFe da SEFAZ distribui apenas NFe, CTe e NFCe (documentos estaduais/federais). NFS-e e municipal.

### Opcoes para importar NFS-e de entrada:
1. **ADN (Ambiente de Dados Nacional)** — Para municipios do convenio NFS-e Nacional. API com NSU.
2. **Upload manual de XML** — Prestador envia XML, tomador faz upload. Aceita ABRASF ou Nacional.
3. **Portal municipal** — Acessar portal do municipio do prestador.
4. **Digitacao manual** — Quando nao ha XML.

### Escrituracao NFS-e de entrada:
- **Livro**: Registro de Servicos Tomados (obrigacao municipal)
- **Imposto**: ISS (2% a 5%)
- **Retencao na fonte**: tomador pode ser responsavel
- **Campos**: prestador, tomador, valor, aliquota ISS, ISS retido, codigo servico (LC 116), data competencia
- **NAO entra no SPED Fiscal**
- Declarado em obrigacoes municipais (DES, GissOnline, etc.)

---

## 5. NFS-e de Entrada vs NFe de Entrada

| Aspecto | NFe (Mercadoria/Material) | NFS-e (Servico Tomado) |
|---|---|---|
| Fato gerador | Circulacao de mercadoria | Prestacao de servico |
| Imposto principal | ICMS (estadual) + IPI (federal) | ISS (municipal) |
| Orgao autorizador | SEFAZ (estadual) | Prefeitura (municipal) |
| Distribuicao automatica | SIM (DFe SEFAZ) | NAO (exceto ADN) |
| Padrao XML | Nacional unico | Varia por municipio |
| Livro fiscal | Registro de Entradas | Servicos Tomados |
| CFOP | Obrigatorio | Nao se aplica |
| NCM | Obrigatorio | Nao se aplica |
| Codigo servico | Nao se aplica | Item LC 116/2003 |
| SPED | Bloco C da EFD | Nao tem bloco na EFD |
| Para SN | Escrituracao informativa | Obrigacao municipal |

---

## 6. Formato Arquivo SPED (EFD ICMS/IPI) — Referencia Tecnica

Embora SLS Obras (SN) esteja dispensada, referencia para futuros clientes regime normal.

Arquivo texto puro (ASCII Latin-1), delimitador pipe (`|`), registros por linha.

### 10 Blocos:
| Bloco | Descricao |
|---|---|
| 0 | Abertura, Identificacao e Referencias |
| B | ISS |
| C | Documentos Fiscais (NFe) — mais volumoso |
| D | Transporte e Comunicacao (CTe) |
| E | Apuracao ICMS/IPI |
| G | CIAP (Credito Ativo Permanente) |
| H | Inventario Fisico |
| K | Producao e Estoque |
| 1 | Outras Informacoes |
| 9 | Controle e Encerramento |

### Registros principais (Bloco C):
- C100 — Cabecalho NFe
- C170 — Itens NFe
- C190 — Totalizacao CFOP/CST

### Versao atual: Leiaute 020 (vigente 01/01/2026)
Ja inclui campos CBS, IBS e IS (Reforma Tributaria).

---

## 7. Recomendacoes para o Tecnikos

### Ja implementado:
- NFe de entrada via SEFAZ DFe + upload XML manual
- NFS-e de saida via Focus NFe
- Wizard de processamento com decisoes (fornecedor, produtos, financeiro)

### Medio prazo:
1. **NFS-e de entrada** — upload XML (parser diferente do NFe) + digitacao manual
2. **Relatorio Livro de Entradas** — NFe importadas formatadas para impressao/exportacao
3. **Relatorio Livro de Servicos Tomados** — NFS-e recebidas formatadas

### Longo prazo (se houver clientes fora do SN):
1. Integracao ADN para busca automatica NFS-e
2. Geracao DeSTDA para clientes com ST/DIFAL
3. Geracao EFD ICMS/IPI para clientes do regime normal

---

## 8. Sobre o Upload de XML Atual — Atende NFS-e?

O parser atual (`nfe-parser.service.ts`) foi construido para o layout NFe (nfeProc/infNFe).
NFS-e tem layout XML completamente diferente (ABRASF ou Nacional).

Para importar NFS-e de entrada, seria necessario:
1. Novo parser especifico para NFS-e (ABRASF e/ou Nacional)
2. Ou tela de digitacao manual dos dados da NFS-e
3. Tabela separada ou flag para diferenciar NFe de NFS-e no sistema

O mecanismo de upload de XML existente NAO atende NFS-e diretamente — precisa de adaptacao.
