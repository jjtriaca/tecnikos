# TAREFA ATUAL

## Versao: v1.04.71
## Ultima sessao: 136 (18/03/2026)

## Pendencias

### A FAZER
- **Fase 3 — Offline-first**: IndexedDB para OS locais + fila de sync (futuro)
- **Push Notifications**: Integrar Web Push API com backend (service worker ja preparado)
- **Testar fluxo OS direcionada no PWA**: Configurar workflow com {link_os} e testar tecnico recebendo OS no celular
- **TenantMigratorService**: Corrigir copia de FKs ao criar tabelas novas em tenant schemas (DROP FK do public)

### CONCLUIDO (sessao 136)
- **NfseServiceCode**: Servicos habilitados na prefeitura (cTribNac, LC116, CNAE, aliquota ISS)
- **Seletor cTribNac com busca**: 335 codigos da tabela oficial gov.br, busca sem acentos
- **NBS no modal emissao**: Campo com busca em 820 codigos NBS (opção B — busca livre)
- **Dropdown servico na emissao**: Substitui campo read-only de cTribNac
- **PDF com nome legivel**: NFS-e {numero} {cliente}.pdf
- **PartnerContact**: Modelo para contatos multiplos (email/WhatsApp) por parceiro
- **Seed contatos**: 1118 emails + 1480 WhatsApp migrados dos parceiros existentes
- **Seletor contatos na emissao**: Na fase SEND, radio buttons com contatos + "+ Novo" salva no parceiro
- **Gestao contatos no parceiro**: Secao "Contatos" no formulario de edicao com CRUD completo
- **Fix ENCRYPTION_KEY**: Removida key errada do .env.production (fallback JWT_SECRET)
- **Fix FK tenant schema**: FKs do public removidas para NfseServiceCode/PartnerContact

### CONCLUIDO (sessao 135)
- Auth sem senha para tecnicos (OTP WhatsApp), Login por token, Setup PWA, Link OS
- Contrato pendente, Aceite expandido, Variaveis de link separadas

### CONCLUIDO (sessoes anteriores)
- Template boas_vindas, Trigger selector, V2 workflow engine, Variable chips
- PWA completo, Service Worker, Install prompt, iOS Safari tutorial
- Tech order page redesenhada, Editor visual de workflow
- Sentry, CI/CD, Testes automatizados
- Avaliacao/Feedback, Sugestoes, CNPJ readonly, Contrato SaaS

### BLOQUEADO
- (nenhum)
