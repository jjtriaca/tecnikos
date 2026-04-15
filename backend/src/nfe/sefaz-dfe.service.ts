import { Injectable, Logger, BadRequestException, NotFoundException, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import * as crypto from 'crypto';
import * as tls from 'tls';
import * as https from 'https';
import * as zlib from 'zlib';
import * as forge from 'node-forge';
import { XMLParser } from 'fast-xml-parser';
import { SignedXml } from 'xml-crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/encryption.service';
import { NfeService } from './nfe.service';
import { FocusNfeProvider } from '../nfse-emission/focus-nfe.provider';
import { PaginatedResult } from '../common/dto/pagination.dto';
import { SefazDocumentFilterDto } from './dto/sefaz-config.dto';
import { TenantResolverService } from '../tenant/tenant-resolver.service';

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

// Ambiente Nacional — usado pra eventos de manifestação do destinatário (MDe)
// ATENCAO: prod e "www" (SEM o "1"). "www1" e o endpoint do DistribuicaoDFe, nao do RecepcaoEvento4.
// Usar "www1" aqui caia num handler diferente que nao deserializa evento -> NullReferenceException.
// Referencia: wsnfe_4.00_mod55.xml do nfephp, NFAutorizador400.java do wmixvideo.
const SEFAZ_EVENTO_URLS = {
  PRODUCTION: 'https://www.nfe.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx',
  HOMOLOGATION: 'https://hom1.nfe.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx',
};

// tpEvento pra cada tipo de manifestação
const MANIFEST_EVENT_TYPES: Record<string, { tpEvento: string; descEvento: string; requiresJustificativa: boolean }> = {
  ciencia: { tpEvento: '210210', descEvento: 'Ciencia da Operacao', requiresJustificativa: false },
  confirmacao: { tpEvento: '210200', descEvento: 'Confirmacao da Operacao', requiresJustificativa: false },
  desconhecimento: { tpEvento: '210220', descEvento: 'Desconhecimento da Operacao', requiresJustificativa: false },
  nao_realizada: { tpEvento: '210240', descEvento: 'Operacao nao Realizada', requiresJustificativa: true },
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
export class SefazDfeService implements OnModuleInit {
  private readonly logger = new Logger(SefazDfeService.name);
  private readonly xmlParser: XMLParser;

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly nfeService: NfeService,
    private readonly focusNfe: FocusNfeProvider,
    private readonly tenantResolver: TenantResolverService,
  ) {
    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      // Desabilita COMPLETAMENTE o parsing de numeros. Preserva strings literais pra CNPJ, chave NFe (44 digitos), NSU, valores monetarios, etc.
      // fast-xml-parser sem `parseTagValue` converte numeros grandes pra notacao cientifica ("5.12603e+43"), quebrando chave NFe.
      parseTagValue: false,
      parseAttributeValue: false,
    });
  }

  /* ═══════════════════════════════════════════════════════════════════
     onModuleInit — Fix historical corrupted data (one-time, idempotent)
     ═══════════════════════════════════════════════════════════════════ */

  async onModuleInit() {
    try {
      // Run historical data fix across all tenant schemas
      await this.tenantResolver.forEachTenant(async (_tenantId, tenantSlug) => {
        try {
          await this.fixHistoricalData();
          this.logger.log(`Historical data fix completed for tenant "${tenantSlug}"`);
        } catch (err) {
          this.logger.error(`Failed to fix historical data for tenant "${tenantSlug}": ${(err as Error).message}`);
        }
      });
    } catch (err) {
      this.logger.error(`Failed to fix historical data: ${(err as Error).message}`);
    }
  }

  private async fixHistoricalData() {
    // 1. Fix SefazDocument status: FETCHED → IMPORTED for already-processed imports
    const statusFixed = await this.prisma.$executeRawUnsafe(`
      UPDATE "SefazDocument" sd
      SET status = 'IMPORTED'
      FROM "NfeImport" ni
      WHERE sd."nfeImportId" = ni.id
        AND ni.status = 'PROCESSED'
        AND sd.status = 'FETCHED'
    `);
    if (statusFixed > 0) {
      this.logger.log(`Fixed ${statusFixed} SefazDocument(s) status: FETCHED → IMPORTED`);
    }

    // 2. Fix corrupted nfeKey (scientific notation) by re-parsing from xmlContent
    const corrupted = await this.prisma.sefazDocument.findMany({
      where: {
        nfeKey: { contains: 'e+' },
        xmlContent: { not: null },
      },
      select: { id: true, xmlContent: true, schema: true, nsu: true },
    });

    for (const doc of corrupted) {
      try {
        const fixedData = this.parseSefazDocument(doc.xmlContent!, doc.nsu, doc.schema);
        if (fixedData.nfeKey && !fixedData.nfeKey.includes('e+') && !fixedData.nfeKey.includes('E+')) {
          await this.prisma.sefazDocument.update({
            where: { id: doc.id },
            data: { nfeKey: fixedData.nfeKey },
          });
          this.logger.log(`Fixed nfeKey for SefazDocument ${doc.id}: ${fixedData.nfeKey}`);

          // Also fix linked NfeImport nfeKey
          const linked = await this.prisma.nfeImport.findFirst({
            where: { sefazDocumentId: doc.id },
          });
          if (linked && linked.nfeKey && linked.nfeKey.includes('e+')) {
            await this.prisma.nfeImport.update({
              where: { id: linked.id },
              data: { nfeKey: fixedData.nfeKey },
            });
            this.logger.log(`Fixed nfeKey for linked NfeImport ${linked.id}`);
          }
        }
      } catch (err) {
        this.logger.error(`Failed to fix nfeKey for SefazDocument ${doc.id}: ${err.message}`);
      }
    }

    if (corrupted.length > 0) {
      this.logger.log(`Processed ${corrupted.length} SefazDocument(s) with corrupted nfeKey`);
    }
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
          // 137 = Nenhum documento localizado (sincronizado)
          // 656 = Consumo indevido (rate limit)
          hasMore = false;
          if (response.cStat === '656') {
            // Rate limit: NAO avancar currentNsu. Se avancasse pro ultNSU retornado,
            // os NSUs entre o currentNsu anterior e o retornado seriam perdidos porque
            // a SEFAZ nao entrega docs na resposta de rate_limit. Preserva o NSU anterior
            // pra proxima tentativa (apos 1h) retomar do ponto certo.
            this.logger.warn(`SEFAZ rate limit for company ${companyId}: ${response.xMotivo} — preservando ultNSU=${currentNsu} (nao avancando)`);
            fetchStatus = 'RATE_LIMIT';
            lastError = response.xMotivo;
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

  /**
   * Envia SOAP ao SEFAZ. Modos suportados:
   *  - distNSU: paginacao a partir do ultNSU (default)
   *  - consChNFe: consulta direta por chave de acesso (44 digitos)
   */
  private callSefazSoap(
    certPem: string,
    keyPem: string,
    cnpj: string,
    cUFAutor: number,
    ultNsuOrKey: string,
    tpAmb: string,
    environment: string,
    mode: 'distNSU' | 'consChNFe' = 'distNSU',
  ): Promise<SoapResponse> {
    const innerQuery = mode === 'consChNFe'
      ? `<consChNFe><chNFe>${ultNsuOrKey}</chNFe></consChNFe>`
      : `<distNSU><ultNSU>${String(ultNsuOrKey).padStart(15, '0')}</ultNSU></distNSU>`;

    const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe">
      <nfeDadosMsg>
        <distDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01">
          <tpAmb>${tpAmb}</tpAmb>
          <cUFAutor>${cUFAutor}</cUFAutor>
          <CNPJ>${cnpj}</CNPJ>
          ${innerQuery}
        </distDFeInt>
      </nfeDadosMsg>
    </nfeDistDFeInteresse>
  </soap12:Body>
</soap12:Envelope>`;

    const url = environment === 'HOMOLOGATION' ? SEFAZ_URLS.HOMOLOGATION : SEFAZ_URLS.PRODUCTION;
    const parsedUrl = new URL(url);

    this.logger.log(`SEFAZ SOAP → ${url} | CNPJ=${cnpj} | cUFAutor=${cUFAutor} | tpAmb=${tpAmb} | mode=${mode} | param=${ultNsuOrKey}`);

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
    // Delegate to NfeService.findOneImport which re-validates all matches
    if (doc.nfeImportId) {
      const existing = await this.prisma.nfeImport.findFirst({
        where: { id: doc.nfeImportId, status: 'PENDING' },
        select: { id: true },
      });
      if (existing) {
        return this.nfeService.findOneImport(existing.id, companyId);
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

    // Manifestação via SEFAZ direto (NFeRecepcaoEvento4 — Ambiente Nacional)
    // Focus NFe nao pode manifestar porque nao tem as NFes no banco dele
    // (nosso fluxo e via SEFAZ direto desde v1.08.96, nao passa pelo Focus)
    const result = await this.manifestEventSefaz(companyId, doc.nfeKey, tipo, justificativa);

    // Update document
    const updated = await this.prisma.sefazDocument.update({
      where: { id: sefazDocId },
      data: {
        manifestType: tipo,
        manifestedAt: new Date(),
      },
    });

    this.logger.log(
      `Manifest OK (via SEFAZ): doc=${sefazDocId} key=${doc.nfeKey} type=${tipo} ` +
      `cStat=${result.cStat} protocolo=${result.protocolo ?? '-'}`,
    );

    // Apos ciência, tenta baixar o procNFe via consChNFe (SEFAZ direto)
    if (tipo === 'ciencia' && doc.schema !== 'procNFe') {
      // Schedule XML download attempt (may not be available immediately)
      setTimeout(() => this.tryDownloadFullXmlViaSefaz(companyId, sefazDocId, doc.nfeKey!).catch((err) => {
        this.logger.warn(`Falha ao baixar procNFe apos ciencia: ${err.message}`);
      }), 5000);
    }

    return { ...updated, sefazResult: result };
  }

  /* ═══════════════════════════════════════════════════════════════════
     fetchNfeByKey — Busca uma NFe especifica por chave de acesso via
     Focus NFe (usado quando o sync do DistDFe pulou a nota ou ela nao
     foi puxada ainda). Cria um SefazDocument local pra aparecer no
     portal de manifestacao normalmente.
     ═══════════════════════════════════════════════════════════════════ */

  async fetchNfeByKey(companyId: string, nfeKey: string, byName: string): Promise<{
    created: boolean;
    sefazDocumentId: string;
    nfeKey: string;
    emitterName: string | null;
  }> {
    // Valida chave
    const cleanKey = (nfeKey || '').replace(/\D/g, '');
    if (cleanKey.length !== 44) {
      throw new BadRequestException('Chave de acesso inválida — precisa ter 44 dígitos.');
    }

    // Ja existe?
    const existing = await this.prisma.sefazDocument.findFirst({
      where: { companyId, nfeKey: cleanKey },
      select: { id: true, emitterName: true },
    });
    if (existing) {
      return { created: false, sefazDocumentId: existing.id, nfeKey: cleanKey, emitterName: existing.emitterName };
    }

    // Consulta DIRETO na SEFAZ via DistribuicaoDFe com consChNFe (modo consulta por chave).
    // Usa o mesmo certificado digital configurado em SefazConfig — independente do Focus.
    const config = await this.prisma.sefazConfig.findUnique({ where: { companyId } });
    if (!config) {
      throw new BadRequestException('Configuração SEFAZ não encontrada. Suba o certificado digital primeiro.');
    }
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company?.cnpj || !company.state) {
      throw new BadRequestException('Empresa precisa ter CNPJ e UF cadastrados.');
    }
    const cUFAutor = UF_IBGE[company.state.toUpperCase()];
    if (!cUFAutor) throw new BadRequestException(`UF "${company.state}" não reconhecida.`);

    const certPem = this.encryption.decrypt(config.pfxBase64);
    const keyPem = this.encryption.decrypt(config.pfxPassword);
    const cnpjOnly = company.cnpj.replace(/\D/g, '');
    const tpAmb = config.environment === 'HOMOLOGATION' ? '2' : '1';

    this.logger.log(`Consultando NFe ${cleanKey} direto na SEFAZ (consChNFe) para ${byName}`);
    const response = await this.callSefazSoap(
      certPem, keyPem, cnpjOnly, cUFAutor, cleanKey, tpAmb, config.environment, 'consChNFe',
    );

    if (response.cStat !== '138' || response.docZips.length === 0) {
      throw new BadRequestException(
        `SEFAZ não retornou a NFe. cStat=${response.cStat} — ${response.xMotivo || 'verifique se a chave está correta e se a nota foi emitida contra esta empresa'}.`,
      );
    }

    // Processa docs retornados. Pode vir procNFe (completo) quando ja manifestada, ou so resNFe (resumo)
    // quando ainda nao houve ciencia. Aceita ambos — resNFe continua funcional pra manifestacao.
    let created = 0;
    let mainDocId: string | null = null;
    let mainEmitter: string | null = null;
    for (const doc of response.docZips) {
      const parsed = this.parseSefazDocument(doc.xml, doc.nsu, doc.schema);
      if (!parsed.nfeKey) continue;

      const dupe = await this.prisma.sefazDocument.findFirst({
        where: { companyId, nfeKey: parsed.nfeKey, schema: parsed.schema },
        select: { id: true, emitterName: true },
      });
      if (dupe) {
        if ((parsed.schema === 'procNFe' || parsed.schema === 'resNFe') && !mainDocId) {
          mainDocId = dupe.id;
          mainEmitter = dupe.emitterName;
        }
        continue;
      }

      const syntheticNsu = doc.nsu || `MANUAL-${cleanKey}-${parsed.schema}`.substring(0, 50);
      const saved = await this.prisma.sefazDocument.create({
        data: {
          companyId,
          nsu: syntheticNsu,
          schema: parsed.schema,
          nfeKey: parsed.nfeKey,
          emitterCnpj: parsed.emitterCnpj,
          emitterName: parsed.emitterName,
          issueDate: parsed.issueDate,
          nfeValue: parsed.nfeValue,
          situacao: parsed.situacao,
          xmlContent: parsed.schema === 'procNFe' ? doc.xml : null,
          status: parsed.schema === 'resEvento' ? 'EVENT' : 'FETCHED',
        },
      });
      created++;
      if (parsed.schema === 'procNFe' || parsed.schema === 'resNFe') {
        // Prefere procNFe; so sobrescreve mainDocId com resNFe se ainda nao tiver procNFe
        if (!mainDocId || parsed.schema === 'procNFe') {
          mainDocId = saved.id;
          mainEmitter = parsed.emitterName;
        }
      }
    }

    if (!mainDocId) {
      throw new BadRequestException('NFe retornada pela SEFAZ não pôde ser processada (XML inválido).');
    }

    this.logger.log(`NFe ${cleanKey} importada via SEFAZ direto por ${byName} — ${created} documento(s) criado(s)`);
    return { created: created > 0, sefazDocumentId: mainDocId, nfeKey: cleanKey, emitterName: mainEmitter };
  }

  /* ═══════════════════════════════════════════════════════════════════
     manifestEventSefaz — Envia evento de manifestacao do destinatario (MDe)
     direto para o ambiente nacional da SEFAZ (NFeRecepcaoEvento4), assinado
     com o certificado digital da empresa.
     ═══════════════════════════════════════════════════════════════════ */

  private async manifestEventSefaz(
    companyId: string,
    nfeKey: string,
    tipo: 'ciencia' | 'confirmacao' | 'desconhecimento' | 'nao_realizada',
    justificativa?: string,
  ): Promise<{ cStat: string; xMotivo: string; protocolo?: string; nProt?: string }> {
    const eventCfg = MANIFEST_EVENT_TYPES[tipo];
    if (!eventCfg) throw new BadRequestException(`Tipo de manifestação invalido: ${tipo}`);

    if (eventCfg.requiresJustificativa) {
      const j = (justificativa || '').trim();
      if (j.length < 15 || j.length > 255) {
        throw new BadRequestException('Justificativa precisa ter entre 15 e 255 caracteres.');
      }
    }

    const config = await this.prisma.sefazConfig.findUnique({ where: { companyId } });
    if (!config) throw new BadRequestException('Configuração SEFAZ nao encontrada.');

    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company?.cnpj) throw new BadRequestException('Empresa sem CNPJ cadastrado.');

    const certPem = this.encryption.decrypt(config.pfxBase64);
    const keyPem = this.encryption.decrypt(config.pfxPassword);
    const cnpjOnly = company.cnpj.replace(/\D/g, '').padStart(14, '0');
    const tpAmb = config.environment === 'HOMOLOGATION' ? '2' : '1';

    // Monta infEvento — dhEvento em horario de Brasilia (-03:00) conforme leiaute NFe
    const now = new Date();
    const brasilia = new Date(now.getTime() - 3 * 3600 * 1000); // UTC - 3h
    const dhEvento = `${brasilia.getUTCFullYear()}-${String(brasilia.getUTCMonth() + 1).padStart(2, '0')}-${String(brasilia.getUTCDate()).padStart(2, '0')}T${String(brasilia.getUTCHours()).padStart(2, '0')}:${String(brasilia.getUTCMinutes()).padStart(2, '0')}:${String(brasilia.getUTCSeconds()).padStart(2, '0')}-03:00`;

    const nSeqEvento = '1';
    const idInfEvento = `ID${eventCfg.tpEvento}${nfeKey}${nSeqEvento.padStart(2, '0')}`;

    const detEventoInner = eventCfg.requiresJustificativa
      ? `<descEvento>${eventCfg.descEvento}</descEvento><xJust>${this.escapeXml(justificativa!.trim())}</xJust>`
      : `<descEvento>${eventCfg.descEvento}</descEvento>`;

    const infEvento = `<infEvento Id="${idInfEvento}"><cOrgao>91</cOrgao><tpAmb>${tpAmb}</tpAmb><CNPJ>${cnpjOnly}</CNPJ><chNFe>${nfeKey}</chNFe><dhEvento>${dhEvento}</dhEvento><tpEvento>${eventCfg.tpEvento}</tpEvento><nSeqEvento>${nSeqEvento}</nSeqEvento><verEvento>1.00</verEvento><detEvento versao="1.00">${detEventoInner}</detEvento></infEvento>`;

    // Monta o evento completo (sem assinatura) pra xml-crypto processar
    // Padrao pynfe/acbr: xmlns="http://www.portalfiscal.inf.br/nfe" tanto em <envEvento> quanto em <evento>
    const eventoUnsigned = `<evento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00">${infEvento}</evento>`;

    // Assina via xml-crypto — C14N 1.0 formal, padrao SEFAZ NFe
    const eventoSigned = this.signEventoXml(eventoUnsigned, idInfEvento, certPem, keyPem);

    const envEvento = `<envEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00"><idLote>${Date.now()}</idLote>${eventoSigned}</envEvento>`;

    // Envia via SOAP NFeRecepcaoEvento4
    const response = await this.callRecepcaoEventoSoap(certPem, keyPem, envEvento, config.environment);

    this.logger.log(`SEFAZ evento ${tipo} response: cStat=${response.cStat} xMotivo=${response.xMotivo} protocolo=${response.protocolo ?? '-'}`);

    if (response.cStat !== '128' && response.cStat !== '135' && response.cStat !== '136') {
      // 128 = Lote processado; 135 = Evento registrado; 136 = Evento registrado mas vinculado a NFe
      throw new BadRequestException(
        `SEFAZ rejeitou a manifestação. cStat=${response.cStat} — ${response.xMotivo || 'sem motivo'}`,
      );
    }

    return response;
  }

  /* ═══════════════════════════════════════════════════════════════════
     signEventoXml — Assina o <evento> completo usando xml-crypto (C14N 1.0 formal).
     A Signature e inserida DENTRO do <evento>, depois do <infEvento>, conforme leiaute NFe.
     ═══════════════════════════════════════════════════════════════════ */

  private signEventoXml(eventoXml: string, refId: string, certPem: string, keyPem: string): string {
    // Extrai certificado base64 sem headers PEM (pra KeyInfo)
    const certMatch = certPem.match(/-----BEGIN CERTIFICATE-----\s*([\s\S]+?)\s*-----END CERTIFICATE-----/);
    const certBase64 = certMatch ? certMatch[1].replace(/\s+/g, '') : '';

    const sig = new SignedXml({
      privateKey: keyPem,
      publicCert: certPem,
      signatureAlgorithm: 'http://www.w3.org/2000/09/xmldsig#rsa-sha1',
      canonicalizationAlgorithm: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
    });

    sig.addReference({
      xpath: `//*[@Id='${refId}']`,
      digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1',
      transforms: [
        'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
        'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
      ],
    });

    // KeyInfo com X509Certificate (leiaute SEFAZ exige X509Data)
    sig.getKeyInfoContent = () =>
      `<X509Data><X509Certificate>${certBase64}</X509Certificate></X509Data>`;

    sig.computeSignature(eventoXml, {
      prefix: '',
      location: {
        reference: `//*[@Id='${refId}']`,
        action: 'after',
      },
    });

    return sig.getSignedXml();
  }

  private escapeXml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }

  /* ═══════════════════════════════════════════════════════════════════
     callRecepcaoEventoSoap — POST SOAP para NFeRecepcaoEvento4 com envelope ja assinado
     ═══════════════════════════════════════════════════════════════════ */

  private callRecepcaoEventoSoap(
    certPem: string,
    keyPem: string,
    envEventoXml: string,
    environment: string,
  ): Promise<{ cStat: string; xMotivo: string; protocolo?: string; nProt?: string }> {
    // Remove declaracao XML interna (o SOAP envelope ja declara o XML)
    const envEventoInline = envEventoXml.replace(/<\?xml[^>]*\?>/i, '').trim();

    // Envelope conforme padrao nfephp/sped-nfe (producao ha 10+ anos):
    // - SEM wrapper <nfeRecepcaoEvento> (esse nao existe no NFe 4.00)
    // - xmlns WSDL direto em <nfeDadosMsg>
    // - SEM atributo versaoDados (nao existe nesse elemento)
    // Referencia: Tools.php do nfephp/sped-nfe, SoapBase.php do nfephp/sped-common
    const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body><nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4">${envEventoInline}</nfeDadosMsg></soap12:Body></soap12:Envelope>`;

    const url = environment === 'HOMOLOGATION' ? SEFAZ_EVENTO_URLS.HOMOLOGATION : SEFAZ_EVENTO_URLS.PRODUCTION;
    const parsedUrl = new URL(url);

    this.logger.log(`SEFAZ Evento SOAP → ${url} | envelope length=${soapEnvelope.length}`);
    this.logger.log(`SEFAZ Evento ENVELOPE: ${soapEnvelope}`);

    return new Promise((resolve, reject) => {
      // SOAP 1.2: action vai como parametro do Content-Type (NAO como header separado).
      // Action correta conforme WSDL oficial: nfeRecepcaoEvento (SEM sufixo "NF").
      // Sufixo "NF" era do endpoint errado (www1 = DistribuicaoDFe).
      const soapAction = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4/nfeRecepcaoEvento';
      const options: https.RequestOptions = {
        hostname: parsedUrl.hostname,
        port: 443,
        path: parsedUrl.pathname,
        method: 'POST',
        cert: certPem,
        key: keyPem,
        headers: {
          'Content-Type': `application/soap+xml;charset=UTF-8;action="${soapAction}"`,
          'Content-Length': Buffer.byteLength(soapEnvelope, 'utf-8'),
        },
        timeout: 30000,
      };

      const req = https.request(options, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf-8');
          this.logger.log(`SEFAZ Evento HTTP ${res.statusCode} | body length=${body.length}`);
          if (body.length < 5000) this.logger.log(`SEFAZ Evento response: ${body}`);

          // Detecta SOAP Fault em qualquer prefix (soap/soap12/env/SOAP-ENV/s)
          const faultMatch = body.match(/<(?:[^>]+:)?Text[^>]*>([^<]+)<\/(?:[^>]+:)?Text>/i);
          if (res.statusCode === 500 || body.includes('Fault')) {
            const faultMsg = faultMatch?.[1] ?? 'SOAP Fault sem texto';
            return reject(new Error(`SEFAZ SOAP Fault (HTTP ${res.statusCode}): ${faultMsg}`));
          }

          try {
            const parsed = this.xmlParser.parse(body);
            // Traversa qualquer prefixo de Envelope/Body (soap, soap12, env, SOAP-ENV, s)
            const envelope = parsed['soap:Envelope'] ?? parsed['soap12:Envelope']
              ?? parsed['env:Envelope'] ?? parsed['SOAP-ENV:Envelope'] ?? parsed['s:Envelope']
              ?? parsed['Envelope'] ?? parsed;
            const soapBody = envelope['soap:Body'] ?? envelope['soap12:Body']
              ?? envelope['env:Body'] ?? envelope['SOAP-ENV:Body'] ?? envelope['s:Body']
              ?? envelope['Body'] ?? envelope;
            // Response pode vir com ou sem wrapper dependendo da SEFAZ:
            // padrao nfephp: soap:Body > nfeRecepcaoEventoResponse > nfeResultMsg > retEnvEvento
            // as vezes: soap:Body > nfeResultMsg > retEnvEvento
            // as vezes: soap:Body > retEnvEvento (direto)
            const methodResp = soapBody?.nfeRecepcaoEventoResponse ?? soapBody;
            const resp = methodResp?.nfeResultMsg ?? methodResp;
            const retEnvEvento = resp?.retEnvEvento ?? resp;

            const cStatLote = String(retEnvEvento?.cStat ?? '');
            const xMotivoLote = String(retEnvEvento?.xMotivo ?? '');

            if (!cStatLote) {
              // Log do objeto parseado pra debugar estrutura desconhecida
              this.logger.warn(`SEFAZ Evento parse: cStat vazio. Parsed=${JSON.stringify(parsed).substring(0, 1000)}`);
            }

            // Se o lote foi processado, busca retorno do evento individual
            const retEvento = retEnvEvento?.retEvento;
            const retEventoItem = Array.isArray(retEvento) ? retEvento[0] : retEvento;
            const infEventoRet = retEventoItem?.infEvento;
            if (infEventoRet) {
              const cStatEv = String(infEventoRet.cStat ?? cStatLote);
              const xMotivoEv = String(infEventoRet.xMotivo ?? xMotivoLote);
              const nProt = infEventoRet.nProt ? String(infEventoRet.nProt) : undefined;
              resolve({ cStat: cStatEv, xMotivo: xMotivoEv, protocolo: nProt, nProt });
            } else {
              resolve({ cStat: cStatLote, xMotivo: xMotivoLote });
            }
          } catch (err) {
            reject(new Error(`Erro ao processar resposta SEFAZ evento: ${err.message}`));
          }
        });
      });

      req.on('error', (err) => reject(new Error(`Erro de conexao SEFAZ evento: ${err.message}`)));
      req.on('timeout', () => { req.destroy(); reject(new Error('Timeout SEFAZ evento (30s)')); });
      req.write(soapEnvelope);
      req.end();
    });
  }

  /* ═══════════════════════════════════════════════════════════════════
     tryDownloadFullXmlViaSefaz — Busca procNFe direto no SEFAZ via consChNFe
     (usado apos ciencia — substitui o download via Focus).
     ═══════════════════════════════════════════════════════════════════ */

  private async tryDownloadFullXmlViaSefaz(companyId: string, sefazDocId: string, nfeKey: string) {
    const config = await this.prisma.sefazConfig.findUnique({ where: { companyId } });
    if (!config) return;
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company?.cnpj || !company.state) return;

    const cUFAutor = UF_IBGE[company.state.toUpperCase()];
    if (!cUFAutor) return;

    const certPem = this.encryption.decrypt(config.pfxBase64);
    const keyPem = this.encryption.decrypt(config.pfxPassword);
    const cnpjOnly = company.cnpj.replace(/\D/g, '');
    const tpAmb = config.environment === 'HOMOLOGATION' ? '2' : '1';

    const response = await this.callSefazSoap(
      certPem, keyPem, cnpjOnly, cUFAutor, nfeKey, tpAmb, config.environment, 'consChNFe',
    );

    if (response.cStat !== '138' || response.docZips.length === 0) {
      this.logger.log(`procNFe ainda nao disponivel apos ciencia: key=${nfeKey} cStat=${response.cStat}`);
      return;
    }

    for (const doc of response.docZips) {
      const parsed = this.parseSefazDocument(doc.xml, doc.nsu, doc.schema);
      if (parsed.schema === 'procNFe' && parsed.nfeKey === nfeKey) {
        await this.prisma.sefazDocument.update({
          where: { id: sefazDocId },
          data: {
            xmlContent: doc.xml,
            schema: 'procNFe',
            emitterName: parsed.emitterName || undefined,
            nfeValue: parsed.nfeValue || undefined,
          },
        });
        this.logger.log(`procNFe baixado via SEFAZ apos ciencia: key=${nfeKey}`);
        return;
      }
    }
  }

  /* ═══════════════════════════════════════════════════════════════════
     tryDownloadFullXml — Attempt to download procNFe XML after ciência (LEGADO - Focus)
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

      let manifested = 0;
      for (const doc of pendingDocs) {
        try {
          // Manifestacao via SEFAZ direto (nao passa pelo Focus)
          await this.manifestEventSefaz(companyId, doc.nfeKey!, 'ciencia');
          await this.prisma.sefazDocument.update({
            where: { id: doc.id },
            data: { manifestType: 'ciencia', manifestedAt: new Date() },
          });
          manifested++;

          // Apos ciencia, tenta baixar procNFe via consChNFe (nao bloqueia se nao disponivel ainda)
          try {
            await this.tryDownloadFullXmlViaSefaz(companyId, doc.id, doc.nfeKey!);
          } catch (xmlErr) {
            this.logger.warn(`XML download after ciencia failed for key=${doc.nfeKey}: ${xmlErr.message}`);
          }

          // Small delay between manifests to avoid rate limiting
          await new Promise(r => setTimeout(r, 1500));
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
     Cron — Auto-fetch every 10 minutes (multi-tenant aware)
     ═══════════════════════════════════════════════════════════════════ */

  @Cron('0 */10 * * * *')
  async cronFetchAll() {
    this.logger.log('Starting scheduled SEFAZ DFe fetch (multi-tenant)...');

    try {
      let totalDocs = 0;

      // Iterate over all active tenants and run fetch within each tenant context
      await this.tenantResolver.forEachTenant(async (tenantId, tenantSlug) => {
        const configs = await this.prisma.sefazConfig.findMany({
          where: { autoFetchEnabled: true },
        });

        if (configs.length === 0) return;

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
                `[${tenantSlug}] Skipping company ${config.companyId}: rate limited, retry in ${minutesLeft}min`,
              );
              continue;
            }
            const result = await this.fetchDistDFe(config.companyId);
            totalDocs += result.newDocuments;
            if (result.newDocuments > 0) {
              this.logger.log(
                `[${tenantSlug}] Company ${config.companyId}: ${result.newDocuments} new docs (NSU: ${result.lastNsu})`,
              );
            }
            // Auto-manifest ciência for new resNFe docs (if enabled)
            await this.autoManifestNewDocs(config.companyId);
          } catch (err) {
            this.logger.error(
              `[${tenantSlug}] SEFAZ fetch error for company ${config.companyId}: ${(err as Error).message}`,
            );
          }
        }
      });

      this.logger.log(`SEFAZ DFe fetch completed. Total new docs: ${totalDocs}`);
    } catch (err) {
      this.logger.error(`SEFAZ cron error: ${(err as Error).message}`);
    }
  }
}
