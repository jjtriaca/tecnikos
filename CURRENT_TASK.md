# TAREFA ATUAL

## Versao: v1.04.58
## Ultima sessao: 135 (17/03/2026)

## Pendencias

### A FAZER
- **Fase 3 — Offline-first**: IndexedDB para OS locais + fila de sync (futuro)
- **Push Notifications**: Integrar Web Push API com backend (service worker ja preparado)

### CONCLUIDO (sessao 135)
- **Auth sem senha para tecnicos**: Login por OTP via WhatsApp (telefone + codigo 6 digitos)
- **OtpService reutilizavel**: Extraido do PublicOfferService, usado por tech-auth
- **Login por token**: POST /tech-auth/token/:token (boas-vindas + OS)
- **Token de OS valido ate APROVADA/CANCELADA**: Nao expira por tempo, expira por status
- **Pagina /tech/setup/[token]**: Primeiro acesso com auto-login + tutorial PWA install
- **Welcome message atualizado**: Link aponta para /tech/setup/{token}
- **Senha removida do cadastro de tecnico**: Campo substituido por aviso sobre OTP
- **Cookie path fix**: tech_refresh_token com path=/ para funcionar via rewrite Next.js
- **Auth refresh fix**: Sessoes de tecnico nao crasham o refresh do dashboard
- **Filtro por tecnico na listagem OS**: GET /service-orders filtra por assignedPartnerId quando JWT e de tecnico
- **Frontend orders fix**: Lida com formato paginado {data, total}
- **Fluxo contrato pendente**: Se "incluir link de aceite" ativo, redireciona para /contract/{token} antes de logar

### CONCLUIDO (sessoes anteriores)
- Template boas_vindas, Trigger selector, V2 workflow engine, Variable chips
- PWA completo, Service Worker, Install prompt, iOS Safari tutorial
- Tech order page redesenhada, Editor visual de workflow
- Sentry, CI/CD, Testes automatizados
- Avaliacao/Feedback, Sugestoes, CNPJ readonly, Contrato SaaS

### BLOQUEADO
- (nenhum)
