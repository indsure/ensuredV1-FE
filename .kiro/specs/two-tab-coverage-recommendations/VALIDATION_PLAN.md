# Feature Validation Plan: Guided Dual-Strategy UI

**Status:** 📋 Pre-Implementation Validation Required  
**Approach:** A/B Test with Clear Success/Kill Criteria  
**Timeline:** 2-4 weeks (2 weeks test + 2 weeks analysis)

---

## The Core Hypothesis

**We believe** that a "simplicity-first" segment exists (15-25% of users) who will pay 35% more for easier claims.

**We will test** whether showing them a guided opt-in alternative (Comprehensive strategy) increases overall value without harming conversion.

**We will measure** conversion rate, segment size, and post-purchase satisfaction.

---

## Why This Validation Approach?

### What We Know (Validated)
✅ Base + super top-up is 30-50% cheaper (market data)  
✅ Large base has simpler claims (advisor consensus, forum evidence)  
✅ ₹50L base policies are widely available (insurer data)  
✅ Advisors explicitly recognize a "simplicity-first" segment  

### What We Don't Know (Requires Testing)
❓ Will 15-25% of our users choose Comprehensive when shown the trade-off?  
❓ Does showing the alternative harm overall conversion?  
❓ Do Comprehensive choosers have better satisfaction/retention?  
❓ Does the feature pay for itself in LTV?  

### Why Not Just Ship It?
**Choice overload is real:** Fintech research shows adding options can kill conversion by 50%+ in high-stakes flows.

**The risk:** We spend 2-3 weeks building a full feature that:
- Reduces conversion by 15%
- Only 3% of users choose Comprehensive
- No measurable LTV benefit

**The smart approach:** Build lightweight MVP, test with real users, kill or scale based on data.

---

## A/B Test Design

### Variant A: Control (Single Strategy)
**What users see:**
- Calculator report page loads
- Cost-Efficient strategy displayed as "Your Optimized Coverage Plan"
- Full details: base cover, super top-up, total protection, premium, reasoning
- CTAs: "Compare Plans" / "Analyze Existing Policy"

**What we measure:**
- Conversion rate (% who click CTA)
- Time to decision
- Bounce rate

### Variant B: Treatment (Guided Dual Strategy)
**What users see:**
- Calculator report page loads
- Cost-Efficient strategy displayed as "Your Recommended Coverage Plan"
- **NEW:** Opt-in control below main recommendation:
  ```
  💡 Prefer one simple policy with easier claims?
  [View simpler option] (~35% higher premium)
  ```
- If clicked: Comprehensive strategy details expand/replace Cost-Efficient
- CTAs remain the same

**What we measure:**
- Conversion rate (% who click CTA)
- Comprehensive view rate (% who clicked opt-in)
- Comprehensive selection rate (% who chose Comprehensive for CTA)
- Time to decision
- Bounce rate

---

## Success Metrics

### Primary Metric: Conversion Rate
**Definition:** % of users who click "Compare Plans" or "Analyze Policy" within 5 minutes of page load

**Success Criteria:**
- ✅ **Pass:** Conversion_B ≥ 0.95 × Conversion_A (no more than 5% drop)
- ⚠️ **Marginal:** 0.90 ≤ Conversion_B < 0.95 × Conversion_A (5-10% drop, needs LTV justification)
- ❌ **Fail:** Conversion_B < 0.90 × Conversion_A (>10% drop, kill feature)

**Rationale:** We cannot afford to lose >10% conversion for an unproven feature. 5-10% drop might be acceptable if LTV is significantly higher.

### Secondary Metric: Segment Size
**Definition:** % of Variant B users who view Comprehensive strategy

**Success Criteria:**
- ✅ **Pass:** ≥15% view Comprehensive (segment exists and is interested)
- ⚠️ **Marginal:** 10-15% view Comprehensive (small but real segment)
- ❌ **Fail:** <10% view Comprehensive (no interest, kill feature)

**Rationale:** If <10% even look at the alternative, there's no segment to serve.

### Tertiary Metric: Selection Rate
**Definition:** % of Variant B users who select Comprehensive for CTA (among those who viewed it)

**Success Criteria:**
- ✅ **Pass:** ≥50% of viewers select Comprehensive (strong preference when shown)
- ⚠️ **Marginal:** 30-50% select Comprehensive (moderate preference)
- ❌ **Fail:** <30% select Comprehensive (curiosity but no commitment)

**Rationale:** If people view it but don't choose it, the value prop isn't compelling.

### Long-Term Metric: LTV (Post-Purchase)
**Definition:** Post-purchase NPS, claim satisfaction, renewal rate by strategy chosen

