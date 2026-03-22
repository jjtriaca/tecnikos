# TAREFA ATUAL

## Versao: v1.06.69
## Ultima sessao: 155 (22/03/2026)

## Pendencias

### A FAZER (proxima sessao)
- **Resumo tempo na OS detail**: Bloco com deslocamento, execução, pausas, fora expediente, total
- **Relatório técnico**: Adicionar coluna pausas + fora expediente + overtime calc
- **calcOvertimeMinutes**: Helper server-side para calcular tempo fora do horário comercial
- **Feature 2 Frontend**: Form de serviço — máscaras R$ e % nos campos existentes
- **OS Detail**: Banner "Retorno de OS-XXXXX" quando parentOrderId existe
- **Remover checkbox isReturn**: Substituir por banner automático quando returnFrom

### PENDENTE VALIDACAO
- **Modal de Aprovação**: Testar fluxo completo (estrelas → modal → financeiro → APROVADA)
- **Botão Retorno**: Testar na lista de OS com OS em status terminal
- **Relatório técnico**: Testar com múltiplas OS e diferentes técnicos
- **Toggles sistema**: Testar todos os toggles da tela Configurações > Sistema
- **Horário comercial**: Verificar se salva fuso + turnos em Configurações > Geral
- **Valor fixo técnico**: Testar no cadastro de serviço (fixo + % + regra)

### CONCLUIDO (sessao 155)

#### Migration & Schema
- `parentOrderId` no ServiceOrder (self-relation)
- `techFixedValueCents` + `commissionRule` no Service e ServiceOrderItem
- `systemConfig Json?` no Company
- `timezone` + `businessHours` no Company
- Enum `CommissionRule`: COMMISSION_ONLY, FIXED_ONLY, HIGHER, LOWER

#### Backend
- `resolveCommission()` helper (fixo vs % vs regra)
- `POST /service-orders/:id/approve-and-finalize` (eval + financeiro + APROVADA)
- `GET/PATCH /companies/system-config` (toggles do sistema)
- `GET /reports/technician-detail` (relatório detalhado do técnico)
- Service DTOs: techFixedValueCents, commissionRule, parentOrderId
- Company: timezone, businessHours nos ALLOWED_FIELDS

#### Frontend
- **ApprovalConfirmModal**: Preview financeiro + vencimento editável
- **Tela Sistema**: Configurações > Sistema com toggles organizados (OS, Financeiro, Notificações, Avaliação)
- **Horário Comercial**: Configurações > Geral com fuso horário + turnos dinâmicos
- **Valor fixo técnico**: Campo no cadastro de serviço + regra de comissão
- **Botão Retorno**: Dropdown na lista de OS
- **Relatório do Técnico**: Filtros + cards resumo + tabela detalhada + CSV
- **Lightbox fotos**: Clique para expandir
- **Timeline enriquecido**: Dados inline por tipo de bloco
- **Historico unificado**: Relatório compacto com colunas

### BLOQUEADO
- (nenhum)
