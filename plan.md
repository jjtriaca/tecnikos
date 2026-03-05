# Plano: Reorganizar Sidebar + Tela de Servicos

## O que fazer

### 1. Sidebar — Reorganizar itens existentes em subgrupos
- **Cadastros** (grupo) → Parceiros, Produtos, Servicos (novo)
- **Financas** (grupo) → Financeiro, Resultados (novo)
- Remover Parceiros, Produtos e Financeiro como itens avulsos

### 2. Pagina /results — Mover tabs existentes
- Mover AccountsTab (Plano Contas) e DreReport (DRE) para nova rota /results
- Remover essas tabs da /finance (ficam so as operacionais)

### 3. Servicos — Unica coisa realmente nova
- Backend: model Service + CRUD (similar a Product)
- Frontend: tela /services com tabela padrao
- Campos: codigo, nome, descricao, unidade (HR/SV/UN), preco, categoria, ativo

### 4. Build + Deploy
