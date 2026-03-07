# Projeto: Módulo Fiscal Completo — Tecnikos

**Data**: 06/03/2026
**Versão**: 1.0
**Status**: PLANEJAMENTO
**Escopo**: Suporte a TODOS os regimes tributários (SN, LP, LR)

---

## 1. VISÃO GERAL

O Tecnikos precisa de um módulo fiscal sólido que atenda qualquer regime tributário, pois:
- SLS Obras (cliente próprio) está estudando migração para Lucro Real
- Novos clientes podem já ser Lucro Presumido ou Lucro Real
- O sistema precisa ser flexível o suficiente para qualquer classificação

### Estudos realizados (salvos em /memory/):
1. `estudo-fiscal-sped-nfe-nfse.md` — Estudo inicial SPED + NFe + NFS-e
2. `estudo-obrigacoes-fiscais-por-regime.md` — Obrigações por regime tributário (SN, LP, LR)
3. `sped-fiscal-efd-icms-ipi.md` — EFD-ICMS/IPI detalhado com todos os registros
4. `estudo-sped-contribuicoes.md` — EFD-Contribuições (PIS/COFINS) detalhado
5. `estudo-nfse-entrada-iss-completo.md` — NFS-e entrada, ISS, parsers XML

---

## 2. GAPS IDENTIFICADOS NO SISTEMA ATUAL

### 2.1 Company — Falta regime tributário
**Atual**: Tem CNPJ, IE, IM, endereço, fiscalEnabled
**Falta**:
- `taxRegime` (SN/LP/LR) — afeta TODAS as obrigações
- `crt` (Código Regime Tributário: 1=SN, 2=SN-Excesso, 3=Normal)
- `cnae` (CNAE principal 7 dígitos)
- `suframa` (Inscrição SUFRAMA, se ZFM)
- `fiscalProfile` (Perfil EFD: A/B/C)
- `contabilistaCpf`, `contabilistaCrc`, `contabilistaCnpj`, `contabilistaCep` (para Reg 0100 do SPED)

### 2.2 NFe Parser — Não extrai campos tributários
**Atual**: Extrai apenas dados básicos (número, série, chave, emitente, itens com NCM/CFOP/valor)
**Falta extrair**:
- CST ICMS, Base ICMS, Valor ICMS
- ICMS-ST (base e valor)
- CST IPI, Valor IPI
- CST PIS, Valor PIS
- CST COFINS, Valor COFINS
- Frete, Seguro, Desconto, Outras despesas
- Modalidade BC ICMS (0=MVA, 1=Pauta, 2=Preço Tab, 3=Valor Oper)
- Alíquota ICMS, Alíquota IPI, Alíquota PIS, Alíquota COFINS
- Informações adicionais da nota
- Tipo operação (entrada/saída)
- Finalidade (1=Normal, 2=Complementar, 3=Ajuste, 4=Devolução)

### 2.3 NfeImportItem — Não tem campos fiscais
**Atual**: ncm, cfop, unit, quantity, unitPriceCents, totalCents
**Falta**:
- `cstIcms`, `baseIcmsCents`, `aliqIcms`, `icmsCents`
- `cstIpi`, `baseIpiCents`, `aliqIpi`, `ipiCents`
- `cstPis`, `basePisCents`, `aliqPis`, `pisCents`
- `cstCofins`, `baseCofinsCents`, `aliqCofins`, `cofinsCents`
- `icmsStBaseCents`, `icmsStCents`
- `freteCents`, `seguroCents`, `descontoCents`, `outrasDespCents`

### 2.4 NFS-e de Entrada — Não existe
**Atual**: Sistema só tem NFS-e de SAÍDA (emissão via Focus NFe)
**Falta**: Parser e modelos para NFS-e de ENTRADA (serviços tomados)
- Suporte a XML ABRASF 2.04
- Suporte a XML Nacional (DPS)
- Digitação manual
- Escrituração Livro de Serviços Tomados

### 2.5 Período/Apuração Fiscal — Não existe
Não existe conceito de período fiscal, apuração ICMS, apuração PIS/COFINS no sistema.

