# TAREFA ATUAL — Leia este arquivo ao reconectar

## Status: SESSAO 121 — Security Hardening + Access Geo (CONCLUIDO)

## Ultima sessao: 121 (14/03/2026)
- Sessao 118: Admin Host isolado + Migracao de dados completa (v1.02.59)
- Sessao 119: Remocao login do dominio raiz + domain-aware routing (v1.02.63)
- Sessao 120: Triggers, Conflito, Especializacao, Templates, Client Onboarding (v1.02.64-71)
- Sessao 121: Security Hardening + Access Geo (v1.02.72-73)

## O que foi feito nesta sessao:

### Auditoria de Seguranca do Servidor
- [x] Verificacao CPU/processos: LIMPO, sem mineracao
- [x] fail2ban ativo: SSH (2178 falhas, 413 banidos, 19 ativos)
- [x] 777 tentativas SSH em 24h — ja bloqueadas
- [x] Analise nginx: 7409 requests/24h, scanners identificados (89.248.168.239, 45.79.190.208, 185.16.39.146)

### Hardening nginx (v1.02.72-73)
- [x] Bloqueio de arquivos sensiveis (.env, .git, .svn, .htaccess, .sql, .yml, etc)
- [x] Bloqueio de paths CMS (wp-admin, phpmyadmin, adminer, cgi-bin)
- [x] Bloqueio de extensoes perigosas (.php, .asp, .aspx, .jsp, .cgi, .pl)
- [x] Bloqueio de user-agents de scanners (nmap, nikto, sqlmap, dirbuster, masscan, zgrab, censys, shodan, nuclei)
- [x] Todas as rotas bloqueadas retornam HTTP 444 (connection drop) com log em /var/log/nginx/blocked.log

### fail2ban — Novas Jails
- [x] `nginx-scanner`: bane IPs que tentam acessar paths bloqueados (3 retries, 24h ban)
- [x] `nginx-login-bf`: bane IPs com tentativas de login falhas na API (10 retries, 1h ban)
- [x] 3 jails ativas: sshd + nginx-scanner + nginx-login-bf

### SSH Hardening
- [x] PasswordAuthentication no (apenas chave SSH)
- [x] PermitRootLogin prohibit-password (chave obrigatoria)

### Backend: Endpoint Access-24h com Geolocalizacao
- [x] GET /admin/tenants/analytics/access-24h
- [x] Consulta SaasEvent ultimas 24h, agrupa por IP
- [x] Geo-IP via ip-api.com batch API (pais, cidade, estado, ISP)
- [x] Classifica Brasil vs estrangeiro
- [x] Retorna: totalEvents, externalEvents, uniqueIps, foreignAccess[], brazilAccess[]

### Admin Frontend: Widgets de Seguranca 24h
- [x] Card "Acessos 24h" com total de eventos externos
- [x] Card "IPs Unicos 24h" com contagem de sessoes
- [x] Card "Brasil" com IPs brasileiros (verde)
- [x] Card "Fora do Brasil" com alerta vermelho se detectado
- [x] Banner vermelho de alerta com tabela detalhada de IPs estrangeiros (pais, cidade, ISP, eventos)
- [x] Secao colapsavel "Acessos do Brasil" com top 10 IPs brasileiros
- [x] Deploy v1.02.73

## Arquivos modificados:
- `nginx/nginx.conf` — Bloqueio de scanners, arquivos sensiveis, user-agents
- `backend/src/tenant/tenant.controller.ts` — Endpoint /analytics/access-24h com geo-IP
- `frontend/src/app/(dashboard)/ctrl-zr8k2x/page.tsx` — Widgets de seguranca 24h + alertas estrangeiros

## Arquivos no servidor (aplicados via SSH direto):
- `/etc/fail2ban/filter.d/nginx-scanner.conf` — Filtro de scanners
- `/etc/fail2ban/filter.d/nginx-login-bf.conf` — Filtro de brute force de login
- `/etc/fail2ban/jail.local` — 3 jails (sshd, nginx-scanner, nginx-login-bf)
- `/etc/ssh/sshd_config` — SSH key-only

### Supplier Onboarding + Fix Retorno (v1.02.74)
- [x] Label "Um retorno e criado" corrigido para "Uma OS de retorno e criada"
- [x] SupplierOnboardingConfig type + createDefaultSupplierOnboarding()
- [x] Contrato padrao "Contrato de Fornecimento de Materiais e Servicos" (7 clausulas)
- [x] SupplierOnboardingSection.tsx: UI completa (contrato + mensagem + reply) tema amber
- [x] workflow/page.tsx: partner_supplier_created no isOnboardingTrigger
- [x] compileToV2/decompileFromV2 persistem supplierOnboarding
- [x] Deploy v1.02.74

### Analytics 24h nos Cards (v1.02.75)
- [x] Backend: access-24h retorna signupStarts24h, signupComplete24h, externalSessions24h, externalPageviews24h, conversionRate24h
- [x] Frontend: interface Access24h atualizada com novos campos
- [x] Frontend: sub-linha azul "24h: X" em cada um dos 4 cards de analytics (Visitantes Reais, Signups, Conversoes, Taxa)
- [x] Deploy v1.02.75

### Toggle Ativar/Desativar Fluxo (v1.02.76)
- [x] Prisma: campo isActive (Boolean, default true) no WorkflowTemplate
- [x] Migration 20260314020000_workflow_is_active
- [x] Backend: findAll retorna isActive, update aceita isActive
- [x] Frontend: toggle switch nos cards da listagem (verde=ativo, cinza=inativo)
- [x] Card fica com opacity-60 + barra cinza quando inativo + badge "Inativo"
- [x] Deploy v1.02.76

## Versao atual: v1.02.76 (em producao)

## Regras permanentes (decididas pelo Juliano):
- Claude decide toda a parte tecnica sozinho e executa sem perguntar
- Registrar SEMPRE em CHAT_LOG.md e PROJETO_LOG.md
- Build e verificar antes de encerrar qualquer sessao
- Versao em version.json sempre atualizada
- Variaveis em campos de texto: SEMPRE clicaveis (botoes chip que inserem no cursor)
- NUNCA usar Preview Screenshot — trava o chat. Usar preview_snapshot/preview_inspect.
