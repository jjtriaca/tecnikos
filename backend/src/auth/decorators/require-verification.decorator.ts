import { SetMetadata } from '@nestjs/common';
import { REQUIRE_VERIFICATION_KEY } from '../guards/verification.guard';

/**
 * Decorator that marks an endpoint as requiring document verification approval.
 * When applied, the VerificationGuard will block access if the tenant's documents
 * have not been approved by admin.
 *
 * Usage:
 * @RequireVerification()
 * @Post()
 * create() { ... }
 */
export const RequireVerification = () => SetMetadata(REQUIRE_VERIFICATION_KEY, true);
