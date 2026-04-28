# IndSure UI - Quick Start Guide

## 🚀 Get Running in 5 Minutes

### Prerequisites
- Node.js 20+
- Backend scoring engine running (Prompt 2)

### Installation

```bash
cd indsure-ui
npm install
cp .env.example .env.local
```

### Configuration

Edit `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:5001
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### Run

```bash
npm run dev
```

Open http://localhost:3000

---

## 📁 Key Files

### Types
- `lib/types.ts` - All TypeScript interfaces

### API
- `lib/api.ts` - Backend communication

### Utilities
- `lib/utils.ts` - Helper functions
- `lib/constants.ts` - Brand constants

### Pages
- `app/page.tsx` - Landing page (example)

### Config
- `tailwind.config.ts` - Brand colors
- `.env.example` - Environment template

---

## 🎨 Brand Colors

```typescript
// Primary
teal-primary: '#0D9488'
teal-dark: '#0F766E'
teal-light: '#5EEAD4'

// Background
cream: '#FAF9F6'
teal-50: '#F0FDFA'

// Text
ink: '#0F172A'
slate: '#475569'

// Status
success: '#059669'
warning: '#D97706'
danger: '#DC2626'
```

---

## 🔧 Common Tasks

### Add a New Page

```bash
# Create route
mkdir -p app/my-page
touch app/my-page/page.tsx
```

```tsx
// app/my-page/page.tsx
export default function MyPage() {
  return <div>My Page</div>;
}
```

### Call API

```typescript
import { uploadPolicies } from '@/lib/api';

const files = [file1, file2];
const result = await uploadPolicies(files);
console.log(result.session_id);
```

### Format Currency

```typescript
import { formatCurrency, formatNumber } from '@/lib/utils';

formatCurrency(15000);  // ₹15,000
formatNumber(1000000);  // ₹10L
```

### Use Brand Colors

```tsx
<div className="bg-teal-primary text-white">
  <button className="bg-teal-dark hover:bg-teal-primary">
    Click Me
  </button>
</div>
```

---

## 📚 Documentation

- **README.md** - Full project documentation
- **PROMPT3_IMPLEMENTATION.md** - Architecture details
- **PROMPT3_COMPLETION_SUMMARY.md** - Roadmap and specs
- **FINAL_SUMMARY.md** - Complete overview

---

## 🐛 Troubleshooting

### Port 3000 in use
```bash
# Use different port
PORT=3001 npm run dev
```

### API connection failed
- Check backend is running on port 5001
- Verify NEXT_PUBLIC_API_URL in .env.local

### Type errors
```bash
# Regenerate types
npm run build
```

---

## 📦 Next Steps

1. Review `app/page.tsx` for component patterns
2. Check `lib/types.ts` for available types
3. Read `PROMPT3_COMPLETION_SUMMARY.md` for roadmap
4. Start building components from Phase 1

---

## 🆘 Need Help?

- Check documentation files
- Review example landing page
- Consult backend API docs (Prompt 2)
- Review data layer schema (Prompt 1)

---

**Happy coding! 🎉**
