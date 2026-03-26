export interface InsurerConfig {
  name: string;
  portalUrl: string;
  loginDetector: string;      // CSS selector visible only after login
  policyPagePath: string;     // path to navigate to after login
  downloadSelector: string;   // selector for the download button/link
}

export const INSURER_CONFIG: Record<string, InsurerConfig> = {
  manipalcigna: {
    name: 'ManipalCigna',
    portalUrl: 'https://eservicing.manipalcigna.com/',
    loginDetector: '#welcomeUser, .user-dashboard, .policy-list',
    policyPagePath: '/policy-details',
    downloadSelector: 'a[href*=".pdf"], button:has-text("Download"), a:has-text("Policy Copy")',
  },
  starhealthinsurance: {
    name: 'Star Health',
    portalUrl: 'https://customer.starhealth.in/sso/login',
    loginDetector: '.my-account-header, .customer-dashboard',
    policyPagePath: '/my-policies',
    downloadSelector: '.download-policy, a:has-text("Download Policy")',
  },
  hdfcergo: {
    name: 'HDFC Ergo',
    portalUrl: 'https://www.hdfcergo.com/dashboard/auth/login/',
    loginDetector: '.customer-name, #customerDashboard',
    policyPagePath: '/my-policies',
    downloadSelector: 'a:has-text("Download"), button:has-text("Policy Document")',
  },
  nivabupa: {
    name: 'Niva Bupa',
    portalUrl: 'https://www.nivabupa.com/health-insurance-articles/niva-bupa-customer-login-portal.html',
    loginDetector: '.dashboard-container, .policy-card',
    policyPagePath: '/my-policies',
    downloadSelector: 'a:has-text("Download Policy"), .policy-download-btn',
  },
  bajajAllianz: {
    name: 'Bajaj Allianz',
    portalUrl: 'https://www.bajajgeneralinsurance.com/customer-signin.html',
    loginDetector: '.self-service-dashboard',
    policyPagePath: '/health-policies',
    downloadSelector: 'a:has-text("Download"), button:has-text("E-Policy")',
  },
};

