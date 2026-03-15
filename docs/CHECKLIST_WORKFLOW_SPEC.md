# Especificacao Completa — Checklists no Workflow

## Data: 15/03/2026
## Status: APROVADO pelo Juliano

---

## 1. Classes de Checklist (fixas no sistema)

| # | Classe | ID | Origem dos itens |
|---|--------|----|-----------------|
| 1 | Ferramentas e EPI | TOOLS_PPE | Cadastro do Servico |
| 2 | Materiais | MATERIALS | Cadastro do Servico |
| 3 | Verificacao Inicial | INITIAL_CHECK | Cadastro do Servico |
| 4 | Verificacao Final | FINAL_CHECK | Cadastro do Servico |
| 5 | Personalizado | CUSTOM | Definido no Workflow |

---

## 2. Cadastro do Servico

- 4 secoes fixas de checklist (Ferramentas e EPI, Materiais, Verificacao Inicial, Verificacao Final)
- Cada uma com lista de itens
- Personalizado NAO aparece aqui (e do workflow)
- Substitui o sistema atual de checklists com nome livre

---

## 3. Configuracao por checklist no Workflow

Cada checklist ativado tem 3 configuracoes:

### Modo de confirmacao
- **Item a item** — tecnico marca cada item individualmente
- **Inteiro** — tecnico confirma o checklist completo com um botao

### Obrigatoriedade
- **Obrigatorio** — tecnico nao avanca sem confirmar 100%
- **Recomendado** — tecnico pode avancar sem completar

### Notificacao (so quando Recomendado)
- Toggle: "Notificar gestor se avancar sem completar"
- Ao ativar, expande sub-opcoes: canal (WhatsApp/Email) + mensagem com variaveis clicaveis

---

## 4. Etapas do Workflow — Configuracao Completa

### ABERTA

```
Pagina 1 — Oferta (itens ordenaveis)
  ↕ ☑ Endereco
  ↕ ☑ Valor da comissao
  ↕ ☐ Valor total da OS
  ↕ ☑ Prazo de execucao
  ↕ ☐ Nome do cliente
  ↕ ☐ Contato no local
  ↕ ☐ Descricao do servico
  ↕ ☐ Cidade
  ↕ ☐ Nome da empresa
  ↕ ☐ Texto livre 1
  ↕ ☐ Ferramentas e EPI       [Item a item] [Obrigatorio]
  ↕ ☐ Materiais               [Item a item] [Obrigatorio]
  ↕ ☐ Personalizado           [Item a item] [Obrigatorio]
     ☐ Pergunta para o tecnico
     ☑ Botao "Aceitar OS"
        ☐ Notificar gestor ao aceitar
        ☐ Notificar cliente ao aceitar

Pagina 2 — Pos-aceite (itens ordenaveis)
  ↕ ☑ Botao "Ativar GPS"
       ☐ Notificar gestor ao ativar GPS
       ☐ Notificar cliente ao ativar GPS
  ↕ ☑ Botao "Estou a caminho"
       ☐ Notificar gestor ao sair
       ☐ Notificar cliente ao sair
  ↕ ☐ Ferramentas e EPI       [Item a item] [Obrigatorio]
  ↕ ☐ Materiais               [Item a item] [Obrigatorio]
  ↕ ☐ Personalizado           [Item a item] [Obrigatorio]
```

Mudancas:
- Removidos: Texto livre 2 e 3
- Pergunta do tecnico: movida pra logo acima do botao Aceitar
- Adicionados: 3 checklists na Pagina 1 e 3 na Pagina 2

### OFERTADA
- Sem checklist, sem alteracoes

### ATRIBUIDA

```
CHECKLISTS DO TECNICO (Pagina do link — ordenaveis)
  ↕ ☐ Ferramentas e EPI       [Item a item] [Obrigatorio]
  ↕ ☐ Materiais               [Item a item] [Obrigatorio]
  ↕ ☐ Personalizado           [Item a item] [Obrigatorio]
  ↕ ☐ Escrever observacao

ACOES AUTOMATICAS
  Tempo para ir a caminho
  ☐ Pergunta de tempo estimado
  ☐ Notificar gestor
  ☐ Notificar cliente
```

