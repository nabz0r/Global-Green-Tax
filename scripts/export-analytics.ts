/**
 * export-analytics.ts
 *
 * Exports the MarketAnalytic table to JSONL format for AI/ML fine-tuning.
 * Compatible with OpenAI fine-tuning format and Vertex AI batch prediction.
 *
 * Usage:
 *   npx tsx scripts/export-analytics.ts [--output analytics.jsonl] [--limit 10000]
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface ExportOptions {
  output: string;
  limit: number;
  batchSize: number;
}

function parseArgs(): ExportOptions {
  const args = process.argv.slice(2);
  const options: ExportOptions = {
    output: 'analytics-export.jsonl',
    limit: 0, // 0 = no limit
    batchSize: 1000,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--output' && args[i + 1]) {
      options.output = args[++i];
    } else if (args[i] === '--limit' && args[i + 1]) {
      options.limit = parseInt(args[++i], 10);
    } else if (args[i] === '--batch-size' && args[i + 1]) {
      options.batchSize = parseInt(args[++i], 10);
    }
  }

  return options;
}

async function main() {
  const options = parseArgs();
  const outputPath = path.resolve(process.cwd(), options.output);

  console.log(`\nGlobal Green Tax — Analytics JSONL Export`);
  console.log(`${'─'.repeat(50)}`);
  console.log(`  Output:     ${outputPath}`);
  console.log(`  Limit:      ${options.limit || 'ALL'}`);
  console.log(`  Batch size: ${options.batchSize}`);

  // Count total records
  const total = await prisma.marketAnalytic.count();
  const exportCount = options.limit > 0 ? Math.min(options.limit, total) : total;

  console.log(`  Records:    ${exportCount} / ${total} total\n`);

  if (exportCount === 0) {
    console.log('No records to export. Run some simulations first.');
    return;
  }

  // Open write stream
  const writeStream = fs.createWriteStream(outputPath, { encoding: 'utf-8' });
  let exported = 0;
  let cursor: string | undefined;

  while (exported < exportCount) {
    const take = Math.min(options.batchSize, exportCount - exported);

    const records = await prisma.marketAnalytic.findMany({
      take,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: { email: true },
        },
      },
    });

    if (records.length === 0) break;

    for (const record of records) {
      // Format as JSONL — each line is a self-contained JSON object
      // Suitable for OpenAI fine-tuning or Vertex AI batch prediction
      const entry = {
        // Structured prompt for fine-tuning
        prompt: `Calculate green tax position for a ${record.sector ?? 'unknown'} sector company in ${record.countryCode} with ${record.employeeCount ?? 0} employees, revenue ${record.revenue ?? 0} EUR, investing in ${record.investmentType}, emitting ${record.co2Tonnes ?? 0} tonnes CO2.`,
        completion: `Net position: ${record.amount} EUR. Estimated grants: ${record.estimatedGrant} EUR. Investment type: ${record.investmentType}. Country: ${record.countryCode}. Sector: ${record.sector ?? 'N/A'}.`,
        // Raw metadata for analytics pipelines
        metadata: {
          id: record.id,
          countryCode: record.countryCode,
          sector: record.sector,
          investmentType: record.investmentType,
          amount: Number(record.amount),
          estimatedGrant: Number(record.estimatedGrant),
          co2Tonnes: record.co2Tonnes ? Number(record.co2Tonnes) : null,
          employeeCount: record.employeeCount,
          revenue: record.revenue ? Number(record.revenue) : null,
          timestamp: record.createdAt.toISOString(),
        },
      };

      writeStream.write(JSON.stringify(entry) + '\n');
      exported++;
    }

    cursor = records[records.length - 1].id;

    // Progress indicator
    const pct = Math.round((exported / exportCount) * 100);
    process.stdout.write(`\r  Exporting... ${exported}/${exportCount} (${pct}%)`);
  }

  writeStream.end();

  console.log(`\n\n  Export complete: ${exported} records written to ${outputPath}`);
  console.log(`  File size: ${(fs.statSync(outputPath).size / 1024).toFixed(1)} KB\n`);
}

main()
  .catch((e) => {
    console.error('\nExport failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
