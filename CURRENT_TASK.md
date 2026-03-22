# TAREFA ATUAL

## Versao: v1.06.80
## Ultima sessao: 155 (22/03/2026)

## Pendencias

### A FAZER
- (nenhuma pendencia de implementacao)

### MELHORIAS PWA (pendentes — projetos futuros)
6. **PWA Pausa regime CLT**: Regras trabalhistas (almoço obrigatório, jornada 8h/44h, alertas hora extra, intervalo interjornada 11h, pausa remunerada vs não remunerada). Atrelar ao sistema de pausa existente.

### PENDENTE VALIDACAO
- Modal de Aprovação (estrelas → modal → financeiro → APROVADA)
- Botão Retorno na lista de OS
- Banner Retorno na OS detail
- Relatório técnico (múltiplas OS, overtime, CSV, toggle valor)
- Toggles sistema (Configurações > Sistema)
- Horário comercial (Configurações > Geral)
- Valor fixo técnico + regra comissão
- Resumo tempo na OS detail
- Botão Pausa no PWA (flutuante + confirmação)
- Botão Ocorrência no PWA
- Relatório do técnico no PWA
- GPS offline (posições enfileiradas + frequência reduzida)
- Timestamp exato do clique (clientTimestamp)

### CONCLUIDO (sessao 155)

#### Deploys: v1.06.55 → v1.06.80 (26 deploys)

##### Melhorias PWA
1. ✅ Timestamp exato do clique (clientTimestamp em WorkflowStepLog + ServiceOrderEvent)
2. ✅ Botão Pausa no rodapé (flutuante + bottom sheet + confirmação + motivos)
3. ✅ Relatar Ocorrência (botão discreto + modal + push pro gestor + evento na OS)
4. ✅ GPS Offline inteligente (posições no IndexedDB + frequência reduzida 3x + sync ao reconectar)
5. ✅ Relatório do Técnico no PWA (meus serviços + tempo + sem valores financeiros)

##### Dashboard + OS Detail
- Bloco MATERIALS (PWA + editor + backend + offline)
- Timeline enriquecido + histórico unificado compacto
- Avaliação movida para depois das fotos + status APROVADA
- Lightbox fotos (clique para expandir)
- Resumo tempo na OS (deslocamento/execução/pausas/total)
- Banner retorno de OS + retornos criados
- Eventos pós-workflow (aprovada + estrelas)

##### Regras de Comissão + Financeiro
- resolveCommission() (fixo vs % vs regra HIGHER/LOWER/FIXED/COMMISSION)
- approve-and-finalize endpoint (eval + financeiro + APROVADA em 1 tx)
- ApprovalConfirmModal (preview financeiro + vencimento editável)
- Valor fixo técnico + regra comissão no cadastro de serviço
- Máscaras R$ e % nos campos

##### Relatório do Técnico (Gestor)
- Filtros + cards resumo + tabela detalhada + CSV
- Breakdown: deslocamento, execução, pausas, fora expediente
- calcOvertimeMinutes (baseado no horário comercial + fuso)
- Toggle "Valor OS" no header da coluna (default OFF)

##### Configurações
- Tela Configurações > Sistema (toggles: OS, Financeiro, Notificações, Avaliação)
- Horário Comercial (fuso horário + turnos dinâmicos)
- Retorno de OS (botão na lista + parentOrderId + banner + pre-fill)

##### Infraestrutura
- Migrations: parentOrderId, techFixedValueCents, commissionRule, systemConfig, timezone, businessHours, clientTimestamp
- Endpoints autenticados: pause, resume, pause-status, incident, approve-and-finalize, my-services

### BLOQUEADO
- (nenhum)