Mudancas:
- Nova secao "Checklists do Tecnico" ANTES das acoes automaticas
- Removidos: Notificar tecnico (redundante), Foto, Checklist antigo
- Escrever observacao migrou pro link
- Verificacao Inicial e Final NAO disponiveis aqui (tecnico nao esta no local)

### A_CAMINHO
- Sem checklist
- Mantem como esta (tracking, proximidade, botao Cheguei)

### EM_EXECUCAO

```
ACOES AUTOMATICAS
  ☐ Notificar gestor
  ☐ Notificar cliente
  ☐ Manter rastreamento GPS ativo
     Precisao: [Normal]

Pagina do link — Em Execucao (itens ordenaveis)
  ↕ ☐ Verificacao Inicial     [Item a item] [Obrigatorio]
  ↕ ☐ Ferramentas e EPI       [Item a item] [Obrigatorio]
  ↕ ☐ Materiais               [Item a item] [Obrigatorio]
  ↕ ☐ Passo a passo
  ↕ ☐ Foto obrigatoria
  ↕ ☐ Formulario
  ↕ ☐ Escrever observacao
  ↕ ☐ Assinatura
  ↕ ☐ Verificacao Final       [Item a item] [Obrigatorio]
  ↕ ☐ Personalizado           [Item a item] [Obrigatorio]

  Rodape fixo:
  Cronometro  [Pausar] [Concluir]
```

Mudancas:
- Secao "Acoes do Tecnico" desaparece — tudo migra pro link
- GPS vira acao automatica em segundo plano (precisao reduzida)
- Cronometro e pausas: rodape fixo no link, nao ordenavel
- Botao Concluir so libera com itens obrigatorios completos

### CONCLUIDA

```
Pagina do link — Concluida (itens ordenaveis)
  ↕ ☐ Verificacao Final       [Item a item] [Obrigatorio]
  ↕ ☐ Foto obrigatoria
  ↕ ☐ Assinatura
  ↕ ☐ Escrever observacao
  ↕ ☐ Personalizado           [Item a item] [Obrigatorio]

ACOES AUTOMATICAS
  ☐ Notificar gestor (tecnico concluiu)
  ☐ Notificar tecnico (aguardando aprovacao)
  ☐ Notificar cliente
  Aprovacao do gestor          [Obrigatoria / Automatica]
    Obrigatoria:
      Ao aprovar: notificar tecnico + cliente
      Ao aprovar com ressalvas: ajuste comissao, flag qualidade, notificar
      Ao reprovar: reabrir execucao, notificar
    Automatica:
      Avanca direto ao completar acoes do link
```

Mudancas:
- Lancamento financeiro REMOVIDO daqui (so na APROVADA)
- Adicionado: Notificar tecnico (aguardando aprovacao)
- Aprovacao: novo modo "Automatica"

### APROVADA

```
ACOES AUTOMATICAS
  ☐ Notificar gestor
  ☐ Notificar tecnico (servico aprovado)
  ☐ Notificar cliente (servico aprovado)
  Lancamento financeiro

Link do tecnico — Somente leitura
  "Servico aprovado" + resumo (data, duracao, cliente)
  Link expira apos esta etapa
```

Mudancas:
- Lancamento financeiro agora SO aqui (sem conflito com CONCLUIDA)

---

## 5. Gravacao de Dados

### Nova tabela: ChecklistResponse

