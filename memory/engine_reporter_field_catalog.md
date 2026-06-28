---
name: engine-reporter-field-catalog
description: EngineReporter — catálogo de campos (bíblia) por ORIGEM de relatório + modelo de dados real. Ler antes de mexer no catálogo.
metadata:
  type: reference
---

# EngineReporter — Catálogo de campos (a "bíblia") + modelo de dados

**Princípio (decisão do Juliano, 28/06):** o relatório é gerado a partir de UMA **origem** (um documento). TODOS os campos — inclusive **Cliente/Fornecedor** e **Empresa** — ficam **aninhados dentro da origem**, porque é dela que o sistema sabe de onde puxar o dado (o cliente DAQUELE orçamento/OS/conta). Hierarquia: **ORIGEM > SUBGRUPO > campos**. Arquivo: `frontend/src/components/pool/report/reportFieldCatalog.ts` (extensível — só acrescentar). UI: `ReportFieldLibrary.tsx` (aba "Campos", acordeão 1-origem-aberta + busca + "+"). Tokens do documento são por origem (`{budgetCode}` vs `{quoteCode}` vs `{osCode}` vs `{finCode}`); tokens de Cliente/Empresa são compartilhados (`{clientName}`, `{companyName}`…), resolvidos pela relação do doc ligado.

## Origens (documentos reais do Prisma) e seus models
| Origem (UI) | Model Prisma | Obs |
|---|---|---|
| Orçamentos de Serviços | `Quote` (code ORC-) | status RASCUNHO/ENVIADO/APROVADO/… |
| **Orçamentos de Obras (Piscina)** | `PoolBudget` (code ORCP-) | **DADOS REAIS hoje** (BudgetReportData). dimensões, seções, heating/solar report |
| Ordem de Serviço | `ServiceOrder` (code OS-) | técnico (assignedPartner), serviceDescription/materialsUsed |
| Contas a Receber | `FinancialEntry` type=RECEIVABLE (FIN-) | partner=cliente |
| Contas a Pagar | `FinancialEntry` type=PAYABLE | partner=fornecedor |

## Entidades compartilhadas (aninhadas em quase toda origem)
- **Partner** (`Partner`, code PAR-): name, tradeName, document(+documentType CPF/CNPJ), phone, email, cep, addressStreet, addressNumber, addressComp, neighborhood, city, state. partnerTypes[CLIENTE/FORNECEDOR/TECNICO], personType PF/PJ. Relaciona com Quote/PoolBudget/ServiceOrder/FinancialEntry (clientPartner) e ServiceOrder.assignedPartner (técnico).
- **Company** (`Company`, 1 por tenant): name(razão), tradeName(fantasia), cnpj, ie, im, phone, email, logoUrl(+w/h), cep+endereço, city, state, ownerName/ownerCpf/ownerPhone/ownerEmail, taxRegime/crt/cnae.

## Campos-chave por origem (resumo; ver schema p/ tudo)
- **Quote:** code, title, description, status, validityDays, expiresAt, discountCents/Percent, subtotalCents, totalCents, termsConditions; items(QuoteItem: type SERVICE/PRODUCT/LABOR, description, unit, quantity, unitPriceCents, totalCents).
- **PoolBudget:** code, title, status, validityDays, subtotalCents/discountCents/taxesCents/totalCents, poolDimensions(JSON length/width/depth/area/perimeter/volume/type/hasSpa/…), environmentParams(JSON), equipmentWarranty, workWarranty, paymentTerms, sectionOrder[], heatingReport(JSON), items(PoolBudgetItem: poolSection, kind, slotName, description, qty, unitPriceCents, totalCents, productId/serviceId).
- **ServiceOrder:** code, title, description, status, addressText(+campos), valueCents, deadlineAt/startedAt/completedAt, clientPartner, assignedPartner(técnico), serviceDescription, materialsUsed, items(ServiceOrderItem).
- **FinancialEntry:** code, type RECEIVABLE/PAYABLE, status PENDING/CONFIRMED/PAID/CANCELLED/SPLIT, description, grossCents/netCents/commissionCents, dueDate/paidAt/confirmedAt, paymentMethod, financialAccount(plano de contas), partner, serviceOrder, obra, installments(FinancialInstallment).
- **Obra** (`Obra`): name, cno, endereço, partner(dono). Liga ServiceOrder/FinancialEntry/NFS-e.

## Resolução de tokens (render)
- `resolvePlaceholders` (BudgetReport.tsx) resolve hoje os do **PoolBudget** (BudgetReportData): {budgetCode/Title/Date/Total/Subtotal/Discount/Taxes}, {clientName/Document/City}, {pool*}, {validityDays}, {paymentTerms}, {termsConditions}, {equipmentWarranty}, {workWarranty}, {date}.
- Tokens fora do BudgetReportData (clientPhone/email/endereço, company*, quote*/os*/fin*) **inserem o token literal** até a fonte de dados de cada origem ser ligada (futuro: cada origem precisa de um provider que monte o data-context). Estrutura do catálogo é a final — não refazer.
