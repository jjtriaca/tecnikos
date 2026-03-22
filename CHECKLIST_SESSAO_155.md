# Checklist de Testes — Sessao 155 (v1.06.55 → v1.06.81)

## Como usar: Marque [x] ao confirmar cada teste

---

## 1. BLOCO MATERIALS + TIMELINE
- [ ] Criar workflow com bloco MATERIALS no editor (Fluxo de Atendimento)
- [ ] Bloco aparece no sidebar do editor (categoria ACOES)
- [ ] Executar no PWA: digitar nota + adicionar 3 materiais + enviar
- [ ] Cursor volta pro campo nome apos cada adicao
- [ ] Teclado numerico aparece no campo Qtd (celular)
- [ ] Botao desabilitado quando menos de minItems
- [ ] Na OS detail: lista de materiais aparece no timeline (card amarelo)
- [ ] Nome do item limitado a 50 caracteres

## 2. HISTORICO UNIFICADO (OS Detail)
- [ ] Fluxo + historico aparecem como tabela unica com colunas (Passo, Detalhe, Hora, Coordenadas)
- [ ] Status mostra badge colorido (Ofertada, Atribuida, Em execucao, etc.)
- [ ] Botoes de Acao mostra nome do botao (Aceitar, Concluir tarefa, etc.)
- [ ] GPS mostra coordenadas na coluna Coordenadas
- [ ] Foto mostra "foto" no detalhe
- [ ] Materiais mostra "X itens" + card expandido abaixo
- [ ] Eventos pos-workflow (Aprovada) aparecem no final

## 3. LIGHTBOX DE FOTOS
- [ ] Clicar em miniatura da foto abre em tamanho real (overlay escuro)
- [ ] Clicar no fundo ou no X fecha o lightbox
- [ ] Funciona para fotos Antes, Depois e Passos do fluxo

## 4. RESUMO DE TEMPO NA OS
- [ ] Bloco "Tempo de Servico" aparece entre Fluxo e Checklists
- [ ] Mostra: Deslocamento, Execucao, Pausas, Total bruto, Total liquido
- [ ] So aparece quando OS tem completedAt + startedAt/enRouteAt
- [ ] Valores calculados corretamente

## 5. AVALIACAO + APROVACAO
- [ ] Secao "Avaliacao do Tecnico" aparece DEPOIS das fotos (nao antes)
- [ ] Selecionar estrelas (1-5) funciona
- [ ] Clicar "Aprovar e Avaliar" abre MODAL de confirmacao
- [ ] Modal mostra: estrelas + comentario + preview financeiro
- [ ] Preview mostra linhas A Receber (verde) e A Pagar (azul)
- [ ] Vencimento editavel nos dois lancamentos
- [ ] Ao confirmar: status muda para APROVADA
- [ ] Lancamento financeiro criado (verificar em Financas > Financeiro)
- [ ] Evento no historico mostra "Aprovada" com estrelas

## 6. RETORNO DE OS
- [ ] Na lista de OS: dropdown de acoes mostra "Retorno" (so para OS terminal)
- [ ] Clicar "Retorno" abre tela de nova OS pre-preenchida
- [ ] Cliente, endereco, servicos e tecnico pre-preenchidos
- [ ] Secao "Retorno de atendimento" aparece automaticamente (nao checkbox)
- [ ] Opcao "Lancar valor para o tecnico" / "Obrigacao do tecnico" funciona
- [ ] parentOrderId salvo na OS nova
- [ ] Na OS detail da OS original: banner azul "Retorno criado: OS-XXXXX"
- [ ] Na OS detail do retorno: banner amarelo "Retorno de OS-XXXXX" com link

## 7. REGRAS DE COMISSAO (Servico)
- [ ] Cadastro de servico: campo "Preco" tem prefixo R$ dentro do input
- [ ] Campo "Comissao" tem sufixo % dentro do input
- [ ] Campo "Valor fixo tecnico" tem prefixo R$ dentro do input
- [ ] Ao preencher comissao % E valor fixo: dropdown "Regra de comissao" aparece
- [ ] Opcoes: Maior valor, Menor valor, Apenas fixo, Apenas comissao %
- [ ] Salvar servico com valor fixo funciona
- [ ] Editar servico carrega campos corretamente

