# AUDITORIA COMPLETA — Sistema de Fluxos de Atendimento
**Data**: 2026-03-14 | **Versao**: v1.02.85 | **Analista**: Claude

---

## 1. GATILHOS FANTASMAS (Frontend existe, backend NAO despacha)

### ❌ CRITICO — Gatilhos que NAO funcionam:

| Trigger | Frontend | Backend | Status |
|---------|----------|---------|--------|
| `quote_request_created` (Solicitacao de orcamento) | ✅ TRIGGER_OPTIONS[3] | ❌ quote.service NUNCA chama dispatchAutomation | **MORTO** |
| `quote_created` (Orcamento criado) | ✅ TRIGGER_OPTIONS[4] | ❌ quote.service NUNCA chama dispatchAutomation | **MORTO** |
| `partner_client_created` (Cliente criado) | ✅ TRIGGER_OPTIONS[5] + ClientOnboardingSection | ❌ partner.service NAO tem dispatchClientContract | **UI EXISTE, BACKEND NAO** |
| `partner_supplier_created` (Fornecedor criado) | ✅ TRIGGER_OPTIONS[8] + SupplierOnboardingSection | ❌ partner.service NAO tem dispatchSupplierContract | **UI EXISTE, BACKEND NAO** |

### ⚠️ ALERTA — Mecânica diferente do esperado:

| Trigger | Como o usuario PENSA que funciona | Como REALMENTE funciona |
|---------|-----------------------------------|------------------------|
| `partner_tech_created` | "O fluxo com esse gatilho vai disparar" | `dispatchTechnicianContract()` procura QUALQUER workflow com `technicianOnboarding.enabled=true` — IGNORA o trigger ID |
| `partner_spec_added` | "O fluxo com esse gatilho vai disparar" | Mesma funcao — procura QUALQUER workflow com `technicianOnboarding.onNewSpecialization.enabled=true` |

**Implicacao**: Se o usuario cria 2 workflows (um com trigger "Tecnico criado" e outro com "Nova especializacao"), o sistema vai usar SEMPRE o PRIMEIRO que encontrar com onboarding ativo (ordenado por isDefault DESC). O trigger selecionado e ignorado.

### ✅ Gatilhos que FUNCIONAM:

| Trigger | Evento backend | Mecanismo |
|---------|---------------|-----------|
| `os_created` | `eventType: 'created'` | ✅ automation-engine.dispatch() |
| `os_return_created` | `eventType: 'return_created'` | ✅ automation-engine.dispatch() |
| `os_urgent_created` | `eventType: 'urgent_created'` | ✅ automation-engine.dispatch() |

**NOTA**: Os 3 triggers de OS funcionam via automation-engine, que compara `trigger.entity === event.entity && trigger.event === event.eventType`. Mas tem um PROBLEMA: o workflow template NAO e uma automation rule — e um workflow template. O automation-engine procura AutomationRule, nao WorkflowTemplate.

**PERGUNTA CRITICA**: Como os workflows com triggers de OS sao realmente ativados? O workflow-engine.service.ts tem `attachDefaultWorkflow()` que e chamado ao criar uma OS — mas esse metodo busca pelo workflow DEFAULT (isDefault=true), nao pelo trigger. Entao o trigger tambem seria ignorado para OS?

---

## 2. BLOCOS DO WORKFLOW — Status de Implementacao

### Processados pelo Workflow Engine (`workflow-engine.service.ts`):

