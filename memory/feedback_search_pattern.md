---
name: Search Pattern Standard
description: Padrao de busca multi-palavra em todos os campos de pesquisa do sistema - buildSearchWhere
type: feedback
---

Todos os campos de pesquisa do sistema devem usar busca multi-palavra (AND de ORs).

**Why:** Juliano definiu que digitar "jul tri" deve encontrar "Juliano Jose Triaca" mesmo que haja palavras no meio. Busca por substring simples (contains) nao funciona com termos separados.

**How to apply:**
- SEMPRE usar `buildSearchWhere()` de `common/util/build-search-where.ts` para campos diretos
- Para campos com relacoes Prisma (clientPartner.name, serviceOrder.title), usar pattern inline com words.map
- Cada palavra do input deve estar presente em pelo menos um dos campos pesquisados (AND de ORs)
- Ao criar QUALQUER novo endpoint com busca, usar este padrao
- O helper divide o search por espacos e cria: AND[OR[field contains word1], OR[field contains word2]]
- Campos sensíveis (document, phone) usam mode default; campos de texto (name, title) usam mode 'insensitive'
