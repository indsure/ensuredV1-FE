/**
 * Tests for seed data validation
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  InsurersSeedSchema,
  ScoringProfilesSeedSchema,
  MetricThresholdsSeedSchema,
  GlossaryTermsSeedSchema,
} from '../src/schemas/seed-schemas.js';

const SEED_DIR = join(__dirname, '../src/data/seed');

function loadJSON(filename: string) {
  const path = join(SEED_DIR, filename);
  const content = readFileSync(path, 'utf-8');
  return JSON.parse(content);
}

describe('Seed Data Validation', () => {
  it('insurers.json should parse and validate', () => {
    const data = loadJSON('insurers.json');
    expect(() => InsurersSeedSchema.parse(data)).not.toThrow();
    expect(data.length).toBeGreaterThan(25); // At least 25 insurers
  });

  it('scoring-profiles.json should parse and validate', () => {
    const data = loadJSON('scoring-profiles.json');
    expect(() => ScoringProfilesSeedSchema.parse(data)).not.toThrow();
    expect(data.length).toBe(4); // Exactly 4 profiles
  });

  it('all scoring profiles should have weights summing to 100', () => {
    const data = loadJSON('scoring-profiles.json');
    const profiles = ScoringProfilesSeedSchema.parse(data);
    
    for (const profile of profiles) {
      const sum = Object.values(profile.weights).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(100, 2);
    }
  });

  it('metric-thresholds.json should parse and validate', () => {
    const data = loadJSON('metric-thresholds.json');
    expect(() => MetricThresholdsSeedSchema.parse(data)).not.toThrow();
    expect(data.length).toBeGreaterThan(10); // At least 10 thresholds
  });

  it('glossary.json should parse and validate', () => {
    const data = loadJSON('glossary.json');
    expect(() => GlossaryTermsSeedSchema.parse(data)).not.toThrow();
    expect(data.length).toBeGreaterThan(20); // At least 20 terms
  });

  it('all glossary terms should have non-empty short definitions', () => {
    const data = loadJSON('glossary.json');
    const terms = GlossaryTermsSeedSchema.parse(data);
    
    for (const term of terms) {
      expect(term.shortDefinition).toBeTruthy();
      expect(term.shortDefinition.length).toBeGreaterThan(10);
    }
  });

  it('all insurers should have valid dataAsOf dates', () => {
    const data = loadJSON('insurers.json');
    const insurers = InsurersSeedSchema.parse(data);
    const today = new Date();
    
    for (const insurer of insurers) {
      const dataAsOf = new Date(insurer.dataAsOf);
      expect(dataAsOf).toBeInstanceOf(Date);
      expect(dataAsOf.getTime()).toBeLessThanOrEqual(today.getTime());
    }
  });

  it('all insurers should have unique IDs', () => {
    const data = loadJSON('insurers.json');
    const insurers = InsurersSeedSchema.parse(data);
    const ids = insurers.map(i => i.id);
    const uniqueIds = new Set(ids);
    
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('all insurers should have valid categories', () => {
    const data = loadJSON('insurers.json');
    const insurers = InsurersSeedSchema.parse(data);
    const validCategories = ['SAHI', 'PRIVATE_GENERAL', 'PSU_GENERAL'];
    
    for (const insurer of insurers) {
      expect(validCategories).toContain(insurer.category);
    }
  });
});
