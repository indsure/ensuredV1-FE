#!/usr/bin/env tsx
/**
 * Quick database summary script
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const insurers = await prisma.insurer.count();
  const metrics = await prisma.insurerMetric.count();
  const benchmarks = await prisma.sectorBenchmark.count();
  const thresholds = await prisma.metricThreshold.count();
  const profiles = await prisma.scoringProfile.count();
  const dimensions = await prisma.scoringDimension.count();
  const glossary = await prisma.glossaryTerm.count();
  const facts = await prisma.educationalFact.count();
  
  console.log('\n📊 Database Summary');
  console.log('═'.repeat(60));
  console.log(`Insurers:           ${insurers}`);
  console.log(`Insurer Metrics:    ${metrics}`);
  console.log(`Sector Benchmarks:  ${benchmarks}`);
  console.log(`Metric Thresholds:  ${thresholds}`);
  console.log(`Scoring Profiles:   ${profiles}`);
  console.log(`Scoring Dimensions: ${dimensions}`);
  console.log(`Glossary Terms:     ${glossary}`);
  console.log(`Educational Facts:  ${facts}`);
  console.log('═'.repeat(60));
  
  // Get insurer breakdown by category
  const sahis = await prisma.insurer.count({ where: { category: 'SAHI' } });
  const privateGeneral = await prisma.insurer.count({ where: { category: 'PRIVATE_GENERAL' } });
  const psuGeneral = await prisma.insurer.count({ where: { category: 'PSU_GENERAL' } });
  
  console.log('\n📈 Insurer Breakdown');
  console.log('═'.repeat(60));
  console.log(`SAHIs:           ${sahis}`);
  console.log(`Private General: ${privateGeneral}`);
  console.log(`PSU General:     ${psuGeneral}`);
  console.log('═'.repeat(60));
  
  await prisma.$disconnect();
}

main();
