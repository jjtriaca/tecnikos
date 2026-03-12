# TAREFA ATUAL — Leia este arquivo ao reconectar

## Status: SESSAO 110 — Fix Galeria Selfie + Asaas API Key

## Ultima sessao: 110 (12/03/2026)
- Sessao 97: SMTP + Chat IA backend + frontend
- Sessao 98: Chat IA Deploy + Streaming + Asaas + Wizards (v1.02.18-24)
- Sessao 99-100: Modulo de Orcamentos COMPLETO
- Sessao 101: Senha Forte no Signup + Convites + Reset Password
- Sessao 102-103: Verificacao Manual de Documentos COMPLETO
- Sessao 104: Fixes Signup + Rastreamento + UTM + Asaas (v1.02.25-30)
- Sessao 105: Emissao NFS-e + Analytics Tooltips (build OK)
- Sessao 106: Deploy v1.02.31-32 — NFS-e + Gatilho no Fluxo
- Sessao 107: Melhorias Gatilho — Collapsible + Renumeracao + Setas
- Sessao 108: Promo/Slug so trava apos pagamento + Email lowercase + Fix enums tenant schema
- Sessao 109: Upload Cartao CNPJ no step 3 do signup
- Sessao 110: Fix Galeria Selfie + Asaas API Key

## O que foi feito na sessao 110:
- [x] Removido botao "Galeria" da tela de selfie (camera) — so "Tirar foto"
- [x] Fallback "Selecionar foto" apenas quando camera falha
- [x] Investigacao Asaas API Key: chave correta no container mas rejeitada pela API
- [x] Nova chave Asaas gerada e atualizada no servidor — API funcionando

## Decisao: SLS Obras operando pelo schema public
- SLS Obras continua no schema public (tecnikos.com.br, admin@tecnikos.com.br)
- NAO migrar para tenant/host ate concluir todos os testes e certificacao
- Registro antigo de Tenant SLS foi limpo (schema tenant_sls dropado + registro deletado)
- Quando pronto: refazer signup pelo host para teste completo do fluxo tenant

## Proximos passos:
1. ~~Asaas API Key~~ RESOLVIDO — nova chave funcionando
2. SLS Obras: testar signup pelo host quando pronto para certificar
3. Testar end-to-end: signup → upload docs → admin review → approve/reject
4. Testar emissao NF via admin (com Asaas sandbox)
5. Configurar info fiscal no Asaas (inscricao municipal, CNAE, etc)
6. Audit log review (pendente desde sessao 101)

## Versao atual: v1.02.45

## IDs importantes WhatsApp Meta:
- WABA ID: 1421505052856896
- Phone Number ID: 996592133539837
- App ID: 950743607617295

## Se reconectar no MEIO de uma tarefa:
- Verifique o TODO list no Claude (se existir)
- Leia o CHAT_LOG.md para contexto
- Continue exatamente do ponto onde parou
- NAO pergunte ao Juliano — ele autorizou execucao irrestrita

## Regras permanentes (decididas pelo Juliano):
- Claude decide toda a parte tecnica sozinho e executa sem perguntar
- Registrar SEMPRE em CHAT_LOG.md e PROJETO_LOG.md
- Build e verificar antes de encerrar qualquer sessao
- Versao em version.json sempre atualizada
- Variaveis em campos de texto: SEMPRE clicaveis (botoes chip que inserem no cursor)
- Pode sempre continuar depois do deploy sem perguntar
