/**
 * Scoring Engine Tests
 */

import { describe, it, expect } from 'vitest';
import type { ExtractedPolicy } from '../src/types/policy';
import type { UserProfile } from '../src/types/scoring';
import { scoreCoverageAdequacy } from '../src/scoring/dimensions/coverage-adequacy';
import { scoreCost } from '../src/scoring/dimensions/cost';
import { scoreWaitingPeriods } from '../src/scoring/dimensions/waiting-periods';

describe('Dimension Scorers', () => {
  const mockPolicy: ExtractedPolicy = {
    policy_id: 'test-123',
    insurer_id: 'star-health',
    insurer_raw_name: 'Star Health',
    product_name: 'Test Policy',
    document_type: 'POLICY_WORDING',
    sum_insured: 1000000,
    annual_premium: 15000,
    copay_percent: null,
    deductible: null,
    room_rent_limit: null,
    icu_limit: null,
    initial_waiting_months: 30,
    ped_waiting_months: 24,
    specific_illness_waiting_months: 12,
    maternity_waiting_months: 36,
    maternity_covered: true,
    maternity_limit: 50000,
    newborn_covered: true,
    pre_hospitalization_days: 30,
    post_hospitalization_days: 60,
    daycare_procedures_count: 150,
    ayush_covered: true,
    modern_treatments_covered: true,
    restoration_benefit: true,
    no_claim_bonus_max_pct: 50,
    free_health_checkup: true,
    cashless_hospitals_count: 10000,
    sub_limits: [],
    permanent_exclusions: [],
    extraction_confidence: 'HIGH',
    fields_missing: [],
    source_quotes: [],
    raw_text_excerpt: 'Test excerpt',
  };

  const mockUserProfile: UserProfile = {
    age_band: '31-45',
    coverage_need: 'FAMILY_KIDS',
    city_tier: 'METRO',
    pre_existing: [],
    scoring_profile_id: 'balanced',
  };

  describe('Coverage Adequacy', () => {
    it('should score ₹10L coverage appropriately', () => {
      const result = scoreCoverageAdequacy(mockPolicy, mockUserProfile);
      
      expect(result.dimension_id).toBe('coverage_adequacy');
      expect(result.raw_score).toBeGreaterThan(60);
      expect(result.raw_score).toBeLessThanOrEqual(100);
      expect(result.data_confidence).toBe('HIGH');
    });

    it('should return UNAVAILABLE when sum_insured is null', () => {
      const policyNoSum = { ...mockPolicy, sum_insured: null };
      const result = scoreCoverageAdequacy(policyNoSum, mockUserProfile);
      
      expect(result.data_confidence).toBe('UNAVAILABLE');
      expect(result.raw_score).toBe(50);
    });

    it('should bonus for restoration benefit', () => {
      const withRestoration = scoreCoverageAdequacy(mockPolicy, mockUserProfile);
      const withoutRestoration = scoreCoverageAdequacy(
        { ...mockPolicy, restoration_benefit: false },
        mockUserProfile
      );
      
      expect(withRestoration.raw_score).toBeGreaterThan(withoutRestoration.raw_score);
    });
  });

  describe('Cost', () => {
    it('should score premium per ₹1L cover', () => {
      const result = scoreCost(mockPolicy, mockUserProfile);
      
      expect(result.dimension_id).toBe('cost');
      expect(result.raw_score).toBeGreaterThan(0);
      expect(result.raw_score).toBeLessThanOrEqual(100);
    });

    it('should penalize co-pay', () => {
      const noCopay = scoreCost(mockPolicy, mockUserProfile);
      const withCopay = scoreCost(
        { ...mockPolicy, copay_percent: 20 },
        mockUserProfile
      );
      
      expect(noCopay.raw_score).toBeGreaterThan(withCopay.raw_score);
    });
  });

  describe('Waiting Periods', () => {
    it('should score PED waiting appropriately', () => {
      const result = scoreWaitingPeriods(mockPolicy, mockUserProfile);
      
      expect(result.dimension_id).toBe('waiting_periods');
      expect(result.raw_score).toBeGreaterThan(0);
    });

    it('should score ≤24 months PED as excellent', () => {
      const result = scoreWaitingPeriods(mockPolicy, mockUserProfile);
      
      expect(result.raw_score).toBeGreaterThanOrEqual(90);
    });

    it('should return UNAVAILABLE when PED waiting is null', () => {
      const policyNoPED = { ...mockPolicy, ped_waiting_months: null };
      const result = scoreWaitingPeriods(policyNoPED, mockUserProfile);
      
      expect(result.data_confidence).toBe('UNAVAILABLE');
    });
  });
});

describe('Scoring Engine Integration', () => {
  it('should handle missing data gracefully', () => {
    const incompletePolicy: Partial<ExtractedPolicy> = {
      policy_id: 'incomplete-123',
      insurer_id: null,
      insurer_raw_name: 'Unknown Insurer',
      product_name: null,
      document_type: 'UNKNOWN',
      sum_insured: null,
      annual_premium: null,
      extraction_confidence: 'LOW',
      fields_missing: ['sum_insured', 'annual_premium'],
      source_quotes: [],
      raw_text_excerpt: '',
    };
    
    // Should not throw
    expect(() => {
      scoreCoverageAdequacy(incompletePolicy as ExtractedPolicy, {
        age_band: null,
        coverage_need: null,
        city_tier: null,
        pre_existing: [],
        scoring_profile_id: 'balanced',
      });
    }).not.toThrow();
  });
});
