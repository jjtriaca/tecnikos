# Estudo Completo — NFS-e de Entrada (Servicos Tomados) e ISS

**Data**: 06/03/2026
**Contexto**: Tecnikos ERP | Implementacao de parser e importacao NFS-e de entrada
**Pesquisa**: Web research realizada em 06/03/2026

---

## 1. NFS-e DE ENTRADA — IMPORTACAO

### 1.1 Layout XML ABRASF 2.04 — Campos Principais

O padrao ABRASF (Associacao Brasileira das Secretarias de Financas das Capitais) e usado por milhares de municipios que mantem sistemas proprios. A versao 2.04 e a mais recente.

#### Estrutura hierarquica do XML:

```xml
<CompNfse>
  <Nfse>
    <InfNfse Id="...">
      <!-- IDENTIFICACAO DA NOTA -->
      <Numero>12345</Numero>
      <CodigoVerificacao>ABC123</CodigoVerificacao>
      <DataEmissao>2026-03-06T10:00:00</DataEmissao>
      <NfseSubstituida>0</NfseSubstituida>           <!-- opcional -->
      <OutrasInformacoes>texto livre</OutrasInformacoes> <!-- opcional -->
      <NaturezaOperacao>1</NaturezaOperacao>
      <!-- 1=Trib.municipio, 2=Trib.fora, 3=Isencao, 4=Imune, 5=Exig.susp.decisao, 6=Exig.susp.proc -->
      <RegimeEspecialTributacao>0</RegimeEspecialTributacao>
      <OptanteSimplesNacional>1</OptanteSimplesNacional>  <!-- 1=Sim 2=Nao -->
      <IncentivadorCultural>2</IncentivadorCultural>       <!-- 1=Sim 2=Nao -->
      <Competencia>2026-03</Competencia>

      <!-- SERVICO -->
      <Servico>
        <Valores>
          <ValorServicos>1000.00</ValorServicos>          <!-- OBRIGATORIO -->
          <ValorDeducoes>0.00</ValorDeducoes>
          <ValorPis>0.00</ValorPis>
          <ValorCofins>0.00</ValorCofins>
          <ValorInss>0.00</ValorInss>
          <ValorIr>0.00</ValorIr>
          <ValorCsll>0.00</ValorCsll>
          <OutrasRetencoes>0.00</OutrasRetencoes>
          <ValorIss>20.00</ValorIss>
          <Aliquota>2.00</Aliquota>                       <!-- percentual -->
          <DescontoIncondicionado>0.00</DescontoIncondicionado>
          <DescontoCondicionado>0.00</DescontoCondicionado>
          <IssRetido>1</IssRetido>                        <!-- OBRIGATORIO: 1=Sim 2=Nao -->
          <ValorLiquidoNfse>980.00</ValorLiquidoNfse>
          <BaseCalculo>1000.00</BaseCalculo>
        </Valores>
        <ItemListaServico>7.02</ItemListaServico>         <!-- OBRIGATORIO: Item LC 116 -->
        <CodigoCnae>4321500</CodigoCnae>
        <CodigoTributacaoMunicipio>070200</CodigoTributacaoMunicipio>
        <Discriminacao>Servicos de construcao civil</Discriminacao> <!-- OBRIGATORIO -->
        <CodigoMunicipio>5107040</CodigoMunicipio>        <!-- OBRIGATORIO: IBGE 7 digitos -->
        <CodigoPais>1058</CodigoPais>                     <!-- opcional: BACEN -->
        <ExigibilidadeISS>1</ExigibilidadeISS>            <!-- OBRIGATORIO -->
        <!-- 1=Exigivel, 2=Nao incid, 3=Isencao, 4=Exportacao, 5=Imunidade, 6=Susp.decisao, 7=Susp.proc -->
      </Servico>

      <!-- PRESTADOR (quem emitiu a nota) -->
      <PrestadorServico>
        <IdentificacaoPrestador>
          <CpfCnpj>
            <Cnpj>12345678000199</Cnpj>
          </CpfCnpj>
          <InscricaoMunicipal>12345</InscricaoMunicipal>
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
          <Cep>78850000</Cep>
        </Endereco>
        <Contato>
          <Telefone>66999999999</Telefone>
          <Email>contato@prestadora.com</Email>
        </Contato>
      </PrestadorServico>

      <!-- TOMADOR (quem contratou o servico) -->
      <TomadorServico>
        <IdentificacaoTomador>
          <CpfCnpj>
            <Cnpj>47226599000140</Cnpj>
          </CpfCnpj>
          <InscricaoMunicipal>9648219</InscricaoMunicipal>
        </IdentificacaoTomador>
        <RazaoSocial>SLS OBRAS LTDA</RazaoSocial>
        <Endereco>
          <Endereco>Rua Brasil</Endereco>
          <Numero>200</Numero>
          <Bairro>Centro</Bairro>
          <CodigoMunicipio>5107040</CodigoMunicipio>
          <Uf>MT</Uf>
          <Cep>78850000</Cep>
        </Endereco>
      </TomadorServico>

      <!-- INTERMEDIARIO (opcional) -->
      <IntermediarioServico>
        <RazaoSocial>...</RazaoSocial>
        <CpfCnpj><Cnpj>...</Cnpj></CpfCnpj>
        <InscricaoMunicipal>...</InscricaoMunicipal>
      </IntermediarioServico>

      <!-- CONSTRUCAO CIVIL (opcional) -->
      <ConstrucaoCivil>
        <CodigoObra>CNO-123456</CodigoObra>
        <Art>ART-789</Art>
      </ConstrucaoCivil>

    </InfNfse>
  </Nfse>
</CompNfse>
```

