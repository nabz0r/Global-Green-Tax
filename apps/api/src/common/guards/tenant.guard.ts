import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import type { Request } from 'express';

/**
 * Guard that resolves the authenticated user's organization
 * and attaches tenant context to the request.
 * Must be used after ClerkAuthGuard.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const clerkId = (request as any).userId;

    if (!clerkId) {
      throw new ForbiddenException('Authentication required');
    }

    const user = await this.prisma.user.findUnique({
      where: { clerkId },
      include: { organization: true },
    });

    if (!user) {
      throw new ForbiddenException('User not found. Please complete onboarding.');
    }

    (request as any).tenant = {
      userId: user.id,
      organizationId: user.organizationId,
      countryCode: user.organization.countryCode,
      role: user.role,
    };

    return true;
  }
}
