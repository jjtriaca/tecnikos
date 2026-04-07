import { Injectable } from '@nestjs/common';
import { BoletoProvider, BankConfigField } from './boleto-provider.interface';
import { BankInterProvider } from './bank-inter.provider';
import { BankSicrediProvider } from './bank-sicredi.provider';

@Injectable()
export class BankProviderFactory {
  private readonly providers: Map<string, BoletoProvider>;

  constructor(
    private readonly interProvider: BankInterProvider,
    private readonly sicrediProvider: BankSicrediProvider,
  ) {
    this.providers = new Map<string, BoletoProvider>([
      ['077', interProvider],
      ['748', sicrediProvider],
    ]);
  }

  getProvider(bankCode: string): BoletoProvider | null {
    return this.providers.get(bankCode) || null;
  }

  getSupportedBanks(): { code: string; name: string; fields: BankConfigField[] }[] {
    return Array.from(this.providers.entries()).map(([code, provider]) => ({
      code,
      name: provider.bankName,
      fields: provider.getRequiredFields(),
    }));
  }

  getAllBankCodes(): string[] {
    return Array.from(this.providers.keys());
  }
}
