import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as https from 'https';
import { XMLParser } from 'fast-xml-parser';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/encryption.service';

/* ══════════════════════════════════════════════════════════════════════
   UF → IBGE code mapping
   ══════════════════════════════════════════════════════════════════════ */

const UF_IBGE: Record<string, number> = {
  AC: 12, AL: 27, AM: 13, AP: 16, BA: 29, CE: 23, DF: 53, ES: 32,
  GO: 52, MA: 21, MG: 31, MS: 50, MT: 51, PA: 15, PB: 25, PE: 26,
  PI: 22, PR: 41, RJ: 33, RN: 24, RO: 11, RR: 14, RS: 43, SC: 42,
  SE: 28, SP: 35, TO: 17,
};

/* ══════════════════════════════════════════════════════════════════════
   CadConsultaCadastro4 endpoint URLs per UF (production)

   States with their own authorizer have specific URLs.
   States served by SVRS use the shared RS endpoint.
   States not listed here don't support this service.
   ══════════════════════════════════════════════════════════════════════ */

const CONSULTA_CADASTRO_URLS: Record<string, string> = {
  // States with own authorizer
  AM: 'https://nfe.sefaz.am.gov.br/services2/services/cadconsultacadastro4',
  BA: 'https://nfe.sefaz.ba.gov.br/webservices/CadConsultaCadastro4/CadConsultaCadastro4.asmx',
  GO: 'https://nfe.sefaz.go.gov.br/nfe/services/CadConsultaCadastro4',
  MG: 'https://nfe.fazenda.mg.gov.br/nfe2/services/CadConsultaCadastro4',
  MS: 'https://nfe.sefaz.ms.gov.br/ws/CadConsultaCadastro4',
  MT: 'https://nfe.sefaz.mt.gov.br/nfews/v2/services/CadConsultaCadastro4',
  PE: 'https://nfe.sefaz.pe.gov.br/nfe-service/services/CadConsultaCadastro4',
  PR: 'https://nfe.sefa.pr.gov.br/nfe/CadConsultaCadastro4',
  RS: 'https://cad.svrs.rs.gov.br/ws/cadconsultacadastro/cadconsultacadastro4.asmx',
  SP: 'https://nfe.fazenda.sp.gov.br/ws/cadconsultacadastro4.asmx',

  // States served by SVRS (Sefaz Virtual RS)
  AC: 'https://cad.svrs.rs.gov.br/ws/cadconsultacadastro/cadconsultacadastro4.asmx',
  ES: 'https://cad.svrs.rs.gov.br/ws/cadconsultacadastro/cadconsultacadastro4.asmx',
  PB: 'https://cad.svrs.rs.gov.br/ws/cadconsultacadastro/cadconsultacadastro4.asmx',
  RN: 'https://cad.svrs.rs.gov.br/ws/cadconsultacadastro/cadconsultacadastro4.asmx',
  SC: 'https://cad.svrs.rs.gov.br/ws/cadconsultacadastro/cadconsultacadastro4.asmx',
};

/* ══════════════════════════════════════════════════════════════════════
   Types
   ══════════════════════════════════════════════════════════════════════ */

export interface ConsultaCadastroResult {
  name: string;
  ie: string;
  ieStatus: string; // 'ATIVA' | 'INATIVA' | 'NAO_HABILITADO'
  cnae: string | null;
  regime: string | null;
  activityStartDate: string | null;
  addressStreet: string | null;
  addressNumber: string | null;
  neighborhood: string | null;
  city: string | null;
  cityCode: string | null;
  cep: string | null;
  state: string;
}

/* ══════════════════════════════════════════════════════════════════════
   Service
   ══════════════════════════════════════════════════════════════════════ */

