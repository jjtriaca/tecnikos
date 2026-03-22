# TAREFA ATUAL

## Versao: v1.06.75
## Ultima sessao: 155 (22/03/2026)

## Pendencias

### A FAZER
- (nenhuma pendencia de implementacao — tudo entregue)

### MELHORIAS PWA (pendentes — projetos futuros)

1. **PWA Relatório do Técnico**: Técnico gera relatório dos seus serviços concluídos no PWA. Filtro por período, lista de OS com tempo e status. Layout compacto sem valores financeiros.

2. **PWA Botão Pausa no semi-rodapé**: Botão de pausa visível no rodapé durante execução. Confirmação + proteção contra toque acidental.

3. **PWA Botão Relatar Ocorrência**: Botão discreto no rodapé (desde o aceite). Formulário texto + foto → push para o gestor.

4. **PWA Timestamp exato do clique**: Gravar timestamp do dispositivo (não da transmissão). Offline → salvar com timestamp local no IndexedDB.

5. **PWA GPS Offline inteligente**: Gravar pings no IDB quando sem internet. Reduzir frequência GPS para economizar bateria. Enviar ao reconectar com timestamps originais.

6. **PWA Pausa regime CLT**: Regras trabalhistas: pausa almoço obrigatória, controle jornada 8h/44h, alertas hora extra, intervalo interjornada 11h, pausa remunerada vs não remunerada.

### PENDENTE VALIDACAO
- **Modal de Aprovação**: Testar fluxo completo (estrelas → modal → financeiro → APROVADA)
- **Botão Retorno**: Testar na lista de OS com OS em status terminal
- **Banner Retorno**: Verificar se aparece na OS detail quando parentOrderId existe
- **Relatório técnico**: Testar com múltiplas OS, overtime, CSV export
- **Toggles sistema**: Testar todos os toggles da tela Configurações > Sistema
- **Horário comercial**: Verificar se salva fuso + turnos em Configurações > Geral
- **Valor fixo técnico**: Testar no cadastro de serviço (fixo + % + regra + máscaras)
- **Resumo tempo na OS**: Verificar bloco deslocamento/execução/pausas/total

### CONCLUIDO (sessao 155)

#### Deploys: v1.06.55 → v1.06.75 (21 deploys)

##### Bloco MATERIALS + Timeline + Histórico
- Bloco MATERIALS completo (PWA + editor + backend + offline)
- Timeline enriquecido (dados inline por tipo de bloco)
- Histórico unificado compacto (relatório com colunas)
- Avaliação movida para depois das fotos
- Eventos pós-workflow (aprovada + estrelas)
- Lightbox fotos (clique para expandir)
- Resumo tempo na OS detail (deslocamento/execução/pausas/total)
- Banner retorno de OS + retornos criados

##### Regras de Comissão + Financeiro
- Migration: parentOrderId, techFixedValueCents, commissionRule, systemConfig, timezone, businessHours
- resolveCommission() helper (fixo vs % vs regra)
- approve-and-finalize endpoint (eval + financeiro + APROVADA em 1 tx)
- ApprovalConfirmModal (preview financeiro + vencimento editável)
- Valor fixo técnico + regra comissão no cadastro de serviço
- Máscaras R$ e % nos campos do form

##### Relatório do Técnico
- Filtros (técnico, período) + cards resumo + tabela detalhada + CSV
- Breakdown: deslocamento, execução, pausas, fora expediente
- calcOvertimeMinutes (baseado no horário comercial + fuso)
- Toggle "Valor OS" (default OFF, afeta tela + CSV)
- Agrupamento por serviço

##### Configurações do Sistema
- Tela Configurações > Sistema (toggles: OS, Financeiro, Notificações, Avaliação)
- Horário Comercial em Configurações > Geral (fuso + turnos dinâmicos)

##### Retorno de OS
- Botão "Retorno" no dropdown da lista de OS
- parentOrderId salvo no banco (self-relation)
- Pre-fill automático (cliente, endereço, serviços, técnico)
- Checkbox isReturn removido (seção automática)
- Banner na OS detail + lista de retornos

### BLOQUEADO
- (nenhum)
