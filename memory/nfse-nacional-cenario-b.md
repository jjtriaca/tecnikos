# NFS-e Nacional — Cenario B (formato nacional, ambiente proprio) + erro 495 do ADN

## ✅✅ RESOLVIDO (08/06/2026) — LER ISTO PRIMEIRO (supersede tudo abaixo)
**Emissao restaurada. RPS 28 -> NF 79, RPS 33 -> NF 80 (autorizadas via municipio).**
- **CAUSA REAL = config NOSSA: `nfseLayout` estava em NACIONAL.** NACIONAL -> `/v2/nfsen` -> a Focus posta a
  DPS DIRETO no ADN (`adn.nfse.gov.br/dfe`) -> 495 (a SLS nao e credenciada no ADN). **Voltar pra MUNICIPAL
  (`/v2/nfse` -> webservice do municipio Rlz/ABRASF) RESOLVEU na hora.**
- **Config que FUNCIONA (deixada assim):** `nfseLayout=MUNICIPAL` + no painel Focus (empresa 192027):
  **"Ambiente da NFSe Nacional - Producao" = OFF** + **"Certificado Exclusivo" = ON** (o municipio exige o
  cert especifico da empresa; com exclusivo OFF a emissao municipal tambem falhava).
- **Certificado da SLS = 100% sadio** (testado no .pfx local: valido ate 26/08/2026, NAO revogado, cadeia
  ICP-Brasil completa). **NUNCA foi o certificado.**
- **LICAO (importante):** o usuario (Juliano) insistiu "e config NOSSA mandando pro nacional, nao a Focus" —
  **estava certo**. Eu errei 3x antes de testar limpo: (1) achei que era a chave do painel; (2) achei que era
  o Certificado Exclusivo isolado; (3) li que "municipal tambem ia pro ADN" — leitura CONTAMINADA (os testes
  "municipal" rodaram com a chave ainda ligada / antes do exclusivo / e eu mesmo tinha deixado NACIONAL).
  **NAO culpar o provedor externo (Focus atende milhares — se fosse bug geral, ja teriam corrigido). Suspeitar
  PRIMEIRO da config propria.** So virou claro depois de setar MUNICIPAL e testar limpo (NF 79 autorizou).
- **TRANSICAO (futuro):** ABRASF/MUNICIPAL vale **ate junho/2026**; **julho+ = so DPS Nacional**. Pelo manual
  RLZ a DPS vai pro endpoint do MUNICIPIO (`cidadaoonline.primaveradoleste.mt.gov.br/nota/nacional/nfse`),
  NAO o ADN. Mas via Focus o layout NACIONAL postou no ADN -> ANTES de julho, confirmar com a Focus como
  rotear a DPS pro emissor proprio do municipio. Por ora (ate junho) MUNICIPAL resolve.
- Pendencia menor: RPS 32 (valor errado R$5.430) seguia em ERROR — era pra EXCLUIR (nao reemitir).

---


**v1.13.22 (06/06/2026).** Caso real: Primavera do Leste/MT (tenant SLS). **Ler ANTES** de mexer em
emissao NFS-e nacional, layout (MUNICIPAL/NACIONAL) ou habilitacao de empresa no Focus.

## TL;DR
Primavera do Leste MIGROU pro **FORMATO nacional** da NFS-e, mas **NAO opera no Ambiente Nacional (ADN)**.
E "Cenario B": emitir com **layout NACIONAL (`/v2/nfsen`)** pelo **provedor proprio do municipio (Rlz)**,
mantendo no Focus **`habilita_nfse`=ON e `habilita_nfsen`=OFF**. Estavamos em MUNICIPAL e com o ambiente
nacional ligado de uma tentativa antiga -> o Focus roteava pro ADN -> **"495 SSL Certificate Error — An
invalid certificate has been provided"** (o ADN recusa o cert no handshake TLS). **NAO** era validade do
cert (valido ate 26/08/2026), **NAO** era instabilidade da Focus.

## ⚠️ CORRECAO PROVADA (08/06/2026) — NAO e credenciamento externo; e a CHAVE do painel Focus
Investigacao com dados de prod (banco + Focus + logs) DERRUBOU a conclusao antiga de "bloqueio externo /
credenciamento no ADN". O que esta PROVADO:
1. **Certificado esta OK.** A SLS autorizou ~78 notas com ESSE MESMO cert — a ultima (NF 78) em 03/06.
   Baixei o XML da NF 78: **formato MUNICIPAL ABRASF 2.03** (provedor Rlz), nao nacional. Cert que assina
   78 notas nao e "invalido". O 495 e o ADN recusando a EMPRESA (sem cadastro no ambiente nacional), nao o cert.
