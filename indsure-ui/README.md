# IndSure UI - Health Insurance Comparison Tool

A comprehensive Next.js application for comparing health insurance policies in India, featuring both consumer and advisor modes.

## Features

### Consumer Mode
- **PDF Upload**: Upload up to 4 policy PDFs for comparison
- **AI Extraction**: Automatic extraction of policy details using Claude
- **Smart Comparison**: Side-by-side comparison with winner highlighting
- **Insurer Track Records**: IRDAI data integration for claim settlement ratios
- **Personalized Scoring**: Optional profile-based recommendations
- **Re-weighting**: Adjust dimension weights to see how rankings change
- **Glossary**: Tooltips for insurance terminology
- **PDF Export**: Download branded comparison reports

### Advisor Mode
- **Client Management**: Track multiple clients and their comparisons
- **Weight Presets**: Save custom scoring weights per client
- **Co-branded Reports**: Export PDFs with advisor branding
- **Private Notes**: Add advisor-only notes to comparisons
- **Comparison History**: Track all comparisons per client

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **State**: React Query + Zustand
- **Forms**: React Hook Form + Zod
- **Animations**: Framer Motion
- **PDF**: @react-pdf/renderer

## Getting Started

### Prerequisites

- Node.js 20+
- IndSure Scoring Engine running (from Prompt 2)

### Installation

```bash
# Install dependencies
npm install

# Create environment file
cp .env.example .env.local

# Edit .env.local with your API URL
NEXT_PUBLIC_API_URL=http://localhost:5001
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### Development

```bash
# Run development server
npm run dev

# Open http://localhost:3000
```

### Build

```bash
# Build for production
npm run build

# Start production server
npm start
```

## Project Structure

```
indsure-ui/
├── app/                      # Next.js App Router
│   ├── (consumer)/          # Consumer routes
│   │   ├── page.tsx         # Landing page
│   │   ├── compare/         # Comparison flow
│   │   ├── insurers/        # Insurer spotlight
│   │   └── glossary/        # Glossary
│   ├── advisor/             # Advisor routes
│   │   ├── login/
│   │   ├── signup/
│   │   ├── dashboard/
│   │   ├── clients/
│   │   └── compare/
│   ├── api/                 # API routes (proxy)
│   ├── layout.tsx           # Root layout
│   └── providers.tsx        # React Query + Theme
├── components/              # React components
│   ├── ui/                  # shadcn/ui components
│   ├── shared/              # Shared components
│   ├── consumer/            # Consumer-specific
│   └── advisor/             # Advisor-specific
├── lib/                     # Utilities
│   ├── api.ts               # API client
│   ├── types.ts             # TypeScript types
│   ├── utils.ts             # Helper functions
│   └── constants.ts         # Brand constants
├── hooks/                   # Custom hooks
├── store/                   # Zustand stores
└── public/                  # Static assets
```

## Brand System

### Colors
- **Teal Primary**: `#0D9488` - Primary actions, buttons
- **Teal Dark**: `#0F766E` - Hover states
- **Teal Light**: `#5EEAD4` - Accents
- **Cream**: `#FAF9F6` - Page background
- **Ink**: `#0F172A` - Primary text
- **Slate**: `#475569` - Secondary text

### Typography
- **Headings**: Playfair Display (serif)
- **Body**: Inter (sans-serif)
- **Numbers**: Tabular nums

### Components
- **Border Radius**: `rounded-2xl` for cards, `rounded-full` for pills
- **Shadows**: `shadow-sm` default, `shadow-md` on hover
- **Spacing**: `p-8` sections, `gap-6` grids

## Key Routes

### Consumer
- `/` - Landing page
- `/compare` - Upload and compare
- `/compare/[session_id]/results` - Comparison results
- `/insurers` - Insurer directory
- `/insurers/[id]` - Single insurer page
- `/glossary` - Full glossary

### Advisor
- `/advisor/login` - Login
- `/advisor/signup` - Signup with invite code
- `/advisor/dashboard` - Dashboard
- `/advisor/clients` - Client list
- `/advisor/clients/[id]` - Client detail
- `/advisor/compare` - Advisor comparison flow

## API Integration

All API calls proxy through Next.js API routes to the backend scoring engine:

- `POST /api/upload` - Upload PDFs
- `POST /api/compare` - Compare policies
- `POST /api/rescore` - Rescore with custom weights
- `DELETE /api/session/:id` - Delete session
- `GET /api/insurer/:id` - Get insurer details
- `GET /api/glossary` - Get glossary terms
- `GET /api/facts` - Get educational facts

## State Management

### React Query
- Server state caching
- Automatic refetching
- Optimistic updates
- Error handling

### Zustand
- Upload progress
- Profile form state
- Re-weight slider state
- Advisor client selection

## Accessibility

- Keyboard navigation
- Screen reader support
- WCAG AA contrast
- Focus indicators
- ARIA labels

## Performance

- Next.js Image optimization
- Code splitting
- Lazy loading
- Bundle size < 200KB gzipped

## Privacy & DPDP

- No PII in analytics
- Session auto-deletion (24 hours)
- Manual deletion option
- Privacy disclaimers

## Testing

```bash
# Run tests
npm test

# Run E2E tests
npm run test:e2e

# Run linting
npm run lint
```

## Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

### Environment Variables

Set these in your deployment platform:

```env
NEXT_PUBLIC_API_URL=https://your-api-url.com
NEXT_PUBLIC_SITE_URL=https://your-site-url.com
```

## Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## License

Proprietary - IndSure

## Support

For issues or questions, contact the development team.

---

**Built with ❤️ for Indian health insurance consumers**
