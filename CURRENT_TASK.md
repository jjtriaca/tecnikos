# TAREFA ATUAL

## Versao: v1.04.92
## Ultima sessao: 139 (18/03/2026)

## Pendencias

### A FAZER (PRIORIDADE)
- **Bug 1 pos-deploy**: Chamar PATCH /tenants/{sls-tenant-id}/fix-subscription para corrigir status SLS

### A FAZER
- **Token revenda no admin**: Mover FOCUS_NFE_RESELLER_TOKEN de .env para painel admin SaaS
- **Fase 3 — Offline-first**: IndexedDB para OS locais + fila de sync (futuro)
- **Push Notifications**: Integrar Web Push API com backend (service worker ja preparado)
- **TenantMigratorService**: Corrigir copia de FKs ao criar tabelas novas em tenant schemas

### CONCLUIDO (sessao 139)
- **Promo upfront**: Promocoes com duracao (PIONEIRO) agora cobram todos os meses de uma vez (6×R$15=R$90)
- **Webhook upfront**: Primeiro pagamento marca promo como paga, atualiza Asaas para preco cheio, nextDueDate apos periodo promo
- **Protecao SLS**: SLS mantem fluxo mensal existente (promotionMonthsLeft ja decrementado a 0 no DB)
- **Fix billing "Pagamento atrasado"**: Endpoint admin PATCH /tenants/:id/fix-subscription para corrigir status
- **Fix MRR real**: getMetrics() calcula MRR com valor efetivo (promocoes + ciclo anual)
- **Fix ciclo billing**: monthlyUsage() usa currentPeriodStart/End da Subscription (nao mes calendario)
- **Fix textos billing**: "Uso neste ciclo" + "transacoes" em vez de "Uso de OS" + "OS"

### CONCLUIDO (sessao 138)
- **Cancelamento 2 etapas**: Status CANCELLING + retry (GET query + DELETE) para municipios com duplo cancelamento
- **Frontend CANCELLING**: Badge laranja "Cancelando" + botao refresh para confirmar cancelamento
- **FOCUS_NFE_RESELLER_TOKEN**: Configurado no .env.production (plano Start ativo, token producao)
- **API de Empresas testada**: GET /v2/empresas retorna SLS Obras (ID: 192027) com sucesso
- **Tokens atualizados**: Prod e homolog novos salvos no NfseConfig + focusNfeCompanyId=192027
- **Enforcement NFS-e 1:1 com OS**: NFS-e avulsa conta como transacao no limite maxOsPerMonth
- **Enforcement em todos os pontos**: create OS, duplicate OS, emit NFS-e, createOsFromQuote
- **monthlyUsage breakdown**: Retorna osCount + avulsaNfseCount separados
- **Billing page breakdown**: Mostra "9 OS + 4 NFS-e avulsas" abaixo da barra de progresso
- **Bug cancelamento Focus NFe**: Ticket #216000 aberto — Focus nao sincroniza cancelamento da prefeitura (Primavera do Leste/MT)
- **Plano Focus Start contratado**: R$113,90/mes, 3 CNPJs, 100 notas/CNPJ, primeiro boleto maio/2026

### CONCLUIDO (sessao 137)
- **Wizard IA NFS-e**: 7 steps guiados via ChatIA (registro auto, certificado, IBGE, servicos, ISS, validacao, teste)
- **Tools wizard**: verificar_fiscal_completo, buscar_municipio_ibge, salvar_codigo_ibge, listar_servicos_nfse, registrar_empresa_focus
- **Deteccao proativa**: Fiscal incompleto detectado automaticamente no buildContextPrefix
- **Trigger manual**: "Como configurar NFS-e?" ativa wizard pelo system prompt
- **Action buttons fiscais**: Patterns expandidos (cadastrar servico, emitir nota, certificado)
- **API de Empresas Focus NFe (Revenda)**: FocusNfeProvider com createEmpresa/getEmpresa/updateEmpresa
- **Registro automatico**: NfseEmissionService.registerOrUpdateEmpresa() cadastra CNPJ na Focus NFe via token de revenda
- **Upload certificado**: NfseEmissionService.uploadCertificate() envia e-CNPJ A1 para Focus NFe
- **Endpoints**: POST config/register-empresa, POST config/upload-certificate
- **Modelo revenda centralizada**: Tecnikos gerencia CNPJs via FOCUS_NFE_RESELLER_TOKEN (env var)

### CONCLUIDO (sessao 136)
- **NfseServiceCode**: Servicos habilitados na prefeitura com busca em 335 codigos cTribNac
- **NBS no modal emissao**: Busca livre em 820 codigos NBS
- **Dropdown servico na emissao**: Substitui campo read-only de cTribNac
- **PDF com nome legivel**: NFS-e {numero} {cliente}.pdf (download com Content-Disposition)
- **PartnerContact**: Modelo contatos multiplos (email/WhatsApp) por parceiro, 2598 seedados
- **Seletor contatos na emissao**: Radio buttons com contatos + "+ Novo" salva no parceiro
- **Gestao contatos no parceiro**: Secao "Contatos" no formulario de edicao com CRUD
- **Tokens por ambiente**: Token producao e homologacao separados, troca automatica
- **Banner homologacao**: Aviso pulsante no modal de emissao em ambiente de teste
- **Sidebar accordion**: Apenas 1 submenu aberto por vez
- **LookupField inline**: Busca ao digitar sem precisar clicar na lupa
- **Mascara moeda**: Campo valor com R$ e formatacao automatica
- **Modal cancelamento NFS-e**: Textarea com validacao 15 chars, erro inline
- **Fix aliquota ISS**: Virgula/ponto aceitos (2,32 → 2.32), mascara no campo
- **Fix ENCRYPTION_KEY**: Removida key errada, fallback JWT_SECRET restaurado
- **Fix FK tenant schema**: FKs do public removidas para novas tabelas
- **P1.1 Orientacao Focus NFe**: Bloco instrucoes + botao Testar Conexao
- **P1.2 Pre-flight validation**: Checklist no modal antes de emitir
- **P1.3 Onboarding fiscal**: ChatIA verifica token, IBGE, service codes
- **P1.4 Mapeamento erros**: 9 padroes Focus NFe → mensagens em portugues
- **Filtro NFS-e no financeiro**: Dropdown Sem nota/Autorizada/Erro/Cancelada
- **Cancelamento libera lancamento**: nfseStatus e nfseEmissionId limpos para reemissao

### CONCLUIDO (sessao 135)
- Auth sem senha para tecnicos (OTP WhatsApp), Login por token, Setup PWA, Link OS

### BLOQUEADO
- (nenhum)
