# TAREFA ATUAL

## Versao: v1.06.90
## Ultima sessao: 155 (22/03/2026)

## BUGS CRITICOS (proxima sessao — prioridade)

1. **PWA Offline renderizacao**: Pagina do tech portal nao renderiza corretamente quando offline. Service Worker pode estar servindo cache antigo ou fallback HTML quebrado. Investigar sw.js e cache strategy.

2. **Erro 502 ao pausar**: Ao clicar pausar no PWA, retornou "502 Bad Gateway" com HTML do Cloudflare/Nginx. Pode ser: endpoint /service-orders/:id/pause crashando, ou timeout do backend. Verificar logs do container.

3. **OS concluida aparece na lista**: Apos concluir, OS continua na lista "Minhas OS" como "Concluida Hoje". Deveria desaparecer ou ir para historico. Revisar filtro da lista — atualmente mostra concluidas do dia (`CONCLUIDA` + createdAt today).

## Pendencias

### A FAZER
- Corrigir 3 bugs criticos acima
- **CLT Fase 2**: Alertas de almoço (4h) + jornada (8h) + push gestor
- **CLT Fase 3**: Intervalo interjornada + relatório de ponto

### MELHORIAS PWA (pendentes)
- PWA card de info muito grande no celular — reduzir fontes/spacing
- Diminuir tamanho geral das telas PWA para celular

### PENDENTE VALIDACAO
- Modal de Aprovação (estrelas → modal → financeiro → APROVADA)
- Botão Retorno na lista de OS
- Banner Retorno na OS detail
- Relatório técnico (múltiplas OS, overtime, CSV, toggle valor)
- Toggles sistema (Configurações > Sistema)
- Valor fixo técnico + regra comissão
- Resumo tempo na OS detail
- Botão Pausa no PWA
- Botão Ocorrência no PWA
- Relatório do técnico no PWA
- GPS offline
- Timestamp exato do clique
- Jornada CLT (quando toggle ativado)

### CONCLUIDO (sessao 155)

#### Deploys: v1.06.55 → v1.06.90 (36 deploys)

##### Melhorias PWA
- Timestamp exato (clientTimestamp)
- Botão Pausa flutuante + bottom sheet + confirmação
- Relatar Ocorrência (botão + modal + push + evento na OS)
- GPS Offline (IndexedDB + frequência reduzida + sync)
- Relatório do Técnico no PWA
- Jornada CLT Fase 1 (WorkDay + toggles + PWA card)

##### Dashboard + OS Detail
- Bloco MATERIALS + Timeline enriquecido + Histórico unificado
- Avaliação após fotos + status APROVADA
- Lightbox fotos + Resumo tempo + Banner retorno
- Eventos pós-workflow

##### Regras de Comissão + Financeiro
- resolveCommission + approve-and-finalize
- ApprovalConfirmModal + Valor fixo técnico + Máscaras R$ e %
- Modal valor zero inteligente (preview financeiro)

##### Relatório do Técnico (Gestor)
- Filtros + cards + tabela + CSV + toggle valor
- calcOvertimeMinutes + fora expediente
- Breakdown tempo

##### Configurações
- Tela Sistema (toggles OS, Financeiro, Notificações, Avaliação, CLT)
- Horário Comercial + fuso horário
- Retorno OS + parentOrderId
- DateTimePicker compacto + prazo default 17:00

##### UX
- Formatação moeda (onBlur) em todo o sistema
- Dropdown overflow fix (CollapsibleSection)
- Botões pausa/ocorrência reposicionados acima do nav
- Coluna "Valor Téc." nos itens da OS

### BLOQUEADO
- (nenhum)