| Bloco | Tipo | Status | O que faz |
|-------|------|--------|-----------|
| STATUS | System | ✅ COMPLETO | Muda status da OS, seta timestamps |
| FINANCIAL_ENTRY | System | ✅ COMPLETO | Cria lancamentos financeiros via FinanceService |
| NOTIFY | System | ✅ COMPLETO | Envia mensagens WhatsApp/Email/SMS com substituicao de 20+ variaveis |
| ALERT | System | ✅ COMPLETO | Cria notificacao no sistema com severidade |
| WEBHOOK | System | ✅ COMPLETO | HTTP POST para URL externa (10s timeout) |
| ASSIGN_TECH | System | ✅ COMPLETO | Auto-atribui por BEST_RATING ou LEAST_BUSY |
| DUPLICATE_OS | System | ✅ COMPLETO | Cria copia da OS com status ABERTA |
| WAIT_FOR | System | ✅ COMPLETO | Pausa workflow ate evento ou timeout |
| STEP | Actionable | ✅ COMPLETO | Tecnico executa etapa (foto/nota/GPS opcionais) |
| PHOTO | Actionable | ✅ COMPLETO | Tecnico tira foto |
| NOTE | Actionable | ✅ COMPLETO | Tecnico escreve observacao |
| GPS | Actionable | ✅ COMPLETO | Captura localizacao GPS |
| QUESTION | Actionable | ✅ COMPLETO | Pergunta com opcoes de resposta |
| CHECKLIST | Actionable | ✅ COMPLETO | Lista de itens para marcar |
| SIGNATURE | Actionable | ✅ COMPLETO | Coleta assinatura digital |
| FORM | Actionable | ✅ COMPLETO | Formulario customizado |
| CONDITION | Actionable | ✅ COMPLETO | Bifurcacao SIM/NAO |
| ARRIVAL_QUESTION | Actionable | ✅ COMPLETO | Pergunta ETA ao tecnico |

### Processados pela Public-Offer Service (lê config diretamente dos blocos):

| Bloco | Status | O que faz |
|-------|--------|-----------|
| PROXIMITY_TRIGGER | ✅ COMPLETO | GPS tracking, deteccao de raio, notificacoes, auto-start execucao |
| PAUSE_SYSTEM | ✅ COMPLETO | Controle de pausas com motivos e notificacoes |
| PHOTO_REQUIREMENTS | ✅ COMPLETO | Fotos por momento (before_start, after_completion, on_pause, on_resume) |

### ⚠️ STUBS (Frontend configura, backend so faz log):

| Bloco | Status | O que acontece |
|-------|--------|----------------|
| DELAY | ⚠️ LOG ONLY | `console.log("⏳ System block: DELAY X minutes (logged only)")` — NAO agenda nada |
| SLA | ⚠️ LOG ONLY | `console.log("⏱️ System block: SLA X minutes (logged only)")` — NAO fiscaliza |
| RESCHEDULE | ⚠️ LOG ONLY | `console.log("📅 System block: RESCHEDULE (logged only)")` — NAO reagenda |

### ❌ NAO IMPLEMENTADOS (Frontend compila, ninguem processa):

| Bloco | Frontend | Backend |
|-------|----------|---------|
| TECH_REVIEW_SCREEN | ✅ Compilado para V2 | ❌ Nenhum servico le ou processa |
| SCHEDULE_CONFIG | ✅ Compilado para V2 | ❌ Nenhum servico le (frontend le direto do workflow, mas engine ignora) |
| EXECUTION_TIMER | ✅ Compilado para V2 | ❌ Nenhum servico processa |
| GESTOR_APPROVAL | ✅ Compilado para V2 | ❌ Nenhum servico processa (frontend pode ler direto, mas nao confirmado) |
| MATERIALS | ✅ Compilado para V2 | ❌ Nenhum servico processa o bloco |

---

## 3. ORDEM DOS CAMPOS — Analise de Logica Linear

### Fluxo real-world (como um atendimento progride):

```
OS Criada → Tecnico Selecionado → Ofertada → Aceita → Atribuida → A Caminho → Chega → Em Execucao → Conclui → Aprovada
```

### ABERTA — Ordem ATUAL no StageSection:

```
1. 🎯 Selecao de tecnicos (techSelection)
2. 👁️ Tela de revisao (techReviewScreen)
3. 💬 Disparo de mensagens (messageDispatch)
4. ❓ Pergunta para o tecnico (techQuestion)
5. 📅 Regime de Agenda CLT (scheduleConfig)
6. 🔔 Alerta
7. 🔗 Webhook
```

**PROBLEMA DE ORDEM**: O `scheduleConfig` (item 5) deveria estar no TOPO, antes de tudo. Se o fluxo e por agenda, a selecao de tecnicos (item 1) nao faz sentido — o tecnico e escolhido direto na agenda. A logica linear seria:

```
SUGESTAO — Ordem corrigida ABERTA:
1. 📅 Regime de Atendimento (agenda vs fluxo automatico) ← PRIMEIRO
2. 🎯 Selecao de tecnicos ← so visivel se NAO agenda
3. 👁️ Tela de revisao ← so visivel se techSelection ativo
4. ❓ Pergunta para o tecnico ← so visivel se techSelection ativo
5. 💬 Disparo de mensagens ← SEMPRE (notificar apos selecao)
6. 🔔 Alerta
7. 🔗 Webhook
```

