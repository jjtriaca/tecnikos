import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface EvolutionResponse {
  key?: { id?: string };
  status?: string;
  error?: boolean;
  message?: string;
}

export interface ConnectionState {
  state: string; // 'open' | 'close' | 'connecting'
  statusReason?: number;
}

export interface QRCodeResponse {
  pairingCode?: string;
  code?: string;
  base64?: string;
  count?: number;
}

@Injectable()
export class WhatsAppService implements OnModuleInit {
  private readonly logger = new Logger(WhatsAppService.name);

  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly instanceName: string;

  constructor(private readonly prisma: PrismaService) {
    this.apiUrl = process.env.EVOLUTION_API_URL || 'http://evolution:8080';
    this.apiKey = process.env.EVOLUTION_API_KEY || 'tecnikos-evo-secret-2026';
    this.instanceName = process.env.EVOLUTION_INSTANCE_NAME || 'tecnikos';
  }

  async onModuleInit() {
    // Try to create the instance on startup (idempotent)
    try {
      await this.createInstance();
      this.logger.log(`WhatsApp instance "${this.instanceName}" initialized`);

      // Auto-configure webhook
      const domain = process.env.DOMAIN || 'tecnikos.com.br';
      const webhookUrl = `https://${domain}/api/whatsapp/webhook`;
      await this.configureWebhook(webhookUrl);
    } catch (err) {
      this.logger.warn(`WhatsApp init: ${err.message} (will retry on first use)`);
    }
  }

  // ── Instance Management ─────────────────────────────────────

  /**
   * Create a WhatsApp instance in Evolution API (idempotent).
   * If instance already exists, returns success silently.
   */
  async createInstance(): Promise<any> {
    try {
      const res = await this.request('POST', '/instance/create', {
        instanceName: this.instanceName,
        integration: 'WHATSAPP-BAILEYS',
        qrcode: true,
        rejectCall: false,
        groupsIgnore: true,
        alwaysOnline: false,
        readMessages: false,
        readStatus: false,
        syncFullHistory: false,
      });
      return res;
    } catch (err) {
      // If instance already exists (403 "already in use"), that's fine
      if (err.message?.includes('already in use') || err.message?.includes('403')) {
        this.logger.log(`Instance "${this.instanceName}" already exists — OK`);
        return { instance: this.instanceName, status: 'already_exists' };
      }
      throw err;
    }
  }

  /**
   * Get QR code to pair WhatsApp.
   */
  async getQRCode(): Promise<QRCodeResponse> {
    const res = await this.request('GET', `/instance/connect/${this.instanceName}`);
    return res as QRCodeResponse;
  }

  /**
   * Get the connection status.
   */
  async getConnectionStatus(): Promise<ConnectionState> {
    try {
      const res = await this.request('GET', `/instance/connectionState/${this.instanceName}`);
      return (res?.instance || res) as ConnectionState;
    } catch {
      return { state: 'close' };
    }
  }

  /**
   * Check if WhatsApp is connected.
   */
  async isConnected(): Promise<boolean> {
    const status = await this.getConnectionStatus();
    return status?.state === 'open';
  }

  /**
   * Logout / disconnect WhatsApp.
   */
  async logout(): Promise<void> {
    await this.request('DELETE', `/instance/logout/${this.instanceName}`);
    this.logger.log('WhatsApp disconnected');
  }

  /**
   * Restart the instance.
   */
  async restart(): Promise<void> {
    await this.request('PUT', `/instance/restart/${this.instanceName}`);
  }

  // ── Sending Messages ────────────────────────────────────────

  /**
   * Send a text message via WhatsApp.
   * @param phone Brazilian phone (e.g. "65999887766" or "5565999887766")
   * @param message Text to send
   */
  async sendText(phone: string, message: string): Promise<EvolutionResponse | null> {
    const formattedPhone = this.formatPhone(phone);

    try {
      const res = await this.request('POST', `/message/sendText/${this.instanceName}`, {
        number: formattedPhone,
        text: message,
      });

      this.logger.log(`WhatsApp sent to ${formattedPhone}: ${message.substring(0, 50)}...`);
      return res as EvolutionResponse;
    } catch (err) {
      this.logger.error(`WhatsApp send failed to ${formattedPhone}: ${err.message}`);
      return null;
    }
  }