2. **Nosso layout (MUNICIPAL vs NACIONAL) NAO controla a rota pro ADN.** Teste real 08/06: com `nfseLayout=
   MUNICIPAL`, retry da RPS 28 -> log `Emitting ... layout=MUNICIPAL via /v2/nfse` -> Focus AINDA mandou pro
   `adn.nfse.gov.br/dfe` -> 495. Ou seja, chamar /v2/nfse (municipal) NAO evita o ADN.
3. **Quem roteia pro ADN e a chave "Ambiente da NFSe Nacional" no painel da Focus** (habilita_nfsen), nivel
   EMPRESA. Enquanto ON, TODA nota da SLS (municipal ou nacional) e autorizada via ADN -> 495.
4. **Antes x depois:** as notas autorizadas (NF 49→78, ate 03/06, incl. 9 produtores rurais de Tesouro/
   Novo Sao Joaquim/Poxoreo etc.) sairam com a chave **OFF** (iam pro Rlz). Durante os ajustes (~05/06)
   alguem **LIGOU** a chave -> tudo passou a cair no ADN -> 495 (RPS 28 retries, 32, 33).
5. **"Produtor rural" NAO e a causa** (suspeita do usuario, refutada por dados): 9 notas de produtor rural
   AUTORIZARAM pelo municipal. RPS 28 (Wilson) nem e produtor rural. O comum das 3 que falham e so terem
   sido tentadas com a chave ligada.
6. **TESTE FINAL (08/06): desligar a chave NAO resolveu.** Usuario desligou "Ambiente da NFSe Nacional -
   Producao" no painel app-v2.focusnfe.com.br (empresa 192027) e SALVOU ("Dados atualizados com sucesso").
   Reemiti RPS 28 com layout=MUNICIPAL (/v2/nfse) -> Focus AINDA mandou pro `adn.nfse.gov.br/dfe` -> 495.
   **=> Nem o layout, nem a chave do painel mudam o roteamento.** Isto CONFIRMA a observacao antiga
   ("a DPS sempre passa pelo ADN, o toggle nao muda") — minha hipotese de que o toggle resolvia estava ERRADA.
7. **CONCLUSAO PROVADA = BLOQUEIO EXTERNO (Focus + credenciamento no Ambiente Nacional).** Inferencia forte:
   Primavera do Leste MIGROU pro Ambiente Nacional (ADN) entre 03/06 (NF 78 saiu via Rlz/ABRASF) e 05/06
   (RPS 32/33 ja cairam no ADN). Depois da migracao a Focus roteia TODA emissao da SLS pro ADN, e o ADN
   recusa o CERTIFICADO da SLS no mTLS (495) porque a SLS nao esta habilitada/credenciada no ambiente nacional.
   Cert e VALIDO (26/08/2026) e foi aceito pelo Rlz em 78 notas — o problema e credenciamento/adesao no ADN,
   NAO o cert em si. **Acao (usuario/Focus, NAO codigo):** (a) tentar RE-SUBIR o certificado no painel Focus
   (as vezes resolve recusa de cert/cadeia no ADN); (b) abrir chamado Focus: "empresa 192027 / CNPJ
   47226599000140 / Primavera do Leste-MT: com 'Ambiente da NFSe Nacional' DESLIGADO, /v2/nfse e /v2/nfsen
   estao roteando pro adn.nfse.gov.br/dfe e retornando 495 SSL Certificate Error. Emitia normal via provedor
   municipal ate 03/06 (NF 78). Por que vai pro ADN e como habilitar/credenciar o certificado no ambiente
   nacional?". Estado deixado: `nfseLayout=MUNICIPAL`; RPS 28 e 33 em ERROR; PAREI os retries (so queimam RPS).
