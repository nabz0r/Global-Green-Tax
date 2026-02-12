import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { ClerkAuthGuard } from '../../common/guards/clerk-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import type { Request } from 'express';

@Controller('api/v1/subscription')
@UseGuards(ClerkAuthGuard, TenantGuard)
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  /**
   * GET /api/v1/subscription/plan
   * Returns the current plan and usage for the authenticated organization.
   */
  @Get('plan')
  async getCurrentPlan(@Req() req: Request) {
    const tenant = (req as any).tenant;
    return this.subscriptionService.getOrganizationPlan(tenant.organizationId);
  }

  /**
   * GET /api/v1/subscription/plans
   * Returns all available subscription plans.
   */
  @Get('plans')
  async listPlans() {
    return this.subscriptionService.listPlans();
  }

  /**
   * GET /api/v1/subscription/quota/simulations
   * Check current simulation quota status.
   */
  @Get('quota/simulations')
  async checkSimulationQuota(@Req() req: Request) {
    const tenant = (req as any).tenant;
    return this.subscriptionService.checkSimulationQuota(tenant.organizationId);
  }

  /**
   * GET /api/v1/subscription/quota/pdf-exports
   * Check current PDF export quota status.
   */
  @Get('quota/pdf-exports')
  async checkPdfExportQuota(@Req() req: Request) {
    const tenant = (req as any).tenant;
    return this.subscriptionService.checkPdfExportQuota(tenant.organizationId);
  }

  /**
   * POST /api/v1/subscription/change-plan
   * Change the organization's subscription plan (OWNER/ADMIN only).
   */
  @Post('change-plan')
  async changePlan(
    @Req() req: Request,
    @Body() body: { planName: string },
  ) {
    const tenant = (req as any).tenant;

    if (!['OWNER', 'ADMIN'].includes(tenant.role)) {
      throw new BadRequestException(
        'Only organization owners and admins can change the subscription plan.',
      );
    }

    if (!body.planName) {
      throw new BadRequestException('planName is required');
    }

    return this.subscriptionService.changePlan(
      tenant.organizationId,
      body.planName,
    );
  }
}
