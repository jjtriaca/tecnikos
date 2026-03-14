# Decisões de Limpeza do Workflow — Sessão 107 (14/03/2026)

## Decisões Globais
- **Webhook externo**: REMOVER de todas as etapas (integração não pertence ao workflow)
- **Pergunta para o técnico**: MOVER para dentro do bloco do link
- **Numeração das etapas**: REMOVER (nome + ícone é suficiente)
- **Regime de Agenda ativo**: ESCONDER etapas OFERTADA e ATRIBUÍDA no workflow UI
- **Aviso custo WhatsApp**: toda vez que ativar notificação WhatsApp, mostrar: "💰 Notificações WhatsApp têm custo por mensagem. Use com critério para evitar gastos desnecessários."

---

## ABERTA
| Campo | Decisão | Observação |
|-------|---------|------------|
| Disparo de mensagens (link) | ✅ Manter | Notificações movidas para dentro dos botões (onAccept, onGps, onEnRoute) — JÁ IMPLEMENTADO v1.03.15 |
| Pergunta para o técnico | 🔄 Mover | Mover para dentro do bloco do link |
| Enviar alerta | 🙈 Esconder | Redundante na ABERTA |
| Webhook externo | ❌ Remover | Global — remover de todas as etapas |
| Aguardar evento | ❌ Remover | Remover da ABERTA |

---

## OFERTADA
| Campo | Decisão | Observação |
|-------|---------|------------|
| Configurações de aceite | ✅ Manter | Tempo para aceitar + ação ao expirar |
| Notificar gestor | ✅ Manter | Hint: "Útil quando outro operador despacha a OS ou em despachos automáticos — avisa o gestor que a oferta foi enviada aos técnicos." |
| Notificar técnico | ❌ Remover | Duplicado — já notificado na ABERTA (disparo de mensagem) |
| Notificar cliente | ✅ Manter | Hint: "Avisa o cliente que a OS foi enviada aos técnicos e está aguardando aceite." + aviso custo WhatsApp |
| Lançamento financeiro | ❌ Remover | Não faz sentido antes de confirmar técnico |
| Enviar alerta | 🙈 Esconder | Redundante |
| Webhook | ❌ Remover | Global |
| Aguardar evento | ❌ Remover | Coberto pelas Configurações de aceite |

---

## ATRIBUÍDA
| Campo | Decisão | Observação |
|-------|---------|------------|
| Tempo para ir a caminho | ✅ Manter | Bloco específico verde |
| Pergunta de tempo estimado | ✅ Manter | Bloco específico azul |
| Notificar gestor | ✅ Manter | Hint: "Dispara quando a OS entra em Atribuída. Se já configurou notificação de aceite no link, pode ser duplicada." |
| Notificar técnico | ❌ Remover | Duplicado — técnico já sabe (aceitou pelo link ou foi notificado pela agenda) |
| Notificar cliente | ✅ Manter | Hint de duplicidade com onAccept do link + aviso custo WhatsApp |
| Lançamento financeiro | ❌ Remover | Antes de executar o serviço não faz sentido |
| Enviar alerta | ❌ Remover | Redundante |
| Webhook | ❌ Remover | Global |
| **Ações do técnico** | 🔄 Filtrar | Manter só: Foto, Nota, Checklist. Esconder: Step, GPS, Formulário, Assinatura, Materiais, Pergunta |
| Aguardar evento | ❌ Remover | Coberto pelo Tempo para ir a caminho |

---

## A_CAMINHO
| Campo | Decisão | Observação |
|-------|---------|------------|
| Rastreamento por proximidade | ✅ Manter | Core desta etapa (raio, intervalo, eventos ao entrar no raio) |
| Notificar gestor | ❌ Remover | Duplicado com onEnRoute do link |
| Notificar técnico | ❌ Remover | Sem sentido — técnico já sabe que está a caminho |
| Notificar cliente | ❌ Remover | Duplicado com onEnRoute do link |
| Lançamento financeiro | ❌ Remover | Antes de executar não faz sentido |
| Enviar alerta | ❌ Remover | Redundante |
| Webhook | ❌ Remover | Global |
| Ações do técnico | ❌ Remover TODAS | Técnico está dirigindo, não deveria interagir |
| Aguardar evento | ❌ Remover | Coberto pelo rastreamento por proximidade |

---

## EM_EXECUÇÃO
| Campo | Decisão | Observação |
|-------|---------|------------|
| Notificar gestor | ✅ Manter | "Técnico iniciou a execução" — útil pra acompanhamento |
| Notificar técnico | ❌ Remover | Técnico já sabe que iniciou |
| Notificar cliente | ✅ Manter | "O técnico está executando o serviço" + aviso custo WhatsApp |
| Lançamento financeiro | ❌ Remover | Lançamento faz sentido na conclusão, não no início |
| Enviar alerta | ❌ Remover | Redundante — o status da OS no card já mostra isso |
| Webhook | ❌ Remover | Global |
| **Ações do técnico** | ✅ Manter TODAS | Core da execução: Step, Fotos, Nota, GPS, Checklist, Formulário, Assinatura, Materiais, Pergunta |
| Aguardar evento | ❌ Remover | Técnico está executando ativamente |
| Cronômetro de execução | ✅ Manter | Core — mede tempo efetivo |
| Sistema de pausas | ✅ Manter | Core — pausar por peça/almoço/etc |

## CONCLUÍDA
| Campo | Decisão | Observação |
|-------|---------|------------|
| Notificar gestor | ✅ Manter | "OS concluída pelo técnico" — essencial com aprovação |
| Notificar técnico | ❌ Remover | Técnico já sabe que concluiu |
| Notificar cliente | ✅ Manter | "Seu serviço foi concluído" + aviso custo WhatsApp |
| Lançamento financeiro | ✅ Manter | Core — gerar contas a receber, comissão, etc |
| Enviar alerta | ❌ Remover | Redundante — status muda no card |
| Webhook | ❌ Remover | Global |
| Aprovação do gestor | ✅ Manter | Core — reter OS até gestor aprovar/reprovar |
| **Ações do técnico** | 🔄 Filtrar | Manter só: Foto, Nota. Remover o resto (serviço já terminou) |
| Aguardar evento | ❌ Remover | Coberto pela aprovação do gestor |

## APROVADA
| Campo | Decisão | Observação |
|-------|---------|------------|
| Notificar gestor | ❌ Remover | Gestor acabou de aprovar, já sabe |
| Notificar técnico | ❌ Remover | Duplicado com onApprove da CONCLUÍDA |
| Notificar cliente | ❌ Remover | Duplicado com onApprove da CONCLUÍDA |
| Lançamento financeiro | ✅ Manter | Alguns fluxos geram lançamento só após aprovação |
| Enviar alerta | ❌ Remover | Redundante |
| Webhook | ❌ Remover | Global |
| Ações do técnico | ❌ Remover TODAS | Serviço encerrado |
| Aguardar evento | ❌ Remover | OS já encerrada |

---

## CANCELADA
- Não está visível na UI do workflow — não faz parte desta limpeza
- Notificações de cancelamento podem ser tratadas separadamente no futuro

---

## Status: TODAS AS ETAPAS DISCUTIDAS E APROVADAS ✅
Pronto para implementação.
