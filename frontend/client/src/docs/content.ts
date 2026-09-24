/**
 * The advisor docs at /docs, as data.
 *
 * Plain data on purpose: scripts/prerender.mjs bundles this file with esbuild to
 * write every page's text into static HTML for search engines, so it must not
 * import React, icons, or anything under "@/".
 *
 * Writing rules (the Claims Ledger is docs/plans/2026-09-24-advisor-docs.md):
 * - Describe only what a screen shows today. Name buttons by their English label.
 * - Quote no prices. Pricing lives on /advisors/pricing and changes; link to it.
 * - Simple English. Never "AI" or "credits". No em dashes.
 * - Screenshots come from the demo via scripts/capture-docs-screens.mjs. Re-shoot
 *   them when a screen changes, then re-read the page that uses them.
 *
 * Inline text supports **bold** and [label](/path) only.
 */

export type DocBlock =
  | { t: "p"; text: string }
  | { t: "h2"; text: string; id: string }
  | { t: "steps"; items: string[] }
  | { t: "list"; items: string[] }
  | { t: "img"; name: string; alt: string; caption?: string; phone?: boolean }
  | { t: "note"; tone: "tip" | "note" | "warn"; text: string }
  | { t: "faq"; items: { q: string; a: string }[] }
  | { t: "cards"; slugs: string[] }
  | { t: "cta"; kind: "demo" | "signup" | "contact" };

export type DocPage = {
  /** "" is the docs home, /docs. */
  slug: string;
  title: string;
  /** Under 160 characters, contains "IndSure". Used for search engines and link previews. */
  description: string;
  /** One line under the title. */
  lead: string;
  /** Shorter label for the sidebar, when the title is long. */
  nav?: string;
  /** A small tag beside the sidebar label. */
  badge?: string;
  blocks: DocBlock[];
};

export type DocSection = { title: string; pages: DocPage[] };

/** When the text and screenshots were last checked against the product. */
export const DOCS_UPDATED = "2026-09-24";

