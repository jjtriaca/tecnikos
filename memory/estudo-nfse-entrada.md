# Estudo Completo — NFS-e de Entrada (Servicos Tomados)

**Data**: 06/03/2026
**Contexto**: Tecnikos (SLS Obras LTDA) | Simples Nacional | Construcao Civil | MT

---

## 1. Layouts XML de NFS-e

### 1.1. Padrao ABRASF (maioria dos municipios)

A ABRASF (Associacao Brasileira das Secretarias de Financas das Capitais) criou um modelo conceitual para NFS-e. Na pratica, cada municipio implementa variacoes, mas a estrutura base e a mesma.

**Versoes existentes**: 1.00, 1.04, 1.07, 2.00, 2.01, 2.02, 2.03, 2.04

**Namespace padrao**: `http://www.abrasf.org.br/ABRASF/arquivos/nfse.xsd`

#### Estrutura XML Completa (ABRASF 2.x)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<CompNfse xmlns="http://www.abrasf.org.br/ABRASF/arquivos/nfse.xsd">
  <Nfse>
    <InfNfse Id="nfse_123456">
      <!-- Dados da NFS-e -->
      <Numero>123456</Numero>
      <CodigoVerificacao>ABCD1234</CodigoVerificacao>
      <DataEmissao>2026-03-06T10:00:00</DataEmissao>
      <NaturezaOperacao>1</NaturezaOperacao>
      <RegimeEspecialTributacao>4</RegimeEspecialTributacao>
      <OptanteSimplesNacional>1</OptanteSimplesNacional>
      <IncentivadorCultural>2</IncentivadorCultural>
      <Competencia>2026-03-01</Competencia>

      <!-- RPS que originou a NFS-e -->
      <IdentificacaoRps>
        <Numero>1001</Numero>
        <Serie>1</Serie>
        <Tipo>1</Tipo> <!-- 1=RPS, 2=Nota Fiscal Conjugada, 3=Cupom -->
      </IdentificacaoRps>

      <!-- Servico e Valores -->
      <Servico>
        <Valores>
          <ValorServicos>1000.00</ValorServicos>
          <ValorDeducoes>0.00</ValorDeducoes>
          <ValorPis>0.00</ValorPis>
          <ValorCofins>0.00</ValorCofins>
          <ValorInss>0.00</ValorInss>
          <ValorIr>0.00</ValorIr>
          <ValorCsll>0.00</ValorCsll>
          <OutrasRetencoes>0.00</OutrasRetencoes>
          <IssRetido>2</IssRetido> <!-- 1=Sim, 2=Nao -->
          <ValorIss>20.00</ValorIss>
          <ValorIssRetido>0.00</ValorIssRetido>
          <BaseCalculo>1000.00</BaseCalculo>
          <Aliquota>0.02</Aliquota> <!-- 2% -->
          <ValorLiquidoNfse>980.00</ValorLiquidoNfse>
          <DescontoIncondicionado>0.00</DescontoIncondicionado>
          <DescontoCondicionado>0.00</DescontoCondicionado>
        </Valores>
        <ItemListaServico>07.02</ItemListaServico>
        <CodigoCnae>4321500</CodigoCnae>
        <CodigoTributacaoMunicipio>070200</CodigoTributacaoMunicipio>
        <Discriminacao>Servicos de instalacao eletrica predial</Discriminacao>
        <CodigoMunicipio>5107040</CodigoMunicipio> <!-- IBGE 7 digitos -->
        <CodigoPais>1058</CodigoPais>
        <ExigibilidadeISS>1</ExigibilidadeISS>
        <MunicipioIncidencia>5107040</MunicipioIncidencia>
      </Servico>

      <!-- Valores Globais da NFS-e -->
      <ValoresNfse>
        <BaseCalculo>1000.00</BaseCalculo>
        <Aliquota>0.02</Aliquota>
        <ValorIss>20.00</ValorIss>
        <ValorLiquidoNfse>980.00</ValorLiquidoNfse>
      </ValoresNfse>

      <!-- Prestador -->
      <PrestadorServico>
        <IdentificacaoPrestador>
          <CpfCnpj>
            <Cnpj>12345678000190</Cnpj>
          </CpfCnpj>
          <InscricaoMunicipal>9648219</InscricaoMunicipal>
        </IdentificacaoPrestador>
        <RazaoSocial>EMPRESA PRESTADORA LTDA</RazaoSocial>
        <NomeFantasia>PRESTADORA</NomeFantasia>
        <Endereco>
          <Endereco>Rua Principal</Endereco>
          <Numero>100</Numero>
          <Complemento>Sala 1</Complemento>
          <Bairro>Centro</Bairro>
          <CodigoMunicipio>5107040</CodigoMunicipio>
          <Uf>MT</Uf>
          <CodigoPais>1058</CodigoPais>
          <Cep>78850000</Cep>
        </Endereco>
        <Contato>
          <Telefone>6633221100</Telefone>
          <Email>contato@prestadora.com.br</Email>
        </Contato>
      </PrestadorServico>

      <!-- Tomador -->
      <TomadorServico>
        <IdentificacaoTomador>
          <CpfCnpj>
            <Cnpj>47226599000140</Cnpj>
          </CpfCnpj>
          <InscricaoMunicipal>1234567</InscricaoMunicipal>
        </IdentificacaoTomador>
        <RazaoSocial>SLS OBRAS LTDA</RazaoSocial>
        <Endereco>
          <Endereco>Av Brasil</Endereco>
          <Numero>500</Numero>
          <Bairro>Buritis</Bairro>
          <CodigoMunicipio>5107040</CodigoMunicipio>
          <Uf>MT</Uf>
          <Cep>78850000</Cep>
        </Endereco>
      </TomadorServico>

      <!-- Intermediario (opcional) -->
      <!-- <IntermediarioServico>...</IntermediarioServico> -->

      <!-- Construcao Civil (opcional) -->
      <ConstrucaoCivil>
        <CodigoObra>12345678901234</CodigoObra> <!-- ART ou CEI/CNO -->
        <Art>1234567890</Art>
      </ConstrucaoCivil>

      <!-- Orgao Gerador -->
      <OrgaoGerador>
        <CodigoMunicipio>5107040</CodigoMunicipio>
        <Uf>MT</Uf>
      </OrgaoGerador>

    </InfNfse>
  </Nfse>
