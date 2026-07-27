// Blog posts data with full content following the IndSure Blog Writing Framework
import {
  BookOpen,
  AlertCircle,
  TrendingUp,
  Lightbulb,
  Heart,
  Shield,
  Car,
  Home,
  Plane,
  Briefcase,
  Building2,
  Users,
  FileText,
  Wallet,
  Globe,
  HelpCircle,
} from "lucide-react";
import {
  article9Content,
  article9FAQs,
  article10Content,
  article10FAQs,
  article11Content,
  article11FAQs,
  article12Content,
  article12FAQs,
  article13Content,
  article13FAQs,
  article14Content,
  article14FAQs,
  article15Content,
  article15FAQs,
  article16Content,
  article16FAQs,
  article17Content,
  article17FAQs,
  article18Content,
  article18FAQs,
  article19Content,
  article19FAQs,
  article20Content,
  article20FAQs,
  article21Content,
  article21FAQs,
  article22Content,
  article22FAQs,
  article23Content,
  article23FAQs,
  article24Content,
  article24FAQs,
  article25Content,
  article25FAQs,
  article26Content,
  article26FAQs,
  article27Content,
  article27FAQs,
  article28Content,
  article28FAQs ,
} from "./article-content";

export interface BlogPost {
  id: number;
  title: string;
  excerpt: string;
  author: string;
  date: string;
  readTime: string;
  category: "Education" | "Tips" | "Guide" | "Health Insurance" | "Life Insurance" | "Vehicle Insurance" | "Home Insurance" | "Travel Insurance" | "Business Insurance" | "General";
  icon: any;
  featured: boolean;
  content?: string; // Full HTML content
  tags?: string[]; // Optional tags
  insuranceType?: "Health" | "Life" | "Vehicle" | "Home" | "Travel" | "Business" | "General";
  featuredImage?: string; // Featured image URL
  faqs?: Array<{ question: string; answer: string }>; // FAQ items // Number of reads // Percentage who found it helpful // Number of shares
}

// Article 1: Understanding Health Insurance Sufficiency
const article1Content = `
<div class="blog-article-content">
  <p><strong>Your ₹10L policy might be enough. Or it might leave you bankrupt.</strong></p>

  <p>The difference? Nobody explained what "sufficient" means for YOU.</p>

  <p>Meet Arun. 35. Bangalore. Works in IT, makes ₹18L a year. Bought a ₹10L health policy because "that's what most people buy."</p>

  <p>He felt safe — until his father needed cardiac bypass surgery at Apollo Hospital, Bangalore.</p>

  <p>Total cost: ₹8.5L. Arun's policy: ₹10L. Should cover it, right?</p>

  <p><strong>Wrong.</strong></p>

  <p>The surgery was covered. But room rent was capped at ₹3,500/day, and Apollo charged ₹5,200/day. Over a 12-day stay, that gap alone was ₹20,400 out-of-pocket.</p>

  <p>Then a complication meant an extended ICU stay — another ₹2L. Total out-of-pocket: ₹2.2L.</p>

  <p>Arun had ₹10L of coverage and still paid ₹2.2L himself. Because "sufficient" isn't just the sum insured number. It's whether the policy matches YOUR life.</p>

  <h2 id="what-arun-thought-vs-reality">Here's What Arun Thought vs Reality</h2>

  <blockquote>
    <p><strong>What Arun thought:</strong> "I have ₹10L coverage. That's enough for any medical emergency. I'm in Bangalore, not Mumbai, so costs are lower. ₹10L should be safe."</p>
  </blockquote>

  <blockquote>
    <p><strong>What actually happened:</strong> Bangalore's healthcare costs have risen 40% in 3 years. A major cardiac procedure at a good hospital costs ₹8-12L. Room rent caps, sub-limits, and co-pays mean your ₹10L never pays out a full ₹10L in the real world.</p>
  </blockquote>

  <h2 id="sufficiency-not-about-the-number">Sufficiency: It's Not About the Number</h2>

  <p>Sufficiency isn't "Do I have ₹10L or ₹20L?" It's "Will this policy protect ME when I need it?" That depends on:</p>
  <ul>
    <li>Your city's actual healthcare costs (Mumbai ≠ Bangalore ≠ Pune)</li>
    <li>Your age (older = higher risk = more coverage needed)</li>
    <li>Your family size (4 people sharing ₹10L ≠ 1 person with ₹10L)</li>
    <li>Pre-existing conditions (diabetes, hypertension = higher claim risk)</li>
    <li>Policy gaps (room rent caps, sub-limits, co-pays)</li>
  </ul>

  <h3 id="calculating-your-sufficiency">Calculating YOUR Sufficiency</h3>

  <p><strong>Step 1: Worst-case scenario.</strong> Think of the most expensive procedure you might realistically face:</p>
  <ul>
    <li>Age 35-45: cardiac, cancer, major accident</li>
    <li>Age 45-60: cardiac, cancer, organ issues</li>
    <li>Age 60+: multiple procedures, extended ICU</li>
  </ul>
  <p>For Arun (35, Bangalore): cardiac bypass = ₹10L worst-case.</p>

  <p><strong>Step 2: City multiplier.</strong> Bangalore is Tier-1, where costs run 30-40% higher than Tier-2 cities. Base cost × 1.3 = city-adjusted cost. Arun's ₹10L worst-case × 1.3 = ₹13L needed.</p>

  <p><strong>Step 3: Policy gaps.</strong> Room rent caps, sub-limits, and co-pays shrink your effective coverage:</p>
  <ul>
    <li>Room rent gap: ₹20-30K (12-day stay)</li>
    <li>Sub-limits on specific procedures: ₹50K-1L</li>
    <li>Co-pay (if any): 10-20% of the claim</li>
  </ul>
  <p>Arun's effective coverage: ₹10L − ₹30K in gaps = ₹9.7L.</p>

  <p><strong>Arun's optimal coverage: ₹15-18L.</strong> Not ₹10L. Not ₹20L. A number based on HIS life, HIS city, HIS risks.</p>

  <h2 id="what-arun-did">What Arun Did (And What You Should Do)</h2>

  <p>After his father's surgery, Arun did the math and realized his ₹10L base policy wasn't enough. His fix: keep the ₹10L base policy (already paid for) and add a ₹5L top-up for ₹2,800 extra per year.</p>

  <p>Now he has ₹15L total coverage. That's ₹0.56 per ₹1,000 of extra protection. Worth it.</p>

  <p><strong>Your action plan:</strong></p>
  <ol>
    <li>Calculate your worst-case scenario (age, city, family size)</li>
    <li>Add 30% for the city multiplier (if metro)</li>
    <li>Add 10% as an inflation buffer</li>
    <li>Subtract 5-10% for policy gaps (room rent, sub-limits)</li>
    <li>That's your optimal coverage amount</li>
  </ol>

  <p>Arun could have caught this gap before the surgery — the numbers were sitting in his policy document the whole time.</p>

  <p>Generic advice ends here. The gap that actually hurts is written into YOUR policy — find out what yours says before you're in a hospital bed, not after.</p>
</div>
`;

