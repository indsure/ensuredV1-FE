import { lazy, Suspense } from "react";
import { Switch, Route } from "wouter";
import { BrowserRouter, Routes, Route as ReactRoute } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { Skeleton } from "@/components/ui/skeleton";
import { MobileNav } from "@/components/MobileNav";
import { AnalysisProvider } from "@/hooks/use-analysis";
import { ThemeProvider } from "@/hooks/use-theme";
import { ComparisonProvider } from "@/hooks/use-comparison";
import { usePageTransition } from "@/hooks/use-page-transition";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { TooltipProvider } from "@/components/ui/tooltip";
import ReportDispatcher from "@/components/ReportDispatcher";

// ARCHIVED: import { AuthProvider } from "@/hooks/use-auth";
const AuthProvider = ({ children }: { children: React.ReactNode }) => <>{children}</>;

/* ===================== ADD (Sach AI) ===================== */
import SachAIChat from "@/components/SachAIChat";
/* ========================================================= */

// --- Agent Auth ---
const AgentLogin = lazy(() => import("@/pages/agent/Login"));
const AgentSignupStep1 = lazy(() => import("@/pages/agent/SignupStep1"));
const AgentSignupStep2 = lazy(() => import("@/pages/agent/SignupStep2"));

// --- Agent App ---
const AgentDashboard = lazy(() => import("@/pages/agent/Dashboard"));
const AgentPolicies = lazy(() => import("@/pages/agent/Clients"));
const AgentClientDetail = lazy(() => import("@/pages/agent/ClientDetail"));
const AgentUploads = lazy(() => import("@/pages/agent/Uploads"));
const AgentReports = lazy(() => import("@/pages/agent/Reports"));
const AgentSettings = lazy(() => import("@/pages/agent/Settings"));
const AgentResetPassword = lazy(() => import("@/pages/agent/ResetPassword"));
import AgentProtectedRoute from "@/components/agent/ProtectedRoute";

// --- Public ---
const PublicReport = lazy(() => import("@/pages/report/PublicReport"));

// --- Admin ---
const AdminPanel = lazy(() => import("@/pages/admin/AdminPanel"));

// --- Compare Fix ---
const CompareMaintenance = lazy(() => import("@/pages/CompareMaintenance"));
const CompareSample = lazy(() => import("@/pages/CompareSample"));

// --- Existing D2C Lazy Loads ---
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

// ------------------------------------------------------------
// WOUTER APP (LEGACY D2C ROUTES)
// ------------------------------------------------------------
function WouterApp() {
  // Execute page transition hook inside the wouter context
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
        {/* React Router DOM handles this path now */}
        {/* <Route path="/compare" component={ComparePage} /> */}

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
        <Route path="/hospitals" component={Hospitals} />

        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

// ------------------------------------------------------------
// MAIN APP ROOT (CONDITIONAL ROUTER)
// ------------------------------------------------------------
function App() {
  const currentPath = window.location.pathname;

  // Isolate routing domains completely to prevent React Router DOM and Wouter
  // from conflicting over the exact same React Hook context
  const isReactRouter =
    currentPath.startsWith('/agent') ||
    currentPath.startsWith('/admin') ||
    currentPath.startsWith('/compare') ||
    currentPath.startsWith('/report/');

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <AnalysisProvider>
              <ComparisonProvider>
                <TooltipProvider>
                  <Toaster />

                  {isReactRouter ? (
                    <BrowserRouter>
                      <Routes>
                        {/* --- Agent Auth --- */}
                        <ReactRoute path="/agent/login" element={<Suspense fallback={<PageLoader />}><AgentLogin /></Suspense>} />
                        <ReactRoute path="/agent/signup" element={<Suspense fallback={<PageLoader />}><AgentSignupStep1 /></Suspense>} />
                        <ReactRoute path="/agent/signup/empanelment" element={<Suspense fallback={<PageLoader />}><AgentSignupStep2 /></Suspense>} />

                        {/* --- Agent Protected App --- */}
                        <ReactRoute element={<AgentProtectedRoute />}>
                          <ReactRoute path="/agent/dashboard" element={<Suspense fallback={<PageLoader />}><AgentDashboard /></Suspense>} />
                          <ReactRoute path="/agent/policies" element={<Suspense fallback={<PageLoader />}><AgentPolicies /></Suspense>} />
                          <ReactRoute path="/agent/uploads" element={<Suspense fallback={<PageLoader />}><AgentUploads /></Suspense>} />
                          <ReactRoute path="/agent/reports" element={<Suspense fallback={<PageLoader />}><AgentReports /></Suspense>} />
                          <ReactRoute path="/agent/settings" element={<Suspense fallback={<PageLoader />}><AgentSettings /></Suspense>} />
                          
                          {/* Keep original routes to avoid breaking legacy links if any */}
                          <ReactRoute path="/agent/clients" element={<Suspense fallback={<PageLoader />}><AgentPolicies /></Suspense>} />
                          <ReactRoute path="/agent/clients/:id" element={<Suspense fallback={<PageLoader />}><AgentClientDetail /></Suspense>} />
                        </ReactRoute>

                        <ReactRoute path="/agent/reset-password" element={<Suspense fallback={<PageLoader />}><AgentResetPassword /></Suspense>} />


                        {/* --- Public Shareable Report --- */}
                        <ReactRoute path="/report/:uuid" element={<ReportDispatcher />} />

                        {/* --- Admin --- */}
                        <ReactRoute path="/admin" element={<Suspense fallback={<PageLoader />}><AdminPanel /></Suspense>} />

                        {/* --- Compare Maintenance Fix --- */}
                        <ReactRoute path="/compare" element={<Suspense fallback={<PageLoader />}><CompareMaintenance /></Suspense>} />
                        <ReactRoute path="/compare/sample" element={<Suspense fallback={<PageLoader />}><CompareSample /></Suspense>} />

                        {/* Catch-all for react-router mode just in case */}
                        <ReactRoute path="*" element={<Suspense fallback={<PageLoader />}><NotFound /></Suspense>} />
                      </Routes>
                    </BrowserRouter>
                  ) : (
                    <WouterApp />
                  )}

                  <MobileNav />
                  <SachAIChat />
                </TooltipProvider>
              </ComparisonProvider>
            </AnalysisProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;