</CompNfse>
```

#### Campos Obrigatorios ABRASF

| Campo | Tag | Obrigatorio | Descricao |
|-------|-----|-------------|-----------|
| Numero | `Numero` | Sim | Numero da NFS-e |
| Codigo Verificacao | `CodigoVerificacao` | Sim | Codigo para validacao |
| Data Emissao | `DataEmissao` | Sim | DateTime da emissao |
| Competencia | `Competencia` | Sim | Mes/ano de competencia |
| Valor Servicos | `ValorServicos` | Sim | Valor bruto do servico |
| Base Calculo | `BaseCalculo` | Sim | Base para ISS |
| Aliquota ISS | `Aliquota` | Sim | Percentual ISS |
| ISS Retido | `IssRetido` | Sim | 1=Retido, 2=Nao retido |
| Item LC 116 | `ItemListaServico` | Sim | Codigo do servico |
| Discriminacao | `Discriminacao` | Sim | Descricao do servico |
| Municipio Prestacao | `CodigoMunicipio` | Sim | IBGE 7 digitos |
| Prestador CNPJ | `Cnpj` (Prestador) | Sim | CNPJ do prestador |
| Prestador IM | `InscricaoMunicipal` | Sim* | Inscricao Municipal |
| Tomador CNPJ/CPF | `Cnpj`/`Cpf` (Tomador) | Sim* | Identificacao do tomador |
| Tomador Razao Social | `RazaoSocial` (Tomador) | Sim* | Nome do tomador |

*Quando tomador e PJ identificada

### 1.2. Padrao Nacional (NFS-e Nacional / SPED)

O padrao nacional foi instituido pelo Comite Gestor da NFS-e e utiliza o ADN (Ambiente de Dados Nacional).

**Namespace**: `http://www.sped.fazenda.gov.br/nfse`

#### Estrutura XML (DPS → NFS-e Nacional)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<NFSe xmlns="http://www.sped.fazenda.gov.br/nfse">
  <infNFSe Id="NFSe51070405107040123456789012345600001000000001">
    <!-- Chave de acesso: 50 caracteres -->
    <!-- UF(2) + MunEmit(7) + TpInsc(1) + InscFed(14) + SerieDPS(5) + NumDPS(15) + AmbGer(1) + tpEmit(1) + cNFSe(7) + cDV(1) + CFPS(1) -->

    <!-- Dados gerados pelo sistema -->
    <cStat>100</cStat> <!-- 100 = Autorizada -->
    <dhProc>2026-03-06T10:00:00-03:00</dhProc>
    <nNFSe>000000001</nNFSe>
    <cLocIncworked>5107040</cLocIncworked>

    <!-- DPS — Declaracao de Prestacao de Servico (enviada pelo contribuinte) -->
    <DPS>
      <infDPS Id="DPS5107040147226599000140000010000000000011" versao="1.00">

        <!-- Ambiente -->
        <tpAmb>1</tpAmb> <!-- 1=Producao, 2=Homologacao -->

        <!-- Emitente (Prestador) -->
        <dhEmi>2026-03-06T10:00:00-03:00</dhEmi>
        <verAplic>Tecnikos1.0</verAplic>

        <!-- Serie e Numero -->
        <serie>1</serie> <!-- Numerico a partir de 01/01/2026 -->
        <nDPS>1</nDPS>

        <!-- Competencia -->
        <dCompet>2026-03-01</dCompet>

        <!-- Codigo do Servico -->
        <cTribNac>070202</cTribNac> <!-- Codigo Tributario Nacional -->
        <cNBS></cNBS> <!-- Nomenclatura Brasileira de Servicos -->

        <!-- Municipio da prestacao -->
        <cLocPrestworked>5107040</cLocPrestworked>

        <!-- Tributacao -->
        <cTribMun>070200</cTribMun>
        <indIncFisc>0</indIncFisc>

        <!-- Prestador -->
        <prest>
          <CNPJ>47226599000140</CNPJ>
          <IM>9648219</IM>
          <regTrib>
            <opSN>1</opSN> <!-- 1=Sim optante SN -->
          </regTrib>
        </prest>

        <!-- Tomador -->
        <toma>
          <CNPJ>12345678000190</CNPJ>
          <xNome>EMPRESA TOMADORA LTDA</xNome>
          <end>
            <xLgr>Av Brasil</xLgr>
            <nro>500</nro>
            <xBairro>Centro</xBairro>
            <cMun>5107040</cMun>
            <UF>MT</UF>
            <CEP>78850000</CEP>
            <cPais>1058</cPais>
          </end>
          <fone>6633221100</fone>
          <email>contato@tomadora.com.br</email>
        </toma>

        <!-- Servico -->
        <serv>
          <cServ>
            <cTribNac>070202</cTribNac>
          </cServ>
          <xDescServ>Instalacao eletrica predial conforme projeto</xDescServ>
        </serv>

        <!-- Valores -->
        <valores>
          <vServPrest>
            <vServ>1000.00</vServ>
          </vServPrest>
          <trib>
            <!-- Para optante SN -->
            <pAliq>2.00</pAliq> <!-- Aliquota ISS relativa ao municipio -->
            <pTotTribSN>5.00</pTotTribSN> <!-- Total tributos SN (obrigatorio para SN) -->
            <!-- Para NAO-SN: usar pTotTribFed, pTotTribEst, pTotTribMun -->
          </trib>
        </valores>

        <!-- Obra (opcional para construcao civil) -->
        <infObra>
          <cObra>12345678901234</cObra> <!-- CNO -->
          <xLgr>Rua da Obra</xLgr>
          <nro>100</nro>
          <xBairro>Centro</xBairro>
          <CEP>78850000</CEP>
        </infObra>

      </infDPS>
    </DPS>
  </infNFSe>
