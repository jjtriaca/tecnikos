import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailController } from './email.controller';
import { EncryptionService } from '../common/encryption.service';

@Module({
  controllers: [EmailController],
  providers: [EmailService, EncryptionService],
  exports: [EmailService],
})
export class EmailModule {}