#### Campos obrigatorios do ABRASF:
| Campo | Tag | Tipo | Descricao |
|---|---|---|---|
| Numero da NFS-e | `Numero` | Integer | Numero sequencial unico |
| Codigo Verificacao | `CodigoVerificacao` | String | Hash de autenticidade |
| Data Emissao | `DataEmissao` | DateTime | ISO 8601 |
| Competencia | `Competencia` | String | AAAA-MM |
| Valor Servicos | `ValorServicos` | Decimal | Valor bruto |
| ISS Retido | `IssRetido` | Integer | 1=Sim 2=Nao |
| Item Lista Servico | `ItemListaServico` | String | Codigo LC 116/2003 |
| Discriminacao | `Discriminacao` | String | Descricao do servico |
| Codigo Municipio | `CodigoMunicipio` | Integer | IBGE 7 digitos |
| ExigibilidadeISS | `ExigibilidadeISS` | Integer | 1 a 7 |
| CNPJ/CPF Prestador | `CpfCnpj/Cnpj` | String | 14 ou 11 digitos |
| CNPJ/CPF Tomador | `CpfCnpj/Cnpj` | String | 14 ou 11 digitos |

---

### 1.2 Layout XML NFS-e Nacional (DPS)

O padrao Nacional e gerido pelo Comite Gestor da NFS-e (SE/CGNFS-e), vinculado a Receita Federal. Usa a DPS (Declaracao de Prestacao de Servico) como documento base.

#### Estrutura hierarquica do XML:

```xml
<NFSe xmlns="http://www.sped.fazenda.gov.br/nfse">
  <infNFSe Id="NFSe..." versao="1.00">

    <!-- DADOS GERADOS PELO SISTEMA (pos-autorizacao) -->
    <nNFSe>12345</nNFSe>                    <!-- numero da NFS-e -->
    <cLocEmi>5107040</cLocEmi>               <!-- municipio emissao -->
    <dEmi>2026-03-06</dEmi>                  <!-- data emissao -->
    <hEmi>10:00:00-03:00</hEmi>              <!-- hora emissao -->
    <tpAmb>1</tpAmb>                         <!-- 1=Producao 2=Homologacao -->
    <verAplic>1.0.0</verAplic>
    <dhProc>2026-03-06T10:00:05-03:00</dhProc>
    <nDFSe>987654</nDFSe>                   <!-- numero DF-e no ADN -->

    <!-- EMITENTE (gerado pelo sistema) -->
    <emit>
      <CNPJ>12345678000199</CNPJ>
      <xNome>EMPRESA PRESTADORA LTDA</xNome>
      <xFant>PRESTADORA</xFant>
      <enderNac>
        <cMun>5107040</cMun>
        <CEP>78850000</CEP>
      </enderNac>
      <fone>66999999999</fone>
      <email>contato@prestadora.com</email>
    </emit>

    <!-- VALORES DA NFS-e (calculados pelo sistema) -->
    <valores>
      <vLiq>980.00</vLiq>                   <!-- valor liquido -->
      <vISSQN>20.00</vISSQN>                <!-- ISS calculado -->
      <vTotalRet>20.00</vTotalRet>           <!-- total retencoes -->
    </valores>

    <!-- DPS — DECLARACAO DE PRESTACAO DE SERVICO -->
    <DPS>
      <infDPS Id="DPS..." versao="1.00">
        <tpAmb>1</tpAmb>
        <dhEmi>2026-03-06T10:00:00-03:00</dhEmi>
        <verAplic>TECNIKOS-1.0</verAplic>
        <serie>1</serie>
        <nDPS>1</nDPS>                       <!-- numero sequencial DPS -->
        <dCompet>2026-03-06</dCompet>        <!-- data competencia -->
        <tpEmit>1</tpEmit>                   <!-- 1=Prestador 2=Tomador 3=Interm -->
        <cLocEmi>5107040</cLocEmi>

        <!-- SUBSTITUICAO (opcional) -->
        <subst>
          <chSubstda>NFSe...</chSubstda>     <!-- chave NFS-e substituida -->
        </subst>

        <!-- PRESTADOR -->
        <prest>
          <CNPJ>12345678000199</CNPJ>
          <IM>12345</IM>                     <!-- Inscricao Municipal -->
          <regTrib>
            <opSN>1</opSN>                  <!-- 1=SN 2=Nao SN -->
            <regApworTribworMun>0</regApworTribworMun>
            <regEspTrib>0</regEspTrib>       <!-- 0=Nenhum -->
          </regTrib>
        </prest>

        <!-- TOMADOR -->
        <toma>
          <CNPJ>47226599000140</CNPJ>
          <xNome>SLS OBRAS LTDA</xNome>
          <end>
            <endNac>
              <cMun>5107040</cMun>
              <CEP>78850000</CEP>
            </endNac>
            <xLgr>Rua Brasil</xLgr>
            <nro>200</nro>
            <xBairro>Centro</xBairro>
          </end>
          <fone>66999999999</fone>
          <email>sls@tecnikos.com.br</email>
        </toma>

        <!-- INTERMEDIARIO (opcional) -->
        <interm>
          <CNPJ>...</CNPJ>
          <xNome>...</xNome>
        </interm>

        <!-- SERVICO -->
        <serv>
          <locPrest>
            <cLocPrestacao>5107040</cLocPrestacao>
            <cPaisPrestacao>1058</cPaisPrestacao>
          </locPrest>
          <cServ>
            <cTribNac>070200</cTribNac>      <!-- Codigo Tributacao Nacional 6+3 digitos -->
            <cTribMun>070200</cTribMun>       <!-- Codigo tributacao municipal (opcional) -->
            <CNAE>4321500</CNAE>
            <xDescServ>Servicos de construcao civil conforme contrato</xDescServ>
          </cServ>
        </serv>

        <!-- VALORES -->
        <valores>
          <vServPrest>
            <vReceb>0.00</vReceb>
            <vServ>1000.00</vServ>           <!-- valor do servico -->
          </vServPrest>
          <vDescCondIncond>
            <vDescIncond>0.00</vDescIncond>
            <vDescCond>0.00</vDescCond>
          </vDescCondIncond>
          <vDedRed>
            <vDed>0.00</vDed>               <!-- deducoes de material -->
          </vDedRed>

          <!-- TRIBUTACAO -->
          <trib>
            <tribMun>
              <tribISSQN>1</tribISSQN>       <!-- 1=Operacao normal -->
              <cPaisResult>1058</cPaisResult>
              <BM>
                <vBM>1000.00</vBM>            <!-- base de calculo municipal -->
                <vExcessoBCFixa>0</vExcessoBCFixa>
                <vISS>20.00</vISS>
                <vISSRet>20.00</vISSRet>      <!-- ISS retido -->
                <pAliq>2.0000</pAliq>          <!-- aliquota ISS -->
                <tpRetISSQN>1</tpRetISSQN>     <!-- 1=Retido pelo Tomador -->
              </BM>
              <exISSQN>0</exISSQN>
            </tribMun>

            <tribFed>
              <vRetCP>0.00</vRetCP>            <!-- INSS retido -->
              <vRetIRRF>0.00</vRetIRRF>        <!-- IR retido -->
              <vRetCSLL>0.00</vRetCSLL>        <!-- CSLL + PIS + COFINS retidos -->
            </tribFed>

            <!-- TOTAL TRIBUTOS (mutuamente exclusivos) -->
            <totTrib>
              <!-- Para Simples Nacional: -->
              <pTotTribSN>8.50</pTotTribSN>    <!-- % total tributos SN -->
              <!-- OU para Regime Normal: -->
              <!-- <vTotTrib>100.00</vTotTrib> -->
              <!-- OU percentuais separados:
              <pTotTribFed>3.65</pTotTribFed>
              <pTotTribEst>0</pTotTribEst>
              <pTotTribMun>2.00</pTotTribMun>
              -->
            </totTrib>
          </trib>
        </valores>

        <!-- INFORMACOES DE OBRA (opcional) -->
        <infObra>
          <cObra>CNO-123456</cObra>          <!-- CNO ou CEI -->
          <xLgr>Rua da Obra</xLgr>
          <nro>50</nro>
          <xCpl>Bloco A</xCpl>
          <xBairro>Industrial</xBairro>
          <CEP>78850100</CEP>
        </infObra>

      </infDPS>
    </DPS>
  </infNFSe>
</NFSe>
```