// Article 2: Top 5 Gaps in Health Insurance
const article2Content = `
<div class="blog-article-content">
  <p><strong>Your policy covers cancer. But only ₹5L of it. You need ₹12L.</strong></p>

  <p>Welcome to the gap nobody sees coming.</p>

  <p>Meet Neha. 48. Mumbai. School principal, ₹12L household income. Bought a ₹15L health policy because "cancer is covered."</p>

  <p>Last month, she was diagnosed with breast cancer. Stage 2. Treatable, but expensive.</p>

  <p>Chemotherapy: ₹6L. Surgery: ₹4L. Radiation: ₹2L. Total: ₹12L.</p>

  <p>Her policy covers ₹15L. Should be fine, right?</p>

  <p><strong>Wrong.</strong></p>

  <p>Her policy has a cancer sub-limit: ₹5L. That's all the insurer will pay for cancer treatment, even though her total SI is ₹15L.</p>

  <p>Out-of-pocket: ₹7L. On a ₹12L income, that's 58% of her annual salary.</p>

  <p>Neha thought she was protected. She wasn't. Nobody explained that "covered" doesn't mean "fully covered."</p>

  <h2 id="five-gaps-that-hurt-most">The 5 Gaps That Hurt Most</h2>

  <h3 id="disease-specific-sub-limits">1. Disease-Specific Sub-Limits</h3>
  <p>Your policy says "cancer covered." Buried on page 47: "Cancer treatment sub-limit: ₹5L." Even with ₹20L coverage, cancer gets only ₹5L. Everything beyond that is out-of-pocket.</p>

  <h3 id="room-rent-caps">2. Room Rent Caps</h3>
  <p>Your policy covers ₹10L, but room rent is capped at ₹3,500/day while Mumbai hospitals charge ₹5,500/day. Daily gap: ₹2,000. A 10-day stay: ₹20,000 out-of-pocket.</p>

  <h3 id="missing-riders">3. Missing Riders</h3>
  <p>Your base policy covers hospitalization. Maternity, critical illness, personal accident? Those aren't gaps — they're coverage you might need that simply isn't there.</p>

  <h3 id="waiting-periods">4. Waiting Periods</h3>
  <p>You just bought a policy. Your father needs cardiac care next month. Claim denied — waiting period. Most policies have a 30-day general wait and a 24-36 month pre-existing disease wait.</p>

  <h3 id="opd-exclusions">5. OPD Exclusions</h3>
  <p>Your policy covers hospitalization. Routine diabetes checkups? Not covered. Annual cost: ₹15-20K out-of-pocket.</p>

  <h2 id="how-to-check-your-policy">How to Check YOUR Policy</h2>

  <p><strong>Step 1: Find your policy document.</strong> Download it from your insurer's website or dig it out of your email.</p>

  <p><strong>Step 2: Search for these terms:</strong></p>
  <ul>
    <li>"Sub-limit" or "disease-specific limit"</li>
    <li>"Room rent" or "accommodation"</li>
    <li>"Waiting period"</li>
    <li>"OPD" or "out-patient"</li>
    <li>"Rider" or "add-on"</li>
  </ul>

  <p>Neha could have caught her cancer sub-limit before the diagnosis. The clause was always there — in fine print nobody translated for her.</p>

  <p>Generic advice ends here. These five gaps are real, but which ones apply to you is written in YOUR policy — go check what it actually says.</p>
</div>
`;

