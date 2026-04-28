# Lead Collection System - Visual Guide

## 🎨 What You'll See

### 1. Policy Report Page (User View)

When a user views their policy report at `http://127.0.0.1:5412/report`, and the system recommends porting to a better policy, they'll see:

```
┌─────────────────────────────────────────────────────────────┐
│  → CONSIDER                                                  │
│                                                              │
│  PORT TO BETTER POLICY?                                      │
│                                                              │
│  While the policy is mature (6 years old), the base cover   │
│  is low and the room rent proportional deduction is a       │
│  major risk. Porting to a policy with 'Any Room' coverage   │
│  and no proportional deductions is highly recommended.      │
│                                                              │
│  ✓ No room rent limits (Any Room category)                  │
│  ✓ No proportional deductions                               │
│  ✓ Consumables cover rider                                  │
│                                                              │
│  ─────────────────────────────────────────────────────────  │
│                                                              │
│  FULL NAME                    PHONE NUMBER                  │
│  [John Doe          ]         [9876543210]                  │
│                                                              │
│  EMAIL ADDRESS                CITY                          │
│  [john@example.com  ]         [Mumbai     ]                 │
│                                                              │
│  [Talk to an IndSure Advisor about this →]                  │
│                                                              │
│  Our advisors will help you find the best policy            │
└─────────────────────────────────────────────────────────────┘
```

**Design Features**:
- Amber/orange gradient background
- "→ CONSIDER" badge at top
- Clear recommendation text
- Bullet points with checkmarks
- Clean form layout
- Prominent CTA button

### 2. Success State

After submission:

```
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│                    ✓                                         │
│                                                              │
│              Thank You!                                      │
│                                                              │
│  Our advisor will reach out to you within 24 hours          │
│  to discuss your policy options.                            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 3. Admin Panel (Admin View)

At `http://127.0.0.1:5412/admin` → Leads tab:

```
┌─────────────────────────────────────────────────────────────┐
│  IndSure Admin                                    [Nikhil ▼] │
├─────────────────────────────────────────────────────────────┤
│  📊 Overview                                                 │
│  👥 Agents                                                   │
│  🔑 Invite Codes                                             │
│  👥 Leads                                    ← NEW TAB       │
└─────────────────────────────────────────────────────────────┘

┌──────────────┬──────────────┬──────────────┬──────────────┐
│ Total Leads  │     New      │  Contacted   │  Converted   │
│     42       │     15       │      18      │      9       │
└──────────────┴──────────────┴──────────────┴──────────────┘

┌─────────────────────────────────────────────────────────────┐
│  👥 Lead Collection              [All Status ▼]  [🔄]       │
├─────────────────────────────────────────────────────────────┤
│  Name     │ Contact           │ City   │ Source  │ Status  │
├───────────┼───────────────────┼────────┼─────────┼─────────┤
│ John Doe  │ 📞 9876543210     │ Mumbai │ policy  │ [New]   │
│           │ ✉ john@example.com│        │ _report │         │
├───────────┼───────────────────┼────────┼─────────┼─────────┤
│ Jane Smith│ 📞 9123456789     │ Delhi  │ policy  │[Contact]│
│           │ ✉ jane@example.com│        │ _report │         │
└───────────┴───────────────────┴────────┴─────────┴─────────┘
```

**Admin Features**:
- Statistics dashboard
- Filter by status
- Clickable phone/email
- Status badges with colors
- Refresh button

## 🎯 When Does the CTA Appear?

The lead collection CTA appears when:

1. User views a policy report
2. System analyzes the policy
3. Recommendation is either:
   - `"consider"` - Shows amber CTA
   - `"yes"` - Shows red CTA (more urgent)

## 🎨 Color Coding

### CTA Variants

**CONSIDER (Amber)**:
- Background: Amber/Orange gradient
- Badge: Amber with "→ CONSIDER"
- Button: Amber-600
- Use case: Policy has issues but not critical

**ACTION REQUIRED (Red)**:
- Background: Red gradient
- Badge: Red with "⚠ ACTION REQUIRED"
- Button: Red-600
- Use case: Policy has critical issues

## 📱 Responsive Design

The CTA is fully responsive:

**Desktop** (>768px):
- 2-column form layout
- Full-width button
- Spacious padding

**Mobile** (<768px):
- Single-column form
- Stacked inputs
- Touch-friendly buttons

## 🔄 Form Validation

Visual feedback:

```
✓ Valid email: green border
✗ Invalid email: red border + error message

✓ Valid phone (10 digits): green border
✗ Invalid phone: red border + "Must be 10 digits"

✓ All fields filled: button enabled
✗ Missing fields: button disabled
```

## 🎭 States

### Loading State
```
[⟳ Submitting...]
```

### Success State
```
[✓ Thank You!]
```

### Error State
```
[✗ Failed to submit. Please try again.]
```

## 📊 Admin Dashboard Stats

Color-coded cards:
- **Total Leads**: Blue icon
- **New**: Blue icon (clock)
- **Contacted**: Yellow icon (phone)
- **Converted**: Green icon (checkmark)

## 🎨 Design System

**Colors**:
- Primary: Teal (#0D9488)
- Accent: Amber (#F59E0B)
- Success: Green (#10B981)
- Warning: Yellow (#F59E0B)
- Danger: Red (#EF4444)

**Typography**:
- Headings: Playfair Display (serif)
- Body: Inter (sans-serif)
- Mono: JetBrains Mono

**Spacing**:
- Consistent 8px grid
- Generous padding for touch targets
- Clear visual hierarchy

---

**Pro Tip**: The CTA design matches the existing IndSure design system, ensuring a seamless user experience!
