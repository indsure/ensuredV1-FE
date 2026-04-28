# Lead Collection System

## Overview

A complete lead collection system has been implemented in the IndSure policy report page. When users view their policy audit report and the system recommends porting to a better policy, a CTA (Call-to-Action) form is displayed to collect their contact information.

## Features

### 1. Frontend Components

#### LeadCollectionCTA Component
- **Location**: `frontend/client/src/components/LeadCollectionCTA.tsx`
- **Purpose**: Displays a form to collect lead information
- **Features**:
  - Pre-fills name and city from policy data
  - Collects: Name, Email, Phone, City
  - Form validation (email format, 10-digit phone)
  - Success state after submission
  - Beautiful amber/orange gradient design matching the "CONSIDER" recommendation style

#### Integration in PolicyAuditReport
- **Location**: `frontend/client/src/components/PolicyAuditReport.tsx`
- **Trigger**: Shows when `portingRec.recommendation` is "consider" or "yes"
- **Placement**: After the recommendations section, before score deductions

### 2. Backend API

#### POST /api/leads
- **Purpose**: Submit a new lead
- **Request Body**:
  ```json
  {
    "name": "string (required)",
    "email": "string (required, valid email)",
    "phone": "string (required, 10 digits)",
    "city": "string (optional)",
    "source": "string (default: 'policy_report')"
  }
  ```
- **Response**: 
  ```json
  {
    "success": true,
    "message": "Lead submitted successfully",
    "leadId": "uuid",
    "createdAt": "timestamp"
  }
  ```
- **Validation**:
  - Email format validation
  - Phone number must be exactly 10 digits
  - Duplicate email detection

#### GET /api/leads
- **Purpose**: Fetch leads (admin only)
- **Query Parameters**:
  - `status`: Filter by status (new, contacted, converted, rejected)
  - `limit`: Number of results (default: 50)
  - `offset`: Pagination offset (default: 0)
- **Response**:
  ```json
  {
    "leads": [...],
    "total": number,
    "limit": number,
    "offset": number
  }
  ```

### 3. Database Schema

#### Table: `leads`
```sql
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  city TEXT,
  source TEXT DEFAULT 'policy_report',
  status TEXT DEFAULT 'new',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  contacted_at TIMESTAMPTZ,
  contacted_by TEXT
);
```

**Indexes**:
- `idx_leads_created_at` - For sorting by date
- `idx_leads_status` - For filtering by status
- `idx_leads_email` - For duplicate detection

**Row Level Security (RLS)**:
- Public/Anonymous: Can INSERT leads
- Authenticated users: Can SELECT leads
- Service role: Full access

### 4. Admin Panel

#### AdminLeads Component
- **Location**: `frontend/client/src/components/admin/AdminLeads.tsx`
- **Access**: Admin panel at `/admin` → Leads tab
- **Features**:
  - Dashboard with stats (Total, New, Contacted, Converted)
  - Filter by status
  - View all lead details
  - Clickable phone/email links
  - Real-time refresh

## Setup Instructions

### 1. Database Setup
Run the setup script to create the leads table:
```bash
cd backend/server
npx tsx setup_leads_db.ts
```

### 2. Environment Variables
Ensure these are set in your `.env` file:
```env
DATABASE_URL=postgresql://...
SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=...
```

### 3. Start the Backend
```bash
cd backend
npm run dev
```

### 4. Start the Frontend
```bash
cd frontend
npm run dev
```

## User Flow

1. **User uploads policy** → Gets audit report
2. **System analyzes policy** → Determines if porting is recommended
3. **If recommendation = "consider" or "yes"** → CTA form appears
4. **User fills form** → Submits contact information
5. **Lead saved to database** → Success message shown
6. **Admin views leads** → In admin panel under "Leads" tab

## Design Decisions

### Why This Approach?

1. **Contextual CTA**: Only shows when there's a genuine recommendation to port
2. **Pre-filled Data**: Uses policy data to reduce friction
3. **Validation**: Ensures data quality with format checks
4. **Status Tracking**: Allows admin to track lead lifecycle
5. **Source Tracking**: Identifies where leads came from

### Future Enhancements

- [ ] Email notifications to admin when new lead arrives
- [ ] CRM integration (Salesforce, HubSpot, etc.)
- [ ] Lead scoring based on policy data
- [ ] Automated follow-up reminders
- [ ] WhatsApp integration for instant contact
- [ ] Lead assignment to specific advisors
- [ ] Conversion tracking and analytics

## Testing

### Test the CTA
1. Go to `http://127.0.0.1:5412/report`
2. Upload a policy that triggers a "consider" or "yes" porting recommendation
3. Scroll to the recommendations section
4. Fill out the lead form
5. Submit and verify success message

### Test Admin Panel
1. Login as admin at `http://127.0.0.1:5412/agent/login`
2. Navigate to `/admin`
3. Click on "Leads" tab
4. Verify the submitted lead appears
5. Test status filtering

## API Examples

### Submit a Lead
```bash
curl -X POST http://localhost:5000/api/leads \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "9876543210",
    "city": "Mumbai",
    "source": "policy_report"
  }'
```

### Get All Leads
```bash
curl http://localhost:5000/api/leads?limit=10
```

### Filter by Status
```bash
curl http://localhost:5000/api/leads?status=new&limit=50
```

## Security Considerations

1. **RLS Enabled**: Row Level Security prevents unauthorized access
2. **Input Validation**: All inputs are validated on backend
3. **Rate Limiting**: Consider adding rate limiting to prevent spam
4. **CORS**: Configured to allow only trusted origins
5. **SQL Injection**: Using parameterized queries

## Monitoring

### Key Metrics to Track
- Lead submission rate
- Conversion rate (new → contacted → converted)
- Average response time
- Lead source distribution
- Form abandonment rate

## Support

For issues or questions:
- Check backend logs: `backend/server/index.ts`
- Check frontend console for errors
- Verify database connection
- Ensure all environment variables are set

---

**Status**: ✅ Fully Implemented and Ready for Production
**Last Updated**: April 27, 2026