### ATRIBUIDA — Ordem ATUAL:

```
ACOES AUTOMATICAS:
1. Pergunta de tempo estimado (arrivalQuestion) ← BOM, mas aparece muito acima
2. Rastreamento por proximidade (proximityTrigger) ← NAO faz sentido aqui! E A_CAMINHO
3. Notificacoes simples (gestor, tecnico, cliente)
4. Alerta, Webhook

ACOES DO TECNICO:
5. Step, Photo, Note, GPS, Checklist, Form, Signature, Question

CONTROLE DE TEMPO:
6. SLA, Wait For, Delay
```

**PROBLEMA**: `proximityTrigger` aparece na ATRIBUIDA mas so faz sentido no A_CAMINHO (quando o tecnico esta no trajeto). No StageSection.tsx, a condicao e `stage.status === 'A_CAMINHO'`, entao CORRETO — so aparece na etapa certa. Mas a `arrivalQuestion` aparece na ATRIBUIDA, o que faz sentido (o tecnico acabou de aceitar e informa o ETA).

### A_CAMINHO — Ordem ATUAL:

```
ACOES AUTOMATICAS:
1. Rastreamento por proximidade (proximityTrigger) ← CORRETO
2. Notificacoes simples
3. Alerta, Webhook

ACOES DO TECNICO:
4. Step, Photo, Note, GPS, Checklist, Form, Signature, Question

CONTROLE DE TEMPO:
5. SLA, Wait For, Delay
```

**PROBLEMA**: Nesta etapa, as acoes do tecnico (step, photo, note) nao fazem muito sentido — o tecnico esta no trajeto, nao executando servico. A unica acao razoavel seria GPS (compartilhar localizacao). As demais poluem a interface.

### EM_EXECUCAO — Ordem ATUAL:

```
ACOES AUTOMATICAS:
1. Notificacoes simples
2. Alerta, Webhook

ACOES DO TECNICO:
3. Step (atividade principal)
4. Fotos por momento (photoRequirements — multi-grupo)
5. Note
6. GPS
7. Checklist
8. Form
9. Materiais ← BOM, so EM_EXECUCAO
10. Signature
11. Question ← PROBLEMA: e diferente da techQuestion da ABERTA (sem acoes automaticas)

CONTROLE DE TEMPO:
12. SLA ← ⚠️ STUB — so faz log
13. Wait For
14. Delay ← ⚠️ STUB — so faz log
15. Cronometro de execucao (executionTimer) ← BOM, so EM_EXECUCAO
16. Sistema de pausas (pauseSystem) ← BOM, so EM_EXECUCAO
```

**PROBLEMAS DE ORDEM**:
- `executionTimer` e `pauseSystem` devem ficar JUNTOS (ambos sao controle de tempo de execucao)
- `SLA` esta separado do `executionTimer` mas sao complementares
- `Materiais` deveria ficar apos `Step` e `Photo` (logica: executa → documenta → registra materiais → assina)

### CONCLUIDA — Ordem ATUAL:

```
ACOES AUTOMATICAS:
1. Notificacoes simples
2. Aprovacao do gestor (gestorApproval) ← CORRETO, so CONCLUIDA
3. Lancamento financeiro ← CORRETO (apos aprovacao)
4. Alerta, Webhook

ACOES DO TECNICO:
5. Note, GPS, Checklist, Form, Signature, Question

CONTROLE DE TEMPO:
6. SLA, Wait For, Delay
```

**PROBLEMA DE ORDEM**:
- `gestorApproval` deveria ser a PRIMEIRA coisa — e o portao de entrada da etapa
- `financialEntry` deveria ser APOS aprovacao (na logica: gestor aprova → sistema lanca financeiro)
- Isso ja e a ordem atual, entao esta OK

---

## 4. COMBINACOES PERIGOSAS

### ❌ Conflitos diretos:

