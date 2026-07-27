# Requirements Document

## Introduction

This document specifies the requirements for implementing a **guided dual-strategy recommendation system** in the IndSure health insurance calculator. The system will present users with a **strong default recommendation** (Cost-Efficient: base + super top-up) plus an **opt-in alternative** (Comprehensive: single large base) for users who prioritize claims simplicity over cost savings.

**Design Philosophy:** This is a **UX and behavioral economics problem**, not a feature parity problem. We are testing the hypothesis that a "simplicity-first" segment exists and will pay 35% more for easier claims, without harming overall conversion through choice overload.

**Research Status:** ✅ Market data validated (2024-2026) + ⚠️ User behavior hypotheses require A/B testing  
**Research Date:** 2026-04-27  
**Research Source:** Perplexity deep research covering Ditto Insurance, NYVO, PolicyBazaar, IRDAI, Reddit forums, major insurer data, plus fintech choice overload literature  
**Confidence Level:** High on market data, Medium on user behavior - **MVP approach required**

See `research-findings.md` for detailed validation data and sources.

## Glossary

- **Calculator_Engine**: The health insurance calculation logic module (`health-engine-logic.ts`)
- **Report_Page**: The calculator results display page (`calculator-report.tsx`)
- **Calculator_Page**: The user input collection page (`calculator.tsx`)
- **Backend_API**: The server-side API handling report persistence (`routes.ts`)
- **Cost_Efficient_Strategy**: Coverage approach using base policy (50% of total, capped at ₹20L) + super top-up for remaining coverage - **the default recommendation**
- **Comprehensive_Strategy**: Coverage approach using single large base policy (85% of total coverage, capped at ₹50L) with minimal or no top-up - **the opt-in alternative for simplicity-first users**
- **Coverage_Strategy**: A complete recommendation including base cover, top-up (if any), total protection, premium estimate, and reasoning
- **Guided_Choice_UI**: UI pattern that presents one strong default with a clearly framed opt-in alternative, avoiding symmetrical choice overload
- **Strategy_Toggle**: UI element allowing users to opt into the Comprehensive strategy (NOT a symmetrical tab component)
- **Strategy_Calculation**: The process of computing coverage structure, premium estimates, and reasoning for a given strategy type
- **Report_UUID**: Unique identifier for a saved calculator report
- **Database_Record**: Persisted calculator report containing inputs, both strategies, and metadata
- **Conversion_Drag**: Measurable decrease in completion rate caused by additional choices in high-stakes financial flows
- **Simplicity_Segment**: Users who prioritize claims ease over cost savings (hypothesized at 15-25% of target persona)

## Requirements

### Requirement 1: Dual Strategy Calculation

**User Story:** As a user completing the calculator, I want the system to automatically calculate both cost-efficient and comprehensive coverage strategies, so that I can compare different approaches to coverage.

#### Acceptance Criteria

1. WHEN THE Calculator_Engine receives user inputs, THE Calculator_Engine SHALL calculate the Cost_Efficient_Strategy using the existing base + super top-up logic
2. WHEN THE Calculator_Engine receives user inputs, THE Calculator_Engine SHALL calculate the Comprehensive_Strategy using a single large base policy approach
3. THE Comprehensive_Strategy SHALL use a base policy cap of ₹50 Lakhs (validated as widely available from ICICI Lombard, Star Health, HDFC ERGO, Care Health, Niva Bupa)
4. THE Comprehensive_Strategy SHALL allocate 85% of total coverage to the base policy (vs 50% in Cost_Efficient)
5. THE Comprehensive_Strategy SHALL include a super top-up only when the gap exceeds ₹10 Lakhs
6. THE Comprehensive_Strategy premium estimate SHALL be 1.35× the Cost_Efficient_Strategy premium (validated market differential: 1.3-1.5×)
7. FOR ALL valid user inputs, THE Calculator_Engine SHALL return both strategies in a single result object
8. THE Calculator_Engine SHALL preserve all existing calculation logic for the Cost_Efficient_Strategy (backward compatibility)