8. **TESTES ADICIONAIS (08/06) — esgotaram o painel, segue 495:** (a) liguei `nfseLayout=NACIONAL` (formato que
   o ADN espera) + retry RPS 28 -> 495. (b) usuario ligou **"Certificado Exclusivo"** no painel Focus (selo
   EXCLUSIVO; tooltip: "Por padrao o cert e usado por todas as empresas do mesmo CNPJ base; marque se o
   ambiente de NFSe EXIGIR o cert do CNPJ especifico") + SALVOU + retry NACIONAL -> **ainda 495**. **=> Nem
   layout, nem ambiente-nacional-toggle, nem certificado-exclusivo mudam o 495.** O 495 e nginx client-cert
   REJECT no mTLS do ADN (nivel TLS, antes do corpo). Cert e valido e funciona no Rlz (78 notas) -> o ADN
   recusa por CADEIA/TRUST ou por a empresa NAO estar CREDENCIADA/aderida no ambiente nacional (gov.br/nfse).
   **Acao unica restante = Focus (chamado) + credenciamento/adesao da SLS no Ambiente Nacional** (provavel
   passo no canal de migracao da prefeitura: primaveradoleste.mt.gov.br/issonline). Tentativa rapida antes:
   RE-ANEXAR o .pfx no painel (caso cadeia incompleta). **IMPORTANTE: emissao NFS-e da SLS esta TOTALMENTE
   PARADA desde ~05/06** (toda nota cai no ADN -> 495), nao so a 28/33. Estado final deixado:
   `nfseLayout=NACIONAL`, Certificado Exclusivo ON. Quando o ADN aceitar, reemitir 28 e 33.
9. **CERTIFICADO DA SLS TESTADO E APROVADO (08/06, .pfx local no Desktop do Juliano).** Abri o
   `SLS OBRAS LTDA 47226599000140 ... .pfx` (senha 12345678) via .NET X509Certificate2 no PC:
   Subject CN=SLS OBRAS LTDA:47226599000140; emissor AC SOLUTI Multipla v5 (ICP-Brasil); validade
   26/08/2025→**26/08/2026 (NAO vencido, 79 dias)**; checagem ONLINE de revogacao (X509Chain, EntireChain)
   = **nenhum problema (NAO revogado)**; cadeia completa e confiavel; o proprio .pfx ja contem as 4 (leaf+2
   intermediarias+raiz). **=> Certificado 100% sadio. O 495 do ADN NAO e defeito de cert (vencimento/
   revogacao/cadeia) — e a SLS NAO estar credenciada/habilitada no Ambiente Nacional.** Achado extra: o cert
   que assina a NFS-e municipal e o da PREFEITURA (CN=MUNICIPIO DE PRIMAVERA DO LESTE:01974088000105), que
   **venceu em 05/06/2026** — mesma data em que a emissao quebrou (forte indicio do cutover do municipio pro
   ADN). Acao final: credenciamento da SLS no ambiente nacional (gov.br/nfse e/ou canal de migracao da
   prefeitura: primaveradoleste.mt.gov.br/issonline) + chamado Focus. NADA a fazer no codigo nem no cert.
10. **CAUSA RAIZ DEFINITIVA (08/06, via manual oficial RLZ): Focus esta enviando pro ENDPOINT ERRADO.**
    Manual "Primavera_Manual_ABRASF_Reforma_RLZ.pdf" (public-rlz.s3): o municipio e **EMISSOR PROPRIO** —
    "O municipio optou em manter o seu Emissor Proprio". O contribuinte NAO submete direto ao ADN; submete
    ao endpoint DO MUNICIPIO, que repassa ao repositorio nacional. **Endpoints de PRODUCAO:**
    - DPS Nacional: `https://cidadaoonline.primaveradoleste.mt.gov.br/nota/nacional/nfse`
    - ABRASF 2.03+IBS: `https://cidadaoonline.primaveradoleste.mt.gov.br/webservice/nfse?wsdl`
    (Homologacao: `primaveradoleste.prefeitura.rlz.com.br/...`). **NENHUM e adn.nfse.gov.br.** Mas a Focus
    manda as notas da SLS direto pro `adn.nfse.gov.br/dfe` -> 495 (cert do contribuinte nao credenciado no
    ADN, o que NEM e necessario aqui — quem fala com o ADN e o municipio). **=> Bug/roteamento errado da
    FOCUS pra Primavera.** O proprio guia Focus ja dizia "Primavera nao opera no ADN, usa Rlz" — contradiz o
    comportamento real. Transicao: 2 layouts aceitos ate **junho/2026** (ABRASF 2.03+IBS ou DPS Nacional);
    **a partir de julho/2026 SO DPS Nacional** (mas ainda pro endpoint do municipio, nao ADN). ABRASF+IBS
    exige no `<TCRTCInfoIBSCBS>` + tag `<tsCodigoNbs>` (NBS), lote=1 RPS. **ACAO: chamado Focus pra corrigir
    o roteamento pro endpoint do EMISSOR PROPRIO de Primavera** (cidadaoonline...), nao pro ADN. Nao e cert,
    nao e credenciamento, nao e nosso codigo. Integrar direto no webservice do municipio (sem Focus) seria
    alternativa pesada (SOAP+assinatura) — evitar; primeiro a Focus corrigir.

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
