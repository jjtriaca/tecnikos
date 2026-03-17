# Tecnikos — Instrucoes para o Claude

## REGRAS DE SESSAO (NUNCA IGNORAR)
1. Ao INICIAR sessao: LER `ARCHITECTURE.md` e `CURRENT_TASK.md` ANTES de qualquer coisa
2. Claude decide toda a parte tecnica sozinho e executa sem perguntar — so para em decisoes de NEGOCIO
3. NUNCA confiar que a sessao vai durar — salvar progresso incrementalmente
4. Se a sessao anterior ficou incompleta, retomar do ponto exato registrado em CURRENT_TASK.md
5. Ao finalizar estudo/pesquisa: GRAVAR resultado em arquivo IMEDIATAMENTE
6. Quando o usuario der instrucao global/permanente: PERGUNTAR se quer gravar no CLAUDE.md
7. Ao fazer mudancas estruturais: ATUALIZAR ARCHITECTURE.md antes de encerrar
8. A CADA tarefa concluida: ATUALIZAR CURRENT_TASK.md

## AUTORIZACAO GERAL DO USUARIO
O usuario (Juliano) autoriza TODAS as acoes sem pedir confirmacao:
- WebSearch, WebFetch, Bash, Read, Write, Edit, Glob, Grep — TUDO liberado
- Edicoes, builds, dev servers, testes, deploys — EXECUTAR DIRETO
- NUNCA pedir "Permitir que o Claude...?"
- `.claude/settings.local.json` ja esta configurado com permissoes totais

## Dados do Projeto
- **Produto**: Tecnikos — SaaS B2B Field Service Management
- **Empresa**: SLS Obras LTDA (CNPJ: 47.226.599/0001-40)
- **Dominio**: tecnikos.com.br
- **Dono**: Juliano (@jjtriaca no GitHub)
- **Git**: https://github.com/jjtriaca/tecnikos (privado)
- **Stack**: NestJS + Prisma + PostgreSQL 16 + Next.js 15 + Tailwind CSS
- **Servidor**: Hetzner CPX21, IP: 178.156.240.163
- **Login Admin**: admin@tecnikos.com.br / Tecnikos2026!

## Deploy
```bash
bash scripts/deploy-remote.sh          # patch (ex: 1.04.33 → 1.04.34)
bash scripts/deploy-remote.sh minor    # minor (ex: 1.04.34 → 1.05.01)
```

## REGRA ABSOLUTA: Pagamento Asaas (NUNCA VIOLAR)
**NADA muda no sistema ate o webhook PAYMENT_CONFIRMED do Asaas retornar.**
1. Signup: Subscription=PENDING, Tenant=PENDING_PAYMENT. So ativa no webhook.
2. Upgrade: pendingPlanId salvo. Plano/limites so mudam no webhook.
3. Add-on: AddOnPurchase=PENDING. Limites creditados so no webhook.
4. Downgrade: Sem pagamento, agenda via pendingPlanId pro proximo ciclo.
5. NUNCA alterar Tenant.status, Subscription.status, Company.max* antes do pagamento.
6. Excecao: credito pro-rata 100% → aplicar imediatamente.

## ALERTA: APIs Externas com Risco de Ban
Ao trabalhar com Meta (WhatsApp) ou Focus NFe:
1. CONSULTAR `memory/whatsapp-lessons-learned.md` e `memory/whatsapp-business-api-research.md` ANTES
2. NUNCA implementar baseado em suposicoes — estudar docs oficiais
3. NUNCA multiplos deploys rapidos com mudancas de comportamento
4. TESTAR com 1 caso primeiro, nunca em producao direto
5. ATUALIZAR todos os arquivos de memoria ao aprender algo novo
6. IA embarcada tools: somente configs ADMIN, nunca janela de entrada
7. Sincronismo: atualizar memory + tools + wizard + prompt ao mudar algo

## Padroes de Codigo Obrigatorios

### Tabelas (System-Wide)
- SEMPRE usar: DraggableHeader + SortableHeader + FilterBar + Pagination
- SEMPRE usar: useTableParams({ persistKey }) + useTableLayout(tableId, columns)
- Tipos: ColumnDefinition<T> e FilterDefinition de @/lib/types/table
- NUNCA usar <th> plain ou renderPagination() customizado

### Variaveis em Campos de Texto (System-Wide)
- Campos textarea/input com variaveis: DEVEM ter botoes chip clicaveis
- Clicar insere {variavel} na posicao do cursor (useRef + selectionStart/selectionEnd)
- Visual: text-[10px], bg-slate-100, hover:bg-green-100
- TODOS os placeholders devem ter texto exemplo realista (NUNCA vazio)

### Convencoes Gerais
- Commits: conventional commits (feat:, fix:, release:)
- Codigo: ingles | UI: portugues brasileiro
- Sem acentos em nomes de arquivo
- CSS: Tailwind utility classes, design system slate/blue
- NUNCA usar Preview Screenshot (trava o chat) — usar preview_snapshot/preview_inspect

## Organizacao de Documentacao
| Arquivo | Funcao |
|---------|--------|
| CLAUDE.md | Regras e instrucoes para o Claude (este arquivo) |
| ARCHITECTURE.md | Mapa tecnico completo do sistema |
| CURRENT_TASK.md | Versao atual + lista de pendencias |
| memory/ | Memorias persistentes (alertas, decisoes, estudos) |
