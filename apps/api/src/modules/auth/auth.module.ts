import { Module } from '@nestjs/common';
import { ClerkAuthGuard } from '../../common/guards/clerk-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';

@Module({
  providers: [ClerkAuthGuard, TenantGuard],
  exports: [ClerkAuthGuard, TenantGuard],
})
export class AuthModule {}