@Injectable()
export class SefazConsultaCadastroService {
  private readonly logger = new Logger(SefazConsultaCadastroService.name);
  private readonly xmlParser: XMLParser;

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {
    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      numberParseOptions: { leadingZeros: false, hex: false, skipLike: /.*/ },
    });
  }

  /* ═══════════════════════════════════════════════════════════════════
     consultaCadastro — Public method: query SEFAZ for contributor data
     ═══════════════════════════════════════════════════════════════════ */

  async consultaCadastro(
    companyId: string,
    uf: string,
    query: { cpf?: string; cnpj?: string; ie?: string },
  ): Promise<ConsultaCadastroResult> {
    const ufUpper = uf.toUpperCase();

    // Validate UF has endpoint
    const url = CONSULTA_CADASTRO_URLS[ufUpper];
    if (!url) {
      throw new BadRequestException(
        `Consulta cadastro não disponível para o estado ${ufUpper}. ` +
        `Estados disponíveis: ${Object.keys(CONSULTA_CADASTRO_URLS).sort().join(', ')}.`,
      );
    }

    // Load SEFAZ certificate
    const config = await this.prisma.sefazConfig.findUnique({ where: { companyId } });
    if (!config || !config.pfxBase64) {
      throw new BadRequestException(
        'Certificado SEFAZ não configurado. Faça upload do certificado em Configurações > NF-e.',
      );
    }

    // Decrypt PEM cert+key (stored as PEM after node-forge conversion)
    const certPem = this.encryption.decrypt(config.pfxBase64);
    const keyPem = this.encryption.decrypt(config.pfxPassword);

    // Build query element
    let queryElement: string;
    if (query.cpf) {
      queryElement = `<CPF>${query.cpf.replace(/\D/g, '')}</CPF>`;
    } else if (query.cnpj) {
      queryElement = `<CNPJ>${query.cnpj.replace(/\D/g, '')}</CNPJ>`;
    } else if (query.ie) {
      queryElement = `<IE>${query.ie.replace(/\D/g, '')}</IE>`;
    } else {
      throw new BadRequestException('Informe CPF, CNPJ ou IE para consulta.');
    }

    const cUF = UF_IBGE[ufUpper];
    if (!cUF) throw new BadRequestException(`UF "${ufUpper}" não reconhecida.`);

    // Build SOAP envelope
    const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Header>
    <nfeCabecMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/CadConsultaCadastro4">
      <cUF>${cUF}</cUF>
      <versaoDados>2.00</versaoDados>
    </nfeCabecMsg>
  </soap12:Header>
  <soap12:Body>
    <consultaCadastro4 xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/CadConsultaCadastro4">
      <nfeDadosMsg>
        <ConsCad xmlns="http://www.portalfiscal.inf.br/nfe" versao="2.00">
          <infCons>
            <xServ>CONS-CAD</xServ>
            <UF>${ufUpper}</UF>
            ${queryElement}
          </infCons>
        </ConsCad>
      </nfeDadosMsg>
    </consultaCadastro4>
  </soap12:Body>
</soap12:Envelope>`;

    this.logger.log(`ConsultaCadastro → ${url} | UF=${ufUpper} | query=${queryElement}`);

    // Make SOAP call
    const responseXml = await this.callSoap(certPem, keyPem, url, soapEnvelope);

    // Parse response
    return this.parseResponse(responseXml, ufUpper);
  }

  /* ═══════════════════════════════════════════════════════════════════
     callSoap — Make HTTPS SOAP call with mTLS
     ═══════════════════════════════════════════════════════════════════ */

  private callSoap(certPem: string, keyPem: string, url: string, soapEnvelope: string): Promise<string> {
    const parsedUrl = new URL(url);

    return new Promise<string>((resolve, reject) => {
      const options: https.RequestOptions = {
        hostname: parsedUrl.hostname,
        port: 443,
        path: parsedUrl.pathname,
        method: 'POST',
        cert: certPem,
        key: keyPem,
        // SEFAZ state servers use ICP-Brasil CAs not in Node.js default bundle
        rejectUnauthorized: false,
        headers: {
          'Content-Type': 'application/soap+xml;charset=UTF-8',
          'Content-Length': Buffer.byteLength(soapEnvelope, 'utf-8'),
        },
        timeout: 30000,
      };

      const req = https.request(options, (res) => {
        const chunks: Buffer[] = [];

        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf-8');
          this.logger.log(`ConsultaCadastro HTTP ${res.statusCode} | body length=${body.length}`);
          if (body.length < 3000) {
            this.logger.log(`ConsultaCadastro response: ${body}`);
          } else {
            this.logger.log(`ConsultaCadastro response (first 1500): ${body.substring(0, 1500)}`);
          }
          resolve(body);
        });
      });

      req.on('error', (err) => {
        reject(new BadRequestException(`Erro de conexão com SEFAZ: ${err.message}`));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new BadRequestException('Timeout ao conectar com SEFAZ (30s). Tente novamente.'));
      });

      req.write(soapEnvelope);
      req.end();
    });
  }

  /* ═══════════════════════════════════════════════════════════════════
     parseResponse — Parse ConsultaCadastro SOAP response
     ═══════════════════════════════════════════════════════════════════ */

  private parseResponse(xml: string, uf: string): ConsultaCadastroResult {
    const parsed = this.xmlParser.parse(xml);

    // Navigate SOAP envelope
    const envelope = parsed['soap:Envelope'] ?? parsed['soap12:Envelope'] ?? parsed;
    const body = envelope['soap:Body'] ?? envelope['soap12:Body'] ?? envelope;

    // The response wrapper varies by state, try common patterns
    const resp =
      body?.consultaCadastro4Result ??
      body?.consultaCadastro2Result ??
      body?.CadConsultaCadastro4Result ??
      body?.nfeResultMsg ??
      body;

    const retConsCad = resp?.retConsCad ?? resp;
    const infCons = retConsCad?.infCons ?? retConsCad;

    if (!infCons) {
      this.logger.error(`ConsultaCadastro: could not parse response. Keys: ${JSON.stringify(Object.keys(parsed))}`);
      throw new BadRequestException('Resposta inválida da SEFAZ. Tente novamente.');
    }

    const cStat = String(infCons.cStat ?? '');
    const xMotivo = String(infCons.xMotivo ?? '');

    this.logger.log(`ConsultaCadastro cStat=${cStat} xMotivo=${xMotivo}`);

    // cStat 111 = 1 match, 112 = multiple matches
    if (cStat !== '111' && cStat !== '112') {
      throw new BadRequestException(`SEFAZ retornou: ${xMotivo} (código ${cStat})`);
    }

    // Extract first infCad (may be array if 112)
    const infCadRaw = infCons.infCad;
    const infCad = Array.isArray(infCadRaw) ? infCadRaw[0] : infCadRaw;

    if (!infCad) {
      throw new BadRequestException('Contribuinte não encontrado na SEFAZ.');
    }

    // Parse address
    const ender = infCad.ender ?? {};

    // Map cSit to readable status
    const cSit = String(infCad.cSit ?? '0');
    let ieStatus: string;
    switch (cSit) {
      case '1': ieStatus = 'ATIVA'; break;
      case '0': ieStatus = 'NAO_HABILITADO'; break;
      default: ieStatus = 'INATIVA'; break;
    }

    return {
      name: String(infCad.xNome ?? ''),
      ie: String(infCad.IE ?? ''),
      ieStatus,
      cnae: infCad.CNAE ? String(infCad.CNAE) : null,
      regime: infCad.xRegApur ? String(infCad.xRegApur) : null,
      activityStartDate: infCad.dIniAtiv ? String(infCad.dIniAtiv) : null,
      addressStreet: ender.xLgr ? String(ender.xLgr) : null,
      addressNumber: ender.nro ? String(ender.nro) : null,
      neighborhood: ender.xBairro ? String(ender.xBairro) : null,
      city: ender.xMun ? String(ender.xMun) : null,
      cityCode: ender.cMun ? String(ender.cMun) : null,
      cep: ender.CEP ? String(ender.CEP) : null,
      state: uf,
    };
  }
}
