import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

export interface AdminSummary {
  totalUsers: number;
  totalOrganizations: number;
  totalSimulations: number;
  totalAnalyticsEntries: number;
  usersByPlan: { planName: string; count: number }[];
  estimatedMRR: number; // in euro cents
  simulationsLast30Days: number;
  topCountries: { countryCode: string; count: number }[];
  topInvestmentTypes: { investmentType: string; count: number; totalGrant: number }[];
  simulationTrend: { date: string; count: number }[];
}

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get full admin summary with aggregations for dashboard charts.
   */
  async getSummary(): Promise<AdminSummary> {
    const [
      totalUsers,
      totalOrganizations,
      totalSimulations,
      totalAnalyticsEntries,
      orgsByPlan,
      plans,
      simulationsLast30,
      topCountriesRaw,
      topInvestmentTypesRaw,
      trendRaw,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.organization.count(),
      this.prisma.calculation.count(),
      this.prisma.marketAnalytic.count(),
      this.prisma.organization.groupBy({
        by: ['planId'],
        _count: { id: true },
      }),
      this.prisma.plan.findMany({ select: { id: true, name: true, priceEuroCents: true } }),
      this.prisma.calculation.count({
        where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      }),
      this.prisma.marketAnalytic.groupBy({
        by: ['countryCode'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 6,
      }),
      this.prisma.marketAnalytic.groupBy({
        by: ['investmentType'],
        _count: { id: true },
        _sum: { estimatedGrant: true },
        orderBy: { _count: { id: 'desc' } },
      }),
      // Simulation trend: group by day for last 30 days
      this.prisma.$queryRaw<{ date: string; count: bigint }[]>`
        SELECT DATE(created_at) as date, COUNT(*)::bigint as count
        FROM calculations
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `.catch(() => [] as { date: string; count: bigint }[]),
    ]);

    // Build plan name map
    const planMap = new Map(plans.map((p) => [p.id, p]));

    // Users by plan
    const usersByPlan = orgsByPlan.map((group) => {
      const plan = group.planId ? planMap.get(group.planId) : null;
      return {
        planName: plan?.name ?? 'FREEMIUM',
        count: group._count.id,
      };
    });

    // Calculate estimated MRR
    let estimatedMRR = 0;
    for (const group of orgsByPlan) {
      const plan = group.planId ? planMap.get(group.planId) : null;
      estimatedMRR += (plan?.priceEuroCents ?? 0) * group._count.id;
    }

    return {
      totalUsers,
      totalOrganizations,
      totalSimulations,
      totalAnalyticsEntries,
      usersByPlan,
      estimatedMRR,
      simulationsLast30Days: simulationsLast30,
      topCountries: topCountriesRaw.map((r) => ({
        countryCode: r.countryCode,
        count: r._count.id,
      })),
      topInvestmentTypes: topInvestmentTypesRaw.map((r) => ({
        investmentType: r.investmentType,
        count: r._count.id,
        totalGrant: Number(r._sum.estimatedGrant ?? 0),
      })),
      simulationTrend: trendRaw.map((r) => ({
        date: String(r.date).slice(0, 10),
        count: Number(r.count),
      })),
    };
  }

  /**
   * List all users with their organizations and plan info.
   * Supports search by email/name and pagination.
   */
  async listUsers(params: {
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const { search, page = 1, limit = 50 } = params;
    const skip = (page - 1) * limit;

    const where = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' as const } },
            { firstName: { contains: search, mode: 'insensitive' as const } },
            { lastName: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: {
          organization: {
            include: { plan: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        createdAt: u.createdAt,
        organization: {
          id: u.organization.id,
          name: u.organization.name,
          countryCode: u.organization.countryCode,
          planName: u.organization.plan?.name ?? 'FREEMIUM',
          simulationsUsed: u.organization.simulationsUsedThisMonth,
        },
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Toggle (change) a user's organization plan.
   */
  async toggleUserPlan(userId: string, planName: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { organization: true },
    });

    const plan = await this.prisma.plan.findUnique({
      where: { name: planName },
    });

    if (!plan) {
      throw new Error(`Plan "${planName}" not found`);
    }

    return this.prisma.organization.update({
      where: { id: user.organizationId },
      data: {
        planId: plan.id,
        simulationsUsedThisMonth: 0,
        pdfExportsUsedThisMonth: 0,
        currentPeriodStart: new Date(),
      },
      include: { plan: true },
    });
  }
}