**Success Criteria:**
- ✅ **Pass:** Comprehensive choosers show ≥10% higher NPS or renewal rate
- ⚠️ **Marginal:** 5-10% higher NPS/renewal
- ❌ **Fail:** No difference or lower NPS/renewal

**Rationale:** If Comprehensive choosers aren't happier, we're just selling expensive policies.

**Timeline:** Measured 3-12 months post-launch (not blocking for MVP decision)

---

## Sample Size & Duration

### Minimum Sample
- **1,000 users per variant** (2,000 total)
- Assumes baseline conversion ~20% → need 200 conversions per variant for 80% power to detect 5% difference

### Duration
- **2 weeks minimum** (or until sample size reached)
- **4 weeks maximum** (if traffic is low)

### Traffic Split
- **50/50** (Variant A vs Variant B)
- Randomized at session level
- Sticky (same user always sees same variant)

---

## Decision Framework

### Scenario 1: Clear Win ✅
**Data:**
- Conversion_B ≥ 0.95 × Conversion_A
- ≥15% view Comprehensive
- ≥50% of viewers select Comprehensive

**Decision:** **Ship full feature**
- Build polished UI (expandable section or toggle)
- Add analytics tracking
- Monitor long-term LTV metrics
- Consider promoting Comprehensive for high-income segments

### Scenario 2: Marginal Win ⚠️
**Data:**
- 0.90 ≤ Conversion_B < 0.95 × Conversion_A (5-10% drop)
- 10-15% view Comprehensive
- 30-50% of viewers select Comprehensive

**Decision:** **Conditional ship**
- Only ship if we can measure LTV within 3 months
- Set up post-purchase NPS tracking
- If LTV is ≥10% higher → keep feature
- If LTV is flat → kill feature

### Scenario 3: Clear Fail ❌
**Data:**
- Conversion_B < 0.90 × Conversion_A (>10% drop)
- OR <10% view Comprehensive
- OR <30% of viewers select Comprehensive

**Decision:** **Kill feature immediately**
- Revert to single-strategy flow
- Document learnings
- Consider alternative approaches:
  - Post-report upsell ("Want simpler claims? Upgrade here")
  - Contextual recommendation (only show Comprehensive for high-income users)
  - Education-first approach (explain trade-offs without offering choice)

### Scenario 4: Inconclusive 🤷
**Data:**
- Results are close to thresholds
- High variance in metrics
- Sample size too small

**Decision:** **Extend test**
- Run for 2 more weeks
- Increase traffic allocation to 70/30 (favor Treatment to get more Comprehensive data)
- If still inconclusive after 4 weeks → kill feature (not worth the uncertainty)

---

## Implementation Phases

### Phase 1: MVP Build (1 week)
**Scope:**
- Dual calculation in `health-engine-logic.ts`
- Simple opt-in UI (button/link, not polished)
- A/B test infrastructure (variant assignment, event logging)
- Analytics tracking (view, select, convert events)

