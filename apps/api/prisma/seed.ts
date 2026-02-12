import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Global Green Tax database...\n');

  // ─── Load Luxembourg 2026 data ──────────────────────────────────────
  const luDataPath = path.resolve(__dirname, '../../../data/schemas/LU-2026.json');
  const luData = JSON.parse(fs.readFileSync(luDataPath, 'utf-8'));

  console.log(`Loaded: ${luData.metadata.countryName} (${luData.metadata.countryCode}) – FY${luData.metadata.fiscalYear}`);

  // ─── Upsert Country ─────────────────────────────────────────────────
  const luxembourg = await prisma.country.upsert({
    where: { code: 'LU' },
    update: {
      taxRules: luData,
      updatedAt: new Date(),
    },
    create: {
      code: 'LU',
      name: 'Luxembourg',
      currency: 'EUR',
      isActive: true,
      taxRules: luData,
    },
  });
  console.log(`  Country: ${luxembourg.name} (${luxembourg.code}) ✓`);

  // ─── Seed additional countries (stubs for future strategies) ────────
  const countries = [
    { code: 'FR', name: 'France', currency: 'EUR' },
    { code: 'DE', name: 'Germany', currency: 'EUR' },
    { code: 'BE', name: 'Belgium', currency: 'EUR' },
    { code: 'NL', name: 'Netherlands', currency: 'EUR' },
    { code: 'CH', name: 'Switzerland', currency: 'CHF' },
  ];

  for (const country of countries) {
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

  // ─── Seed demo organization ─────────────────────────────────────────
  const demoOrg = await prisma.organization.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'GreenTech Luxembourg SARL',
      countryCode: 'LU',
      vatNumber: 'LU12345678',
      sector: 'Technology',
    },
  });
  console.log(`\n  Demo Org: ${demoOrg.name} ✓`);

  // ─── Seed demo user (linked to Clerk placeholder) ──────────────────
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
      organizationId: demoOrg.id,
    },
  });
  console.log(`  Demo User: ${demoUser.email} (${demoUser.role}) ✓`);

  // ─── Seed a sample calculation ──────────────────────────────────────
  const sampleInput = {
    organizationId: demoOrg.id,
    countryCode: 'LU',
    fiscalYear: 2026,
    co2Tonnes: 1200,
    revenue: 8_000_000,
    employeeCount: 45,
    energyConsumptionKwh: 350_000,
    renewableEnergyPercent: 65,
    emissionsByScope: { SCOPE_1: 720, SCOPE_2: 360, SCOPE_3: 120 },
    metadata: {
      solarCapacityKWp: 20,
      selfConsumptionRatio: 0.60,
      evCount: 3,
      evConsumptionKWhPer100km: 15,
      wallboxCount: 2,
      wallboxSmartCharging: true,
      sustainabilityAuditExpense: 30_000,
    },
  };

  // Pre-compute expected results for seed
  const sampleResult = {
    organizationId: demoOrg.id,
    countryCode: 'LU',
    fiscalYear: 2026,
    calculatedAt: new Date().toISOString(),
    currency: 'EUR',
    lineItems: [
      {
        code: 'LU-CO2-TAX-2026',
        label: 'Taxe CO2 Luxembourg',
        amount: -68_000,
        currency: 'EUR',
        description: 'Taxe carbone progressive sur 1200t: 500t x 45 EUR/t + 700t x 65 EUR/t',
      },
      {
        code: 'LU-KB-PV-2026',
        label: 'Klimabonus Photovoltaïque',
        amount: 10_000,
        currency: 'EUR',
        description: '20 kWp x 800 EUR/kWp = 10 000 EUR (plafonné)',
      },
      {
        code: 'LU-KB-EV-2026',
        label: 'Prime Véhicule Électrique',
        amount: 18_000,
        currency: 'EUR',
        description: '3 véhicules x 6 000 EUR = 18 000 EUR',
      },
      {
        code: 'LU-F4S-2026',
        label: 'Fit 4 Sustainability',
        amount: 24_000,
        currency: 'EUR',
        description: 'Small Enterprise: 80% de 30 000 EUR = 24 000 EUR',
      },
    ],
    netAmount: -16_000,
    engineVersion: '0.1.0',
  };

  await prisma.calculation.upsert({
    where: { id: '00000000-0000-0000-0000-000000000100' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000100',
      organizationId: demoOrg.id,
      countryCode: 'LU',
      fiscalYear: 2026,
      input: sampleInput as any,
      result: sampleResult as any,
      netAmount: -16_000,
      currency: 'EUR',
      engineVersion: '0.1.0',
    },
  });
  console.log(`  Sample Calculation seeded ✓`);

  console.log('\nSeed complete.');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
