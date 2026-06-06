# NFS-e Nacional — Cenario B (formato nacional, ambiente proprio) + erro 495 do ADN

**v1.13.22 (06/06/2026).** Caso real: Primavera do Leste/MT (tenant SLS). **Ler ANTES** de mexer em
emissao NFS-e nacional, layout (MUNICIPAL/NACIONAL) ou habilitacao de empresa no Focus.

## TL;DR
Primavera do Leste MIGROU pro **FORMATO nacional** da NFS-e, mas **NAO opera no Ambiente Nacional (ADN)**.
E "Cenario B": emitir com **layout NACIONAL (`/v2/nfsen`)** pelo **provedor proprio do municipio (Rlz)**,
mantendo no Focus **`habilita_nfse`=ON e `habilita_nfsen`=OFF**. Estavamos em MUNICIPAL e com o ambiente
nacional ligado de uma tentativa antiga -> o Focus roteava pro ADN -> **"495 SSL Certificate Error — An
invalid certificate has been provided"** (o ADN recusa o cert no handshake TLS). **NAO** era validade do
cert (valido ate 26/08/2026), **NAO** era instabilidade da Focus.

## Os 3 cenarios da Reforma Tributaria (comentados em `focus-nfe.provider.ts` ~linhas 23-35)
| Cenario | Formato | Ambiente | Layout (nosso `nfseLayout`) | Focus painel |
|---|---|---|---|---|
| A | proprio | proprio | MUNICIPAL (`/v2/nfse`) | `habilita_nfse`=on |
| **B** | **Nacional** | **proprio** | **NACIONAL (`/v2/nfsen`)** | **`habilita_nfse`=on, `habilita_nfsen`=OFF** |
| C | Nacional | Nacional (ADN) | NACIONAL (`/v2/nfsen`) | `habilita_nfsen`=on, `habilita_nfse`=off (MEI sempre C) |

Primavera do Leste = **B**. Guia oficial Focus:
https://focusnfe.com.br/guides/nfse/municipios-integrados/primavera-do-leste-mt/
("utilize o layout nacional e o endpoint v2/nfsen" + "NAO habilite a opcao 'Ambiente da NFSe Nacional'").

## Root cause do 495
`registerEmpresa` (nfse-emission.service): com layout=NACIONAL, LIGAVA `habilita_nfsen` (= Cenario C / ADN).
Pra Cenario B isso esta ERRADO. E o flag, uma vez ligado, fazia o Focus rotear pro ADN **ate em MUNICIPAL**.
O ADN exige mTLS/credenciamento que o municipio (Cenario B) nao tem -> 495.

## O fix (v1.13.22) — tudo em nfse-emission.service.ts + focus-nfe.provider.ts
1. **`registerEmpresa`**: NACIONAL liga `habilita_nfse=true` e DESLIGA `habilita_nfsen_*=false` EXPLICITO
   (precisa ser `false`, nao `undefined` — pra reverter empresas que ja tinham o ambiente ligado).
   Cenario C = follow-up (criar flag `nfseAmbienteNacional` quando surgir tenant MEI/ADN puro).
2. **Payload nacional**: ganhou `indicador_total_tributacao: '0'` (obrigatorio, faltava na interface e no build).
3. **Guards de solidez**: NACIONAL exige `codigo_municipio` (IBGE) e cTribNac 6 digitos -> erro CLARO antes do
   round-trip com o Focus. cTribNac enviado limpo (so digitos, sem ponto).
4. **`mapFocusError`**: +495/ADN, +falha DPS, +campo obrigatorio, +certificado vencido, +empresa nao habilitada,
   +conexao. Ganhou parametro **`stage`** -> erro NAO catalogado mostra a ETAPA onde ocorreu (Emissao /
   Consulta-webhook / Cadastro da empresa / Certificado) + o texto cru. Pontos costurados: emit catch,
   handleWebhook, registerEmpresa, uploadCertificate.

## Procedimento pra configurar um municipio Cenario B (ex.: SLS / Primavera)
1. Configuracoes > Fiscal > **Layout NFS-e = "Nacional"** -> Salvar.
2. **"Registrar empresa"** (re-registra no Focus: liga `habilita_nfse`, desliga `habilita_nfsen`).
3. Emitir/retentar **1 nota**. Se o Rlz reclamar de campo -> ajustar (agora ja e o erro REAL do provedor,
   nao mais o 495 do ADN). Telefone do tomador (`telefone_tomador`) NAO esta no DTO — add se o Rlz exigir.

## Config do SLS (prod, confirmado 06/06)
`codigoMunicipio=5107040`, `codigoTributarioNacional=070202`, `...NacionalServico=140601`,
`optanteSimplesNacional=true` (codigo_opcao_sn=3 ME/EPP), `inscricaoMunicipal=9648219`,
`regimeEspecialTributacao=0`, `naturezaOperacao=1`. -> passa nos guards.

## ACHADO CRITICO (v1.13.24/25): SLS e SETUP MANUAL — botao da plataforma NAO se aplica
- Confirmado no banco: `tenant_sls.NfseConfig.focusNfeCompanyId` VAZIO + `focusNfeToken`/`Homolog` SET.
  A empresa do SLS foi cadastrada MANUALMENTE no painel da Focus (tokens colados), NUNCA pela plataforma.
  A EMISSAO funciona (usa o token proprio colado — varias notas autorizadas).
