import { lazy, Suspense } from "react";
import { Switch, Route, Redirect } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { Skeleton } from "@/components/ui/skeleton";
import { MobileNav } from "@/components/MobileNav";
import { AnalysisProvider } from "@/hooks/use-analysis";
import { ThemeProvider } from "@/hooks/use-theme";
import { usePageTransition } from "@/hooks/use-page-transition";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Clarity } from "@/components/Clarity";
import { TooltipProvider } from "@/components/ui/tooltip";
import ReportDispatcher from "@/components/ReportDispatcher";

// ARCHIVED: import { AuthProvider } from "@/hooks/use-auth";
const AuthProvider = ({ children }: { children: React.ReactNode }) => <>{children}</>;

/* ===================== ADD (Sach AI) ===================== */
import SachAIChat from "@/components/SachAIChat";
/* ========================================================= */

// --- Agent Auth ---
const AgentLanding = lazy(() => import("@/pages/agent/Landing"));
const PlaygroundEntry = lazy(() => import("@/pages/agent/PlaygroundEntry"));
const AgentLoginNew = lazy(() => import("@/pages/agent/LoginNew"));
const AgentForgotPassword = lazy(() => import("@/pages/agent/ForgotPassword"));
const AgentResetPassword = lazy(() => import("@/pages/agent/ResetPassword"));
const AgentSignupFlow = lazy(() => import("@/pages/agent/SignupFlow"));

// --- Agent App ---
const DashboardNew = lazy(() => import("@/pages/agent/DashboardNew"));
const LeadRenewals = lazy(() => import("@/pages/agent/LeadRenewals"));
const AgentUploads = lazy(() => import("@/pages/agent/AgentUploads"));
const PoliciesNew = lazy(() => import("@/pages/agent/PoliciesNew"));
const AgentCalculator = lazy(() => import("@/pages/agent/AgentCalculator"));
const AgentCompare = lazy(() => import("@/pages/agent/Compare"));
const AgentCatalogCompare = lazy(() => import("@/pages/agent/CatalogCompare"));
const RiderDirectory = lazy(() => import("@/pages/agent/RiderDirectory"));
const PolicyDetail = lazy(() => import("@/pages/agent/PolicyDetail"));
const CustomersNew = lazy(() => import("@/pages/agent/CustomersNew"));
const CustomerDetail = lazy(() => import("@/pages/agent/CustomerDetail"));
const LeadsNew = lazy(() => import("@/pages/agent/LeadsNew"));
const LeadDetail = lazy(() => import("@/pages/agent/LeadDetail"));
const MyQueue = lazy(() => import("@/pages/agent/MyQueue"));
const SettingsNew = lazy(() => import("@/pages/agent/SettingsNew"));
const MyProfile = lazy(() => import("@/pages/agent/MyProfile"));
import AgentProtectedRoute from "@/components/agent/ProtectedRoute";

// --- Public Report ---
const PublicReport = lazy(() => import("@/pages/report/PublicReport"));
const SharedReport = lazy(() => import("@/pages/SharedReport"));

// --- Admin ---
const AdminPanel = lazy(() => import("@/pages/admin/AdminPanel"));

// --- Compare ---
const CompareSample = lazy(() => import("@/pages/CompareSample"));
const PublicCatalogCompare = lazy(() => import("@/pages/compare/catalog-compare"));
const SharedComparison = lazy(() => import("@/pages/compare/SharedComparison"));