| Combo | Problema | Sugestao |
|-------|----------|----------|
| `techSelection` + `scheduleConfig` na ABERTA | Ambos ativados: techSelection auto-seleciona, scheduleConfig espera escolha manual na agenda | Tornar mutuamente exclusivos |
| `assignTech` simples + `techSelection` rico na ABERTA | Ambos fazem atribuicao automatica com estrategias diferentes | techSelection ja sobrescreve assignTech — remover assignTech da UI |
| `financialEntry` na CONCLUIDA + na APROVADA | Dois lancamentos iguais criados (duplicata) | Ja tem aviso no frontend — deveria bloquear |
| `SLA` ativado pelo usuario | Usuario configura achando que vai funcionar — e STUB | Remover ou colocar "(em breve)" |
| `DELAY` ativado pelo usuario | Mesmo problema — STUB | Remover ou colocar "(em breve)" |

### ⚠️ Combinacoes confusas:

| Combo | Confusao |
|-------|----------|
| `techQuestion` na ABERTA + `question` em techActions | Sao DOIS sistemas de pergunta diferentes — techQuestion tem acoes automaticas nas respostas, question e so coleta de dados |
| `photo` (legado) + `photoRequirements` (multi-grupo) | O sistema automaticamente esconde photo se photoRequirements ativo — OK, mas confuso para o usuario |
| `messageDispatch` na ABERTA + `notifyTecnico/Gestor/Cliente` em etapas posteriores | messageDispatch e rico (link, layout de pagina), notificacoes simples sao basicas — usuario nao entende a diferenca |

### 🤔 Campos que NAO fazem sentido em certas etapas:

| Campo | Etapa | Problema |
|-------|-------|----------|
| Step, Photo, Note, Form, Checklist, Signature, Question | A_CAMINHO | Tecnico esta no trajeto, nao executando servico |
| Signature | ATRIBUIDA | Nao faz sentido assinar na atribuicao |
| Question (techActions) | ATRIBUIDA | Confuso — ja existe techQuestion com acoes automaticas |
| GPS | CONCLUIDA | Servico ja acabou, GPS nao relevante |
| Wait For | Quase todas | So faz sentido em etapas que precisam de evento externo |

---

## 5. PROBLEMAS ARQUITETURAIS

### A. Trigger vs Workflow — Desconexao

O sistema tem DOIS mecanismos de "disparo":
1. **AutomationRule** (automation-engine) — Usa entity+event para matching, executa ACTIONS
2. **WorkflowTemplate** (workflow-engine) — Anexado a OS via `attachDefaultWorkflow()`, processa BLOCKS

Os TRIGGER_OPTIONS no frontend estao no **WorkflowTemplate**, mas o matching do automation-engine procura **AutomationRule**. Entao:
- Se o usuario cria um workflow com trigger `os_return_created`, o workflow engine NAO vai automaticamente disparar esse workflow quando uma OS de retorno e criada
- O `attachDefaultWorkflow()` busca por `isDefault: true` — ignora o trigger ID

**Conclusao**: O campo "Quando" (trigger) nos workflows de OS e puramente VISUAL — nao afeta qual workflow e usado. O workflow default e sempre o marcado como "padrao".

### B. Onboarding — Mecanismo separado

- Tecnico: `dispatchTechnicianContract()` funciona, mas ignora trigger
- Cliente: NAO implementado no backend
- Fornecedor: NAO implementado no backend

### C. Blocos STUB criam falsa expectativa

DELAY e SLA sao exibidos com toda a configuracao, o usuario pensa que esta funcionando, mas no servidor so gera log. Zero enforcement.

---

## 6. RECOMENDACOES

### Prioridade CRITICA (bloqueia documentacao da IA):

1. **Remover triggers fantasmas** (quote_request_created, quote_created) — ou implementar no backend
2. **Remover ou marcar DELAY e SLA** como "(em breve)" — usuario configura achando que funciona
3. **Documentar que o trigger de OS e visual** — nao afeta o dispatch real
4. **Implementar dispatch para Client e Supplier onboarding** — ou remover da UI

### Prioridade ALTA (melhoria de UX):

5. **Reordenar campos linearmente** — scheduleConfig antes de techSelection, gestorApproval primeiro na CONCLUIDA
6. **Esconder campos irrelevantes por etapa** — Step/Photo/Form nao aparecer na A_CAMINHO
7. **Tornar techSelection vs scheduleConfig mutuamente exclusivos**
8. **Unificar sistemas de pergunta** — techQuestion e question sao confusos juntos

### Prioridade MEDIA (documentacao IA):

9. Criar blocos de texto explicativo em cada secao ("O que acontece quando ativo?")
10. Validar combinacoes no handleSave com avisos claros
11. Documentar todas as variaveis de template disponíveis por contexto
