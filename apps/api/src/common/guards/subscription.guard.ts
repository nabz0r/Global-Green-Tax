import {
  CanActivate,
  ExecutionContext,
  Injectable,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { SubscriptionService } from '../../modules/subscription/subscription.service';
import type { Request } from 'express';

/**
 * Guard that enforces simulation quotas based on the organization's subscription plan.
 * Must be used after ClerkAuthGuard and TenantGuard (needs tenant context).
 *
 * Returns 402 Payment Required when the quota is exceeded, with details
 * about current usage, limits, and the plan name.
 */
@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const tenant = (request as any).tenant;

    if (!tenant?.organizationId) {
      return true; // Let TenantGuard handle missing tenant
    }

    const quota = await this.subscriptionService.checkSimulationQuota(
      tenant.organizationId,
    );

    if (!quota.allowed) {
      throw new HttpException(
        {
          statusCode: HttpStatus.PAYMENT_REQUIRED,
          error: 'Quota exceeded',
          message: `Votre plan ${quota.planName} autorise ${quota.limit} simulations par mois. Vous avez utilisé ${quota.currentUsage}/${quota.limit}. Passez au plan supérieur pour continuer.`,
          currentUsage: quota.currentUsage,
          limit: quota.limit,
          planName: quota.planName,
          upgradeUrl: '/dashboard/settings?tab=plan',
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    // Store quota info on request for downstream use
    (request as any).subscriptionQuota = quota;

    return true;
  }
}