### 2.6 SPED — Não existe
Não existe gerador de arquivos SPED (EFD-ICMS/IPI nem EFD-Contribuições).

---

## 3. ARQUITETURA PROPOSTA — FASES

### FASE 1: Fundação (Prioridade Máxima)
Configuração do regime tributário e expansão dos dados fiscais.

#### 3.1.1 Company — Adicionar campos fiscais
```prisma
// Adicionar ao model Company:
taxRegime          String   @default("SN") // SN | LP | LR
crt                Int      @default(1)    // 1=SN, 2=SN-Excesso, 3=Normal
cnae               String?                 // CNAE principal
suframa            String?                 // Inscrição SUFRAMA
fiscalProfile      String   @default("A")  // A | B | C (perfil EFD)
// Contabilista (SPED Reg 0100)
contabilistName    String?
contabilistCpf     String?
contabilistCrc     String?
contabilistCnpj    String?
contabilistCep     String?
contabilistPhone   String?
contabilistEmail   String?
```

#### 3.1.2 NfeImportItem — Adicionar campos tributários
```prisma
// Adicionar ao model NfeImportItem:
cstIcms            String?
modBcIcms          Int?      // Modalidade BC (0-3)
baseIcmsCents      Int?
aliqIcms           Float?
icmsCents          Int?
cstIpi             String?
baseIpiCents       Int?
aliqIpi            Float?
ipiCents           Int?
cstPis             String?
basePisCents       Int?
aliqPis            Float?
pisCents           Int?
cstCofins          String?
baseCofinsCents    Int?
aliqCofins         Float?
cofinsCents        Int?
icmsStBaseCents    Int?
icmsStCents        Int?
freteCents         Int?
seguroCents        Int?
descontoCents      Int?
outrasDespCents    Int?
```

#### 3.1.3 NfeImport — Adicionar campos do cabeçalho
```prisma
// Adicionar ao model NfeImport:
indOper            Int?      // 0=Entrada, 1=Saída
finNfe             Int?      // 1=Normal, 2=Complementar, 3=Ajuste, 4=Devolução
codSit             String?   // 00=Regular, 01=Extemporâneo, etc.
// Totais tributários
baseIcmsCents      Int?
icmsCents          Int?
baseIcmsStCents    Int?
icmsStCents        Int?
ipiCents           Int?
pisCents           Int?
cofinsCents        Int?
freteCents         Int?
seguroCents        Int?
descontoCents      Int?
outrasDespCents    Int?
// Info complementar
infCpl             String?   // Informações complementares
xmlContent         String?   // XML completo para referência
```

#### 3.1.4 NFe Parser — Expandir extração
Expandir `nfe-parser.service.ts` para extrair TODOS os campos tributários:
- `imposto > ICMS > ICMS00/ICMS10/.../ICMSSNxxx` → CST, base, alíquota, valor
- `imposto > IPI > IPITrib/IPINT` → CST, base, alíquota, valor
- `imposto > PIS > PISAliq/PISQtde/PISNTxxx/PISOutr` → CST, base, alíquota, valor
- `imposto > COFINS > COFINSAliq/COFINSQtde/COFINSNTxxx/COFINSOutr` → CST, base, alíquota, valor
- `imposto > ICMSUFDest` → DIFAL (vBC, pFCPUFDest, pICMSUFDest, pICMSInter, pICMSInterPart)
- `total > ICMSTot` → Todos os totais
- `ide` → indOper (0/1), finNFe (1-4), indFinal
- `infAdic > infCpl` → Informações complementares

### FASE 2: NFS-e de Entrada (Prioridade Alta)