</NFSe>
```

#### Campos Obrigatorios Padrao Nacional

| Campo | Tag | Obrigatorio | Descricao |
|-------|-----|-------------|-----------|
| Ambiente | `tpAmb` | Sim | 1=Prod, 2=Homol |
| Data emissao | `dhEmi` | Sim | ISO 8601 |
| Serie | `serie` | Sim | Numerica (desde 01/2026) |
| Numero DPS | `nDPS` | Sim | Sequencial |
| Competencia | `dCompet` | Sim | YYYY-MM-DD |
| Cod Trib Nacional | `cTribNac` | Sim | 6 digitos |
| Prestador CNPJ | `CNPJ` (prest) | Sim | 14 digitos |
| Prestador IM | `IM` | Sim | Inscricao Municipal |
| Regime Tributario | `regTrib/opSN` | Sim | Optante SN |
| Tomador CNPJ/CPF | `CNPJ`/`CPF` (toma) | Sim | Identificacao |
| Tomador Nome | `xNome` | Sim | Razao social |
| Descricao servico | `xDescServ` | Sim | Texto livre |
| Valor servico | `vServ` | Sim | Decimal |
| Aliquota ISS | `pAliq` | Sim | Percentual |
| Tot Trib SN | `pTotTribSN` | Sim (SN) | Total tributos SN |
| Municipio prestacao | `cLocPrest` | Sim | IBGE 7 digitos |

#### Diferencas ABRASF vs Nacional

| Aspecto | ABRASF | Nacional |
|---------|--------|---------|
| Tag raiz | `CompNfse` / `Nfse` | `NFSe` |
| Namespace | `abrasf.org.br` | `sped.fazenda.gov.br/nfse` |
| Formato comunicacao | SOAP (WSDL) | REST + JSON (docs XML internos) |
| Autorizacao | Municipio direto | ADN (Ambiente Nacional) |
| Chave de acesso | Nao padronizada | 50 caracteres (padrao unico) |
| Codigo servico | `ItemListaServico` (LC 116) | `cTribNac` (6 digitos) |
| ISS Retido | `IssRetido` (1/2) | Tag propria no grupo trib |
| Construcao civil | `ConstrucaoCivil/CodigoObra/Art` | `infObra/cObra` (CNO) |
| IBS/CBS (Reforma) | Nao tem (ainda) | Grupo `IBSCBS` (a partir de 2026) |
| Assinatura | Opcional (depende municipio) | Obrigatoria (XMLDSIG) |
| Compactacao | Nao | XML GZip + Base64 |

### 1.3. Outros Padroes / Provedores

O cenario brasileiro tem mais de 270 solucoes de NFS-e. Principais provedores:

| Provedor | Modelo Base | Municipios Notaveis |
|----------|-------------|---------------------|
| **GINFES** | ABRASF (variacao) | Muitos municipios de capitais |
| **ISS.NET** | Proprietario / ABRASF | Curitiba, varios PR/SC |
| **Betha** | Proprietario | Muitos municipios SC/RS/MG |
| **WebISS** | ABRASF | Varios municipios medios |
| **IPM** | Proprietario | Varios municipios RS/SC |
| **DSFNet** | ABRASF | Campinas, Santos |
| **ISSIntel** | ABRASF | Varios municipios |
| **Simpliss/GDN** | ABRASF | Varios municipios |
| **Prodam** | Proprietario | Sao Paulo capital |
| **Tiplan** | ABRASF | Varios municipios |
| **Equiplano** | Proprietario | Londrina, Maringa |
| **Abaco** | ABRASF | Varzea Grande (MT) |

**Diferencas estruturais entre provedores:**
- Namespaces diferentes no XML (mesmo base ABRASF)
- Versoes ABRASF diferentes (1.00 a 2.04)
- Metodos de autenticacao: certificado digital vs usuario/senha
- Campos extras proprietarios
- WSDLs com operacoes diferentes
- Alguns nao fornecem webservice de consulta

**Consequencia pratica**: Para importar NFS-e de entrada, a melhor estrategia e:
1. Aceitar upload de XML generico e tentar parsear ABRASF + Nacional
2. Usar ADN para municipios conveniados
3. Permitir digitacao manual como fallback

---

## 2. Diferenca Estrutural NFS-e vs NFe

### 2.1. Tags Raiz

| Tipo Documento | Tag Raiz | Namespace |
|----------------|----------|-----------|
| NFe autorizada | `<nfeProc>` | `http://www.portalfiscal.inf.br/nfe` |
| NFe nao processada | `<NFe>` | `http://www.portalfiscal.inf.br/nfe` |
| NFS-e ABRASF | `<CompNfse>` ou `<Nfse>` | `http://www.abrasf.org.br/...` |
| NFS-e ABRASF (resposta) | `<ConsultarNfseResposta>` | `http://www.abrasf.org.br/...` |
| NFS-e Nacional | `<NFSe>` | `http://www.sped.fazenda.gov.br/nfse` |
| NFS-e Nacional (DPS) | `<DPS>` | `http://www.sped.fazenda.gov.br/nfse` |

