# TAREFA ATUAL — Leia este arquivo ao reconectar

## Status: SESSAO 85 CONCLUIDA — Fix WhatsApp Template Delivery

## Ultima sessao: 85 (10/03/2026)
- Sessoes 61-62: Dashboard Financeiro + Auditoria (v1.01.18-19)
- Sessao 63: Fix NFe Import Flow (v1.01.20)
- Sessoes 64-68: 4 estudos fiscais completos
- Sessao 69-70: Fase 1 — Fundacao Fiscal (regime, contabilista, impostos NFe)
- Sessao 71: Fase 2 — NFS-e de Entrada + Fase 3 — Escrituracao e Relatorios (v1.01.22)
- Sessao 72: Fase 4 — Geracao SPED + Deploy v1.01.23
- Sessao 73: WhatsApp Test Send + Modulo Email SMTP + Fix + Privacy Page (v1.01.24-27)
- Sessao 74: Zoho Mail DNS + Logo Tecnikos + Deploy v1.01.28
- Sessao 75: Manifestacao do Destinatario + Fix IMPORTED + Deploy v1.01.29-30
- Sessao 76: Finalidade Fiscal + Acoes Primeira Coluna + DraggableHeader em tudo (v1.01.31)
- Sessao 77: Codigos Sequenciais (SKU) + Deteccao Duplicados (v1.01.32)
- Sessao 78: Reverter Importacao NFe (v1.01.39) + WhatsApp Business API (v1.01.56)
- Sessao 79: Instrumentos de Pagamento (v1.01.58)
- Sessao 80: Contratos de Tecnico (onboarding via workflow) (v1.01.68-72)
- Sessao 81: Enderecos de Atendimento + Fix Agenda + Seletor Endereco OS (v1.01.78-79)
- Sessao 82: Collapsible Sections + Comissao Tecnico + Retorno Atendimento (v1.01.80-81)
- Sessao 83: Botao Confirmar (Finalizar OS) + Botao Retorno (v1.01.82)
- Sessao 84: Verificacao WABA + Regime CLT Onboarding (v1.01.83)
- Sessao 85: Fix WhatsApp Template + Profile Picture Sync (v1.01.84-85)

## O que foi feito na sessao 85:

### Fix WhatsApp Template Delivery (v1.01.84)
- [x] Diagnostico: mensagem de boas-vindas CLT marcada como SENT mas nao entregue
- [x] Root cause: Meta aceita texto via API (200 OK) mesmo fora da janela 24h, mas nao entrega
  - sendTextWithTemplateFallback() retornava true no texto, nunca tentava template fallback
- [x] Fix: adicionado parametro `forceTemplate` em sendTextWithTemplateFallback()
  - Quando true, pula tentativa de texto e vai direto para template
- [x] NotificationService: propagado `forceTemplate` via SendNotificationDto
- [x] ContractService: marcado `forceTemplate: true` para WELCOME_SENT e CONTRACT_SENT
- [x] Verificado templates Meta: notificacao_tecnikos APPROVED com {{1}} parametro
- [x] Teste direto via API: template enviado com sucesso (200, message accepted)
- [x] Deploy: v1.01.84 em producao

### WhatsApp Profile Picture Sync (v1.01.85)
- [x] Foto de perfil WhatsApp = logo da empresa (SLS), nao do Teknikos
- [x] Upload logo SLS via Meta API: success
- [x] Prisma: metaAppId adicionado ao WhatsAppConfig
- [x] Migration: 20260310001500_add_meta_app_id
- [x] WhatsAppService.syncProfilePicture(): auto-sync logo como foto de perfil
  - Chamado em saveConfig() e uploadLogo()
- [x] Frontend: campo App ID na pagina de config WhatsApp
- [x] CompanyService: injecao WhatsAppService para sync apos upload logo
- [x] Build: backend 0 erros, frontend 0 erros
- [x] Deploy: v1.01.85 em producao

## Versao atual: v1.01.85 — em producao

## IDs importantes WhatsApp Meta:
- WABA ID: 1421505052856896 (SLS Sol e Lazer Solucoes) — REATIVADA
- Business ID: 2115296342089072
- Phone Number ID: 996592133539837
- App ID: 950743807617295
- System User ID: 122102184027217286

## Status WhatsApp:
- [x] WABA: LIVE, quality GREEN
- [x] Templates: notificacao_tecnikos APPROVED, teste_conexao APPROVED, hello_world APPROVED
- [x] Business verification: COMPLETA
- [ ] Corrigir website no perfil: tecnicos.com.br → tecnikos.com.br (Juliano faz manual)

## Se reconectar no MEIO de uma tarefa:
- Verifique o TODO list no Claude (se existir)
- Leia o ultimo bloco do CHAT_LOG.md para contexto
- Continue exatamente do ponto onde parou
- NAO pergunte ao Juliano — ele autorizou execucao irrestrita

## Regras permanentes (decididas pelo Juliano):
- Claude decide toda a parte tecnica sozinho e executa sem perguntar
- Registrar SEMPRE em CHAT_LOG.md e PROJETO_LOG.md
- Build e verificar antes de encerrar qualquer sessao
- Versao em version.json sempre atualizada
