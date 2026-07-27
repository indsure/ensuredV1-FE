import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Linkedin } from "lucide-react";

const founders = [
  {
    name: "Deep Shah",
    role: "CEO",
    bio: "Deep started IndSure after watching a family member's hospital claim get slashed by a room-rent clause nobody had explained at the time of buying the policy. The pattern was obvious: insurance isn't complicated because it has to be — it's complicated because complexity is profitable for whoever's selling it. He leads product and the long-term bet that clarity should be a right, not a service you pay a commission for.",
    linkedin: "https://www.linkedin.com/in/deeepp/",
    initials: "DS",
  },
  {
    name: "Aniket Bang, CFA",
    role: "CRO",
    bio: "Aniket reads policy documents the way most people read term sheets — line by line, looking for what the bold-print number is hiding. A CFA by training, he leads revenue and partnerships, and spends an uncomfortable amount of time arguing that a room-rent cap belongs above the fold, not in Annexure IV.",
    linkedin: "https://www.linkedin.com/in/aniketbang13/",
    initials: "AB",
  },
  {
    name: "Nikhil Mhaskar",
    role: "COO",
    bio: "Nikhil runs the unglamorous half of IndSure — the pipelines that turn a scanned PDF into a clause-by-clause audit in under a minute, the agent onboarding that doesn't need a training manual, the systems that keep working when nobody's watching. If IndSure feels simple to use, it's because he made the complicated part invisible.",
    linkedin: "https://www.linkedin.com/in/mhaskar-nikhil01/?skipRedirect=true",
    initials: "NM",
  },
];

export default function Team() {
  return (
    <div className="min-h-screen bg-[var(--color-cream-main)] font-sans text-[var(--color-text-main)] flex flex-col">
      <Header />
      <Breadcrumbs items={[{ label: "Team" }]} />

      <main className="flex-grow pt-8 pb-20 px-6 w-full">

        {/* HERO */}
        <section className="max-w-4xl mx-auto text-center mb-20 animate-reveal">
          <div className="inline-block py-1 px-3 border border-[var(--color-border-main)] rounded-full text-xs font-mono uppercase tracking-widest text-[var(--color-text-secondary)] mb-6 bg-white">
            The Team
          </div>
          <h1 className="text-5xl md:text-7xl font-serif mb-8 tracking-tight text-[var(--color-text-main)] leading-tight">
            Three people, <br />
            <span className="italic text-[var(--color-green-primary)]">one fine-print problem.</span>
          </h1>
          <p className="text-xl md:text-2xl text-[var(--color-text-secondary)] font-light leading-relaxed max-w-2xl mx-auto">
            IndSure is built by a small team that got tired of watching people
            find out what their policy actually covers only after a claim gets rejected.
          </p>
        </section>

        {/* FOUNDERS */}
        <section className="max-w-6xl mx-auto mb-24 grid md:grid-cols-3 gap-8">
          {founders.map((f) => (
            <div key={f.name} className="card-white p-8 flex flex-col items-center text-center hover:shadow-lg transition-all duration-500">
              <div className="w-24 h-24 rounded-full bg-[var(--color-cream-dark)] border border-[var(--color-border-main)] flex items-center justify-center mb-6 text-2xl font-serif text-[var(--color-green-primary)]">
                {f.initials}
              </div>
              <h3 className="text-2xl font-serif mb-1">{f.name}</h3>
              <p className="text-sm uppercase tracking-widest text-[var(--color-green-primary)] font-semibold mb-5">{f.role}</p>
              <p className="text-[var(--color-text-secondary)] leading-relaxed text-sm mb-6">
                {f.bio}
              </p>
              <a
                href={f.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full border border-[var(--color-border-main)] flex items-center justify-center text-[var(--color-text-secondary)] hover:bg-[var(--color-green-primary)] hover:text-white hover:border-[var(--color-green-primary)] transition-colors"
                aria-label={`${f.name} on LinkedIn`}
              >
                <Linkedin className="w-4 h-4" />
              </a>
            </div>
          ))}
        </section>

        {/* BEHIND THE SCENES */}
        <section className="max-w-3xl mx-auto mb-24 text-center">
          <h2 className="text-3xl font-serif mb-6">And everyone else who builds this</h2>
          <p className="text-lg text-[var(--color-text-secondary)] leading-relaxed font-light">
            Behind the three names above is a small crew of engineers, insurance
            domain experts, and advisor-support folks who read policy wordings
            for a living so you don't have to. We're keeping this page short on
            purpose — as the team grows, they'll get their own spot here too.
          </p>
        </section>

        {/* CTA */}
        <section className="bg-[var(--color-petrol-900)] text-white rounded-lg p-16 text-center max-w-5xl mx-auto shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
            <div className="absolute top-[-50%] left-[-20%] w-[500px] h-[500px] bg-[var(--color-green-primary)] rounded-full blur-[100px]"></div>
          </div>
          <div className="relative z-10">
            <h2 className="text-3xl md:text-5xl font-serif mb-6">Want to work on this with us?</h2>
            <p className="text-xl text-white/80 max-w-2xl mx-auto mb-10 font-light">
              We're a small team solving a genuinely annoying problem. If that sounds fun, say hello.
            </p>
            <a
              href="mailto:careers@indsure.in"
              className="inline-flex items-center justify-center bg-[var(--color-green-primary)] hover:bg-[var(--color-green-secondary)] text-white h-14 px-8 text-lg rounded-full font-medium transition-colors"
            >
              Get in Touch
            </a>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}
