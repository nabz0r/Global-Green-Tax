import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

export interface QuotaCheckResult {
  allowed: boolean;
  currentUsage: number;
  limit: number | null; // null = unlimited
  planName: string;
}

export interface PlanWithUsage {
  planName: string;
  displayName: string;
  priceEuroCents: number;
  limits: {
    maxSimulationsPerMonth: number | null;
    maxPdfExportsPerMonth: number | null;
    maxCountries: number | null;
    maxUsers: number | null;
    whiteLabel: boolean;
    apiAccess: boolean;
    ssoEnabled: boolean;
    fiscalDeepDive: boolean;
  };
  usage: {
    simulationsUsedThisMonth: number;
    pdfExportsUsedThisMonth: number;
    currentPeriodStart: Date;
  };
}

/** Default limits for orgs with no plan assigned (FREEMIUM fallback). */
const FREEMIUM_DEFAULTS = {
  planName: 'FREEMIUM' as const,
  displayName: 'Freemium',
  priceEuroCents: 0,
  limits: {
    maxSimulationsPerMonth: 3,
    maxPdfExportsPerMonth: 0, // PDF export blocked
    maxCountries: 1,
    maxUsers: 1,
    whiteLabel: false,
    apiAccess: false,
    ssoEnabled: false,
    fiscalDeepDive: false,
  },
};

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get full plan details and current usage for an organization.
   */
  async getOrganizationPlan(organizationId: string): Promise<PlanWithUsage> {
    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      include: { plan: true },
    });

    const plan = org.plan;

    // If no plan assigned, default to FREEMIUM limits
    if (!plan) {
      return {
        ...FREEMIUM_DEFAULTS,
        usage: {
          simulationsUsedThisMonth: org.simulationsUsedThisMonth,
          pdfExportsUsedThisMonth: org.pdfExportsUsedThisMonth,
          currentPeriodStart: org.currentPeriodStart,
        },
      };
    }

    return {
      planName: plan.name,
      displayName: plan.displayName,
      priceEuroCents: plan.priceEuroCents,
      limits: {
        maxSimulationsPerMonth: plan.maxSimulationsPerMonth,
        maxPdfExportsPerMonth: plan.maxPdfExportsPerMonth,
        maxCountries: plan.maxCountries,
        maxUsers: plan.maxUsers,
        whiteLabel: plan.whiteLabel,
        apiAccess: plan.apiAccess,
        ssoEnabled: plan.ssoEnabled,
        fiscalDeepDive: plan.fiscalDeepDive,
      },
      usage: {
        simulationsUsedThisMonth: org.simulationsUsedThisMonth,
        pdfExportsUsedThisMonth: org.pdfExportsUsedThisMonth,
        currentPeriodStart: org.currentPeriodStart,
      },
    };
  }

  /**
   * Check whether the organization can perform another simulation.
   * Automatically resets monthly counters if the billing period has rolled over.
   */
  async checkSimulationQuota(organizationId: string): Promise<QuotaCheckResult> {
    await this.maybeResetPeriod(organizationId);

    const planData = await this.getOrganizationPlan(organizationId);
    const limit = planData.limits.maxSimulationsPerMonth;
    const currentUsage = planData.usage.simulationsUsedThisMonth;

    // null limit = unlimited
    const allowed = limit === null || currentUsage < limit;

    return {
      allowed,
      currentUsage,
      limit,
      planName: planData.planName,
    };
  }

  /**
   * Check whether the organization can export a PDF.
   * FREEMIUM plans get 0 exports → always blocked.
   */
  async checkPdfExportQuota(organizationId: string): Promise<QuotaCheckResult> {
    await this.maybeResetPeriod(organizationId);

    const planData = await this.getOrganizationPlan(organizationId);
    const limit = planData.limits.maxPdfExportsPerMonth;
    const currentUsage = planData.usage.pdfExportsUsedThisMonth;

    // limit === 0 means feature is completely blocked (FREEMIUM)
    const allowed = limit === null ? true : limit > 0 && currentUsage < limit;

    return {
      allowed,
      currentUsage,
      limit,
      planName: planData.planName,
    };
  }

  /**
   * Guard: throws 403 if PDF export is not available on the plan.
   */
  async assertPdfExportAllowed(organizationId: string): Promise<void> {
    const quota = await this.checkPdfExportQuota(organizationId);
    if (!quota.allowed) {
      throw new ForbiddenException({
        error: 'Upgrade Required',
        message: `L'export PDF n'est pas disponible sur le plan ${quota.planName}. Passez au plan Starter ou supérieur.`,
        feature: 'PDF_EXPORT',
        planName: quota.planName,
        upgradeUrl: '/dashboard/settings?tab=plan',
      });
    }
  }

  /**
   * Guard: throws 403 if Fiscal Deep Dive is not available on the plan.
   */
  async assertFiscalDeepDiveAllowed(organizationId: string): Promise<void> {
    const planData = await this.getOrganizationPlan(organizationId);
    if (!planData.limits.fiscalDeepDive) {
      throw new ForbiddenException({
        error: 'Upgrade Required',
        message: `L'analyse fiscale approfondie n'est pas disponible sur le plan ${planData.planName}. Passez au plan Professional ou supérieur.`,
        feature: 'FISCAL_DEEP_DIVE',
        planName: planData.planName,
        upgradeUrl: '/dashboard/settings?tab=plan',
      });
    }
  }

  /**
   * Increment the simulation usage counter after a successful calculation.
   */
  async incrementSimulationUsage(organizationId: string): Promise<void> {
    await this.prisma.organization.update({
      where: { id: organizationId },
      data: { simulationsUsedThisMonth: { increment: 1 } },
    });
    this.logger.debug(`Incremented simulation usage for org ${organizationId}`);
  }

  /**
   * Increment the PDF export usage counter.
   */
  async incrementPdfExportUsage(organizationId: string): Promise<void> {
    await this.prisma.organization.update({
      where: { id: organizationId },
      data: { pdfExportsUsedThisMonth: { increment: 1 } },
    });
    this.logger.debug(`Incremented PDF export usage for org ${organizationId}`);
  }

  /**
   * Change an organization's plan.
   * Resets usage counters when upgrading/downgrading.
   */
  async changePlan(organizationId: string, planName: string) {
    const plan = await this.prisma.plan.findUnique({
      where: { name: planName },
    });

    if (!plan) {
      throw new Error(`Plan "${planName}" not found`);
    }

    const updated = await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        planId: plan.id,
        simulationsUsedThisMonth: 0,
        pdfExportsUsedThisMonth: 0,
        currentPeriodStart: new Date(),
      },
      include: { plan: true },
    });

    this.logger.log(`Organization ${organizationId} changed plan to ${planName}`);
    return updated;
  }

  /**
   * List all available plans.
   */
  async listPlans() {
    return this.prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { priceEuroCents: 'asc' },
    });
  }

  /**
   * Reset monthly usage counters if the billing period has rolled over.
   * Called automatically before every quota check.
   */
  private async maybeResetPeriod(organizationId: string): Promise<void> {
    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { currentPeriodStart: true },
    });

    const periodStart = new Date(org.currentPeriodStart);
    const now = new Date();

    const monthsDiff =
      (now.getFullYear() - periodStart.getFullYear()) * 12 +
      (now.getMonth() - periodStart.getMonth());

    if (monthsDiff >= 1) {
      await this.prisma.organization.update({
        where: { id: organizationId },
        data: {
          simulationsUsedThisMonth: 0,
          pdfExportsUsedThisMonth: 0,
          currentPeriodStart: new Date(now.getFullYear(), now.getMonth(), 1),
        },
      });
      this.logger.log(`Reset monthly usage counters for org ${organizationId}`);
    }
  }
}