#### Campos obrigatorios do Nacional:
| Campo | Tag / Caminho | Tipo | Descricao |
|---|---|---|---|
| Numero NFS-e | `nNFSe` | Integer | Atribuido pelo ADN |
| Data Emissao | `dEmi` | Date | AAAA-MM-DD |
| Data Competencia | `infDPS/dCompet` | Date | AAAA-MM-DD |
| Numero DPS | `infDPS/nDPS` | Integer | Sequencial do prestador |
| Serie | `infDPS/serie` | String | Serie do RPS |
| CNPJ Prestador | `infDPS/prest/CNPJ` | String | 14 digitos |
| CNPJ/CPF Tomador | `infDPS/toma/CNPJ` ou `CPF` | String | 14 ou 11 |
| Nome Tomador | `infDPS/toma/xNome` | String | Razao social |
| Cod Trib Nacional | `infDPS/serv/cServ/cTribNac` | String | 6+3 digitos |
| Descricao Servico | `infDPS/serv/cServ/xDescServ` | String | Livre |
| Valor Servico | `infDPS/valores/vServPrest/vServ` | Decimal | Valor bruto |
| Aliquota ISS | `infDPS/valores/trib/tribMun/BM/pAliq` | Decimal | 4 casas |
| Valor ISS | `infDPS/valores/trib/tribMun/BM/vISS` | Decimal | Calculado |
| ISS Retido | `infDPS/valores/trib/tribMun/BM/tpRetISSQN` | Integer | 1=Retido |
| Valor Liquido | `infNFSe/valores/vLiq` | Decimal | Pos-autorizacao |

---

### 1.3 Diferencas entre ABRASF e Nacional

| Aspecto | ABRASF 2.04 | Nacional (DPS) |
|---|---|---|
| **Orgao gestor** | ABRASF (capitais) | SE/CGNFS-e (Receita Federal) |
| **Root element** | `<CompNfse>` | `<NFSe>` |
| **Namespace** | Varia por municipio | `http://www.sped.fazenda.gov.br/nfse` |
| **Tag principal** | `InfNfse` | `infNFSe` (camelCase) |
| **Servico** | `Servico > ItemListaServico` | `serv > cServ > cTribNac` |
| **Codigo servico** | Item LC 116 (ex: `7.02`) | cTribNac 9 digitos (ex: `070200000`) |
| **Valores** | `Valores` (flat) | `valores > vServPrest + trib` (nested) |
| **ISS Retido** | `IssRetido` (1/2) | `tpRetISSQN` (0/1/2) |
| **Aliquota** | `Aliquota` (decimal) | `pAliq` (4 casas decimais) |
| **Prestador** | `PrestadorServico` | `prest` (abreviado) |
| **Tomador** | `TomadorServico` | `toma` (abreviado) |
| **Endereco** | Tags completas | `endNac > cMun + CEP` |
| **Competencia** | `Competencia` (AAAA-MM) | `dCompet` (AAAA-MM-DD) |
| **Construcao civil** | `ConstrucaoCivil > CodigoObra + Art` | `infObra > cObra + endereco` |
| **Natureza Operacao** | `NaturezaOperacao` (1-6) | `tribISSQN` (1-5 + flags) |
| **Simples Nacional** | `OptanteSimplesNacional` (1/2) | `prest/regTrib/opSN` (1/2) |
| **Tributos federais** | Tags separadas (ValorPis, etc.) | Agrupado em `tribFed` |
| **Total tributos** | Nao tem | `totTrib` (pTotTribSN ou vTotTrib) |
| **IBS/CBS** | Nao tem | Grupo `IBSCBS` (desde NT 004/2025) |
| **Assinatura** | XMLDSig no InfNfse | XMLDSig no infDPS |

---

### 1.4 Como Identificar qual Layout e o XML Recebido

```typescript
// Estrategia de deteccao automatica do layout
function detectNfseLayout(xmlString: string): 'ABRASF' | 'NACIONAL' | 'DESCONHECIDO' {
  // 1. Verificar namespace
  if (xmlString.includes('sped.fazenda.gov.br/nfse')) {
    return 'NACIONAL';
  }

  // 2. Verificar root element
  if (xmlString.includes('<CompNfse') || xmlString.includes('<ConsultarNfseResposta')) {
    return 'ABRASF';
  }
  if (xmlString.includes('<NFSe') && xmlString.includes('<infNFSe')) {
    return 'NACIONAL';
  }

  // 3. Verificar tags internas caracteristicas
  if (xmlString.includes('<InfNfse') && xmlString.includes('<ItemListaServico')) {
    return 'ABRASF';
  }
  if (xmlString.includes('<infDPS') && xmlString.includes('<cTribNac')) {
    return 'NACIONAL';
  }

  // 4. Verificar estrutura DPS
  if (xmlString.includes('<DPS>') && xmlString.includes('<infDPS')) {
    return 'NACIONAL';
  }

  return 'DESCONHECIDO';
}
```