### 2.2. Deteccao Automatica — Algoritmo

```typescript
function detectDocumentType(xmlContent: string): 'NFE' | 'NFSE_ABRASF' | 'NFSE_NACIONAL' | 'UNKNOWN' {
  // Checar namespace primeiro (mais confiavel)
  if (xmlContent.includes('portalfiscal.inf.br/nfe')) {
    return 'NFE';
  }
  if (xmlContent.includes('sped.fazenda.gov.br/nfse')) {
    return 'NFSE_NACIONAL';
  }
  if (xmlContent.includes('abrasf.org.br')) {
    return 'NFSE_ABRASF';
  }

  // Fallback: checar tags raiz
  if (xmlContent.includes('<nfeProc') || xmlContent.includes('<NFe ')) {
    return 'NFE';
  }
  if (xmlContent.includes('<CompNfse') || xmlContent.includes('<Nfse>') || xmlContent.includes('<Nfse ')) {
    return 'NFSE_ABRASF';
  }
  if (xmlContent.includes('<NFSe') || xmlContent.includes('<DPS')) {
    return 'NFSE_NACIONAL';
  }

  // Fallback: checar tags internas
  if (xmlContent.includes('<infNFe') || xmlContent.includes('<det ')) {
    return 'NFE';
  }
  if (xmlContent.includes('<InfNfse') || xmlContent.includes('<PrestadorServico')) {
    return 'NFSE_ABRASF';
  }
  if (xmlContent.includes('<infDPS') || xmlContent.includes('<infNFSe')) {
    return 'NFSE_NACIONAL';
  }

  return 'UNKNOWN';
}
```

### 2.3. Campos que existem em uma e nao na outra

| Campo | NFe | NFS-e |
|-------|-----|-------|
| ICMS (base, aliquota, valor) | Sim | Nao |
| IPI (base, aliquota, valor) | Sim | Nao |
| ISS (base, aliquota, valor) | Nao* | Sim |
| NCM (produto) | Sim | Nao |
| CFOP | Sim | Nao |
| Item LC 116 (servico) | Nao | Sim |
| CNAE | Nao | Sim |
| Inscricao Municipal | Nao | Sim |
| Chave acesso 44 dig | Sim | Nao (ABRASF) |
| Chave acesso 50 dig | Nao | Sim (Nacional) |
| Codigo verificacao | Nao | Sim |
| Discriminacao servico | Nao | Sim |
| Construcao Civil (ART/CNO) | Nao | Sim |
| Retencoes federais | Nao** | Sim |
| Produtos/Itens | Sim (multiplos) | Nao (servico unico) |
| Frete/Seguro/Outras | Sim | Nao |
| Natureza Operacao | Sim (CFOP) | Sim (cod 1-6) |

*NFe conjugada pode ter ISS
**NFe pode ter retencoes em casos especificos

### 2.4. Campos comuns que podem ser mapeados

| Conceito | NFe | NFS-e ABRASF | NFS-e Nacional |
|----------|-----|-------------|----------------|
| Numero | `nNF` | `Numero` | `nNFSe` |
| Data emissao | `dhEmi` | `DataEmissao` | `dhEmi` |
| Emitente CNPJ | `emit/CNPJ` | `PrestadorServico/.../Cnpj` | `prest/CNPJ` |
| Emitente Nome | `emit/xNome` | `PrestadorServico/RazaoSocial` | (no cadastro) |
| Destinatario/Tomador CNPJ | `dest/CNPJ` | `TomadorServico/.../Cnpj` | `toma/CNPJ` |
| Valor total | `vNF` | `ValorServicos` | `vServ` |
| Municipio | `cMunFG` | `CodigoMunicipio` | `cLocPrest` |

---

## 3. Campos Necessarios para Escrituracao de NFS-e Tomada

### Campos obrigatorios para registro no Livro de Servicos Tomados

