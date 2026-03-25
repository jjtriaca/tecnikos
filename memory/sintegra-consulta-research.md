# SINTEGRA Consulta Publica - Pesquisa (2026-03-25)

## Resumo
Nao existe API publica oficial gratuita do SINTEGRA. As consultas publicas sao via portais web estaduais com CAPTCHA. Para uso programatico, existem servicos de terceiros pagos que fazem scraping/intermediacao.

## Portal Oficial
- URL central: http://www.sintegra.gov.br/ (mapa com links para cada estado)
- Cada estado tem sua propria URL na SEFAZ estadual
- Todas usam CAPTCHA (imagem ou reCAPTCHA)
- Consulta por CNPJ ou IE

### URL MT (Mato Grosso)
- https://www.sefaz.mt.gov.br/cadastro/emissaocartao/emissaocartaocontribuinteacessodireto

### URLs Outros Estados (exemplos)
- GO: https://appasp.sefaz.go.gov.br/Sintegra/Consulta/default.html
- MA: https://sistemas1.sefaz.ma.gov.br/sintegra/jsp/consultaSintegra/consultaSintegraFiltro.jsf
- SP: https://www.cadesp.fazenda.sp.gov.br/

## Dados Retornados (tipico)
- Razao Social / Nome Empresarial
- Nome Fantasia
- CNPJ
- Inscricao Estadual (IE)
- Situacao Cadastral IE (Ativo/Inativo/Baixado)
- UF
- Endereco completo (logradouro, numero, complemento, bairro, municipio, CEP)
- CNAE / Atividade Economica
- Regime de Recolhimento / Tributacao
- Data de Inicio da Atividade
- Porte da Empresa

## APIs de Terceiros

### 1. SintegraWS (sintegraws.com.br) - RECOMENDADO para baixo volume
- Endpoint: `GET https://www.sintegraws.com.br/api/v1/execute-api.php`
- Params: token, cnpj (ou ie+uf), plugin="ST"
- Auth: Token via query param
- Sandbox: CNPJ 06990590000123 (gratis para teste)
- Preco: creditos pre-pagos (nao documentado publicamente)
- Cobertura: maioria dos estados
- GitHub: https://github.com/sintegraws/API-Sintegra

### 2. SintegrAPI (sintegrapi.com.br) - RECOMENDADO para volume medio/alto
- Endpoint: `GET https://api.sintegrapi.com.br/consultas/v2/sintegra/{cnpj}`
- Auth: Header `x-api-key: {apiKey}`
- Cache: param `cache` (0=fresh, 25=default cached)
- Param opcional: `uf` para filtrar estado
- Cobertura: 27 estados
- Performance: <1s media, 4000+ req/hora
- Precos:
  - Freelancer: R$25/mes (100 consultas, R$0.25/cada)
  - Micro: R$200/mes (1000 consultas, R$0.20/cada)
  - Startup: R$1800/mes (10000, R$0.18/cada)
  - Enterprise: R$3000/mes (30000, R$0.10/cada)
- Resposta inclui array `inscricoes_estaduais` com IE por UF, status, tipo_ie
- Docs: https://docs.sintegrapi.com.br/sintegra

### 3. CNPJ.ws (cnpj.ws) - RECOMENDADO para dados basicos gratis
- Free tier: 3 consultas/minuto
- Inclui dados SINTEGRA + Receita Federal + SUFRAMA
- Dados de inscricao estadual inclusos
- Planos pagos: ate 2000 req/min
- Docs: https://docs.cnpj.ws/pt

### 4. Infosimples (infosimples.com)
- API unificada SINTEGRA para todos os estados
- Servico pago por creditos
- Docs: https://infosimples.com/consultas/sintegra-unificada/

### 5. ConsultaSintegra (consultasintegra.com.br)
- Cobertura: 27 estados
- API REST

### 6. DBDireto (dbdireto.com.br)
- Cobertura: 27 estados

## Abordagem Scraping Direto (NAO RECOMENDADO)
- Puppeteer + captcha solver (2Captcha, CapSolver)
- Fragil: URLs e formularios mudam sem aviso
- CAPTCHA: custo por solve (~$2-3/1000 solves)
- Rate limiting: SEFAZs bloqueiam IPs com muitas requests
- Manutencao alta: cada estado tem layout diferente

## Recomendacao para Tecnikos
1. **Para MVP/baixo volume**: CNPJ.ws (free tier, 3/min) ou SintegraWS (sandbox gratis)
2. **Para producao**: SintegrAPI (R$25/mes = 100 consultas) ou SintegraWS
3. **NAO fazer scraping direto** - fragil, custoso manter, risco de bloqueio
4. A consulta seria usada no cadastro de fornecedores/clientes para auto-preencher dados