**NOT in scope:**
- Polished UI/UX
- Mobile optimization
- Comprehensive reasoning copy (can reuse Cost-Efficient with minor tweaks)
- Database schema changes (store both strategies but don't expose in UI for Variant A)

### Phase 2: Test Run (2-4 weeks)
**Activities:**
- Deploy to production with 50/50 split
- Monitor metrics daily
- Watch for bugs or user confusion
- Collect qualitative feedback (support tickets, user interviews)

**Checkpoints:**
- Week 1: Check for technical issues, adjust if needed
- Week 2: Preliminary data review, decide extend/kill/ship
- Week 4: Final decision if extended

### Phase 3: Decision & Action (1 week)
**If Ship:**
- Polish UI (expandable section, smooth animations)
- Write comprehensive reasoning copy
- Add mobile optimization
- Full QA pass
- Deploy to 100% of users

**If Kill:**
- Revert to single-strategy flow
- Document learnings in retrospective
- Archive code for future reference
- Consider alternative approaches

---

## Risks & Mitigations

### Risk 1: Conversion Drop >10%
**Likelihood:** Medium (choice overload is real)  
**Impact:** High (kills feature)  
**Mitigation:**
- Use guided choice UI (not symmetrical tabs)
- Frame alternative clearly ("pay more for simplicity")
- Make opt-in, not default
- Test with small sample first (10% traffic) before full 50/50

### Risk 2: No One Views Comprehensive
**Likelihood:** Low (advisors confirm segment exists)  
**Impact:** High (feature is useless)  
**Mitigation:**
- Make opt-in control visible and compelling
- Use benefit-driven copy ("easier claims" not "alternative option")
- A/B test different framings of the opt-in control

### Risk 3: Technical Issues Skew Results
**Likelihood:** Medium (new code, complex state)  
**Impact:** High (invalid test)  
**Mitigation:**
- Thorough testing before launch
- Monitor error rates daily
- Have rollback plan ready
- Use feature flag for instant disable

### Risk 4: Sample Size Too Small
**Likelihood:** Medium (depends on traffic)  
**Impact:** Medium (inconclusive results)  
**Mitigation:**
- Run for 4 weeks if needed
- Consider paid traffic to accelerate
- Lower success threshold if sample is small (e.g., 15% → 12%)

---

## Qualitative Validation (Parallel Track)

While A/B test runs, conduct **10 user interviews**:

### Interview Protocol
1. Show current single-strategy report
2. Ask: "What would make you more likely to buy?"
3. Show guided dual-strategy mockup
4. Ask: "Would you view the simpler option?"
5. Ask: "Would you pay 35% more for easier claims?"
6. Ask: "Does having two options make this easier or harder?"

### Success Criteria
- ≥5/10 users say they'd view Comprehensive
- ≥3/10 users say they'd choose Comprehensive
- ≥7/10 users say dual option doesn't make it harder

### Use Cases
- Validate copy and framing
- Identify confusion points
- Refine UI before full rollout
- Generate quotes for marketing

---

## Post-Launch Monitoring (If Shipped)

### Week 1-4: Adoption Metrics
- % of users viewing Comprehensive (should stabilize at 15-25%)
- % of users selecting Comprehensive (should stabilize at 50%+ of viewers)
- Conversion rate (should remain ≥95% of baseline)

### Month 3-6: Satisfaction Metrics
- Post-purchase NPS by strategy
- Support ticket rate by strategy
- Claim filing rate by strategy (if any claims occur)

### Month 12: Retention Metrics
- Renewal rate by strategy
- Upsell/cross-sell rate by strategy
- LTV by strategy

### Decision Point: Month 6
**If Comprehensive choosers show ≥10% higher NPS/renewal:**
- Keep feature
- Consider promoting Comprehensive for high-income segments
- Build more sophisticated segmentation (show Comprehensive by default for certain profiles)

**If no difference in NPS/renewal:**
- Kill feature
- Revert to single-strategy flow
- Document that simplicity segment doesn't materialize in practice

---

## Success Definition

**The feature is successful if:**

1. ✅ Conversion rate is maintained (≥95% of baseline)
2. ✅ 15-25% of users view Comprehensive
3. ✅ 50%+ of viewers select Comprehensive
4. ✅ Comprehensive choosers show ≥10% higher NPS or renewal rate (measured at 6-12 months)

**If all 4 criteria are met:** Feature is a clear win, invest in polish and promotion.

**If 3/4 criteria are met:** Feature is marginal, keep but don't invest further.

**If <3 criteria are met:** Feature is a fail, kill and try alternative approach.

---

## Alternative Approaches (If Feature Fails)

### Option A: Post-Report Upsell
Instead of showing both upfront, show Cost-Efficient by default, then:
> "💡 Want easier claims? Upgrade to our hassle-free ₹50L base policy (35% higher premium)"

**Pros:** No choice overload, maintains conversion  
**Cons:** Might feel like sales tactic

### Option B: Contextual Recommendation
Only show Comprehensive when:
- User income >₹20L (can afford it)
- User age >50 (claims more likely)
- User has no corporate cover (needs simplicity)

**Pros:** Targets high-value segment, reduces noise  
**Cons:** Might miss users who would choose it

### Option C: Education-First
Build claim scenario simulator, medical inflation visualizer, hospital bill examples first. Then revisit whether dual strategy is needed.

**Pros:** Solves root problem (understanding)  
**Cons:** Delays this feature, different skillset

---

## Timeline Summary

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| **MVP Build** | 1 week | Lightweight dual-strategy UI + A/B test infrastructure |
| **Test Run** | 2-4 weeks | Data on conversion, segment size, selection rate |
| **Decision** | 1 week | Ship full feature / Kill feature / Try alternative |
| **Polish** (if ship) | 1 week | Production-ready UI, full QA, 100% rollout |
| **Monitor** (if ship) | 6-12 months | LTV metrics, satisfaction, retention |

**Total Time to Decision:** 4-6 weeks  
**Total Time to Full Feature:** 6-8 weeks (if validated)

---

*This validation plan ensures we build the right thing, not just build the thing right.*