| # | Campo | Descricao | Fonte no XML |
|---|-------|-----------|-------------|
| 1 | **Numero NFS-e** | Numero unico da nota | `Numero` / `nNFSe` |
| 2 | **Data emissao** | Data/hora da emissao | `DataEmissao` / `dhEmi` |
| 3 | **Data competencia** | Mes/ano da competencia fiscal | `Competencia` / `dCompet` |
| 4 | **Prestador CNPJ** | CNPJ do prestador | `PrestadorServico/.../Cnpj` |
| 5 | **Prestador Razao Social** | Nome do prestador | `PrestadorServico/RazaoSocial` |
| 6 | **Prestador IM** | Inscricao Municipal | `InscricaoMunicipal` |
| 7 | **Tomador CNPJ** | CNPJ do tomador (nossa empresa) | `TomadorServico/.../Cnpj` |
| 8 | **Tomador Razao Social** | Nome da nossa empresa | `TomadorServico/RazaoSocial` |
| 9 | **Codigo LC 116** | Item da lista de servicos | `ItemListaServico` / `cTribNac` |
| 10 | **CNAE** | Codigo CNAE do servico | `CodigoCnae` |
| 11 | **Discriminacao** | Descricao textual do servico | `Discriminacao` / `xDescServ` |
| 12 | **Valor servico** | Valor bruto do servico | `ValorServicos` / `vServ` |
| 13 | **Deducoes** | Valor de deducoes legais | `ValorDeducoes` |
| 14 | **Base calculo ISS** | Base para calculo do ISS | `BaseCalculo` |
| 15 | **Aliquota ISS** | Percentual do ISS | `Aliquota` / `pAliq` |
| 16 | **Valor ISS** | Valor do ISS calculado | `ValorIss` |
| 17 | **ISS retido** | Se o ISS foi retido pelo tomador | `IssRetido` (1=Sim, 2=Nao) |
| 18 | **Valor ISS retido** | Valor do ISS retido na fonte | `ValorIssRetido` |
| 19 | **Municipio prestacao** | Codigo IBGE do municipio | `CodigoMunicipio` / `cLocPrest` |
| 20 | **Codigo verificacao** | Hash para validacao | `CodigoVerificacao` |
| 21 | **Retencao IR** | Imposto de Renda retido | `ValorIr` |
| 22 | **Retencao PIS** | PIS retido | `ValorPis` |
| 23 | **Retencao COFINS** | COFINS retida | `ValorCofins` |
| 24 | **Retencao CSLL** | CSLL retida | `ValorCsll` |
| 25 | **Retencao INSS** | INSS retido | `ValorInss` |
| 26 | **Outras retencoes** | Retencoes adicionais | `OutrasRetencoes` |
| 27 | **Natureza operacao** | Tipo de operacao fiscal | `NaturezaOperacao` |

---

## 4. ISS Retido na Fonte

### 4.1. Quando o tomador deve reter ISS

O ISS e retido na fonte pelo tomador nas seguintes situacoes (Art. 6, ss2 da LC 116/2003):

1. **Quando o servico e prestado em municipio diferente** do estabelecimento do prestador (Art. 3)
2. **Quando a legislacao municipal** do local da prestacao determina a retencao
3. **Quando o servico se enquadra** nos subitens com retencao obrigatoria

### 4.2. Servicos com retencao obrigatoria (Art. 6, ss2, II da LC 116/2003)

A pessoa juridica tomadora e RESPONSAVEL pela retencao quando contrata servicos dos seguintes subitens:

| Subitem LC 116 | Descricao |
|----------------|-----------|
| **3.05** | Cessao de andaimes, palcos, coberturas e estruturas de uso temporario |
| **7.02** | Execucao de obras de construcao civil, hidraulica, eletrica e semelhantes |
| **7.04** | Demolicao |
| **7.05** | Reparacao, conservacao e reforma de edificios, estradas, pontes, portos |
| **7.09** | Varricao, coleta, remocao e tratamento de residuos |
| **7.10** | Limpeza, manutencao e conservacao de vias e logradouros publicos |
| **7.12** | Controle e tratamento de efluentes |
| **7.14** | Florestamento, reflorestamento, semeadura, adubacao |
| **7.15** | Escoramento, contencao de encostas |
| **7.16** | Limpeza e dragagem |
| **7.17** | Acompanhamento e fiscalizacao de obras de engenharia |
| **7.19** | Acompanhamento e fiscalizacao de execucao de obras |
| **11.02** | Vigilancia, seguranca ou monitoramento |
| **17.05** | Fornecimento de mao de obra |
| **17.10** | Organizacao de feiras, congressos, exposicoes |

**IMPORTANTE para SLS Obras**: Os subitens 7.02, 7.04, 7.05, 7.17 e 7.19 sao diretamente relevantes para construcao civil. Quando a SLS Obras contrata esses servicos de terceiros, DEVE reter o ISS na fonte.

### 4.3. Como declarar o ISS retido

1. **Na NFS-e**: O campo `IssRetido` = 1 (Sim) indica que o tomador reteve
2. **Guia de recolhimento**: Gerar no portal do municipio onde o servico foi prestado
   - Sao Paulo: DAMSP (Documento de Arrecadacao do Municipio de SP)
   - Curitiba: DAM-ISS
   - Cada municipio tem sua propria guia
3. **Prazo**: Geralmente ate o dia 10 ou 15 do mes seguinte ao da competencia
4. **Obrigacao acessoria**: Informar na DES/GissOnline/declaracao municipal

### 4.4. Calculo

```
ISS Retido = Base de Calculo ISS x Aliquota ISS do Municipio
Valor a Pagar ao Prestador = Valor Servico - ISS Retido - Outras Retencoes
```

Aliquotas ISS: minimo 2%, maximo 5% (definido por cada municipio).

Para optantes do Simples Nacional como prestador, a retencao e calculada sobre a aliquota efetiva do SN para o servico (consultar DAS).

### 4.5. Excecao para MEI

MEI (Microempreendedor Individual) nao sofre retencao de ISS pelo tomador. O ISS e recolhido integralmente no DAS mensal do MEI.

---

## 5. API ADN (Ambiente de Dados Nacional)

### 5.1. O que e o ADN

O ADN e o repositorio nacional de documentos fiscais eletronicos (NFS-e e Eventos de NFS-e). Os sistemas municipais compartilham documentos com o ADN, que armazena e distribui aos interessados.

### 5.2. URLs da API

| Ambiente | URL Base |
|----------|----------|
| **Producao** | `https://adn.nfse.gov.br` |
| **SEFIN Nacional (emissao)** | `https://sefin.nfse.gov.br/sefinnacional` |
| **Prod. Restrita (homologacao)** | `https://sefin.producaorestrita.nfse.gov.br/SefinNacional` |
| **Swagger Contribuintes** | `https://www.nfse.gov.br/swagger/contribuintesissqn/#/DFe` |

