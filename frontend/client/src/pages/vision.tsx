import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ShieldCheck,
  Home,
  Sparkles,
  Rocket,
  Eye,
  TrendingUp,
  Globe,
  Zap,
  Target,
  ArrowRight,
  CheckCircle2,
  Clock,
  Star,
  Award,
} from "lucide-react";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { useState } from "react";

const visionGoals = [
  {
    icon: Globe,
    title: "Nationwide Impact",
    description: "Making insurance literacy accessible to every Indian, everywhere.",
    timeline: "2025-2027",
    gradient: "from-[#1A3A52] to-[#4A9B9E]",
    bgGradient: "from-[#1A3A52]/10 to-[#4A9B9E]/10 dark:from-[#1A3A52]/20 dark:to-[#4A9B9E]/20",
    iconColor: "text-[#1A3A52] dark:text-[#4A9B9E]",
  },
  {
    icon: Zap,
    title: "Instant Clarity",
    description: "Complex policies → Clear insights in under 60 seconds.",
    timeline: "Ongoing",
    gradient: "from-[#4A9B9E] to-[#3CBBA0]",
    bgGradient: "from-[#4A9B9E]/10 to-[#3CBBA0]/10 dark:from-[#4A9B9E]/20 dark:to-[#3CBBA0]/20",
    iconColor: "text-[#4A9B9E] dark:text-[#3CBBA0]",
  },
  {
    icon: Rocket,
    title: "Always Innovating",
    description: "Cutting-edge AI that gets smarter every day.",
    timeline: "Continuous",
    gradient: "from-[#3CBBA0] to-emerald-500",
    bgGradient: "from-[#3CBBA0]/10 to-emerald-500/10 dark:from-[#3CBBA0]/20 dark:to-emerald-500/20",
    iconColor: "text-[#3CBBA0] dark:text-emerald-400",
  },
  {
    icon: Target,
    title: "Zero Compromise",
    description: "No sales. No storage. No bias. Ever.",
    timeline: "Forever",
    gradient: "from-emerald-500 to-teal-500",
    bgGradient: "from-emerald-500/10 to-teal-500/10 dark:from-emerald-500/20 dark:to-teal-500/20",
    iconColor: "text-emerald-600 dark:text-teal-400",
  },
];

const visionMilestones = [
  {
    year: "2024",
    icon: CheckCircle2,
    achievement: "Launched AI-powered policy analysis platform",
    status: "completed",
    color: "from-emerald-500 to-green-500",
  },
  {
    year: "2025",
    icon: TrendingUp,
    achievement: "Reach 100K+ policy analyses, expand to regional languages",
    status: "in-progress",
    color: "from-[#4A9B9E] to-[#3CBBA0]",
  },
  {
    year: "2026",
    icon: Award,
    achievement: "Become India's #1 trusted insurance analysis platform",
    status: "planned",
    color: "from-[#1A3A52] to-[#4A9B9E]",
  },
  {
    year: "2027+",
    icon: Star,
    achievement: "Democratize insurance literacy across all of India",
    status: "vision",
    color: "from-[#3CBBA0] to-emerald-500",
  },
];

