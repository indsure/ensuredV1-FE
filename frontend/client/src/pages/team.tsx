import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Users,
  ShieldCheck,
  Linkedin,
  Mail,
  Target,
} from "lucide-react";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Breadcrumbs } from "@/components/Breadcrumbs";

// Team data
const teamMembers = [
  {
    name: "Engineering Team",
    role: "Core Development",
    bio: "A dedicated group of full-stack engineers and developers building robust, scalable solutions for policy analysis. Expertise in React, TypeScript, Node.js, and AI integration.",
    image: null,
    linkedin: "#",
    email: "contact@ensured.in",
    expertise: ["Full-Stack Development", "AI Integration", "System Architecture"],
  },
  {
    name: "AI Research Team",
    role: "Machine Learning & NLP",
    bio: "Specialists in Natural Language Processing and document analysis, continuously improving our AI models for more accurate policy extraction and deterministic analysis.",
    image: null,
    linkedin: "#",
    email: "contact@ensured.in",
    expertise: ["NLP", "Document Analysis", "Model Optimization"],
  },
  {
    name: "Insurance Advisors",
    role: "Domain Experts",
    bio: "Experienced insurance professionals with decades of combined experience. They validate our analysis logic, ensure accuracy in coverage assessment, and help us understand real-world claim scenarios.",
    image: null,
    linkedin: "#",
    email: "contact@ensured.in",
    expertise: ["Policy Interpretation", "Claim Settlement", "Regulatory Compliance"],
  },
  {
    name: "Product & Design",
    role: "User Experience",
    bio: "Focused on creating intuitive, accessible interfaces that make complex insurance information easy to understand. Committed to user privacy and transparent design.",
    image: null,
    linkedin: "#",
    email: "contact@ensured.in",
    expertise: ["UX Design", "Accessibility", "User Research"],
  },
];

const teamStats = [
  { label: "Team Members", value: "15+", icon: Users },
  { label: "Years Combined Experience", value: "50+", icon: ShieldCheck },
  { label: "Expertise Areas", value: "12+", icon: Target },
];

export default function Team() {
  return (
    <div className="min-h-screen flex flex-col bg-[#F0FFFE] dark:bg-[#0F1419] relative">
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-20 -left-40 w-80 h-80 bg-blue-400/30 dark:bg-blue-500/15 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 -right-40 w-96 h-96 bg-cyan-400/30 dark:bg-cyan-500/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-teal-400/25 dark:bg-teal-500/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/3 right-1/4 w-72 h-72 bg-indigo-400/20 dark:bg-indigo-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '0.5s' }}></div>
      </div>
      <Header />
      <Breadcrumbs items={[{ label: "Team" }]} />

      {/* Main Content */}
      <main id="main-content" className="flex-1 container mx-auto px-4 py-8 md:py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-[#1A3A52] to-[#4A9B9E] mb-6 shadow-2xl">
            <Users className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-5xl md:text-6xl font-black mb-6 bg-gradient-to-r from-[#1A3A52] via-[#2d5a7b] to-[#4A9B9E] bg-clip-text text-transparent">
            Our Team
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed">
            Meet the passionate individuals working to make insurance analysis transparent, accessible, and unbiased.
          </p>
        </div>

        {/* Team Stats */}
        <div className="mb-12">
          <div className="grid grid-cols-3 gap-4">
            {teamStats.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <Card
                  key={index}
                  className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-gray-200 dark:border-gray-700 text-center"
                >
                  <CardContent className="p-6">
                    <Icon className="w-8 h-8 mx-auto mb-3 text-[#4A9B9E] dark:text-[#3CBBA0]" />
                    <div className="text-3xl font-bold mb-2 text-[#1A3A52] dark:text-[#4A9B9E]">
                      {stat.value}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {stat.label}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Team Members Grid */}
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {teamMembers.map((member, index) => (
            <Card
              key={index}
              className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-gray-200 dark:border-gray-700 hover:shadow-xl transition-all duration-300 hover:scale-[1.01]"
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  {/* Avatar Placeholder */}
                  <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-[#1A3A52] to-[#4A9B9E] flex items-center justify-center flex-shrink-0 shadow-lg">
                    <Users className="w-10 h-10 text-white" />
                  </div>

                  <div className="flex-1">
                    <h3 className="text-xl font-bold mb-1 text-gray-900 dark:text-gray-100">
                      {member.name}
                    </h3>
                    <p className="text-[#4A9B9E] dark:text-[#3CBBA0] font-semibold mb-3 text-sm">
                      {member.role}
                    </p>
                    <p className="text-gray-600 dark:text-gray-300 mb-4 leading-relaxed text-sm">
                      {member.bio}
                    </p>

                    {/* Expertise Tags */}
                    {member.expertise && (
                      <div className="flex flex-wrap gap-2 mb-4">
                        {member.expertise.map((exp, expIndex) => (
                          <span
                            key={expIndex}
                            className="text-xs px-2 py-1 rounded-full bg-[#1A3A52]/10 dark:bg-[#4A9B9E]/20 text-[#1A3A52] dark:text-[#4A9B9E] font-medium"
                          >
                            {exp}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Social Links */}
                    <div className="flex gap-3">
                      <a
                        href={member.linkedin}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 transition-all"
                        aria-label="LinkedIn"
                      >
                        <Linkedin className="w-4 h-4" />
                      </a>
                      <a
                        href={`mailto:${member.email}`}
                        className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-[#1A3A52] hover:text-white dark:hover:bg-[#4A9B9E] transition-all"
                        aria-label="Email"
                      >
                        <Mail className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Join Us Section */}
        <div className="text-center max-w-4xl mx-auto">
          <div className="bg-gradient-to-r from-[#1A3A52] to-[#4A9B9E] rounded-2xl shadow-xl overflow-hidden">
            <div className="p-12 md:p-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-6 text-gray-900 dark:text-gray-100">
                Want to Join Us?
              </h2>
              <p className="text-lg md:text-xl text-gray-700 dark:text-gray-200 mb-8 max-w-2xl mx-auto leading-relaxed">
                We're always looking for passionate individuals who share our mission of making insurance transparent and accessible.
              </p>
              <a href="mailto:careers@ensured.in">
                <Button
                  size="lg"
                  variant="outline"
                  className="bg-white border-2 border-gray-300 text-gray-900 hover:bg-gray-50 font-semibold px-8 py-6 text-base shadow-sm"
                >
                  <Mail className="w-5 h-5 mr-2 text-gray-700" />
                  Get in Touch
                </Button>
              </a>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}