### 5.3. Autenticacao

- **Certificado digital**: e-CNPJ tipo A1 ou A3, emitido pela ICP-Brasil
- **Protocolo**: mTLS (autenticacao mutua)
- **Identificacao do CNPJ**: Extraida do certificado via Subject Alternative Names (OID=2.16.76.1.3.3)
- **Requisito**: Um e-CNPJ por ESTABELECIMENTO (diferente da SEFAZ que aceita CNPJ raiz)

### 5.4. Endpoints Principais (Contribuintes)

| Metodo | Rota | Descricao |
|--------|------|-----------|
| **GET** | `/contribuintes/DFe/{ultNSU}` | Distribuicao de DF-e por NSU |
| **GET** | `/contribuintes/NFSe/{chaveAcesso}` | Consultar NFS-e por chave de acesso |
| **GET** | `/contribuintes/NFSe/{chaveAcesso}/Eventos` | Listar eventos de uma NFS-e |
| **GET** | `/contribuintes/NFSe/{chaveAcesso}/Eventos/{tipoEvento}` | Eventos por tipo |
| **GET** | `/contribuintes/NFSe/{chaveAcesso}/Eventos/{tipoEvento}/{numSeqEvento}` | Evento especifico |
| **GET** | `/parametros_municipais/{codMun}/{codServico}` | Parametros municipais |
| **GET** | `/parametros_municipais/{codMun}/{CNPJ}` | Beneficios do contribuinte |

### 5.5. Consulta por NSU (Distribuicao de DF-e)

```
GET https://adn.nfse.gov.br/contribuintes/DFe/{ultNSU}

Parametros:
- ultNSU: ultimo NSU processado (numerico)
- CNPJ (opcional): quando certificado e do CNPJ raiz mas quer consultar filial

Resposta: JSON contendo array de DF-e
Cada DF-e contem XML compactado (GZip) e codificado (Base64)
```

**Comportamento:**
- O ADN gera um NSU unico para cada interessado (emitente, tomador, intermediario)
- Se o ultNSU informado for menor que o primeiro disponivel, retorna a partir do primeiro
- NAO retorna `maxNSU` (diferente da SEFAZ)
- NAO tem limite de 90 dias (diferente da SEFAZ) — retorna todos os NSU disponiveis
- Intervalo recomendado entre consultas: **1 hora**

### 5.6. Formato da Resposta

- **Rotas**: JSON (request e response)
- **Documentos fiscais internos**: XML compactado via GZip, codificado em Base64, assinado digitalmente (XMLDSIG)
- Para usar o XML: Base64 decode → GZip decompress → XML

### 5.7. Limitacoes e Boas Praticas

1. **Intervalo entre consultas**: Recomendado 1 hora entre consultas de distribuicao
2. **Certificado por estabelecimento**: O ADN exige e-CNPJ que contenha o CNPJ exato do estabelecimento no SAN do certificado
3. **Idempotencia**: Deduplicar por `idDps` + CNPJ + serie + numero
4. **Retry**: Backoff exponencial + circuit breaker + jitter
5. **Sem lote de manifestacao**: Diferente da NFe, nao existe "manifestacao do destinatario" para NFS-e

### 5.8. Municipios no ADN

**Status fev/2026**: 5.565 entes federados aderentes, sendo ~1.898 em operacao ativa (34,7%)

A lista atualizada esta disponivel em: https://www.gov.br/nfse/pt-br/municipios/municipios-aderentes

**Obrigatoriedade**: LC 214/2025 obriga adesao. Municipios que nao implementarem podem ter transferencias voluntarias de recursos suspensas.

Municipios podem manter emissores proprios ate 31/12/2032, desde que compartilhem as NFS-e com o ADN.

---

## 6. Obrigacoes Municipais do Tomador

### 6.1. Livro de Servicos Tomados

- **Obrigatorio** para toda pessoa juridica que contrata servicos
- Substitui o antigo "Livro de Registro de Servicos Tomados" (papel)
- Hoje e eletronico na maioria dos municipios (DES, GissOnline, etc.)
- Registra TODAS as NFS-e recebidas de prestadores de servico
- Contem: dados do prestador, servico, valores, ISS (retido ou nao)

### 6.2. DES — Declaracao Eletronica de Servicos

- **Onde se aplica**: Belo Horizonte, Sao Paulo (descontinuada em SP), e outros municipios
- **Periodicidade**: Mensal, ate o dia 20 do mes seguinte
- **Conteudo**: Todos os documentos fiscais emitidos e recebidos referentes a servicos
- **Para SN**: ME/EPP optantes pelo Simples sao OBRIGADAS a entregar a DES quando exigida pelo municipio
- **Substitui**: Livro de Servicos Prestados e Livro de Servicos Tomados
- **Penalidade**: Multa por entrega em atraso ou nao entrega

### 6.3. GissOnline

- **Sistema eletronico** de escrituracao de NFS-e para prestadores e tomadores
- **Funcionalidade tomador**:
  - Notas de prestadores do MESMO municipio sao identificadas automaticamente
  - Tomador faz "aceite" para escriturar no Livro de Servicos Tomados
  - Notas de prestadores de FORA do municipio: escrituracao manual
- **Obrigatoriedade**: Todos os meses (mesmo sem movimento, encerrar como "sem movimento")
- **Utilizado em**: Centenas de municipios (sistema terceirizado)

