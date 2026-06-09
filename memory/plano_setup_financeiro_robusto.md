# Plano — Setup financeiro robusto + guardrails (tenant novo + system-wide)

**Pedido (Juliano, 09/06/2026):** ao criar contas/financeiro num tenant novo, ter **mecanismos robustos**
com **proteções claras** que não deixem brecha pros furos que apareceram (resíduo no trânsito,
auto-pago errado, importação duplicada, lançamento pendente deletado, taxa/lançamento sem rumo).
Forward-looking (novos tenants) + também protege o SLS. NÃO toca em dado existente.

## Os FUROS observados → vira PROTEÇÃO
| Furo visto | Proteção programada |
|---|---|
| Lançamento cai no TRÂNSITO sem rumo (fallback silencioso) | Roteamento explícito: forma de pgto → conta obrigatória |
| Conta de passagem drifta (−151,27) sem ninguém ver | Monitor de saúde: alerta quando trânsito sai de ~zero |
| Nota a prazo entra PAGA (some do "A Pagar") | Regra auto-pago vs pendente clara |
| Importação duplicada (NFe 41387 2×) | Dedup por chave NFe (sem brecha, manual e DFe) |
| Lançamento PENDENTE deletado (FIN-00344) | Guarda de exclusão (bloqueia conciliado; confirma+loga pendente) |
| Taxa de cartão acumula em conta interna | Conferência por conta (não só banco) |

## Blueprint (fases)

### FASE 1 — Roteamento sem brecha (o coração) + Monitor
1. **Mapeamento Forma de Pagamento → Conta (obrigatório).** PIX/Boleto/TED → Banco; Cartão → conta do cartão; Dinheiro → Caixa. Configurável no cadastro do tenant. **Lançamento PAGO sem conta de destino resolvida NÃO cai silenciosamente no trânsito** — ou exige a conta, ou fica PENDENTE com aviso.
2. **Trânsito = staging EXPLÍCITO**, nunca destino final: toda entrada no trânsito tem **baixa obrigatória** (conciliação). 
3. **Monitor de saúde financeira** (check + painel): alerta quando (a) Conta de Passagem/Trânsito fora de ~zero acima de um limite; (b) lançamentos PAGOS sem conta de destino; (c) importações duplicadas; (d) conferência de saldo divergente. **Detecta o furo cedo, antes de virar bola de neve.**

### FASE 2 — Auto-pago vs Pendente + guardas
4. **Regra clara:** lançamento/nota **a prazo nasce PENDENTE** (não auto-paga); **à vista/cartão** pode auto-pagar (com a conta certa). Import respeita as duplicatas/cobrança da NFe (a prazo = pendente por ciclo) — ver `feature_config_rica_tabela.md`/import-com-parcelas (frente relacionada).
5. **Dedup de import por chave NFe** robusto (bloqueia manual + DFe duplicando a mesma chave).
6. **Guarda de exclusão:** bloquear excluir lançamento **conciliado/consolidado**; ao excluir **pendente**, confirmação forte + log de quem/quando/por quê. (Trava de mês fechado já existe — ClosedMonthGuard.)

### FASE 3 — Onboarding/seed do tenant
7. Tenant novo **nasce com as contas essenciais**: Caixa, Banco (placeholder editável), **Conta de Passagem (type=TRANSITO)**. Cartões criam a própria conta. Bloqueia operar sem o básico.
8. **Conferência por conta** (não só banco): cada conta interna tem saldo esperado (trânsito → ~0) + flag de divergência no painel.

## Regras (system-wide — candidatas a CLAUDE.md, confirmar com Juliano)
- **Nenhum lançamento PAGO sem conta de destino explícita.** Trânsito é staging, nunca destino final silencioso.
- **Toda entrada no trânsito tem baixa obrigatória** (conciliação) — e é monitorada.
- **A prazo nasce PENDENTE; à vista/cartão auto-paga** (com conta correta).

## Importante
- **Forward-looking:** não corrige o passado do SLS (o −151,27 é resíduo difuso, tratado à parte com ajuste rastreável se ele quiser).
- Implementar **em fases, com aprovação** (financeiro = exato; cada fase com simulação onde tocar saldo).
- Recomendação de início: **FASE 1** (roteamento + monitor) — maior valor, fecha a brecha-raiz e dá visibilidade.