### 1.5 Campos Obrigatorios para Escrituracao

Independente do layout (ABRASF ou Nacional), os campos necessarios para escrituracao sao:

| Campo | Obrigatorio | Uso |
|---|---|---|
| **CNPJ/CPF Prestador** | SIM | Identificacao do fornecedor |
| **Razao Social Prestador** | SIM | Nome do fornecedor |
| **CNPJ/CPF Tomador** | SIM | Identificacao de quem contratou |
| **Numero da NFS-e** | SIM | Controle fiscal |
| **Data Emissao** | SIM | Escrituracao |
| **Data Competencia** | SIM | Periodo de apuracao do ISS |
| **Valor Servicos** | SIM | Base de calculo |
| **Aliquota ISS** | SIM | Calculo do imposto |
| **Valor ISS** | SIM | Imposto calculado |
| **ISS Retido (sim/nao)** | SIM | Define responsabilidade de recolhimento |
| **Codigo Servico LC 116** | SIM | Classificacao do servico |
| **Discriminacao** | SIM | Descricao do servico prestado |
| **Codigo Municipio** | SIM | Local da prestacao |
| **Codigo Verificacao** | ABRASF sim, Nacional por chave | Autenticidade |

---

## 2. ISS — REGRAS DE RETENCAO

### 2.1 Quando o Tomador e Responsavel pela Retencao

A LC 116/2003, art. 6o, define que municipios **podem** atribuir ao tomador a responsabilidade pelo ISS. O paragrafo 2o define casos onde o tomador e **automaticamente** responsavel:

#### Art. 6o, ss2o, Inciso I — Servico do exterior:
O tomador ou intermediario de servico proveniente do exterior do Pais ou cuja prestacao se tenha iniciado no exterior.

#### Art. 6o, ss2o, Inciso II — Servicos especificos:
A pessoa juridica, ainda que imune ou isenta, tomadora ou intermediaria dos seguintes servicos:

| Subitem LC 116 | Descricao |
|---|---|
| **3.05** | Cessao de andaimes, palcos, coberturas e estruturas de uso temporario |
| **7.02** | Execucao de obras de construcao civil (administracao, empreitada, subempreitada) |
| **7.04** | Demolicao |
| **7.05** | Reparacao, conservacao e reforma de edificios, estradas, pontes, portos |
| **7.09** | Varricao, coleta, remocao, incineracao de lixo e residuos |
| **7.10** | Limpeza, manutencao e conservacao de vias, imoveis, chaminés, piscinas, parques |
| **7.12** | Controle e tratamento de efluentes e agentes fisicos/quimicos/biologicos |
| **7.16** | Florestamento, reflorestamento, semeadura, adubacao, reparacao de solo |
| **7.17** | Escoramento, contencao de encostas e servicos congeneres |
| **7.19** | Acompanhamento e fiscalizacao de obras de engenharia |
| **11.02** | Vigilancia, seguranca ou monitoramento de bens, pessoas e semoventes |
| **17.05** | Fornecimento de mao-de-obra temporaria |
| **17.10** | Planejamento, organizacao e administracao de feiras e congeneres |

**IMPORTANTE**: A obrigatoriedade EFETIVA de retencao depende de **lei municipal** regulamentando. A LC 116 apenas autoriza e define os servicos sujeitos.

#### Regras praticas:
1. Servico prestado no MESMO municipio do tomador e prestador: ISS pode ser retido se lei municipal previr
2. Servico prestado em municipio DIFERENTE do prestador (art. 3o): ISS devido no local da prestacao, tomador retém
3. Servico do EXTERIOR: tomador SEMPRE retém (ss2o, I)
4. Tomador SEMPRE e responsavel mesmo se NAO reteve (ss1o: "independentemente de ter sido efetuada a retencao")

---

### 2.2 Aliquota Minima e Maxima

| Parametro | Valor | Base Legal |
|---|---|---|
| **Aliquota minima** | **2%** | Art. 8o-A LC 116/2003 (inserido pela LC 157/2016) |
| **Aliquota maxima** | **5%** | Art. 8o, II, LC 116/2003 |
| **Vedacao** | Proibido conceder isencoes/beneficios que resultem em carga < 2% | Art. 8o-A, ss1o |
| **Excecao** | Construcao civil e transporte coletivo podem ter aliquota < 2% | Art. 8o-A, ss2o |
| **Penalidade** | Ato de improbidade administrativa se conceder beneficio < 2% | LC 157/2016 alterou Lei 8.429/92 |
| **Historico** | Piso de 2% ja existia no ADCT art. 88 desde EC 37/2002 | |

---

### 2.3 ISS Retido vs ISS Devido — Contabilizacao

#### Para o TOMADOR (quem contrata e retém):

```
Contabilizacao ao pagar o servico:
D - Despesa com Servicos .............. R$ 1.000,00
C - ISS a Recolher (passivo) .......... R$    20,00  (ISS retido)
C - Fornecedores (passivo) ............ R$   980,00  (liquido a pagar)

Ao recolher o ISS retido:
D - ISS a Recolher (passivo) .......... R$    20,00
C - Banco c/c ......................... R$    20,00
```

#### Para o PRESTADOR (quem emite a nota):

```
Contabilizacao ao emitir NFS-e:
D - Clientes (ativo) .................. R$   980,00  (liquido a receber)
D - ISS Retido na Fonte (ativo temp) .. R$    20,00  (credito contra ISS)
C - Receita de Servicos ............... R$ 1.000,00

Apuracao do ISS:
D - ISS sobre Servicos (despesa) ...... R$    20,00
C - ISS Retido na Fonte (ativo temp) .. R$    20,00  (compensa)
```