**Data Source:** Major Indian insurers (ICICI Lombard, Star Health, Care Health, HDFC ERGO, Niva Bupa) offer base policies up to ₹1 Crore; ₹50L is standard for "large base" segment per advisor guidance.

### Requirement 2: Strategy-Specific Premium Calculation

**User Story:** As a user, I want to see accurate premium estimates for each strategy, so that I understand the cost difference between approaches.

#### Acceptance Criteria

1. WHEN calculating the Comprehensive_Strategy premium, THE Calculator_Engine SHALL apply a 1.35× premium multiplier to reflect the higher cost of large base policies (validated range: 1.3-1.5× based on market data)
2. THE premium calculation SHALL account for the reduced or eliminated super top-up cost in the Comprehensive_Strategy
3. THE premium estimate SHALL include monthly and annual ranges (min/max) for both strategies
4. THE 5-year premium projection SHALL be calculated separately for each strategy
5. THE premium calculation SHALL maintain all existing adjustments (family floater discount, PED loading, metro loading) for both strategies
6. FOR ALL strategies, THE premium estimate SHALL be based on the base policy sum insured, not the total protection amount
7. THE premium multiplier MAY be adjusted by age band (1.30× for 18-30, 1.35× for 31-45, 1.40× for 46-60, 1.45× for 60+) for increased accuracy

**Data Source:** Market research from Ditto Insurance, NYVO, and PolicyBazaar premium charts (2024-2026) shows base+super top-up structures are 30-50% cheaper than equivalent large base policies across all age bands.

### Requirement 3: Strategy-Specific Reasoning

**User Story:** As a user, I want to understand why each strategy is recommended and when it makes sense, so that I can make an informed decision.

#### Acceptance Criteria

1. THE Cost_Efficient_Strategy reasoning SHALL emphasize "maximum coverage per rupee", "30-50% cheaper than large base", and "smart money" positioning
2. THE Comprehensive_Strategy reasoning SHALL emphasize "simpler claims process", "first-rupee coverage", "no deductible coordination", and "fewer moving parts"
3. THE Cost_Efficient_Strategy reasoning SHALL explain the base + super top-up structure and quantify cost savings (e.g., "Super top-up costs ₹120-200 per lakh vs ₹2,400-3,600 per lakh for base cover")
4. THE Comprehensive_Strategy reasoning SHALL explain the benefits of a single large base policy and when it's worth the premium (e.g., "Single pre-authorization, one insurer, no coordination delays")
5. THE reasoning for each strategy SHALL be contextual to the user's inputs (age, family structure, risk posture, income)
6. THE reasoning SHALL include at least 4-6 distinct points per strategy
7. THE reasoning SHALL NOT duplicate content between strategies — each must have unique value propositions
8. THE reasoning SHALL use IRDAI-compliant language (relative claims like "often more cost-efficient" rather than absolutes like "best")

**Data Source:** Market research confirms base+super top-up is 30-50% cheaper (Ditto, NYVO premium charts); advisor consensus and Reddit user experiences validate claims complexity differences.

### Requirement 4: Guided Choice UI Display (NOT Symmetrical Tabs)

**User Story:** As a user viewing my report, I want to see a strong default recommendation with the option to view a simpler alternative if I'm willing to pay more, so that I can make an informed choice without feeling overwhelmed.

#### Acceptance Criteria

1. THE Report_Page SHALL display the Cost_Efficient_Strategy as the **primary, default recommendation** with full details visible on page load
2. THE Report_Page SHALL display a **clearly framed opt-in control** (toggle, expandable section, or secondary CTA) that allows users to view the Comprehensive_Strategy
3. THE opt-in control SHALL use language that frames the trade-off explicitly: "Prefer one simple policy? Pay ~35% more for easier claims" or similar
4. THE opt-in control SHALL NOT present both strategies as equally weighted choices (avoiding symmetrical tabs that imply equal validity)
5. WHEN a user activates the opt-in control, THE Report_Page SHALL display the Comprehensive_Strategy details
6. THE UI SHALL maintain visual hierarchy: Cost-Efficient is "recommended", Comprehensive is "alternative for simplicity-first users"
7. THE UI SHALL be mobile-responsive and accessible (keyboard navigation, ARIA labels, screen reader support)
8. THE strategy switch SHALL be instant (no loading state) since both strategies are pre-calculated
9. THE UI SHALL log user interaction: did user view Comprehensive? did user switch to it? (for A/B test measurement)