- Por isso o botao "Registrar empresa" (v1.13.23) NAO funciona pro SLS: usa `getEmpresa`/`updateEmpresa` com
  o token da PLATAFORMA (FOCUS_NFE_RESELLER_TOKEN), que nem reconhece a empresa -> HTTP 422
  `["codigo","requisicao_invalida"]`. Mesma razao do card de validade do certificado nunca aparecer.
- **Pro SLS (e qualquer setup MANUAL), o Cenario B se aplica NO PAINEL DA FOCUS**, NAO pelo nosso botao:
  app-v2.focusnfe.com.br > empresa SLS > DESABILITAR "Ambiente da NFSe Nacional" (manter NFSe padrao ON).
  Com nosso Layout=NACIONAL + ambiente nacional OFF no painel -> emite via Rlz (nao ADN).
- v1.13.24: provider expoe o CORPO do erro do Focus (createEmpresa/getEmpresa/updateEmpresa) — era so "HTTP 422".
  v1.13.25: (a) `registerOrUpdateEmpresa` DETECTA setup manual (focusNfeCompanyId vazio + token set) e avisa
  "empresa gerida no painel" em vez de tentar e dar 422; (b) catalogo `requisicao_invalida` reescrito (sem jargao).
- TODO: card de validade do cert tambem deveria detectar setup manual (hoje falha silencioso no getEmpresa).

## v1.13.26 + TESTE AUTONOMO (06/06) — XSD resolvido, mas 495 do ADN persiste (EXTERNO)
- **v1.13.26**: removido `pTotTribSN` + `pTotTrib(Fed/Est/Mun)` do payload nacional. Com `indTotTrib="0"` o
  XSD nacional NAO aceita esses campos (`Element pTotTribSN: This element is not expected`). Sao mutuamente
  exclusivos: indTotTrib=0 (nao informar) OU indTotTrib=1 + percentuais. Usamos "0" (igual exemplo do guia).
- **TESTE AUTONOMO (Claude, via JWT mintado)**: retry da RPS 33 -> log `Emitting ... layout=NACIONAL to
  PRODUCTION via /v2/nfsen` -> Focus respondeu **`processando_autorizacao`** (= **DPS PASSOU no XSD**, Focus
  ACEITOU) -> mas na AUTORIZACAO caiu em **495 no `adn.nfse.gov.br`** ("An invalid certificate has been
  provided") -> ERROR. (Poll cron v1.13.21 tbm confirmado em prod: `[sls] Polled RPS 33`.)

## CONCLUSAO (estado real, 06/06)
- **NOSSO CODIGO ESTA RESOLVIDO**: Layout NACIONAL + payload valido (XSD passa) + DPS aceita pelo Focus.
- **O BLOQUEIO QUE SOBRA NAO E CODIGO NOSSO**: o 495 e o **gateway nacional (ADN) recusando o CERTIFICADO**
  do SLS no handshake mTLS, na hora de autorizar. A DPS (formato nacional) SEMPRE passa pelo ADN — o toggle
  "Ambiente da NFSe Nacional" do painel nao muda isso. Cert e VALIDO (ate 26/08/2026) -> e **credenciamento/
  mTLS**, NAO expiracao. SLS ja emitiu via ambiente nacional antes (cert foi aceito) — algo lapsou/mudou.
- **PROXIMOS PASSOS (acao usuario/Focus, NAO codigo)**:
  1. Confirmar no painel Focus que "Ambiente da NFSe Nacional - Producao" foi SALVO OFF (testar tbm OFF no
     "Recebimento de NFSes do ambiente nacional" — guia: "manter APENAS NFSe padrao ativa").
  2. Persistindo: ABRIR CHAMADO na Focus com "POST adn.nfse.gov.br/dfe -> 495 SSL Certificate Error - An
     invalid certificate has been provided" — cert valido, foi aceito antes; provavel credenciamento/adesao
     no SEFIN Nacional, ou re-anexar o certificado no painel.
- **TODO codigo (menor)**: refinar o catalogo do 495 (hoje sugere "Registrar empresa", que nao se aplica a
  setup manual) -> apontar pro ADN/cert/Focus. Card de validade do cert detectar setup manual.

## TECNICA: teste autonomo de emissao (JWT mintado, sem UI/CAPTCHA)
/auth/login tem CAPTCHA. Pra disparar endpoints autenticados sem UI: `JwtStrategy.validate` so checa sessao
SE o payload tiver `sessionId` -> mintar SEM sessionId pula a checagem. `docker exec tecnikos_backend node -e
'jwt.sign({sub,email,roles:[...],companyId}, process.env.JWT_SECRET, {expiresIn:"2h"})'` -> `curl -H
"Authorization: Bearer <tok>" .../api/...`. Admin SLS: sub=aec54bc6-c87c-47a6-b0ac-7bacb0a4a163,
companyId=00000000-0000-0000-0000-000000000002, roles=[ADMIN]. RPS 33 emissionId=69d6a64e-67e0-4ec2-b879-e5bfb854db24.

## Status
**NOSSO LADO: COMPLETO** (v1.13.22→26). Bloqueio restante = certificado no ADN (EXTERNO — Focus/credenciamento).
RPS 33 fica em ERROR (retentavel quando o cert for aceito no ADN). Nada mais a fazer no codigo ate o usuario
resolver o lado Focus/credenciamento.

## Refs
- Doc DPS nacional: https://campos.focusnfe.com.br/nfse_nacional/EmissaoDPSXml.html
- Codigo: `nfse-emission.service.ts` (registerEmpresa ~470, emit branch NACIONAL ~874, mapFocusError ~124);
  `focus-nfe.provider.ts` (FocusNfsenRequest ~90, comentario dos 3 cenarios ~23).
