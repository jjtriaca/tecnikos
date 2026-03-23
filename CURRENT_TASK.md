# TAREFA ATUAL

## Versao: v1.06.92
## Ultima sessao: 155 (22/03/2026)

## PROXIMA SESSAO — PRIORIDADES

### 1. Enriquecer Bloco GPS (Opção 2 — Etapas Configuráveis)
Adicionar ao editor do bloco GPS (modo contínuo) uma seção de etapas de escalonamento:
```
📍 GPS Contínuo
├── Intervalo online: [5] segundos
├── 🔋 Etapas de economia (offline):
│   ┌──────────────┬───────────┬──────────┐
│   │ Até (metros) │ Intervalo │ Precisão │
│   ├──────────────┼───────────┼──────────┤
│   │ 500          │ 30s       │ Alta     │
│   │ 2000         │ 2min      │ Baixa    │
│   │ 10000        │ 5min      │ Baixa    │
│   │ ∞            │ 10min     │ Baixa    │
│   └──────────────┴───────────┴──────────┘
│   [+ Adicionar etapa]
└── Alta precisão online: [ON/OFF]
```

**Arquivos a modificar:**
- `frontend/src/types/workflow-blocks.ts` — GpsConfig type + defaults
- `frontend/src/app/(dashboard)/workflow/editor/WorkflowProperties.tsx` — UI tabela de etapas
- `frontend/src/app/tech/orders/[id]/page.tsx` — ler etapas do config em vez de hardcoded

**Config JSON esperado:**
```json
{
  "trackingMode": "continuous",
  "onlineIntervalSeconds": 5,
  "highAccuracyOnline": true,
  "offlineSteps": [
    { "maxDistanceM": 500, "intervalSeconds": 30, "highAccuracy": true },
    { "maxDistanceM": 2000, "intervalSeconds": 120, "highAccuracy": false },
    { "maxDistanceM": 10000, "intervalSeconds": 300, "highAccuracy": false },
    { "maxDistanceM": null, "intervalSeconds": 600, "highAccuracy": false }
  ]
}
```

### 2. Auditoria de Funcionalidades (garantir que nada está fantasma)
- Verificar TODOS os toggles do sistema estão realmente sendo lidos e aplicados
- Verificar se endpoints de pausa/resume/incident funcionam no PWA
- Verificar se approve-and-finalize cria financeiro corretamente
- Verificar se resolveCommission usa techFixedValueCents + commissionRule
- Testar retorno de OS (botão + pre-fill + parentOrderId)
- Testar relatório técnico no PWA
- Verificar offline: advance + GPS + fotos sincronizam ao reconectar

### 3. CLT Fase 2 (quando toggle ativado)
- Alertas no PWA: banner 4h sem pausa refeição
- Alertas no PWA: banner 8h de jornada
- Push pro gestor nos alertas
- Verificar intervalo interjornada (11h)

## BUGS CORRIGIDOS (sessão 155)
- ✅ system-config 403 para técnico (GET liberado)
- ✅ OS concluída na lista (filtro completedAt em vez de createdAt)
- ✅ Retry automático em 5xx (techApi retry após 2s)
- ✅ GPS inteligente (escalonamento por distância + online/offline)
- ✅ Card jornada CLT só aparece com toggle ativado
- ✅ Botões pausa/ocorrência reposicionados acima do nav bar

## PENDENTE VALIDACAO (checklist completo em CHECKLIST_SESSAO_155.md)
- Modal de Aprovação + financeiro
- Botão/Banner Retorno de OS
- Toggles sistema (verificar se todos funcionam de verdade)
- Valor fixo técnico + regra comissão
- Resumo tempo na OS detail
- Botão Pausa + Ocorrência no PWA
- Relatório técnico (gestor + PWA)
- GPS offline + timestamp exato
- Formatação moeda em todo o sistema

## CONCLUIDO (sessao 155)

### Deploys: v1.06.55 → v1.06.92 (38 deploys)

#### Melhorias PWA
- Timestamp exato (clientTimestamp em WorkflowStepLog + ServiceOrderEvent)
- Botão Pausa flutuante + bottom sheet + confirmação + motivos
- Relatar Ocorrência (botão + modal + push + evento INCIDENT_REPORTED)
- GPS Offline (IndexedDB + escalonamento inteligente por distância + sync)
- Relatório do Técnico no PWA (meus serviços sem valores financeiros)
- Jornada CLT Fase 1 (WorkDay model + toggles + PWA card condicional)
- GPS Smart Interval (5s online, 30s-10min offline escalonado)

#### Dashboard + OS Detail
- Bloco MATERIALS + Timeline enriquecido + Histórico unificado compacto
- Avaliação após fotos + status APROVADA + eventos pós-workflow
- Lightbox fotos + Resumo tempo (deslocamento/execução/pausas/total)
- Banner retorno de OS + retornos criados + parentOrderId

#### Regras de Comissão + Financeiro
- resolveCommission (fixo vs % vs regra HIGHER/LOWER/FIXED/COMMISSION)
- approve-and-finalize (eval + financeiro + APROVADA em 1 tx)
- ApprovalConfirmModal (preview financeiro + vencimento editável)
- Valor fixo técnico + regra comissão no cadastro de serviço
- Modal valor zero inteligente (mostra A Pagar quando tem fixo do técnico)
- Máscaras R$ e % em todo o sistema (serviços, produtos, financeiro)

#### Relatório do Técnico (Gestor)
- Filtros + cards + tabela + CSV + toggle "Valor OS"
- calcOvertimeMinutes (baseado no horário comercial + fuso)
- Breakdown: deslocamento, execução, pausas, fora expediente

#### Configurações
- Tela Sistema: toggles OS, Financeiro, Notificações, Avaliação, Jornada CLT
- Horário Comercial + fuso horário (turnos dinâmicos)
- Retorno OS (botão lista + parentOrderId + banner + pre-fill)
- DateTimePicker compacto + prazo default amanhã 17:00
- Toggle permitir OS valor zero + CurrencyInput component

#### UX Fixes
- Formatação moeda onBlur em todo sistema
- Dropdown overflow fix (CollapsibleSection)
- Botões pausa/ocorrência acima nav bar
- Coluna "Valor Téc." nos itens da OS
- system-config acessível para técnico
- Filtro concluídas por completedAt
- Retry automático 5xx

### PENDENCIAS FUTURAS
- Cadastro Parceiros: tratamento de empresas com filiais (como vincular CNPJ matriz/filial)

### BLOQUEADO
- (nenhum)
