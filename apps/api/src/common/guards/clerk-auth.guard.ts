import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createClerkClient } from '@clerk/backend';
import type { Request } from 'express';

const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY ?? '',
});

/**
 * Guard that verifies Clerk JWT tokens from the Authorization header.
 * Attaches the authenticated userId to the request object.
 */
@Injectable()
export class ClerkAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization header');
    }

    const token = authHeader.slice(7);

    try {
      const payload = await clerk.verifyToken(token);
      (request as any).userId = payload.sub;
      (request as any).clerkAuth = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
