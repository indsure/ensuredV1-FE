# Research Brief: Two-Tab Coverage Recommendations
**Feature:** Health Insurance Calculator - Dual Strategy Display  
**Date:** 2026-04-27  
**Status:** Research Required Before Design Phase

---

## Executive Summary

We are building a two-tab coverage recommendation system for an Indian health insurance calculator. The system will present users with two distinct strategies:

1. **Cost-Efficient Strategy:** Base policy (₹20L cap) + Super Top-Up for remaining coverage
2. **Comprehensive Strategy:** Single large base policy (₹50L cap) with minimal/no top-up

To ensure accurate calculations and positioning, we need market research data on premium pricing, policy caps, and claims processes in the Indian health insurance market.

---

## Research Questions

### PRIORITY 1: Premium Pricing Differential (CRITICAL)

**Context:**  
Our calculator needs to show accurate premium estimates for both strategies. We currently assume the Comprehensive strategy costs ~35% more than the Cost-Efficient strategy, but this needs validation.

**Questions for Perplexity:**

1. **What is the actual premium difference between a large base policy vs base+super top-up structure in India?**
   - Example: Compare ₹50L base policy vs (₹20L base + ₹30L super top-up)
   - Need data for different age bands: 18-30, 31-45, 46-60, 60+
   - Need data for individual vs family floater policies

2. **How do major Indian insurers price super top-up policies relative to base policies?**
   - Specific insurers to research: HDFC Ergo, Star Health, Care Health, ICICI Lombard, Niva Bupa, Max Bupa
   - What is the typical cost per lakh for super top-up vs base cover?
   - Example: If base cover costs ₹10,000 per ₹10L, what does super top-up cost per ₹10L?

3. **Are there published premium calculators or rate cards showing this differential?**
   - Look for insurer websites with premium calculators
   - Look for insurance aggregator data (PolicyBazaar, Coverfox, etc.)
   - Look for IRDAI reports or industry studies

4. **Does the premium differential change based on deductible amount?**
   - Super top-ups typically have deductibles (₹3L, ₹5L, ₹10L)
   - How does deductible selection impact the cost savings?

**Expected Output Format:**
```
Age Band: 31-45
Profile: Individual, Metro city, No PED
Base Policy (₹50L): ₹X per year
Base (₹20L) + Top-Up (₹30L, ₹5L deductible): ₹Y per year
Differential: Z% more expensive for large base
Source: [Insurer name/website]
```

---

### PRIORITY 2: Base Policy Sum Insured Caps (CRITICAL)

**Context:**  
We assume the Comprehensive strategy can use a ₹50L base policy cap (vs ₹20L for Cost-Efficient). We need to validate this is realistic in the Indian market.

**Questions for Perplexity:**

1. **What is the maximum sum insured available for individual base health policies in India (excluding top-ups)?**
   - Check major insurers: HDFC Ergo, Star Health, Care Health, ICICI Lombard, Niva Bupa
   - Are ₹50L base policies commonly available?
   - Are ₹1 Cr base policies available without top-ups?

2. **What is the typical/standard cap for "large base policies" in the Indian market?**
   - What do insurance advisors typically recommend as the maximum base SI?
   - Is there an industry standard or common practice?

3. **Do base policy caps vary by age, family structure, or city tier?**
   - Are there restrictions for senior citizens (60+)?
   - Are there restrictions for family floaters?

4. **What percentage of policies sold in India are above ₹20L base cover?**
   - Market penetration data for high-value base policies
   - Trends over the last 3-5 years

**Expected Output Format:**
```
Insurer: HDFC Ergo
Max Base SI (Individual): ₹X Lakhs
Max Base SI (Family Floater): ₹Y Lakhs
Age Restrictions: [Details]
Source: [Website/Product brochure]
```

---

### PRIORITY 3: Claims Process & Complexity (IMPORTANT)

**Context:**  
Our positioning for the Comprehensive strategy emphasizes "simpler claims" and "no deductible complexity." We need to validate this is a real benefit.

**Questions for Perplexity:**

1. **What are the documented differences in claim settlement between base-only vs base+super top-up policies?**
   - Are there case studies or consumer complaints about top-up claim complications?
   - Do super top-ups have different claim approval rates?
   - Are there processing time differences?

2. **What is the actual policyholder experience when a super top-up activates?**
   - How does the deductible work in practice?
   - Do policyholders need to file separate claims for base and top-up?
   - Are there coordination issues between base and top-up policies?

3. **Do insurance advisors or consumer forums discuss the complexity of base+top-up structures?**
   - Check forums like TeamBHP, Reddit r/IndiaInvestments, MoneyControl forums
   - Check insurance advisor blogs and YouTube channels
   - Look for IRDAI consumer complaints data

4. **Are there any regulatory guidelines or IRDAI circulars on super top-up claim processes?**

**Expected Output Format:**
```
Claim Complexity Factor: [Description]
Evidence: [Case study/complaint/forum discussion]
Impact: [How it affects policyholder experience]
Source: [URL/Reference]
```

---

### PRIORITY 4: Market Adoption & Preferences (NICE TO HAVE)

