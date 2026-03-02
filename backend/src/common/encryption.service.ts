import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

/**
 * AES-256-GCM encryption service for storing sensitive data at rest.
 * Used to encrypt Meta WhatsApp Cloud API access tokens.
 *
 * Storage format: iv:authTag:ciphertext (all base64-encoded)
 */
@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;

  constructor() {
    const envKey = process.env.ENCRYPTION_KEY;
    if (envKey) {
      this.key = Buffer.from(envKey, 'hex');
      if (this.key.length !== 32) {
        throw new Error(
          'ENCRYPTION_KEY must be 32 bytes (64 hex chars). Generate with: openssl rand -hex 32',
        );
      }
    } else {
      // Fallback: derive key from JWT_SECRET (not ideal but works without env change)
      const secret = process.env.JWT_SECRET || 'tecnikos-default-secret';
      this.key = crypto.scryptSync(secret, 'tecnikos-salt', 32);
      this.logger.warn(
        'ENCRYPTION_KEY not set — deriving from JWT_SECRET. Set ENCRYPTION_KEY for production.',
      );
    }
  }

  /**
   * Encrypt plaintext using AES-256-GCM.
   * @returns Format: "iv:authTag:ciphertext" (base64)
   */
  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(12); // 96-bit IV for GCM
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    const authTag = cipher.getAuthTag();

    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
  }

  /**
   * Decrypt ciphertext from format "iv:authTag:ciphertext".
   */
  decrypt(ciphertext: string): string {
    const parts = ciphertext.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted format');
    }

    const iv = Buffer.from(parts[0], 'base64');
    const authTag = Buffer.from(parts[1], 'base64');
    const encrypted = parts[2];

    const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}
