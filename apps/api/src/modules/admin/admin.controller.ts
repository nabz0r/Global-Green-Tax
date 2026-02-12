import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { ClerkAuthGuard } from '../../common/guards/clerk-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';

@Controller('api/admin')
@UseGuards(ClerkAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /**
   * GET /api/admin/analytics/summary
   * Full dashboard aggregation: MRR, user counts, simulation trends, top countries.
   */
  @Get('analytics/summary')
  async getAnalyticsSummary() {
    return this.adminService.getSummary();
  }

  /**
   * GET /api/admin/users?search=&page=&limit=
   * Paginated user list with org + plan info.
   */
  @Get('users')
  async listUsers(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.listUsers({
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  /**
   * POST /api/admin/users/:id/toggle-plan
   * Change a user's organization plan (for customer support).
   */
  @Post('users/:id/toggle-plan')
  async togglePlan(
    @Param('id') userId: string,
    @Body() body: { planName: string },
  ) {
    if (!body.planName) {
      throw new BadRequestException('planName is required');
    }

    return this.adminService.toggleUserPlan(userId, body.planName);
  }
}
