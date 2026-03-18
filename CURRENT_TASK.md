# TAREFA ATUAL

## Versao: v1.04.63
## Ultima sessao: 135 (17/03/2026)

## Pendencias

### A FAZER
- **Fase 3 — Offline-first**: IndexedDB para OS locais + fila de sync (futuro)
- **Push Notifications**: Integrar Web Push API com backend (service worker ja preparado)
- **Testar fluxo OS direcionada no PWA**: Configurar workflow com {link_os} e testar tecnico recebendo OS no celular

### CONCLUIDO (sessao 135)
- **Auth sem senha para tecnicos**: Login por OTP via WhatsApp (telefone + codigo 6 digitos)
- **OtpService reutilizavel**: Extraido do PublicOfferService, usado por tech-auth
- **Login por token**: POST /tech-auth/token/:token (boas-vindas + OS)
- **Token de OS valido ate APROVADA/CANCELADA**: Nao expira por tempo, expira por status
- **Pagina /tech/setup/[token]**: Primeiro acesso com auto-login + tutorial PWA install
- **Pagina /tech/os/[token]**: Link de OS auto-loga e redireciona direto para a OS no PWA
- **Welcome message atualizado**: Link aponta para /tech/setup/{token}
- **Senha removida do cadastro de tecnico**: Campo substituido por aviso sobre OTP
- **Cookie path fix**: tech_refresh_token com path=/ para funcionar via rewrite Next.js
- **Auth refresh fix**: Sessoes de tecnico nao crasham o refresh do dashboard
- **Filtro por tecnico na listagem OS**: GET /service-orders filtra por assignedPartnerId quando JWT e de tecnico
- **Frontend orders fix**: Lida com formato paginado {data, total}
- **Fluxo contrato pendente**: Se "incluir link de aceite" ativo, redireciona para /contract/{token}
- **Incluir link de aceite expandido**: Confirmacao simples vs Contrato (com nome, conteudo, assinatura digital)
- **Backend V2 onboarding com contrato**: Envia contrato PJ via sendContract() quando acceptanceType=contract
- **Variaveis de link separadas**: {link_app}=Link Primeiro Acesso, {link_os}=Link da OS
- **Link OS no PWA**: Notificacao de OS agora gera link /tech/os/{token} (abre no PWA)

### CONCLUIDO (sessoes anteriores)
- Template boas_vindas, Trigger selector, V2 workflow engine, Variable chips
- PWA completo, Service Worker, Install prompt, iOS Safari tutorial
- Tech order page redesenhada, Editor visual de workflow
- Sentry, CI/CD, Testes automatizados
- Avaliacao/Feedback, Sugestoes, CNPJ readonly, Contrato SaaS

### BLOQUEADO
- (nenhum)
