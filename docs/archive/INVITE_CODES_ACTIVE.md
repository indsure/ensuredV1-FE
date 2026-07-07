# 🎉 Active Invite Codes - Ready to Use!

## ✅ All Set Up and Working!

I've created and activated **3 invite codes** for you. All are ready to share with advisors immediately.

---

## 📋 Your Active Invite Codes

### 1. **INDSURE2026** (Unlimited Uses)
- **Status:** ✅ Active
- **Max Uses:** Unlimited
- **Current Uses:** 0
- **Expires:** April 27, 2036 (10 years)
- **Best For:** General advisor signups, marketing campaigns, long-term use

### 2. **BETA2026** (50 Uses)
- **Status:** ✅ Active
- **Max Uses:** 50
- **Current Uses:** 0
- **Expires:** April 27, 2036 (10 years)
- **Best For:** Beta testing, limited workshops, controlled rollout

### 3. **INDSURE-TESTING** (Unlimited Uses)
- **Status:** ✅ Active (Reactivated)
- **Max Uses:** Unlimited
- **Current Uses:** 0 (Reset)
- **Expires:** April 27, 2036 (10 years)
- **Best For:** Internal testing, demos, development

---

## 🚀 How to Share These Codes

### For Advisors:
Simply tell them to:
1. Go to the signup page
2. Enter one of these codes:
   - **INDSURE2026**
   - **BETA2026**
   - **INDSURE-TESTING**
3. Complete the signup form

### Example Message:
```
Welcome to IndSure! 🎉

Use invite code: INDSURE2026

Sign up at: https://your-domain.com/agent/signup/step1

This code can be used multiple times, so feel free to share with colleagues!
```

---

## 📊 Tracking Usage

### Check Code Status Anytime:

You can monitor usage through:

1. **Admin Panel:** `/admin` → Invite Codes section
2. **Database Query:**
   ```sql
   SELECT 
     code, 
     is_active, 
     max_uses, 
     current_uses,
     CASE 
       WHEN max_uses IS NULL THEN 'Unlimited'
       ELSE (max_uses - current_uses)::text || ' remaining'
     END as status
   FROM invite_codes
   WHERE is_active = true
   ORDER BY created_at DESC;
   ```

---

## 🔧 Need More Codes?

### Create New Code:
```bash
# Unlimited uses
node backend/create_reusable_invite.mjs NEWCODE2026 unlimited

# Limited uses (e.g., 100)
node backend/create_reusable_invite.mjs WORKSHOP2026 100
```

### Reactivate Old Code:
```bash
node backend/reactivate_invite.mjs OLDCODE unlimited
```

---

## ✨ What's Different Now?

### Before:
- ❌ Codes could only be used once
- ❌ Had to create new codes constantly
- ❌ Codes expired after first use

### After:
- ✅ Codes can be used multiple times
- ✅ Set usage limits or make unlimited
- ✅ Track usage automatically
- ✅ Codes stay active until limit reached

---

## 🎯 Recommended Usage Strategy

### **INDSURE2026** - Primary Code
- Share publicly on website, social media
- Use in marketing materials
- Give to sales team
- No limit, so no worries about running out

### **BETA2026** - Controlled Access
- Use for specific campaigns
- Track exactly 50 signups
- Good for workshops or events
- Monitor when it's getting close to limit

### **INDSURE-TESTING** - Internal Use
- For your team's testing
- Demo accounts
- Development purposes
- Keep this one private

---

## 🔒 Security Notes

- All codes are case-insensitive (stored as uppercase)
- Codes expire in 10 years (April 2036)
- Can be deactivated anytime if compromised
- Usage is tracked automatically

---

## 📞 Support

If you need help or want to create more codes, just ask! The system is fully automated and ready to scale.

**Current Status:** 🟢 All systems operational

**Last Updated:** April 27, 2026

---

## Quick Reference

| Code | Type | Uses | Status |
|------|------|------|--------|
| INDSURE2026 | Unlimited | 0/∞ | 🟢 Active |
| BETA2026 | Limited | 0/50 | 🟢 Active |
| INDSURE-TESTING | Unlimited | 0/∞ | 🟢 Active |

**You're all set! Start sharing these codes with advisors.** 🚀