#### Resumo pratico:
- **ISS RETIDO**: Tomador desconta do pagamento e recolhe via guia municipal
- **ISS DEVIDO**: Valor que o prestador deve ao municipio (se nao retido, paga no DAS ou guia propria)
- **ISS RETIDO = ISS DEVIDO**: Quando ha retencao, o imposto ja foi pago pelo tomador

---

### 2.4 ISS para Empresas do Simples Nacional

#### Como funciona:
1. O ISS do SN esta **embutido no DAS** (Documento de Arrecadacao do Simples)
2. A aliquota efetiva do ISS depende do **Anexo** (III, IV ou V) e da **faixa de faturamento**
3. Quando ha **retencao**, o ISS e **segregado** do DAS — o prestador nao paga ISS no DAS naquele mes
4. O tomador retém usando a **aliquota informada na NFS-e** pelo prestador

#### Regras de aliquota na retencao:
| Situacao | Aliquota de retencao |
|---|---|
| Prestador informou aliquota na NF | Usar a aliquota informada |
| Prestador OMITIU aliquota na NF | Reter **5%** (maxima — carater punitivo) |
| Prestador em inicio de atividade | Menor aliquota do Anexo (geralmente **2%**) |
| Prestador informou aliquota menor que a devida | Retém o informado; prestador recolhe diferenca |

#### Anexos e ISS:
| Anexo | Tipo de servico | Aliquota ISS (faixa 1) | Aliquota ISS (faixa 6) |
|---|---|---|---|
| III | Servicos gerais | 2.00% | 5.00% |
| IV | Construcao civil, vigilancia | 2.00% | 5.00% |
| V | Servicos intelectuais | 2.00% | 5.00% |

**Fator R**: Se folha/faturamento >= 28%, empresa migra Anexo V para III (aliquotas menores).

#### Impacto no DAS:
- Receita com ISS retido: informar no PGDAS-D como "com retencao"
- O percentual de ISS e **zerado** naquela receita no calculo do DAS
- Os demais tributos (IRPJ, CSLL, PIS, COFINS, CPP) continuam no DAS normalmente

#### Novidades 2026 (Reforma Tributaria):
- NFS-e emitida por SN deve conter campos CBS (0,9%) e IBS (0,1%) — meramente informativos em 2026
- Opcao de recolher CBS/IBS fora do DAS (semestral) para permitir credito ao tomador

---

## 3. ESCRITURACAO DE SERVICOS TOMADOS

### 3.1 Livro de Registro de Servicos Tomados

Obrigacao acessoria **municipal** para empresas que contratam servicos.

#### Campos do livro:
| Campo | Descricao |
|---|---|
| Data emissao | Data da NFS-e |
| Data competencia | Periodo de apuracao |
| Numero da NFS-e | Identificador unico |
| Serie | Serie da nota (quando houver) |
| Codigo verificacao | Hash de autenticidade |
| CPF/CNPJ Prestador | Documento do prestador |
| Inscricao Municipal Prestador | IM do prestador |
| Razao Social Prestador | Nome do prestador |
| Municipio Prestador | Cidade onde esta inscrito |
| Codigo servico (LC 116) | Item da lista de servicos |
| Descricao do servico | Discriminacao |
| Valor dos servicos | Valor bruto |
| Base de calculo ISS | Valor menos deducoes |
| Aliquota ISS | Percentual aplicado |
| Valor ISS | Imposto calculado |
| ISS Retido na fonte | Sim/Nao + valor retido |
| Natureza operacao | Normal, isenta, imune, etc. |
| Situacao tributaria | Normal, retencao, ST |
| Observacoes | Informacoes adicionais |

#### Formato eletronico:
- Maioria dos municipios aceita **Declaracao Eletronica de Servicos (DES)** ou sistemas equivalentes
- Substitui livro fisico
- Plataformas comuns: GissOnline, ISS.net, Betha, etc.
- Prazo e formato variam por municipio

#### Para Simples Nacional:
- Art. 63 da Resolucao CGSN no 140/2018 lista livros obrigatorios
- Livro Registro de Servicos Tomados e **obrigatorio**
- Pode ser dispensado se municipio aceitar DES eletronica

---

### 3.2 EFD-Contribuicoes — Bloco A (Servicos)

**ATENCAO**: Empresas do Simples Nacional estao **DISPENSADAS** da EFD-Contribuicoes. Esta secao e referencia para futuros clientes Lucro Real/Presumido.

#### Registro A100 — Documento: Nota Fiscal de Servico:
| Campo | Descricao |
|---|---|
| IND_OPER | 0=Servico contratado (entrada), 1=Servico prestado (saida) |
| IND_EMIT | 0=Emissao propria, 1=Terceiros |
| COD_SIT | 00=Regular, 02=Cancelado |
| SER | Serie do documento |
| SUB | Subserie |
| NUM_DOC | Numero do documento |
| CHV_NFSE | Chave da NFS-e (se disponivel) |
| DT_DOC | Data do documento |
| DT_EXE_SERV | Data da execucao do servico |
| VL_DOC | Valor total do documento |
| IND_PGTO | Tipo pagamento: 0=Vista, 1=Prazo, 9=Sem pagamento |
| VL_DESC | Valor do desconto |
| VL_BC_PIS | Base de calculo PIS |
| VL_PIS | Valor PIS |
| VL_BC_COFINS | Base de calculo COFINS |
| VL_COFINS | Valor COFINS |
| VL_PIS_RET | PIS retido na fonte (informativo) |
| VL_COFINS_RET | COFINS retida na fonte (informativo) |
| VL_ISS | Valor do ISS |

#### Registro A170 — Itens do Documento:
| Campo | Descricao |
|---|---|
| NUM_ITEM | Numero sequencial do item |
| COD_ITEM | Codigo do item/servico |
| DESCR_COMPL | Descricao complementar |
| VL_ITEM | Valor do item |
| VL_DESC | Desconto do item |
| NAT_BC_CRED | Natureza da base de calculo do credito |
| IND_ORIG_CRED | Indicador de origem do credito |
| CST_PIS | CST do PIS |
| VL_BC_PIS | Base PIS |
| ALIQ_PIS | Aliquota PIS (4 casas decimais) |
| VL_PIS | Valor PIS |
| CST_COFINS | CST da COFINS |
| VL_BC_COFINS | Base COFINS |
| ALIQ_COFINS | Aliquota COFINS (4 casas decimais) |
| VL_COFINS | Valor COFINS |
| COD_CTA | Codigo da conta contabil |