#### 3.2.1 Modelo NfseEntrada
```prisma
model NfseEntrada {
  id                String   @id @default(uuid())
  companyId         String
  // Identificação
  numero            String?  // Número da NFS-e
  codigoVerificacao String?
  dataEmissao       DateTime?
  competencia       String?  // "2026-03"
  layout            String?  // ABRASF | NACIONAL | MANUAL
  // Prestador (quem emitiu)
  prestadorId       String?  // Partner vinculado
  prestadorCnpjCpf  String?
  prestadorRazaoSocial String?
  prestadorIm       String?
  prestadorMunicipio String?  // IBGE
  prestadorUf       String?
  // Tomador (a empresa = Company)
  tomadorCnpj       String?
  // Serviço
  itemListaServico  String?  // Item LC 116 (ex: "7.02")
  codigoCnae        String?
  codigoTribMunicipio String?
  codigoTribNacional String?  // cTribNac Nacional
  discriminacao     String?
  municipioServico  String?  // IBGE
  // Valores
  valorServicosCents Int?
  valorDeducoesCents Int?
  baseCalculoCents   Int?
  aliquotaIss       Float?
  issRetido         Boolean  @default(false)
  valorIssCents     Int?
  valorPisCents     Int?
  valorCofinsCents  Int?
  valorInssCents    Int?
  valorIrCents      Int?
  valorCsllCents    Int?
  outrasRetCents    Int?
  descontoIncondCents Int?
  descontoCondCents Int?
  valorLiquidoCents Int?
  // Construção Civil
  codigoObra        String?  // CNO
  art               String?  // ART/RRT
  // Links
  financialEntryId  String?
  obraId            String?
  // XML
  xmlContent        String?
  // Controle
  status            String   @default("PENDING") // PENDING | PROCESSED | CANCELLED
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  company   Company  @relation(fields: [companyId], references: [id])

  @@index([companyId])
  @@index([companyId, status])
  @@index([prestadorCnpjCpf])
}
```

#### 3.2.2 Parser NFS-e XML
Novo service `nfse-entrada-parser.service.ts`:
- Detecção automática de layout (ABRASF vs Nacional)
- Parser ABRASF 2.04: `CompNfse > Nfse > InfNfse`
- Parser Nacional: `NFSe > infNFSe > DPS > infDPS`
- Retorna interface normalizada `ParsedNfseEntrada`
- Conversão `cTribNac` → Item LC 116

#### 3.2.3 Tela de NFS-e de Entrada
Frontend com 3 opções:
1. Upload XML (parser detecta layout automaticamente)
2. Digitação manual
3. (futuro) Busca ADN

### FASE 3: Escrituração e Relatórios (Prioridade Média)

#### 3.3.1 Período Fiscal
```prisma
model FiscalPeriod {
  id          String   @id @default(uuid())
  companyId   String
  year        Int      // 2026
  month       Int      // 1-12
  status      String   @default("OPEN") // OPEN | CLOSED | FILED
  // Resumo da apuração (preenchido ao fechar)
  totalNfeEntrada     Int?  // quantidade
  totalNfeSaida       Int?
  totalNfseEntrada    Int?
  totalNfseSaida      Int?
  // ICMS
  icmsDebitoCents     Int?
  icmsCreditoCents    Int?
  icmsSaldoCents      Int?  // positivo = a recolher
  icmsStCents         Int?
  // IPI
  ipiDebitoCents      Int?
  ipiCreditoCents     Int?
  ipiSaldoCents       Int?
  // PIS
  pisDebitoCents      Int?
  pisCreditoCents     Int?
  pisSaldoCents       Int?
  // COFINS
  cofinsDebitoCents   Int?
  cofinsCreditoCents  Int?
  cofinsSaldoCents    Int?
  // ISS
  issDevidoCents      Int?
  issRetidoCents      Int?
  // Datas
  closedAt            DateTime?
  closedByName        String?
  filedAt             DateTime?
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  company Company @relation(fields: [companyId], references: [id])

  @@unique([companyId, year, month])
}
```

#### 3.3.2 Relatórios
1. **Livro de Entradas** — NFe importadas com dados fiscais completos
2. **Livro de Serviços Tomados** — NFS-e de entrada com ISS
3. **Apuração ICMS** — Débitos e créditos do período
4. **Apuração PIS/COFINS** — Débitos e créditos (LR) ou cumulativo (LP)
5. **Dashboard Fiscal** — Resumo obrigações com prazos e alertas

### FASE 4: Geração SPED (Prioridade Futura)

