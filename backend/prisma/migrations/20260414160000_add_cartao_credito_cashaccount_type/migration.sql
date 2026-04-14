-- AlterEnum: Add CARTAO_CREDITO to CashAccountType
-- Contas virtuais criadas automaticamente quando um PaymentInstrument tipo cartao de credito e cadastrado.
-- Acumulam divida durante o ciclo da fatura ate serem quitadas via transferencia da conta bancaria.
ALTER TYPE "CashAccountType" ADD VALUE IF NOT EXISTS 'CARTAO_CREDITO';