  /**
   * Send media (image, document, audio) via WhatsApp.
   */
  async sendMedia(
    phone: string,
    mediaUrl: string,
    caption?: string,
    mediaType: 'image' | 'document' | 'audio' = 'image',
  ): Promise<EvolutionResponse | null> {
    const formattedPhone = this.formatPhone(phone);

    try {
      const res = await this.request('POST', `/message/sendMedia/${this.instanceName}`, {
        number: formattedPhone,
        media: mediaUrl,
        mediatype: mediaType,
        caption: caption || '',
      });

      this.logger.log(`WhatsApp media sent to ${formattedPhone} (${mediaType})`);
      return res as EvolutionResponse;
    } catch (err) {
      this.logger.error(`WhatsApp media send failed to ${formattedPhone}: ${err.message}`);
      return null;
    }
  }

  // ── Webhook — Process Incoming Messages ─────────────────────

  /**
   * Process webhook event from Evolution API.
   * Called by the controller on POST /whatsapp/webhook
   */
  async processWebhook(body: any): Promise<void> {
    const event = body.event;

    if (event === 'messages.upsert') {
      await this.handleIncomingMessage(body.data);
    } else if (event === 'messages.update') {
      await this.handleMessageStatusUpdate(body.data);
    } else if (event === 'connection.update') {
      this.logger.log(`WhatsApp connection: ${JSON.stringify(body.data?.state || body.data)}`);
    }
  }

  /**
   * Handle incoming WhatsApp message — save to DB.
   */
  private async handleIncomingMessage(data: any): Promise<void> {
    if (!data || data.key?.fromMe) return; // Ignore own messages

    const remotePhone = data.key?.remoteJid?.replace('@s.whatsapp.net', '') || '';
    if (!remotePhone || remotePhone.includes('@g.us')) return; // Ignore groups

    const messageType = this.detectMessageType(data.message);
    const content = this.extractContent(data.message, messageType);

    if (!content) return;

    this.logger.log(`WhatsApp received from ${remotePhone}: ${content.substring(0, 50)}`);

    // Find partner by phone number (try multiple formats)
    const phoneSuffixes = this.getPhoneSuffixes(remotePhone);

    // Look for partner in any company
    const partner = await this.prisma.partner.findFirst({
      where: {
        phone: { in: phoneSuffixes },
        deletedAt: null,
      },
      select: { id: true, companyId: true, name: true },
    });

    const companyId = partner?.companyId;

    // Only save if we can associate with a company
    if (!companyId) {
      this.logger.warn(`WhatsApp from unknown phone ${remotePhone} — no partner found`);
      return;
    }

    await this.prisma.whatsAppMessage.create({
      data: {
        companyId,
        partnerId: partner?.id || null,
        remotePhone,
        direction: 'INBOUND',
        messageType,
        content,
        whatsappMsgId: data.key?.id || null,
        status: 'RECEIVED',
      },
    });
  }

  /**
   * Handle message status updates (delivered, read).
   */
  private async handleMessageStatusUpdate(data: any): Promise<void> {
    if (!data?.key?.id) return;

    const statusMap: Record<number, string> = {
      2: 'DELIVERED',
      3: 'READ',
      4: 'READ',
    };

    const newStatus = statusMap[data.update?.status];
    if (!newStatus) return;

    await this.prisma.whatsAppMessage.updateMany({
      where: { whatsappMsgId: data.key.id },
      data: { status: newStatus },
    });
  }

  // ── Phone Formatting ────────────────────────────────────────

