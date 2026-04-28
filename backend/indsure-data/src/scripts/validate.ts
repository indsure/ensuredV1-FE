#!/usr/bin/env tsx
/**
 * IndSure Data Layer - Validation Script
 * Runs integrity checks on seeded data
 * 
 * Usage:
 *   npm run validate
 * 
 * Exit code 0 = all checks passed
 * Exit code 1 = one or more checks failed
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ValidationResult {
  name: string;
  passed: boolean;
  message: string;
  details?: string[];
}

const results: ValidationResult[] = [];

// ═══════════════════════════════════════════════════════════════
// VALIDATION CHECKS
// ═══════════════════════════════════════════════════════════════

async function checkScoringProfileWeights() {
  const profiles = await prisma.scoringProfile.findMany();
  const errors: string[] = [];
  
  for (const profile of profiles) {
    const weights = JSON.parse(profile.weights);
    const sum = Object.values(weights).reduce((a: number, b: any) => a + Number(b), 0);
    
    if (Math.abs(sum - 100) > 0.01) {
      errors.push(`Profile "${profile.id}" weights sum to ${sum}, not 100`);
    }
  }
  
  results.push({
    name: 'Scoring profile weights sum to 100',
    passed: errors.length === 0,
    message: errors.length === 0 
      ? `All ${profiles.length} profiles have weights summing to 100`
      : `${errors.length} profile(s) have invalid weights`,
    details: errors,
  });
}

async function checkMetricSourceCitations() {
  const metrics = await prisma.insurerMetric.findMany({
    where: {
      sourceCitation: '',
    },
  });
  
  results.push({
    name: 'All insurer metrics have source citations',
    passed: metrics.length === 0,
    message: metrics.length === 0
      ? 'All metrics have valid source citations'
      : `${metrics.length} metric(s) missing source citations`,
    details: metrics.map(m => `${m.insurerId} - ${m.metricName} (${m.fiscalYear})`),
  });
}

async function checkMetricNamesExistInThresholds() {
  const metrics = await prisma.insurerMetric.findMany({
    select: { metricName: true },
    distinct: ['metricName'],
  });
  
  const thresholds = await prisma.metricThreshold.findMany({
    select: { metricName: true },
  });
  
  const thresholdNames = new Set(thresholds.map(t => t.metricName));
  const missingThresholds = metrics
    .map(m => m.metricName)
    .filter(name => !thresholdNames.has(name));
  
  results.push({
    name: 'All metric names have corresponding thresholds',
    passed: missingThresholds.length === 0,
    message: missingThresholds.length === 0
      ? 'All metric names have thresholds defined'
      : `${missingThresholds.length} metric(s) missing thresholds`,
    details: missingThresholds,
  });
}

async function checkDimensionsExistInProfiles() {
  const profiles = await prisma.scoringProfile.findMany();
  const dimensions = await prisma.scoringDimension.findMany({
    select: { id: true },
  });
  
  const dimensionIds = new Set(dimensions.map(d => d.id));
  const errors: string[] = [];
  
  for (const profile of profiles) {
    const weights = JSON.parse(profile.weights);
    const profileDimensions = Object.keys(weights);
    
    for (const dim of profileDimensions) {
      if (!dimensionIds.has(dim)) {
        errors.push(`Profile "${profile.id}" references non-existent dimension "${dim}"`);
      }
    }
  }
  
  results.push({
    name: 'All dimensions in profiles exist in scoring_dimensions',
    passed: errors.length === 0,
    message: errors.length === 0
      ? 'All profile dimensions are valid'
      : `${errors.length} invalid dimension reference(s)`,
    details: errors,
  });
}

async function checkGlossaryDefinitions() {
  const terms = await prisma.glossaryTerm.findMany({
    where: {
      OR: [
        { shortDefinition: '' },
        { longDefinition: '' },
      ],
    },
  });
  
  results.push({
    name: 'All glossary terms have non-empty definitions',
    passed: terms.length === 0,
    message: terms.length === 0
      ? 'All glossary terms have valid definitions'
      : `${terms.length} term(s) have empty definitions`,
    details: terms.map(t => `${t.term} (${t.language})`),
  });
}

async function checkFutureDates() {
  const today = new Date().toISOString().split('T')[0];
  const insurers = await prisma.insurer.findMany({
    where: {
      dataAsOf: {
        gt: today,
      },
    },
  });
  
  results.push({
    name: 'No insurers have future dataAsOf dates',
    passed: insurers.length === 0,
    message: insurers.length === 0
      ? 'All dataAsOf dates are valid'
      : `${insurers.length} insurer(s) have future dates`,
    details: insurers.map(i => `${i.id}: ${i.dataAsOf}`),
  });
}

async function checkBenchmarkFiscalYears() {
  const metricYears = await prisma.insurerMetric.findMany({
    select: { fiscalYear: true },
    distinct: ['fiscalYear'],
  });
  
  const benchmarkYears = await prisma.sectorBenchmark.findMany({
    select: { fiscalYear: true },
    distinct: ['fiscalYear'],
  });
  
  const metricYearSet = new Set(metricYears.map(m => m.fiscalYear));
  const benchmarkYearSet = new Set(benchmarkYears.map(b => b.fiscalYear));
  
  const missingBenchmarks = Array.from(metricYearSet).filter(
    year => !benchmarkYearSet.has(year)
  );
  
  // Note: It's acceptable to have insurer metrics without sector benchmarks
  // (e.g., FY 2024-25 CSR data may be available before IRDAI publishes sector aggregates)
  results.push({
    name: 'Sector benchmarks coverage',
    passed: true, // Always pass, just report the info
    message: missingBenchmarks.length === 0
      ? 'All fiscal years with metrics have sector benchmarks'
      : `${missingBenchmarks.length} fiscal year(s) have metrics but no sector benchmarks (acceptable)`,
    details: missingBenchmarks.length > 0 ? missingBenchmarks : undefined,
  });
}

async function checkJSONParsing() {
  const errors: string[] = [];
  
  // Check insurers.formerNames
  const insurers = await prisma.insurer.findMany();
  for (const insurer of insurers) {
    try {
      JSON.parse(insurer.formerNames);
    } catch (e) {
      errors.push(`Insurer ${insurer.id}: invalid formerNames JSON`);
    }
  }
  
  // Check scoring profiles.weights
  const profiles = await prisma.scoringProfile.findMany();
  for (const profile of profiles) {
    try {
      JSON.parse(profile.weights);
    } catch (e) {
      errors.push(`Profile ${profile.id}: invalid weights JSON`);
    }
  }
  
  // Check scoring dimensions.scoringCurve
  const dimensions = await prisma.scoringDimension.findMany();
  for (const dimension of dimensions) {
    try {
      JSON.parse(dimension.scoringCurve);
    } catch (e) {
      errors.push(`Dimension ${dimension.id}: invalid scoringCurve JSON`);
    }
  }
  
  // Check glossary terms.relatedTerms
  const terms = await prisma.glossaryTerm.findMany();
  for (const term of terms) {
    try {
      JSON.parse(term.relatedTerms);
    } catch (e) {
      errors.push(`Glossary term ${term.term}: invalid relatedTerms JSON`);
    }
  }
  
  results.push({
    name: 'All JSON fields parse correctly',
    passed: errors.length === 0,
    message: errors.length === 0
      ? 'All JSON fields are valid'
      : `${errors.length} JSON parsing error(s)`,
    details: errors,
  });
}

// ═══════════════════════════════════════════════════════════════
// MAIN VALIDATION FUNCTION
// ═══════════════════════════════════════════════════════════════

async function main() {
  console.log('🔍 IndSure Data Layer - Validation\n');
  console.log('═'.repeat(60));
  
  try {
    await checkScoringProfileWeights();
    await checkMetricSourceCitations();
    await checkMetricNamesExistInThresholds();
    await checkDimensionsExistInProfiles();
    await checkGlossaryDefinitions();
    await checkFutureDates();
    await checkBenchmarkFiscalYears();
    await checkJSONParsing();
    
    console.log('\n📋 Validation Results:\n');
    
    let allPassed = true;
    
    for (const result of results) {
      const icon = result.passed ? '✅' : '❌';
      console.log(`${icon} ${result.name}`);
      console.log(`   ${result.message}`);
      
      if (!result.passed && result.details && result.details.length > 0) {
        console.log('   Details:');
        result.details.slice(0, 5).forEach(detail => {
          console.log(`     • ${detail}`);
        });
        if (result.details.length > 5) {
          console.log(`     ... and ${result.details.length - 5} more`);
        }
      }
      
      console.log('');
      
      if (!result.passed) {
        allPassed = false;
      }
    }
    
    console.log('═'.repeat(60));
    
    if (allPassed) {
      console.log('✅ All validation checks passed!\n');
      process.exit(0);
    } else {
      const failedCount = results.filter(r => !r.passed).length;
      console.log(`❌ ${failedCount} validation check(s) failed\n`);
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n❌ Validation error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
