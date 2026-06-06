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

## Status
Fix do 495 (v1.13.22) + ferramentas de erro (v1.13.24/25) DEPLOYADOS. **Teste de campo PENDENTE**:
desabilitar "Ambiente da NFSe Nacional" no painel da Focus + retentar RPS 33 (R$ 3.620). Atualizar este
arquivo com o resultado real do Rlz.

## Refs
- Doc DPS nacional: https://campos.focusnfe.com.br/nfse_nacional/EmissaoDPSXml.html
- Codigo: `nfse-emission.service.ts` (registerEmpresa ~470, emit branch NACIONAL ~874, mapFocusError ~124);
  `focus-nfe.provider.ts` (FocusNfsenRequest ~90, comentario dos 3 cenarios ~23).