**Design Rationale:** Fintech choice overload research shows symmetrical options kill conversion in high-stakes flows. Guided choice with clear default + opt-in alternative preserves conversion while serving the simplicity segment.

**Data Source:** PolicyBazaar data shows base+top-up is mainstream (34.6% platform premiums); advisor guidance explicitly positions large base as "only if simplicity matters more than savings".

### Requirement 5: Strategy-Specific Content Display

**User Story:** As a user, I want to see all relevant details for the selected strategy, so that I have complete information to make my decision.

#### Acceptance Criteria

1. WHEN a strategy tab is selected, THE Report_Page SHALL display the base cover, super top-up, total protection, and premium estimate for that strategy
2. WHEN a strategy tab is selected, THE Report_Page SHALL display the strategy-specific reasoning section
3. WHEN a strategy tab is selected, THE Report_Page SHALL display the strategy-specific 5-year premium projection
4. THE coverage breakdown section (worst-case, inflation buffer, multi-incident buffer) SHALL remain the same for both strategies
5. THE riders section SHALL remain the same for both strategies (riders are independent of coverage structure)
6. THE common mistakes and sensitivity analysis sections SHALL remain the same for both strategies
7. THE corporate gap banner (if applicable) SHALL remain the same for both strategies
8. THE Report_Page SHALL NOT show duplicate content — only strategy-specific sections should change when switching tabs

### Requirement 6: Database Schema Extension

**User Story:** As a system, I want to persist both coverage strategies in the database, so that shared report links preserve both options.

#### Acceptance Criteria

1. THE Backend_API SHALL accept a `result_data` object containing both `costEfficient` and `comprehensive` strategy objects
2. THE `calculator_reports` table SHALL store both strategies in the `result_data` JSONB column
3. WHEN saving a report, THE Backend_API SHALL validate that both strategies are present in the result_data
4. WHEN retrieving a report by UUID, THE Backend_API SHALL return both strategies in the response
5. THE database schema SHALL remain backward compatible — existing reports with single-strategy data SHALL still be retrievable
6. THE Backend_API SHALL return a 400 error if `result_data` is missing either strategy object

### Requirement 7: Shared Report Link Preservation

**User Story:** As a user sharing my report, I want the recipient to see both coverage strategies, so that they can review both options.

#### Acceptance Criteria

1. WHEN a user shares a report link (UUID-based), THE Report_Page SHALL load both strategies from the database
2. THE shared report SHALL display the same Tab_Component with both strategies
3. THE shared report SHALL default to the "Cost-Efficient (Optimal)" tab
4. THE shared report SHALL preserve all user inputs and calculated values for both strategies
5. WHEN a shared report is accessed, THE Report_Page SHALL NOT recalculate strategies — it SHALL use the persisted data
6. THE shared report SHALL display the same success banner behavior as a freshly generated report (if accessed within 5 seconds of save)

### Requirement 8: Calculator Page Integration

**User Story:** As a user completing the calculator, I want the system to automatically generate both strategies without additional input, so that I don't have to make choices before seeing the options.

#### Acceptance Criteria

1. THE Calculator_Page SHALL call the Calculator_Engine with user inputs exactly once
2. THE Calculator_Engine SHALL return both strategies in a single calculation pass
3. THE Calculator_Page SHALL pass both strategies to the Backend_API save endpoint
4. THE Calculator_Page SHALL NOT require any new user inputs to generate both strategies
5. THE Calculator_Page SHALL display the same loading state ("Analysing 140+ Policy Combinations...") regardless of dual strategy calculation
6. THE calculation time SHALL NOT increase noticeably (target: <100ms additional processing time)

### Requirement 9: Mobile Responsiveness

**User Story:** As a mobile user, I want to easily switch between strategies and view all details, so that I have the same experience as desktop users.

