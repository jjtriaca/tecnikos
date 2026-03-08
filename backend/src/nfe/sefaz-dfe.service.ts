import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import * as crypto from 'crypto';
import * as tls from 'tls';
import * as https from 'https';
import * as zlib from 'zlib';
import * as forge from 'node-forge';
import { XMLParser } from 'fast-xml-parser';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/encryption.service';
import { NfeService } from './nfe.service';
import { FocusNfeProvider } from '../nfse-emission/focus-nfe.provider';
import { PaginatedResult } from '../common/dto/pagination.dto';
import { SefazDocumentFilterDto } from './dto/sefaz-config.dto';

/* ══════════════════════════════════════════════════════════════════════
   UF → IBGE code mapping
   ══════════════════════════════════════════════════════════════════════ */

const UF_IBGE: Record<string, number> = {
  AC: 12, AL: 27, AM: 13, AP: 16, BA: 29, CE: 23, DF: 53, ES: 32,
  GO: 52, MA: 21, MG: 31, MS: 50, MT: 51, PA: 15, PB: 25, PE: 26,
  PI: 22, PR: 41, RJ: 33, RN: 24, RO: 11, RR: 14, RS: 43, SC: 42,
  SE: 28, SP: 35, TO: 17,
};

const SEFAZ_URLS = {
  PRODUCTION: 'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
  HOMOLOGATION: 'https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
};

/* ══════════════════════════════════════════════════════════════════════
   Types
   ══════════════════════════════════════════════════════════════════════ */

interface SoapResponse {
  cStat: string;
  xMotivo: string;
  ultNSU: string;
  maxNSU: string;
  docZips: Array<{ nsu: string; schema: string; xml: string }>;
}

export interface SefazConfigInfo {
  hasCertificate: boolean;
  certificateCN: string | null;
  certificateExpiry: string | null;
  environment: string;
  autoFetchEnabled: boolean;
  autoManifestCiencia: boolean;
  lastNsu: string;
  lastFetchAt: string | null;
  lastFetchStatus: string | null;
  lastFetchError: string | null;
}

/* ══════════════════════════════════════════════════════════════════════
   Service
   ══════════════════════════════════════════════════════════════════════ */