// --- Existing D2C Lazy Loads ---
const Home = lazy(() => import("@/pages/home"));
const HowItWorks = lazy(() => import("@/pages/how-it-works"));
const Pricing = lazy(() => import("@/pages/pricing"));
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
const Blog = lazy(() => import("@/pages/blog"));
const BlogPost = lazy(() => import("@/pages/blog/[id]"));
const LearnHub = lazy(() => import("@/pages/learn/index"));
const ClauseDetail = lazy(() => import("@/pages/learn/[slug]"));
const Mission = lazy(() => import("@/pages/mission"));
const Vision = lazy(() => import("@/pages/vision"));
const Team = lazy(() => import("@/pages/team"));
const AuthorPage = lazy(() => import("@/pages/author"));
const WhyIndSure = lazy(() => import("@/pages/why-indsure"));
const Help = lazy(() => import("@/pages/help"));
const Account = lazy(() => import("@/pages/account"));
const Hospitals = lazy(() => import("@/pages/hospitals"));
const PrivacyPolicy = lazy(() => import("@/pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("@/pages/TermsOfService"));
const CookiePolicy = lazy(() => import("@/pages/CookiePolicy"));
const GrievanceOfficer = lazy(() => import("@/pages/GrievanceOfficer"));
const LoginPublic = lazy(() => import("@/pages/login"));
const SignupPublic = lazy(() => import("@/pages/signup"));
const ForgotPasswordPublic = lazy(() => import("@/pages/forgot-password"));
const ResetPasswordPublic = lazy(() => import("@/pages/reset-password"));

// --- Consumer (D2C individual) portfolio app ---
const PortfolioPage = lazy(() => import("@/pages/app/portfolio"));
const ConsumerPolicyDetail = lazy(() => import("@/pages/app/policy-detail"));
import UserProtectedRoute from "@/components/UserProtectedRoute";

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
// MAIN APP (WOUTER ONLY)
// ------------------------------------------------------------
function App() {
  usePageTransition();

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <AnalysisProvider>
                <TooltipProvider>
                  <Toaster />
                  <Clarity />

                  <Suspense fallback={<PageLoader />}>
                    <Switch>
                      {/* --- Home --- */}
                      <Route path="/" component={Home} />
                      <Route path="/how-it-works" component={HowItWorks} />
                      <Route path="/pricing" component={Pricing} />
                      <Route path="/processing" component={Processing} />

                      {/* --- Report routes --- */}
                      <Route path="/report" component={Report} />
                      <Route path="/report/:token" component={PublicReport} />
                      
                      {/* PUBLIC ROUTE — do NOT add AgentProtectedRoute here.
                          This is the client-facing shared report view. */}
                      <Route path="/shared/report/:token">
                        {(params) => <SharedReport token={params.token} />}
                      </Route>

                      {/* --- PolicyChecker --- */}
                      <Route path="/policychecker" component={PolicyChecker} />

                      {/* --- Analyze --- */}
                      <Route path="/analyze" component={AnalyzePage} />

                      {/* --- Insurance types --- */}
                      <Route path="/life" component={LifePage} />
                      <Route path="/term" component={TermPage} />
                      <Route path="/vehicle" component={VehiclePage} />

                      {/* --- Calculator --- */}
                      <Route path="/calculator" component={CalculatorPage} />
                      <Route path="/calculator/report" component={CalculatorReportPage} />
                      <Route path="/calculator/report/:uuid" component={CalculatorReportPage} />

                      {/* --- Compare (public catalog compare + shared agent reports) --- */}
                      <Route path="/compare/report/:uuid">
                        {(params) => <SharedComparison uuid={params.uuid} />}
                      </Route>
                      <Route path="/compare" component={PublicCatalogCompare} />
                      <Route path="/compare/sample" component={CompareSample} />

                      {/* --- Agent Auth --- */}
                      <Route path="/agent" component={AgentLanding} />
                      <Route path="/agent/playground" component={PlaygroundEntry} />
                      <Route path="/agent/login" component={AgentLoginNew} />
                      <Route path="/agent/forgot-password" component={AgentForgotPassword} />
                      <Route path="/agent/reset-password" component={AgentResetPassword} />
                      <Route path="/agent/signup/:rest*" component={AgentSignupFlow} />

                      {/* --- Agent Protected App --- */}
                      <Route path="/agent/dashboard">
                        {() => <AgentProtectedRoute><DashboardNew /></AgentProtectedRoute>}
                      </Route>
                      <Route path="/agent/uploads">
                        {() => <AgentProtectedRoute><AgentUploads /></AgentProtectedRoute>}
                      </Route>
                      <Route path="/agent/policies">
                        {() => <AgentProtectedRoute><PoliciesNew /></AgentProtectedRoute>}
                      </Route>
                      <Route path="/agent/policies/:id">
                        {() => <AgentProtectedRoute><PolicyDetail /></AgentProtectedRoute>}
                      </Route>
                      <Route path="/agent/customers">
                        {() => <AgentProtectedRoute><CustomersNew /></AgentProtectedRoute>}
                      </Route>
                      <Route path="/agent/customers/:id">
                        {() => <AgentProtectedRoute><CustomerDetail /></AgentProtectedRoute>}
                      </Route>
                      <Route path="/agent/leads">
                        {() => <AgentProtectedRoute><LeadsNew /></AgentProtectedRoute>}
                      </Route>
                      <Route path="/agent/leads/:id">
                        {() => <AgentProtectedRoute><LeadDetail /></AgentProtectedRoute>}
                      </Route>
                      <Route path="/agent/renewals">
                        {() => <AgentProtectedRoute><LeadRenewals /></AgentProtectedRoute>}
                      </Route>
                      <Route path="/agent/my-queue">
                        {() => <AgentProtectedRoute><MyQueue /></AgentProtectedRoute>}
                      </Route>
                      <Route path="/agent/calculator">
                        {() => <AgentProtectedRoute><AgentCalculator /></AgentProtectedRoute>}
                      </Route>
                      <Route path="/agent/compare/catalog">
                        {() => <AgentProtectedRoute><AgentCatalogCompare /></AgentProtectedRoute>}
                      </Route>
                      <Route path="/agent/compare">
                        {() => <AgentProtectedRoute><AgentCompare /></AgentProtectedRoute>}
                      </Route>
                      <Route path="/agent/riders">
                        {() => <AgentProtectedRoute><RiderDirectory /></AgentProtectedRoute>}
                      </Route>
                      <Route path="/agent/settings">
                        {() => <AgentProtectedRoute><SettingsNew /></AgentProtectedRoute>}
                      </Route>
                      <Route path="/agent/profile">
                        {() => <AgentProtectedRoute><MyProfile /></AgentProtectedRoute>}
                      </Route>

                      {/* --- Agent Catch-all --- */}
                      <Route path="/agent/:rest*">
                        {() => <Redirect to="/agent/dashboard" />}
                      </Route>

                      {/* --- Admin --- */}
                      <Route path="/admin" component={AdminPanel} />

                      {/* --- Company pages --- */}
                      <Route path="/blog" component={Blog} />
                      <Route path="/blog/:id" component={BlogPost} />
                      <Route path="/learn" component={LearnHub} />
                      <Route path="/learn/:slug" component={ClauseDetail} />
                      <Route path="/mission" component={Mission} />
                      <Route path="/vision" component={Vision} />
                      <Route path="/team" component={Team} />
                      <Route path="/author/:slug" component={AuthorPage} />
                      <Route path="/why-indsure" component={WhyIndSure} />

                      {/* --- Support & Account --- */}
                      <Route path="/help" component={Help} />
                      <Route path="/account" component={Account} />

                      {/* --- Consumer (D2C individual) auth + portfolio --- */}
                      <Route path="/login" component={LoginPublic} />
                      <Route path="/signup" component={SignupPublic} />
                      <Route path="/forgot-password" component={ForgotPasswordPublic} />
                      <Route path="/reset-password" component={ResetPasswordPublic} />
                      <Route path="/app">
                        {() => <UserProtectedRoute><PortfolioPage /></UserProtectedRoute>}
                      </Route>
                      <Route path="/app/policy/:id">
                        {(params) => <UserProtectedRoute><ConsumerPolicyDetail id={params.id} /></UserProtectedRoute>}
                      </Route>

                      {/* --- Hospitals --- */}
                      <Route path="/find-provider" component={Hospitals} />
                      <Route path="/hospitals" component={Hospitals} />

                      {/* --- Legal pages --- */}
                      <Route path="/privacy-policy" component={PrivacyPolicy} />
                      <Route path="/terms" component={TermsOfService} />
                      <Route path="/cookie-policy" component={CookiePolicy} />
                      <Route path="/grievance" component={GrievanceOfficer} />

                      <Route component={NotFound} />
                    </Switch>
                  </Suspense>

                  <MobileNav />
                  <SachAIChat />
                </TooltipProvider>
            </AnalysisProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
