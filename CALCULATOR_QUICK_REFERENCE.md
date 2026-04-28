# Calculator System - Quick Reference Guide

## 🎯 For Product Managers

### What Changed?
The calculator now has **bulletproof error handling** and **never loses user data**.

### Key Improvements:
1. **Auto-Save** - Progress saved automatically, users can resume anytime
2. **Smart Validation** - Real-time feedback prevents invalid entries
3. **Error Recovery** - Automatic retry on failures, fallback to local storage
4. **Better UX** - Slower auto-advance (1s vs 300ms), clear progress indicator
5. **Notifications** - Toast messages for all actions (success/error/warning)

### User Benefits:
- ✅ No more lost progress on accidental refresh
- ✅ Clear error messages with actionable steps
- ✅ Can't enter invalid data (age, income, etc.)
- ✅ Always know where they are in the flow
- ✅ Reports always saved (with retry on failure)

---

## 💻 For Developers

### New Utilities

#### Validation
```typescript
import { 
  sanitizeIntegerInput, 
  getAgeError,
  validateField 
} from "@/lib/validation/calculator-validation";

// Sanitize user input
const age = sanitizeIntegerInput(inputValue); // Returns number | undefined

// Validate with error message
const error = getAgeError(age); // Returns string | null

// Validate any field
const result = validateField(ageSchema, value);
if (!result.success) {
  console.error(result.error);
}
```

#### Storage
```typescript
import { 
  saveCalculatorReport,
  saveProgress,
  loadProgress,
  clearProgress 
} from "@/lib/calculator-storage";

// Save report with retry
const result = await saveCalculatorReport(inputs, resultData);
if (result.success) {
  console.log("UUID:", result.uuid);
} else {
  console.error("Error:", result.error);
}

// Auto-save progress
saveProgress("detailedProfile", inputs);

// Load on mount
const progress = loadProgress();
if (progress) {
  setInputs(progress.inputs);
  setStep(progress.step);
}

// Clear after completion
clearProgress();
```

#### Notifications
```typescript
import { 
  showSuccess, 
  showError, 
  showWarning 
} from "@/lib/calculator-notifications";

// Success toast
showSuccess("Saved!", "Your report has been saved");

// Error with retry
showError("Failed to save", "Network error", {
  label: "Retry",
  onClick: () => retryFunction()
});

// Warning
showWarning("Temporary Report", "Report not saved permanently");
```

### Error Boundary
```typescript
import { CalculatorErrorBoundary } from "@/components/CalculatorErrorBoundary";

// Wrap your component
<CalculatorErrorBoundary>
  <YourCalculatorComponent />
</CalculatorErrorBoundary>
```

### Progress Indicator
```typescript
import { CalculatorProgressDots } from "@/components/CalculatorProgress";

<CalculatorProgressDots
  currentStep={3}
  totalSteps={7}
/>
```

---

## 🧪 For QA/Testers

### Test Scenarios

#### Happy Path
1. Complete calculator from start to finish
2. Verify report saves with UUID
3. Check notification appears
4. Verify redirect to report page

#### Error Handling
1. **Network Failure**
   - Disconnect network mid-calculation
   - Should show error notification
   - Should retry automatically (3 times)
   - Should fallback to sessionStorage
   - Should still show report

2. **Invalid Input**
   - Enter age < 18 or > 75
   - Should show red border + error message
   - Should prevent submission
   - Error should clear when fixed

3. **Browser Refresh**
   - Fill out 3 steps
   - Refresh page
   - Should prompt to resume
   - Should restore all data

#### Edge Cases
1. **Rapid Clicking**
   - Click option cards rapidly
   - Should not advance multiple steps
   - Should show confirmation

2. **Back Button**
   - Navigate forward 3 steps
   - Click back button
   - Should go to previous step
   - Data should persist

3. **Multiple Tabs**
   - Open calculator in 2 tabs
   - Fill different data in each
   - Last saved should win

4. **Storage Full**
   - Fill localStorage to capacity
   - Should handle gracefully
   - Should still work (no save/resume)

### Expected Behaviors

