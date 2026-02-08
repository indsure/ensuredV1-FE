# InsureDaddy Code Package - Backend & Frontend Split

This folder contains the complete InsureDaddy codebase organized into **backend** and **frontend** directories for easy development team collaboration.

## 📦 Package Structure

```
codetoshare/
├── backend/
│   └── server/          # All server-side code
├── frontend/
│   └── client/          # All client-side code
├── shared/              # Shared code between backend and frontend
├── package.json         # Root dependencies
├── tsconfig.json        # TypeScript configuration
├── vite.config.ts       # Vite build configuration
├── drizzle.config.ts    # Database configuration
└── [other config files]
```

## 🎯 What's Included

### Backend (`backend/server/`)
Complete server-side implementation including:
- **API Routes** - Express.js routes and controllers
- **Services** - Business logic (AI service, PDF extraction, analysis)
- **Data** - Insurance networks, policies, reference data (~191 MB)
- **Knowledge Base** - Policy samples and templates
- **Prompts** - AI prompts for policy auditing
- **Schemas** - JSON schemas and API contracts
- **Utils** - Helper functions and utilities
- **Types** - TypeScript type definitions
- **Config** - Server configuration files
- **Tests** - Test files and fixtures

### Frontend (`frontend/client/`)
Complete client-side implementation including:
- **src/** - React application source code
  - **pages/** - All page components
  - **components/** - Reusable UI components
  - **lib/** - Client-side logic and utilities
  - **hooks/** - Custom React hooks
- **public/** - Static assets
- **contracts/** - Frontend data contracts
- **specs/** - Visual semantics and specifications

### Shared (`shared/`)
Code shared between backend and frontend

## 📊 Package Statistics

- **Total Files:** 292
- **Total Size:** 246.98 MB
- **Backend Files:** Server code + data (~191 MB of insurance data)
- **Frontend Files:** React application + assets

## 🚀 Quick Start

### Prerequisites
- Node.js (v18 or higher recommended)
- npm or yarn

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

3. **Run development server:**
   ```bash
   npm run dev
   ```

## 📁 Key Directories

### Backend Key Folders
- `backend/server/routes/` - API endpoints
- `backend/server/services/` - Business logic
- `backend/server/data/insurance_networks/` - Hospital network data (191 MB)
- `backend/server/knowledge_base/` - Policy samples
- `backend/server/prompts/` - AI prompts
- `backend/server/schemas/` - Data validation schemas
- `backend/server/utils/` - Helper utilities

### Frontend Key Folders
- `frontend/client/src/pages/` - Page components
- `frontend/client/src/components/` - UI components
- `frontend/client/src/lib/` - Client utilities
- `frontend/client/public/` - Static assets

## 🔧 Configuration Files

- **package.json** - Dependencies and scripts
- **tsconfig.json** - TypeScript compiler options
- **vite.config.ts** - Vite bundler configuration
- **drizzle.config.ts** - Database ORM configuration
- **postcss.config.js** - PostCSS configuration
- **components.json** - UI components configuration
- **.gitignore** - Git ignore patterns
- **.env.example** - Environment variables template

## 📝 Additional Documentation

- **README.md** - Main project documentation
- **QUICK_START.md** - Quick start guide
- `backend/server/data/insurance_networks/README.md` - Insurance data documentation

## 🏗️ Architecture Overview

### Backend Architecture
- **Express.js** server with TypeScript
- **Drizzle ORM** for database operations
- **AI Integration** for policy analysis
- **PDF Processing** for document extraction
- **RESTful API** design

### Frontend Architecture
- **React** with TypeScript
- **Vite** for fast development and building
- **TailwindCSS** for styling
- **React Router** for navigation
- **Component-based** architecture

## 🔗 Integration Points

The backend and frontend communicate via:
- RESTful API endpoints
- JSON data contracts (see `frontend/client/contracts/`)
- Shared TypeScript types (see `shared/`)

## 📦 Data Package

For the complete data package (without code), see the separate `datatoshare` folder which includes:
- Insurance networks data
- Knowledge bases
- Prompts and schemas
- Reference documentation

---

**Package Created:** February 7, 2026  
**Source:** InsureDaddy v2final project  
**Ready for Development Team** ✅
