import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Req,
  UsePipes,
  Query,
} from '@nestjs/common';
import { TaxService } from './tax.service';
import { ClerkAuthGuard } from '../../common/guards/clerk-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { SubscriptionGuard } from '../../common/guards/subscription.guard';
import { SubscriptionService } from '../subscription/subscription.service';
import { ZodValidationPipe } from '../../common/middleware/zod-validation.pipe';
import { TaxCalculationRequestSchema } from '@ggt/shared';
import type { Request } from 'express';

@Controller('api/v1/tax')
@UseGuards(ClerkAuthGuard, TenantGuard)
export class TaxController {
  constructor(
    private readonly taxService: TaxService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  @Post('calculate')
  @UseGuards(SubscriptionGuard)
  @UsePipes(new ZodValidationPipe(TaxCalculationRequestSchema))
  async calculate(@Body() body: any, @Req() req: Request) {
    const tenant = (req as any).tenant;
    const result = await this.taxService.calculate(
      tenant.organizationId,
      tenant.countryCode,
      body,
      tenant.userId,
    );

    // Increment usage counter after successful calculation
    await this.subscriptionService.incrementSimulationUsage(
      tenant.organizationId,
    );

    return result;
  }

  @Get('history')
  async getHistory(
    @Req() req: Request,
    @Query('limit') limit?: string,
  ) {
    const tenant = (req as any).tenant;
    return this.taxService.getHistory(
      tenant.organizationId,
      limit ? parseInt(limit, 10) : undefined,
    );
  }
}
