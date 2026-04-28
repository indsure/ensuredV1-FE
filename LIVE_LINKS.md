# 🔗 Live Application Links

## 🎯 **YOUR APPLICATIONS ARE LIVE!**

---

## 🖥️ **Agent Dashboard (Frontend)**

### Local Access:
```
http://localhost:3000
```

### Network Access (from other devices):
```
http://192.168.29.85:3000
```

**Features:**
- Login page
- Dashboard with metrics
- Policy management
- Queue management
- Reports
- Error tracking
- Agent management
- Settings

---

## 🔌 **Next API (Backend)**

### Local Access:
```
http://localhost:3001
```

### Network Access:
```
http://192.168.29.85:3001
```

**API Base URL:**
```
http://localhost:3001/api
```

---

## 🔐 **Login Credentials**

### To Create Your First Admin User:

1. **Go to Supabase Dashboard:**
   ```
   https://supabase.com/dashboard/project/khxbabotbvnyjwvqtumt
   ```

2. **Navigate to:** Authentication > Users

3. **Click "Add User"** and create:
   - Email: `admin@indsure.com`
   - Password: `admin123`

4. **Copy the User ID** from the created user

5. **Run this SQL** in SQL Editor:
   ```sql
   INSERT INTO agents (id, email, name, role, status)
   VALUES (
     'paste-user-id-here',
     'admin@indsure.com',
     'Admin User',
     'admin',
     'active'
   );
   ```

6. **Login at:** http://localhost:3000/login

---

## 📱 **Quick Test Pages**

### Public Pages (No Login Required):
- Home: http://localhost:3000
- Login: http://localhost:3000/login

### Protected Pages (Login Required):
- Dashboard: http://localhost:3000/dashboard
- My Queue: http://localhost:3000/my-queue
- Policies: http://localhost:3000/policies
- Reports: http://localhost:3000/reports
- Errors: http://localhost:3000/errors
- Agents: http://localhost:3000/agents
- Settings: http://localhost:3000/settings

---

## 🧪 **Test API Endpoints**

### Health Check:
```bash
curl http://localhost:3001/api/dashboard/metrics
```

### Login Test:
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@indsure.com","password":"admin123"}'
```

---

## 🛑 **Stop Servers**

If you need to stop the servers:

### Stop Agent Dashboard:
```bash
# Press Ctrl+C in the terminal running on port 3000
```

### Stop Next API:
```bash
# Press Ctrl+C in the terminal running on port 3001
```

---

## 🔄 **Restart Servers**

### Restart Agent Dashboard:
```bash
cd agentdashboardreview
npm run dev
```

### Restart Next API:
```bash
cd next-api
npm run dev
```

---

## 📊 **Current Status**

| Component | Status | Port | URL |
|-----------|--------|------|-----|
| Agent Dashboard | ✅ Running | 3000 | http://localhost:3000 |
| Next API | ✅ Running | 3001 | http://localhost:3001 |
| Database | ✅ Connected | - | Supabase PostgreSQL |
| Authentication | ✅ Active | - | Supabase Auth |

---

## 🎯 **What to Do Next**

1. ✅ **Create Admin User** (see instructions above)
2. ✅ **Login:** http://localhost:3000/login
3. ✅ **Test All Features**
4. ✅ **Deploy to Production**
5. ✅ **Start Selling!**

---

## 💡 **Pro Tips**

### View API Responses:
Open browser DevTools (F12) > Network tab to see API calls

### Check Logs:
- Agent Dashboard logs: Terminal running on port 3000
- Next API logs: Terminal running on port 3001

### Database Access:
```
https://supabase.com/dashboard/project/khxbabotbvnyjwvqtumt
```

---

## 🆘 **Troubleshooting**

### Can't Login?
1. Check if user exists in Supabase Auth
2. Check if user exists in `agents` table
3. Verify password is correct
4. Check browser console for errors

### API Not Working?
1. Verify Next API is running on port 3001
2. Check `.env.local` in both projects
3. Verify database connection
4. Check API logs in terminal

### Page Not Loading?
1. Clear browser cache
2. Check if servers are running
3. Verify URLs are correct
4. Check browser console for errors

---

**🎉 Everything is ready! Start testing your production-ready application!**

**Last Updated:** April 27, 2026