| Campo | Tipo | Descricao |
|-------|------|-----------|
| id | String (UUID) | PK |
| serviceOrderId | String | FK para ServiceOrder |
| checklistClass | Enum | TOOLS_PPE, MATERIALS, INITIAL_CHECK, FINAL_CHECK, CUSTOM |
| stage | String | Etapa onde foi preenchido (ABERTA, ATRIBUIDA, etc.) |
| mode | Enum | ITEM_BY_ITEM, FULL |
| required | Boolean | Se era obrigatorio ou recomendado |
| items | Json | Array: [{ text, checked, checkedAt? }] |
| observation | String? | Texto livre do tecnico |
| confirmed | Boolean | Se foi confirmado (false = avancou sem completar) |
| confirmedAt | DateTime? | Timestamp da confirmacao |
| confirmedBy | String? | ID do tecnico |
| technicianName | String? | Nome do tecnico (desnormalizado) |
| geolocation | Json? | { lat, lng, accuracy } |
| deviceInfo | Json? | { browser, os, device } |
| timeInStage | Int? | Segundos entre receber e confirmar |
| skippedItems | Json? | Itens nao confirmados (quando Recomendado) |
| createdAt | DateTime | Auto |

### Gravacao de pausas e cronometro
- Mesmo padrao rico: quem, quando, onde, dispositivo, tempo

---

## 6. Visualizacao na OS (Gestor)

### Aba "Checklists" na OS
- Lista todos os ChecklistResponse da OS
- Agrupados por etapa
- Mostra: classe, modo, itens marcados/pendentes, observacoes, localizacao, tempo, dispositivo

### Timeline/Historico
- Eventos de confirmacao de checklist aparecem na timeline
- Eventos de pausa/retomada tambem
- Clicavel para expandir detalhes

---

## 7. Link do Tecnico — Ciclo de Vida

| Etapa | Pagina do Link | Status |
|-------|---------------|--------|
| ABERTA | Pagina 1: Oferta + checklists + Aceitar | Ativo |
| ABERTA | Pagina 2: Pos-aceite (GPS, a caminho, checklists) | Ativo |
| A_CAMINHO | Pagina 3: Tracking (proximidade, cheguei) | Ativo |
| ATRIBUIDA | Pagina 4: Checklists + observacao | Ativo |
| EM_EXECUCAO | Pagina 5: Acoes de execucao + rodape cronometro | Ativo |
| CONCLUIDA | Pagina 6: Acoes finais (foto, assinatura, checklist) | Ativo |
| APROVADA | Tela informativa: "Servico aprovado" + resumo | Somente leitura |
| Apos APROVADA | "Este link expirou" | Expirado |

---

## 8. Regras de Negocio

### Combinacao de checklists (OS com multiplos servicos)
- OS com multiplos servicos: checklists de todos os servicos sao COMBINADOS numa lista unica por classe
- Itens duplicados sao removidos (dedup por texto)
- Ex: OS com "Instalacao Ar" + "Manutencao Eletrica" → Ferramentas e EPI mostra todos os itens juntos sem repetir

1. Classes 1-4 puxam itens do cadastro do servico. Classe 5 (Personalizado) define itens no workflow.
2. Se a OS tem multiplos servicos, os checklists de todos os servicos sao combinados numa lista unica por classe, sem duplicatas.
3. Modo "Item a item" exige marcar cada item. Modo "Inteiro" exige um clique de confirmacao.
4. "Obrigatorio" bloqueia avanco. "Recomendado" permite avancar com notificacao opcional.
5. O mesmo checklist pode aparecer em mais de uma etapa (gestor decide).
6. O link e o canal unico do tecnico do inicio ao fim.
7. Aprovacao "Automatica" avanca sem intervencao do gestor.
8. Link expira apos APROVADA.

---

## 9. Resolucao de Conflitos Tecnicos

### 9.1 Migracao Service.checklists
- Dados existentes: checklists com nome livre [{ name, items }]
- Migracao: mapear nomes existentes para as 4 classes fixas. Nomes nao mapeados vao para CUSTOM
- Service model: campo `checklists Json?` muda de array livre para estrutura fixa:
  `{ toolsPpe: string[], materials: string[], initialCheck: string[], finalCheck: string[] }`

### 9.2 Backward compat — Workflow blocks
- Workflows antigos com bloco CHECKLIST simples (items: string[]) continuam funcionando
- Decompiler detecta formato antigo e converte para classe CUSTOM
- Novos workflows geram blocos com checklistClass no config

