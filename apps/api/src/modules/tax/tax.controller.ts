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
import { ZodValidationPipe } from '../../common/middleware/zod-validation.pipe';
import { TaxCalculationRequestSchema } from '@ggt/shared';
import type { Request } from 'express';

@Controller('api/v1/tax')
@UseGuards(ClerkAuthGuard, TenantGuard)
export class TaxController {
  constructor(private readonly taxService: TaxService) {}

  @Post('calculate')
  @UsePipes(new ZodValidationPipe(TaxCalculationRequestSchema))
  async calculate(@Body() body: any, @Req() req: Request) {
    const tenant = (req as any).tenant;
    return this.taxService.calculate(
      tenant.organizationId,
      tenant.countryCode,
      body,
    );
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