#### 3.4.1 EFD-ICMS/IPI (para LP/LR contribuintes ICMS)
- Blocos: 0, C, E, H, 9 (mínimo)
- Registros: 0000, 0001, 0005, 0100, 0150, 0190, 0200, C001, C100, C170, C190, E001, E100, E110, H001, H005, H010, 9001, 9900, 9990, 9999
- Formato: ASCII ISO 8859-1, pipe-delimited, CR+LF
- Leiaute 020 (vigente 01/01/2026)

#### 3.4.2 EFD-Contribuições (para LP/LR)
- Blocos: 0, A, C, F, M, 1, 9
- LP: regime cumulativo (PIS 0,65% / COFINS 3,00%), sem créditos
- LR: regime não-cumulativo (PIS 1,65% / COFINS 7,60%), com créditos
- Registros: 0000, 0001, 0100, 0110, 0140, 0150, 0190, 0200, A001, A010, A100, A170, C001, C010, C100, C170, F001, F010, F100, M001, M100, M200, M210, M500, M600, M610, 1001, 1010, 9001, 9900, 9999

#### 3.4.3 DeSTDA (para SN contribuintes ICMS)
- Formato SEDIF-SN
- Declara: ICMS-ST, DIFAL, Antecipação
- Prazo: dia 28 do mês subsequente

---

## 4. OBRIGAÇÕES POR REGIME — RESUMO

### Simples Nacional (SN)
| Obrigação | Status no Sistema |
|-----------|-------------------|
| PGDAS-D | Fora do escopo (Portal SN) |
| DEFIS | Fora do escopo (Portal SN) |
| DAS | Fora do escopo (Portal SN) |
| DeSTDA | FASE 4 |
| NFS-e saída | ✅ IMPLEMENTADO (Focus NFe) |
| NFS-e entrada | FASE 2 |
| NFe entrada | ✅ IMPLEMENTADO (SEFAZ DFe) |
| Livro Entradas | FASE 3 |
| Livro Serv. Tomados | FASE 3 |
| EFD ICMS/IPI | DISPENSADO |
| EFD-Contribuições | DISPENSADO |

### Lucro Presumido (LP)
| Obrigação | Status no Sistema |
|-----------|-------------------|
| NFS-e saída | ✅ IMPLEMENTADO |
| NFS-e entrada | FASE 2 |
| NFe entrada | ✅ IMPLEMENTADO (parser precisa expandir - FASE 1) |
| EFD ICMS/IPI | FASE 4 (se contribuinte ICMS) |
| EFD-Contribuições | FASE 4 (cumulativo) |
| Livro Entradas | FASE 3 |
| Apuração IRPJ/CSLL | Fora do escopo (contabilidade) |
| DCTFWeb | Fora do escopo (eSocial/EFD-Reinf) |

### Lucro Real (LR)
| Obrigação | Status no Sistema |
|-----------|-------------------|
| Tudo do LP + | — |
| EFD ICMS/IPI | FASE 4 (obrigatório) |
| EFD-Contribuições | FASE 4 (não-cumulativo, com créditos) |
| LALUR/LACS | Fora do escopo (ECF/contabilidade) |
| Controle créditos PIS/COFINS | FASE 4 |

---

## 5. PLANO DE IMPLEMENTAÇÃO DETALHADO

### FASE 1: Fundação (Estimativa: 1-2 sessões)

**Backend:**
1. Migration Prisma — adicionar campos a Company, NfeImport, NfeImportItem
2. Expandir `nfe-parser.service.ts` — extrair todos os campos tributários
3. Atualizar `nfe.service.ts` — salvar campos expandidos no import/process
4. Endpoint `PATCH /company/fiscal-config` — salvar regime tributário
5. Endpoint `GET /company/fiscal-config` — retornar config fiscal
6. Seed regime para Company existente (SLS Obras = SN)

**Frontend:**
1. Página Configurações Fiscais (`/settings/fiscal`) — adicionar seção de regime tributário
2. Visualização expandida na NFe — mostrar dados tributários importados

**Arquivos a modificar:**
- `backend/prisma/schema.prisma`
- `backend/src/nfe/nfe-parser.service.ts`
- `backend/src/nfe/nfe.service.ts`
- `backend/src/company/company.service.ts` (ou controller)
- `frontend/src/app/(dashboard)/settings/fiscal/page.tsx`
- `frontend/src/app/(dashboard)/nfe/page.tsx`

