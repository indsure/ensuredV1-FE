import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { 
  FileText, 
  Users, 
  TrendingUp, 
  Shield, 
  Clock, 
  CheckCircle 
} from "lucide-react";

export default function AgentLandingPage() {
  const features = [
    {
      icon: FileText,
      title: "Policy Management",
      description: "Review, approve, and manage insurance policies efficiently with our streamlined workflow system."
    },
    {
      icon: Users,
      title: "Client Dashboard",
      description: "Access comprehensive client information and track all interactions in one centralized location."
    },
    {
      icon: TrendingUp,
      title: "Performance Analytics",
      description: "Monitor your performance metrics, track goals, and gain insights into your productivity."
    },
    {
      icon: Shield,
      title: "Compliance Tools",
      description: "Stay compliant with built-in regulatory checks and automated compliance reporting."
    },
    {
      icon: Clock,
      title: "Queue Management",
      description: "Prioritize and manage your workload with intelligent queue sorting and task assignment."
    },
    {
      icon: CheckCircle,
      title: "Approval Workflows",
      description: "Streamline approval processes with customizable workflows and automated notifications."
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Hero Section */}
      <div className="mx-auto max-w-7xl px-6 py-16 lg:py-24">
        <div className="text-center">
          <div className="mb-4 inline-block rounded-full bg-blue-100 px-4 py-1.5 text-sm font-medium text-blue-700">
            For Insurance Advisors
          </div>
          <h1 className="mb-6 text-5xl font-bold tracking-tight text-slate-900 lg:text-6xl">
            Welcome to IndSure
            <span className="block text-blue-600">Advisor Portal</span>
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-xl text-slate-600">
            Your comprehensive platform for managing insurance policies, clients, and workflows. 
            Streamline your operations and deliver exceptional service.
          </p>
          
          {/* CTA Buttons */}
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/login">
              <Button size="lg" className="w-full px-8 py-6 text-lg sm:w-auto">
                Login to Your Account
              </Button>
            </Link>
            <Link href="/signup">
              <Button 
                size="lg" 
                variant="outline" 
                className="w-full px-8 py-6 text-lg sm:w-auto"
              >
                Create New Account
              </Button>
            </Link>
          </div>
          
          <p className="mt-6 text-sm text-slate-500">
            Already have an account? Login to access your dashboard
          </p>
        </div>
      </div>

      {/* Features Grid */}
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-3xl font-bold text-slate-900">
            Everything You Need to Succeed
          </h2>
          <p className="text-lg text-slate-600">
            Powerful tools designed specifically for insurance advisors
          </p>
        </div>
        
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Card 
                key={index} 
                className="border-slate-200 p-6 transition-shadow hover:shadow-lg"
              >
                <div className="mb-4 inline-flex rounded-lg bg-blue-100 p-3">
                  <Icon className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="mb-2 text-xl font-semibold text-slate-900">
                  {feature.title}
                </h3>
                <p className="text-slate-600">
                  {feature.description}
                </p>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Stats Section */}
      <div className="bg-blue-600 py-16">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-8 text-center md:grid-cols-3">
            <div>
              <div className="mb-2 text-4xl font-bold text-white">10,000+</div>
              <div className="text-blue-100">Policies Managed</div>
            </div>
            <div>
              <div className="mb-2 text-4xl font-bold text-white">500+</div>
              <div className="text-blue-100">Active Advisors</div>
            </div>
            <div>
              <div className="mb-2 text-4xl font-bold text-white">99.9%</div>
              <div className="text-blue-100">Uptime Guarantee</div>
            </div>
          </div>
        </div>
      </div>

      {/* Final CTA */}
      <div className="mx-auto max-w-4xl px-6 py-16 text-center">
        <h2 className="mb-4 text-3xl font-bold text-slate-900">
          Ready to Get Started?
        </h2>
        <p className="mb-8 text-lg text-slate-600">
          Join hundreds of advisors who trust IndSure for their daily operations
        </p>
        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link href="/login">
            <Button size="lg" className="w-full px-8 py-6 text-lg sm:w-auto">
              Login Now
            </Button>
          </Link>
          <Link href="/signup">
            <Button 
              size="lg" 
              variant="outline" 
              className="w-full px-8 py-6 text-lg sm:w-auto"
            >
              Sign Up Free
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