export const DOC_SECTIONS: DocSection[] = [
  {
    title: "Getting started",
    pages: [
      {
        slug: "",
        nav: "Welcome",
        title: "Welcome to IndSure for advisors",
        description:
          "IndSure advisor docs: what the portal does, how to set it up, how every screen works, and answers to common questions, in simple English.",
        lead: "Everything you need to know about the IndSure advisor portal, in one place.",
        blocks: [
          {
            t: "p",
            text: "IndSure is a workspace for insurance advisors. It keeps every customer and every policy in one place, reads policies and explains them in plain language, shows you which renewals are coming up, and helps you message customers on WhatsApp.",
          },
          { t: "img", name: "dashboard", alt: "The IndSure advisor portal home screen, with policy counts, a feed of checked policies and the sidebar menu.", caption: "The home screen of the advisor portal." },
          { t: "h2", text: "What you can do with it", id: "what-you-can-do" },
          {
            t: "list",
            items: [
              "**Keep your whole book in one place.** Customers, their families, and every policy they hold.",
              "**Check a policy.** Upload a policy PDF and see its limits, waiting periods, caps and gaps in plain language. Health policies get a score out of 100.",
              "**Follow up leads.** Track every person you are talking to, from first call to a closed policy.",
              "**Never miss a renewal.** See what is due, soonest first, and send a reminder on WhatsApp.",
              "**Compare plans.** Put plans side by side and share the comparison with your customer.",
              "**Work out cover.** The Cover Calculator shows how much health cover a family needs.",
              "**Get found.** My Website gives you your own page with your photo, which customers can message you from.",
              "**Run a team.** Agency owners can invite advisors and see their work.",
            ],
          },
          { t: "h2", text: "What IndSure is not", id: "what-it-is-not" },
          {
            t: "p",
            text: "IndSure does not sell insurance. We are not an IRDAI-registered broker or agent, and we do not earn commission on any policy you sell. You pay a flat subscription, and there is a free plan. See [Plans and policy checks](/docs/plans).",
          },
          { t: "h2", text: "Where to start", id: "where-to-start" },
          { t: "cards", slugs: ["create-account", "portal-tour", "demo", "check-a-policy"] },
          { t: "cta", kind: "demo" },
        ],
      },
      {
        slug: "create-account",
        title: "Create your account",
        description: "How to sign up for the IndSure advisor portal: the invite code, your details, choosing your insurers, and what happens next.",
        lead: "Signing up takes a few minutes and two short screens.",
        blocks: [
          { t: "h2", text: "What you need", id: "what-you-need" },
          {
            t: "list",
            items: [
              "An **invite code**. Sign-up asks for one. If you do not have one, see [below](#no-invite-code).",
              "Your full name, email address, 10-digit mobile number and city.",
              "A password of at least 8 characters, with one capital letter and one number.",
            ],
          },
          { t: "h2", text: "Step 1: Your details", id: "step-1" },
          { t: "img", name: "signup-step1", alt: "The sign-up screen asking whether you are an individual advisor or an agency, then for an invite code and your details.", caption: "Step 1 of sign-up." },
          {
            t: "steps",
            items: [
              "Go to [indsure.in/agent](/agent) and press **Start free**.",
              "Choose **Individual advisor** if it is just you, or **Agency / Enterprise** if other advisors work under you.",
              "Paste your invite code. It is checked as soon as you enter it, and a message tells you if there is a problem with it.",
              "Fill in your name, email, phone number and city, and choose a password.",
              "Tick the box to agree to the Terms of Service and Privacy Policy. The box for product updates is your choice.",
              "Press **Continue to Empanelment**.",
            ],
          },
          { t: "note", tone: "tip", text: "If the page refreshes halfway, your details are kept in that browser tab, so you can carry on where you left off. Your password is never kept." },
          { t: "h2", text: "Step 2: Your insurers", id: "step-2" },
          {
            t: "p",
            text: "Pick every insurer you are empanelled with. This puts those insurers first in places like the Rider Directory. You can change the list any time from **My Profile**.",
          },
          { t: "h2", text: "What happens next", id: "what-next" },
          {
            t: "p",
            text: "You go straight into the portal. There is no email to confirm first. Next time, log in at [indsure.in/agent/login](/agent/login) with your email and password.",
          },
          { t: "img", name: "login", alt: "The advisor login screen with email and password fields and a Forgot password link.", caption: "The login screen." },
          {
            t: "p",
            text: "If you chose **Agency / Enterprise**, your account works straight away as well. Our team sets up your agency and confirms the number of seats with you.",
          },
          { t: "h2", text: "No invite code?", id: "no-invite-code" },
          {
            t: "p",
            text: "Press **Don't have an invite code? Request access** on the sign-up screen, or message us on WhatsApp to ask for one.",
          },
          { t: "h2", text: "Joining an agency's team", id: "joining-a-team" },
          {
            t: "p",
            text: "If an agency owner invited you, open the link they sent. It fills in your email and code for you. An invite link works only for the email address it was sent to, can be used once, and expires after 7 days.",
          },
          { t: "cards", slugs: ["portal-tour", "troubleshooting"] },
        ],
      },
      {
        slug: "portal-tour",
        nav: "Portal tour",
        title: "A tour of the portal",
        description: "Find your way around the IndSure advisor portal: the menu, the home screen, the phone layout and the Hindi language switch.",
        lead: "Where everything is, on a computer and on a phone.",
        blocks: [
          { t: "h2", text: "The menu", id: "menu" },
          {
            t: "p",
            text: "On a computer, the menu sits on the left. Groups open when you press them, so you only see what you need.",
          },
          {
            t: "list",
            items: [
              "**Check a Policy**: the green button at the top. The thing you will do most, always one press away.",
              "**Home**: your Overview, and **Needs Attention** for policies that are still being read or could not be read.",
              "**Insights**: how your book is moving.",
              "**People**: **Customers**, **Leads** and **Renewals**.",
              "**Policies**: every policy, with quick filters for Health, Life, Term, Motor and Others.",
              "**Services**: **Compare Policies**, **Cover Calculator**, **Surrender Values**, **Claims** and **My Website**.",
              "**My Agency**: only for agency owners. Your **Team**.",
              "**Help** and **Settings**, under Account.",
              "Your name at the bottom opens **Rider Directory**, **My Profile** and **Sign Out**.",
            ],
          },
          { t: "h2", text: "The home screen", id: "home" },
          { t: "img", name: "dashboard", alt: "The home screen with four summary cards and a list of recently checked policies.", caption: "Home, also called Overview." },
          {
            t: "list",
            items: [
              "**My Policies**: how many policies are in your book.",
              "**High Risk**: policies whose score is below 70. These are worth a conversation.",
              "**My Queue**: policies waiting for you in Needs Attention.",
              "**My Avg Risk Score**: the average score of your checked policies over the last 30 days.",
              "**Live Analysis Feed**: your latest policies with the customer, insurer, next premium date, score, and whether they should switch.",
            ],
          },
          { t: "h2", text: "On a phone", id: "phone" },
          {
            t: "p",
            text: "The portal works in your phone's browser. There is nothing to install. Four tabs sit at the bottom: **Home**, **Insights**, **People** and **Policies**. Press **More** to open the full menu.",
          },
          { t: "img", name: "dashboard-phone", alt: "The home screen on a phone, with tabs along the bottom.", caption: "Home on a phone.", phone: true },
          { t: "img", name: "menu-phone", alt: "The full menu opened on a phone.", caption: "Press More to open the full menu.", phone: true },
          { t: "h2", text: "Hindi or English", id: "language" },
          {
            t: "p",
            text: "Use the **EN / हिंदी** switch at the top right of any screen. The whole portal changes language, and your choice is remembered. A few things stay in English, such as the written text of a policy report.",
          },
          { t: "note", tone: "note", text: "These docs and their screenshots are in English. If your portal is in Hindi, the buttons will have Hindi names but sit in the same places." },
          { t: "cards", slugs: ["check-a-policy", "leads"] },
        ],
      },
      {
        slug: "demo",
        nav: "Try the demo",
        badge: "No login",
        title: "Try the demo first",
        description: "Explore the IndSure advisor portal with sample customers and policies. No account needed, nothing is saved, and a guided tour shows the main tools.",
        lead: "See the whole portal with sample data before you sign up.",
        blocks: [
          {
            t: "p",
            text: "The demo is the real advisor portal filled with sample customers, policies, leads and claims. You do not need an account, and nothing you do is saved. Everything you see in these docs, you can try there.",
          },
          {
            t: "steps",
            items: [
              "Open [indsure.in/agent/playground](/agent/playground).",
              "A welcome card offers a short tour. Press **Start the tour**, or **Explore on my own**.",
              "The tour walks you through eight screens. Press **Next** to move on, **Back** to go back, or the cross to stop.",
              "To start the tour again, press **Take the tour** in the green bar at the top.",
              "When you are done, press **Exit demo**.",
            ],
          },
          { t: "note", tone: "tip", text: "Sharing the portal with someone? Send them indsure.in/agent/playground?tour=1. It opens the demo with the tour already running." },
          { t: "cta", kind: "demo" },
        ],
      },
    ],
  },
  {
    title: "Customers and leads",
    pages: [
      {
        slug: "customers",
        title: "Customers",
        description: "Keep every customer, their family and all their policies in one list in IndSure. Search, add, and open a customer's full portfolio.",
        lead: "Everyone you look after, with all their policies in one place.",
        blocks: [
          { t: "img", name: "customers", alt: "The Customers list with name, contact, policies, total cover, next premium and date added.", caption: "People, then Customers." },
          { t: "h2", text: "The customer list", id: "list" },
          {
            t: "list",
            items: [
              "Each row shows the customer's name and city, phone and email, how many policies of each type they hold, their **Total Cover**, and their **Next Premium** date.",
              "Use the search box to find someone by name, phone, email or city.",
              "Press **Add Customer** to add someone by hand, or turn a lead into a customer with **Save as customer**.",
            ],
          },
          { t: "h2", text: "A customer's page", id: "customer-page" },
          { t: "img", name: "customer-detail", alt: "A customer's page with their contact details, number of policies, total cover, next premium and health score.", caption: "Open any customer to see their page." },
          {
            t: "list",
            items: [
              "At the top: phone, email, city and your notes about them.",
              "**Policies**, **Total Cover**, **Next Premium** and **Health Score** at a glance. **View policy** jumps to the policy that renews next.",
              "**Calculate Cover Need** runs the Cover Calculator for this person and keeps the result on their page.",
              "**Portfolio** lists every policy they hold.",
              "**Edit** changes their details.",
            ],
          },
          { t: "cards", slugs: ["check-a-policy", "cover-calculator"] },
        ],
      },
      {
        slug: "leads",
        title: "Leads",
        description: "Track every lead in IndSure from New to Won: add leads, set a call-back date, move their status and follow up on WhatsApp.",
        lead: "Everyone you are talking to about a new policy, and who to call today.",
        blocks: [
          { t: "img", name: "leads", alt: "The Leads screen with a Call today box, status filters and lead cards with WhatsApp, Call and Draft message buttons.", caption: "People, then Leads." },
          { t: "h2", text: "Reading the Leads screen", id: "screen" },
          {
            t: "list",
            items: [
              "**Call today**, in yellow at the top: people you said you would call back today.",
              "**Filters**: Open, New, Contacted, Interested, Won, Lost or All. Each shows how many leads it holds.",
              "**Each card** shows what they are interested in, their city, the expected premium, where they came from, and the next call date.",
              "**WhatsApp** and **Call** open a chat or a phone call straight away. **Draft message** writes a WhatsApp message for you. See [WhatsApp messages](/docs/whatsapp-messages).",
              "The small arrows at the bottom of a card move the lead to the next status in one press.",
            ],
          },
          { t: "h2", text: "Add a lead", id: "add" },
          { t: "img", name: "lead-add", alt: "The new lead form with name, phone, city, interest, source, expected premium, call-back date and notes.", caption: "The new lead form." },
          {
            t: "steps",
            items: [
              "Press **Add Lead**.",
              "Fill in their **Name**. Everything else is optional, but a phone number lets you call and message them from IndSure.",
              "Choose what they are **Interested in** and **How did they come?**",
              "Set **Call them again on** to the day you will follow up. On that day they appear under Call today.",
              "Press **Save lead**.",
            ],
          },
          { t: "h2", text: "A lead's page", id: "lead-page" },
          { t: "img", name: "lead-detail", alt: "A lead's page with stage buttons, a Save as customer button and the lead's details.", caption: "Open a lead to see everything about them." },
          {
            t: "list",
            items: [
              "Press a **Stage** button to change their status.",
              "**Save as customer** turns them into a customer when you get the policy. This starts their portfolio.",
              "Lower down, add the policies they already hold with other insurers. Those policies feed the [Renewals](/docs/renewals) list, so you know when to reach out.",
            ],
          },
          { t: "note", tone: "tip", text: "People who message you from [My Website](/docs/my-website) arrive in Leads by themselves, marked with where they came from." },
          { t: "cards", slugs: ["renewals", "whatsapp-messages"] },
        ],
      },
      {
        slug: "renewals",
        title: "Renewals",
        description: "See which of your leads' policies are due for renewal in IndSure, soonest first, and reach out on WhatsApp or by phone in time.",
        lead: "Policies your leads hold that are coming up for renewal, soonest first.",
        blocks: [
          { t: "img", name: "renewals", alt: "The Renewals screen with policies grouped into This week and This month, each with WhatsApp, Call and draft buttons.", caption: "People, then Renewals." },
          {
            t: "p",
            text: "Renewals lists the policies you added to your leads' pages: the cover they already have with another insurer. A renewal is the best moment to offer something better, so this list tells you who to talk to and when.",
          },
          { t: "h2", text: "How the list works", id: "how" },
          {
            t: "list",
            items: [
              "Policies are grouped into **Overdue**, **This week**, **This month** and **Later**. Later is hidden until you press **Show all**.",
              "Each card shows the person, the type of policy, the insurer, the renewal date, how many days are left, and the premium.",
              "**WhatsApp** and the phone button reach them straight away. The **✍️** button drafts a message for you.",
              "Press **Mark as spoken to** once you have talked to them, so you know who is done.",
            ],
          },
          { t: "img", name: "renewals-phone", alt: "The Renewals list on a phone.", caption: "Renewals on a phone.", phone: true },
          { t: "note", tone: "note", text: "Renewals of your own customers' policies are on the [Policies](/docs/policies) screen: use the **Expiring Soon** filter. [Insights](/docs/insights) also shows renewals due over the next six months." },
          { t: "note", tone: "tip", text: "Renewals is empty? Add policies to your leads first. Open a lead and add the policies they already hold." },
          { t: "cards", slugs: ["whatsapp-messages", "leads"] },
        ],
      },
      {
        slug: "whatsapp-messages",
        title: "WhatsApp messages",
        description: "Draft ready WhatsApp messages in IndSure for follow-ups, renewal reminders, thank-yous and festival greetings, in English, Hindi or Hinglish.",
        lead: "Ready-made messages, in the customer's language, sent from your own WhatsApp.",
        blocks: [
          { t: "img", name: "whatsapp-draft", alt: "The Draft a WhatsApp message window with message types, language choice, the message text and a Send on WhatsApp button.", caption: "The message window." },
          { t: "h2", text: "Where to find it", id: "where" },
          {
            t: "list",
            items: [
              "**Leads**: the **Draft message** button on every lead card.",
              "**Renewals**: the **✍️** button on every card.",
              "**Policies**: the message icon on each row, for your customers.",
            ],
          },
          { t: "h2", text: "Send a message", id: "send" },
          {
            t: "steps",
            items: [
              "Open the message window from one of the places above.",
              "Under **What do you want to say?**, pick a message: for example **Follow up**, **Offer a free review**, **Say thank you** or **Festival greeting**. For your customers' policies you also get **Suggest an upgrade**, **Renewal reminder** and **Premium due**, filled in with their insurer and dates.",
              "Choose the **Message language**: English, Hinglish or हिंदी.",
              "Read the message. You can change any word.",
              "Check the **WhatsApp number**, then press **Send on WhatsApp**. WhatsApp opens with the message ready, and you press send.",
            ],
          },
          { t: "note", tone: "note", text: "IndSure never sends a message for you. The message is written on your phone or computer and goes out from your own WhatsApp, only when you press send." },
          { t: "note", tone: "tip", text: "WhatsApp did not open? Press **Copy** instead and paste the message into WhatsApp yourself." },
        ],
      },
    ],
  },
  {
    title: "Policies",
    pages: [
      {
        slug: "check-a-policy",
        title: "Check a policy",
        description: "Upload a customer's insurance policy PDF to IndSure and get its limits, waiting periods, caps and gaps in plain language, step by step.",
        lead: "Upload a policy PDF and IndSure reads it for you.",
        blocks: [
          { t: "img", name: "uploads", alt: "The Upload Policies screen with policy types, a drop area for PDF files and optional client details.", caption: "Press Check a Policy to open this screen." },
          { t: "h2", text: "Step by step", id: "steps" },
          {
            t: "steps",
            items: [
              "Press **Check a Policy** at the top of the menu.",
              "Choose the type of policy: **Health**, **Motor**, **Life**, **Term**, **Travel**, **Property**, **Fire**, **Marine** or **Contractor's All Risk**.",
              "Drop the PDF onto the page, or press the box to choose a file. PDF files only, up to 25MB each.",
              "Add the customer's name, email, phone and policy number on the right if you like. It is optional, but it puts the policy under the right customer.",
              "Press **Check**. Nothing is read until you do.",
              "Wait while it says **Uploading**, then **Analyzing**. A health policy usually takes about a minute.",
              "Press **View Results** to open the report.",
            ],
          },
          { t: "h2", text: "Health policies", id: "health" },
          {
            t: "p",
            text: "A health policy gets a **full check**: a score out of 100 and a detailed report. You check one health policy at a time, and each one uses 1 policy check.",
          },
          {
            t: "p",
            text: "Does the person have other health cover, like a **super top-up**, a **company policy** from their employer, or **Ayushman Bharat**? Attach it under **Other cover this person already has** before you press Check. The report then reads everything together, so it judges their total protection, not one policy alone. It is still 1 policy check.",
          },
          { t: "h2", text: "Other types of policy", id: "other-types" },
          {
            t: "p",
            text: "Motor, life, term, travel and the other types are read into your book as **data entry**: the policy's key details are filled in for you. You can add several files at once. Data entry has its own allowance, separate from your policy checks.",
          },
          { t: "h2", text: "Before you upload", id: "before" },
          {
            t: "list",
            items: [
              "**Password-protected PDF?** It cannot be read. Remove the password first. The upload screen links to a free tool for this.",
              "**Blurry scan?** Use the insurer's original PDF if you can. A clear PDF gives a better report.",
              "**Uploaded it before?** IndSure warns you, and a second check uses another policy check.",
            ],
          },
          { t: "note", tone: "warn", text: "Something went wrong? The policy waits in [Needs Attention](/docs/needs-attention) with the reason, and a **Retry** button." },
          { t: "cards", slugs: ["policy-report", "share-with-customers"] },
        ],
      },
      {
        slug: "policy-report",
        nav: "Read the report",
        title: "Read the policy report",
        description: "How to read an IndSure health policy report: the score out of 100, the verdict, what could cost your customer at claim time, and coverage gaps.",
        lead: "What each part of a health policy report means, and how to use it with a customer.",
        blocks: [
          { t: "img", name: "report-top", alt: "The top of a policy report with the customer's name, insurer, plan, score and share buttons.", caption: "The top of a report." },
          { t: "h2", text: "The top of the report", id: "top" },
          {
            t: "list",
            items: [
              "**Tags**: days left until renewal, the status, and the type of policy.",
              "**The customer**, the insurer and the plan name. Press the pencil to correct the plan name.",
              "**Score**: out of 100, with a label such as **Needs action**.",
              "**Share Report** creates a link for the customer. See [Share with customers](/docs/share-with-customers).",
              "**Download Report** saves the report to print or send.",
              "**The verdict** in red or green, and one plain sentence on what matters most about this policy.",
            ],
          },
          { t: "h2", text: "The score, and why", id: "score" },
          { t: "img", name: "report-middle", alt: "The audit score of 58 out of 100 and the breakdown of what could cost the customer at claim time.", caption: "The score and what pulled it down." },
          {
            t: "list",
            items: [
              "**Audit Score**: the policy's score out of 100, with a label such as **Under-covered**.",
              "Under the score: how the cover compares with the minimum recommended for the person's age and city.",
              "**What Could Cost You at Claim Time** breaks the score into four parts: rules that cut the payout, money paid from the customer's pocket, gaps in the cover, and cover that is too low. Press a row to see which clauses caused it.",
              "**Effective Cover**: what the policy really pays for one serious hospital stay.",
            ],
          },
          { t: "h2", text: "How far the cover goes", id: "how-far" },
          { t: "img", name: "report-lower", alt: "Two cards showing the cost of one serious hospital stay today and in 5 years, then the coverage overview.", caption: "How far the cover goes, and what works or may cost." },
          {
            t: "list",
            items: [
              "**One serious admission, today**: what a big hospital bill costs now, and how much of it the policy covers.",
              "**The same admission in 5 years**: the same bill after medical costs rise.",
              "**What actually works**: the good parts of the policy, like a no-claim bonus.",
              "**Where it may cost you**: the clauses that take money from the customer at claim time, like a co-payment, with the rupee amount.",
            ],
          },
          { t: "note", tone: "tip", text: "Use the report to start a conversation, not to end one. Point at **Where it may cost you** and ask the customer if they knew. For exact coverage questions, the customer should always confirm with their insurer." },
          { t: "img", name: "report-phone", alt: "A policy report on a phone.", caption: "Reports work on a phone too.", phone: true },
          { t: "cards", slugs: ["share-with-customers", "compare"] },
        ],
      },
      {
        slug: "share-with-customers",
        title: "Share with customers",
        description: "Send your customer a policy report, a plan comparison or a cover calculation from IndSure as a link they can open without an account.",
        lead: "Send reports, comparisons and cover calculations as a simple link.",
        blocks: [
          {
            t: "p",
            text: "Your customer does not need an IndSure account to open anything you share. They get a link, and it opens in their phone's browser.",
          },
          { t: "h2", text: "A policy report", id: "report" },
          {
            t: "steps",
            items: [
              "Open the policy from [Policies](/docs/policies).",
              "Press **Share Report**. A link appears under the buttons.",
              "Press **Copy**, then paste the link into WhatsApp.",
            ],
          },
          { t: "img", name: "report-top", alt: "A policy report with the share link showing under the Share Report button, and a Copy button.", caption: "The share link, with Copy." },
          {
            t: "p",
            text: "On the [Policies](/docs/policies) screen, the **Views** column tells you whether the customer has opened the report yet.",
          },
          { t: "h2", text: "A plan comparison", id: "comparison" },
          { t: "p", text: "After comparing plans, press **Save & share with customer**. See [Compare plans](/docs/compare)." },
          { t: "h2", text: "A cover calculation", id: "calculation" },
          { t: "p", text: "At the end of the Cover Calculator, press **Send on WhatsApp** or **Copy Share Link**. See [Cover Calculator](/docs/cover-calculator)." },
          { t: "note", tone: "note", text: "A share link is long and random, so nobody can guess it. It shows the report, not the rest of your customer's record." },
        ],
      },
      {
        slug: "needs-attention",
        title: "Needs Attention",
        description: "Find policies that are still being read or could not be read in IndSure, see why, and retry them from Needs Attention.",
        lead: "Policies that are still being read, or could not be read.",
        blocks: [
          { t: "img", name: "queue", alt: "The My Queue screen with Failed and Processing tabs, showing two failed policies with a reason and Retry and Delete buttons.", caption: "Home, then Needs Attention." },
          {
            t: "list",
            items: [
              "The number next to **Needs Attention** in the menu tells you how many policies are waiting.",
              "**Processing**: policies still being read. They move on by themselves.",
              "**Failed**: policies that could not be read, with the reason, for example a blurry scan or a password-protected PDF.",
              "Press **Retry** to try again, or **Delete** to remove it.",
            ],
          },
          { t: "note", tone: "tip", text: "For a password-protected PDF, remove the password and upload the file again. For a blurry scan, ask the customer for the insurer's original PDF." },
        ],
      },
      {
        slug: "policies",
        nav: "Policies and Excel",
        title: "Policies and Excel export",
        description: "See every policy in your IndSure book, filter by type or renewal, spot policies that should switch, and export everything to Excel.",
        lead: "Every policy in your book, with filters and an Excel download.",
        blocks: [
          { t: "img", name: "policies", alt: "The My Policies screen with totals, type filters, tabs, and a table of policies with score and recommendation.", caption: "Policies, then Overview." },
          {
            t: "list",
            items: [
              "**At the top**: how many policies you have checked, how many expire in the next 30 days, and how many should switch.",
              "**Type filters**: All types, Health, Motor, Life, Term, Travel, Property, Fire, Marine and more.",
              "**Tabs**: All, **Expiring Soon**, **Should Switch** and **Healthy**.",
              "**Each row**: the customer, type, insurer, next premium date, score, a **Keep** or **Switch** recommendation, and whether the customer has viewed the shared report.",
              "The icons at the end of a row draft a WhatsApp message or open the policy.",
            ],
          },
          { t: "h2", text: "Export to Excel", id: "excel" },
          {
            t: "p",
            text: "Press **Export to Excel** at the top to download your policies as a spreadsheet. Your data is yours, and you can take it out whenever you want.",
          },
          { t: "cards", slugs: ["policy-report", "whatsapp-messages"] },
        ],
      },
    ],
  },
  {
    title: "Tools",
    pages: [
      {
        slug: "compare",
        title: "Compare plans",
        description: "Compare up to four health plans side by side in IndSure, see which is stronger and why, and share the comparison with your customer.",
        lead: "Put plans side by side and show a customer the real difference.",
        blocks: [
          { t: "img", name: "compare-result", alt: "Two plans selected for comparison, with a verdict showing which is the stronger base plan and their scores.", caption: "Services, then Compare Policies." },
          { t: "h2", text: "Compare plans from our list", id: "catalogue" },
          { t: "p", text: "This is free and instant. It uses plans we have already read." },
          {
            t: "steps",
            items: [
              "Open **Services**, then **Compare Policies**.",
              "Press **Add a plan**. Pick an insurer, then a plan. Or type an insurer or plan name to search.",
              "Add two to four plans. The comparison appears as soon as you have two.",
              "Read **Our verdict**: which plan is the stronger base plan, a score for each, and the main reasons.",
              "Scroll down for the full table, row by row.",
              "Press **Save & share with customer** to send it.",
            ],
          },
          { t: "img", name: "compare-result-lower", alt: "The comparison table with rows for room rent, co-payment, deductible and waiting periods for each plan.", caption: "The full comparison table." },
          { t: "note", tone: "warn", text: "The comparison looks at cover, not price. The cheaper plan is often the one with a cap or a co-payment, so put the two premiums side by side before you advise a switch." },
          { t: "h2", text: "Compare Quotes, for plans not in our list", id: "quotes" },
          { t: "img", name: "compare-quotes", alt: "The Compare Quotes screen with two upload boxes, Policy A and Policy B.", caption: "Compare Quotes." },
          {
            t: "steps",
            items: [
              "On Compare Policies, press **Compare Quotes**.",
              "Upload the policy wording PDF for **Policy A** and for **Policy B**.",
              "Press **Compare side by side**. Every clause of both is read and compared.",
            ],
          },
          { t: "note", tone: "note", text: "Compare Quotes uses 2 policy checks, one for each wording. Comparing plans from our list is free." },
          { t: "cards", slugs: ["share-with-customers", "plans"] },
        ],
      },
      {
        slug: "cover-calculator",
        title: "Cover Calculator",
        description: "Use the IndSure Cover Calculator to work out how much health cover a family needs, then send the report to your customer as a link.",
        lead: "Work out how much health cover a family actually needs.",
        blocks: [
          { t: "img", name: "calculator", alt: "The first question of the Cover Calculator, Where do you live, with state and city.", caption: "Services, then Cover Calculator." },
          {
            t: "steps",
            items: [
              "Open **Services**, then **Cover Calculator**. Or open a customer and press **Calculate Cover Need**, so the result stays on their page.",
              "Answer seven short questions about the family, one screen at a time, starting with where they live. The city matters because hospital costs differ from place to place.",
              "At the end you get the cover they need, with the reasons.",
              "Press **Send on WhatsApp** or **Copy Share Link** to send it. Your customer opens it without logging in.",
            ],
          },
          { t: "note", tone: "tip", text: "The Cover Calculator is free and never uses your policy checks. Use it on every call, even with people who have no policy yet." },
        ],
      },
      {
        slug: "surrender-value",
        nav: "Surrender values",
        title: "Surrender values",
        description: "See what every life policy in your IndSure book is worth today, what a customer could borrow instead, and which lapsed policies need reviving.",
        lead: "What each life policy is worth if the customer stopped today.",
        blocks: [
          { t: "img", name: "values", alt: "The Surrender values screen with totals for surrenderable value, amount that can be borrowed, maturing policies and policies needing revival, above a table of policies.", caption: "Services, then Surrender Values." },
          {
            t: "list",
            items: [
              "**Surrenderable today**: the total your customers would get if they surrendered their savings policies now.",
              "**Can borrow instead**: money they could raise as a loan without ending a policy.",
              "**Maturing**: money about to reach a customer.",
              "**Needs reviving**: lapsed policies, or premiums past their grace period.",
              "The table shows each policy's year, premiums paid, value now, value at the next anniversary, value at maturity, and **What to do**.",
            ],
          },
          { t: "note", tone: "tip", text: "When a customer wants to surrender for cash, check **Can borrow instead** first. A loan against the policy can raise money without losing the cover." },
          { t: "p", text: "Values are worked out from the policy documents by arithmetic, not estimated." },
        ],
      },
      {
        slug: "riders",
        title: "Rider Directory",
        description: "Browse riders and add-ons across health insurers in the IndSure Rider Directory, filtered by insurer and type, with your partner insurers first.",
        lead: "Every rider across insurers, in one searchable list.",
        blocks: [
          {
            t: "p",
            text: "Open it from your name at the bottom of the menu, then **Rider Directory**. Filter by insurer or by type of rider, such as OPD, hospital cash, critical illness or maternity. Insurers you are empanelled with show first, and riders worth recommending are marked **Must have**.",
          },
          { t: "img", name: "riders", alt: "The Rider Directory with filters for insurer and rider type, and a list of riders with a short description.", caption: "The Rider Directory." },
        ],
      },
      {
        slug: "claims",
        title: "Claims desk",
        description: "Track every health claim you run for a customer in IndSure: documents, insurer queries, status and deadlines, from opened to settled.",
        lead: "Every health claim you are running for a customer, and what it needs next.",
        blocks: [
          { t: "img", name: "claims", alt: "The Claims screen with totals, Open, Needs you and Closed tabs, a warning box, and claim cards.", caption: "Services, then Claims." },
          { t: "h2", text: "The claims screen", id: "screen" },
          {
            t: "list",
            items: [
              "**At the top**: claims opened, closed, the amount claimed, and the amount settled.",
              "**Tabs**: **Open**, **Needs you**, and **Closed**.",
              "**The yellow box** tells you when an insurer is waiting on you, or when documents are about to be deleted.",
              "**Each card** shows the customer, the illness or treatment, the amount, the insurer, the status, and how many days are left.",
            ],
          },
          { t: "h2", text: "Start a claim", id: "new" },
          {
            t: "steps",
            items: [
              "Press **New claim**.",
              "Pick who the claim is for from your customers, or add a new person.",
              "Fill in the claim details and save.",
            ],
          },
          { t: "h2", text: "Follow a claim", id: "follow" },
          { t: "img", name: "claim-detail", alt: "A claim's page with the amount claimed, insurer, a timeline from claim opened to settled, and insurer queries.", caption: "Open a claim to see where it is." },
          {
            t: "list",
            items: [
              "**Where the claim is**: a timeline from **Claim opened** to **Documents received**, **Submitted to insurer**, **Claim under process**, and **Settled or rejected**.",
              "**Insurer queries**: each round of questions from the insurer, and which are still open.",
              "Update the status as it moves: **Docs in**, **Submitted**, **In process**, **Query**, **Settled** or **Rejected**.",
              "**WhatsApp** and **Call** reach the customer in one press.",
            ],
          },
        ],
      },
      {
        slug: "insights",
        title: "Insights",
        description: "See how your IndSure book is moving: renewals due over six months, what you sell, and what your policy checks found.",
        lead: "How your book is moving, and where the work is.",
        blocks: [
          { t: "img", name: "insights", alt: "The Insights screen with totals and charts of renewals due by month and policies by type.", caption: "Insights." },
          {
            t: "list",
            items: [
              "**At the top**: policies in your book, renewing in 30 days, already expired, and people you cover.",
              "**Renewals due, next six months**: plan your calls around the tall months.",
              "**What you sell**: your policies by type.",
              "**What your checks found**: across your checked health policies.",
            ],
          },
          { t: "note", tone: "tip", text: "Insights fills in as you add policies. A new account shows it empty until you check your first policy." },
        ],
      },
    ],
  },
  {
    title: "Grow your business",
    pages: [
      {
        slug: "my-website",
        title: "My Website",
        description: "Set up your own advisor page on IndSure with your photo, city and languages, share it on WhatsApp or as a QR code, and get leads from it.",
        lead: "Your own page, with your photo, that customers can message you from.",
        blocks: [
          { t: "img", name: "my-website", alt: "The My Website screen with the page address, page views, leads, where visitors come from, and your details.", caption: "Services, then My Website." },
          { t: "h2", text: "Set it up", id: "setup" },
          {
            t: "steps",
            items: [
              "Open **Services**, then **My Website**.",
              "Add a clear photo of your face. Please do not use a company or insurer logo.",
              "Check your name and city, and add the **WhatsApp number** where enquiries should reach you. It can be different from your login number.",
              "Choose the language your page opens in, the insurance you handle, and the languages you speak.",
              "Press **Save**.",
              "Press **Publish my page** when you are ready. Nothing goes online before that. Press **Preview** to see it first.",
            ],
          },
          { t: "p", text: "Your page lives at an address like **indsure.in/a/your-name**. You can press **Take page offline** at any time." },
          { t: "h2", text: "Share it", id: "share" },
          { t: "img", name: "my-website-lower", alt: "The Share your page section with a separate link for WhatsApp, Instagram bio, Facebook, QR and SMS, a Download QR button and a ready-made WhatsApp message.", caption: "Share your page." },
          {
            t: "list",
            items: [
              "Use the link made for the place you are posting: **WhatsApp**, **Instagram bio**, **Facebook**, **QR / printed** or **SMS**. Each is tagged, so you can see which one brings enquiries.",
              "Add a **Campaign name**, like diwali-offer, to tell two pushes apart.",
              "Press **Download QR** and print it on your visiting card or a standee.",
              "Press **Copy message** for a ready-made WhatsApp message with your link.",
            ],
          },
          { t: "h2", text: "See what it brings you", id: "stats" },
          {
            t: "p",
            text: "The top of the screen shows your **Page views** over 30 days, **Leads from this page**, your best channel, and where your visitors come from. Everyone who messages you from the page lands in [Leads](/docs/leads).",
          },
        ],
      },
      {
        slug: "team",
        nav: "Team",
        title: "Team, for agencies",
        description: "For IndSure agency owners: invite advisors, manage seats, move policy checks between advisors, and see each advisor's book.",
        lead: "For agency owners: your advisors, their seats and their checks.",
        blocks: [
          { t: "img", name: "team", alt: "The Team screen with seats in use, policy checks left, a list of advisors with their checks and customers, and Invite advisor and Move checks buttons.", caption: "My Agency, then Team." },
          {
            t: "list",
            items: [
              "**Seats in use**, **Policy checks left** across the team, and anyone **Out of checks**.",
              "**The advisor list**: each advisor's role, checks left, data entry left, customers, and last activity.",
              "**Invite advisor**: they get a link that works only for their email address, can be used once, and expires in 7 days.",
              "**Move checks**: each seat gets its own checks every month. Move unused ones to an advisor who has run out.",
              "**View book**: see an advisor's customers and policies.",
              "**Remove**: frees the seat. Their customers, policies and claims stay theirs, nothing is deleted, and you stop being able to see them.",
            ],
          },
          { t: "note", tone: "note", text: "Advisors can see every time their book was opened, so viewing a book is open and on the record." },
          { t: "p", text: "The Team screen appears in the menu for agency owners only. To set up an agency, choose Agency when you sign up, or [message us](/docs/get-help)." },
        ],
      },
    ],
  },
  {
    title: "Account and help",
    pages: [
      {
        slug: "account",
        nav: "Settings and password",
        title: "Settings, profile and password",
        description: "Change your name, city and password in IndSure, update the insurers you work with, download your data, and sign out.",
        lead: "Your details, your password, and your data.",
        blocks: [
          { t: "h2", text: "Settings", id: "settings" },
          { t: "img", name: "settings", alt: "The Account settings screen with your details, password, and a Download my data button.", caption: "Settings." },
          {
            t: "list",
            items: [
              "Change your **name** and **city**, then press **Save**.",
              "Set a **new password**, type it again, and press **Update password**.",
              "**Download my data**: one file with your policies, customers, leads, claims, comparisons and cover calculations. The documents are listed with where they are stored.",
            ],
          },
          { t: "h2", text: "My Profile", id: "profile" },
          { t: "img", name: "profile", alt: "The My Profile screen with policy checks left, totals, and personal details.", caption: "Press your name at the bottom of the menu, then My Profile." },
          {
            t: "list",
            items: [
              "See how many **policy checks** you have left, and your totals.",
              "**Partnered Companies**: change the insurers you are empanelled with.",
              "Update your personal details or password.",
            ],
          },
          { t: "h2", text: "Forgot your password", id: "forgot" },
          { t: "p", text: "On the [login screen](/agent/login), press **Forgot password?** and follow the email we send you." },
          { t: "h2", text: "Sign out", id: "sign-out" },
          { t: "p", text: "Press your name at the bottom of the menu, then **Sign Out**. Always sign out on a shared computer." },
        ],
      },
      {
        slug: "plans",
        nav: "Plans and checks",
        title: "Plans and policy checks",
        description: "How IndSure plans work for advisors: the free plan, what a policy check is, what is always free, and how to upgrade.",
        lead: "What is free, what a policy check is, and how to get more.",
        blocks: [
          {
            t: "p",
            text: "The prices are on the [advisor pricing page](/advisors/pricing). This page explains how plans work, so you know what uses what.",
          },
          { t: "h2", text: "The free plan", id: "free" },
          {
            t: "p",
            text: "The Free plan is free forever. It is not a trial, and you do not need a card. It includes a few policy checks so you can see the reports for yourself.",
          },
          { t: "h2", text: "Always free, on every plan", id: "always-free" },
          {
            t: "list",
            items: [
              "Leads, renewals and your customer list.",
              "The Cover Calculator.",
              "WhatsApp message drafts.",
              "Comparing plans from our list.",
            ],
          },
          { t: "h2", text: "What uses a policy check", id: "checks" },
          {
            t: "list",
            items: [
              "**A health policy check** uses 1 policy check.",
              "**Compare Quotes**, comparing two uploaded wordings, uses 2 policy checks.",
              "**Data entry** for motor, life, term, travel and other policies has its own separate allowance. It never uses your policy checks.",
            ],
          },
          { t: "p", text: "You can see how many checks you have left on **My Profile**, and on the upload screen before you press Check." },
          { t: "h2", text: "Getting more", id: "more" },
          {
            t: "p",
            text: "To move to a paid plan, or to buy more checks, message our team on WhatsApp from the [pricing page](/advisors/pricing). There is no card payment inside the portal. For agencies, each seat gets its own checks every month, and the owner can move unused ones between advisors.",
          },
          { t: "cta", kind: "contact" },
        ],
      },
      {
        slug: "your-data",
        nav: "Your data",
        title: "Your data and your customers' data",
        description: "How IndSure keeps an advisor's book private: every advisor's data is kept apart, share links cannot be guessed, and you can download everything.",
        lead: "Your book is yours. Here is how we keep it that way.",
        blocks: [
          {
            t: "list",
            items: [
              "**Your book is yours.** Your customers, policies and leads are never sold, shared, or used for anyone else.",
              "**Kept apart from every other advisor.** Each advisor's data is walled off inside the database itself, so one advisor cannot see another's customers, even by accident.",
              "**Encrypted on the way.** Everything between your device and IndSure travels over a secure connection.",
              "**Share links cannot be guessed.** A shared report opens only with its long random link, and shows the report, not your customer's full record.",
              "**Take it with you.** Download everything from **Settings**, or export policies to Excel, at any time.",
              "**Agencies are open about access.** When an agency owner opens an advisor's book, the advisor can see that it happened.",
            ],
          },
          {
            t: "p",
            text: "For the full details, read our [Privacy Policy](/privacy-policy). If you have a concern, write to our [Grievance Officer](/grievance).",
          },
        ],
      },
      {
        slug: "faq",
        nav: "FAQ",
        title: "Frequently asked questions",
        description: "Answers to the questions advisors ask most about IndSure: cost, commission, policy checks, file types, Hindi, sharing, phones and your data.",
        lead: "Quick answers to what advisors ask us most.",
        blocks: [
          { t: "h2", text: "About IndSure", id: "about" },
          {
            t: "faq",
            items: [
              { q: "Is IndSure free?", a: "There is a Free plan that is free forever, with no card needed. Leads, renewals, your customer list, the Cover Calculator and WhatsApp drafts are free on every plan. Paid plans add more policy checks. See [Plans and policy checks](/docs/plans)." },
              { q: "Does IndSure take a commission on policies I sell?", a: "No. IndSure charges a flat subscription. We are not an IRDAI-registered broker or agent and do not earn commission." },
              { q: "Does IndSure sell insurance to my customers?", a: "No. We do not sell insurance. Your customers are yours." },
              { q: "Do I need to install an app?", a: "No. IndSure works in the browser on your phone and computer. On a phone, the main screens are in tabs at the bottom." },
              { q: "Can I use IndSure in Hindi?", a: "Yes. Press **हिंदी** at the top of any screen. A few things stay in English, such as the written text of a policy report." },
              { q: "Can I try it before signing up?", a: "Yes. Open the [demo](/docs/demo). It has sample data and a guided tour, and you do not need an account." },
            ],
          },
          { t: "h2", text: "Policy checks", id: "checks" },
          {
            t: "faq",
            items: [
              { q: "What is a policy check?", a: "One full check of a health policy: a score out of 100 and a detailed report. Comparing two uploaded wordings with Compare Quotes uses 2. Comparing plans from our list is free." },
              { q: "What files can I upload?", a: "PDF files only, up to 25MB each. The PDF must not have a password. The insurer's original PDF works best." },
              { q: "How long does a check take?", a: "A health policy usually takes about a minute." },
              { q: "Can IndSure read a policy written in Hindi?", a: "Not yet. We support policies written in English for now." },
              { q: "Is the score the final word?", a: "No. The score follows fixed rules, so the same policy always gets the same answer, and it points to the gaps worth discussing. For exact coverage questions, your customer should always confirm with their insurer." },
              { q: "A check failed. What now?", a: "Open [Needs Attention](/docs/needs-attention). It shows the reason and a Retry button." },
            ],
          },
          { t: "h2", text: "Customers and sharing", id: "sharing" },
          {
            t: "faq",
            items: [
              { q: "Can my customer open a report without signing up?", a: "Yes. A shared report, comparison or cover calculation opens from its link, with no account needed." },
              { q: "Will IndSure message my customers?", a: "No. Messages go out from your own WhatsApp, only when you press send." },
              { q: "How do I know if my customer opened the report?", a: "The **Views** column on the Policies screen tells you." },
            ],
          },
          { t: "h2", text: "Account and data", id: "account" },
          {
            t: "faq",
            items: [
              { q: "Can my team share one login?", a: "No. Each advisor has their own login. For a team, use an agency account. See [Team, for agencies](/docs/team)." },
              { q: "What happens to my customers if I stop using IndSure?", a: "They stay yours. You can export everything to Excel or download your data at any time. Your data is kept or deleted as our Privacy Policy and India's DPDP Act require. Just ask us." },
              { q: "How do I upgrade?", a: "Message our team on WhatsApp from the [pricing page](/advisors/pricing). There is no card payment inside the portal." },
              { q: "I lost my invite code.", a: "Message us on WhatsApp to ask for a new one. See [Get help](/docs/get-help)." },
            ],
          },
        ],
      },
      {
        slug: "troubleshooting",
        title: "Troubleshooting",
        description: "Fix common problems in the IndSure advisor portal: invite code errors, session expired, failed uploads, empty renewals and WhatsApp not opening.",
        lead: "Something not working? Start here.",
        blocks: [
          { t: "h2", text: "Invite code problems", id: "invite-code" },
          {
            t: "list",
            items: [
              "**Invite code not found**: check the code in your email or WhatsApp. Copy and paste it rather than typing it.",
              "**This invite code is no longer valid**, **has already been used**, or **has reached its usage limit**: ask us for a new one.",
              "**Could not check the code right now**: check your internet connection and try again.",
            ],
          },
          { t: "h2", text: "Session expired", id: "session" },
          { t: "p", text: "For your safety you are logged out after a while. Log in again at [indsure.in/agent/login](/agent/login). Anything you saved is still there." },
          { t: "h2", text: "A policy will not upload or check", id: "upload" },
          {
            t: "list",
            items: [
              "**PDF files only**: photos and Word files cannot be read. Ask the insurer or customer for the PDF.",
              "**File too large**: each file must be under 25MB.",
              "**Password-protected PDF**: remove the password first, then upload again.",
              "**The check took too long**: try again from [Needs Attention](/docs/needs-attention).",
              "**No policy checks left**: see [Plans and policy checks](/docs/plans).",
            ],
          },
          { t: "h2", text: "Renewals is empty", id: "renewals-empty" },
          { t: "p", text: "Renewals shows the policies you added to your leads. Open a lead and add the policies they already hold. See [Renewals](/docs/renewals)." },
          { t: "h2", text: "WhatsApp does not open", id: "whatsapp" },
          { t: "p", text: "Check that the number is a 10-digit mobile number. If WhatsApp still does not open, press **Copy** and paste the message into WhatsApp yourself." },
          { t: "h2", text: "My page does not show online", id: "my-page" },
          { t: "p", text: "Open My Website and press **Publish my page**. Until you do, nothing goes online." },
          { t: "cta", kind: "contact" },
        ],
      },
      {
        slug: "get-help",
        title: "Get help",
        description: "Reach the IndSure team for help with the advisor portal on WhatsApp or by email, and find where to raise a complaint.",
        lead: "Talk to a person on our team.",
        blocks: [
          { t: "p", text: "The fastest way to reach us is WhatsApp. Tell us your name and what you were trying to do, and send a screenshot if you can." },
          { t: "cta", kind: "contact" },
          { t: "list", items: ["**In the portal**: press **Help** in the menu, then **Message us on WhatsApp**.", "**Email**: [nikhil@indsure.in](mailto:nikhil@indsure.in).", "**A complaint**: write to our [Grievance Officer](/grievance)."] },
        ],
      },
    ],
  },
];

export const DOC_PAGES: DocPage[] = DOC_SECTIONS.flatMap((s) => s.pages);

export function docPath(slug: string): string {
  return slug ? `/docs/${slug}` : "/docs";
}

/** Plain text of a page, for search and for the prerendered HTML. */
export function docPlainText(page: DocPage): string {
  const strip = (s: string) => s.replace(/\*\*/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  const parts: string[] = [page.lead];
  for (const b of page.blocks) {
    if (b.t === "p" || b.t === "h2" || b.t === "note") parts.push(strip(b.text));
    else if (b.t === "steps" || b.t === "list") parts.push(...b.items.map(strip));
    else if (b.t === "img") parts.push(b.alt);
    else if (b.t === "faq") for (const f of b.items) parts.push(strip(f.q), strip(f.a));
  }
  return parts.join(" ");
}