export default function Vision() {
  const [hoveredGoal, setHoveredGoal] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-[#F0FFFE] dark:bg-[#0F1419] flex flex-col relative">
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-20 -left-40 w-80 h-80 bg-blue-400/30 dark:bg-blue-500/15 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 -right-40 w-96 h-96 bg-cyan-400/30 dark:bg-cyan-500/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-teal-400/25 dark:bg-teal-500/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/3 right-1/4 w-72 h-72 bg-indigo-400/20 dark:bg-indigo-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '0.5s' }}></div>
      </div>
      {/* Header */}
      <Header />

      {/* Main Content */}
      <main className="relative z-10 flex-1 max-w-6xl mx-auto px-6 py-12 w-full">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-[#1A3A52] via-[#4A9B9E] to-[#3CBBA0] mb-6 shadow-xl relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-[#1A3A52] via-[#4A9B9E] to-[#3CBBA0] rounded-2xl blur-lg opacity-50 group-hover:opacity-75 transition-opacity"></div>
            <Eye className="w-10 h-10 text-white relative z-10 group-hover:scale-110 transition-transform" />
          </div>
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-black mb-6 bg-gradient-to-r from-[#1A3A52] via-[#4A9B9E] to-[#3CBBA0] bg-clip-text text-transparent leading-tight">
            Our Vision
          </h1>
          <p className="text-xl md:text-2xl text-gray-700 dark:text-gray-200 max-w-4xl mx-auto leading-relaxed font-semibold mb-4">
            A future where insurance decisions are made with <span className="bg-gradient-to-r from-[#1A3A52] to-[#4A9B9E] bg-clip-text text-transparent font-bold">complete clarity</span>
          </p>
          <p className="text-base md:text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            Where every policyholder understands exactly what they're buying and how it protects them.
          </p>
        </div>

        {/* Vision Statement */}
        <div className="mb-16">
          <Card className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-2 border-gray-200 dark:border-gray-700 shadow-xl">
            <CardContent className="p-8 md:p-12">
              <div className="space-y-8">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-[#1A3A52] to-[#4A9B9E] flex-shrink-0">
                    <Eye className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-xl md:text-2xl text-gray-800 dark:text-gray-100 leading-relaxed font-semibold">
                      We envision a future where health insurance decisions are made with <span className="font-bold text-[#1A3A52] dark:text-[#4A9B9E]">complete clarity and confidence</span>.
                    </p>
                    <p className="text-base md:text-lg text-gray-600 dark:text-gray-300 mt-3">
                      Where policyholders understand exactly what they're buying, what gaps exist, and how their coverage will protect them in real-world scenarios.
                    </p>
                  </div>
                </div>
                
                <div className="mt-8 p-6 bg-gradient-to-r from-[#1A3A52]/10 to-[#4A9B9E]/10 dark:from-[#1A3A52]/20 dark:to-[#4A9B9E]/20 rounded-xl border-l-4 border-[#4A9B9E]">
                  <p className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">
                    Our vision extends beyond individual analysis. We see a future where:
                  </p>
                  <ul className="space-y-3 text-gray-700 dark:text-gray-300">
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-[#1A3A52] dark:text-[#4A9B9E] flex-shrink-0 mt-0.5" />
                      <span>Every Indian has access to transparent, jargon-free insurance analysis</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-[#4A9B9E] dark:text-[#3CBBA0] flex-shrink-0 mt-0.5" />
                      <span>Policyholders can compare multiple policies side-by-side with confidence</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-[#3CBBA0] dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                      <span>Insurance literacy is democratized through accessible, AI-powered tools</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-[#1A3A52] dark:text-[#4A9B9E] flex-shrink-0 mt-0.5" />
                      <span>Financial security is no longer compromised by hidden policy gaps</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-[#4A9B9E] dark:text-[#3CBBA0] flex-shrink-0 mt-0.5" />
                      <span>Trust is built through transparency, not sales pitches</span>
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Vision Goals */}
        <div className="mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 text-gray-900 dark:text-gray-100">
            How We'll Get There
          </h2>
          <p className="text-center text-gray-600 dark:text-gray-400 mb-12 text-lg">
            Our roadmap to making this vision reality
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            {visionGoals.map((goal, index) => {
              const Icon = goal.icon;
              return (
                <Card
                  key={index}
                  onMouseEnter={() => setHoveredGoal(index)}
                  onMouseLeave={() => setHoveredGoal(null)}
                  className={`bg-gradient-to-br ${goal.bgGradient} backdrop-blur-sm border-2 border-gray-200 dark:border-gray-700 hover:border-[#4A9B9E] dark:hover:border-[#3CBBA0] hover:shadow-2xl transition-all duration-300 cursor-pointer group relative overflow-hidden`}
                >
                  <CardContent className="p-6 relative z-10">
                    <div className="flex items-start gap-4">
                      <div className={`p-4 rounded-xl bg-gradient-to-br ${goal.gradient} flex-shrink-0 group-hover:scale-110 transition-transform shadow-lg`}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl md:text-2xl font-bold mb-2 text-gray-900 dark:text-gray-100 group-hover:text-[#4A9B9E] dark:group-hover:text-[#3CBBA0] transition-colors">
                          {goal.title}
                        </h3>
                        <p className="text-base md:text-lg font-semibold text-gray-700 dark:text-gray-200 leading-relaxed mb-3">
                          {goal.description}
                        </p>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-gray-400" />
                          <span className="text-sm font-semibold text-[#1A3A52] dark:text-[#4A9B9E]">
                            {goal.timeline}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Roadmap */}
        <div className="mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 text-gray-900 dark:text-gray-100">
            Our Roadmap
          </h2>
          <p className="text-center text-gray-600 dark:text-gray-400 mb-12 text-lg">
            Where we've been and where we're going
          </p>
          <div className="space-y-6">
            {visionMilestones.map((milestone, index) => {
              const Icon = milestone.icon;
              return (
                <Card
                  key={index}
                  className={`bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-2 ${
                    milestone.status === "completed"
                      ? "border-emerald-300 dark:border-emerald-600 shadow-lg"
                      : milestone.status === "in-progress"
                      ? "border-[#4A9B9E] dark:border-[#3CBBA0] shadow-lg"
                      : "border-gray-200 dark:border-gray-700"
                  } hover:scale-[1.02] transition-transform`}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-20 h-20 rounded-xl flex flex-col items-center justify-center font-bold text-sm bg-gradient-to-br ${milestone.color} text-white shadow-xl relative group`}
                      >
                        <Icon className="w-6 h-6 mb-1" />
                        <div className="text-xs">{milestone.year}</div>
                        {milestone.status === "completed" && (
                          <div className="absolute -top-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
                            <CheckCircle2 className="w-4 h-4 text-white" />
                          </div>
                        )}
                        {milestone.status === "in-progress" && (
                          <div className="absolute -top-1 -right-1 w-6 h-6 bg-[#4A9B9E] rounded-full flex items-center justify-center animate-pulse">
                            <Clock className="w-4 h-4 text-white" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                          {milestone.achievement}
                        </h3>
                        <span
                          className={`text-sm font-semibold px-3 py-1.5 rounded-full ${
                            milestone.status === "completed"
                              ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                              : milestone.status === "in-progress"
                              ? "bg-[#4A9B9E]/10 dark:bg-[#4A9B9E]/20 text-[#1A3A52] dark:text-[#4A9B9E]"
                              : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                          }`}
                        >
                          {milestone.status === "completed"
                            ? "✓ Completed"
                            : milestone.status === "in-progress"
                            ? "⚡ In Progress"
                            : "📅 Planned"}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Call to Action */}
        <div className="text-center">
          <Card className="bg-gradient-to-br from-[#1A3A52] via-[#4A9B9E] to-[#3CBBA0] border-0 shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent"></div>
            <CardContent className="p-8 md:p-12 text-white relative z-10">
              <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Star className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Join Us on This Journey</h2>
              <p className="text-lg md:text-xl mb-8 text-white/90 font-medium max-w-2xl mx-auto">
                Experience transparent insurance analysis today. No signup required. No BS.
              </p>
              <Link href="/">
                <Button
                  size="lg"
                  className="bg-white text-[#1A3A52] hover:bg-gray-100 font-bold text-base md:text-lg px-8 py-6 rounded-xl shadow-xl hover:scale-105 transition-transform group"
                >
                  Analyze Your Policy
                  <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
