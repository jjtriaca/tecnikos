# Plano: auto-seleção da Grade de Fundo (Ralo) conforme NBR 10339

**Pedido (Juliano, 11/06/2026):** na linha "Ralos de fundo" do orçamento, um template que (1) soma a vazão das bombas
de linhas que o operador aponta e seleciona a grade de fundo que aguenta essa vazão, e (2) põe fórmula na quantidade
(NBR exige **mínimo 2 ralos**, e cada ralo tem que aguentar a vazão TOTAL sozinho — anti-aprisionamento/sucção).

## Decisões do usuário (travadas)
1. **Vazão da grade = CADASTRADA** no campo "Vazão máxima (m³/h)" = `technicalSpecs.vazaoM3h`.
   ✅ **JÁ FEITO pelo usuário** (ele preencheu a vazão nas grades). Esse campo no cadastro (products/page.tsx L2110-2113)
   é literalmente documentado: *"usada APENAS pra dimensionar vazão de ralo de fundo e tempo de filtragem"*. Campo certo.
2. **Quais bombas:** o operador APONTA as linhas (não auto-soma tudo). Usar `prod(Lx,"vazaoM3h")`.
3. **Quantidade de bombas importa:** uma linha pode ter N bombas → contar `vazão × qtd da linha`.
4. **Sem grade grande o bastante:** mantém **2** e AVISA (indicador vermelho). NÃO escala a qtd automaticamente.

## Lógica final
- **Vazão total** = Σ (vazão × qtd) das linhas de bomba apontadas.
- **Seleção da grade** = menor grade cuja `vazaoM3h` (capacidade) ≥ vazão total (cada ralo aguenta tudo sozinho).
- **Quantidade da linha** = `2` (mínimo NBR, fórmula travada).
- **Indicador de folga** = `(vazaoM3h - vazaoTotal)/vazaoTotal*100` → vermelho se <0 (nenhuma grade aguenta), amarelo justo, verde folgado.

## Fato técnico CHAVE (o que falta no motor)
- O `where` da auto-seleção (`auto-select.helper.ts` `substituteVars` L102-115) **suporta `prod(Lx,"spec")`** (cross-line)
  mas **NÃO suporta `qty(Lx)`**. A engine de fórmula (`formula-eval.ts`) tem qty via `CellRefData {qty,total,unitPrice,specs}`.
- `cellRefSpecs: Map<cellRef, specs>` (só specs, sem qtd) é montado em ~4 lugares (memória feedback_autoselect_vars):
  backend `pool-budget.service.ts` (recalc) + endpoint de preview + frontend `quotes/pool/[id]/page.tsx` (preview do modal) + AutoSelectModal.

## Build (a fazer — precisa DEPLOY, perguntar antes)
1. **Motor — suportar `qty(Lx)` no `where`:** injetar a qtd da linha no `cellRefSpecs` (ex: chave reservada `qtdLinha`)
   nos build-sites, e em `substituteVars` (auto-select.helper) traduzir `qty(Lx)` → a qtd injetada. Espelhar nos ~4 lugares.
   (Alternativa mínima: template usa `prod(Lx,"qtdLinha")` direto, sem mexer em substituteVars — mas `qty(Lx)` é mais limpo.)
2. **Template "Grade de fundo (NBR 10339)"** em `AUTOSELECT_TEMPLATES` (frontend `quotes/pool/[id]/page.tsx`):
   - `filterDescription: "grade"` (operador refina; conferir poolType real das grades).
   - `where: "vazaoM3h >= prod(L1,\"vazaoM3h\")*qty(L1)"` — operador troca L1 pela(s) linha(s) da(s) bomba(s), soma +.
   - `orderBy: "vazaoM3h asc"` (menor grade que aguenta — evita superdimensionar).
   - `indicator`: folga `(vazaoM3h - (prod(...)*qty(...)))/(prod(...)*qty(...))*100`, levels [<0 vermelho "use grade maior", <20 amarelo "justo", verde "folgado"].
3. **Quantidade** = template/fórmula `2` na linha do ralo (mínimo NBR).

## Workflow do operador (depois de pronto)
1. (✅ já fez) cadastrar vazão máx nas grades.
2. Linha "Ralos de fundo" → ✨ → template "Grade de fundo (NBR 10339)".
3. Apontar as linhas das bombas (troca os L1 pela(s) linha(s) real(is)).
4. Quantidade nasce 2.

⚠️ SEGURANÇA: a regra "cada ralo aguenta a vazão total sozinho" é anti-aprisionamento — NÃO afrouxar sem o usuário.