  /**
   * Format Brazilian phone number for WhatsApp.
   * Input: "65999887766", "(65) 99988-7766", "5565999887766"
   * Output: "5565999887766"
   */
  formatPhone(phone: string): string {
    // Remove everything except digits
    let digits = phone.replace(/\D/g, '');

    // Already has country code
    if (digits.startsWith('55') && digits.length >= 12) {
      return digits;
    }

    // Has DDD but no country code
    if (digits.length === 10 || digits.length === 11) {
      return '55' + digits;
    }

    // Just the number without DDD (shouldn't happen, but handle it)
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
        suffixes.add(withoutCountry.substring(0, 2) + withoutCountry.substring(3)); // remove 9th digit
      } else if (withoutCountry.length === 10) {
        suffixes.add(withoutCountry.substring(0, 2) + '9' + withoutCountry.substring(2)); // add 9th digit
      }
    }

    // Add formatted variations
    for (const s of [...suffixes]) {
      if (s.length === 10 || s.length === 11) {
        const ddd = s.substring(0, 2);
        const num = s.substring(2);
        suffixes.add(`(${ddd}) ${num.substring(0, num.length - 4)}-${num.substring(num.length - 4)}`);
        suffixes.add(`(${ddd})${num}`);
        suffixes.add(`${ddd}${num}`);
      }
    }

    return [...suffixes];
  }

  // ── Message Content Extraction ──────────────────────────────

  private detectMessageType(msg: any): string {
    if (!msg) return 'text';
    if (msg.conversation || msg.extendedTextMessage) return 'text';
    if (msg.imageMessage) return 'image';
    if (msg.documentMessage || msg.documentWithCaptionMessage) return 'document';
    if (msg.audioMessage) return 'audio';
    if (msg.videoMessage) return 'video';
    if (msg.locationMessage) return 'location';
    if (msg.contactMessage || msg.contactsArrayMessage) return 'contact';
    if (msg.stickerMessage) return 'sticker';
    return 'text';
  }

  private extractContent(msg: any, type: string): string {
    if (!msg) return '';

    switch (type) {
      case 'text':
        return msg.conversation || msg.extendedTextMessage?.text || '';
      case 'image':
        return msg.imageMessage?.caption || '[Imagem]';
      case 'document':
        return msg.documentMessage?.fileName || msg.documentWithCaptionMessage?.message?.documentMessage?.fileName || '[Documento]';
      case 'audio':
        return '[Áudio]';
      case 'video':
        return msg.videoMessage?.caption || '[Vídeo]';
      case 'location':
        return `📍 ${msg.locationMessage?.degreesLatitude},${msg.locationMessage?.degreesLongitude}`;
      case 'contact':
        return msg.contactMessage?.displayName || '[Contato]';
      case 'sticker':
        return '[Figurinha]';
      default:
        return '';
    }
  }

  // ── HTTP Helper ─────────────────────────────────────────────

  private async request(method: string, path: string, body?: any): Promise<any> {
    const url = `${this.apiUrl}${path}`;

    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        apikey: this.apiKey,
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const res = await fetch(url, options);

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Evolution API ${method} ${path} → ${res.status}: ${text}`);
    }

    return res.json().catch(() => ({}));
  }

  // ── Chat / Conversation Methods ─────────────────────────────

  /**
   * List conversations for a company (grouped by phone).
   */
  async listConversations(companyId: string, search?: string) {
    // Get all messages for the company, grouped by phone
    // Using Prisma instead of raw SQL for better compatibility
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
      (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
    );
  }

  /**
   * Get messages for a specific conversation (by phone).
   */
  async getMessages(companyId: string, remotePhone: string, take = 50, skip = 0) {
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
    const remotePhone = this.formatPhone(phone).replace('55', '');
    const fullPhone = this.formatPhone(phone);

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

    // Send via Evolution API
    let result: EvolutionResponse | null;
    if (mediaUrl) {
      result = await this.sendMedia(phone, mediaUrl);
    } else {
      result = await this.sendText(phone, message);
    }

    const status = result ? 'SENT' : 'FAILED';

    // Save to DB
    const saved = await this.prisma.whatsAppMessage.create({
      data: {
        companyId,
        partnerId: partner?.id || null,
        remotePhone: fullPhone.replace(/^55/, ''),
        direction: 'OUTBOUND',
        messageType: mediaUrl ? 'image' : 'text',
        content: message,
        whatsappMsgId: result?.key?.id || null,
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

  /**
   * Set webhook URL in Evolution API for this instance.
   */
  async configureWebhook(webhookUrl: string): Promise<void> {
    await this.request('POST', `/webhook/set/${this.instanceName}`, {
      webhook: {
        enabled: true,
        url: webhookUrl,
        webhookByEvents: false,
        webhookBase64: false,
        events: [
          'MESSAGES_UPSERT',
          'MESSAGES_UPDATE',
          'CONNECTION_UPDATE',
        ],
      },
    });
    this.logger.log(`Webhook configured: ${webhookUrl}`);
  }
}