---

### 3.3 EFD ICMS/IPI — Bloco B (ISS)

**ATENCAO**: O Bloco B da EFD ICMS/IPI e exclusivo para contribuintes do **Distrito Federal** (que tem jurisdicao sobre ICMS e ISS). Demais estados nao usam o Bloco B.

Para Simples Nacional: tambem **dispensado** da EFD ICMS/IPI.

#### Registro B020 — Nota Fiscal (ISS):
| Campo | Descricao |
|---|---|
| IND_OPER | 0=Aquisicao (servico tomado), 1=Prestacao (servico prestado) |
| IND_EMIT | 0=Propria, 1=Terceiros |
| COD_PART | Codigo do participante (prestador ou tomador) |
| COD_MOD | Modelo do documento fiscal |
| COD_SIT | Situacao do documento |
| SER | Serie |
| NUM_DOC | Numero do documento |
| CHV_NFE | Chave de acesso (se NF-e conjugada) |
| DT_DOC | Data do documento |
| COD_MUN_SERV | Codigo IBGE do municipio de prestacao |
| VL_CONT | Valor contabil (servicos, sem mercadorias) |
| VL_MAT_SERV | Valor das mercadorias no servico |

#### Registro B025 — Detalhamento (aliquota x item):
| Campo | Descricao |
|---|---|
| VL_CONT_P | Valor contabil da parcela |
| VL_BC_ISS | Base de calculo ISS |
| ALIQ_ISS | Aliquota do ISS |
| VL_ISS | Valor do ISS |
| VL_ISS_RET | Valor do ISS retido pelo tomador |
| COD_SERV | Codigo do servico (item LC 116) |

---

### 3.4 CFPS — Codigo Fiscal de Prestacao de Servicos

O CFPS **existe** mas NAO e padronizado nacionalmente. E adotado por **algumas prefeituras** (ex: Florianopolis, Balneario Camboriu).

| Caracteristica | CFOP | CFPS |
|---|---|---|
| Sigla | Codigo Fiscal de Operacoes e Prestacoes | Codigo Fiscal de Prestacao de Servicos |
| Digitos | 4 digitos | 3 digitos |
| Abrangencia | Nacional (CONFAZ) | Municipal (algumas prefeituras) |
| Tributo | ICMS | ISS |
| Obrigatorio | Sim (NFe/NFCe) | Somente onde exigido |

Alguns ERPs (ex: Sankhya) usam CFPS como extensao do CFOP: codigos acima de 8000 sao tratados como CFPS.

Para o Tecnikos: NAO e necessario implementar CFPS no momento. E especifico demais e nao tem padronizacao nacional.

---

## 4. PARSER XML NFS-e — MAPEAMENTO PARA IMPLEMENTACAO

### 4.1 Mapeamento ABRASF -> Campos do Sistema

```typescript
interface NfseEntradaParsed {
  // Identificacao
  layout: 'ABRASF' | 'NACIONAL';
  numero: string;              // Numero ou nNFSe
  serie: string;               // Serie (Nacional) ou vazio (ABRASF)
  codigoVerificacao: string;   // CodigoVerificacao ou chave
  dataEmissao: Date;           // DataEmissao ou dEmi
  competencia: string;         // Competencia ou dCompet (normalizar para AAAA-MM)

  // Prestador (quem emitiu)
  prestadorCnpjCpf: string;
  prestadorRazaoSocial: string;
  prestadorNomeFantasia?: string;
  prestadorInscricaoMunicipal?: string;
  prestadorMunicipio?: string;  // IBGE
  prestadorUf?: string;
  prestadorEndereco?: string;

  // Tomador (quem contratou = NOSSA empresa)
  tomadorCnpjCpf: string;
  tomadorRazaoSocial: string;
  tomadorInscricaoMunicipal?: string;

  // Servico
  codigoServicoLC116: string;  // ItemListaServico ou converter cTribNac
  codigoCnae?: string;
  codigoTributarioMunicipio?: string;
  codigoTribNac?: string;      // So Nacional
  discriminacao: string;
  codigoMunicipioServico: string;  // IBGE

  // Valores
  valorServicos: number;
  valorDeducoes: number;
  baseCalculo: number;
  aliquotaIss: number;         // percentual
  valorIss: number;
  issRetido: boolean;
  valorIssRetido: number;
  valorLiquido: number;

  // Retencoes federais
  valorPis: number;
  valorCofins: number;
  valorInss: number;
  valorIr: number;
  valorCsll: number;
  outrasRetencoes: number;

  // Outros
  naturezaOperacao?: string;
  optanteSimplesNacional?: boolean;
  regimeEspecialTributacao?: string;
  exigibilidadeIss?: string;

  // Construcao civil
  codigoObra?: string;         // CNO/CEI
  art?: string;                // So ABRASF

  // XML original
  xmlOriginal: string;
}
```

### 4.2 Mapeamento de Tags ABRASF -> Nacional

