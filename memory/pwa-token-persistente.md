# PWA Token Persistente — Plano Conceitual

## Status: A PLANEJAR (discutido em 21/03/2026)

## Conceito do Juliano
- Cada tecnico recebe um **token pessoal permanente** vinculado ao numero do celular
- Token salvo no **localStorage do PWA** (sobrevive fechamento do app)
- Toda vez que recebe link da Tecnikos, token pessoal é reconfirmado/atualizado
- Troca de aparelho → novo PWA → novo link → token migra automaticamente
- Oferta publica aceita → vinculada ao token do tecnico → outros veem "ja aceito"

## Analise Tecnica
### O que ja existe:
- refreshToken em cookie httpOnly (pode ser limpo pelo browser)
- OTP por telefone (vincula ao numero)
- loginWithToken (per-OS, one-time)

### O que falta:
1. **deviceToken no localStorage** — persistente, sobrevive fechamento do app
2. **Auto-recover na reabertura** — checar deviceToken → reautenticar → ir para /tech/orders
3. **Pagina /tech/os/[token]** — checar sessao ativa antes de tentar loginWithToken

### Riscos:
- localStorage pode ser limpo pelo usuario (limpar dados do site)
- Seguranca: token no localStorage é acessivel via JS (XSS risk) — mitigar com token curto + refresh server-side
- Multiplos dispositivos: precisa decidir se permite ou não

### Problema atual:
- Tecnico fecha app → reabre → browser vai para /tech/os/[token] → token ja foi revogado → "Link invalido"
- O refreshToken cookie PODE estar valido mas a pagina nao tenta usar — vai direto no loginWithToken
