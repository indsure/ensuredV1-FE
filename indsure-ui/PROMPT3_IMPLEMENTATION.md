# IndSure UI/UX - Prompt 3 Implementation

## Project Structure

This Next.js 14 application implements both consumer and advisor modes for the IndSure health insurance comparison tool.

### Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **State Management**: 
  - React Query (Tanstack Query) for server state
  - Zustand for local UI state
- **Forms**: React Hook Form + Zod validation
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **PDF Generation**: @react-pdf/renderer

### Directory Structure

```
indsure-ui/
├── app/                          # Next.js App Router
│   ├── (consumer)/              # Consumer-facing routes
│   │   ├── page.tsx             # Landing page
│   │   ├── compare/             # Comparison flow
│   │   ├── insurers/            # Insurer spotlight
│   │   └── glossary/            # Glossary page
│   ├── advisor/                 # Advisor-only routes
│   │   ├── login/
│   │   ├── signup/
│   │   ├── dashboard/
│   │   ├── clients/
│   │   └── compare/
│   ├── api/                     # API route handlers (proxy to backend)
│   ├── layout.tsx               # Root layout
│   └── providers.tsx            # React Query + Theme providers
├── components/                   # Reusable components
│   ├── ui/                      # shadcn/ui components
│   ├── shared/                  # Shared components
│   │   ├── BrandHeader.tsx
│   │   ├── PolicyUploadSlot.tsx
│   │   ├── ProcessingSteps.tsx
│   │   ├── VerdictBanner.tsx
│   │   ├── ComparisonTable.tsx
│   │   ├── InsightCard.tsx
│   │   ├── ReweightPanel.tsx
│   │   ├── GlossaryTooltip.tsx
│   │   └── ...
│   ├── consumer/                # Consumer-specific components
│   └── advisor/                 # Advisor-specific components
├── lib/                         # Utilities
│   ├── api.ts                   # API client
│   ├── utils.ts                 # Helper functions
│   ├── constants.ts             # Brand colors, etc.
│   └── types.ts                 # TypeScript types
├── hooks/                       # Custom React hooks
│   ├── useUpload.ts
│   ├── useComparison.ts
│   └── useReweight.ts
├── store/                       # Zustand stores
│   ├── comparisonStore.ts
│   └── advisorStore.ts
└── public/                      # Static assets
    └── images/
```

## Brand System

### Colors (Tailwind Config)
```js
colors: {
  teal: {
    primary: '#0D9488',
    dark: '#0F766E',
    light: '#5EEAD4',
    50: '#F0FDFA',
    100: '#CCFBF1',
  },
  cream: '#FAF9F6',
  ink: '#0F172A',
  slate: {
    DEFAULT: '#475569',
    light: '#94A3B8',
  },
  success: '#059669',
  warning: '#D97706',
  danger: '#DC2626',
}
```

### Typography
- **Headings**: Playfair Display (serif)
- **Body**: Inter
- **Numbers**: Tabular nums

### Component Styling
- Border radius: `rounded-2xl` for cards, `rounded-full` for pills
- Shadows: `shadow-sm` default, `shadow-md` on hover
- Spacing: `p-8` sections, `gap-6` grids

## Key Features

### Consumer Mode
1. **Landing Page** (`/`)
   - Hero with upload CTA
   - Key dimensions education
   - Example comparison table
   - Trust signals

2. **Compare Flow** (`/compare`)
   - 4-slot PDF upload
   - Processing with educational facts
   - Optional profile capture
   - Results with verdict

3. **Results Page** (`/compare/[session_id]/results`)
   - Verdict banner with winner
   - Smart lenses (filters)
   - Comparison table with source quotes
   - Per-policy insights
   - Re-weight panel
   - PDF export

4. **Insurer Spotlight** (`/insurers`)
   - Directory of all insurers
   - Individual insurer pages with track records

5. **Glossary** (`/glossary`)
   - Searchable insurance terms
   - Tooltips throughout app

### Advisor Mode
1. **Authentication** (`/advisor/login`, `/advisor/signup`)
   - Email/password login
   - Invite code signup
   - DPDP consent

2. **Dashboard** (`/advisor/dashboard`)
   - Quick stats
   - Recent activity
   - Client management

3. **Client Management** (`/advisor/clients`)
   - Client list
   - Individual client views
   - Comparison history

4. **Advisor Compare** (`/advisor/compare`)
   - Same flow as consumer
   - Client tagging
   - Weight presets
   - Co-branded PDF export

## API Integration

All API calls go through `/api/*` routes that proxy to the backend scoring engine:

- `POST /api/upload` → `http://localhost:5001/api/upload`
- `POST /api/compare` → `http://localhost:5001/api/compare`
- `POST /api/rescore` → `http://localhost:5001/api/rescore`
- `DELETE /api/session/:id` → `http://localhost:5001/api/session/:id`
- `GET /api/insurer/:id` → `http://localhost:5001/api/insurer/:id`
- `GET /api/glossary` → `http://localhost:5001/api/glossary`
- `GET /api/facts` → `http://localhost:5001/api/facts`

## State Management

### React Query
- Server state caching
- Automatic refetching
- Optimistic updates

### Zustand
- Upload progress
- Profile form state
- Re-weight slider state
- Advisor client selection

## Accessibility

- Keyboard navigation
- Screen reader labels
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
- Session deletion
- Privacy strip
- Disclaimers

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Environment Variables

Create `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:5001
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## Testing

```bash
# Run tests
npm test

# Run E2E tests
npm run test:e2e
```

## Deployment

The app is designed to be deployed on Vercel with the backend scoring engine running separately.

---

**Status**: Foundation created, ready for component implementation