```typescript
const TAG_MAP = {
  // Numero da nota
  'ABRASF': 'CompNfse/Nfse/InfNfse/Numero',
  'NACIONAL': 'NFSe/infNFSe/nNFSe',

  // Data emissao
  'ABRASF_dataEmissao': 'CompNfse/Nfse/InfNfse/DataEmissao',
  'NACIONAL_dataEmissao': 'NFSe/infNFSe/dEmi',

  // Competencia
  'ABRASF_competencia': 'CompNfse/Nfse/InfNfse/Competencia',
  'NACIONAL_competencia': 'NFSe/infNFSe/DPS/infDPS/dCompet',

  // Prestador CNPJ
  'ABRASF_prestadorCnpj': 'InfNfse/PrestadorServico/IdentificacaoPrestador/CpfCnpj/Cnpj',
  'NACIONAL_prestadorCnpj': 'infNFSe/DPS/infDPS/prest/CNPJ',

  // Prestador nome
  'ABRASF_prestadorNome': 'InfNfse/PrestadorServico/RazaoSocial',
  'NACIONAL_prestadorNome': 'infNFSe/emit/xNome',

  // Tomador CNPJ
  'ABRASF_tomadorCnpj': 'InfNfse/TomadorServico/IdentificacaoTomador/CpfCnpj/Cnpj',
  'NACIONAL_tomadorCnpj': 'infNFSe/DPS/infDPS/toma/CNPJ',

  // Tomador nome
  'ABRASF_tomadorNome': 'InfNfse/TomadorServico/RazaoSocial',
  'NACIONAL_tomadorNome': 'infNFSe/DPS/infDPS/toma/xNome',

  // Codigo servico
  'ABRASF_codigoServico': 'InfNfse/Servico/ItemListaServico',
  'NACIONAL_codigoServico': 'infNFSe/DPS/infDPS/serv/cServ/cTribNac',
  // NOTA: cTribNac (ex: 070200) precisa conversao para LC116 (ex: 7.02)

  // Valor servicos
  'ABRASF_valorServicos': 'InfNfse/Servico/Valores/ValorServicos',
  'NACIONAL_valorServicos': 'infNFSe/DPS/infDPS/valores/vServPrest/vServ',

  // Aliquota ISS
  'ABRASF_aliquota': 'InfNfse/Servico/Valores/Aliquota',
  'NACIONAL_aliquota': 'infNFSe/DPS/infDPS/valores/trib/tribMun/BM/pAliq',

  // Valor ISS
  'ABRASF_valorIss': 'InfNfse/Servico/Valores/ValorIss',
  'NACIONAL_valorIss': 'infNFSe/DPS/infDPS/valores/trib/tribMun/BM/vISS',

  // ISS Retido
  'ABRASF_issRetido': 'InfNfse/Servico/Valores/IssRetido', // 1=Sim 2=Nao
  'NACIONAL_issRetido': 'infNFSe/DPS/infDPS/valores/trib/tribMun/BM/tpRetISSQN', // 1=Retido

  // Discriminacao
  'ABRASF_discriminacao': 'InfNfse/Servico/Discriminacao',
  'NACIONAL_discriminacao': 'infNFSe/DPS/infDPS/serv/cServ/xDescServ',

  // Valor liquido
  'ABRASF_valorLiquido': 'InfNfse/Servico/Valores/ValorLiquidoNfse',
  'NACIONAL_valorLiquido': 'infNFSe/valores/vLiq',

  // Base calculo
  'ABRASF_baseCalculo': 'InfNfse/Servico/Valores/BaseCalculo',
  'NACIONAL_baseCalculo': 'infNFSe/DPS/infDPS/valores/trib/tribMun/BM/vBM',

  // Retencoes federais
  'ABRASF_valorInss': 'InfNfse/Servico/Valores/ValorInss',
  'NACIONAL_valorInss': 'infNFSe/DPS/infDPS/valores/trib/tribFed/vRetCP',

  'ABRASF_valorIr': 'InfNfse/Servico/Valores/ValorIr',
  'NACIONAL_valorIr': 'infNFSe/DPS/infDPS/valores/trib/tribFed/vRetIRRF',

  'ABRASF_valorCsll': 'InfNfse/Servico/Valores/ValorCsll',
  'NACIONAL_valorCsll': 'infNFSe/DPS/infDPS/valores/trib/tribFed/vRetCSLL',

  // Municipio do servico
  'ABRASF_codigoMunicipio': 'InfNfse/Servico/CodigoMunicipio',
  'NACIONAL_codigoMunicipio': 'infNFSe/DPS/infDPS/serv/locPrest/cLocPrestacao',
};
```

### 4.3 Conversao cTribNac -> Item LC 116

O Codigo de Tributacao Nacional tem 9 digitos: XXYYZZ000 onde:
- XX = Grupo (ex: 07 = Construcao civil)
- YY = Subitem (ex: 02 = Execucao de obras)
- ZZ000 = Parte municipal (ignorar para mapeamento LC 116)

```typescript
function cTribNacToLC116(cTribNac: string): string {
  // cTribNac: "070200" ou "070200000" (6 ou 9 digitos)
  const clean = cTribNac.replace(/\D/g, '').padEnd(6, '0').substring(0, 6);
  const grupo = parseInt(clean.substring(0, 2));
  const subitem = parseInt(clean.substring(2, 4));
  // Retorna formato "X.YY" ou "XX.YY"
  return `${grupo}.${subitem.toString().padStart(2, '0')}`;
}

// Exemplos:
// "070200" -> "7.02"
// "070200000" -> "7.02"
// "170500" -> "17.05"
// "110200" -> "11.02"
```

---

## 5. ADN — AMBIENTE DE DADOS NACIONAL

### 5.1 O que e

Repositorio nacional de documentos fiscais eletronicos de servico (NFS-e, Eventos, Creditos, Debitos, Apuracao). Gerido pela SE/CGNFS-e.

Os municipios que aderem ao ADN compartilham suas NFS-e nesse repositorio central. Permite que contribuintes consultem NFS-e emitidas contra seu CNPJ.

### 5.2 API — REST com mTLS

| Aspecto | Detalhe |
|---|---|
| **Protocolo** | REST (JSON nas rotas, XML nos documentos) |
| **Autenticacao** | mTLS com certificado ICP-Brasil A1 ou A3 |
| **Certificado** | e-CNPJ do contribuinte (CNPJ raiz deve coincidir) |
| **Formato documentos** | XML compactado GZip + Base64 |
| **Assinatura** | XMLDSig (W3C) |
| **Ambientes** | Producao: `sefin.nfse.gov.br`, Homologacao/Producao Restrita |
| **Alternativa auth** | Conta GOV.BR (niveis Prata/Ouro) para MEIs |

### 5.3 Endpoints Principais para Contribuintes

#### Distribuicao de DF-e (busca NFS-e emitidas contra voce):

```
GET /contribuintes/dfe/{NSU}
```
Retorna o documento fiscal correspondente ao NSU informado.

