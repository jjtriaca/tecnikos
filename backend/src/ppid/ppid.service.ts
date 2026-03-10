import { Injectable, Logger } from '@nestjs/common';

const PPID_BASE_URL = 'https://api.ppid.com.br';

/**
 * Service for ppid.com.br identity verification API.
 * Handles JWT auth caching, classification, OCR, liveness, and face match.
 */
@Injectable()
export class PpidService {
  private readonly logger = new Logger(PpidService.name);
  private token: string | null = null;
  private tokenExpiration: Date | null = null;

  get isConfigured(): boolean {
    return !!(process.env.PPID_EMAIL && process.env.PPID_PASSWORD);
  }

  /**
   * Authenticate with ppid and cache the JWT token.
   */
  private async authenticate(): Promise<string> {
    // Return cached token if still valid (with 5 min buffer)
    if (this.token && this.tokenExpiration) {
      const buffer = 5 * 60 * 1000;
      if (this.tokenExpiration.getTime() - buffer > Date.now()) {
        return this.token;
      }
    }

    const email = process.env.PPID_EMAIL;
    const senha = process.env.PPID_PASSWORD;
    if (!email || !senha) {
      throw new Error('PPID não configurado (PPID_EMAIL / PPID_PASSWORD)');
    }

    const res = await fetch(`${PPID_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`PPID auth failed (${res.status}): ${body}`);
    }

    const data = await res.json();
    this.token = data.token;
    this.tokenExpiration = new Date(data.expiration);
    this.logger.log(`PPID authenticated — expires ${data.expiration}`);
    return this.token!;
  }

  /**
   * Classification — detect document type (RG, CNH, etc.)
   */
  async classify(imageBase64: string): Promise<{
    sucesso: boolean;
    tipoDocumento?: string;
    confianca?: number;
    detalhes?: { category?: string; side?: string; isComplete?: boolean };
    saldoRestante?: number;
    error?: string;
  }> {
    try {
      const token = await this.authenticate();
      const res = await fetch(`${PPID_BASE_URL}/api/classification/consultar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ imagemBase64: imageBase64 }),
      });

      if (!res.ok) {
        if (res.status === 402) return { sucesso: false, error: 'Saldo insuficiente no PPID' };
        const body = await res.text();
        return { sucesso: false, error: `Classification error (${res.status}): ${body}` };
      }

      const data = await res.json();
      this.logger.log(`Classification: ${data.tipoDocumento} (${data.confianca}%) — saldo: ${data.saldoRestante}`);
      return data;
    } catch (err: any) {
      this.logger.error(`Classification failed: ${err.message}`);
      return { sucesso: false, error: err.message };
    }
  }

  /**
   * OCR — extract data from document image.
   */
  async ocr(imageBase64: string, mimeType?: string): Promise<{
    sucesso: boolean;
    consultaId?: string;
    resultado?: {
      documentType?: string;
      confidence?: number;
      fields?: Record<string, string>;
    };
    saldoRestante?: number;
    error?: string;
  }> {
    try {
      const token = await this.authenticate();
      const body: any = { imagemBase64: imageBase64 };
      if (mimeType) body.mimeType = mimeType;

      const res = await fetch(`${PPID_BASE_URL}/api/ocr/consultar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        if (res.status === 402) return { sucesso: false, error: 'Saldo insuficiente no PPID' };
        const text = await res.text();
        return { sucesso: false, error: `OCR error (${res.status}): ${text}` };
      }

      const data = await res.json();
      this.logger.log(`OCR: ${data.resultado?.documentType} — fields: ${Object.keys(data.resultado?.fields || {}).length} — saldo: ${data.saldoRestante}`);
      return data;
    } catch (err: any) {
      this.logger.error(`OCR failed: ${err.message}`);
      return { sucesso: false, error: err.message };
    }
  }

  /**
   * Liveness — verify selfie is a real person.
   */
  async liveness(imageBase64: string): Promise<{
    liveness?: number;
    detalhes?: {
      singleFaceDetected?: boolean;
      photoOfPhotoDetected?: boolean;
      maskDetected?: boolean;
      lightingQuality?: string;
    };
    saldoRestante?: number;
    error?: string;
  }> {
    try {
      const token = await this.authenticate();
      const res = await fetch(`${PPID_BASE_URL}/api/liveness/consultar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ imagemBase64: imageBase64 }),
      });

      if (!res.ok) {
        if (res.status === 402) return { error: 'Saldo insuficiente no PPID' };
        const text = await res.text();
        return { error: `Liveness error (${res.status}): ${text}` };
      }

      const data = await res.json();
      this.logger.log(`Liveness: ${data.liveness}% — saldo: ${data.saldoRestante}`);
      return data;
    } catch (err: any) {
      this.logger.error(`Liveness failed: ${err.message}`);
      return { error: err.message };
    }
  }

  /**
   * Face Match — compare document photo with selfie.
   */
  async faceMatch(documentBase64: string, selfieBase64: string): Promise<{
    sucesso?: boolean;
    similaridade?: number;
    saldoRestante?: number;
    error?: string;
  }> {
    try {
      const token = await this.authenticate();
      const res = await fetch(`${PPID_BASE_URL}/api/facematch/consultar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          documentoBase64: documentBase64,
          selfieBase64: selfieBase64,
        }),
      });

      if (!res.ok) {
        if (res.status === 402) return { error: 'Saldo insuficiente no PPID' };
        const text = await res.text();
        return { error: `Face match error (${res.status}): ${text}` };
      }

      const data = await res.json();
      this.logger.log(`Face Match: ${data.similaridade}% — saldo: ${data.saldoRestante}`);
      return data;
    } catch (err: any) {
      this.logger.error(`Face match failed: ${err.message}`);
      return { error: err.message };
    }
  }

  /**
   * Full verification pipeline: classify → OCR → liveness → face match.
   * Returns combined results for the signup flow.
   */
  async fullVerification(documentBase64: string, selfieBase64: string): Promise<{
    approved: boolean;
    classification?: { tipo: string; confianca: number };
    ocr?: { documentType: string; fields: Record<string, string> };
    liveness?: { score: number; details: any };
    faceMatch?: { similaridade: number };
    reasons: string[];
    error?: string;
  }> {
    const reasons: string[] = [];

    // 1. Classification
    const classResult = await this.classify(documentBase64);
    if (!classResult.sucesso || !classResult.tipoDocumento) {
      return { approved: false, reasons: ['Documento não reconhecido. Envie foto de RG ou CNH.'], error: classResult.error };
    }

    const validDocs = ['RG', 'CNH', 'RNE', 'PASSAPORTE'];
    if (!validDocs.includes(classResult.tipoDocumento.toUpperCase())) {
      return { approved: false, reasons: [`Tipo de documento "${classResult.tipoDocumento}" não aceito. Use RG ou CNH.`] };
    }

    if ((classResult.confianca || 0) < 70) {
      reasons.push('Qualidade da foto do documento baixa. Tente novamente com melhor iluminação.');
    }

    // 2. OCR
    const ocrResult = await this.ocr(documentBase64);
    const ocrFields = ocrResult.resultado?.fields || {};

    // 3. Liveness
    const livenessResult = await this.liveness(selfieBase64);
    const livenessScore = livenessResult.liveness || 0;

    if (livenessScore < 50) {
      reasons.push('Prova de vida insuficiente. Tire uma selfie em ambiente iluminado, sem óculos escuros ou máscara.');
    }

    if (livenessResult.detalhes?.photoOfPhotoDetected) {
      reasons.push('Detectada foto de foto. Tire uma selfie real.');
    }

    if (livenessResult.detalhes?.maskDetected) {
      reasons.push('Máscara detectada. Remova a máscara para a verificação.');
    }

    // 4. Face Match
    const matchResult = await this.faceMatch(documentBase64, selfieBase64);
    const similarity = matchResult.similaridade || 0;

    if (similarity < 60) {
      reasons.push('Rosto da selfie não corresponde ao documento. Verifique se está usando o documento correto.');
    }

    const approved = reasons.length === 0 && livenessScore >= 50 && similarity >= 60;

    return {
      approved,
      classification: {
        tipo: classResult.tipoDocumento!,
        confianca: classResult.confianca || 0,
      },
      ocr: {
        documentType: ocrResult.resultado?.documentType || classResult.tipoDocumento!,
        fields: ocrFields,
      },
      liveness: {
        score: livenessScore,
        details: livenessResult.detalhes,
      },
      faceMatch: {
        similaridade: similarity,
      },
      reasons,
    };
  }
}
