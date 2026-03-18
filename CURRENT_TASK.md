# TAREFA ATUAL

## Versao: v1.04.66
## Ultima sessao: 136 (18/03/2026)

## Pendencias

### A FAZER
- **Fase 3 — Offline-first**: IndexedDB para OS locais + fila de sync (futuro)
- **Push Notifications**: Integrar Web Push API com backend (service worker ja preparado)
- **Testar fluxo OS direcionada no PWA**: Configurar workflow com {link_os} e testar tecnico recebendo OS no celular

### CONCLUIDO (sessao 136)
- **NfseServiceCode**: Modelo para servicos habilitados na prefeitura (cTribNac, NBS, LC116, CNAE, aliquota ISS)
- **CRUD service codes**: Endpoints GET/POST/PUT/DELETE em /nfse-emission/service-codes
- **Config fiscal**: Secao "Servicos Habilitados na Prefeitura" com tabela + form inline
- **Seletor com busca**: 335 codigos cTribNac da tabela oficial gov.br, busca sem acentos, auto-preenche codigo/descricao/LC116/tipo
- **Modal emissao NFS-e**: Dropdown de servico substitui campo read-only de cTribNac
- **NBS no payload**: codigo_nbs enviado ao Focus NFe no layout NACIONAL
- **Fallback**: Se nao houver service codes cadastrados, usa campos legados da config

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
