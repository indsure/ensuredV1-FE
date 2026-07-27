#!/usr/bin/env tsx
/**
 * IndSure Data Layer - Seed Script
 * Populates SQLite database from JSON seed files
 * 
 * Usage:
 *   npm run seed          # Fresh seed (clears existing data)
 *   npm run seed:refresh  # Refresh with new data
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  InsurersSeedSchema,
  InsurerMetricsSeedSchema,
  SectorBenchmarksSeedSchema,
  MetricThresholdsSeedSchema,
  ScoringProfilesSeedSchema,
  ScoringDimensionsSeedSchema,
  GlossaryTermsSeedSchema,
  EducationalFactsSeedSchema,
} from '../schemas/seed-schemas.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const prisma = new PrismaClient();

const SEED_DIR = join(__dirname, '../data/seed');

// ═══════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function loadJSON<T>(filename: string, schema: any): T {
  const path = join(SEED_DIR, filename);
  console.log(`📖 Loading ${filename}...`);
  
  try {
    const content = readFileSync(path, 'utf-8');
    const data = JSON.parse(content);
    const validated = schema.parse(data);
    console.log(`✅ Validated ${filename}`);
    return validated;
  } catch (error) {
    console.error(`❌ Error loading ${filename}:`, error);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════
// SEED FUNCTIONS
// ═══════════════════════════════════════════════════════════════

async function seedInsurers() {
  console.log('\n🏥 Seeding insurers...');
  const insurers = loadJSON('insurers.json', InsurersSeedSchema);
  
  for (const insurer of insurers) {
    await prisma.insurer.upsert({
      where: { id: insurer.id },
      update: {
        registeredName: insurer.registeredName,
        brandName: insurer.brandName,
        formerNames: JSON.stringify(insurer.formerNames),
        category: insurer.category,
        foundedYear: insurer.foundedYear,
        notes: insurer.notes,
        sourceCitation: insurer.sourceCitation,
        dataAsOf: insurer.dataAsOf,
      },
      create: {
        id: insurer.id,
        registeredName: insurer.registeredName,
        brandName: insurer.brandName,
        formerNames: JSON.stringify(insurer.formerNames),
        category: insurer.category,
        foundedYear: insurer.foundedYear,
        notes: insurer.notes,
        sourceCitation: insurer.sourceCitation,
        dataAsOf: insurer.dataAsOf,
      },
    });
  }
  
  console.log(`✅ Seeded ${insurers.length} insurers`);
}

async function seedInsurerMetrics() {
  console.log('\n📊 Seeding insurer metrics...');
  const metrics = loadJSON('insurer-metrics.json', InsurerMetricsSeedSchema);
  
  // Delete existing metrics to avoid duplicates
  await prisma.insurerMetric.deleteMany({});
  
  for (const metric of metrics) {
    await prisma.insurerMetric.create({
      data: {
        insurerId: metric.insurerId,
        fiscalYear: metric.fiscalYear,
        metricName: metric.metricName,
        value: metric.value,
        valueText: metric.valueText,
        dataSourceType: metric.dataSourceType,
        sourceCitation: metric.sourceCitation,
        confidence: metric.confidence,
        notes: metric.notes,
      },
    });
  }
  
  console.log(`✅ Seeded ${metrics.length} insurer metrics`);
}

async function seedSectorBenchmarks() {
  console.log('\n📈 Seeding sector benchmarks...');
  const benchmarks = loadJSON('sector-benchmarks.json', SectorBenchmarksSeedSchema);
  
  // Delete existing benchmarks
  await prisma.sectorBenchmark.deleteMany({});
  
  for (const benchmark of benchmarks) {
    await prisma.sectorBenchmark.create({
      data: {
        fiscalYear: benchmark.fiscalYear,
        segment: benchmark.segment,
        metricName: benchmark.metricName,
        value: benchmark.value,
        sourceCitation: benchmark.sourceCitation,
      },
    });
  }
  
  console.log(`✅ Seeded ${benchmarks.length} sector benchmarks`);
}

async function seedMetricThresholds() {
  console.log('\n🎯 Seeding metric thresholds...');
  const thresholds = loadJSON('metric-thresholds.json', MetricThresholdsSeedSchema);
  
  for (const threshold of thresholds) {
    await prisma.metricThreshold.upsert({
      where: { metricName: threshold.metricName },
      update: {
        excellentMin: threshold.excellentMin,
        goodMin: threshold.goodMin,
        concerningMin: threshold.concerningMin,
        redFlagMax: threshold.redFlagMax,
        direction: threshold.direction,
        interpretationText: threshold.interpretationText,
        misinterpretationWarning: threshold.misinterpretationWarning,
        sourceCitation: threshold.sourceCitation,
      },
      create: {
        metricName: threshold.metricName,
        excellentMin: threshold.excellentMin,
        goodMin: threshold.goodMin,
        concerningMin: threshold.concerningMin,
        redFlagMax: threshold.redFlagMax,
        direction: threshold.direction,
        interpretationText: threshold.interpretationText,
        misinterpretationWarning: threshold.misinterpretationWarning,
        sourceCitation: threshold.sourceCitation,
      },
    });
  }
  
  console.log(`✅ Seeded ${thresholds.length} metric thresholds`);
}

async function seedScoringProfiles() {
  console.log('\n⚖️  Seeding scoring profiles...');
  const profiles = loadJSON('scoring-profiles.json', ScoringProfilesSeedSchema);
  
  for (const profile of profiles) {
    await prisma.scoringProfile.upsert({
      where: { id: profile.id },
      update: {
        displayName: profile.displayName,
        description: profile.description,
        weights: JSON.stringify(profile.weights),
        recommendedFor: profile.recommendedFor,
      },
      create: {
        id: profile.id,
        displayName: profile.displayName,
        description: profile.description,
        weights: JSON.stringify(profile.weights),
        recommendedFor: profile.recommendedFor,
      },
    });
  }
  
  console.log(`✅ Seeded ${profiles.length} scoring profiles`);
}

async function seedScoringDimensions() {
  console.log('\n📐 Seeding scoring dimensions...');
  const dimensions = loadJSON('scoring-dimensions.json', ScoringDimensionsSeedSchema);
  
  for (const dimension of dimensions) {
    await prisma.scoringDimension.upsert({
      where: { id: dimension.id },
      update: {
        displayName: dimension.displayName,
        description: dimension.description,
        scoringCurve: JSON.stringify(dimension.scoringCurve),
        sourceCitation: dimension.sourceCitation,
      },
      create: {
        id: dimension.id,
        displayName: dimension.displayName,
        description: dimension.description,
        scoringCurve: JSON.stringify(dimension.scoringCurve),
        sourceCitation: dimension.sourceCitation,
      },
    });
  }
  
  console.log(`✅ Seeded ${dimensions.length} scoring dimensions`);
}

async function seedGlossaryTerms() {
  console.log('\n📚 Seeding glossary terms...');
  const terms = loadJSON('glossary.json', GlossaryTermsSeedSchema);
  
  // Delete existing terms
  await prisma.glossaryTerm.deleteMany({});
  
  for (const term of terms) {
    await prisma.glossaryTerm.create({
      data: {
        term: term.term,
        language: term.language,
        displayName: term.displayName,
        shortDefinition: term.shortDefinition,
        longDefinition: term.longDefinition,
        example: term.example,
        relatedTerms: JSON.stringify(term.relatedTerms),
      },
    });
  }
  
  console.log(`✅ Seeded ${terms.length} glossary terms`);
}

async function seedEducationalFacts() {
  console.log('\n💡 Seeding educational facts...');
  const facts = loadJSON('educational-facts.json', EducationalFactsSeedSchema);
  
  // Delete existing facts
  await prisma.educationalFact.deleteMany({});
  
  for (const fact of facts) {
    await prisma.educationalFact.create({
      data: {
        factText: fact.factText,
        category: fact.category,
        sourceCitation: fact.sourceCitation,
        language: fact.language,
      },
    });
  }
  
  console.log(`✅ Seeded ${facts.length} educational facts`);
}

async function seedDataFreshness() {
  console.log('\n🕐 Seeding data freshness metadata...');
  
  await prisma.dataFreshness.upsert({
    where: { id: 1 },
    update: {
      dataLastRefreshed: new Date().toISOString().split('T')[0],
      irdaiAnnualReportYear: 'FY 2023-24',
      researchDocVersion: '2026-04-27',
      nextScheduledRefresh: '2026-10-01',
    },
    create: {
      id: 1,
      dataLastRefreshed: new Date().toISOString().split('T')[0],
      irdaiAnnualReportYear: 'FY 2023-24',
      researchDocVersion: '2026-04-27',
      nextScheduledRefresh: '2026-10-01',
    },
  });
  
  console.log('✅ Seeded data freshness metadata');
}

// ═══════════════════════════════════════════════════════════════
// MAIN SEED FUNCTION
// ═══════════════════════════════════════════════════════════════

async function main() {
  console.log('🌱 IndSure Data Layer - Seeding Database\n');
  console.log('═'.repeat(60));
  
  try {
    await seedInsurers();
    await seedInsurerMetrics();
    await seedSectorBenchmarks();
    await seedMetricThresholds();
    await seedScoringProfiles();
    await seedScoringDimensions();
    await seedGlossaryTerms();
    await seedEducationalFacts();
    await seedDataFreshness();
    
    console.log('\n' + '═'.repeat(60));
    console.log('✅ Database seeded successfully!\n');
    
    // Print summary
    const insurerCount = await prisma.insurer.count();
    const metricCount = await prisma.insurerMetric.count();
    const benchmarkCount = await prisma.sectorBenchmark.count();
    const thresholdCount = await prisma.metricThreshold.count();
    const profileCount = await prisma.scoringProfile.count();
    const dimensionCount = await prisma.scoringDimension.count();
    const glossaryCount = await prisma.glossaryTerm.count();
    const factCount = await prisma.educationalFact.count();
    
    console.log('📊 Summary:');
    console.log(`   • ${insurerCount} insurers`);
    console.log(`   • ${metricCount} insurer metrics`);
    console.log(`   • ${benchmarkCount} sector benchmarks`);
    console.log(`   • ${thresholdCount} metric thresholds`);
    console.log(`   • ${profileCount} scoring profiles`);
    console.log(`   • ${dimensionCount} scoring dimensions`);
    console.log(`   • ${glossaryCount} glossary terms`);
    console.log(`   • ${factCount} educational facts`);
    
    const freshness = await prisma.dataFreshness.findUnique({ where: { id: 1 } });
    if (freshness) {
      console.log(`\n📅 Data Freshness:`);
      console.log(`   • Last refreshed: ${freshness.dataLastRefreshed}`);
      console.log(`   • IRDAI report: ${freshness.irdaiAnnualReportYear}`);
      console.log(`   • Research version: ${freshness.researchDocVersion}`);
      console.log(`   • Next refresh: ${freshness.nextScheduledRefresh}`);
    }
    
    console.log('\n✨ Ready for Prompt 2 (scoring engine + verdict logic)!\n');
    
  } catch (error) {
    console.error('\n❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