### 6.4. ISS Digital / BHISS Digital

- **Sistema de Belo Horizonte** para cumprimento de obrigacoes tributarias do ISSQN
- Inclui escrituracao, apuracao e geracao de guias
- Validacoes conforme legislacao municipal

### 6.5. DAMSP (Sao Paulo) / DAM (Curitiba) / Guias municipais

- Cada municipio tem sua propria guia de recolhimento do ISS retido
- Sao Paulo: DAMSP gerado no portal da NFS-e Paulistana
- Curitiba: DAM-ISS via sistema ISS Curitiba
- Prazo: geralmente dia 10 ou 15 do mes subsequente

### 6.6. Prazos do Tomador (exemplo DF)

- **Aceite/Recusa da NFS-e**: Ate o dia 15 do mes subsequente ao fato gerador
- **Apuracao**: Encerra dia 15 do mes subsequente
- **Pagamento**: Ate o dia 20 do mes subsequente

### 6.7. Declaracao especifica para NFS-e de fora do municipio

Quando o prestador e de OUTRO municipio, o tomador geralmente precisa:
1. Escriturar manualmente os dados da NFS-e no sistema local
2. Verificar se deve reter ISS conforme Art. 3 da LC 116/2003
3. Gerar guia de recolhimento do ISS retido (se aplicavel)
4. Informar na declaracao mensal (DES, GissOnline, etc.)

---

## 7. Modelo de Dados Sugerido — NFS-e de Entrada

### 7.1. Model Prisma: `NfseImport`

```prisma
// ========== NFS-e de Entrada (Servicos Tomados) ==========

enum NfseImportStatus {
  PENDING       // Importada, aguardando revisao
  REVIEWED      // Revisada pelo operador
  BOOKED        // Escriturada no livro fiscal
  CANCELLED     // Cancelada/rejeitada
}

enum NfseImportOrigin {
  XML_UPLOAD    // Upload manual de XML
  ADN           // Ambiente de Dados Nacional (automatico)
  MANUAL        // Digitacao manual (sem XML)
  FOCUS_NFE     // Via API Focus NFe (NFS-e Recebidas)
}

enum NfseXmlLayout {
  ABRASF        // Padrao ABRASF (qualquer versao)
  NACIONAL      // Padrao Nacional (SPED)
  MANUAL        // Sem XML (digitacao)
}

model NfseImport {
  id                    String            @id @default(uuid())
  companyId             String

  // Origem e Layout
  origin                NfseImportOrigin  @default(XML_UPLOAD)
  xmlLayout             NfseXmlLayout?
  xmlContent            String?           // XML completo (se disponivel)

  // Identificacao da NFS-e
  nfseNumber            String?           // Numero da NFS-e
  codigoVerificacao     String?           // Codigo de verificacao
  chaveAcesso           String?           // Chave 50 digitos (Nacional)
  nsu                   String?           // NSU do ADN (se veio por la)

  // Datas
  issueDate             DateTime?         // Data de emissao
  competenceDate        DateTime?         // Data de competencia (mes/ano)

  // Prestador (quem emitiu a nota para nos)
  prestadorCnpjCpf      String?
  prestadorRazaoSocial  String?
  prestadorNomeFantasia String?
  prestadorIm           String?           // Inscricao Municipal
  prestadorMunicipio    String?           // Codigo IBGE
  prestadorUf           String?
  prestadorPartnerId    String?           // FK para Partner (se vinculado)

  // Tomador (nos = empresa do sistema)
  tomadorCnpjCpf        String?
  tomadorRazaoSocial    String?

  // Servico
  itemListaServico      String?           // Codigo LC 116 (ex: "07.02")
  codigoTribNacional    String?           // cTribNac 6 digitos (Nacional)
  codigoCnae            String?
  codigoTribMunicipio   String?           // Codigo tributacao municipio
  discriminacao         String?           // Descricao do servico
  naturezaOperacao      String?

  // Construcao Civil (quando aplicavel)
  codigoObra            String?           // CNO ou CEI
  art                   String?           // ART (ABRASF)
  obraId                String?           // FK para Obra no sistema

  // Valores (em centavos)
  valorServicosCents    Int?
  valorDeducoesCents    Int?
  baseCalculoCents      Int?
  descontoIncondCents   Int?
  descontoCondCents     Int?

  // ISS
  aliquotaIss           Float?            // Percentual (ex: 2.0 = 2%)
  valorIssCents         Int?
  issRetido             Boolean           @default(false)
  valorIssRetidoCents   Int?
  municipioIncidencia   String?           // Codigo IBGE onde ISS e devido

  // Retencoes Federais (em centavos)
  valorPisCents         Int?
  valorCofinsCents      Int?
  valorIrCents          Int?
  valorCsllCents        Int?
  valorInssCents        Int?
  outrasRetencoesCents  Int?

  // Valor Liquido
  valorLiquidoCents     Int?

  // Status e Workflow
  status                NfseImportStatus  @default(PENDING)
  reviewedAt            DateTime?
  reviewedBy            String?           // userId que revisou
  bookedAt              DateTime?         // Data de escrituracao
  bookedBy              String?
  cancelledAt           DateTime?
  cancelReason          String?

  // Relacionamentos
  financialEntryId      String?           // FK Lancamento A Pagar gerado
  serviceOrderId        String?           // FK OS vinculada (se houver)

  createdAt             DateTime          @default(now())
  updatedAt             DateTime          @updatedAt

  // Relations
  company               Company           @relation(fields: [companyId], references: [id])
  prestadorPartner      Partner?          @relation("NfsePrestador", fields: [prestadorPartnerId], references: [id])
  obra                  Obra?             @relation(fields: [obraId], references: [id])
  financialEntry        FinancialEntry?   @relation(fields: [financialEntryId], references: [id])
  serviceOrder          ServiceOrder?     @relation(fields: [serviceOrderId], references: [id])

  @@index([companyId, status])
  @@index([companyId, issueDate])
  @@index([companyId, prestadorCnpjCpf])
  @@index([chaveAcesso])
  @@index([nsu])
}
```