// Article 3: How to Choose Right Sum Insured for Your City
const article3Content = `
<div class="blog-article-content">
  <p><strong>Mumbai's ₹10L and Delhi's ₹10L are NOT the same coverage.</strong></p>

  <p>Here's why your city matters more than you think.</p>

  <p>Same procedure. Same ₹10L policy. Different cities. Different outcomes.</p>

  <p>Cardiac bypass in Mumbai: ₹12L. Your ₹10L policy? You pay ₹2L out-of-pocket.</p>

  <p>Same procedure in Pune: ₹8L. Your ₹10L policy? Fully covered.</p>

  <p>The difference is your city's healthcare costs. They vary by 40-60% across India.</p>

  <h2 id="real-costs-by-city">Real Costs by City (January 2026)</h2>

  <table>
    <thead>
      <tr>
        <th>City</th>
        <th>Cardiac bypass</th>
        <th>Cancer treatment</th>
        <th>Room rent/day</th>
        <th>Recommended SI</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Mumbai (Tier 1 - Metro)</td>
        <td>₹10-15L</td>
        <td>₹18-28L</td>
        <td>₹5,500-6,500</td>
        <td><strong>₹20-25L</strong></td>
      </tr>
      <tr>
        <td>Delhi/Bangalore (Tier 1 - Metro)</td>
        <td>₹8-13L</td>
        <td>₹15-24L</td>
        <td>₹4,800-6,000</td>
        <td><strong>₹18-22L</strong></td>
      </tr>
      <tr>
        <td>Pune/Hyderabad (Tier 2)</td>
        <td>₹6-9L</td>
        <td>₹12-18L</td>
        <td>₹3,500-4,500</td>
        <td><strong>₹15-18L</strong></td>
      </tr>
      <tr>
        <td>Tier 3 cities</td>
        <td>₹5-8L</td>
        <td>₹10-15L</td>
        <td>₹2,500-3,500</td>
        <td><strong>₹10-12L</strong></td>
      </tr>
    </tbody>
  </table>

  <h2 id="what-to-do-right-now">What to Do Right Now</h2>

  <p><strong>Step 1: Identify your city tier.</strong> Are you in a metro, Tier-2, or Tier-3 city?</p>

  <p><strong>Step 2: Check your current SI.</strong> Open your policy document and find "Sum Insured" or "Coverage Amount." Compare it against the row for your city.</p>

  <p>Your city's healthcare costs aren't something you can change. Your coverage is.</p>

  <p>Generic advice ends here — a table can tell you the market rate, but only YOUR policy document says what you're actually covered for. Go check the number.</p>
</div>
`;

// Article 4: Room Rent Caps (Detailed version)
const article4Content = `
<div class="blog-article-content">
  <p><strong>You're in the hospital. Surgery was ₹4 lakhs. Your policy? ₹10 lakhs. Should cover it, right?</strong></p>

  <p>Wrong.</p>

  <p>The insurer sends a letter: room rent claim denied. Your policy covers ₹3,500/day, but the hospital charged ₹5,000/day. Out-of-pocket: ₹30,000.</p>

  <p>This is the gap nobody talks about.</p>

  <p>Meet Priya. 45, Mumbai, works in IT. Bought a ₹10L ICICI policy because it seemed solid — good reviews, affordable premium. Never read the fine print.</p>

  <p>Last month, her mother had a cardiac episode. Apollo Hospital, South Mumbai. CABG surgery. World-class care. ₹4.5L total cost.</p>

  <p>Here's what Priya found when she filed the claim:</p>
  <ul>
    <li>Hospital room: ₹5,000/day (semi-private, standard in Mumbai)</li>
    <li>Her policy limit: ₹3,500/day</li>
    <li>Daily gap: ₹1,500</li>
    <li>7-day stay: ₹10,500 out-of-pocket</li>
  </ul>

  <p>She had ₹10L of coverage and still paid ₹10.5K from pocket. Because nobody explained what that ₹3,500 meant in her city.</p>

  <h2 id="room-rent-cap-what-is-it">Room Rent Cap: What Is It, Really?</h2>

  <p>Your policy says: "Room rent covered up to ₹3,500/day."</p>

  <p>Meaning: for every day you're hospitalized, the insurer pays up to ₹3,500 of your room charges. If the hospital charges ₹5,000, you cover the ₹1,500 difference.</p>

  <p>Why the cap? Room costs vary wildly — a private room costs ₹2,000/day in Delhi and ₹6,000/day in Mumbai. Insurers manage that risk by setting a cap based on the "expected" room cost in your area.</p>

  <p>The catch: their "expected" cost is often outdated or too low for major metros.</p>

  <h2 id="where-room-rent-caps-hurt-most">Where Room Rent Caps Hurt Most</h2>

  <p><strong>1. Metro cities (Mumbai, Delhi, Bangalore).</strong> Actual room cost: ₹5,000-6,000/day. Average policy limit: ₹3,500/day. Gap exposure: ₹20-30K possible.</p>

  <p><strong>2. Multi-day procedures.</strong> Cancer treatment means a 10-14 day stay — a gap of ₹15-20K. Complications extend the stay and the gap.</p>

  <p><strong>3. Private hospitals.</strong> Apollo, Fortis, Reliance run ₹5-7K/day. If availability forces you private, the gap can hit ₹40-50K.</p>

  <h2 id="what-to-do-right-now">What to Do Right Now</h2>

  <p><strong>Step 1: Know your city's room rent reality.</strong> Find 2-3 major hospitals in your city. Website → Patient info → Tariffs/Room charges. Write down the semi-private room cost — that's what you'll likely use.</p>

  <p><strong>Step 2: Check your policy.</strong> Search the document for "Room rent," "Accommodation limit," or "Room charges." Write down: ₹______/day.</p>

  <p><strong>Step 3: Calculate your gap.</strong> Example: city average ₹4,500/day, policy limit ₹3,500/day. Daily gap: ₹1,000. Over an average 7-day stay: ₹7,000 out of your pocket.</p>

  <p>Priya could have caught this gap before the surgery. The cap was printed in her policy the whole time — just never explained.</p>

  <p>Generic advice ends here. Your room rent cap is one line in YOUR policy document — find it before the hospital finds it for you.</p>
</div>
`;

