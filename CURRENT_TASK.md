# TAREFA ATUAL

## Versao: v1.04.52
## Ultima sessao: 135 (17/03/2026)

## Pendencias

### A FAZER
- **Fase 3 — Offline-first**: IndexedDB para OS locais + fila de sync (futuro)
- **Push Notifications**: Integrar Web Push API com backend (service worker ja preparado)

### CONCLUIDO (sessao 135)
- **Auth sem senha para tecnicos**: Login por OTP via WhatsApp (telefone + codigo 6 digitos)
- **OtpService reutilizavel**: Extraido do PublicOfferService, usado por tech-auth e public-offer
- **Login por token**: Endpoint POST /tech-auth/token/:token (boas-vindas + OS)
- **Token de OS valido ate APROVADA/CANCELADA**: Nao expira por tempo, expira por status
- **Pagina /tech/setup/[token]**: Primeiro acesso com auto-login + tutorial PWA install
- **Welcome message atualizado**: Link agora aponta para /tech/setup/{token}
- **Senha removida do cadastro de tecnico**: Campo substituido por aviso sobre OTP

### CONCLUIDO (sessao 134)
- **Template boas_vindas com params individuais**: sendWithNamedTemplate agora suporta templateParams[] ({{1}}=nome, {{2}}=link)

### CONCLUIDO (sessao 133)
- **Trigger selector no editor visual**: Dropdown agrupado por entidade (OS / Parceiros)
- **V2 workflow engine para onboarding**: Backend executa NOTIFY blocks de workflows V2
- **Variable chips no NOTIFY**: {nome}, {empresa}, {link_app}
- **iOS Safari install tutorial**: Modal step-by-step com 3 passos visuais

### CONCLUIDO (sessoes anteriores)
- PWA completo, Service Worker, Install prompt
- Tech order page redesenhada, Editor visual de workflow
- Sentry, CI/CD, Testes automatizados
- Avaliacao/Feedback, Sugestoes, CNPJ readonly, Contrato SaaS

### BLOQUEADO
- (nenhum)
