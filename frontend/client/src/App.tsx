import { lazy, Suspense } from "react";
import { Switch, Route } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { Skeleton } from "@/components/ui/skeleton";
import { MobileNav } from "@/components/MobileNav";
import { AnalysisProvider } from "@/hooks/use-analysis";
import { ThemeProvider } from "@/hooks/use-theme";
import { ComparisonProvider } from "@/hooks/use-comparison";
import { usePageTransition } from "@/hooks/use-page-transition";
import { ErrorBoundary } from "@/components/ErrorBoundary";

/* ===================== ADD (Sach AI) ===================== */
import SachAIChat from "@/components/SachAIChat";
/* ========================================================= */

// Lazy load routes for code splitting
const Home = lazy(() => import("@/pages/home"));
const NotFound = lazy(() => import("@/pages/not-found"));
const Processing = lazy(() => import("@/pages/processing"));
const Report = lazy(() => import("@/pages/report"));
const PolicyChecker = lazy(() => import("@/pages/policychecker"));
const AnalyzePage = lazy(() => import("@/pages/analyze"));
const LifePage = lazy(() => import("@/pages/life"));
const TermPage = lazy(() => import("@/pages/term"));
const VehiclePage = lazy(() => import("@/pages/vehicle"));
const CalculatorPage = lazy(() => import("@/pages/calculator"));
const CalculatorReportPage = lazy(() => import("@/pages/calculator-report"));
const ComparePage = lazy(() => import("@/pages/compare"));
const Blog = lazy(() => import("@/pages/blog"));
const BlogPost = lazy(() => import("@/pages/blog/[id]"));
const Mission = lazy(() => import("@/pages/mission"));
const Vision = lazy(() => import("@/pages/vision"));
const Team = lazy(() => import("@/pages/team"));
const WhyIndSure = lazy(() => import("@/pages/why-indsure"));
const Help = lazy(() => import("@/pages/help"));
const Account = lazy(() => import("@/pages/account"));
const Hospitals = lazy(() => import("@/pages/hospitals"));


// Loading fallback component
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="space-y-4 w-full max-w-md px-4">
        <Skeleton variant="rectangular" width="100%" height={200} />
        <Skeleton variant="text" lines={3} />
        <Skeleton variant="rectangular" width="100%" height={40} />
      </div>
    </div>
  );
}

// ✅ FIX: Make Router a proper component (not just a function)
function Router() {
  // ✅ Now hooks can be called safely inside this component
  usePageTransition();

  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/processing" component={Processing} />

        {/* Support BOTH report routes */}
        <Route path="/report" component={Report} />
        <Route path="/report/:id" component={Report} />

        {/* PolicyChecker - Flagship tool */}
        <Route path="/policychecker" component={PolicyChecker} />

        {/* Analyze Page - Type Selector */}
        <Route path="/analyze" component={AnalyzePage} />

        {/* Life Insurance Analyzer */}
        <Route path="/life" component={LifePage} />

        {/* Term Life Insurance Analyzer */}
        <Route path="/term" component={TermPage} />

        {/* Vehicle Insurance Analyzer */}
        <Route path="/vehicle" component={VehiclePage} />

        {/* Optimal Insurance Calculator */}
        <Route path="/calculator" component={CalculatorPage} />
        <Route path="/calculator/report" component={CalculatorReportPage} />

        {/* Policy Comparison - Single Page Redesign */}
        <Route path="/compare" component={ComparePage} />

        {/* Company Pages */}
        <Route path="/blog" component={Blog} />
        <Route path="/blog/:id" component={BlogPost} />
        <Route path="/mission" component={Mission} />
        <Route path="/vision" component={Vision} />
        <Route path="/team" component={Team} />
        <Route path="/why-indsure" component={WhyIndSure} />

        {/* Support & Account */}
        <Route path="/help" component={Help} />
        <Route path="/account" component={Account} />

        {/* Hospital Network Finder */}
        <Route path="/find-provider" component={Hospitals} />

        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AnalysisProvider>
          <ComparisonProvider>
            <Toaster />
            <Router />
            <MobileNav />
            <SachAIChat />
          </ComparisonProvider>
        </AnalysisProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