| Action | Expected Result |
|--------|----------------|
| Enter invalid age | Red border + error message |
| Click option | 1s delay + confirmation |
| Network error | Retry 3x + fallback |
| Refresh page | Prompt to resume |
| Complete flow | UUID + redirect |
| Save failure | Error toast + retry button |

---

## 🔧 For DevOps

### New Dependencies
```json
{
  "zod": "^3.x" // Validation library
}
```

### Environment Variables
No new environment variables required.

### Database
No schema changes. Uses existing `calculator_reports` table.

### Monitoring
Watch for:
- `/api/calculator/save-report` error rate
- `/api/calculator/report/:uuid` 404 rate
- Client-side errors in ErrorBoundary

### Performance
- Auto-save triggers on every step (localStorage write)
- Retry logic adds 1-3s delay on failures
- Notifications add ~50KB to bundle

---

## 📊 For Analytics

### New Events to Track

```typescript
// Step completion
analytics.track("calculator_step_completed", {
  step: "detailedProfile",
  stepNumber: 3,
  totalSteps: 7
});

// Validation errors
analytics.track("calculator_validation_error", {
  field: "exactAge",
  error: "Age must be between 18 and 75"
});

// Save success/failure
analytics.track("calculator_report_saved", {
  success: true,
  uuid: "abc-123",
  retryCount: 0
});

// Resume from saved progress
analytics.track("calculator_resumed", {
  step: "employerCover",
  daysSinceLastVisit: 2
});

// Error boundary triggered
analytics.track("calculator_error", {
  error: error.message,
  step: currentStep
});
```

### Key Metrics
- **Completion Rate** - % who reach final step
- **Drop-off Points** - Which step has highest abandonment
- **Validation Errors** - Most common invalid inputs
- **Save Success Rate** - % of successful report saves
- **Resume Rate** - % who resume vs start fresh
- **Error Rate** - Client-side errors caught by boundary

---

## 🐛 Troubleshooting

### "Report not found" error
**Cause:** UUID doesn't exist in database
**Fix:** Check if save-report API succeeded, verify UUID format

### Progress not resuming
**Cause:** localStorage disabled or cleared
**Fix:** Check browser settings, verify localStorage access

### Validation not working
**Cause:** Zod schema mismatch
**Fix:** Check schema in `calculator-validation.ts`

### Notifications not showing
**Cause:** Styles not loaded
**Fix:** Verify `calculator-notifications.ts` injected styles

### Auto-advance too fast/slow
**Cause:** Timer delay misconfigured
**Fix:** Adjust `setTimeout` delay in `handleOptionSelect`

---

## 📞 Support

### Common User Questions

**Q: Why did I lose my progress?**
A: Progress auto-saves for 7 days. After that, it expires.

**Q: Can I share my report?**
A: Yes! The report URL contains a unique ID you can share.

**Q: Why can't I enter my age?**
A: Age must be between 18-75 for insurance eligibility.

**Q: What if the calculator crashes?**
A: Your progress is saved. Refresh and click "Resume".

**Q: How long are reports saved?**
A: Reports are saved for 90 days (DPDP compliance).

---

## 🎓 Training Materials

### For Customer Support

**Scenario 1: User says calculator crashed**
1. Ask them to refresh the page
2. They should see "Resume progress?" prompt
3. If not, data was older than 7 days
4. Guide them to start fresh

**Scenario 2: User can't enter their age**
1. Check if age is between 18-75
2. If outside range, explain eligibility
3. If within range, check for decimals
4. Guide them to enter whole number

**Scenario 3: Report link doesn't work**
1. Check if UUID is in URL
2. If no UUID, report wasn't saved
3. Ask them to recalculate
4. Escalate if persistent

---

## 🚀 Deployment Checklist

- [ ] Run `npm install` (new zod dependency)
- [ ] Run TypeScript build (`npm run build`)
- [ ] Test on staging environment
- [ ] Verify localStorage works
- [ ] Test error scenarios
- [ ] Check mobile responsiveness
- [ ] Verify notifications appear
- [ ] Test save/resume flow
- [ ] Monitor error logs
- [ ] Update user documentation

---

**Last Updated:** 2026-04-27
**Version:** 2.0.0
**Status:** ✅ Ready for Production
