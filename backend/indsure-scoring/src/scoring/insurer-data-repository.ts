/**
 * Insurer Data Repository - Fetches insurer metrics from data layer
 */

import { PrismaClient } from '@prisma/client';
import type { InsurerSnapshot } from '../types/scoring';

const prisma = new PrismaClient();

/**
 * Build InsurerSnapshot from database
 */
export async function getInsurerSnapshot(insurerId: string): Promise<InsurerSnapshot> {
  const insurer = await prisma.insurer.findUnique({
    where: { id: insurerId },
  });
  
  if (!insurer) {
    throw new Error(`Insurer not found: ${insurerId}`);
  }
  
  const snapshot: InsurerSnapshot = {
    insurer_id: insurerId,
    brand_name: insurer.brandName,
    csr_count: null,
    csr_value: null,
    icr: null,
    complaints_normalized: null,
    solvency: null,
    network_count: null,
    sector_benchmark_icr: null,
    data_gaps: [],
  };
  
  // Get latest fiscal year with data
  const latestMetrics = await prisma.insurerMetric.findMany({
    where: { insurerId },
    orderBy: { fiscalYear: 'desc' },
  });
  
  if (latestMetrics.length === 0) {
    snapshot.data_gaps.push('No metrics available');
    return snapshot;
  }
  
  // Get CSR by count
  const csrCount = latestMetrics.find((m: any) => m.metricName === 'CSR_BY_COUNT');
  if (csrCount && csrCount.value !== null) {
    const band = await classifyMetric('CSR_BY_COUNT', csrCount.value);
    snapshot.csr_count = {
      value: csrCount.value,
      band,
      fy: csrCount.fiscalYear,
      source_type: csrCount.dataSourceType,
    };
  } else {
    snapshot.data_gaps.push('CSR by count');
  }
  
  // Get ICR
  const icr = latestMetrics.find((m: any) => m.metricName === 'ICR');
  if (icr && icr.value !== null) {
    const band = await classifyMetric('ICR', icr.value);
    snapshot.icr = {
      value: icr.value,
      band,
      fy: icr.fiscalYear,
      source_type: icr.dataSourceType,
    };
    
    // Get sector benchmark for ICR
    const insurerCategory = insurer.category;
    const benchmark = await prisma.sectorBenchmark.findFirst({
      where: {
        fiscalYear: icr.fiscalYear,
        segment: insurerCategory === 'SAHI' ? 'SAHI' : 
                 insurerCategory === 'PSU_GENERAL' ? 'PSU' : 'PRIVATE_GENERAL',
        metricName: 'ICR',
      },
    });
    
    if (benchmark) {
      snapshot.sector_benchmark_icr = benchmark.value;
    }
  } else {
    snapshot.data_gaps.push('ICR');
  }
  
  // Get complaints
  const complaints = latestMetrics.find((m: any) => m.metricName === 'COMPLAINTS_PER_10K_POLICIES');
  if (complaints && complaints.value !== null) {
    const band = await classifyMetric('COMPLAINTS_PER_10K_POLICIES', complaints.value);
    snapshot.complaints_normalized = {
      value: complaints.value,
      band,
      fy: complaints.fiscalYear,
      source_type: complaints.dataSourceType,
    };
  } else {
    snapshot.data_gaps.push('Complaints');
  }
  
  // Get solvency
  const solvency = latestMetrics.find((m: any) => m.metricName === 'SOLVENCY_RATIO');
  if (solvency && solvency.value !== null) {
    const band = await classifyMetric('SOLVENCY_RATIO', solvency.value);
    snapshot.solvency = {
      value: solvency.value,
      band,
      fy: solvency.fiscalYear,
      source_type: solvency.dataSourceType,
    };
  } else {
    snapshot.data_gaps.push('Solvency');
  }
  
  // Get network count
  const network = latestMetrics.find((m: any) => m.metricName === 'NETWORK_HOSPITAL_COUNT');
  if (network && network.value !== null) {
    snapshot.network_count = {
      value: network.value,
      source_type: network.dataSourceType,
    };
  } else {
    snapshot.data_gaps.push('Network size');
  }
  
  return snapshot;
}

/**
 * Classify metric value into band using thresholds from database
 */
async function classifyMetric(metricName: string, value: number): Promise<string> {
  const threshold = await prisma.metricThreshold.findUnique({
    where: { metricName },
  });
  
  if (!threshold) {
    return 'Unknown';
  }
  
  const direction = threshold.direction;
  
  if (direction === 'HIGHER_IS_BETTER') {
    if (threshold.excellentMin !== null && value >= threshold.excellentMin) {
      return 'Excellent';
    }
    if (threshold.goodMin !== null && value >= threshold.goodMin) {
      return 'Good';
    }
    if (threshold.concerningMin !== null && value >= threshold.concerningMin) {
      return 'Concerning';
    }
    return 'Red Flag';
  }
  
  if (direction === 'LOWER_IS_BETTER') {
    if (threshold.redFlagMax !== null && value >= threshold.redFlagMax) {
      return 'Red Flag';
    }
    if (threshold.concerningMin !== null && value >= threshold.concerningMin) {
      return 'Concerning';
    }
    if (threshold.goodMin !== null && value >= threshold.goodMin) {
      return 'Good';
    }
    return 'Excellent';
  }
  
  return 'Unknown';
}
