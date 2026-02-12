import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import type { Request } from 'express';

/**
 * Guard that restricts access to platform administrators only.
 * Checks the user's role in the database (must be ADMIN or OWNER).
 * Must be used after ClerkAuthGuard (needs userId on request).
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const clerkId = (request as any).userId;

    if (!clerkId) {
      throw new ForbiddenException('Authentication required');
    }

    const user = await this.prisma.user.findUnique({
      where: { clerkId },
      select: { role: true, id: true, organizationId: true },
    });

    if (!user) {
      throw new ForbiddenException('User not found');
    }

    if (user.role !== 'ADMIN' && user.role !== 'OWNER') {
      throw new ForbiddenException(
        'Accès refusé. Seuls les administrateurs peuvent accéder à cette ressource.',
      );
    }

    // Attach admin context to request
    (request as any).adminUser = {
      userId: user.id,
      organizationId: user.organizationId,
      role: user.role,
    };

    return true;
  }
}