// Article 5: Pre-Existing Diseases & Waiting Periods
const article5Content = `
<div class="blog-article-content">
  <p><strong>You have diabetes for 10 years. You finally buy insurance. Diabetes is excluded. For 3 years. How is that fair?</strong></p>

  <p>Waiting periods aren't punishment. They're insurance math. But they suck.</p>

  <p>Meet Rajesh. 45. Diagnosed with Type 2 diabetes in September 2024, bought a policy in March 2025. When a kidney complication hit in August 2025 — only 5 months into the policy — the claim was denied.</p>

  <p>Reason: his pre-existing disease waiting period (36 months) was still active. The diabetes diagnosis (Sept 2024) came before the policy (March 2025), so the clock doesn't reset.</p>

  <h2 id="why-waiting-periods-exist">Why Waiting Periods Exist</h2>

  <p>Insurers need to protect against "adverse selection" — people buying insurance only once they know they're sick. Waiting periods make the system ungameable.</p>

  <p>Fair in aggregate. Painful when you're the one waiting.</p>

  <h2 id="types-of-waiting-periods">Types of Waiting Periods</h2>

  <p><strong>1. General waiting period (30 days).</strong> Applies to all diseases except accidents, for the first 30 days from policy start. Buy a policy on Jan 1, get hospitalized Jan 15 — claim denied, you're only 15 days in.</p>

  <p><strong>2. Pre-existing disease waiting period (24-48 months).</strong> Applies to any disease you had before buying the policy; duration varies by insurer. Rajesh's diabetes, diagnosed before the policy, meant a 36-month wait.</p>

  <p><strong>3. Disease-specific waiting period (12-48 months).</strong> Applies to listed conditions like cataract, hernia, and joint replacement — even if you don't have them yet. Cataract surgery typically carries a 24-month wait.</p>

  <h2 id="strategy-buy-now-not-later">Strategy: Buy NOW, Not Later</h2>

  <p>The best time to buy insurance is when you're healthy. Once you're diagnosed, every policy you buy afterwards starts the waiting-period clock from zero.</p>

  <p>Rajesh should have bought in 2023, before his diagnosis. Now he's stuck waiting 36 months.</p>

  <p><strong>Your action plan:</strong></p>
  <ol>
    <li>Buy insurance NOW, even if you're healthy</li>
    <li>If you have pre-existing conditions, check waiting periods before buying</li>
    <li>Some insurers waive the PED wait for the first ₹50K/year — ask</li>
    <li>Don't wait until you need it — by then, it's too late</li>
  </ol>

  <p>Rajesh could have avoided all of this. He just didn't know what his waiting periods said until the denial letter arrived.</p>

  <p>Generic advice ends here. Your waiting periods — how long, for what — are spelled out in YOUR policy. Read them before you need them.</p>
</div>
`;

// Article 6: Family Floater vs Individual Policies
const article6Content = `
<div class="blog-article-content">
  <p><strong>You bought a ₹25L family floater. Your mom got sick. ₹20L used. Now your kid needs appendicitis surgery. Not enough left.</strong></p>

  <p>Family floater is NOT always cheaper. You might need both.</p>

  <p>Meet the Sharma family. Father (45), mother (42), son (12), daughter (8). Bought a ₹25L family floater because "it's cheaper than individual policies."</p>

  <p>Last year, mother had cardiac surgery. ₹20L used. ₹5L remaining in the floater.</p>

  <p>This year, son needs appendicitis surgery. ₹3L cost. ₹5L remaining should cover it, right?</p>

  <p><strong>Wrong.</strong></p>

  <p>Appendicitis surgery at a good hospital: ₹3.5L. With complications, it went to ₹6L. The floater had only ₹5L left. Out-of-pocket: ₹1L.</p>

  <h2 id="family-floater-basics">Family Floater Basics</h2>

  <p>Family floater = one shared pool. All members draw from the same ₹25L. If one person uses ₹20L, everyone else shares the remaining ₹5L.</p>

  <p>Cost: ₹12-15K/year for ₹25L covering 4 people.</p>

  <h2 id="individual-policy-basics">Individual Policy Basics</h2>

  <p>Individual policy = separate coverage per person. Each person gets their own ₹10L. One person exhausting theirs leaves everyone else untouched.</p>

  <p>Cost: ₹4-5K/year per person × 4 = ₹16-20K/year for ₹40L total.</p>

  <h2 id="real-comparison">Real Comparison</h2>

  <p><strong>Scenario A: No claims.</strong> Floater ₹25L costs ₹12K/year — cheaper. Individual ₹10L each costs ₹18K/year.</p>

  <p><strong>Scenario B: One major claim.</strong> Floater: ₹20L used, ₹5L left for the whole family — risky. Individual: one person used their ₹10L, everyone else still has ₹10L each — safer.</p>

  <h2 id="when-each-works">When Each Works</h2>

  <p><strong>Family floater works if:</strong></p>
  <ul>
    <li>Young, healthy family (low claim risk)</li>
    <li>Budget is tight (₹12K vs ₹18K)</li>
    <li>You're okay with shared risk</li>
  </ul>

  <p><strong>Individual policies work if:</strong></p>
  <ul>
    <li>Multiple people have pre-existing conditions</li>
    <li>You want guaranteed coverage per person</li>
    <li>Budget allows (₹18K vs ₹12K)</li>
  </ul>

  <p><strong>Hybrid approach (recommended):</strong> Floater ₹20L + individual ₹5L per person. Cost: ₹14K/year. Coverage: ₹20L shared plus ₹5L per person guaranteed. Best of both worlds.</p>

  <p>The Sharmas could have avoided the gap. Nobody told them that floater means shared risk.</p>

  <p>Generic advice ends here. Whether your family is one bad year away from an empty pool depends on what YOUR policy says — go look at the structure you actually bought.</p>
</div>
`;

