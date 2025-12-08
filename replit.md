# PraxisFlow AI - Medical Practice Simulation

## Overview

PraxisFlow AI is an AI-powered medical practice simulation application that helps optimize clinic workflows, efficiency, and staff harmony. The application allows users to design practice layouts, manage staff resources, run simulations with varying patient volumes, and receive AI-driven recommendations for improving practice operations.

The system uses **German medical industry regulations and benchmarks** to evaluate room sizes, staffing ratios, patient flow, and layout efficiency, providing actionable insights for practice optimization compliant with German healthcare standards.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React 18 with TypeScript, using Vite as the build tool

**Routing**: Wouter for lightweight client-side routing

**State Management**: 
- React Context API for global practice state (PracticeContext)
- TanStack Query (React Query) for server state management and caching

**UI Framework**: 
- Shadcn UI component library (Radix UI primitives)
- Tailwind CSS for styling with custom medical theme
- Framer Motion for animations
- Recharts for data visualization

**Key Design Patterns**:
- Component composition with shadcn/ui components
- Custom hooks for reusable logic (use-mobile, use-toast)
- Query-based data fetching with automatic caching and invalidation
- Context providers for shared state

**Pages**:
- Dashboard: Overview with metrics and performance charts
- Layout Editor: Drag-and-drop room placement with AI advisor
- Staff Management: View and manage staff members
- Simulation: Run scenarios with configurable parameters
- Knowledge: Upload and manage coaching knowledge documents

### Backend Architecture

**Runtime**: Node.js with TypeScript (ES modules)

**Framework**: Express.js with custom middleware

**API Design**: RESTful endpoints organized by resource:
- `/api/practices` - Practice CRUD operations
- `/api/rooms` - Room management within practices
- `/api/staff` - Staff member management
- `/api/simulations` - Run and retrieve simulations
- `/api/ai/*` - AI analysis and recommendations
- `/api/knowledge` - Coach knowledge base management (upload, search, delete)

**Key Design Patterns**:
- Storage abstraction layer (IStorage interface) for database operations
- Separation of concerns: routes, storage, simulation logic, AI services
- Request/response logging middleware
- JSON body parsing with raw body preservation for webhooks

**Simulation Engine**: 
- Pure TypeScript implementation calculating efficiency, harmony, wait times, and patient capacity
- Based on industry benchmarks (room sizes, staffing ratios, patient flow metrics)
- Considers room placement, distances, and staffing levels

**AI Integration**:
- OpenAI API for advanced layout analysis and recommendations
- Benchmark-based scoring system using medical industry standards
- Quick recommendations and detailed layout analysis endpoints

### Data Storage

**ORM**: Drizzle ORM with PostgreSQL dialect

**Database Schema**:
- `users` - User accounts (currently minimal auth)
- `practices` - Medical practice configurations with budgets
- `rooms` - Practice layout rooms (type, name, position, dimensions)
- `staff` - Staff members with roles, efficiency, stress levels, and traits
- `simulations` - Historical simulation results with parameters
- `knowledge_sources` - Uploaded coaching documents metadata (title, category, tags)
- `knowledge_chunks` - Chunked document content with vector embeddings for semantic search

**Vector Search (pgvector)**:
- Uses pgvector extension for semantic similarity search
- Embeddings generated via OpenAI text-embedding-3-small model
- Coaching knowledge is retrieved and injected into AI prompts as primary knowledge source

**Migration Strategy**: Drizzle Kit for schema migrations via `db:push` command

**Connection Management**: PostgreSQL connection pool via `pg` library

### External Dependencies

**AI Services**:
- OpenAI API (configurable base URL and API key)
- Used for intelligent layout analysis and contextual recommendations

**Database**:
- PostgreSQL (required, configured via `DATABASE_URL` environment variable)
- Drizzle ORM for type-safe database queries

**Development Tools**:
- Vite plugins for Replit integration (cartographer, dev banner, runtime error overlay)
- Custom meta-images plugin for OpenGraph image injection
- TypeScript compilation without emission (type checking only)

**Build Process**:
- Client: Vite builds React app to `dist/public`
- Server: esbuild bundles server code to single CJS file with selective dependency bundling
- Allowlist of dependencies bundled to reduce cold start syscalls

**Session Management**: 
- Infrastructure present (connect-pg-simple, express-session) but not fully implemented in provided code

**German Medical Standards Integration**:
- Arbeitsstättenverordnung (ArbStättV) - German Workplace Ordinance for room sizes
- ASR A1.2 - Technical Rules for Room Dimensions and Movement Areas
- Praxisbegehung - Medical practice inspection requirements
- Hygieneverordnung & RKI Guidelines - Hygiene and laboratory standards
- KV (Kassenärztliche Vereinigung) - Statutory health insurance physicians' association benchmarks
- KZBV (Kassenzahnärztliche Bundesvereinigung) - Dental practice benchmarks
- DIN 18040 - Barrier-free building standards (Barrierefreies Bauen)
- QM-RL (Qualitätsmanagement-Richtlinie) - Quality management guidelines from G-BA
- EBM (Einheitlicher Bewertungsmaßstab) - Unified assessment standard for appointment timing

**Room Size Standards (in square meters)**:
- Empfangsbereich (Reception): 8-14 m² (optimal: 10 m²)
- Wartebereich (Waiting): 15-35 m² (optimal: 22 m²)
- Behandlungsraum (Exam Room): 9-12 m² (optimal: 10 m²)
- Labor (Lab): 8-15 m² (optimal: 10 m²)
- Büro (Office): 10-18 m² (optimal: 14 m²)

**Staffing Benchmarks**:
- 2.5-4.0 support staff per physician (KV recommendation)
- 3-4 exam rooms per provider (optimal patient flow)
- 1.0-2.0 MFA (Medizinische Fachangestellte) per doctor

**Internationalization**:
- Full German and English language support via i18next
- AI responses in German when using German interface