# Gotcha — Edit tool falha ao casar caracteres especiais (CRLF / escapes unicode)

## Sintoma
O Edit tool retorna **"String to replace not found in file"** mesmo o `old_string` parecendo
idêntico ao arquivo. A nota do erro às vezes diz "tried swapping \uXXXX escapes... neither matched".

## Causas (vistas na pratica, v1.13.x, ReconciliationTab.tsx — arquivo CRLF)
1. **Caractere que esta como ESCAPE no fonte, mas eu digito o caractere real.** Ex: o fonte tem
   `"R$ 0,00 ✓"` (a sequencia literal `✓`, 6 chars), e eu coloco `✓` (1 char) no `old_string`.
   Nao casa.
2. **Unicode "exotico" que eu nao reproduzo identico:** travessao em-dash `—` (U+2014),
   `≠`, `…`, etc. Se o byte exato diverge, nao casa (o auto-swap do Edit so cobre `\uXXXX`, nao
   esses chars).
3. Cedilha/acento (`ç`, `ã`) em geral CASAM (sao unicode comum que digito consistente) — o problema
   e mais com escapes (`✓`) e em-dash.

## Solucao confiavel — script Node com indexOf por marcador ASCII + slice
Em vez de casar o trecho com o char especial, corta por **posicao de marcadores ASCII** e reescreve:
```js
const fs = require('fs');
let s = fs.readFileSync(f, 'utf8');
const eol = s.indexOf('\r\n') >= 0 ? '\r\n' : '\n';   // detecta CRLF/LF
const i = s.indexOf('{/* Marcador Inicio */}');         // marcadores SO ASCII
const j = s.indexOf('{/* Marcador Fim */}', i);
const lineStart = s.lastIndexOf('\n', i) + 1;            // preserva indentacao da 1a linha
const novo = [ '  linha1', '  linha2' ].join(eol);       // escrevo o char especial AQUI (UTF-8, sem casar)
s = s.slice(0, lineStart) + novo + s.slice(s.lastIndexOf('\n', j) + 1);
fs.writeFileSync(f, s, 'utf8');
```
- Para inserir preservando indentacao por ocorrencia: `s.replace(/(\r?\n)([ ]+)\{ancora\}/g, (m,nl,ind)=> nl+ind+novo+nl+ind+'{ancora}')`.
- Sempre rodar o `.js` por caminho ABSOLUTO (`node "C:/.../arquivo.js"`) — o cwd do Bash e compartilhado com o PowerShell.
- Adicionar checagem de seguranca (ex: `if (count !== 2) abort`) e `removed.includes('texto esperado')` antes de gravar.

## Regra pratica
- Edit tool e otimo pra trechos ASCII. Pra trechos com `✓`/em-dash/simbolos → ou copio o EXATO
  do Read (incluindo o `\uXXXX` como literal) ou uso o script Node. Nao insistir no Edit (perde tempo).
</content>
