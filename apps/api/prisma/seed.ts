import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

/** Load a country JSON schema from data/schemas/ */
function loadSchema(code: string): any {
  const filePath = path.resolve(__dirname, `../../../data/schemas/${code}-2026.json`);
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

async function main() {
  console.log('Seeding Global Green Tax database...\n');

  // ─── Seed subscription plans ────────────────────────────────────
  const plans = [
    {
      id: '00000000-0000-0000-0000-plan00000000',
      name: 'FREEMIUM',
      displayName: 'Freemium',
      priceEuroCents: 0,
      maxSimulationsPerMonth: 3,
      maxPdfExportsPerMonth: 0, // blocked
      maxCountries: 1,
      maxUsers: 1,
      whiteLabel: false,
      apiAccess: false,
      ssoEnabled: false,
      fiscalDeepDive: false,
    },
    {
      id: '00000000-0000-0000-0000-plan00000001',
      name: 'STARTER',
      displayName: 'Starter',
      priceEuroCents: 9900,
      maxSimulationsPerMonth: 5,
      maxPdfExportsPerMonth: 5,
      maxCountries: 1,
      maxUsers: 2,
      whiteLabel: false,
      apiAccess: false,
      ssoEnabled: false,
      fiscalDeepDive: false,
    },
    {
      id: '00000000-0000-0000-0000-plan00000002',
      name: 'PROFESSIONAL',
      displayName: 'Professional',
      priceEuroCents: 49900,
      maxSimulationsPerMonth: null,
      maxPdfExportsPerMonth: null,
      maxCountries: null,
      maxUsers: 10,
      whiteLabel: true,
      apiAccess: true,
      ssoEnabled: false,
      fiscalDeepDive: true,
    },
    {
      id: '00000000-0000-0000-0000-plan00000003',
      name: 'ENTERPRISE',
      displayName: 'Enterprise',
      priceEuroCents: 0, // Custom pricing
      maxSimulationsPerMonth: null,
      maxPdfExportsPerMonth: null,
      maxCountries: null,
      maxUsers: null,
      whiteLabel: true,
      apiAccess: true,
      ssoEnabled: true,
      fiscalDeepDive: true,
    },
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { name: plan.name },
      update: {
        displayName: plan.displayName,
        priceEuroCents: plan.priceEuroCents,
        maxSimulationsPerMonth: plan.maxSimulationsPerMonth,
        maxPdfExportsPerMonth: plan.maxPdfExportsPerMonth,
        maxCountries: plan.maxCountries,
        maxUsers: plan.maxUsers,
        whiteLabel: plan.whiteLabel,
        apiAccess: plan.apiAccess,
        ssoEnabled: plan.ssoEnabled,
        fiscalDeepDive: plan.fiscalDeepDive,
      },
      create: plan,
    });
    console.log(`  Plan: ${plan.displayName} (${plan.priceEuroCents / 100}€/mois) ✓`);
  }

  // ─── Load all 6 country schemas ──────────────────────────────────
  const schemas: Record<string, any> = {};
  for (const code of ['LU', 'FR', 'DE', 'BE', 'ES', 'PT']) {
    schemas[code] = loadSchema(code);
    console.log(`  Loaded: ${schemas[code].metadata.countryName} (${code}) – FY${schemas[code].metadata.fiscalYear}`);
  }

  // ─── Upsert all active countries ─────────────────────────────────
  const countryDefs = [
    { code: 'LU', name: 'Luxembourg', currency: 'EUR' },
    { code: 'FR', name: 'France', currency: 'EUR' },
    { code: 'DE', name: 'Germany', currency: 'EUR' },
    { code: 'BE', name: 'Belgium', currency: 'EUR' },
    { code: 'ES', name: 'Spain', currency: 'EUR' },
    { code: 'PT', name: 'Portugal', currency: 'EUR' },
  ];

  for (const def of countryDefs) {
    await prisma.country.upsert({
      where: { code: def.code },
      update: {
        taxRules: schemas[def.code],
        isActive: true,
        updatedAt: new Date(),
      },
      create: {
        code: def.code,
        name: def.name,
        currency: def.currency,
        isActive: true,
        taxRules: schemas[def.code],
      },
    });
    console.log(`  Country: ${def.name} (${def.code}) ✓`);
  }

  // ─── Seed additional countries (stubs for future strategies) ────
  const futureCountries = [
    { code: 'NL', name: 'Netherlands', currency: 'EUR' },
    { code: 'CH', name: 'Switzerland', currency: 'CHF' },
  ];

  for (const country of futureCountries) {
    await prisma.country.upsert({
      where: { code: country.code },
      update: {},
      create: {
        code: country.code,
        name: country.name,
        currency: country.currency,
        isActive: false,
      },
    });
    console.log(`  Country: ${country.name} (${country.code}) – inactive stub ✓`);
  }

  // ─── Seed demo organizations ──────────────────────────────────────
  const freemiumPlanId = plans[0].id;
  const starterPlanId = plans[1].id;
  const proPlanId = plans[2].id;
  const enterprisePlanId = plans[3].id;

  const orgs = [
    { id: '00000000-0000-0000-0000-000000000001', name: 'GreenTech Luxembourg SARL', code: 'LU', vat: 'LU12345678', sector: 'Technology', planId: proPlanId },
    { id: '00000000-0000-0000-0000-000000000002', name: 'ÉcoSolutions France SAS', code: 'FR', vat: 'FR12345678901', sector: 'Energy', planId: proPlanId },
    { id: '00000000-0000-0000-0000-000000000003', name: 'GrünTech Deutschland GmbH', code: 'DE', vat: 'DE123456789', sector: 'Manufacturing', planId: enterprisePlanId },
    { id: '00000000-0000-0000-0000-000000000004', name: 'EcoVlaanderen NV', code: 'BE', vat: 'BE0123456789', sector: 'Logistics', planId: starterPlanId },
    { id: '00000000-0000-0000-0000-000000000005', name: 'SolEnergia España SL', code: 'ES', vat: 'ESB12345678', sector: 'Energy', planId: starterPlanId },
    { id: '00000000-0000-0000-0000-000000000006', name: 'VerdePortugal Lda', code: 'PT', vat: 'PT123456789', sector: 'Agriculture', planId: freemiumPlanId },
  ];

  for (const org of orgs) {
    await prisma.organization.upsert({
      where: { id: org.id },
      update: { planId: org.planId },
      create: {
        id: org.id,
        name: org.name,
        countryCode: org.code,
        vatNumber: org.vat,
        sector: org.sector,
        planId: org.planId,
        simulationsUsedThisMonth: 0,
        pdfExportsUsedThisMonth: 0,
        currentPeriodStart: new Date(),
      },
    });
    console.log(`  Demo Org: ${org.name} ✓`);
  }

  // ─── Seed demo user (linked to Clerk placeholder) ──────────────
  const demoUser = await prisma.user.upsert({
    where: { clerkId: 'user_demo_clerk_id' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000010',
      clerkId: 'user_demo_clerk_id',
      email: 'demo@global-green-tax.com',
      firstName: 'Demo',
      lastName: 'User',
      role: 'OWNER',
      organizationId: orgs[0].id,
    },
  });
  console.log(`\n  Demo User: ${demoUser.email} (${demoUser.role}) ✓`);

  // ─── Seed sample calculations ─────────────────────────────────────
  const calculations = [
    {
      id: '00000000-0000-0000-0000-000000000100',
      orgId: orgs[0].id,
      countryCode: 'LU',
      input: {
        organizationId: orgs[0].id, countryCode: 'LU', fiscalYear: 2026,
        co2Tonnes: 1200, revenue: 8_000_000, employeeCount: 45,
        energyConsumptionKwh: 350_000, renewableEnergyPercent: 65,
        emissionsByScope: { SCOPE_1: 720, SCOPE_2: 360, SCOPE_3: 120 },
        metadata: { solarCapacityKWp: 20, selfConsumptionRatio: 0.60, evCount: 3, evConsumptionKWhPer100km: 15, wallboxCount: 2, wallboxSmartCharging: true, sustainabilityAuditExpense: 30_000 },
      },
      result: {
        organizationId: orgs[0].id, countryCode: 'LU', fiscalYear: 2026,
        calculatedAt: new Date().toISOString(), currency: 'EUR',
        lineItems: [
          { code: 'LU-CO2-TAX-2026', label: 'Taxe CO2 Luxembourg', amount: -68_000, currency: 'EUR', description: 'Taxe carbone progressive sur 1200t' },
          { code: 'LU-KB-PV-2026', label: 'Klimabonus Photovoltaïque', amount: 10_000, currency: 'EUR', description: '20 kWp x 800 EUR/kWp' },
          { code: 'LU-KB-EV-2026', label: 'Prime Véhicule Électrique', amount: 18_000, currency: 'EUR', description: '3 véhicules x 6 000 EUR' },
          { code: 'LU-F4S-2026', label: 'Fit 4 Sustainability', amount: 24_000, currency: 'EUR', description: 'Small Enterprise: 80% de 30 000 EUR' },
        ],
        netAmount: -16_000, engineVersion: '0.1.0',
      },
      netAmount: -16_000,
    },
    {
      id: '00000000-0000-0000-0000-000000000200',
      orgId: orgs[1].id,
      countryCode: 'FR',
      input: {
        organizationId: orgs[1].id, countryCode: 'FR', fiscalYear: 2026,
        co2Tonnes: 800, revenue: 5_000_000, employeeCount: 30,
        energyConsumptionKwh: 400_000, renewableEnergyPercent: 40,
        emissionsByScope: { SCOPE_1: 480, SCOPE_2: 240, SCOPE_3: 80 },
        metadata: { solarCapacityKWp: 20, selfConsumptionRatio: 0.60, evCount: 3, evCountVans: 2, sustainabilityAuditExpense: 50_000 },
      },
      result: {
        organizationId: orgs[1].id, countryCode: 'FR', fiscalYear: 2026,
        calculatedAt: new Date().toISOString(), currency: 'EUR',
        lineItems: [
          { code: 'FR-CCE-2026', label: 'Contribution Climat Énergie', amount: -35_680, currency: 'EUR', description: '800t x 44.60 EUR/t' },
          { code: 'FR-PV-PRIME-2026', label: 'Prime Autoconsommation PV', amount: 2_260, currency: 'EUR', description: '9 kWp x 80 + 11 kWp x 140' },
          { code: 'FR-BONUS-ECO-2026', label: 'Bonus Écologique', amount: 17_000, currency: 'EUR', description: '3 VP x 3 000 + 2 VUL x 4 000' },
        ],
        netAmount: -16_420, engineVersion: '0.1.0',
      },
      netAmount: -16_420,
    },
    {
      id: '00000000-0000-0000-0000-000000000300',
      orgId: orgs[2].id,
      countryCode: 'DE',
      input: {
        organizationId: orgs[2].id, countryCode: 'DE', fiscalYear: 2026,
        co2Tonnes: 2000, revenue: 15_000_000, employeeCount: 120,
        energyConsumptionKwh: 800_000, renewableEnergyPercent: 30,
        emissionsByScope: { SCOPE_1: 1200, SCOPE_2: 600, SCOPE_3: 200 },
        metadata: { solarCapacityKWp: 50, selfConsumptionRatio: 0.50, evCount: 5, sustainabilityAuditExpense: 80_000 },
      },
      result: {
        organizationId: orgs[2].id, countryCode: 'DE', fiscalYear: 2026,
        calculatedAt: new Date().toISOString(), currency: 'EUR',
        lineItems: [
          { code: 'DE-NEHS-2026', label: 'nEHS CO2-Abgabe', amount: -130_000, currency: 'EUR', description: '2000t x 65 EUR/t' },
          { code: 'DE-KFW270-2026', label: 'KfW 270', amount: 15_000, currency: 'EUR', description: '50 kWp x 300 EUR (max 15k)' },
          { code: 'DE-UMWELTBONUS-2026', label: 'Umweltbonus', amount: 15_000, currency: 'EUR', description: '5 x 3 000 EUR' },
          { code: 'DE-BAFA-EE-2026', label: 'BAFA EE', amount: 28_000, currency: 'EUR', description: 'KMU 35% von 80k EUR' },
        ],
        netAmount: -72_000, engineVersion: '0.1.0',
      },
      netAmount: -72_000,
    },
    {
      id: '00000000-0000-0000-0000-000000000400',
      orgId: orgs[3].id,
      countryCode: 'BE',
      input: {
        organizationId: orgs[3].id, countryCode: 'BE', fiscalYear: 2026,
        co2Tonnes: 500, revenue: 6_000_000, employeeCount: 40,
        energyConsumptionKwh: 300_000, renewableEnergyPercent: 45,
        emissionsByScope: { SCOPE_1: 300, SCOPE_2: 150, SCOPE_3: 50 },
        metadata: { solarCapacityKWp: 30, selfConsumptionRatio: 0.55, evCount: 3, sustainabilityAuditExpense: 40_000 },
      },
      result: {
        organizationId: orgs[3].id, countryCode: 'BE', fiscalYear: 2026,
        calculatedAt: new Date().toISOString(), currency: 'EUR',
        lineItems: [
          { code: 'BE-ECOPREMIE-2026', label: 'Ecologiepremie Plus', amount: 22_500, currency: 'EUR', description: 'PE: 50% de 45k EUR' },
          { code: 'BE-AMURE-2026', label: 'Aide AMURE', amount: 30_000, currency: 'EUR', description: '75% de 40k EUR' },
          { code: 'BE-FLEET-EV-2026', label: 'Prime Flotte EV', amount: 15_000, currency: 'EUR', description: '3 x 5 000 EUR' },
        ],
        netAmount: 67_500, engineVersion: '0.1.0',
      },
      netAmount: 67_500,
    },
    {
      id: '00000000-0000-0000-0000-000000000500',
      orgId: orgs[4].id,
      countryCode: 'ES',
      input: {
        organizationId: orgs[4].id, countryCode: 'ES', fiscalYear: 2026,
        co2Tonnes: 300, revenue: 800_000, employeeCount: 15,
        energyConsumptionKwh: 200_000, renewableEnergyPercent: 60,
        emissionsByScope: { SCOPE_1: 180, SCOPE_2: 90, SCOPE_3: 30 },
        metadata: { solarCapacityKWp: 20, selfConsumptionRatio: 0.65, evCount: 2 },
      },
      result: {
        organizationId: orgs[4].id, countryCode: 'ES', fiscalYear: 2026,
        calculatedAt: new Date().toISOString(), currency: 'EUR',
        lineItems: [
          { code: 'ES-NEXTGEN-SOLAR-2026', label: 'Programa Autoconsumo', amount: 12_000, currency: 'EUR', description: '20 kWp x 600 EUR' },
          { code: 'ES-IBI-SOLAR-2026', label: 'Bonificación IBI', amount: 1_000, currency: 'EUR', description: '50% reducción' },
          { code: 'ES-MOVES-2026', label: 'Plan MOVES III', amount: 10_000, currency: 'EUR', description: '2 x 5 000 EUR' },
        ],
        netAmount: 23_000, engineVersion: '0.1.0',
      },
      netAmount: 23_000,
    },
    {
      id: '00000000-0000-0000-0000-000000000600',
      orgId: orgs[5].id,
      countryCode: 'PT',
      input: {
        organizationId: orgs[5].id, countryCode: 'PT', fiscalYear: 2026,
        co2Tonnes: 200, revenue: 1_200_000, employeeCount: 10,
        energyConsumptionKwh: 150_000, renewableEnergyPercent: 50,
        emissionsByScope: { SCOPE_1: 120, SCOPE_2: 60, SCOPE_3: 20 },
        metadata: { solarCapacityKWp: 10, selfConsumptionRatio: 0.60, evCount: 1 },
      },
      result: {
        organizationId: orgs[5].id, countryCode: 'PT', fiscalYear: 2026,
        calculatedAt: new Date().toISOString(), currency: 'EUR',
        lineItems: [
          { code: 'PT-FA-EDIFICIOS-2026', label: 'Fundo Ambiental', amount: 7_500, currency: 'EUR', description: '85% de 12k EUR (max 7.5k)' },
          { code: 'PT-IVA-SOLAR-2026', label: 'Poupança IVA', amount: 2_040, currency: 'EUR', description: '17% de 12k EUR' },
          { code: 'PT-FA-VE-2026', label: 'Incentivo VE', amount: 4_000, currency: 'EUR', description: '1 x 4 000 EUR' },
        ],
        netAmount: 13_540, engineVersion: '0.1.0',
      },
      netAmount: 13_540,
    },
  ];

  for (const calc of calculations) {
    await prisma.calculation.upsert({
      where: { id: calc.id },
      update: {},
      create: {
        id: calc.id,
        organizationId: calc.orgId,
        countryCode: calc.countryCode,
        fiscalYear: 2026,
        input: calc.input as any,
        result: calc.result as any,
        netAmount: calc.netAmount,
        currency: 'EUR',
        engineVersion: '0.1.0',
      },
    });
    console.log(`  Sample Calculation (${calc.countryCode}) seeded ✓`);
  }

  // ─── Seed admin user ───────────────────────────────────────────────
  await prisma.user.upsert({
    where: { clerkId: 'user_admin_clerk_id' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000011',
      clerkId: 'user_admin_clerk_id',
      email: 'admin@global-green-tax.com',
      firstName: 'Admin',
      lastName: 'Platform',
      role: 'ADMIN',
      organizationId: orgs[0].id,
    },
  });
  console.log('  Admin User: admin@global-green-tax.com (ADMIN) ✓');

  // ─── Seed sample MarketAnalytic data ────────────────────────────
  const investmentTypes = ['SOLAR', 'EV', 'AUDIT', 'ENERGY_EFFICIENCY'];
  const sectors = ['Technology', 'Energy', 'Manufacturing', 'Logistics', 'Agriculture'];
  const countries = ['LU', 'FR', 'DE', 'BE', 'ES', 'PT'];
  let analyticsCount = 0;

  for (let i = 0; i < 60; i++) {
    const country = countries[i % countries.length];
    const type = investmentTypes[i % investmentTypes.length];
    const sector = sectors[i % sectors.length];
    const daysAgo = Math.floor(Math.random() * 60);
    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - daysAgo);

    await prisma.marketAnalytic.create({
      data: {
        countryCode: country,
        sector,
        investmentType: type,
        amount: Math.round((Math.random() * 200_000 - 100_000) * 100) / 100,
        estimatedGrant: Math.round(Math.random() * 50_000 * 100) / 100,
        co2Tonnes: Math.round(Math.random() * 2000 * 100) / 100,
        employeeCount: Math.floor(Math.random() * 200) + 5,
        revenue: Math.round(Math.random() * 20_000_000 * 100) / 100,
        userId: demoUser.id,
        createdAt,
      },
    });
    analyticsCount++;
  }
  console.log(`  MarketAnalytic: ${analyticsCount} sample entries seeded ✓`);

  console.log('\nSeed complete. 4 plans, 6 countries, 6 orgs, 6 calculations, 60 analytics.');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
