# Two-Tab Coverage Recommendations Spec

**Feature ID:** two-tab-coverage-recommendations  
**Spec Type:** Feature (Requirements-First Workflow)  
**Status:** 📋 Requirements Complete → 🧪 **MVP + A/B Test Required** → ⏭️ Design (if validated)  
**Created:** 2026-04-27  
**Last Updated:** 2026-04-27

---

## ⚠️ CRITICAL: This is a UX/Behavioral Economics Problem

**We are NOT building a feature.** We are **testing a hypothesis** that a "simplicity-first" segment exists and will pay 35% more for easier claims.

**Approach:** Build lightweight MVP → A/B test → Kill or scale based on data.

**Why:** Fintech research shows choice overload kills conversion. We must prove this feature doesn't harm conversion before investing in polish.

---

## Overview

Transform the IndSure health insurance calculator from a single coverage recommendation into a **guided dual-strategy system** that presents:

1. **Cost-Efficient Strategy (Default):** Base + Super Top-Up structure for maximum coverage per rupee
2. **Comprehensive Strategy (Opt-In):** Single large base policy for simpler claims and first-rupee coverage

**Key Design Principle:** NOT symmetrical tabs. One strong default + clearly framed opt-in alternative.

---

## Quick Links

| Document | Purpose | Status |
|----------|---------|--------|
| **[requirements.md](./requirements.md)** | Detailed requirements (12 requirements including A/B test) | ✅ Complete |
| **[research-brief.md](./research-brief.md)** | Research questions for Perplexity | ✅ Complete |
| **[research-findings.md](./research-findings.md)** | Validated market data and implementation parameters | ✅ Complete |
| **[RESEARCH_VALIDATION.md](./RESEARCH_VALIDATION.md)** | Validation summary and confidence levels | ✅ Complete |
| **[VALIDATION_PLAN.md](./VALIDATION_PLAN.md)** | A/B test design, success criteria, decision framework | ✅ Complete |
| **design.md** | Technical design document | ⏳ After MVP validation |

---

## The Hypothesis We're Testing

### What We Know (Validated with Market Data)
✅ Base + super top-up is 30-50% cheaper than equivalent large base  
✅ Large base has objectively simpler claims (no deductible coordination)  
✅ ₹50L base policies are widely available  
✅ Advisors explicitly recognize a "simplicity-first" segment  
✅ Choice overload kills conversion in fintech flows  

### What We Don't Know (Requires A/B Testing)
❓ Will 15-25% of our users choose Comprehensive when shown the trade-off?  
❓ Does showing the alternative harm overall conversion?  
❓ Do Comprehensive choosers have better satisfaction/retention?  
❓ Does the feature pay for itself in LTV?  

### The Test
**Variant A (Control):** Single-strategy flow (Cost-Efficient only)  
**Variant B (Treatment):** Guided dual-strategy (Cost-Efficient default + opt-in to Comprehensive)  

**Success Criteria:**
- Conversion_B ≥ 0.95 × Conversion_A (no more than 5% drop)
- ≥15% of Variant B users view Comprehensive
- ≥50% of viewers select Comprehensive
- Comprehensive choosers show ≥10% higher NPS/renewal (long-term)

**Kill Criteria:**
- Conversion_B < 0.90 × Conversion_A (>10% drop)
- <10% view Comprehensive (no interest)
- <30% of viewers select Comprehensive (no commitment)

See `VALIDATION_PLAN.md` for full test design.

---

## Requirements Summary

### 11 Core Requirements

1. **Dual Strategy Calculation** - Automatic calculation of both strategies
2. **Premium Calculation** - 1.35× multiplier for Comprehensive
3. **Strategy-Specific Reasoning** - Unique value propositions for each
4. **Tab-Based UI** - Mobile-responsive tab interface
5. **Content Display** - Strategy-specific sections that update on tab switch
6. **Database Schema** - Extended to store both strategies
7. **Shared Links** - Preservation of both strategies in UUID-based reports
8. **Calculator Integration** - Seamless generation without additional user input
9. **Mobile Responsiveness** - Full functionality on 320px+ screens
10. **Error Handling** - Graceful fallbacks if one strategy fails
11. **Data Integrity** - Round-trip validation for database persistence

---

## Implementation Scope

### Files to Modify

**Frontend:**
- `frontend/client/src/lib/health-engine-logic.ts` - Add `calculateComprehensive()` function
- `frontend/client/src/pages/calculator-report.tsx` - Add tab UI and state management
- `frontend/client/src/pages/calculator.tsx` - Calculate both strategies before save