// Article 7: Restoration Benefit
const article7Content = `
<div class="blog-article-content">
  <p><strong>You claimed ₹8L and exhausted your SI. Bad luck strikes again that year. Can you claim again?</strong></p>

  <p>If your policy has restoration: YES. If not: you're paying the second bill yourself.</p>

  <p>Meet Vikram. 38, Mumbai, IT professional. Has a ₹10L policy. January 2026: cardiac surgery, ₹7L — his ₹10L SI is exhausted.</p>

  <p>June 2026: cancer diagnosis. Treatment needed: ₹12L.</p>

  <p>Without restoration: ₹0 coverage left. Out-of-pocket: ₹12L.</p>

  <p>With restoration: SI restored to ₹10L, claimable again. Out-of-pocket: ₹2L. Much better.</p>

  <h2 id="what-restoration-is">What Restoration Is</h2>

  <p>Restoration means your sum insured gets replenished after you exhaust it — typically once per policy year.</p>

  <p>Cost: usually free (built into the premium) or ₹500-1,000 extra per year.</p>

  <h2 id="restoration-limitations">Limitations</h2>

  <ul>
    <li>Typically only once per year</li>
    <li>Not always automatic — check your policy</li>
    <li>Some policies restore only for unrelated diseases</li>
    <li>Some have a waiting period before restoration activates</li>
  </ul>

  <h2 id="compare-insurers">Compare Insurers</h2>

  <p><strong>ICICI: unlimited restoration.</strong> Can restore multiple times per year, no limit. The best on this feature.</p>

  <p><strong>HDFC: twice per year.</strong> Better than most.</p>

  <p><strong>Apollo: limited, premium-based.</strong> Restoration is available but costs extra — check whether it's worth it for you.</p>

  <p>Vikram's policy had restoration. It saved him ₹10L. Without it, he'd be bankrupt.</p>

  <p>Generic advice ends here. Restoration is a single clause that decides whether a second bad diagnosis ruins you — check whether YOUR policy has it, and on what terms.</p>
</div>
`;

// Article 8: Cashless vs Reimbursement
const article8Content = `
<div class="blog-article-content">
  <p><strong>Your hospital isn't empaneled. Insurer says: "We won't pay." But if you understand reimbursement, you can pay yourself and get ₹8L back later.</strong></p>

  <p>Cashless sounds better. But reimbursement gives you choice.</p>

  <p>Meet Anjali. 32, Delhi, marketing professional. Needs cardiac surgery. The best surgeon in Delhi works at a non-empaneled hospital.</p>

  <p>Option A: empaneled hospital (cashless) — average surgeon, ₹6L cost.</p>

  <p>Option B: non-empaneled hospital (reimbursement) — best surgeon, ₹8L cost, paid upfront.</p>

  <p>She chose Option B. Paid ₹8L upfront, got ₹7.5L reimbursed within policy limits. The difference bought her the best surgeon. Worth it.</p>

  <h2 id="cashless-how-it-works">Cashless: How It Works</h2>

  <p>The insurer pays the hospital directly. You pay nothing upfront.</p>

  <p><strong>Pros:</strong></p>
  <ul>
    <li>No upfront payment</li>
    <li>Simpler process</li>
    <li>Less paperwork</li>
  </ul>

  <p><strong>Cons:</strong></p>
  <ul>
    <li>Limited to empaneled hospitals</li>
    <li>No negotiation power</li>
    <li>Can't choose the best doctor if their hospital isn't empaneled</li>
  </ul>

  <h2 id="reimbursement-how-it-works">Reimbursement: How It Works</h2>

  <p>You pay the hospital, submit bills, and the insurer refunds you 30-45 days later.</p>

  <p><strong>Pros:</strong></p>
  <ul>
    <li>Any hospital — your choice</li>
    <li>You control the treatment decisions</li>
    <li>You can negotiate with the hospital</li>
  </ul>

  <p><strong>Cons:</strong></p>
  <ul>
    <li>Upfront cost (₹5-10L)</li>
    <li>Waiting 30-45 days for the refund</li>
    <li>More paperwork</li>
  </ul>

  <h2 id="documents-needed-for-reimbursement">Documents Needed for Reimbursement</h2>

  <ul>
    <li>Discharge summary (from the hospital)</li>
    <li>Itemized bill (breakdown of all charges)</li>
    <li>Medical reports (test results, doctor notes)</li>
    <li>Proof of payment (bank statement, receipt)</li>
    <li>Claim form (from the insurer's website)</li>
  </ul>

  <h2 id="speed-up-reimbursement">Timeline: How to Speed Up Reimbursement</h2>

  <p><strong>Step 1: Submit within 7 days.</strong> Don't wait — send all documents within 7 days of discharge.</p>

  <p><strong>Step 2: Follow up weekly.</strong> Call the insurer every week. Ask for status. Push.</p>

  <p><strong>Step 3: Escalate if delayed.</strong> Past 45 days, escalate with an IRDAI complaint.</p>

  <p>Anjali could have settled for an average surgeon and cashless convenience. She chose the best surgeon instead — and reimbursement made that choice possible.</p>

  <p>Generic advice ends here. Which hospitals are empaneled, what gets reimbursed, and within what limits — that's all written in YOUR policy. Check it before the emergency, not during.</p>
</div>
`;

