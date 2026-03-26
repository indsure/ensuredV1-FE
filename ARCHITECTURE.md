# Architecture Overview - IndSure Platform

This document outlines the high-level architecture of the IndSure platform, describing its core components and their interactions.

## 🏗️ System Layers

The platform is built as a modern full-stack web application with a clear separation of concerns.

### 1. Frontend (Client-Side)
- **Core Stack**: [React 19](https://react.dev/), [Vite](https://vitejs.dev/), TypeScript.
- **Routing**: `wouter` for lightweight, hook-based routing.
- **Data Management**: `@tanstack/react-query` for efficient server-state management, caching, and synchronization.
- **Styling & UI**: 
    - [Tailwind CSS v4](https://tailwindcss.com/) for utility-first styling.
    - [Shadcn/UI](https://ui.shadcn.com/) + [Radix UI](https://www.radix-ui.com/) for accessible, premium-feel components.
    - [Framer Motion](https://www.framer.com/motion/) for smooth micro-animations and transitions.
- **Key Components**:
    - `frontend/client/src/pages/`: Page-level components (e.g., `hospitals.tsx`, `report/PublicReport.tsx`).
    - `frontend/client/src/components/`: Reusable UI primitives and business blocks (e.g., `AgentSummaryCard.tsx`).

### 2. Backend (Server-Side)
- **Core Stack**: [Express.js 5](https://expressjs.com/), Node.js, TypeScript.
- **API Architecture**: Centralized routing in `backend/server/routes.ts`.
- **Database Layer**:
    - **ORM**: [Drizzle ORM](https://orm.drizzle.team/) for type-safe database interactions.
    - **Infrastructure**: [Supabase](https://supabase.com/) / PostgreSQL for persistent storage.
- **Integration Hooks**:
    - Middleware for authentication and error handling.
    - Integration with Vite development server in development mode.

### 3. Business Logic & AI Services
- **AI Service**: Uses [Google Generative AI (Gemini)](https://ai.google.dev/) for intelligent policy analysis and report generation.
- **Prompts**: Domain-specific prompt engineering (Life, Vehicle, etc.) located in `backend/server/*.prompt.ts`.
- **Pipelines**: `analysisPipeline.ts` orchestrates the multi-step process of data extraction and analysis.
- **PDF Generation**: `@react-pdf/renderer` for generating professional analytical reports.

### 4. Data Layer & Optimization
- **Static Assets**: Large-scale hospital network data stored in JSON format (`backend/server/data/insurance_networks/`).
- **Optimization Engine**: A high-performance filtering engine that utilizes:
    - **Indexes**: `indexes.json` for rapid record lookup.
    - **Aggregates**: `aggregates.json` for $O(1)$ statistical lookups.
    - **Caching**: In-memory caching of heavy data structures for sub-millisecond API responses.

## 🔄 Data Flow
1. **Request**: User interacts with the React UI (e.g., searches for a provider).
2. **API Call**: Frontend makes a fetch request to the Express backend.
3. **Processing**: Backend services (e.g., Filter Engine or AI Service) process the data.
4. **Response**: JSON result is returned to the client and rendered via React Query.