#### Acceptance Criteria

1. THE Tab_Component SHALL be fully functional on mobile devices (touch-friendly, no hover-only interactions)
2. THE tab labels SHALL be readable and tappable on screens as small as 320px wide
3. THE coverage tiles SHALL stack vertically on mobile and remain readable
4. THE strategy-specific reasoning SHALL be readable without horizontal scrolling on mobile
5. THE 5-year premium projection table SHALL be horizontally scrollable on mobile if needed
6. THE Tab_Component SHALL use mobile-appropriate spacing and font sizes
7. THE active tab indicator SHALL be clearly visible on mobile devices

### Requirement 10: Error Handling and Fallbacks

**User Story:** As a user, I want the system to handle errors gracefully, so that I can still view my report even if one strategy fails to calculate.

#### Acceptance Criteria

1. IF the Comprehensive_Strategy calculation fails, THE Calculator_Engine SHALL return only the Cost_Efficient_Strategy and log the error
2. IF only one strategy is available, THE Report_Page SHALL hide the Tab_Component and display the available strategy
3. IF the Backend_API receives a report with only one strategy, THE Backend_API SHALL save it successfully (backward compatibility)
4. IF a shared report contains only one strategy, THE Report_Page SHALL display it without tabs
5. THE Calculator_Page SHALL display a user-friendly error message if both strategies fail to calculate
6. THE error message SHALL include a "Retry" button that re-runs the calculation
7. THE system SHALL log all calculation errors to the console for debugging

### Requirement 12: A/B Test Instrumentation (CRITICAL FOR VALIDATION)

**User Story:** As a product manager, I want to measure whether the guided dual-strategy UI improves or harms conversion and user outcomes, so that I can make data-driven decisions about the feature.

#### Acceptance Criteria

1. THE system SHALL support two variants for A/B testing:
   - **Variant A (Control):** Single-strategy flow showing only Cost_Efficient_Strategy
   - **Variant B (Treatment):** Guided dual-strategy flow with Cost_Efficient as default + opt-in to Comprehensive
2. THE system SHALL randomly assign users to variants with 50/50 split (or configurable ratio)
3. THE system SHALL log the following events for each user session:
   - Variant assigned (A or B)
   - Report page loaded (timestamp)
   - Comprehensive strategy viewed (Y/N, timestamp) - Variant B only
   - Strategy selected for "Compare Plans" or "Analyze Policy" CTA (Cost_Efficient or Comprehensive)
   - Session abandoned (no CTA clicked within 5 minutes)
4. THE system SHALL persist variant assignment and user choices in the database for cohort analysis
5. THE system SHALL NOT show the Comprehensive option in Variant A (true control)
6. THE system SHALL calculate and expose the following metrics per variant:
   - Conversion rate: % of users who clicked a CTA
   - Comprehensive view rate: % of Variant B users who viewed Comprehensive (Variant B only)
   - Comprehensive selection rate: % of Variant B users who selected Comprehensive (Variant B only)
   - Time to decision: median time from page load to CTA click
7. THE A/B test SHALL run for minimum 2 weeks or 1,000 users per variant (whichever comes first)
8. THE system SHALL support post-purchase tracking:
   - Strategy purchased (if user completes purchase)
   - Post-claim NPS/CSAT (if user files claim)
   - Renewal rate at 12 months

**Success Criteria for Feature Validation:**
- **Minimum bar:** Conversion_B ≥ 0.95 × Conversion_A (no more than 5% conversion drop)
- **Segment validation:** ≥15% of Variant B users who view Comprehensive select it
- **LTV hypothesis:** Comprehensive selectors show ≥10% higher NPS or renewal rate (measured post-launch)

**Kill Criteria:**
- Conversion_B < 0.90 × Conversion_A (>10% conversion drop)
- <5% of Variant B users view Comprehensive (no interest in alternative)
- Comprehensive selectors show no difference in satisfaction/retention

**Data Source:** Fintech choice overload research shows 67-340% conversion improvements from reducing options; we must prove this feature doesn't harm conversion.
