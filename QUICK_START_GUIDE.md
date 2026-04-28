# Agent Dashboard - Quick Start Guide

## 🚀 Getting Started

### Prerequisites
- Node.js 20+ installed
- npm or yarn package manager
- Backend API running (or mock API)

### Installation

```bash
cd agentdashboardreview
npm install
```

### Configuration

1. **Environment Variables:**
   Edit `.env.local` with your configuration:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:5000/api
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
   ```

2. **Start Development Server:**
   ```bash
   npm run dev
   ```

3. **Access Application:**
   Open http://localhost:3000

### Login

Use these demo credentials (configure in your backend):
- **Email:** admin@indsure.com
- **Password:** admin123

---

## 📁 Project Structure

```
agentdashboardreview/
├── src/
│   ├── app/                    # Next.js app router pages
│   │   ├── (auth)/
│   │   │   └── login/         # Login page
│   │   ├── dashboard/         # Dashboard page
│   │   ├── policies/          # Policies list & detail
│   │   ├── my-queue/          # Agent queue
│   │   ├── reports/           # Reports list & detail
│   │   ├── errors/            # Error management
│   │   ├── agents/            # Agent management
│   │   └── settings/          # Settings page
│   ├── components/
│   │   ├── ui/                # UI components (shadcn)
│   │   └── AppShell.tsx       # Main layout with sidebar
│   ├── contexts/
│   │   └── auth-context.tsx   # Authentication context
│   ├── lib/
│   │   ├── api-client.ts      # API client
│   │   └── utils.ts           # Utility functions
│   └── hooks/
│       └── use-mobile.ts      # Mobile detection hook
├── .env.local                 # Environment variables
└── package.json
```

---

## 🔑 Key Features

### Authentication
- Login/logout functionality
- Token-based authentication
- Role-based access control (admin, manager, agent)
- Protected routes

### Pages
1. **Dashboard** - Metrics, failures, high-risk items
2. **My Queue** - Personal work queue
3. **Policies** - Policy management with filters
4. **Reports** - Report viewing and analysis
5. **Errors** - System error management
6. **Agents** - Agent management (admin/manager only)
7. **Settings** - User preferences (admin only)

### API Integration
All pages fetch real data from backend API endpoints:
- `/api/dashboard/*` - Dashboard data
- `/api/policies/*` - Policy operations
- `/api/queue/*` - Queue management
- `/api/reports/*` - Report data
- `/api/agents/*` - Agent management
- `/api/errors/*` - Error handling
- `/api/auth/*` - Authentication

---

## 🛠️ Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint
```

---

## 🔐 User Roles

### Admin
- Full access to all features
- Can manage agents
- Can access settings
- Can view all policies and reports

### Manager
- Can view dashboard
- Can manage policies
- Can view reports and errors
- Cannot access settings

### Agent
- Can view their queue
- Can view assigned policies
- Can view reports
- Limited dashboard access

---

## 📡 API Requirements

Your backend must implement these endpoints:

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user

### Dashboard
- `GET /api/dashboard/metrics` - Get dashboard metrics
- `GET /api/dashboard/failures` - Get recent failures
- `GET /api/dashboard/high-risk` - Get high-risk items

### Policies
- `GET /api/policies` - List policies (with filters)
- `GET /api/policies/:id` - Get policy details
- `POST /api/policies` - Create policy
- `PUT /api/policies/:id` - Update policy

### Queue
- `GET /api/queue/my-queue` - Get user's queue
- `POST /api/queue/assign/:id` - Assign policy to user

### Reports
- `GET /api/reports` - List reports
- `GET /api/reports/:id` - Get report details

### Agents
- `GET /api/agents` - List agents
- `GET /api/agents/:id` - Get agent details
- `PUT /api/agents/:id` - Update agent

### Errors
- `GET /api/errors` - List errors (with filters)
- `POST /api/errors/:id/retry` - Retry failed operation
- `POST /api/errors/:id/resolve` - Resolve error

---

## 🎨 Customization

### Branding
Edit `src/components/AppShell.tsx`:
```typescript
// Change logo
<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
  <span className="text-sm font-bold">I</span> {/* Change this */}
</div>

// Change app name
<span className="text-sm font-semibold">IndSure</span> {/* Change this */}
```

### Theme Colors
Edit `src/app/globals.css` to customize colors:
```css
:root {
  --primary: oklch(0.205 0 0);
  --secondary: oklch(0.97 0 0);
  /* ... more colors */
}
```

---

## 🐛 Troubleshooting

### Build Errors
```bash
# Clear cache and rebuild
rm -rf .next
npm run build
```

### API Connection Issues
1. Check `NEXT_PUBLIC_API_URL` in `.env.local`
2. Verify backend is running
3. Check browser console for CORS errors

### Authentication Issues
1. Verify token is stored in localStorage
2. Check API returns correct user object
3. Verify protected routes are working

---

## 📚 Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [React Query Documentation](https://tanstack.com/query/latest)
- [shadcn/ui Documentation](https://ui.shadcn.com)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

---

## 🤝 Support

For issues or questions:
1. Check the `FIXES_COMPLETED.md` for implementation details
2. Review the `AGENT_DASHBOARD_AUDIT_REPORT.md` for architecture
3. Check API client in `src/lib/api-client.ts` for endpoint definitions

---

**Happy Coding! 🎉**
