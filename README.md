# Ensured Advisor

**AI-Powered Health Insurance Policy Analysis Platform**

Decision-first insurance review. No chatbots. No upsell. No storage after analysis.

## 🚀 Features

- **Policy Analysis**: Upload your health insurance policy PDF and get an AI-powered sufficiency verdict in 60 seconds
- **Policy Comparison**: Compare up to 4 policies side-by-side with detailed feature analysis
- **Coverage Calculator**: Calculate optimal insurance coverage based on your profile, city, and needs
- **Detailed Reports**: Get comprehensive reports with gap analysis, cost context, and recommendations

## 📋 Prerequisites

- Node.js 18+ and npm
- Google Gemini API Key ([Get one here](https://makersuite.google.com/app/apikey))

## 🛠️ Setup Instructions

### 1. Clone and Install

```bash
git clone <repository-url>
cd Ensured-Advisor-main
npm install
```

### 2. Configure Environment

Create a `.env.local` file in the root directory:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and add your Gemini API key:

```env
GEMINI_API_KEY=your_actual_api_key_here
PORT=5000
NODE_ENV=development
```

### 3. Run the Application

**Development (frontend + backend):**

Terminal 1 – backend:
```bash
cd backend && npm install && npm run dev
```

Terminal 2 – frontend:
```bash
cd frontend && npm install && npm run dev
```

- Frontend: http://localhost:5173  
- Backend API: http://localhost:5000 (proxied via Vite when using frontend dev server)

## 📁 Project Structure (Frontend / Backend split)

The repo is split into **frontend** and **backend** so you can deploy the React app (e.g. on Vercel) and the API separately.

```
codetoshare/
├── frontend/            # React + Vite app (deploy to Vercel)
│   ├── client/         # App source: index.html, src/, public/
│   ├── package.json    # Frontend-only deps & scripts
│   ├── vite.config.ts
│   └── README.md       # Vercel deploy & local dev
├── backend/            # Express API
│   ├── server/         # API: index.ts, routes.ts, services, data
│   ├── package.json    # Backend-only deps & scripts
│   └── README.md       # Run & deploy backend
├── shared/             # Shared types/schemas (if needed by both)
└── uploads/            # Temporary uploads (backend; auto-cleaned)
```

### Run frontend only (e.g. after deploying backend elsewhere)

```bash
cd frontend && npm install && npm run dev
```

Set `VITE_API_URL` to your backend URL when building for production (see `frontend/README.md`).

### Run backend only

```bash
cd backend && npm install && npm run dev
```

### Deploy frontend on Vercel

1. In Vercel, set **Root Directory** to `frontend`.
2. Add env var **VITE_API_URL** = your backend URL (e.g. `https://api.yourdomain.com`).
3. Deploy. Build command: `npm run build`; output: `dist/`.

## 🔌 API Endpoints

### POST `/api/analyze`
Analyze a health insurance policy PDF.

**Request**: Multipart form data with `file` field (PDF)

**Response**: Policy analysis with sufficiency verdict, gaps, and recommendations

### POST `/api/extract-policy`
Extract policy data from PDF for comparison.

**Request**: Multipart form data with `policy_pdf` field

**Response**: Structured policy data

## 🧪 Testing

Run TypeScript type checking:
```bash
npm run check
```

## 🐛 Troubleshooting

### Server won't start
- Check if port 5000 is already in use
- Verify `.env.local` exists and has `GEMINI_API_KEY` set
- Check Node.js version: `node --version` (should be 18+)

### API errors
- Verify your Gemini API key is valid and has quota remaining
- Check the server console for detailed error messages
- Ensure uploaded files are valid PDFs

### TypeScript errors
- Most TypeScript errors are type-checking only and won't prevent runtime
- The application uses React 19 which may have some type compatibility issues with older type definitions

## 📝 Notes

- Files uploaded are automatically deleted after processing
- No data is stored permanently - all analysis is done in real-time
- The application uses Gemini 3 Pro Preview for AI analysis
- Deterministic verdict logic ensures consistent results

## 🔒 Privacy

- All file uploads are processed and immediately deleted
- No user data is stored on the server
- Analysis is performed in real-time without persistence

## 📄 License

MIT

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

**Built with**: React, TypeScript, Express, Google Gemini AI, Vite, Tailwind CSS