**Backend:**
- `backend/server/routes.ts` - Update save/retrieve endpoints for dual strategies

**Database:**
- `calculator_reports.result_data` - JSONB column already supports nested objects (no schema change needed)

---

## Validated Copy

### Cost-Efficient Tab
**Headline:** "High Cover at Lower Premium (Base + Super Top-Up)"  
**Tagline:** "Maximum coverage per rupee – the smart money choice"

**Key Messages:**
- Typically 30-50% cheaper than large base policy
- Super top-up costs ₹120-200 per lakh vs ₹2,400-3,600 for base
- Common advisor recommendation for budget-conscious families
- Works best with stable base (personal or corporate)

### Comprehensive Tab
**Headline:** "Simpler Claims with One Large Base Cover"  
**Tagline:** "One policy. Complete protection. Zero complexity."

**Key Messages:**
- First-rupee coverage up to ₹50L (no deductible threshold)
- Single pre-authorization, one insurer, fewer coordination steps
- Premium ~35% higher but many find peace of mind worth it
- Ideal for those prioritizing hassle-free claims

---

## Research Confidence

### High Confidence (Ready to Implement)
✅ Premium multiplier: 1.35×  
✅ Base policy cap: ₹50L  
✅ Claims complexity positioning  
✅ Default tab selection  
✅ Copy and messaging  

### Medium Confidence (Directional)
⚠️ Age-specific multipliers (range validated, exact bands need live APIs)  
⚠️ SI distribution percentages (platform-specific, not IRDAI-wide)

### Known Limitations
- No IRDAI-wide claim approval rate comparison
- Premium examples from 2024-2025 (rates update frequently)
- Deductible mechanics vary slightly by insurer

---

## Next Steps

### Phase 1: MVP Build (Current - 1 week)
- [ ] Dual calculation in `health-engine-logic.ts`
- [ ] Simple opt-in UI (button/link, not polished)
- [ ] A/B test infrastructure (variant assignment, event logging)
- [ ] Analytics tracking (view, select, convert events)

**NOT in scope for MVP:**
- Polished UI/UX
- Mobile optimization beyond basic responsiveness
- Comprehensive reasoning copy (reuse Cost-Efficient with tweaks)
- Full database schema changes

### Phase 2: A/B Test (2-4 weeks)
- [ ] Deploy to production with 50/50 split
- [ ] Monitor metrics daily (conversion, view rate, selection rate)
- [ ] Collect qualitative feedback (support tickets, user interviews)
- [ ] Make go/no-go decision based on data

### Phase 3: Decision Point (Week 4-6)
**If validated (conversion maintained, segment exists):**
- [ ] Polish UI (expandable section, smooth animations)
- [ ] Write comprehensive reasoning copy
- [ ] Full mobile optimization
- [ ] Deploy to 100% of users
- [ ] Monitor long-term LTV metrics

**If not validated (conversion drops, no segment):**
- [ ] Kill feature immediately
- [ ] Revert to single-strategy flow
- [ ] Document learnings
- [ ] Try alternative approach (post-report upsell, contextual recommendation, education-first)

### Phase 4: Long-Term Monitoring (If shipped - 6-12 months)
- [ ] Track post-purchase NPS by strategy
- [ ] Track claim satisfaction by strategy
- [ ] Track renewal rate by strategy
- [ ] Decide whether to keep, kill, or refine based on LTV data

---

## Success Criteria

The feature is complete when:

1. ✅ Users see two tabs on the report page
2. ✅ Both strategies are calculated automatically
3. ✅ Premium differential is ~35% (Comprehensive vs Cost-Efficient)
4. ✅ Tab switching is instant and preserves all data
5. ✅ Shared report links show both strategies
6. ✅ Mobile experience is fully functional
7. ✅ Copy and messaging is IRDAI-compliant
8. ✅ Error handling gracefully manages calculation failures

---

## Research Sources

**Primary Data:**
- Ditto Insurance premium charts (HDFC ERGO, Care Health, Aditya Birla)
- NYVO super top-up explainer
- PolicyBazaar SI distribution (FY19-FY24)
- Business Standard market analysis
- Reddit r/IndiaInvestments, r/indiahealthinsurance
- IRDAI policy wordings
- Major insurer websites (ICICI, Star, Care, HDFC, Niva Bupa)

**Data Vintage:** 2024-2026

---

## Contact & Questions

For questions about this spec:
1. Review the requirements document first
2. Check research findings for data validation
3. Refer to research validation summary for confidence levels

---

*This spec is ready for the Design phase. All critical assumptions have been validated with market data.*