**Context:**  
Understanding market preferences helps us set the right default tab and messaging.

**Questions for Perplexity:**

1. **What percentage of Indian health insurance buyers choose base+top-up vs single large base?**
   - Industry reports from PolicyBazaar, Coverfox, or insurance companies
   - IRDAI annual reports on product mix

2. **Is there demographic segmentation in strategy preference?**
   - Income-based preferences (< ₹10L, ₹10-20L, ₹20L+)
   - Age-based preferences
   - City tier preferences (Metro vs Tier-1 vs Tier-2)

3. **What do insurance advisors typically recommend and why?**
   - Check advisor blogs, YouTube channels, LinkedIn posts
   - Look for advisor training materials or sales scripts

**Expected Output Format:**
```
Market Share: X% choose base+top-up, Y% choose large base
Demographic: [Income/Age/City tier]
Preference: [Strategy preference]
Reason: [Why this segment prefers this strategy]
Source: [Report/Study]
```

---

### PRIORITY 5: Messaging & Positioning (NICE TO HAVE)

**Context:**  
We want to ensure our copy resonates with Indian consumers and complies with regulations.

**Questions for Perplexity:**

1. **How do Indian insurers position base+top-up vs large base policies in their marketing?**
   - Check insurer websites, brochures, and ads
   - What language do they use?
   - What benefits do they emphasize?

2. **Are there IRDAI guidelines on how these products can be marketed?**
   - Restrictions on claims like "best value" or "optimal"
   - Required disclosures

3. **What messaging resonates with Indian consumers based on market research?**
   - Look for consumer surveys or focus group studies
   - Check insurance aggregator A/B testing results (if published)

**Expected Output Format:**
```
Insurer: [Name]
Product: [Base+Top-Up or Large Base]
Positioning: [Key message]
Language Used: [Specific phrases]
Source: [Website/Brochure URL]
```

---

## Research Methodology Suggestions

### Recommended Sources

1. **Insurer Websites & Premium Calculators:**
   - HDFC Ergo: https://www.hdfcergo.com/
   - Star Health: https://www.starhealth.in/
   - Care Health: https://www.careinsurance.com/
   - ICICI Lombard: https://www.icicilombard.com/
   - Niva Bupa: https://www.nivabupa.com/

2. **Insurance Aggregators:**
   - PolicyBazaar: https://www.policybazaar.com/
   - Coverfox: https://www.coverfox.com/
   - Turtlemint: https://www.turtlemint.com/

3. **Regulatory & Industry Reports:**
   - IRDAI Annual Reports: https://www.irdai.gov.in/
   - IRDAI Consumer Affairs: https://www.irdai.gov.in/consumer-affairs
   - Insurance industry publications (Insurance Times, etc.)

4. **Consumer Forums & Communities:**
   - Reddit r/IndiaInvestments
   - TeamBHP Insurance Forum
   - MoneyControl Forums
   - Quora India Insurance topics

5. **Insurance Advisor Content:**
   - YouTube channels (Ditto Insurance, Insurance Samadhan, etc.)
   - LinkedIn posts from IRDAI-licensed advisors
   - Insurance advisor blogs

### Search Query Templates

For Perplexity, use queries like:

```
"super top up vs base policy premium comparison India 2024"
"maximum sum insured base health policy India"
"super top up claim settlement experience India"
"health insurance base + top up market share India"
"IRDAI guidelines super top up marketing"
```

---

## Deliverables Expected

### For Priority 1 (Premium Differential):
- **Table:** Age band vs Premium differential (%) for base+top-up vs large base
- **Sources:** At least 3 major insurers with actual premium data
- **Confidence Level:** High (based on real premium calculators)

### For Priority 2 (Policy Caps):
- **List:** Maximum base SI available from top 5 insurers
- **Market Standard:** Industry consensus on "large base policy" cap
- **Sources:** Insurer product brochures or websites

### For Priority 3-5:
- **Summary:** Key findings with sources
- **Quotes:** Relevant excerpts from advisors, forums, or reports
- **Confidence Level:** Medium (based on available public information)

---

## Timeline

**Research Phase:** 1-2 days  
**Review & Validation:** 1 day  
**Design Phase Start:** After research approval

---

## Success Criteria

Research is complete when we can confidently answer:

1. ✅ What premium multiplier should we use for Comprehensive strategy? (Currently assumed: 1.35x)
2. ✅ What base policy cap should we use for Comprehensive strategy? (Currently assumed: ₹50L)
3. ✅ Is "simpler claims" a valid positioning for large base policies?
4. ✅ Which tab should be the default? (Currently: Cost-Efficient)
5. ✅ What copy/messaging will resonate with users?

---

## Notes for Researcher

- **Focus on 2024-2026 data** — insurance market changes rapidly
- **Prioritize major insurers** — they represent 70%+ of market
- **Look for actual numbers** — avoid generic statements like "significantly cheaper"
- **Check multiple sources** — cross-validate premium data
- **Note data gaps** — if data isn't available, document that clearly

---

## Contact

For questions about this research brief, refer back to the requirements document at:  
`.kiro/specs/two-tab-coverage-recommendations/requirements.md`
