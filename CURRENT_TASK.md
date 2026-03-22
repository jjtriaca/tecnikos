# TAREFA ATUAL

## Versao: v1.06.71
## Ultima sessao: 155 (22/03/2026)

## Pendencias

### A FAZER (proxima sessao)
- **calcOvertimeMinutes**: Helper server-side para calcular tempo fora do horário comercial
- **Relatório técnico**: Coluna fora expediente + overtime no resumo
- **Feature 2 Frontend**: Form de serviço — máscaras R$ e % nos campos existentes
- **OS Detail**: Banner "Retorno de OS-XXXXX" quando parentOrderId existe
- **Remover checkbox isReturn**: Substituir por banner automático quando returnFrom

### MELHORIAS PWA (pendentes — detalhar e implementar separadamente)

1. **PWA Relatório do Técnico**: O técnico pode gerar relatório dos seus serviços concluídos direto no PWA. Filtro por período, mostra lista de OS com tempo e status. Mesmo layout compacto do relatório do gestor mas sem valores financeiros.

2. **PWA Botão Pausa no semi-rodapé**: Botão de pausa sempre visível no rodapé do PWA durante execução. Deve ter confirmação antes de pausar (modal "Confirmar pausa?") e proteção contra toque acidental (ex: segurar 1s ou confirmar).

3. **PWA Botão Relatar Ocorrência**: Botão discreto no rodapé do PWA (desde o aceite da OS). Ao clicar, abre formulário simples com texto + foto opcional. Envia push notification ou mensagem para o gestor imediatamente.

4. **PWA Timestamp exato do clique**: Toda ação do técnico (aceitar, a caminho, GPS, foto, concluir) deve gravar o timestamp do momento do clique no dispositivo, NÃO o momento da transmissão ao servidor. Se offline, salvar com timestamp local no IndexedDB e enviar depois mantendo o horário original.

5. **PWA GPS Offline inteligente**: Quando internet cai durante deslocamento, o GPS tracking deve:
   - Continuar gravando pings no IndexedDB (armazenar lat/lng/timestamp local)
   - Reduzir frequência de GPS automaticamente para economizar bateria (ex: de 30s para 2-5min)
   - Ao reconectar, enviar todos os pings acumulados com timestamps originais
   - Deslocamento intermunicipal: detectar que está longe e reduzir consumo ainda mais

6. **PWA Pausa regime CLT**: Sistema de pausa precisa considerar regras trabalhistas CLT. Incluir: pausa obrigatória para almoço (1h entre 4ª e 6ª hora), controle de jornada (8h diárias / 44h semanais), registro de ponto integrado, alertas de hora extra, intervalo interjornada (11h), diferenciação entre pausa remunerada e não remunerada. Atrelar ao sistema de pausa existente (ExecutionPause) e ao horário comercial configurado.

### PENDENTE VALIDACAO
- **Modal de Aprovação**: Testar fluxo completo (estrelas → modal → financeiro → APROVADA)
- **Botão Retorno**: Testar na lista de OS com OS em status terminal
- **Relatório técnico**: Testar com múltiplas OS e diferentes técnicos
- **Toggles sistema**: Testar todos os toggles da tela Configurações > Sistema
- **Horário comercial**: Verificar se salva fuso + turnos em Configurações > Geral
- **Valor fixo técnico**: Testar no cadastro de serviço (fixo + % + regra)
- **Resumo tempo na OS**: Verificar bloco deslocamento/execução/pausas/total

### CONCLUIDO (sessao 155)

#### Deploys: v1.06.55 → v1.06.71 (17 deploys)

- Migration: parentOrderId, techFixedValueCents, commissionRule, systemConfig, timezone, businessHours
- resolveCommission() helper + approve-and-finalize endpoint
- ApprovalConfirmModal (preview financeiro + vencimento editável)
- Tela Configurações > Sistema (toggles organizados por seção)
- Horário Comercial em Configurações > Geral (fuso + turnos dinâmicos)
- Valor fixo técnico + regra comissão no cadastro de serviço
- Botão Retorno na lista de OS + parentOrderId
- Relatório do Técnico (filtros + cards + tabela + CSV + toggle valores)
- Resumo de tempo na OS detail (deslocamento/execução/pausas/total)
- Lightbox fotos (clique para expandir)
- Timeline enriquecido + histórico unificado compacto
- Avaliação movida para depois das fotos
- Eventos pós-workflow (aprovada + estrelas)
- Bloco MATERIALS (PWA + editor + backend + offline)

### BLOQUEADO
- (nenhum)