export const blogPosts: BlogPost[] = [
  {
    id: 1,
    title: "Understanding Health Insurance Sufficiency: A Complete Guide",
    excerpt: "Your ₹10L policy might be enough. Or it might leave you bankrupt. The difference? Nobody explained what 'sufficient' means for YOU.",
    author: "IndSure Team",
    date: "2026-02-05",
    readTime: "3 min read",
    category: "Education",
    icon: BookOpen,
    featured: true,
    content: article1Content,
  },
  {
    id: 2,
    title: "Top 5 Gaps in Health Insurance Policies You Should Know",
    excerpt: "Your policy covers cancer. But only ₹5L of it. You need ₹12L. Welcome to the gap nobody sees coming.",
    author: "IndSure Team",
    date: "2026-02-19",
    readTime: "2 min read",
    category: "Tips",
    icon: AlertCircle,
    featured: true,
    content: article2Content,
  },
  {
    id: 3,
    title: "How to Choose the Right Sum Insured for Your City",
    excerpt: "Mumbai's ₹10L and Delhi's ₹10L are NOT the same coverage. Here's why your city matters more than you think.",
    author: "IndSure Team",
    date: "2026-03-05",
    readTime: "1 min read",
    category: "Guide",
    icon: TrendingUp,
    featured: false,
    content: article3Content,
  },
  {
    id: 4,
    title: "Room Rent Caps: The Hidden Cost in Your Policy",
    excerpt: "You're in the hospital. Surgery was ₹4 lakhs. Your policy? ₹10 lakhs. Should cover it, right? Wrong. The insurer sends a letter: Room rent claim denied.",
    author: "IndSure Team",
    date: "2026-03-19",
    readTime: "2 min read",
    category: "Education",
    icon: Lightbulb,
    featured: false,
    content: article4Content,
  },
  {
    id: 5,
    title: "Pre-Existing Diseases: Waiting Periods Explained",
    excerpt: "You have diabetes for 10 years. You finally buy insurance. Diabetes is excluded. For 3 years. How is that fair? Waiting periods aren't punishment. They're insurance math. But they suck.",
    author: "IndSure Team",
    date: "2026-04-09",
    readTime: "2 min read",
    category: "Education",
    icon: BookOpen,
    featured: false,
    content: article5Content,
  },
  {
    id: 6,
    title: "Family Floater vs Individual Policies: Which is Better?",
    excerpt: "You bought a ₹25L family floater. Your mom got sick. ₹20L used. Now your kid needs appendicitis surgery. ₹8L remaining. Not enough. Family floater is NOT always cheaper.",
    author: "IndSure Team",
    date: "2026-04-30",
    readTime: "2 min read",
    category: "Guide",
    icon: TrendingUp,
    featured: false,
    content: article6Content,
  },
  {
    id: 7,
    title: "Restoration Benefit: What It Means and Why It Matters",
    excerpt: "You claimed ₹8L and exhausted your SI. Bad luck strikes again that year. Can you claim again? If your policy has restoration: YES. If not: You're ₹500K out of pocket.",
    author: "IndSure Team",
    date: "2026-05-21",
    readTime: "1 min read",
    category: "Education",
    icon: Lightbulb,
    featured: false,
    content: article7Content,
  },
  {
    id: 8,
    title: "Cashless vs Reimbursement: Understanding Claim Processes",
    excerpt: "Your hospital isn't empaneled. Insurer says: 'We won't pay.' But if you understand reimbursement, you can pay yourself and get ₹8L back later. Cashless sounds better. But reimbursement gives you choice.",
    author: "IndSure Team",
    date: "2026-06-11",
    readTime: "2 min read",
    category: "Tips",
    icon: AlertCircle,
    featured: false,
    content: article8Content,
  },
  // 20 Pillar Articles - Added from Article Briefs
  {
    id: 9,
    title: "What Is Health Insurance? A Complete Guide for Indians",
    excerpt: "Understanding health insurance in India. Learn how it works, what it covers, room limits, co-pay, and why ₹5L+ healthcare costs make insurance essential—not optional.",
    author: "IndSure Team",
    date: "2026-02-10",
    readTime: "4 min read",
    category: "Health Insurance",
    icon: Heart,
    featured: true,
    insuranceType: "Health",
    tags: ["Health Insurance", "Pillar Article", "Guide"],
    content: article9Content,
    faqs: article9FAQs,
    featuredImage: "/images/blog/health-insurance-guide.jpg",
  },
  {
    id: 10,
    title: "What Is Life Insurance? Complete Guide for Indian Families",
    excerpt: "If you die today, is your family financially secure? Life insurance is your family's safety net. Learn about term life, whole life, endowment plans, and what ₹1cr coverage actually means for your loved ones.",
    author: "IndSure Team",
    date: "2026-03-03",
    readTime: "4 min read",
    category: "Life Insurance",
    icon: Shield,
    featured: true,
    insuranceType: "Life",
    tags: ["Life Insurance", "Pillar Article", "Family Protection"],
    content: article10Content,
    faqs: article10FAQs,
    featuredImage: "/images/blog/life-insurance-guide.jpg",
  },
  {
    id: 11,
    title: "Car Insurance Explained: Third-Party vs Comprehensive",
    excerpt: "Accident statistics show why vehicle insurance isn't optional. Understand third-party (mandatory) vs comprehensive coverage, no-claim bonus, deductibles, and how to save ₹5k+ while staying protected.",
    author: "IndSure Team",
    date: "2026-03-24",
    readTime: "3 min read",
    category: "Vehicle Insurance",
    icon: Car,
    featured: true,
    insuranceType: "Vehicle",
    tags: ["Vehicle Insurance", "Car Insurance", "Motor Insurance"],
    content: article11Content,
    faqs: article11FAQs,
    featuredImage: "/images/blog/car-insurance-explained.jpg",
  },
  {
    id: 12,
    title: "Home Insurance Explained: Building vs Contents Coverage",
    excerpt: "Your ₹50L home is likely your biggest asset. Fire, theft, floods—home insurance protects your investment. Learn building vs contents coverage, landlord insurance, and what's actually covered.",
    author: "IndSure Team",
    date: "2026-04-14",
    readTime: "2 min read",
    category: "Home Insurance",
    icon: Home,
    featured: false,
    insuranceType: "Home",
    tags: ["Home Insurance", "Property Insurance", "Building Insurance"],
    content: article12Content,
    faqs: article12FAQs,
    featuredImage: "/images/blog/home-insurance-explained.jpg",
  },
  {
    id: 13,
    title: "Travel Insurance Explained: Domestic vs International",
    excerpt: "Flight cancelled? Medical emergency abroad? Lost baggage? Travel insurance = peace of mind. Learn what's covered, what's not, and when ₹500 insurance saves you ₹2L+.",
    author: "IndSure Team",
    date: "2026-05-12",
    readTime: "2 min read",
    category: "Travel Insurance",
    icon: Plane,
    featured: false,
    insuranceType: "Travel",
    tags: ["Travel Insurance", "International Travel", "Trip Insurance"],
    content: article13Content,
    faqs: article13FAQs,
    featuredImage: "/images/blog/travel-insurance-explained.jpg",
  },
  {
    id: 14,
    title: "What Is General Insurance? Types Explained",
    excerpt: "General insurance covers everything except life: health, vehicle, home, travel, business. Understand the broad category and how it differs from life insurance in India.",
    author: "IndSure Team",
    date: "2026-06-09",
    readTime: "1 min read",
    category: "General",
    icon: FileText,
    featured: false,
    insuranceType: "General",
    tags: ["General Insurance", "Education"],
    content: article14Content,
    faqs: article14FAQs,
    featuredImage: "/images/blog/general-insurance-types.jpg",
  },
  {
    id: 15,
    title: "Health Insurance vs Mediclaim: What's the Difference?",
    excerpt: "Mediclaim vs health insurance—same thing? Not exactly. Understand the differences, evolution in India, and which one suits your needs better.",
    author: "IndSure Team",
    date: "2026-02-10",
    readTime: "1 min read",
    category: "Health Insurance",
    icon: Heart,
    featured: false,
    insuranceType: "Health",
    tags: ["Health Insurance", "Mediclaim", "Comparison"],
    content: article15Content,
    faqs: article15FAQs,
    featuredImage: "/images/blog/health-vs-mediclaim.jpg",
  },
  {
    id: 16,
    title: "Term Life Insurance Basics: Pure Protection Explained",
    excerpt: "Term life is the cheapest, purest form of life insurance. ₹500/month for ₹1cr coverage. Understand why it's perfect for young professionals and families—and what you're actually buying.",
    author: "IndSure Team",
    date: "2026-03-05",
    readTime: "2 min read",
    category: "Life Insurance",
    icon: Shield,
    featured: false,
    insuranceType: "Life",
    tags: ["Term Life", "Life Insurance", "Basics"],
    content: article16Content,
    faqs: article16FAQs,
    featuredImage: "/images/blog/term-life-basics.jpg",
  },
  {
    id: 17,
    title: "Property Insurance Explained: Commercial & Residential",
    excerpt: "Protect your property investments—commercial or residential. Learn about property damage coverage, liability, rent loss, and how property insurance differs from home insurance.",
    author: "IndSure Team",
    date: "2026-03-26",
    readTime: "1 min read",
    category: "Home Insurance",
    icon: Building2,
    featured: false,
    insuranceType: "Home",
    tags: ["Property Insurance", "Commercial Property"],
    content: article17Content,
    faqs: article17FAQs,
    featuredImage: "/images/blog/property-insurance.jpg",
  },
  {
    id: 18,
    title: "Personal Accident Insurance: Complete Guide",
    excerpt: "Accidents happen. Personal accident insurance covers death, disability, and medical expenses from accidents—separate from health insurance. Learn what ₹5L coverage actually means.",
    author: "IndSure Team",
    date: "2026-04-16",
    readTime: "1 min read",
    category: "General",
    icon: AlertCircle,
    featured: false,
    insuranceType: "General",
    tags: ["Personal Accident", "Accident Insurance"],
    content: article18Content,
    faqs: article18FAQs,
    featuredImage: "/images/blog/personal-accident.jpg",
  },
  {
    id: 19,
    title: "Business Insurance 101: Protecting Your Enterprise",
    excerpt: "Your business needs protection too. From fire to liability, business insurance covers risks that could shut down your company. Learn what types exist and what you actually need.",
    author: "IndSure Team",
    date: "2026-05-07",
    readTime: "1 min read",
    category: "Business Insurance",
    icon: Briefcase,
    featured: false,
    insuranceType: "Business",
    tags: ["Business Insurance", "Enterprise"],
    content: article19Content,
    faqs: article19FAQs,
    featuredImage: "/images/blog/business-insurance.jpg",
  },
  {
    id: 20,
    title: "Liability Insurance Explained: Professional & General",
    excerpt: "When you're liable for damages—professional errors, public injuries, product defects—liability insurance protects you. Understand professional indemnity, public liability, and product liability.",
    author: "IndSure Team",
    date: "2026-05-28",
    readTime: "1 min read",
    category: "Business Insurance",
    icon: AlertCircle,
    featured: false,
    insuranceType: "Business",
    tags: ["Liability Insurance", "Professional Indemnity"],
    content: article20Content,
    faqs: article20FAQs,
    featuredImage: "/images/blog/liability-insurance.jpg",
  },
  {
    id: 21,
    title: "Workers Compensation Insurance: Employer's Guide",
    excerpt: "Employers are legally required to cover employees for workplace injuries. Workers compensation insurance protects both you and your team. Learn what's mandatory and what's recommended.",
    author: "IndSure Team",
    date: "2026-06-18",
    readTime: "1 min read",
    category: "Business Insurance",
    icon: Users,
    featured: false,
    insuranceType: "Business",
    tags: ["Workers Compensation", "Employer Liability"],
    content: article21Content,
    faqs: article21FAQs,
    featuredImage: "/images/blog/workers-compensation.jpg",
  },
  {
    id: 22,
    title: "Marine & Cargo Insurance: Shipping Protection",
    excerpt: "Importing or exporting goods? Marine insurance covers cargo in transit—by sea, air, or land. Learn about coverage, exclusions, and when ₹50k insurance protects ₹50L shipments.",
    author: "IndSure Team",
    date: "2026-02-26",
    readTime: "1 min read",
    category: "Business Insurance",
    icon: Globe,
    featured: false,
    insuranceType: "Business",
    tags: ["Marine Insurance", "Cargo Insurance"],
    content: article22Content,
    faqs: article22FAQs,
    featuredImage: "/images/blog/marine-cargo-insurance.jpg",
  },
  {
    id: 23,
    title: "Cyber Insurance: Protecting Digital Assets",
    excerpt: "Data breaches cost companies crores. Cyber insurance covers hacking, ransomware, data loss, and liability from cyberattacks. Essential for businesses in the digital age.",
    author: "IndSure Team",
    date: "2026-03-12",
    readTime: "1 min read",
    category: "Business Insurance",
    icon: Shield,
    featured: false,
    insuranceType: "Business",
    tags: ["Cyber Insurance", "Data Protection"],
    content: article23Content,
    faqs: article23FAQs,
    featuredImage: "/images/blog/cyber-insurance.jpg",
  },
  {
    id: 24,
    title: "What Is Reinsurance? The Insurance for Insurers",
    excerpt: "Insurance companies need insurance too. Reinsurance spreads risk across multiple insurers. Understand how it works and why it matters for policyholders.",
    author: "IndSure Team",
    date: "2026-04-02",
    readTime: "1 min read",
    category: "General",
    icon: HelpCircle,
    featured: false,
    insuranceType: "General",
    tags: ["Reinsurance", "Education"],
    content: article24Content,
    faqs: article24FAQs,
    featuredImage: "/images/blog/reinsurance-explained.jpg",
  },
  {
    id: 25,
    title: "Retirement & Pension Plans: Securing Your Future",
    excerpt: "Retirement planning isn't just savings—it's insurance-backed pension plans. Understand annuity plans, pension schemes, and how to secure ₹50L+ for retirement.",
    author: "IndSure Team",
    date: "2026-04-23",
    readTime: "1 min read",
    category: "Life Insurance",
    icon: Wallet,
    featured: false,
    insuranceType: "Life",
    tags: ["Pension Plans", "Retirement", "Annuity"],
    content: article25Content,
    faqs: article25FAQs,
    featuredImage: "/images/blog/pension-retirement-plans.jpg",
  },
  {
    id: 26,
    title: "Agricultural Insurance: Crop Protection Explained",
    excerpt: "Farmers face weather risks, pests, and crop failures. Agricultural insurance protects against losses. Learn about PMFBY, crop insurance, and what ₹10k premium covers.",
    author: "IndSure Team",
    date: "2026-05-14",
    readTime: "1 min read",
    category: "General",
    icon: TrendingUp,
    featured: false,
    insuranceType: "General",
    tags: ["Agricultural Insurance", "Crop Insurance"],
    content: article26Content,
    faqs: article26FAQs,
    featuredImage: "/images/blog/agricultural-insurance.jpg",
  },
  {
    id: 27,
    title: "Micro-Insurance: Affordable Protection for All",
    excerpt: "Low-income households need insurance too. Micro-insurance offers affordable, simplified coverage—₹100/month for health, ₹50/month for life. Learn what's available and how it works.",
    author: "IndSure Team",
    date: "2026-06-04",
    readTime: "1 min read",
    category: "General",
    icon: Users,
    featured: false,
    insuranceType: "General",
    tags: ["Micro-Insurance", "Affordable Insurance"],
    content: article27Content,
    faqs: article27FAQs,
    featuredImage: "/images/blog/micro-insurance.jpg",
  },
  {
    id: 28,
    title: "Top Types of Insurance: Complete Overview",
    excerpt: "A comprehensive guide to all insurance types in India—health, life, vehicle, home, travel, business, and more. Understand what each covers and when you need it.",
    author: "IndSure Team",
    date: "2026-06-25",
    readTime: "1 min read",
    category: "General",
    icon: BookOpen,
    featured: true,
    insuranceType: "General",
    tags: ["Overview", "Hub Article", "All Types"],
    content: article28Content,
    faqs: article28FAQs,
    featuredImage: "/images/blog/insurance-types-overview.jpg",
  },
];