### FASE 2: NFS-e de Entrada (Estimativa: 2-3 sessões)

**Backend:**
1. Migration — criar model NfseEntrada
2. Novo service `nfse-entrada-parser.service.ts` — parser dual ABRASF + Nacional
3. Novo service `nfse-entrada.service.ts` — CRUD + lógica de importação
4. Novo controller `nfse-entrada.controller.ts` — endpoints REST
5. Novo module `nfse-entrada.module.ts`

**Frontend:**
1. Nova página `/nfe/entrada-servicos` (ou tab na NFe existente)
2. Upload XML com detecção automática
3. Formulário de digitação manual
4. Listagem com filtros e paginação
5. Wizard de vinculação (prestador ↔ Partner)

**Endpoints:**
- `POST /nfse-entrada/upload-xml` — upload e parse
- `POST /nfse-entrada/manual` — digitação manual
- `GET /nfse-entrada` — listagem com filtros
- `GET /nfse-entrada/:id` — detalhe
- `POST /nfse-entrada/:id/process` — processar (vincular prestador, criar financeiro)
- `DELETE /nfse-entrada/:id` — cancelar

### FASE 3: Escrituração e Relatórios (Estimativa: 2 sessões)

**Backend:**
1. Migration — criar model FiscalPeriod
2. Service `fiscal-period.service.ts` — CRUD, fechamento, reabertura
3. Service `fiscal-report.service.ts` — geração relatórios
4. Endpoints relatórios

**Frontend:**
1. Página `/fiscal/periodos` — listar/fechar períodos fiscais
2. Página `/fiscal/livro-entradas` — relatório Livro de Entradas
3. Página `/fiscal/servicos-tomados` — relatório Serviços Tomados
4. Página `/fiscal/apuracao` — dashboard de apuração ICMS/PIS/COFINS
5. Links no sidebar para role FISCAL

### FASE 4: Geração SPED (Estimativa: 3-4 sessões)

**Backend:**
1. Service `sped-icms-ipi-generator.service.ts` — gera arquivo EFD-ICMS/IPI
2. Service `sped-contribuicoes-generator.service.ts` — gera arquivo EFD-Contribuições
3. Endpoints de geração e download

**Frontend:**
1. Página `/fiscal/sped` — selecionar período, tipo, gerar e baixar arquivo
2. Validação prévia (verificar dados obrigatórios antes de gerar)
3. Histórico de arquivos gerados

---

## 6. REGRAS POR REGIME — PARA LÓGICA DO SISTEMA

### Ao importar NFe de ENTRADA:

| Campo/Ação | SN | LP | LR |
|---|---|---|---|
| Extrair dados tributários | Informativo | Obrigatório | Obrigatório |
| Crédito ICMS | NÃO | SIM (se contrib. ICMS) | SIM |
| Crédito IPI | NÃO | NÃO | SIM |
| Crédito PIS | NÃO | NÃO | SIM (não-cumulativo) |
| Crédito COFINS | NÃO | NÃO | SIM (não-cumulativo) |
| CST entrada PIS/COFINS | 99 | 70 (sem crédito) | 50 (com crédito) |
| Escrituração | Livro Entradas (informativo) | EFD ICMS/IPI + EFD-Contrib | EFD ICMS/IPI + EFD-Contrib |

### Ao emitir NFS-e de SAÍDA:

| Campo | SN | LP | LR |
|---|---|---|---|
| ISS | Incluído no DAS (Anexo III/IV/V) | 2-5% separado | 2-5% separado |
| PIS | Incluído no DAS | 0,65% cumulativo | 1,65% não-cumulativo |
| COFINS | Incluído no DAS | 3,00% cumulativo | 7,60% não-cumulativo |
| IRPJ | Incluído no DAS | Base presunção 8% ou 32% | Lucro contábil ajustado |
| CSLL | Incluído no DAS | Base presunção 12% ou 32% | Lucro contábil ajustado |

### Construção Civil (SLS Obras):