### 7.2. Relacionamentos

```
NfseImport
  ├── Company (obrigatorio) — empresa que TOMOU o servico
  ├── Partner (opcional) — prestador vinculado ao cadastro
  ├── Obra (opcional) — obra vinculada (construcao civil)
  ├── FinancialEntry (opcional) — lancamento A PAGAR gerado
  └── ServiceOrder (opcional) — OS relacionada
```

### 7.3. Fluxo de Status (Workflow)

```
  XML Upload / ADN / Manual
          |
          v
      [PENDING]  ←── Importada, dados preenchidos automaticamente
          |
     Operador revisa dados, vincula prestador/obra
          |
          v
     [REVIEWED]  ←── Dados confirmados, pronta para escriturar
          |
     Gera lancamento financeiro (A Pagar) se necessario
     Marca como escriturada
          |
          v
      [BOOKED]   ←── Escriturada no livro fiscal

      [CANCELLED] ←── NFS-e rejeitada/cancelada em qualquer ponto
```

### 7.4. Integracao com modulos existentes

**Financeiro**: Ao escriturar (BOOKED), opcionalmente cria `FinancialEntry` tipo PAYABLE:
- grossCents = valorServicosCents
- netCents = valorLiquidoCents (apos retencoes)
- Se ISS retido: criar lancamento separado para recolhimento ISS
- Se retencoes federais: considerar nos valores liquidos

**Parceiros**: O prestador pode ser vinculado a um `Partner` existente (ou criar novo):
- Match por CNPJ/CPF
- Tipo: Fornecedor (isSupplier = true)

**Obras**: Vincular ao model `Obra` existente quando for servico de construcao civil com CNO.

**OS**: Vincular a `ServiceOrder` quando o servico tomado esta relacionado a uma OS.

### 7.5. Focus NFe — API de NFS-e Recebidas

A Focus NFe oferece endpoint para consultar NFS-e recebidas:

| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET | `/v2/nfses_recebidas` | Listar NFS-e recebidas |
| GET | `/v2/nfses_recebidas/{ref}` | Consultar NFS-e recebida individual |

Autenticacao: HTTP Basic (token como username, senha vazia)
URL Producao: `https://api.focusnfe.com.br`
URL Homologacao: `https://homologacao.focusnfe.com.br`

Esta pode ser uma alternativa ao ADN direto, ja que a Focus NFe ja faz a integracao.

---

## 8. Resumo de Opcoes de Importacao — Ordem de Prioridade

| Prioridade | Metodo | Complexidade | Cobertura |
|------------|--------|-------------|-----------|
| 1 | **Upload XML manual** | Baixa | Universal (aceita qualquer XML) |
| 2 | **Digitacao manual** | Baixa | Universal (sem XML) |
| 3 | **Focus NFe Recebidas** | Media | Municipios integrados (~1000+) |
| 4 | **ADN direto** | Alta (mTLS) | Municipios conveniados (~1900 ativos) |

**Recomendacao para Tecnikos (curto prazo):**
- Implementar upload de XML com parser ABRASF + Nacional + deteccao automatica
- Implementar formulario de digitacao manual
- Wizard similar ao de NFe (upload → prestador → servico → financeiro → confirmacao)

**Medio prazo:**
- Integrar Focus NFe NFS-e Recebidas (ja usa Focus NFe)
- Relatorio Livro de Servicos Tomados

**Longo prazo:**
- ADN direto via mTLS (para clientes com e-CNPJ configurado)

---

## Fontes

- Manual ABRASF: https://nfse.assis.sp.gov.br/temp/Manual_De_Integracao%20versao%202-01%20ABRASF.pdf
- Schema ABRASF: https://sefaz.camacari.ba.gov.br/central-de-conteudo/schema-xml-nfs-e-versao-2-01-abrasf-i/
- Portal NFS-e Nacional: https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica
- Manual ADN Contribuintes: https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/documentacao-atual/manual-contribuintes-apis-adn-sistema-nacional-nfse.pdf
- Swagger ADN: https://www.nfse.gov.br/swagger/contribuintesissqn/#/DFe
- Municipios Aderentes: https://www.gov.br/nfse/pt-br/municipios/municipios-aderentes
- Focus NFe Documentacao: https://focusnfe.com.br/doc/
- Focus NFe NFS-e Recebidas: https://www.postman.com/focusnfe/focus-nfe/folder/938kn2d/consulta-de-nfse-recebidas
- LC 116/2003: https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp116.htm
- GissOnline: https://portal.gissonline.com.br
- ISS Retido (Focus NFe): https://focusnfe.com.br/blog/quando-o-iss-e-retido-na-nfse-e-como-calcular-o-valor/
- ISS Retido (Contabilizei): https://www.contabilizei.com.br/contabilidade-online/iss-retido/
- API NFSe Nacional (Nota Gateway): https://notagateway.com.br/blog/api-nfse-nacional/
- NT 004 NFS-e (Focus NFe): https://focusnfe.com.br/blog/nota-tecnica-004-nfs-e-nacional/