```
GET /contribuintes/dfe?ultNSU={ultimoNSU}
```
Retorna lote de documentos a partir do ultimo NSU processado. Quando `ultNSU == maxNSU`, nao ha mais documentos.

#### Consulta por chave:
```
GET /contribuintes/nfse/{chaveAcesso}
```
Retorna NFS-e especifica pela chave de acesso.

#### Consulta DPS -> NFS-e:
```
GET /contribuintes/nfse/dps/{idDPS}
```
Recupera chave de acesso da NFS-e a partir do ID da DPS. Somente se o CNPJ do certificado for ator na DPS (prestador, tomador ou intermediario).

### 5.4 Limitacoes

| Limitacao | Detalhe |
|---|---|
| **Intervalo entre consultas** | Minimo **1 hora** entre consultas quando nao ha novos documentos |
| **Documentos por lote** | Ate **50 documentos** por resposta |
| **Disponibilidade** | Documentos ficam disponiveis por ate **3 meses** apos recepcao |
| **Certificado** | CNPJ raiz do certificado deve coincidir com o CNPJ consultado |
| **Filtro** | Retorna docs onde CNPJ e prestador, tomador OU intermediario |
| **Ordenacao NSU** | Cronologica por recepcao no ADN |
| **mTLS obrigatorio** | Nao aceita autenticacao simples (exceto GOV.BR para MEIs) |
| **Erros comuns** | 403 por mTLS, GZip/Base64 malformado, assinatura XML invalida |

### 5.5 Municipios Aderidos

| Dado | Valor | Data |
|---|---|---|
| Total de entes aderidos ao convenio | **~5.565** | Marco/2026 |
| Municipios com sistema ATIVO e operacional | **~1.843** | Dezembro/2025 |
| Municipios que ainda NAO aderiram | **~501** | Dezembro/2025 |
| Volume medio mensal | **~30 milhoes NFS-e/mes** | 2026 |
| Obrigatoriedade | LC 214/2025 — adesao obrigatoria | 01/01/2026 |
| Penalidade por nao adesao | Suspensao de transferencias voluntarias | 2026 |

#### Capitais relevantes com adesao:
- Sao Paulo: aderiu ao ADN (mantem emissor proprio, compartilha dados)
- Recife: obrigou emissao pelo Emissor Nacional (cronograma gradual)
- A maioria das capitais ja aderiu

#### Onde consultar lista atualizada:
- Portal oficial: https://www.gov.br/nfse/pt-br/municipios/monitoramento-adesoes
- Consulta publica NFS-e: https://www.nfse.gov.br/consultapublica
- Lista download: https://notagateway.com.br/blog/municipios-nfse/

---

## 6. RECOMENDACOES PARA IMPLEMENTACAO NO TECNIKOS

### 6.1 Prioridade 1 — Upload XML Manual (imediato)

1. **Parser dual**: detectar layout automaticamente (ABRASF vs Nacional)
2. **Extrair campos normalizados**: usar interface `NfseEntradaParsed`
3. **Vincular ao prestador**: match por CNPJ/CPF no cadastro de parceiros
4. **Criar lancamento financeiro**: conta a pagar (valor liquido) + ISS retido (se aplicavel)
5. **Escrituracao**: gravar dados para Livro de Servicos Tomados

### 6.2 Prioridade 2 — Digitacao Manual

Para NFS-e de municipios que nao geram XML ou quando prestador nao envia:
- Tela com campos do `NfseEntradaParsed`
- Validacao de CNPJ, codigo servico LC116, municipio IBGE
- Calculo automatico de ISS baseado em aliquota

### 6.3 Prioridade 3 — Integracao ADN (longo prazo)

- Requer certificado digital A1 do cliente
- Implementar mTLS + XML parsing
- Busca periodica por NSU
- Alto custo de implementacao (mTLS, GZip+Base64, assinaturas)
- Avaliar uso de intermediarios (Focus NFe, Nuvem Fiscal) que ja abstraem ADN

### 6.4 Tabela de ISS Retido

Implementar logica para:
1. Verificar se servico esta na lista do art. 6o, ss2o, II da LC 116
2. Se tomador tem obrigacao de reter baseado na lei municipal
3. Calcular ISS retido e gerar guia de recolhimento
4. Para prestador SN: usar aliquota da NFS-e (nao a municipal)

---

## FONTES DA PESQUISA

- ABRASF versao 2.04: https://abrasf.org.br/biblioteca/arquivos-publicos/nfs-e/versao-2-04
- Portal NFS-e Nacional: https://www.gov.br/nfse/pt-br
- LC 116/2003 (texto integral): https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp116.htm
- LC 157/2016 (aliquota minima): https://www.migalhas.com.br/depeso/252101/
- ISS retencao SN: https://focotributario.com.br/retencao-iss-optante-simples-nacional-aliquota/
- EFD-Contribuicoes Bloco A: http://sped.rfb.gov.br/estatico/1D/5B40578A64FD1B6DE7BC9705D82AC59D4EC0BD/Guia_Pratico_EFD_Contribuicoes_Versao_1_23.pdf
- EFD ICMS/IPI Bloco B: https://maxiprod.com.br/ajuda/fiscal/bloco-b-iss/
- ADN/API: https://notagateway.com.br/blog/api-nfse-nacional/
- ADN municipios: https://www.gov.br/nfse/pt-br/municipios/monitoramento-adesoes
- Focus NFe NT004: https://focusnfe.com.br/blog/nota-tecnica-004-nfs-e-nacional/
- Tecnospeed NT004/005: https://blog.tecnospeed.com.br/nota-tecnica-003-layout-da-nfse-nacional-reforma-tributaria/
- NS Tecnologia prazos: https://blog.nstecnologia.com.br/nfse-nacional-prazos-e-layout/
- Campos Focus NFe Nacional: https://campos.focusnfe.com.br/nfse_nacional/EmissaoDPSXml.html
- Manual Contribuintes APIs ADN: https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/documentacao-atual/manual-contribuintes-apis-adn-sistema-nacional-nfse.pdf
- ISS SN contabilizei: https://www.contabilizei.com.br/contabilizei-responde/qual-a-aliquota-de-retencao-de-iss-para-simples-nacional/