| Regime | ISS | PIS | COFINS | IRPJ | CSLL | CPP |
|---|---|---|---|---|---|---|
| SN (Anexo IV) | No DAS | No DAS | No DAS | No DAS | No DAS | **Separado** (GPS/DARF) |
| LP (empreitada total) | 2-5% | 0,65% | 3,00% | 8% presunção | 12% presunção | INSS normal |
| LP (só mão de obra) | 2-5% | 0,65% | 3,00% | 32% presunção | 32% presunção | INSS normal |
| LR | 2-5% | 1,65% c/ créditos | 7,60% c/ créditos | Lucro real | Lucro real | INSS normal |

---

## 7. CONSIDERAÇÕES TÉCNICAS

### 7.1 Encoding SPED
- EFD-ICMS/IPI: ASCII ISO 8859-1 (Latin-1)
- EFD-Contribuições: ASCII ISO 8859-1 (Latin-1)
- Delimitador: `|` (pipe, char 124)
- Terminador: CR+LF
- Datas: ddmmaaaa
- Valores: sem separador milhar, vírgula decimal
- Alíquotas: 4 casas decimais

### 7.2 NFS-e Entrada — Detecção Layout
```typescript
function detectNfseLayout(xml: string): 'ABRASF' | 'NACIONAL' | 'UNKNOWN' {
  if (xml.includes('sped.fazenda.gov.br/nfse') || xml.includes('<NFSe><infNFSe>')) return 'NACIONAL';
  if (xml.includes('<CompNfse>') || xml.includes('<Nfse>')) return 'ABRASF';
  if (xml.includes('<infDPS>') || xml.includes('<cTribNac>')) return 'NACIONAL';
  return 'UNKNOWN';
}
```

### 7.3 Conversão cTribNac → Item LC 116
```typescript
function cTribNacToLC116(code: string): string {
  // cTribNac: "070200000" → LC 116: "7.02"
  const grupo = parseInt(code.substring(0, 2));
  const subitem = parseInt(code.substring(2, 4));
  return `${grupo}.${String(subitem).padStart(2, '0')}`;
}
```

### 7.4 Reforma Tributária 2026
- CBS (0,9%) e IBS (0,1%) são INFORMATIVOS em 2026
- Campos devem existir na NFS-e mas sem recolhimento efetivo
- EFD ICMS/IPI: NÃO incluir CBS/IBS no VL_DOC (C100)
- PIS/COFINS seguem vigentes em 2026, extinção prevista 2027

### 7.5 ISS Retenção na Construção Civil
- Item LC 116/2003 art. 6°, inciso II: subitem 7.02 (construção civil) → tomador RETÉM
- Tomador retém ISS e recolhe via guia municipal
- No SN: ISS retido é segregado do DAS (prestador não paga ISS no DAS)
- Alíquota: usar da NFS-e; se omitida, reter 5%
- Mínima: 2% (Art. 8°-A, LC 157/2016)
- Máxima: 5% (Art. 8°)

---

## 8. PRIORIDADE DE EXECUÇÃO

| # | Fase | Impacto | Complexidade | Dependência |
|---|------|---------|-------------|-------------|
| 1 | Regime tributário na Company | ALTO | BAIXA | Nenhuma |
| 2 | Expandir NFe parser (campos tributários) | ALTO | MÉDIA | Fase 1 |
| 3 | NFS-e de entrada (upload XML + manual) | ALTO | ALTA | Fase 1 |
| 4 | Período fiscal + fechamento | MÉDIO | MÉDIA | Fases 1-3 |
| 5 | Relatórios fiscais (Livro Entradas, Serv. Tomados) | MÉDIO | MÉDIA | Fases 1-3 |
| 6 | Dashboard fiscal (obrigações + prazos) | MÉDIO | BAIXA | Fase 4 |
| 7 | Gerador EFD-ICMS/IPI | ALTO (LP/LR) | ALTA | Fases 1-5 |
| 8 | Gerador EFD-Contribuições | ALTO (LP/LR) | ALTA | Fases 1-5 |
| 9 | DeSTDA (SN) | BAIXO | MÉDIA | Fases 1-3 |
| 10 | Integração ADN (NFS-e) | BAIXO | ALTA | Fase 3 |
