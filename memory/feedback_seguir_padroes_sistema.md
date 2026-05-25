# Seguir padroes do sistema — NUNCA inventar hardcode

## Regra (CLAUDE.md regra #9)

Antes de criar UI nova ou logica nova, **VERIFICAR se ja existe um padrao no codebase** pra resolver a mesma intencao. Templates prontos, componentes compartilhados, slots reutilizaveis. Estender o padrao existente, NUNCA criar um caminho paralelo "fora do esquema".

## Por que essa regra existe

Sistemas tem padroes. Quando voce cria "uma solucao especial" fora do padrao:
- Operador tem 2 lugares pra fazer a mesma coisa (confuso)
- Codigo dobra (regra duplicada)
- Manutencao explode (qualquer ajuste tem que ser feito em 2 lugares)
- "Inventou coisas hardcode" = palavra do usuario quando isso acontece

## Incidente v1.12.26 (25/05/2026)

**Pedido do usuario:** auto-selecao de produto da linha do coletor solar do orcamento deveria ter uma opcao "Usar coletor selecionado no Simulador Solar". O Simulador ja resolve qual coletor eh ideal — orcamento deveria herdar essa decisao.

**O que eu fiz (errado):** adicionei um checkbox grande "☀ Usar coletor selecionado no Simulador Solar" no TOPO do AutoSelectModal, fora do padrao. Quando marcado, esconde filtros/criterio. Card de fundo amarelo, label, info do coletor atual, aviso de erro.

**O que o usuario apontou:** "Parace que vc não está seguindo padrões do sistema está inventando coisas hardcode, coloque nas primeiras regras que tem que seguir padores do sistema, veja que a tela tem templates prontos pra filtro bomba de calor etc, crie um do mesmo padrão para buscar qual o coletor está selecionado na tela aquecimento"

**O padrao certo:** o AutoSelectModal tem uma lista `AUTOSELECT_TEMPLATES` com regras pre-configuradas (Filtro de piscina, Bomba do Coletor Solar, Bomba de Calor, Tubo, Kit Cascata, Kit SPA, etc). Cada template tem `icon`, `label`, `description`, `rule`. Clicar no template aplica a regra. Era so adicionar:

```ts
{
  icon: '☀',
  label: 'Coletor do Simulador Solar',
  description: 'Vincula a linha diretamente ao coletor selecionado no Simulador de Aquecimento Solar. Quando voce trocar o coletor no Simulador, esta linha acompanha automaticamente. Ignora filtros e criterio.',
  rule: {
    useSolarCollector: true,
  },
},
```

E o `applyAutoSelectTemplate` setar `useSolarCollector` no state. Pronto.

**Fix aplicado em v1.12.27:**
1. Removido o checkbox grande do topo do modal
2. Adicionado template novo "☀ Coletor do Simulador Solar" na lista AUTOSELECT_TEMPLATES
3. `applyAutoSelectTemplate` ganhou `setUseSolarCollector(!!t.rule.useSolarCollector)`
4. Regra de comportamento (`autoSelectRule.useSolarCollector`) e processing no backend mantidos — eles SAO o padrao certo. So a UI estava errada.

## Checklist anti-regressao

Antes de criar UI nova:
1. Ja existe um padrao no codebase que cobre essa intencao? (templates, componentes, slots)
2. Posso estender o padrao em vez de criar um caminho paralelo?
3. Se eu duplicar o caminho, o operador vai ter 2 jeitos de fazer a mesma coisa?

Se as respostas forem "sim/sim/sim", PARAR e usar o padrao existente.