## 8. CONFIGURACOES > SISTEMA
- [ ] Menu lateral: Configuracoes > Sistema aparece
- [ ] Secao "Ordens de Servico" com 3 toggles
- [ ] Secao "Financeiro" com 2 toggles + campo numerico (dias)
- [ ] Secao "Notificacoes" com 3 toggles
- [ ] Secao "Avaliacao" com 2 toggles
- [ ] Secao "Jornada CLT" com 5 toggles + 2 campos numericos
- [ ] Mudar qualquer toggle: botao "Salvar" aparece
- [ ] Salvar funciona (recarregar pagina mantem valores)

## 9. HORARIO COMERCIAL (Configuracoes > Geral)
- [ ] Secao "Horario de Funcionamento" aparece no final da pagina
- [ ] Dropdown de fuso horario com timezones do Brasil
- [ ] Turnos de trabalho: 2 turnos padrao (07:00-11:00, 13:00-17:00)
- [ ] Botao "+ Adicionar turno" funciona
- [ ] Botao X remove turno
- [ ] Salvar mantem configuracao

## 10. RELATORIO DO TECNICO (Gestor)
- [ ] Financas > Relatorios > tab Tecnicos: link "Detalhes" funciona
- [ ] Pagina /reports/technician carrega
- [ ] Dropdown de tecnicos populado
- [ ] Selecionar tecnico + periodo + clicar Gerar
- [ ] Cards resumo: OS Concluidas, Tempo Liquido, Comissao Total, Avaliacao Media
- [ ] Breakdown: Deslocamento, Execucao, Pausas, Fora expediente (amarelo)
- [ ] Tabela detalhada com colunas (Codigo, Titulo, Servico, Data, etc.)
- [ ] Toggle "Valor OS" no header da coluna (default OFF)
- [ ] Marcar toggle: coluna Valor OS mostra valores
- [ ] Desmarcar: coluna mostra "—"
- [ ] Comissao sempre visivel
- [ ] Coluna "Fora Exp." mostra tempo fora do horario comercial
- [ ] Footer com totais
- [ ] Botao CSV exporta (respeita toggle Valor OS)

## 11. PWA — TIMESTAMP EXATO
- [ ] Ao avancar bloco online: WorkflowStepLog tem clientTimestamp preenchido
- [ ] Ao avancar bloco offline + sync: clientTimestamp preservado (hora do clique)
- [ ] clientTimestamp != createdAt quando houve delay de sync

## 12. PWA — BOTAO PAUSA
- [ ] Botao flutuante "Pausar" (laranja) aparece durante EM_EXECUCAO
- [ ] Clicar abre bottom sheet com motivos (7 categorias)
- [ ] Selecionar motivo + "Confirmar Pausa" funciona
- [ ] Quando pausado: banner laranja full-width no rodape com "Retomar"
- [ ] Clicar "Retomar" funciona
- [ ] Pausa registrada no banco (ExecutionPause)

## 13. PWA — RELATAR OCORRENCIA
- [ ] Botao discreto "Ocorrencia" (cinza) ao lado do Pausar
- [ ] Clicar abre bottom sheet com 8 categorias
- [ ] Campo descricao obrigatorio
- [ ] Enviar cria evento INCIDENT_REPORTED na OS
- [ ] Evento aparece no historico da OS no dashboard

## 14. PWA — GPS OFFLINE
- [ ] Quando offline: posicoes GPS enfileiradas no IndexedDB
- [ ] Frequencia reduzida offline (3x normal, min 2min)
- [ ] Ao reconectar: posicoes sincronizadas com timestamps originais

## 15. PWA — RELATORIO DO TECNICO
- [ ] Botao "Relatorio" na tela Minhas OS
- [ ] Pagina /tech/report carrega
- [ ] Filtro por periodo + Gerar Relatorio
- [ ] Cards: OS Concluidas, Tempo Liquido
- [ ] Breakdown: Deslocamento, Pausas, Fora expediente
- [ ] Lista de OS em cards (sem valores financeiros)
- [ ] Total no rodape

## 16. PWA — JORNADA DE TRABALHO (CLT Fase 1)
- [ ] Card de jornada na tela Minhas OS (verde ativo / cinza inativo)
- [ ] Botao "Iniciar Jornada" cria registro WorkDay
- [ ] Mostra horario de inicio
- [ ] Botao "Encerrar" finaliza jornada
- [ ] WorkDay registra: totalWorkedMs, overtimeMs, osCount, mealBreakTaken
- [ ] Nao permite iniciar duas vezes no mesmo dia
- [ ] Nao permite encerrar sem iniciar

---

## TOTAL: 27 deploys (v1.06.55 → v1.06.81)
## Data: 22/03/2026