### 9.3 Secao "Acoes do Tecnico" no workflow UI
- ATRIBUIDA, EM_EXECUCAO, CONCLUIDA: secao "Acoes do Tecnico" DESAPARECE
- Tudo migra para configuracao de pagina do link (itens ordenaveis)
- Acoes que nao sao checklist (foto, formulario, assinatura, passo a passo, observacao) viram itens ordenaveis no link

### 9.4 Link publico — Reescrita de paginas
- Modelo atual: steps fixos no codigo (offer, post-accept, tracking, executing)
- Modelo novo: paginas dinamicas baseadas na etapa da OS
- O link consulta a etapa atual da OS e renderiza a pagina correspondente
- Cada pagina mostra os itens configurados no workflow para aquela etapa

### 9.5 Pagina 2 (Pos-aceite) — Padronizacao
- Hoje: botoes GPS e enRoute hardcoded
- Novo: itens ordenaveis no mesmo padrao da Pagina 1
- GPS e enRoute viram itens ordenaveis com sub-opcoes

### 9.6 Pergunta para o tecnico
- Hoje: posicionada apos Pagina 2 e tracking
- Novo: movida para logo acima do botao "Aceitar OS" na Pagina 1
- Parte do autoActions, nao do techActions

### 9.7 Gravacao — Dois sistemas complementares
- ChecklistResponse (nova tabela): dados ricos de checklists
- WorkflowStepLog: continua para passo a passo, foto, formulario, etc.
- Sem conflito — sistemas independentes

---

## 10. Plano de Implementacao (ordem otimizada)

### Fase 1 — Backend Foundation
1. Migration: nova tabela ChecklistResponse + enum ChecklistClass
2. Migration: Service.checklists → estrutura com 4 classes fixas
3. Script de migracao de dados existentes
4. DTOs e Service para ChecklistResponse (CRUD)
5. Endpoint: POST /checklist-response (submissao pelo link)
6. Endpoint: GET /service-orders/:id/checklists (visualizacao na OS)

### Fase 2 — Cadastro de Servicos (Frontend)
7. Nova UI com 4 secoes fixas (Ferramentas e EPI, Materiais, Verificacao Inicial, Verificacao Final)
8. Migrar editor de checklists existente para novo formato
9. Salvar no novo formato JSON

### Fase 3 — Stage Config Types
10. Redesenhar tipos em stage-config.ts para multiplos checklists por etapa
11. Cada etapa: array de ChecklistStageConfig { class, mode, required, notification }
12. LinkPageBlock: novo tipo 'checklist' com sub-config
13. Compile/Decompile: gerar/ler multiplos blocos CHECKLIST
14. Backward compat no decompiler

### Fase 4 — Workflow UI (StageSection)
15. ABERTA Pagina 1: adicionar 3 checklists ordenaveis, remover Texto livre 2/3, mover Pergunta
16. ABERTA Pagina 2: padronizar como itens ordenaveis
17. ATRIBUIDA: nova secao Checklists do Tecnico, remover acoes do tecnico
18. EM_EXECUCAO: migrar acoes do tecnico para pagina do link ordenavel
19. CONCLUIDA: pagina do link + aprovacao obrigatoria/automatica
20. APROVADA: limpar, so financeiro + notificacoes

### Fase 5 — Link Publico (Reescrita)
21. Refatorar /p/[token] para paginas dinamicas por etapa
22. Renderizar checklists com modo item-a-item / inteiro
23. Submissao de ChecklistResponse com dados ricos (geo, device)
24. Rodape fixo de cronometro/pausas na EM_EXECUCAO
25. Tela somente leitura na APROVADA
26. Expiracao do link apos APROVADA

### Fase 6 — Visualizacao na OS
27. Aba "Checklists" na pagina de detalhes da OS
28. Eventos de checklist na timeline/historico
29. Dados ricos: itens, observacoes, geo, dispositivo, tempo

### Fase 7 — Notificacoes
30. Notificacao ao gestor quando tecnico avanca sem completar (Recomendado)
31. Variaveis de template: {itens_pendentes}, {checklist_classe}, etc.