@Injectable()
export class SefazDfeService {
  private readonly logger = new Logger(SefazDfeService.name);
  private readonly xmlParser: XMLParser;

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly nfeService: NfeService,
    private readonly focusNfe: FocusNfeProvider,
  ) {
    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      // Disable auto number parsing — prevents CNPJ/chave NFe/NSU losing precision
      numberParseOptions: { leadingZeros: false, hex: false, skipLike: /.*/ },
    });
  }

  /* ═══════════════════════════════════════════════════════════════════
     parsePfxWithForge — Parse PFX using node-forge (supports legacy encryption)
     ═══════════════════════════════════════════════════════════════════ */

  private parsePfxWithForge(pfxBuffer: Buffer, pfxPassword: string): {
    certPem: string;
    keyPem: string;
    cn: string | null;
    expiry: Date | null;
  } {
    const pfxDer = forge.util.decode64(pfxBuffer.toString('base64'));
    const pfxAsn1 = forge.asn1.fromDer(pfxDer);
    const p12 = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, pfxPassword);

    // Extract certificates (entity + CA chain)
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const certBagList = certBags[forge.pki.oids.certBag] ?? [];

    // Extract private key
    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
    const keyBagList = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag] ?? [];

    if (certBagList.length === 0) {
      throw new Error('Nenhum certificado encontrado no PFX');
    }
    if (keyBagList.length === 0) {
      throw new Error('Nenhuma chave privada encontrada no PFX');
    }

    const key = keyBagList[0].key!;
    const keyPem = forge.pki.privateKeyToPem(key);

    // Find the entity cert (the one whose public key matches the private key)
    // by checking which cert is NOT a CA cert (no basicConstraints CA=true)
    let entityCert: forge.pki.Certificate | null = null;
    const caCerts: forge.pki.Certificate[] = [];

    for (const bag of certBagList) {
      if (!bag.cert) continue;
      const cert = bag.cert;
      const bc = cert.getExtension('basicConstraints') as any;
      if (bc && bc.cA) {
        caCerts.push(cert);
      } else {
        // End-entity cert (no CA flag or basicConstraints absent)
        if (!entityCert) {
          entityCert = cert;
        } else {
          caCerts.push(cert); // extra non-CA cert goes to chain
        }
      }
    }

    // Fallback: if no entity cert found, use the first cert
    if (!entityCert) {
      entityCert = certBagList[0].cert!;
    }

    // Build PEM chain: entity cert first, then CA certs
    const certPem = [
      forge.pki.certificateToPem(entityCert),
      ...caCerts.map(c => forge.pki.certificateToPem(c)),
    ].join('');

    // Extract CN and expiry from entity cert
    const cnAttr = entityCert.subject.getField('CN');
    const cn = cnAttr ? String(cnAttr.value) : null;
    const expiry = entityCert.validity.notAfter ?? null;

    this.logger.log(
      `PFX parsed: ${certBagList.length} certs found, entity CN=${cn}, ` +
      `expiry=${expiry?.toISOString()}, CA certs=${caCerts.length}`,
    );

    return { certPem, keyPem, cn, expiry };
  }

  /* ═══════════════════════════════════════════════════════════════════
     saveCertificate — Upload and validate PFX certificate
     ═══════════════════════════════════════════════════════════════════ */

  async saveCertificate(
    companyId: string,
    pfxBuffer: Buffer,
    pfxPassword: string,
  ) {
    let certificateCN: string | null = null;
    let certificateExpiry: Date | null = null;
    let certPem: string;
    let keyPem: string;

    try {
      // Use node-forge to parse PFX (handles legacy RC2/3DES encryption)
      const parsed = this.parsePfxWithForge(pfxBuffer, pfxPassword);
      certPem = parsed.certPem;
      keyPem = parsed.keyPem;
      certificateCN = parsed.cn;
      certificateExpiry = parsed.expiry;

      this.logger.log(`Certificate parsed: CN=${certificateCN}, Expiry=${certificateExpiry}`);

      // Validate PEM works with TLS
      tls.createSecureContext({ cert: certPem, key: keyPem });
    } catch (err) {
      this.logger.error(`PFX parse error: ${err.message}`);
      throw new BadRequestException(
        'Certificado PFX inválido ou senha incorreta. Verifique o arquivo e a senha.',
      );
    }

    // Store PEM (cert+key) instead of original PFX — avoids legacy PFX issues
    const encryptedCert = this.encryption.encrypt(certPem);
    const encryptedKey = this.encryption.encrypt(keyPem);
    // Also store original password for reference (not used for PEM)
    const encryptedPassword = this.encryption.encrypt(pfxPassword);

    // Upsert SefazConfig
    const config = await this.prisma.sefazConfig.upsert({
      where: { companyId },
      create: {
        companyId,
        pfxBase64: encryptedCert,
        pfxPassword: encryptedKey,
        certificateCN,
        certificateExpiry,
      },
      update: {
        pfxBase64: encryptedCert,
        pfxPassword: encryptedKey,
        certificateCN,
        certificateExpiry,
      },
    });

    return {
      id: config.id,
      certificateCN: config.certificateCN,
      certificateExpiry: config.certificateExpiry,
      environment: config.environment,
      autoFetchEnabled: config.autoFetchEnabled,
      lastNsu: config.lastNsu,
    };
  }

  /* ═══════════════════════════════════════════════════════════════════
     getConfig — Return config info (no secrets)
     ═══════════════════════════════════════════════════════════════════ */

  async getConfig(companyId: string): Promise<SefazConfigInfo> {
    const config = await this.prisma.sefazConfig.findUnique({
      where: { companyId },
    });

    if (!config) {
      return {
        hasCertificate: false,
        certificateCN: null,
        certificateExpiry: null,
        environment: 'PRODUCTION',
        autoFetchEnabled: true,
        autoManifestCiencia: false,
        lastNsu: '000000000000000',
        lastFetchAt: null,
        lastFetchStatus: null,
        lastFetchError: null,
      };
    }

    return {
      hasCertificate: true,
      certificateCN: config.certificateCN,
      certificateExpiry: config.certificateExpiry?.toISOString() ?? null,
      environment: config.environment,
      autoFetchEnabled: config.autoFetchEnabled,
      autoManifestCiencia: config.autoManifestCiencia,
      lastNsu: config.lastNsu,
      lastFetchAt: config.lastFetchAt?.toISOString() ?? null,
      lastFetchStatus: config.lastFetchStatus,
      lastFetchError: config.lastFetchError,
    };
  }

  /* ═══════════════════════════════════════════════════════════════════
     updateConfig — Update environment or autoFetchEnabled
     ═══════════════════════════════════════════════════════════════════ */

  async updateConfig(companyId: string, data: { environment?: string; autoFetchEnabled?: boolean; autoManifestCiencia?: boolean }) {
    const config = await this.prisma.sefazConfig.findUnique({ where: { companyId } });
    if (!config) {
      throw new NotFoundException('Configuração SEFAZ não encontrada. Faça upload do certificado primeiro.');
    }

    return this.prisma.sefazConfig.update({
      where: { companyId },
      data: {
        ...(data.environment !== undefined && { environment: data.environment }),
        ...(data.autoFetchEnabled !== undefined && { autoFetchEnabled: data.autoFetchEnabled }),
        ...(data.autoManifestCiencia !== undefined && { autoManifestCiencia: data.autoManifestCiencia }),
      },
    });
  }

  /* ═══════════════════════════════════════════════════════════════════
     deleteCertificate — Remove SEFAZ config
     ═══════════════════════════════════════════════════════════════════ */

  async deleteCertificate(companyId: string) {
    const config = await this.prisma.sefazConfig.findUnique({ where: { companyId } });
    if (!config) {
      throw new NotFoundException('Configuração SEFAZ não encontrada');
    }

    await this.prisma.sefazConfig.delete({ where: { companyId } });
    return { message: 'Certificado removido com sucesso' };
  }

  /* ═══════════════════════════════════════════════════════════════════
     fetchDistDFe — Main orchestrator: fetch documents from SEFAZ
     ═══════════════════════════════════════════════════════════════════ */

  async fetchDistDFe(companyId: string): Promise<{ newDocuments: number; lastNsu: string }> {
    // Load config
    const config = await this.prisma.sefazConfig.findUnique({ where: { companyId } });
    if (!config) {
      throw new BadRequestException('Configuração SEFAZ não encontrada. Faça upload do certificado primeiro.');
    }

    // Load company for CNPJ and UF
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Empresa não encontrada');
    if (!company.cnpj) throw new BadRequestException('Empresa não possui CNPJ cadastrado');
    if (!company.state) throw new BadRequestException('Empresa não possui UF cadastrada');

    const cUFAutor = UF_IBGE[company.state.toUpperCase()];
    if (!cUFAutor) throw new BadRequestException(`UF "${company.state}" não reconhecida`);

    // Decrypt PEM cert+key (stored as PEM strings after node-forge conversion)
    const certPem = this.encryption.decrypt(config.pfxBase64);
    const keyPem = this.encryption.decrypt(config.pfxPassword);

    // Clean CNPJ (digits only)
    const cnpj = company.cnpj.replace(/\D/g, '');
    const tpAmb = config.environment === 'HOMOLOGATION' ? '2' : '1';

    let currentNsu = config.lastNsu;
    let totalNewDocs = 0;
    let lastError: string | null = null;
    let fetchStatus = 'SUCCESS';

    try {
      // Loop until no more documents
      let hasMore = true;
      let iterations = 0;
      const MAX_ITERATIONS = 50; // Safety limit

      while (hasMore && iterations < MAX_ITERATIONS) {
        iterations++;

        const response = await this.callSefazSoap(
          certPem, keyPem, cnpj, cUFAutor, currentNsu, tpAmb, config.environment,
        );

        if (response.cStat === '137' || response.cStat === '656') {
          // 137 = Nenhum documento localizado
          // 656 = Consumo indevido (rate limit)
          hasMore = false;
          if (response.cStat === '656') {
            this.logger.warn(`SEFAZ rate limit for company ${companyId}: ${response.xMotivo}`);
            fetchStatus = 'RATE_LIMIT';
            lastError = response.xMotivo;
            // Save ultNSU from rate limit response for subsequent requests
            const rateLimitNsu = String(response.ultNSU).padStart(15, '0');
            if (rateLimitNsu !== '000000000000000') {
              currentNsu = rateLimitNsu;
              this.logger.log(`Saving ultNSU from rate limit: ${currentNsu}`);
            }
          } else {
            fetchStatus = totalNewDocs > 0 ? 'SUCCESS' : 'NO_DOCS';
          }
          continue;
        }

        if (response.cStat !== '138') {
          // Other error
          fetchStatus = 'ERROR';
          lastError = `SEFAZ retornou cStat=${response.cStat}: ${response.xMotivo}`;
          hasMore = false;
          continue;
        }

        // Process documents
        for (const doc of response.docZips) {
          try {
            const docData = this.parseSefazDocument(doc.xml, doc.nsu, doc.schema);

            // Check if document already exists (for auto-import logic)
            const existing = await this.prisma.sefazDocument.findFirst({
              where: { companyId, nsu: doc.nsu },
              select: { id: true, status: true },
            });

            // Upsert (skip if NSU already exists)
            const upserted = await this.prisma.sefazDocument.upsert({
              where: {
                companyId_nsu: { companyId, nsu: doc.nsu },
              },
              create: {
                companyId,
                nsu: doc.nsu,
                schema: docData.schema,
                nfeKey: docData.nfeKey,
                emitterCnpj: docData.emitterCnpj,
                emitterName: docData.emitterName,
                issueDate: docData.issueDate,
                nfeValue: docData.nfeValue,
                situacao: docData.situacao,
                xmlContent: docData.schema === 'procNFe' ? doc.xml : null,
                status: docData.schema === 'resEvento' ? 'EVENT' : 'FETCHED',
              },
              update: {
                // If we get a procNFe for an existing resNFe, update it
                ...(docData.schema === 'procNFe' && {
                  schema: 'procNFe',
                  xmlContent: doc.xml,
                  emitterName: docData.emitterName || undefined,
                  nfeValue: docData.nfeValue || undefined,
                }),
              },
              select: { id: true, status: true },
            });

            // Documents stay as FETCHED — operator must manually import via UI

            totalNewDocs++;
          } catch (err) {
            this.logger.error(`Error processing doc NSU ${doc.nsu}: ${(err as Error).message}`);
          }
        }

        // Update current NSU (ensure 15-digit padding)
        currentNsu = String(response.ultNSU).padStart(15, '0');

        // Check if we've reached the max
        if (response.ultNSU >= response.maxNSU) {
          hasMore = false;
        }
      }
    } catch (err) {
      fetchStatus = 'ERROR';
      lastError = err.message || 'Erro desconhecido ao consultar SEFAZ';
      this.logger.error(`SEFAZ fetch error for company ${companyId}: ${err.message}`);
    }

    // Update config with latest NSU and fetch status
    await this.prisma.sefazConfig.update({
      where: { companyId },
      data: {
        lastNsu: currentNsu,
        lastFetchAt: new Date(),
        lastFetchStatus: fetchStatus,
        lastFetchError: lastError,
      },
    });

    return { newDocuments: totalNewDocs, lastNsu: currentNsu };
  }

  /* ═══════════════════════════════════════════════════════════════════
     callSefazSoap — Make SOAP call to SEFAZ DistribuiçãoDFe
     ═══════════════════════════════════════════════════════════════════ */

  private callSefazSoap(
    certPem: string,
    keyPem: string,
    cnpj: string,
    cUFAutor: number,
    ultNsu: string,
    tpAmb: string,
    environment: string,
  ): Promise<SoapResponse> {
    const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe">
      <nfeDadosMsg>
        <distDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01">
          <tpAmb>${tpAmb}</tpAmb>
          <cUFAutor>${cUFAutor}</cUFAutor>
          <CNPJ>${cnpj}</CNPJ>
          <distNSU>
            <ultNSU>${String(ultNsu).padStart(15, '0')}</ultNSU>
          </distNSU>
        </distDFeInt>
      </nfeDadosMsg>
    </nfeDistDFeInteresse>
  </soap12:Body>
</soap12:Envelope>`;

    const url = environment === 'HOMOLOGATION' ? SEFAZ_URLS.HOMOLOGATION : SEFAZ_URLS.PRODUCTION;
    const parsedUrl = new URL(url);

    this.logger.log(`SEFAZ SOAP → ${url} | CNPJ=${cnpj} | cUFAutor=${cUFAutor} | tpAmb=${tpAmb} | ultNSU=${ultNsu}`);

    return new Promise<SoapResponse>((resolve, reject) => {
      const options: https.RequestOptions = {
        hostname: parsedUrl.hostname,
        port: 443,
        path: parsedUrl.pathname,
        method: 'POST',
        cert: certPem,
        key: keyPem,
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
          try {
            const body = Buffer.concat(chunks).toString('utf-8');
            this.logger.log(`SEFAZ HTTP ${res.statusCode} | body length=${body.length}`);
            if (body.length < 2000) {
              this.logger.log(`SEFAZ response: ${body}`);
            } else {
              this.logger.log(`SEFAZ response (first 1000): ${body.substring(0, 1000)}`);
            }
            const parsed = this.parseSoapResponse(body);
            resolve(parsed);
          } catch (err) {
            reject(new Error(`Erro ao processar resposta SEFAZ: ${err.message}`));
          }
        });
      });

      req.on('error', (err) => {
        reject(new Error(`Erro de conexão com SEFAZ: ${err.message}`));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Timeout ao conectar com SEFAZ (30s)'));
      });

      req.write(soapEnvelope);
      req.end();
    });
  }

  /* ═══════════════════════════════════════════════════════════════════
     parseSoapResponse — Parse SEFAZ SOAP response XML
     ═══════════════════════════════════════════════════════════════════ */

  private parseSoapResponse(xml: string): SoapResponse {
    const parsed = this.xmlParser.parse(xml);

    // Navigate through SOAP envelope to find retDistDFeInt
    const envelope = parsed['soap:Envelope'] ?? parsed['soap12:Envelope'] ?? parsed;
    const body = envelope['soap:Body'] ?? envelope['soap12:Body'] ?? envelope;
    const resp = body?.nfeDistDFeInteresseResponse ?? body;
    const result = resp?.nfeDistDFeInteresseResult ?? resp;
    const retDist = result?.retDistDFeInt ?? result;

    // Debug logging
    this.logger.log(`SOAP keys: top=${Object.keys(parsed).join(',')}`);
    if (envelope && typeof envelope === 'object') {
      this.logger.log(`SOAP envelope keys: ${Object.keys(envelope).join(',')}`);
    }
    if (body && typeof body === 'object') {
      this.logger.log(`SOAP body keys: ${Object.keys(body).join(',')}`);
    }
    if (resp && typeof resp === 'object') {
      this.logger.log(`SOAP resp keys: ${Object.keys(resp).join(',')}`);
    }
    if (result && typeof result === 'object') {
      this.logger.log(`SOAP result keys: ${Object.keys(result).join(',')}`);
    }
    if (retDist && typeof retDist === 'object') {
      this.logger.log(`retDistDFeInt keys: ${Object.keys(retDist).join(',')}, cStat=${retDist.cStat}`);
    }

    if (!retDist) {
      throw new Error('Resposta SEFAZ inválida: retDistDFeInt não encontrado');
    }

    const cStat = String(retDist.cStat ?? '');
    const xMotivo = String(retDist.xMotivo ?? '');
    // CRITICAL: ultNSU/maxNSU must always be 15-digit zero-padded strings.
    // fast-xml-parser parses "000000005000000" as number 5000000, losing padding.
    const ultNSU = String(retDist.ultNSU ?? '0').padStart(15, '0');
    const maxNSU = String(retDist.maxNSU ?? '0').padStart(15, '0');

    // Parse docZip entries
    const docZips: Array<{ nsu: string; schema: string; xml: string }> = [];

    const lote = retDist.loteDistDFeInt;
    if (lote) {
      const docZipRaw = lote.docZip;
      const docZipArray = Array.isArray(docZipRaw) ? docZipRaw : docZipRaw ? [docZipRaw] : [];

      for (const dz of docZipArray) {
        const nsu = String(dz['@_NSU'] ?? '');
        const schema = String(dz['@_schema'] ?? '');
        const base64Content = typeof dz === 'object' ? (dz['#text'] ?? '') : String(dz);

        if (base64Content) {
          try {
            const decompressed = this.decompressDocZip(String(base64Content));
            docZips.push({ nsu, schema, xml: decompressed });
          } catch (err) {
            this.logger.error(`Error decompressing docZip NSU ${nsu}: ${err.message}`);
          }
        }
      }
    }

    return { cStat, xMotivo, ultNSU: ultNSU, maxNSU, docZips };
  }

  /* ═══════════════════════════════════════════════════════════════════
     decompressDocZip — Decompress base64+gzip content
     ═══════════════════════════════════════════════════════════════════ */

  private decompressDocZip(base64Content: string): string {
    const compressed = Buffer.from(base64Content, 'base64');
    const decompressed = zlib.gunzipSync(compressed);
    return decompressed.toString('utf-8');
  }

  /* ═══════════════════════════════════════════════════════════════════
     parseSefazDocument — Parse individual document XML
     ═══════════════════════════════════════════════════════════════════ */

  private parseSefazDocument(xml: string, nsu: string, schemaHint: string) {
    const parsed = this.xmlParser.parse(xml);

    // Detect document type
    let schema = 'resNFe';
    let nfeKey: string | null = null;
    let emitterCnpj: string | null = null;
    let emitterName: string | null = null;
    let issueDate: Date | null = null;
    let nfeValue: number | null = null;
    let situacao: string | null = null;

    // ── resNFe (summary) ───────────────────────────────────────────
    const resNFe = parsed.resNFe;
    if (resNFe) {
      schema = 'resNFe';
      nfeKey = String(resNFe.chNFe ?? '');
      emitterCnpj = resNFe.CNPJ != null ? String(resNFe.CNPJ).padStart(14, '0') : '';
      emitterName = String(resNFe.xNome ?? '');
      issueDate = resNFe.dhEmi ? new Date(String(resNFe.dhEmi)) : null;
      nfeValue = resNFe.vNF ? Math.round(parseFloat(String(resNFe.vNF)) * 100) : null;
      situacao = String(resNFe.cSitNFe ?? '');
    }

    // ── procNFe (full authorized NFe) ──────────────────────────────
    const nfeProc = parsed.nfeProc ?? parsed['ns0:nfeProc'];
    if (nfeProc) {
      schema = 'procNFe';
      const nfe = nfeProc.NFe;
      if (nfe?.infNFe) {
        const infNFe = nfe.infNFe;
        const emit = infNFe.emit;
        const ide = infNFe.ide;

        nfeKey = nfeProc.protNFe?.infProt?.chNFe
          ? String(nfeProc.protNFe.infProt.chNFe)
          : infNFe['@_Id']
            ? String(infNFe['@_Id']).replace(/^NFe/, '')
            : null;

        emitterCnpj = emit?.CNPJ != null
          ? String(emit.CNPJ).padStart(14, '0')
          : emit?.CPF != null
            ? String(emit.CPF).padStart(11, '0')
            : '';
        emitterName = String(emit?.xNome ?? '');
        issueDate = ide?.dhEmi ? new Date(String(ide.dhEmi)) : null;

        const vNF = infNFe.total?.ICMSTot?.vNF;
        nfeValue = vNF ? Math.round(parseFloat(String(vNF)) * 100) : null;
        situacao = '1'; // Authorized (since it's in procNFe)
      }
    }

    // ── resEvento (event summary) ──────────────────────────────────
    const resEvento = parsed.resEvento;
    if (resEvento) {
      schema = 'resEvento';
      nfeKey = String(resEvento.chNFe ?? '');
      emitterCnpj = resEvento.CNPJ != null ? String(resEvento.CNPJ).padStart(14, '0') : '';
      issueDate = resEvento.dhEvento ? new Date(String(resEvento.dhEvento)) : null;
      emitterName = String(resEvento.xEvento ?? resEvento.tpEvento ?? '');
    }

    // Fallback from schema hint
    if (schemaHint && schemaHint.includes('resNFe') && !resNFe && !nfeProc && !resEvento) {
      schema = 'resNFe';
    } else if (schemaHint && schemaHint.includes('procNFe')) {
      schema = 'procNFe';
    } else if (schemaHint && schemaHint.includes('resEvento')) {
      schema = 'resEvento';
    }

    return {
      schema,
      nfeKey: nfeKey || null,
      emitterCnpj: emitterCnpj || null,
      emitterName: emitterName || null,
      issueDate,
      nfeValue,
      situacao: situacao || null,
    };
  }

  /* ═══════════════════════════════════════════════════════════════════
     importDocument — Import a SEFAZ document into NfeImport
     ═══════════════════════════════════════════════════════════════════ */

  async importDocument(companyId: string, sefazDocId: string) {
    const doc = await this.prisma.sefazDocument.findFirst({
      where: { id: sefazDocId, companyId },
    });

    if (!doc) throw new NotFoundException('Documento SEFAZ não encontrado');
    if (doc.status === 'IMPORTED') {
      throw new BadRequestException('Este documento já foi importado');
    }
    if (doc.schema !== 'procNFe' || !doc.xmlContent) {
      throw new BadRequestException(
        'Somente documentos com XML completo (procNFe) podem ser importados. ' +
        'Resumos (resNFe) não contêm dados suficientes para importação.',
      );
    }

    // If there's already a pending NfeImport for this doc, reuse it (user cancelled wizard before)
    if (doc.nfeImportId) {
      const existingImport = await this.prisma.nfeImport.findFirst({
        where: { id: doc.nfeImportId, status: 'PENDING' },
        include: {
          items: {
            include: {
              product: { select: { id: true, description: true, code: true } },
            },
            orderBy: { itemNumber: 'asc' },
          },
        },
      });
      if (existingImport) {
        // Re-try supplier matching if not yet linked (CNPJ padding fix may help now)
        let { supplierId } = existingImport;
        if (!supplierId && existingImport.supplierCnpj) {
          const cnpjDigits = existingImport.supplierCnpj.replace(/\D/g, '').padStart(14, '0');
          const suppliers: { id: string }[] = await this.prisma.$queryRawUnsafe(
            `SELECT id FROM "Partner" WHERE "companyId" = $1 AND "deletedAt" IS NULL AND regexp_replace(document, '[^0-9]', '', 'g') = $2 LIMIT 1`,
            companyId,
            cnpjDigits,
          );
          if (suppliers.length > 0) {
            supplierId = suppliers[0].id;
            await this.prisma.nfeImport.update({
              where: { id: existingImport.id },
              data: { supplierId },
            });
            existingImport.supplierId = supplierId;
          }
        }
        // Enrich with supplier name
        let supplierMatchedName: string | null = null;
        if (supplierId) {
          const supplier = await this.prisma.partner.findUnique({
            where: { id: supplierId },
            select: { name: true },
          });
          supplierMatchedName = supplier?.name ?? null;
        }
        return { ...existingImport, supplierMatchedName };
      }
    }

    // Use existing NfeService.upload() to parse and create NfeImport
    const nfeImport = await this.nfeService.upload(doc.xmlContent, companyId, sefazDocId);

    // Link SefazDocument to NfeImport but keep status as FETCHED
    // Status changes to IMPORTED only after process() completes successfully
    await this.prisma.sefazDocument.update({
      where: { id: sefazDocId },
      data: {
        nfeImportId: nfeImport.id,
      },
    });

    return nfeImport;
  }

  /* ═══════════════════════════════════════════════════════════════════
     ignoreDocument — Mark document as ignored
     ═══════════════════════════════════════════════════════════════════ */

  async ignoreDocument(companyId: string, sefazDocId: string) {
    const doc = await this.prisma.sefazDocument.findFirst({
      where: { id: sefazDocId, companyId },
    });

    if (!doc) throw new NotFoundException('Documento SEFAZ não encontrado');

    return this.prisma.sefazDocument.update({
      where: { id: sefazDocId },
      data: { status: 'IGNORED' },
    });
  }

  /* ═══════════════════════════════════════════════════════════════════
     findDocuments — Paginated list with filters
     ═══════════════════════════════════════════════════════════════════ */

  async findDocuments(
    companyId: string,
    filters: SefazDocumentFilterDto,
  ): Promise<PaginatedResult<any>> {
    const page = filters?.page ?? 1;
    const limit = filters?.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = { companyId };

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.schema) {
      where.schema = filters.schema;
    }

    if (filters.situacao) {
      where.situacao = filters.situacao;
    }

    if (filters.supplierCnpj) {
      where.emitterCnpj = { contains: filters.supplierCnpj.replace(/\D/g, '') };
    }

    if (filters.dateFrom || filters.dateTo) {
      where.issueDate = {};
      if (filters.dateFrom) where.issueDate.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.issueDate.lte = new Date(filters.dateTo + 'T23:59:59.999Z');
    }

    if (filters.search) {
      where.OR = [
        { nfeKey: { contains: filters.search, mode: 'insensitive' } },
        { emitterName: { contains: filters.search, mode: 'insensitive' } },
        { emitterCnpj: { contains: filters.search, mode: 'insensitive' } },
        { nsu: { contains: filters.search } },
      ];
    }

    // Dynamic sorting
    const validSortFields = ['nsu', 'emitterName', 'issueDate', 'nfeValue', 'fetchedAt', 'status'];
    const orderBy: Record<string, string> = {};
    if (filters.sortBy && validSortFields.includes(filters.sortBy)) {
      orderBy[filters.sortBy] = filters.sortOrder || 'desc';
    } else {
      orderBy.fetchedAt = 'desc';
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.sefazDocument.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        select: {
          id: true,
          nsu: true,
          schema: true,
          nfeKey: true,
          emitterCnpj: true,
          emitterName: true,
          issueDate: true,
          nfeValue: true,
          situacao: true,
          nfeImportId: true,
          status: true,
          manifestType: true,
          manifestedAt: true,
          fetchedAt: true,
          // xmlContent excluded from list for performance
        },
      }),
      this.prisma.sefazDocument.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /* ═══════════════════════════════════════════════════════════════════
     findOneDocument — Single document detail (with XML)
     ═══════════════════════════════════════════════════════════════════ */

  async findOneDocument(companyId: string, id: string) {
    const doc = await this.prisma.sefazDocument.findFirst({
      where: { id, companyId },
    });

    if (!doc) throw new NotFoundException('Documento SEFAZ não encontrado');
    return doc;
  }

  /* ═══════════════════════════════════════════════════════════════════
     manifestDocument — Send manifestation event via Focus NFe
     ═══════════════════════════════════════════════════════════════════ */

  async manifestDocument(
    companyId: string,
    sefazDocId: string,
    tipo: 'ciencia' | 'confirmacao' | 'desconhecimento' | 'nao_realizada',
    justificativa?: string,
  ) {
    const doc = await this.prisma.sefazDocument.findFirst({
      where: { id: sefazDocId, companyId },
    });

    if (!doc) throw new NotFoundException('Documento SEFAZ não encontrado');
    if (!doc.nfeKey) {
      throw new BadRequestException('Documento sem chave NFe — não é possível manifestar');
    }
    if (doc.schema === 'resEvento') {
      throw new BadRequestException('Não é possível manifestar eventos');
    }

    // Tipos conclusivos exigem justificativa
    if ((tipo === 'desconhecimento' || tipo === 'nao_realizada') && !justificativa) {
      throw new BadRequestException('Justificativa é obrigatória para este tipo de manifestação');
    }

    // Get Focus NFe token from NfseConfig
    const { token, environment } = await this.getFocusNfeCredentials(companyId);

    // Call Focus NFe API
    const result = await this.focusNfe.manifestNfe(token, environment, doc.nfeKey, tipo, justificativa);

    // Update document
    const updated = await this.prisma.sefazDocument.update({
      where: { id: sefazDocId },
      data: {
        manifestType: tipo,
        manifestedAt: new Date(),
      },
    });

    this.logger.log(`Manifest OK: doc=${sefazDocId} key=${doc.nfeKey} type=${tipo}`);

    // After ciência, try to download full XML if not already available
    if (tipo === 'ciencia' && !doc.xmlContent) {
      // Schedule XML download attempt (may not be available immediately)
      setTimeout(() => this.tryDownloadFullXml(companyId, sefazDocId, doc.nfeKey!), 5000);
    }

    return { ...updated, focusResult: result };
  }

  /* ═══════════════════════════════════════════════════════════════════
     tryDownloadFullXml — Attempt to download procNFe XML after ciência
     ═══════════════════════════════════════════════════════════════════ */

  private async tryDownloadFullXml(companyId: string, sefazDocId: string, nfeKey: string) {
    try {
      const { token, environment } = await this.getFocusNfeCredentials(companyId);
      const xml = await this.focusNfe.downloadNfeXml(token, environment, nfeKey);

      if (xml && xml.length > 100) {
        await this.prisma.sefazDocument.update({
          where: { id: sefazDocId },
          data: {
            xmlContent: xml,
            schema: 'procNFe', // Upgrade from resNFe to procNFe
          },
        });
        this.logger.log(`Full XML downloaded for key=${nfeKey} — upgraded to procNFe`);
      } else {
        this.logger.log(`Full XML not yet available for key=${nfeKey} — will retry on next fetch`);
      }
    } catch (err) {
      this.logger.warn(`Failed to download XML for key=${nfeKey}: ${err.message}`);
    }
  }

  /* ═══════════════════════════════════════════════════════════════════
     getFocusNfeCredentials — Get Focus NFe token from NfseConfig
     ═══════════════════════════════════════════════════════════════════ */

  private async getFocusNfeCredentials(companyId: string): Promise<{ token: string; environment: string }> {
    const nfseConfig = await this.prisma.nfseConfig.findUnique({ where: { companyId } });
    if (!nfseConfig?.focusNfeToken) {
      throw new BadRequestException(
        'Token Focus NFe não configurado. Configure em Configurações > Fiscal > NFS-e.',
      );
    }

    const token = this.encryption.decrypt(nfseConfig.focusNfeToken);
    return { token, environment: nfseConfig.focusNfeEnvironment || 'PRODUCTION' };
  }

  /* ═══════════════════════════════════════════════════════════════════
     autoManifestNewDocs — Auto-manifest ciência for new resNFe docs
     ═══════════════════════════════════════════════════════════════════ */

  private async autoManifestNewDocs(companyId: string) {
    try {
      const config = await this.prisma.sefazConfig.findUnique({ where: { companyId } });
      if (!config?.autoManifestCiencia) return;

      // Find resNFe docs without manifest
      const pendingDocs = await this.prisma.sefazDocument.findMany({
        where: {
          companyId,
          schema: 'resNFe',
          status: 'FETCHED',
          manifestType: null,
          nfeKey: { not: null },
        },
        take: 10, // Process max 10 per cycle (SEFAZ rate limit: 20/hour)
      });

      if (pendingDocs.length === 0) return;

      const { token, environment } = await this.getFocusNfeCredentials(companyId);

      let manifested = 0;
      for (const doc of pendingDocs) {
        try {
          await this.focusNfe.manifestNfe(token, environment, doc.nfeKey!, 'ciencia');
          await this.prisma.sefazDocument.update({
            where: { id: doc.id },
            data: { manifestType: 'ciencia', manifestedAt: new Date() },
          });
          manifested++;

          // Try downloading the XML
          const xml = await this.focusNfe.downloadNfeXml(token, environment, doc.nfeKey!);
          if (xml && xml.length > 100) {
            await this.prisma.sefazDocument.update({
              where: { id: doc.id },
              data: { xmlContent: xml, schema: 'procNFe' },
            });
            this.logger.log(`Auto-manifest + XML downloaded: key=${doc.nfeKey}`);
          }

          // Small delay between manifests to avoid rate limiting
          await new Promise(r => setTimeout(r, 1000));
        } catch (err) {
          this.logger.warn(`Auto-manifest failed for key=${doc.nfeKey}: ${err.message}`);
        }
      }

      if (manifested > 0) {
        this.logger.log(`Auto-manifested ciência for ${manifested} docs (company=${companyId})`);
      }
    } catch (err) {
      this.logger.warn(`Auto-manifest error for company=${companyId}: ${err.message}`);
    }
  }

  /* ═══════════════════════════════════════════════════════════════════
     Cron — Auto-fetch every 10 minutes
     ═══════════════════════════════════════════════════════════════════ */

  @Cron('0 */10 * * * *')
  async cronFetchAll() {
    this.logger.log('Starting scheduled SEFAZ DFe fetch...');

    try {
      const configs = await this.prisma.sefazConfig.findMany({
        where: { autoFetchEnabled: true },
      });

      if (configs.length === 0) {
        this.logger.log('No companies with SEFAZ auto-fetch enabled');
        return;
      }

      let totalDocs = 0;
      for (const config of configs) {
        try {
          // Skip if in rate limit (wait at least 1 hour)
          if (
            config.lastFetchStatus === 'RATE_LIMIT' &&
            config.lastFetchAt &&
            Date.now() - config.lastFetchAt.getTime() < 60 * 60 * 1000
          ) {
            const minutesLeft = Math.ceil(
              (60 * 60 * 1000 - (Date.now() - config.lastFetchAt.getTime())) / 60000,
            );
            this.logger.log(
              `Skipping company ${config.companyId}: rate limited, retry in ${minutesLeft}min`,
            );
            continue;
          }
          const result = await this.fetchDistDFe(config.companyId);
          totalDocs += result.newDocuments;
          if (result.newDocuments > 0) {
            this.logger.log(
              `Company ${config.companyId}: ${result.newDocuments} new docs (NSU: ${result.lastNsu})`,
            );
          }
          // Auto-manifest ciência for new resNFe docs (if enabled)
          await this.autoManifestNewDocs(config.companyId);
        } catch (err) {
          this.logger.error(
            `SEFAZ fetch error for company ${config.companyId}: ${err.message}`,
          );
        }
      }

      this.logger.log(`SEFAZ DFe fetch completed. Total new docs: ${totalDocs}`);
    } catch (err) {
      this.logger.error(`SEFAZ cron error: ${err.message}`);
    }
  }
}
