import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/encryption.service';
import * as crypto from 'crypto';

export interface MetaMessageResponse {
  messaging_product: string;
  contacts?: Array<{ input: string; wa_id: string }>;
  messages?: Array<{ id: string }>;
}

export interface WhatsAppConfigInfo {
  provider: 'META';
  isConnected: boolean;
  connectedAt: string | null;
  metaPhoneNumberId: string | null;
  metaWabaId: string | null;
  hasAccessToken: boolean;
  verifyToken: string;
  webhookUrl: string;
}

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly metaApiUrl = 'https://graph.facebook.com/v21.0';

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  // ── Config Management ─────────────────────────────────────

  /**
   * Get WhatsApp config for a company (without decrypting token).
   */
  async getConfig(companyId: string): Promise<WhatsAppConfigInfo> {
    const config = await this.prisma.whatsAppConfig.findUnique({
      where: { companyId },
    });

    const domain = process.env.DOMAIN || 'tecnikos.com.br';

    if (!config) {
      return {
        provider: 'META',
        isConnected: false,
        connectedAt: null,
        metaPhoneNumberId: null,
        metaWabaId: null,
        hasAccessToken: false,
        verifyToken: '',
        webhookUrl: `https://${domain}/api/whatsapp/webhook/meta/${companyId}`,
      };
    }

    return {
      provider: 'META',
      isConnected: config.isConnected,
      connectedAt: config.connectedAt?.toISOString() || null,
      metaPhoneNumberId: config.metaPhoneNumberId,
      metaWabaId: config.metaWabaId,
      hasAccessToken: !!config.metaAccessToken,
      verifyToken: config.metaVerifyToken,
      webhookUrl: `https://${domain}/api/whatsapp/webhook/meta/${companyId}`,
    };
  }

  /**
   * Save Meta Cloud API config for a company.
   * Encrypts the access token before storing.
   */
  async saveConfig(
    companyId: string,
    data: { metaAccessToken: string; metaPhoneNumberId: string; metaWabaId?: string },
  ): Promise<WhatsAppConfigInfo> {
    const encryptedToken = this.encryption.encrypt(data.metaAccessToken);
    const verifyToken = crypto.randomBytes(16).toString('hex');

    await this.prisma.whatsAppConfig.upsert({
      where: { companyId },
      create: {
        companyId,
        metaAccessToken: encryptedToken,
        metaPhoneNumberId: data.metaPhoneNumberId,
        metaWabaId: data.metaWabaId || null,
        metaVerifyToken: verifyToken,
        isConnected: true,
        connectedAt: new Date(),
      },
      update: {
        metaAccessToken: encryptedToken,
        metaPhoneNumberId: data.metaPhoneNumberId,
        metaWabaId: data.metaWabaId || null,
        isConnected: true,
        connectedAt: new Date(),
      },
    });

    return this.getConfig(companyId);
  }

  /**
   * Disconnect: mark config as not connected.
   */
  async disconnect(companyId: string): Promise<void> {
    await this.prisma.whatsAppConfig.updateMany({
      where: { companyId },
      data: {
        isConnected: false,
        metaAccessToken: null,
      },
    });
    this.logger.log(`WhatsApp disconnected for company ${companyId}`);
  }

  /**
   * Get decrypted access token for a company.
   */
  private async getAccessToken(companyId: string): Promise<string | null> {
    const config = await this.prisma.whatsAppConfig.findUnique({
      where: { companyId },
      select: { metaAccessToken: true, isConnected: true },
    });

    if (!config?.metaAccessToken || !config.isConnected) return null;

    try {
      return this.encryption.decrypt(config.metaAccessToken);
    } catch (err) {
      this.logger.error(`Failed to decrypt token for company ${companyId}: ${err.message}`);
      return null;
    }
  }

  /**
   * Get phone number ID for a company.
   */
  private async getPhoneNumberId(companyId: string): Promise<string | null> {
    const config = await this.prisma.whatsAppConfig.findUnique({
      where: { companyId },
      select: { metaPhoneNumberId: true, isConnected: true },
    });

    return config?.isConnected ? config.metaPhoneNumberId : null;
  }

  // ── Connection Testing ────────────────────────────────────

  /**
   * Test connection with provided credentials (before saving).
   */
  async testConnection(
    accessToken: string,
    phoneNumberId: string,
  ): Promise<{ success: boolean; phoneNumber?: string; displayName?: string; error?: string }> {
    try {
      const res = await fetch(`${this.metaApiUrl}/${phoneNumberId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        return {
          success: false,
          error: error?.error?.message || `HTTP ${res.status}`,
        };
      }

      const data = await res.json();
      return {
        success: true,
        phoneNumber: data.display_phone_number,
        displayName: data.verified_name,
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Get connection status for a company.
   */
  async getConnectionStatus(companyId: string): Promise<{ state: string; displayName?: string; phoneNumber?: string }> {
    const config = await this.prisma.whatsAppConfig.findUnique({
      where: { companyId },
    });

    if (!config?.isConnected || !config.metaAccessToken || !config.metaPhoneNumberId) {
      return { state: 'close' };
    }

    // Verify token is still valid
    try {
      const token = this.encryption.decrypt(config.metaAccessToken);
      const result = await this.testConnection(token, config.metaPhoneNumberId);

      if (result.success) {
        return {
          state: 'open',
          displayName: result.displayName,
          phoneNumber: result.phoneNumber,
        };
      }

      // Token invalid — mark as disconnected
      await this.prisma.whatsAppConfig.update({
        where: { companyId },
        data: { isConnected: false },
      });
      return { state: 'close' };
    } catch {
      return { state: 'close' };
    }
  }

  /**
   * Check if WhatsApp is connected for a company.
   */
  async isConnected(companyId: string): Promise<boolean> {
    const config = await this.prisma.whatsAppConfig.findUnique({
      where: { companyId },
      select: { isConnected: true },
    });
    return config?.isConnected || false;
  }

  // ── Sending Messages (Meta Cloud API) ─────────────────────

  /**
   * Send a text message via Meta WhatsApp Cloud API.
   * @param companyId The company sending the message
   * @param phone Brazilian phone (e.g. "65999887766" or "5565999887766")
   * @param message Text to send
   */
  async sendText(
    companyId: string,
    phone: string,
    message: string,
  ): Promise<MetaMessageResponse | null> {
    const token = await this.getAccessToken(companyId);
    const phoneNumberId = await this.getPhoneNumberId(companyId);

    if (!token || !phoneNumberId) {
      this.logger.warn(`WhatsApp not configured for company ${companyId}`);
      return null;
    }

    const formattedPhone = this.formatPhone(phone);

    try {
      const res = await this.metaRequest(token, phoneNumberId, {
        messaging_product: 'whatsapp',
        to: formattedPhone,
        type: 'text',
        text: { body: message },
      });

      this.logger.log(`WhatsApp sent to ${formattedPhone}: ${message.substring(0, 50)}...`);
      return res;
    } catch (err) {
      this.logger.error(`WhatsApp send failed to ${formattedPhone}: ${err.message}`);
      return null;
    }
  }

  /**
   * Send text with fallback to template if outside 24h window.
   * Unlike sendText, this ALWAYS delivers: text if window open, template if not.
   * Returns true if sent, false if all attempts failed.
   */
  async sendTextWithTemplateFallback(
    companyId: string,
    phone: string,
    message: string,
  ): Promise<boolean> {
    const token = await this.getAccessToken(companyId);
    const phoneNumberId = await this.getPhoneNumberId(companyId);

    if (!token || !phoneNumberId) {
      this.logger.warn(`WhatsApp not configured for company ${companyId}`);
      return false;
    }

    const formattedPhone = this.formatPhone(phone);

    // 1. Try sending regular text (works within 24h conversation window)
    try {
      await this.metaRequest(token, phoneNumberId, {
        messaging_product: 'whatsapp',
        to: formattedPhone,
        type: 'text',
        text: { body: message },
      });

      this.logger.log(`📱 WhatsApp text sent to ${formattedPhone}`);
      return true;
    } catch (textErr: any) {
      this.logger.warn(`📱 WhatsApp text failed (likely outside 24h window), trying template: ${textErr.message}`);
    }

    // 2. Fallback: send via template "notificacao_tecnikos" with the message as body
    //    Template must accept {{1}} parameter (the message content)
    //    If no such template, try the generic "hello_world" just to notify the user
    try {
      // Truncate message for template (max 1024 chars in body parameter)
      const truncatedMsg = message.length > 1000 ? message.substring(0, 997) + '...' : message;

      await this.metaRequest(token, phoneNumberId, {
        messaging_product: 'whatsapp',
        to: formattedPhone,
        type: 'template',
        template: {
          name: 'notificacao_tecnikos',
          language: { code: 'pt_BR' },
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: truncatedMsg },
              ],
            },
          ],
        },
      });

      this.logger.log(`📱 WhatsApp template "notificacao_tecnikos" sent to ${formattedPhone}`);
      return true;
    } catch (templateErr: any) {
      this.logger.warn(`📱 Template "notificacao_tecnikos" failed: ${templateErr.message}, trying teste_conexao`);
    }

    // 3. Last resort: generic template without parameters
    try {
      await this.metaRequest(token, phoneNumberId, {
        messaging_product: 'whatsapp',
        to: formattedPhone,
        type: 'template',
        template: {
          name: 'teste_conexao',
          language: { code: 'pt_BR' },
        },
      });

      this.logger.log(`📱 WhatsApp fallback template "teste_conexao" sent to ${formattedPhone}`);
      return true;
    } catch (fallbackErr: any) {
      this.logger.error(`📱 All WhatsApp send attempts failed for ${formattedPhone}: ${fallbackErr.message}`);
      return false;
    }
  }

  /**
   * Send a test message — returns { success, messageId?, error? } instead of null.
   * Unlike sendText(), this method does NOT swallow errors — it propagates them.
   * Sends a plain text message (works within 24h customer service window).
   * If text fails (no open window), falls back to template "teste_conexao".
   */
  async sendTestMessage(
    companyId: string,
    phone: string,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const token = await this.getAccessToken(companyId);
    const phoneNumberId = await this.getPhoneNumberId(companyId);

    if (!token || !phoneNumberId) {
      return { success: false, error: 'WhatsApp nao esta configurado' };
    }

    const formattedPhone = this.formatPhone(phone);

    try {
      // Try sending a plain text message first (works within 24h service window)
      const res = await this.metaRequest(token, phoneNumberId, {
        messaging_product: 'whatsapp',
        to: formattedPhone,
        type: 'text',
        text: {
          body: 'Tecnikos - Teste de conexao realizado com sucesso! Seu WhatsApp Business esta configurado e pronto para uso.',
        },
      });

      this.logger.log(`WhatsApp test text sent to ${formattedPhone}`);
      return {
        success: true,
        messageId: res.messages?.[0]?.id || undefined,
      };
    } catch (textErr: any) {
      // If text fails (no open conversation window), try template
      this.logger.warn(`WhatsApp test text failed, trying template: ${textErr.message}`);

      try {
        const res = await this.metaRequest(token, phoneNumberId, {
          messaging_product: 'whatsapp',
          to: formattedPhone,
          type: 'template',
          template: {
            name: 'teste_conexao',
            language: { code: 'pt_BR' },
          },
        });

        this.logger.log(`WhatsApp test template sent to ${formattedPhone}`);
        return {
          success: true,
          messageId: res.messages?.[0]?.id || undefined,
        };
      } catch (templateErr: any) {
        const errorMsg = templateErr.message || textErr.message || 'Erro desconhecido';
        this.logger.error(`WhatsApp test send failed to ${formattedPhone}: ${errorMsg}`);

        let friendlyError = errorMsg;
        if (errorMsg.includes('Invalid phone number')) {
          friendlyError = 'Numero de telefone invalido. Verifique o formato (DDD + numero).';
        } else if (errorMsg.includes('Template name does not exist') || errorMsg.includes('template')) {
          friendlyError = 'Nenhum template aprovado disponivel. O destinatario precisa enviar uma mensagem primeiro para o numero da empresa.';
        }

        return { success: false, error: friendlyError };
      }
    }
  }

  /**
   * Send media (image, document) via Meta WhatsApp Cloud API.
   */
  async sendMedia(
    companyId: string,
    phone: string,
    mediaUrl: string,
    caption?: string,
    mediaType: 'image' | 'document' | 'audio' | 'video' = 'image',
  ): Promise<MetaMessageResponse | null> {
    const token = await this.getAccessToken(companyId);
    const phoneNumberId = await this.getPhoneNumberId(companyId);

    if (!token || !phoneNumberId) {
      this.logger.warn(`WhatsApp not configured for company ${companyId}`);
      return null;
    }

    const formattedPhone = this.formatPhone(phone);

    try {
      const body: any = {
        messaging_product: 'whatsapp',
        to: formattedPhone,
        type: mediaType,
      };

      body[mediaType] = {
        link: mediaUrl,
        ...(caption && mediaType !== 'audio' ? { caption } : {}),
      };

      const res = await this.metaRequest(token, phoneNumberId, body);
      this.logger.log(`WhatsApp media sent to ${formattedPhone} (${mediaType})`);
      return res;
    } catch (err) {
      this.logger.error(`WhatsApp media send failed to ${formattedPhone}: ${err.message}`);
      return null;
    }
  }

  // ── Webhook — Meta Cloud API ──────────────────────────────

  /**
   * Verify Meta webhook (GET request challenge).
   */
  async verifyWebhook(
    companyId: string,
    mode: string,
    token: string,
    challenge: string,
  ): Promise<string | null> {
    if (mode !== 'subscribe') return null;

    const config = await this.prisma.whatsAppConfig.findUnique({
      where: { companyId },
      select: { metaVerifyToken: true },
    });

    if (!config || config.metaVerifyToken !== token) {
      this.logger.warn(`Webhook verification failed for company ${companyId}`);
      return null;
    }

    this.logger.log(`Webhook verified for company ${companyId}`);
    return challenge;
  }

  /**
   * Process incoming webhook from Meta Cloud API.
   */
  async processMetaWebhook(companyId: string, body: any): Promise<void> {
    // Meta sends { object: "whatsapp_business_account", entry: [...] }
    if (body.object !== 'whatsapp_business_account') return;

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== 'messages') continue;

        const value = change.value;

        // Process incoming messages
        for (const msg of value.messages || []) {
          await this.handleMetaIncomingMessage(companyId, msg, value.contacts);
        }

        // Process status updates
        for (const status of value.statuses || []) {
          await this.handleMetaStatusUpdate(status);
        }
      }
    }
  }

  /**
   * Handle incoming message from Meta webhook.
   */
  private async handleMetaIncomingMessage(
    companyId: string,
    msg: any,
    contacts?: any[],
  ): Promise<void> {
    const remotePhone = msg.from; // Full phone number with country code

    if (!remotePhone) return;

    const messageType = msg.type || 'text';
    const content = this.extractMetaContent(msg);

    if (!content) return;

    // Remove country code for storage (e.g. "5565999887766" → "65999887766")
    const storedPhone = remotePhone.replace(/^55/, '');

    this.logger.log(`WhatsApp received from ${storedPhone}: ${content.substring(0, 50)}`);

    // Find partner by phone number
    const phoneSuffixes = this.getPhoneSuffixes(remotePhone);
    const partner = await this.prisma.partner.findFirst({
      where: {
        companyId,
        phone: { in: phoneSuffixes },
        deletedAt: null,
      },
      select: { id: true },
    });

    // Check for duplicate by whatsappMsgId
    if (msg.id) {
      const existing = await this.prisma.whatsAppMessage.findUnique({
        where: { whatsappMsgId: msg.id },
      });
      if (existing) return; // Already processed
    }

    await this.prisma.whatsAppMessage.create({
      data: {
        companyId,
        partnerId: partner?.id || null,
        remotePhone: storedPhone,
        direction: 'INBOUND',
        messageType,
        content,
        whatsappMsgId: msg.id || null,
        status: 'RECEIVED',
      },
    });
  }

  /**
   * Handle message status update from Meta webhook.
   */
  private async handleMetaStatusUpdate(status: any): Promise<void> {
    if (!status?.id) return;

    const statusMap: Record<string, string> = {
      sent: 'SENT',
      delivered: 'DELIVERED',
      read: 'READ',
      failed: 'FAILED',
    };

    const newStatus = statusMap[status.status];
    if (!newStatus) return;

    await this.prisma.whatsAppMessage.updateMany({
      where: { whatsappMsgId: status.id },
      data: { status: newStatus },
    });
  }

  /**
   * Extract content from Meta message object.
   */
  private extractMetaContent(msg: any): string {
    switch (msg.type) {
      case 'text':
        return msg.text?.body || '';
      case 'image':
        return msg.image?.caption || '[Imagem]';
      case 'document':
        return msg.document?.filename || '[Documento]';
      case 'audio':
        return '[Audio]';
      case 'video':
        return msg.video?.caption || '[Video]';
      case 'location':
        return `📍 ${msg.location?.latitude},${msg.location?.longitude}`;
      case 'contacts':
        return msg.contacts?.[0]?.name?.formatted_name || '[Contato]';
      case 'sticker':
        return '[Figurinha]';
      case 'reaction':
        return msg.reaction?.emoji || '[Reacao]';
      default:
        return '';
    }
  }

  // ── Meta API HTTP Helper ──────────────────────────────────

  private async metaRequest(
    accessToken: string,
    phoneNumberId: string,
    body: any,
  ): Promise<MetaMessageResponse> {
    const url = `${this.metaApiUrl}/${phoneNumberId}/messages`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      const errorMsg = error?.error?.message || `HTTP ${res.status}`;
      throw new Error(`Meta API: ${errorMsg}`);
    }

    return res.json();
  }

  // ── Phone Formatting ──────────────────────────────────────

  /**
   * Format Brazilian phone number for WhatsApp.
   * Input: "65999887766", "(65) 99988-7766", "5565999887766"
   * Output: "5565999887766"
   */
  formatPhone(phone: string): string {
    let digits = phone.replace(/\D/g, '');

    // Strip leading zero (common in Brazilian phones: 066... → 66...)
    if (digits.startsWith('0') && !digits.startsWith('00')) {
      digits = digits.substring(1);
    }

    // Already has country code
    if (digits.startsWith('55') && digits.length >= 12) {
      return digits;
    }

    // Has DDD but no country code
    if (digits.length === 10 || digits.length === 11) {
      return '55' + digits;
    }

    // Just the number without DDD
    if (digits.length === 8 || digits.length === 9) {
      return '5565' + digits; // Default DDD 65 (MT)
    }

    return digits;
  }

  /**
   * Generate multiple phone suffix variations for matching.
   */
  private getPhoneSuffixes(phone: string): string[] {
    const digits = phone.replace(/\D/g, '');
    const suffixes = new Set<string>();

    suffixes.add(digits);

    // With country code
    if (digits.startsWith('55')) {
      const withoutCountry = digits.substring(2);
      suffixes.add(withoutCountry);

      // With and without 9th digit
      if (withoutCountry.length === 11) {
        suffixes.add(
          withoutCountry.substring(0, 2) + withoutCountry.substring(3),
        );
      } else if (withoutCountry.length === 10) {
        suffixes.add(
          withoutCountry.substring(0, 2) + '9' + withoutCountry.substring(2),
        );
      }
    }

    // Add formatted variations
    for (const s of [...suffixes]) {
      if (s.length === 10 || s.length === 11) {
        const ddd = s.substring(0, 2);
        const num = s.substring(2);
        suffixes.add(
          `(${ddd}) ${num.substring(0, num.length - 4)}-${num.substring(num.length - 4)}`,
        );
        suffixes.add(`(${ddd})${num}`);
        suffixes.add(`${ddd}${num}`);
      }
    }

    return [...suffixes];
  }

  // ── Chat / Conversation Methods ───────────────────────────

  /**
   * List conversations for a company (grouped by phone).
   */
  async listConversations(companyId: string, search?: string) {
    const allMessages = await this.prisma.whatsAppMessage.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      include: {
        partner: { select: { id: true, name: true, document: true } },
      },
    });

    // Group by remotePhone — take latest message per phone
    const phoneMap = new Map<string, any>();
    for (const msg of allMessages) {
      if (!phoneMap.has(msg.remotePhone)) {
        phoneMap.set(msg.remotePhone, {
          remotePhone: msg.remotePhone,
          lastMessage: msg.content,
          lastDirection: msg.direction,
          lastMessageType: msg.messageType,
          lastStatus: msg.status,
          lastMessageAt: msg.createdAt,
          partnerId: msg.partnerId,
          partnerName: msg.partner?.name || null,
          partnerDocument: msg.partner?.document || null,
          unreadCount: 0,
        });
      }
      // Count unread inbound messages
      if (msg.direction === 'INBOUND' && msg.status === 'RECEIVED') {
        const conv = phoneMap.get(msg.remotePhone);
        if (conv) conv.unreadCount++;
      }
    }

    let conversations = [...phoneMap.values()];

    // Apply search filter
    if (search) {
      const s = search.toLowerCase();
      conversations = conversations.filter(
        (c) =>
          c.remotePhone.includes(s) ||
          c.partnerName?.toLowerCase().includes(s),
      );
    }

    // Sort by lastMessageAt descending
    return conversations.sort(
      (a, b) =>
        new Date(b.lastMessageAt).getTime() -
        new Date(a.lastMessageAt).getTime(),
    );
  }

  /**
   * Get messages for a specific conversation (by phone).
   */
  async getMessages(
    companyId: string,
    remotePhone: string,
    take = 50,
    skip = 0,
  ) {
    return this.prisma.whatsAppMessage.findMany({
      where: { companyId, remotePhone },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
      include: {
        partner: { select: { id: true, name: true } },
      },
    });
  }

  /**
   * Send a message and save to DB.
   */
  async sendAndSave(
    companyId: string,
    phone: string,
    message: string,
    mediaUrl?: string,
  ): Promise<any> {
    const fullPhone = this.formatPhone(phone);
    const storedPhone = fullPhone.replace(/^55/, '');

    // Find partner by phone
    const phoneSuffixes = this.getPhoneSuffixes(phone);
    const partner = await this.prisma.partner.findFirst({
      where: {
        companyId,
        phone: { in: phoneSuffixes },
        deletedAt: null,
      },
      select: { id: true },
    });

    // Send via Meta Cloud API
    let result: MetaMessageResponse | null;
    if (mediaUrl) {
      result = await this.sendMedia(companyId, phone, mediaUrl);
    } else {
      result = await this.sendText(companyId, phone, message);
    }

    const status = result ? 'SENT' : 'FAILED';
    const whatsappMsgId = result?.messages?.[0]?.id || null;

    // Save to DB
    const saved = await this.prisma.whatsAppMessage.create({
      data: {
        companyId,
        partnerId: partner?.id || null,
        remotePhone: storedPhone,
        direction: 'OUTBOUND',
        messageType: mediaUrl ? 'image' : 'text',
        content: message,
        whatsappMsgId,
        status,
      },
    });

    return saved;
  }

  /**
   * Mark messages as read for a conversation.
   */
  async markAsRead(companyId: string, remotePhone: string): Promise<void> {
    await this.prisma.whatsAppMessage.updateMany({
      where: {
        companyId,
        remotePhone,
        direction: 'INBOUND',
        status: 'RECEIVED',
      },
      data: { status: 'READ' },
    });
  }
}
