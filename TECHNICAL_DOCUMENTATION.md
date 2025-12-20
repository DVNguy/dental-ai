# Praxis-Optimierer - Technische Dokumentation

## Inhaltsverzeichnis

1. [Projektübersicht](#1-projektübersicht)
2. [Technologie-Stack](#2-technologie-stack)
3. [Architektur-Übersicht](#3-architektur-übersicht)
4. [Datenbank-Schema](#4-datenbank-schema)
5. [Backend-Architektur](#5-backend-architektur)
6. [Frontend-Architektur](#6-frontend-architektur)
7. [Staffing Engine](#7-staffing-engine)
8. [HR-Modul (DSGVO-konform)](#8-hr-modul-dsgvo-konform)
9. [AI/KI-Integration](#9-aiki-integration)
10. [Workflow-System](#10-workflow-system)
11. [Authentifizierung & Autorisierung](#11-authentifizierung--autorisierung)
12. [API-Referenz](#12-api-referenz)
13. [Datenfluss-Diagramme](#13-datenfluss-diagramme)
14. [Zusammenhänge & Abhängigkeiten](#14-zusammenhänge--abhängigkeiten)

---

## 1. Projektübersicht

**Praxis-Optimierer** ist eine Full-Stack-Webanwendung zur Optimierung von Zahnarztpraxen. Die Anwendung unterstützt Praxisinhaber bei:

- **Layout-Planung**: Visuelle Raumplanung mit Effizienz-Analyse
- **Personalbedarfsberechnung**: Deterministische FTE/VZÄ-Berechnung (Staffing Engine v1.2.0)
- **HR-Management**: DSGVO-konforme KPI-Dashboards mit k-Anonymität
- **Workflow-Analyse**: Lean-basierte Optimierung von Patientenpfaden und Mitarbeiterwegen
- **KI-Beratung**: GPT-4o-basierte Praxisberatung mit RAG-Pipeline
- **Simulationen**: Kapazitäts- und Effizienz-Simulationen

---

## 2. Technologie-Stack

### Frontend
| Technologie | Version | Zweck |
|-------------|---------|-------|
| React | 18.x | UI-Framework |
| TypeScript | 5.x | Typsicherheit |
| Vite | 5.x | Build-Tool & Dev-Server |
| TanStack Query | 5.x | Server-State-Management |
| Wouter | 3.x | Client-Side-Routing |
| Tailwind CSS | 3.x | Utility-First-Styling |
| shadcn/ui | - | 57+ UI-Komponenten |
| Framer Motion | - | Animationen |

### Backend
| Technologie | Version | Zweck |
|-------------|---------|-------|
| Node.js | 20.x | Runtime |
| Express.js | 4.x | HTTP-Server |
| TypeScript | 5.x | Typsicherheit |
| Drizzle ORM | 0.34.x | Datenbank-Abstraktion |
| PostgreSQL | 15+ | Datenbank |
| pgvector | - | Vektor-Embeddings für RAG |
| Passport.js | - | Authentifizierung |
| Zod | 3.x | Schema-Validierung |

### AI/KI
| Technologie | Zweck |
|-------------|-------|
| OpenAI GPT-4o | Praxisberatung, Analysen |
| OpenAI Embeddings | text-embedding-3-small für RAG |
| Tavily API | Web-Recherche für aktuelle Daten |

---

## 3. Architektur-Übersicht

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (React SPA)                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   Dashboard     │  │  LayoutEditor   │  │    HrOverview   │  │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘  │
│           │                    │                    │           │
│  ┌────────┴────────────────────┴────────────────────┴────────┐  │
│  │                  PracticeContext (Global State)           │  │
│  └────────────────────────────┬─────────────────────────────┘  │
│                               │                                 │
│  ┌────────────────────────────┴────────────────────────────┐   │
│  │              TanStack Query (API State Cache)            │   │
│  └────────────────────────────┬────────────────────────────┘   │
│                               │                                 │
│  ┌────────────────────────────┴────────────────────────────┐   │
│  │                   lib/api.ts (API Client)                │   │
│  └────────────────────────────┬────────────────────────────┘   │
└───────────────────────────────┼─────────────────────────────────┘
                                │ HTTP/REST
┌───────────────────────────────┼─────────────────────────────────┐
│                        SERVER (Express.js)                       │
│  ┌────────────────────────────┴────────────────────────────┐   │
│  │                   routes.ts (API Router)                 │   │
│  └─────┬──────────┬──────────┬──────────┬──────────┬──────┘   │
│        │          │          │          │          │           │
│  ┌─────┴────┐ ┌───┴───┐ ┌────┴────┐ ┌───┴───┐ ┌────┴─────┐   │
│  │practice  │ │ ai    │ │   hr    │ │workflow│ │  auth    │   │
│  │Controller│ │Control│ │Controller│ │Control│ │middleware│   │
│  └─────┬────┘ └───┬───┘ └────┬────┘ └───┬───┘ └────┬─────┘   │
│        │          │          │          │          │           │
│  ┌─────┴──────────┴──────────┴──────────┴──────────┴──────┐   │
│  │                    storage.ts (Data Layer)              │   │
│  └─────────────────────────────┬──────────────────────────┘   │
└────────────────────────────────┼────────────────────────────────┘
                                 │ Drizzle ORM
┌────────────────────────────────┼────────────────────────────────┐
│                          PostgreSQL                              │
│  ┌─────────────────────────────┴────────────────────────────┐   │
│  │  users │ practices │ rooms │ staff │ workflows │ ...     │   │
│  │  knowledge_chunks (pgvector) │ hr_alerts │ simulations   │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Datenbank-Schema

### Kern-Entitäten

#### `users` - Benutzer
```typescript
{
  id: varchar (PK, UUID),
  email: varchar (UNIQUE),
  firstName: varchar,
  lastName: varchar,
  profileImageUrl: varchar,
  password: text (bcrypt-Hash),
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### `practices` - Praxen
```typescript
{
  id: varchar (PK, UUID),
  name: text,
  budget: integer (default: 50000),
  layoutScalePxPerMeter: integer (default: 50),
  ownerId: varchar (FK -> users.id)
}
```

#### `rooms` - Räume
```typescript
{
  id: varchar (PK, UUID),
  practiceId: varchar (FK -> practices.id, CASCADE),
  type: text,           // "exam", "reception", "waiting", "lab", etc.
  name: text,
  x: integer,           // Position in Pixel
  y: integer,
  width: integer,       // Größe in Pixel
  height: integer,
  floor: integer (default: 0)
}
```

#### `staff` - Personal
```typescript
{
  id: varchar (PK, UUID),
  practiceId: varchar (FK -> practices.id, CASCADE),
  name: text,
  role: text,           // "dentist", "zfa", "dh", "empfang", etc.
  avatar: text,
  experienceLevel: integer (1-5, default: 3),
  specializations: text[],
  // HR-KPI-Felder:
  fte: real (default: 1.0),
  weeklyHours: real (default: 40),
  hourlyCost: real (default: 25),
  contractType: text,   // "fulltime" | "parttime" | "minijob" | "freelance"
  hireDate: timestamp,
  terminationDate: timestamp
}
```

### HR-Modul-Tabellen

#### `staff_absences` - Abwesenheiten
```typescript
{
  id: varchar (PK),
  staffId: varchar (FK -> staff.id, CASCADE),
  practiceId: varchar (FK -> practices.id, CASCADE),
  absenceType: text,    // "sick" | "vacation" | "unpaid" | "maternity" | "training"
  startDate: timestamp,
  endDate: timestamp,
  days: real,
  notes: text,
  createdAt: timestamp
}
```

#### `staff_overtime` - Überstunden
```typescript
{
  id: varchar (PK),
  staffId: varchar (FK -> staff.id, CASCADE),
  practiceId: varchar (FK -> practices.id, CASCADE),
  date: timestamp,
  hours: real,
  reason: text,
  approved: integer (0/1),
  createdAt: timestamp
}
```

#### `hr_alerts` - HR-Warnungen
```typescript
{
  id: varchar (PK),
  practiceId: varchar (FK),
  severity: text,       // "info" | "warn" | "critical"
  code: text,           // z.B. "HIGH_OVERTIME", "UNDERSTAFFED"
  title: text,
  explanation: text,
  recommendedActions: text[],
  metric: text,
  metricValue: real,
  threshold: real,
  acknowledged: integer,
  acknowledgedAt: timestamp,
  acknowledgedBy: varchar (FK -> users.id)
}
```

### Workflow-Tabellen

#### `workflows` - Workflow-Definitionen
```typescript
{
  id: varchar (PK),
  practiceId: varchar (FK),
  slug: text,           // URL-freundlicher Bezeichner
  name: text,
  actorType: text,      // "patient" | "staff" | "instruments"
  source: text,         // "builtin" | "custom" | "knowledge"
  createdAt: timestamp
}
// UNIQUE INDEX auf (practiceId, slug)
```

#### `workflow_connections` - Raum-Verbindungen
```typescript
{
  id: varchar (PK),
  practiceId: varchar (FK),
  fromRoomId: varchar (FK -> rooms.id),
  toRoomId: varchar (FK -> rooms.id),
  kind: text,           // "patient" | "staff"
  weight: integer (default: 1),
  distanceClass: text,  // "auto" | "short" | "medium" | "long"
  createdAt: timestamp
}
```

#### `workflow_steps` - Workflow-Schritte
```typescript
{
  id: varchar (PK),
  workflowId: varchar (FK -> workflows.id),
  stepIndex: integer,
  fromRoomId: varchar (FK),
  toRoomId: varchar (FK),
  weight: real,
  lineType: text,       // "default" | "critical" | "optional" | "automated"
  createdAt: timestamp
}
```

### Wissensmanagement-Tabellen

#### `knowledge_sources` - Wissensquellen
```typescript
{
  id: varchar (PK),
  title: text,
  fileName: text,
  fileHash: text,
  category: text,
  tags: text[],
  description: text,
  uploadedAt: timestamp,
  updatedAt: timestamp
}
```

#### `knowledge_chunks` - Wissens-Chunks (für RAG)
```typescript
{
  id: varchar (PK),
  sourceId: varchar (FK -> knowledge_sources.id),
  headingPath: text,    // z.B. "Kapitel 3 > Abschnitt 2"
  chunkIndex: integer,
  content: text,
  contentHash: text,
  tokens: integer,
  embedding: vector(1536),  // OpenAI text-embedding-3-small
  keyPoints: text[],
  createdAt: timestamp
}
```

---

## 5. Backend-Architektur

### 5.1 Verzeichnisstruktur

```
server/
├── index.ts              # Express-Server-Setup
├── routes.ts             # API-Router (Haupt-Routing)
├── auth.ts               # Passport.js Authentifizierung
├── storage.ts            # Drizzle ORM Data Access Layer
├── rateLimit.ts          # Rate Limiting für AI-Endpunkte
├── controllers/
│   ├── practiceController.ts  # Praxis, Räume, Personal
│   ├── workflowController.ts  # Workflows, Connections, Steps
│   ├── aiController.ts        # AI-Analyse, RAG, Chat
│   └── hrController.ts        # HR-KPIs, Staffing Engine
├── services/
│   ├── hr.ts                  # DSGVO-konformes HR-Modul
│   ├── hrKpi.ts               # KPI-Berechnungen
│   └── hrAlertEngine.ts       # Alert-Generierung
└── ai/
    ├── advisor.ts             # Layout-Analyse, AI-Insights
    ├── benchmarks.ts          # Deutsche Standards & Benchmarks
    ├── ragQuery.ts            # RAG-Pipeline
    ├── knowledgeProcessor.ts  # Chunk-Verarbeitung
    ├── artifactService.ts     # Knowledge-Artifacts
    └── artifactBenchmarks.ts  # Knowledge-basierte Benchmarks
```

### 5.2 Request-Flow

```
HTTP Request
    │
    ▼
┌─────────────────────────────────────────┐
│  Express Middleware Chain               │
│  1. CORS                                │
│  2. body-parser (JSON, 50MB limit)      │
│  3. express-session (PostgreSQL Store)  │
│  4. Passport.js (Authentication)        │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│  isAuthenticated Middleware             │
│  - Prüft req.isAuthenticated()          │
│  - Ausnahmen: /login, /callback, /debug │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│  Resource Access Middleware             │
│  - requirePracticeAccess                │
│  - requireRoomAccess                    │
│  - requireStaffAccess                   │
│  - requireWorkflowAccess                │
│  - requireConnectionAccess              │
│  - requireStepAccess                    │
│  - requireElementAccess                 │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│  AI Rate Limiting (für /api/ai/*)       │
│  - aiRateLimiter: 100 req/15min         │
│  - aiBudgetGuard: Token-Budget          │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│  Controller Handler                      │
│  - Validierung (Zod Schemas)            │
│  - Business Logic                       │
│  - Storage-Aufrufe                      │
│  - Response-Formatierung                │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│  storage.ts (Data Access Layer)         │
│  - Drizzle ORM Queries                  │
│  - PostgreSQL Connection Pool           │
│  - Type-safe CRUD Operations            │
└─────────────────────────────────────────┘
```

### 5.3 Controller-Beschreibungen

#### `practiceController.ts`
Verwaltet Praxen, Räume, Personal und architektonische Elemente.

**Funktionen:**
- `handleGetUser(req, res)` - Gibt aktuellen Benutzer mit seiner Praxis zurück
- `getPractice(req, res)` - Lädt Praxis-Details
- `createPractice(req, res)` - Erstellt neue Praxis
- `updateBudget(req, res)` - Aktualisiert Praxis-Budget
- `getLayoutEfficiencyBreakdown(req, res)` - Berechnet Layout-Effizienz-Aufschlüsselung
- `computeLayoutEfficiencyHandler(req, res)` - Berechnet Layout-Effizienz für gegebene Räume
- `getRooms/createRoom/updateRoom/deleteRoom` - CRUD für Räume
- `getStaff/createStaff/updateStaff/deleteStaff` - CRUD für Personal
- `getArchitecturalElements/createArchitecturalElement/...` - Türen, Fenster etc.

#### `workflowController.ts`
Verwaltet Workflows, Verbindungen und Workflow-Schritte.

**Funktionen:**
- `getWorkflows(req, res)` - Lädt alle Workflows einer Praxis
- `createWorkflow(req, res)` - Erstellt neuen Workflow
- `upsertWorkflow(req, res)` - Erstellt oder aktualisiert Workflow
- `deleteWorkflow(req, res)` - Löscht Workflow
- `getWorkflowSteps(req, res)` - Lädt Schritte eines Workflows
- `createWorkflowStep(req, res)` - Fügt Schritt hinzu
- `updateWorkflowStep(req, res)` - Aktualisiert Schritt (lineType, weight)
- `deleteWorkflowStep(req, res)` - Löscht Schritt
- `getConnections(req, res)` - Lädt Raum-Verbindungen
- `createConnection/updateConnection/deleteConnection` - CRUD für Verbindungen

#### `aiController.ts`
Verwaltet alle KI-Funktionen, RAG-Abfragen und Wissensmanagement.

**Funktionen:**
- `analyzeLayoutHandler(req, res)` - Vollständige Layout-Analyse mit AI-Insights
- `recommendHandler(req, res)` - Schnelle KI-Empfehlung
- `coachChatHandler(req, res)` - Chat mit Praxis-Coach
- `smartConsultantChat(req, res)` - Intelligenter Berater-Chat mit Tool-Calling
- `analyzeWorkflowsHandler(req, res)` - Workflow-Analyse
- `runSimulationHandler(req, res)` - Simulationen ausführen
- `getKnowledgeSources(req, res)` - Lädt alle Wissensquellen
- `getKnowledgeSource(req, res)` - Lädt einzelne Wissensquelle
- `searchKnowledgeHandler(req, res)` - Semantische Suche in Wissen
- `ragQueryHandler(req, res)` - RAG-Abfrage mit Zitaten
- `getBenchmarks(req, res)` - Deutsche Standards und Benchmarks
- `getPlaybooks/getPlaybook` - Praxis-Playbooks

#### `hrController.ts`
Verwaltet HR-KPIs, DSGVO-konforme Übersichten und Staffing Engine.

**Funktionen:**
- `getHRKpis(req, res)` - Legacy HR-KPI-Dashboard
- `getHrOverview(req, res)` - DSGVO-konformer HR-Overview (v2.0)
- `computeStaffingDemand(req, res)` - POST: Berechnet Personalbedarf aus Input
- `getStaffingDemandFromPractice(req, res)` - GET: Berechnet Personalbedarf aus Praxisdaten

---

## 6. Frontend-Architektur

### 6.1 Verzeichnisstruktur

```
client/src/
├── App.tsx               # Root-Komponente mit Routing
├── main.tsx              # Vite Entry Point
├── index.css             # Tailwind Imports
├── contexts/
│   └── PracticeContext.tsx  # Globaler Practice/Auth State
├── pages/
│   ├── Dashboard.tsx        # Übersicht mit KPIs
│   ├── LayoutEditor.tsx     # Visueller Raum-Editor
│   ├── Staff.tsx            # Personal-Verwaltung
│   ├── HrOverview.tsx       # HR-Dashboard
│   ├── Simulation.tsx       # Simulationen
│   ├── Knowledge.tsx        # Wissensmanagement
│   ├── Playbooks.tsx        # Praxis-Playbooks
│   ├── Debug.tsx            # Debug-Informationen
│   ├── Auth.tsx             # Login/Register
│   ├── ResetPassword.tsx    # Passwort-Reset
│   └── not-found.tsx        # 404-Seite
├── components/
│   ├── layout/
│   │   └── AppLayout.tsx    # Haupt-Layout mit Sidebar
│   ├── ui/                  # shadcn/ui Komponenten (57+)
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   └── ... (weitere)
│   ├── StaffingDemandCard.tsx   # Staffing Engine UI
│   ├── HRKpiDashboard.tsx       # HR-KPI-Karten
│   ├── AddStaffDialog.tsx       # Personal-Dialog
│   └── ... (weitere Komponenten)
├── lib/
│   ├── api.ts               # API Client Layer
│   ├── i18n.ts              # Internationalisierung (DE/EN)
│   ├── utils.ts             # Utility-Funktionen
│   └── queryClient.ts       # TanStack Query Config
├── hooks/
│   ├── use-toast.ts         # Toast-Notifications
│   ├── use-mobile.tsx       # Mobile-Detection
│   └── ... (weitere Hooks)
└── api/                     # API-Typen (wenn separiert)
```

### 6.2 Routing-Struktur

```
App.tsx
├── /auth            → Auth.tsx (Login/Register)
├── /reset-password  → ResetPassword.tsx
└── PracticeProvider (Protected Routes)
    └── AppLayout (Sidebar + Header)
        ├── /              → Dashboard.tsx
        ├── /editor        → LayoutEditor.tsx
        ├── /staff         → Staff.tsx
        ├── /hr            → HrOverview.tsx
        ├── /simulation    → Simulation.tsx
        ├── /knowledge     → Knowledge.tsx
        ├── /playbooks     → Playbooks.tsx
        ├── /debug         → Debug.tsx
        └── *              → NotFound.tsx
```

### 6.3 State-Management

#### PracticeContext
Der zentrale Context verwaltet:

```typescript
interface PracticeContextType {
  // Authentifizierung
  user: User | null;
  isLoading: boolean;

  // Aktive Praxis
  practice: Practice | null;
  practiceId: string | null;

  // Aktionen
  logout: () => Promise<void>;
  refetchUser: () => Promise<void>;
}
```

**Funktionsweise:**
1. `App.tsx` prüft Route - Auth-Routes werden ohne Context gerendert
2. `PracticeProvider` wrapped Protected Routes
3. Beim Mount: API-Call zu `/api/me` um User + Praxis zu laden
4. Bei 401: Redirect zu `/auth`
5. Alle Child-Komponenten haben Zugriff via `usePractice()` Hook

#### TanStack Query
Verwaltet Server-State mit automatischem Caching:

```typescript
// Beispiel aus HRKpiDashboard.tsx
const { data: kpis, isLoading, error } = useQuery({
  queryKey: ["hr-kpis", practiceId],
  queryFn: () => api.hr.getKpis(practiceId!),
  enabled: !!practiceId,
  staleTime: 60000,      // 1 Minute cache
  refetchInterval: 300000 // Alle 5 Minuten refetch
});
```

### 6.4 API Client Layer (`lib/api.ts`)

Der API Client bietet typsichere Methoden für alle Backend-Endpunkte:

```typescript
export const api = {
  // Authentifizierung
  auth: {
    login: (username: string, password: string) => Promise<User>,
    register: (data: RegisterData) => Promise<User>,
    logout: () => Promise<void>,
    me: () => Promise<{ user: User; practice: Practice }>
  },

  // Praxis
  practices: {
    get: (id: string) => Promise<Practice>,
    create: (data: CreatePracticeData) => Promise<Practice>,
    updateBudget: (id: string, budget: number) => Promise<Practice>
  },

  // Räume
  rooms: {
    list: (practiceId: string) => Promise<Room[]>,
    create: (practiceId: string, data: CreateRoomData) => Promise<Room>,
    update: (id: string, data: UpdateRoomData) => Promise<Room>,
    delete: (id: string) => Promise<void>
  },

  // Personal
  staff: {
    list: (practiceId: string) => Promise<Staff[]>,
    create: (practiceId: string, data: CreateStaffData) => Promise<Staff>,
    update: (id: string, data: UpdateStaffData) => Promise<Staff>,
    delete: (id: string) => Promise<void>
  },

  // HR
  hr: {
    getKpis: (practiceId: string) => Promise<HRKpiResponse>,
    getOverview: (practiceId: string, params?) => Promise<DsgvoHrOverviewResponse>,
    getStaffingDemand: (practiceId: string) => Promise<StaffingDemandResponse>,
    computeStaffingDemand: (practiceId: string, input: StaffingInput) => Promise<StaffingDemandResponse>
  },

  // AI
  ai: {
    analyzeLayout: (practiceId: string) => Promise<LayoutAnalysis>,
    recommend: (practiceId: string, question?: string) => Promise<string>,
    chat: (messages: Message[]) => Promise<ChatResponse>
  },

  // Workflows
  workflows: {
    list: (practiceId: string) => Promise<Workflow[]>,
    create: (practiceId: string, data) => Promise<Workflow>,
    // ... weitere Methoden
  },

  // Wissen
  knowledge: {
    list: () => Promise<KnowledgeSource[]>,
    search: (query: string) => Promise<SearchResult[]>,
    ragQuery: (query: string) => Promise<RAGResponse>
  }
};
```

---

## 7. Staffing Engine

### 7.1 Übersicht

Die **Staffing Engine v1.2.0** ist eine deterministische, pure-function Berechnungslogik für den optimalen Personalbedarf einer Zahnarztpraxis.

**Datei:** `shared/staffingEngine.ts`

### 7.2 Eingabe-Parameter

```typescript
interface StaffingInput {
  dentistsFte: number;           // FTE der Zahnärzte (Pflichtfeld)
  chairsSimultaneous?: number;   // Gleichzeitig betriebene Stühle
  treatmentRooms?: number;       // Behandlungsräume (Fallback)
  prophylaxisChairs?: number;    // Prophylaxe-Stühle (default: 0)
  patientsPerDay?: number;       // Patienten pro Tag
  complexityLevel?: number;      // -1 (einfach) bis 2 (hoch)
  clinicalBuffer?: number;       // Klinischer Puffer (default: 12%)
  adminBuffer?: number;          // Admin-Puffer (default: 8%)
  roundingStepFte?: number;      // Rundungsschritt (default: 0.10)
  defaultPatientsPerChair?: number; // Default: 18
  avgContractFraction?: number;  // Für Headcount (default: 0.80)
}
```

### 7.3 Berechnungslogik

#### Schritt 1: Abgeleitete Werte (DerivedValues)

```
C = chairsSimultaneous (oder Fallback aus treatmentRooms/dentistsFte)
N = patientsPerDay (oder C × 18)
PPC = N / C (Patienten pro Stuhl pro Tag)
TI = clamp((PPC - 14) / 8, 0, 1) (Turnover-Index)
CB = 0.05 × complexityLevel (Komplexitätsbonus: -0.05 bis +0.10)
SF = 0.15 + 0.25 × TI (Supportfaktor: 0.15 bis 0.40)
```

#### Schritt 2: Basis-FTE (ohne Buffer)

```
chairsideBase = C × (1.00 + SF + CB)
steriBase = (C × 0.12) + (N × 0.003) + (prophylaxisChairs × 0.05)
zfaTotalBase = chairsideBase + steriBase
prophyBase = prophylaxisChairs × (0.90 + 0.05 × complexityLevel)
frontdeskBase = 0.50 + 0.25 × max(0, dentistsFte - 1) + 0.01 × max(0, N - 20)
pmBase = staffCoreWithoutPm < 10 ? 0 : staffCoreWithoutPm < 15 ? 0.5 : 1.0
```

#### Schritt 3: Final-FTE (mit Buffer)

```
Klinische Rollen: ×(1 + clinicalBuffer)
Admin-Rollen: ×(1 + adminBuffer)
```

#### Schritt 4: Gerundete FTE

```
roundedFte[role] = ceil_to_step(finalFte[role], roundingStep)
```

### 7.4 Ausgabe-Struktur

```typescript
interface StaffingResult {
  derived: DerivedValues;      // Zwischenwerte (C, N, TI, etc.)
  baseFte: FteByRole;          // Basis-FTE ohne Buffer
  finalFte: FteByRole;         // Final-FTE mit Buffer
  roundedFte: FteByRole;       // Gerundete FTE
  ratios: StaffingRatios;      // Verhältnisse (z.B. chairsidePerChair)
  flags: StaffingFlag[];       // Ampel-Warnungen
  headcountHint: HeadcountHint; // Köpfe statt FTE
  coverage?: StaffingCoverage; // Ist/Soll-Verhältnis
  meta: StaffingMeta;          // Engine-Version, Double-Counting-Hinweise
}

interface FteByRole {
  chairside: number;   // Stuhlassistenz
  steri: number;       // Sterilisation
  zfaTotal: number;    // ZFA gesamt (chairside + steri)
  prophy: number;      // Prophylaxe
  frontdesk: number;   // Empfang
  pm: number;          // Praxismanagement
  total: number;       // Gesamtsumme
}
```

### 7.5 Ampel-Flags

Die Engine generiert automatisch Warnungen:

| Flag ID | Severity | Bedingung |
|---------|----------|-----------|
| UNDERSTAFFED_CHAIRSIDE_RED | red | chairsidePerChair < 1.20 |
| UNDERSTAFFED_CHAIRSIDE_YELLOW | yellow | 1.20 ≤ cpc < 1.45 |
| TARGET_CHAIRSIDE_GREEN | green | 1.45 ≤ cpc ≤ 1.80 |
| OVERSTAFFED_CHAIRSIDE_YELLOW | yellow | 1.80 < cpc ≤ 2.00 |
| OVERSTAFFED_CHAIRSIDE_RED | red | cpc > 2.00 |
| FRONTDESK_TOO_LOW_RED | red | frontdesk < 0.50 bei aktiver Praxis |

### 7.6 UI-Integration (StaffingDemandCard)

Die `StaffingDemandCard` Komponente visualisiert:

1. **Gesamtübersicht**: Soll-FTE mit Coverage-Bar
2. **Rollen-Aufschlüsselung**: ZFA, Prophylaxe, Empfang, PM
3. **Eingabe-Felder**: Zahnärzte, Stühle, Prophylaxe-Plätze, Komplexität
4. **Flags**: Farbcodierte Warnungen

```
┌─────────────────────────────────────────────┐
│  Personalbedarf (Staffing Engine v1.2.0)    │
├─────────────────────────────────────────────┤
│  Gesamt-VZK: ████████████░░░ 4.2 / 3.8 VZK  │
│                                    (110%)   │
├─────────────────────────────────────────────┤
│  Eingaben:                                  │
│  [2.0] Zahnärzte (VZK)                      │
│  [2  ] Behandlungsstühle                    │
│  [1  ] Prophylaxe-Plätze                    │
│  [○○●○] Komplexität (Normal)                │
├─────────────────────────────────────────────┤
│  Aufschlüsselung:                           │
│  ZFA gesamt     ████████░░ 2.8 / 2.5        │
│  Prophylaxe     ████████░░ 0.9 / 0.8        │
│  Empfang        ██████████ 0.5 / 0.5        │
│  Management     ─────────  0.0 / 0.0        │
├─────────────────────────────────────────────┤
│  ● Stuhlassistenz optimal: 1.52 VZK/Stuhl  │
└─────────────────────────────────────────────┘
```

---

## 8. HR-Modul (DSGVO-konform)

### 8.1 DSGVO-Compliance-Konzept

Das HR-Modul implementiert **k-Anonymität** um personenbezogene Daten zu schützen:

**Prinzip:** Keine Gruppe darf weniger als k Mitglieder haben (default k=5).

```
Personenbezogene Daten (Staff-Tabelle)
         │
         ▼
┌─────────────────────────────────┐
│  Controller: Aggregation        │
│  - Entfernt staffIds            │
│  - Gruppiert nach Rolle         │
│  - Summiert: FTE, Stunden, etc. │
└─────────────────────────────────┘
         │
         ▼
Aggregierte Gruppen (keine IDs)
         │
         ▼
┌─────────────────────────────────┐
│  HR-Service: Berechnung         │
│  - k-Anonymitäts-Check          │
│  - KPI-Berechnung               │
│  - Alert-Generierung            │
└─────────────────────────────────┘
         │
         ▼
DSGVO-konforme Response
```

### 8.2 Aggregation im Controller

```typescript
function aggregateStaffToGroups(
  staffList: StaffRecord[],
  absences: AbsenceRecord[],
  overtimeRecords: OvertimeRecord[]
): HrAggregatedGroupInput[] {

  // 1. Map staffId -> role
  const staffRoleMap = new Map<string, AllowedRoleKey>();

  // 2. Aggregiere pro Rolle (OHNE staffId!)
  const roleGroups = new Map<AllowedRoleKey, {
    headcount: number;
    totalFte: number;
    totalContractedHoursPerWeek: number;
    totalOvertimeMinutes: number;
    absenceByType: { sick, vacation, training, other };
  }>();

  // 3. Konvertiere zu Array (keine personenbezogenen IDs!)
  return Array.from(roleGroups.entries()).map(([role, data]) => ({
    groupKey: role,
    headcount: data.headcount,
    totalFte: data.totalFte,
    // ... weitere aggregierte Werte
  }));
}
```

### 8.3 k-Anonymitäts-Levels

```typescript
enum HrAggregationLevel {
  PRACTICE = "PRACTICE",  // Praxis-weit (immer möglich)
  ROLE = "ROLE"           // Pro Rolle (nur wenn alle Rollen k erfüllen)
}
```

**Fallback-Logik:**
- User requested: `ROLE`
- Rolle "ZFA" hat 6 Mitglieder (≥ k=5) → OK
- Rolle "DH" hat 2 Mitglieder (< k=5) → Unterdrückt
- Wenn alle Rollen < k → Fallback auf `PRACTICE`

### 8.4 KPI-Berechnung

```typescript
interface HrKpiSnapshot {
  groupKey: string;            // "PRACTICE" oder "ZFA", "DH", etc.
  aggregationLevel: HrAggregationLevel;
  periodStart: Date;
  periodEnd: Date;

  // FTE-Metriken
  fteHeadcount: number;
  fteTotalFte: number;
  fteQuote: number;            // Ist/Soll
  fteStatus: "critical" | "warning" | "ok" | "overstaffed";

  // Abwesenheits-Metriken
  absenceRatePercent: number;
  absenceByType: { sick, vacation, training, other };
  absenceStatus: "critical" | "warning" | "ok";

  // Überstunden-Metriken
  overtimeRatePercent: number;
  overtimeAvgPerStaff: number;
  overtimeStatus: "critical" | "warning" | "ok";

  // Arbeitskosten-Metriken (optional)
  laborCostRatioPercent?: number;
  laborCostStatus?: "critical" | "warning" | "ok";

  // Audit-Informationen
  audit: {
    complianceVersion: string;
    kAnonymityEnforced: boolean;
    actualK: number;
    legalBasis: string;
    createdAt: Date;
  };
}
```

### 8.5 Alert-Engine

```typescript
function generateHrAlerts(
  snapshot: HrKpiSnapshot,
  thresholds: HrThresholds
): HrAlert[] {
  const alerts: HrAlert[] = [];

  // FTE-Alerts
  if (snapshot.fteQuote < thresholds.fteQuoteCritical) {
    alerts.push({
      severity: "critical",
      code: "FTE_CRITICAL_UNDERSTAFFED",
      title: "Kritische Unterbesetzung",
      explanation: `FTE-Quote liegt bei ${snapshot.fteQuote}%`,
      recommendedActions: [
        "Sofortige Rekrutierung einleiten",
        "Überstundenregelung prüfen"
      ],
      metric: "fteQuote",
      metricValue: snapshot.fteQuote,
      threshold: thresholds.fteQuoteCritical
    });
  }

  // Abwesenheits-Alerts
  if (snapshot.absenceRatePercent > thresholds.absenceRateCritical) {
    alerts.push({ /* ... */ });
  }

  // Überstunden-Alerts
  if (snapshot.overtimeRatePercent > thresholds.overtimeRateCritical) {
    alerts.push({ /* ... */ });
  }

  return alerts;
}
```

### 8.6 UI-Komponente (HRKpiDashboard)

```
┌─────────────────────────────────────────────────────────────────┐
│  HR-Effizienz                               [Handlungsbedarf]   │
│  Kennzahlen für Dezember 2024                                   │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────────┐ │
│  │ VZK-Quote   │ │ Überstunden │ │ Abwesenheit │ │Personalko.│ │
│  │   [OK]      │ │  [Warnung]  │ │    [OK]     │ │   [OK]    │ │
│  │   95%       │ │   12.5%     │ │    4.2%     │ │   32.1%   │ │
│  │ 8.2/8.6 VZK │ │ 142h gesamt │ │ 18 Tage     │ │vom Umsatz │ │
│  │ +0.4 Übersch│ │ Ø 3.2h/MA   │ │ 8 Krankheit │ │Ø 4.200€/FT│ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └───────────┘ │
├─────────────────────────────────────────────────────────────────┤
│  ⚠ Aktive Hinweise (2)                                         │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ ⚠ Überstunden erhöht           [Warnung]                    │ │
│  │   12.5% Überstunden übersteigen Zielwert von 10%.           │ │
│  │   Empfehlung: Arbeitsverteilung optimieren                  │ │
│  └─────────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ ℹ Seasonal Staffing           [Info]                        │ │
│  │   Wintermonate zeigen erhöhte Krankheitstage.               │ │
│  │   Empfehlung: Präventive Maßnahmen planen                   │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 9. AI/KI-Integration

### 9.1 Architektur

```
┌─────────────────────────────────────────────────────────────────┐
│                        AI Module                                 │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                     advisor.ts                            │   │
│  │  - analyzeLayout(): Vollständige Praxis-Analyse          │   │
│  │  - getQuickRecommendation(): Schnelle Empfehlung         │   │
│  │  - computeWorkflowAnalysis(): Workflow-Bewertung         │   │
│  │  - generateAIInsights(): KI-basierte Insights            │   │
│  └──────────────────────────────────────────────────────────┘   │
│                               │                                  │
│  ┌────────────────────────────┼────────────────────────────┐    │
│  │                            │                            │    │
│  ▼                            ▼                            ▼    │
│  benchmarks.ts            ragQuery.ts           knowledgeProcessor.ts
│  - Deutsche Standards     - Vektor-Suche        - Chunk-Verarbeitung
│  - Raumgrößen-Normen      - Similarity-Search   - Embedding-Generierung
│  - Staffing-Ratios        - Kontext-Aufbau      - Relevanz-Scoring
│  - Kapazitäts-Benchmarks  - Zitat-Extraktion    │
│                                                  │
│  ┌──────────────────────────────────────────────┴──────────┐   │
│  │                    artifactService.ts                    │   │
│  │  - Knowledge-Artifacts (persistierte Erkenntnisse)       │   │
│  │  - Confidence-Scoring                                    │   │
│  │  - Source-Citations                                      │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
                          OpenAI API
                   (GPT-4o, text-embedding-3-small)
```

### 9.2 Layout-Analyse

Die `analyzeLayout()` Funktion kombiniert mehrere Analyse-Methoden:

```typescript
async function analyzeLayout(
  rooms: Room[],
  staff: Staff[],
  operatingHours: number = 8,
  scalePxPerMeter: number = 50,
  connections: WorkflowConnection[] = []
): Promise<LayoutAnalysis> {

  // 1. Effizienz-Score (regelbasiert)
  const efficiencyScore = calculateLayoutEfficiencyScore(rooms, scalePxPerMeter);

  // 2. Workflow-Analyse (Lean-basiert)
  const workflowAnalysis = computeWorkflowAnalysis(rooms, connections);

  // 3. Raum-Analysen (mit Knowledge-Base)
  const roomAnalyses = await analyzeRoomsWithKnowledge(rooms, scalePxPerMeter);

  // 4. Staffing-Analyse (Benchmark-basiert)
  const staffingAnalysis = analyzeStaffing(staff, rooms);

  // 5. Kapazitäts-Analyse
  const capacityAnalysis = analyzeCapacity(rooms, staff, operatingHours);

  // 6. Knowledge-basierte Empfehlungen
  const knowledgeRecommendations = await getKnowledgePoweredRecommendations(...);

  // 7. AI-Insights (GPT-4o)
  const aiInsights = await generateAIInsights(
    rooms, staff, efficiencyScore, staffingAnalysis.overallScore, recommendations
  );

  // 8. Gesamtscore berechnen
  const overallScore = Math.round(
    efficiencyScore * 0.35 +
    avgRoomScore * 0.25 +
    staffingScore * 0.25 +
    capacityScore * 0.15
  );

  return { overallScore, efficiencyScore, roomAnalyses, ... };
}
```

### 9.3 RAG-Pipeline (Retrieval-Augmented Generation)

```typescript
// ragQuery.ts
async function ragQuery(
  query: string,
  topK: number = 5
): Promise<RAGResponse> {

  // 1. Query-Embedding generieren
  const queryEmbedding = await generateEmbedding(query);

  // 2. Ähnlichste Chunks finden (pgvector)
  const chunks = await db.select()
    .from(knowledgeChunks)
    .orderBy(
      sql`embedding <=> ${queryEmbedding}` // Cosine Distance
    )
    .limit(topK);

  // 3. Kontext aufbauen
  const context = chunks.map(c => ({
    content: c.content,
    source: c.sourceId,
    headingPath: c.headingPath,
    relevanceScore: calculateRelevance(c.embedding, queryEmbedding)
  }));

  // 4. GPT-4o mit Kontext aufrufen
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: buildSystemPrompt(context) },
      { role: "user", content: query }
    ]
  });

  // 5. Zitate extrahieren
  const citations = extractCitations(response, chunks);

  return {
    answer: response.choices[0].message.content,
    citations,
    relevantChunks: context
  };
}
```

### 9.4 Benchmarks & Standards

Die `benchmarks.ts` enthält deutsche Standards:

```typescript
export const ROOM_SIZE_STANDARDS = {
  exam: { minSqM: 9, optimalSqM: 12, maxSqM: 16, name: "Behandlungsraum" },
  reception: { minSqM: 8, optimalSqM: 12, maxSqM: 20, name: "Empfang" },
  waiting: { minSqM: 10, optimalSqM: 20, maxSqM: 40, name: "Wartebereich" },
  lab: { minSqM: 6, optimalSqM: 10, maxSqM: 15, name: "Labor" },
  sterilization: { minSqM: 6, optimalSqM: 8, maxSqM: 12, name: "Sterilisation" },
  // ...
};

export const STAFFING_RATIOS = {
  supportPerProvider: { min: 2.5, optimal: 3.5, max: 4.5 },
  nursePerExamRoom: { min: 0.8, optimal: 1.2, max: 1.5 },
  receptionistPerProvider: { min: 0.3, optimal: 0.5, max: 0.8 }
};

export const PATIENT_FLOW_METRICS = {
  averageVisitTime: 30, // Minuten
  turnoverPerRoom: { min: 10, optimal: 16, max: 20 } // Patienten/Tag/Raum
};

export const LAYOUT_EFFICIENCY_PRINCIPLES = {
  distanceGuidelines: {
    receptionToWaiting: { optimal: 3, maxMeters: 8 },
    waitingToExam: { optimal: 5, maxMeters: 12 },
    examToLab: { optimal: 4, maxMeters: 10 }
  }
};
```

---

## 10. Workflow-System

### 10.1 Konzept

Das Workflow-System modelliert Bewegungsmuster in der Praxis:

- **Patientenpfade**: Check-In → Warten → Behandlung → Check-Out
- **Mitarbeiterwege**: Sterilisation → Behandlung → Lager
- **Instrumentenflüsse**: Aufbereitung → Lagerung → Einsatz

### 10.2 Datenmodell

```
Workflow (z.B. "Standardbehandlung")
    │
    ├── WorkflowStep 1: Empfang → Wartezimmer (weight: 1.0)
    ├── WorkflowStep 2: Wartezimmer → Behandlung 1 (weight: 2.0, critical)
    ├── WorkflowStep 3: Behandlung 1 → Röntgen (weight: 1.0, optional)
    └── WorkflowStep 4: Behandlung 1 → Empfang (weight: 1.0)
```

### 10.3 Workflow-Analyse

```typescript
function computeWorkflowAnalysis(
  rooms: Room[],
  connections: WorkflowConnection[]
): WorkflowAnalysis {

  // 1. Distanzen berechnen (Pixel → Meter)
  const connectionDetails = connections.map(conn => {
    const distancePx = calculateCenterDistance(fromRoom, toRoom);
    const distanceMeters = pxToM(distancePx);

    // Distanzklasse bestimmen
    const distanceClass =
      distanceMeters <= 3 ? "short" :
      distanceMeters <= 8 ? "medium" : "long";

    // Kosten berechnen
    const classWeight = { short: 1.0, medium: 1.5, long: 2.0 }[distanceClass];
    const cost = distanceMeters * conn.weight * classWeight;

    return { fromName, toName, distance: distanceMeters, distanceClass, cost };
  });

  // 2. Gesamt-Score berechnen
  const totalCost = connectionDetails.reduce((sum, c) => sum + c.cost, 0);
  const avgCost = totalCost / connections.length;

  let workflowScore = 100 - Math.min(30, avgCost * 2 / 3);

  // Abzüge für Probleme
  if (hasBacktracking) workflowScore -= 3;
  if (hasLongConnections) workflowScore -= longConnections.length * 2;

  // 3. Empfehlungen generieren
  const recommendations = [];
  if (hasLongConnections) {
    recommendations.push("Lange Wege: Material-Staging einrichten");
  }
  if (hasBacktracking) {
    recommendations.push("Rückläufige Bewegungen: Checklisten nutzen");
  }

  return {
    workflowCostTotal: totalCost,
    workflowScore,
    topConnections: connectionDetails.slice(0, 3),
    recommendations
  };
}
```

### 10.4 Distanzklassen

| Klasse | Distanz | Gewicht | Beschreibung |
|--------|---------|---------|--------------|
| short | 0-3m | 1.0x | Optimal, kurzer Weg |
| medium | 3-8m | 1.5x | Akzeptabel |
| long | >8m | 2.0x | Problematisch, Optimierung nötig |

### 10.5 Linientypen

| Typ | Visualisierung | Bedeutung |
|-----|----------------|-----------|
| default | Durchgezogen, grau | Standard-Verbindung |
| critical | Durchgezogen, rot, dick | Kritischer Pfad |
| optional | Gestrichelt, hellgrau | Optionaler Weg |
| automated | Gepunktet, blau | Automatisierter Prozess |

---

## 11. Authentifizierung & Autorisierung

### 11.1 Session-basierte Auth

```typescript
// server/auth.ts
export function setupAuth(app: Express) {
  // Session-Konfiguration mit PostgreSQL Store
  app.use(session({
    store: new pgSession({
      pool: pgPool,
      tableName: 'sessions',
      createTableIfMissing: true
    }),
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 24 Stunden
    }
  }));

  // Passport.js Local Strategy
  passport.use(new LocalStrategy(
    { usernameField: 'username' },
    async (username, password, done) => {
      const user = await storage.getUserByUsername(username);
      if (!user) return done(null, false);

      const isValid = await comparePassword(password, user.password);
      if (!isValid) return done(null, false);

      return done(null, user);
    }
  ));

  // Serialisierung
  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id, done) => {
    const user = await storage.getUserById(id);
    done(null, user);
  });
}
```

### 11.2 Resource Access Middleware

```typescript
// Prüft ob User Zugriff auf Praxis hat
export async function requirePracticeAccess(
  req: Request, res: Response, next: NextFunction
) {
  const practiceId = req.params.id || req.body.practiceId;
  const userId = req.user.id;

  const practice = await storage.getPracticeById(practiceId);
  if (!practice || practice.ownerId !== userId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  req.practice = practice;
  next();
}

// Prüft ob User Zugriff auf Raum hat (via Praxis)
export async function requireRoomAccess(
  req: Request, res: Response, next: NextFunction
) {
  const roomId = req.params.id;
  const userId = req.user.id;

  const room = await storage.getRoomById(roomId);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  const practice = await storage.getPracticeById(room.practiceId);
  if (!practice || practice.ownerId !== userId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  req.room = room;
  req.practice = practice;
  next();
}

// Weitere: requireStaffAccess, requireWorkflowAccess, etc.
```

### 11.3 Frontend Auth Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  User öffnet App                                                │
│       │                                                         │
│       ▼                                                         │
│  App.tsx prüft Location                                         │
│       │                                                         │
│       ├── /auth → Auth.tsx (Login/Register)                     │
│       │                                                         │
│       └── andere → PracticeProvider                             │
│                         │                                       │
│                         ▼                                       │
│                    useEffect: GET /api/me                       │
│                         │                                       │
│                    ┌────┴────┐                                  │
│                    │         │                                  │
│              200 OK         401                                 │
│                    │         │                                  │
│                    ▼         ▼                                  │
│              Set user     Redirect zu                           │
│              Set practice /auth                                 │
│                    │                                            │
│                    ▼                                            │
│              Render ProtectedRouter                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 12. API-Referenz

### 12.1 Authentifizierung

| Methode | Endpunkt | Beschreibung |
|---------|----------|--------------|
| POST | `/api/login` | Login mit username/password |
| POST | `/api/register` | Neuen Benutzer registrieren |
| POST | `/api/logout` | Session beenden |
| GET | `/api/user` | Aktuellen Benutzer abrufen |
| GET | `/api/me` | Benutzer + Praxis abrufen |

### 12.2 Praxen & Räume

| Methode | Endpunkt | Beschreibung |
|---------|----------|--------------|
| GET | `/api/practices/:id` | Praxis-Details |
| POST | `/api/practices` | Praxis erstellen |
| PUT | `/api/practices/:id/budget` | Budget aktualisieren |
| GET | `/api/practices/:id/layout-efficiency` | Layout-Effizienz-Breakdown |
| GET | `/api/practices/:id/rooms` | Alle Räume |
| POST | `/api/practices/:id/rooms` | Raum erstellen |
| PUT | `/api/rooms/:id` | Raum aktualisieren |
| DELETE | `/api/rooms/:id` | Raum löschen |

### 12.3 Personal

| Methode | Endpunkt | Beschreibung |
|---------|----------|--------------|
| GET | `/api/practices/:id/staff` | Personal-Liste |
| POST | `/api/practices/:id/staff` | Mitarbeiter hinzufügen |
| PUT | `/api/staff/:id` | Mitarbeiter aktualisieren |
| DELETE | `/api/staff/:id` | Mitarbeiter löschen |

### 12.4 HR-Modul

| Methode | Endpunkt | Beschreibung |
|---------|----------|--------------|
| GET | `/api/practices/:id/hr/kpis` | Legacy HR-KPIs |
| GET | `/api/practices/:id/hr/overview` | DSGVO-konformer HR-Overview |
| GET | `/api/practices/:id/hr/staffing-demand` | Personalbedarf aus Praxisdaten |
| POST | `/api/practices/:id/hr/staffing-demand` | Personalbedarf berechnen |

**Query-Parameter für `/hr/overview`:**
- `level`: "practice" | "role" (default: "practice")
- `kMin`: number (default: 5, minimum: 3)
- `periodStart`: YYYY-MM-DD
- `periodEnd`: YYYY-MM-DD

### 12.5 Workflows

| Methode | Endpunkt | Beschreibung |
|---------|----------|--------------|
| GET | `/api/practices/:id/workflows` | Alle Workflows |
| POST | `/api/practices/:id/workflows` | Workflow erstellen |
| PUT | `/api/practices/:id/workflows` | Workflow upsert |
| DELETE | `/api/workflows/:id` | Workflow löschen |
| GET | `/api/workflows/:id/steps` | Workflow-Schritte |
| POST | `/api/workflows/:id/steps` | Schritt hinzufügen |
| PUT | `/api/workflow-steps/:id` | Schritt aktualisieren |
| DELETE | `/api/workflow-steps/:id` | Schritt löschen |
| GET | `/api/practices/:id/workflow-connections` | Verbindungen |
| POST | `/api/practices/:id/workflow-connections` | Verbindung erstellen |
| PUT | `/api/workflow-connections/:id` | Verbindung aktualisieren |
| DELETE | `/api/workflow-connections/:id` | Verbindung löschen |

### 12.6 AI-Endpunkte

| Methode | Endpunkt | Beschreibung |
|---------|----------|--------------|
| POST | `/api/ai/analyze-layout` | Vollständige Layout-Analyse |
| POST | `/api/ai/recommend` | Schnelle Empfehlung |
| POST | `/api/ai/coach-chat` | Chat mit Praxis-Coach |
| POST | `/api/ai/chat` | Smart Consultant Chat |
| POST | `/api/ai/analyze-workflows` | Workflow-Analyse |
| GET | `/api/benchmarks` | Deutsche Standards |
| GET | `/api/playbooks` | Verfügbare Playbooks |
| GET | `/api/playbooks/:id` | Einzelnes Playbook |

### 12.7 Wissensmanagement

| Methode | Endpunkt | Beschreibung |
|---------|----------|--------------|
| GET | `/api/knowledge` | Alle Wissensquellen |
| GET | `/api/knowledge/:id` | Einzelne Wissensquelle |
| POST | `/api/knowledge/search` | Semantische Suche |
| POST | `/api/v1/rag/query` | RAG-Abfrage mit Zitaten |

---

## 13. Datenfluss-Diagramme

### 13.1 Staffing Engine Datenfluss

```
┌─────────────────────────────────────────────────────────────────┐
│  StaffingDemandCard (UI)                                        │
│  - Input-Felder: dentistsFte, chairsSimultaneous, etc.          │
│  - onChange → lokaler State                                     │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  useMutation: POST /api/practices/:id/hr/staffing-demand        │
│  Body: { dentistsFte, chairsSimultaneous, ... }                 │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  hrController.computeStaffingDemand()                           │
│  - Validiert Input                                              │
│  - Baut StaffingInput-Objekt                                    │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  staffingEngine.computeStaffing(input, current?)                │
│  - Pure Function, keine Side Effects                            │
│  - Berechnet: derived → baseFte → finalFte → roundedFte        │
│  - Generiert: ratios, flags, headcountHint, coverage            │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  Response: StaffingDemandResponse                               │
│  { timestamp, engineVersion, input, result }                    │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  StaffingDemandCard (UI)                                        │
│  - Zeigt roundedFte, coverage, flags                            │
│  - CoverageBar für Ist/Soll-Vergleich                           │
│  - Farbcodierte Flag-Badges                                     │
└─────────────────────────────────────────────────────────────────┘
```

### 13.2 HR-Overview Datenfluss (DSGVO)

```
┌─────────────────────────────────────────────────────────────────┐
│  HrOverview.tsx                                                 │
│  - useQuery("hr-overview", { level: "role", kMin: 5 })          │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  GET /api/practices/:id/hr/overview?level=role&kMin=5           │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  hrController.getHrOverview()                                   │
│                                                                 │
│  1. Hole Staff aus DB (mit staffId)                             │
│     staffList = storage.getStaffByPracticeId(practiceId)        │
│                                                                 │
│  2. Hole Abwesenheiten & Überstunden (mit staffId)              │
│     absences = storage.getStaffAbsences(...)                    │
│     overtime = storage.getStaffOvertime(...)                    │
│                                                                 │
│  3. AGGREGATION (DSGVO-kritisch!)                               │
│     aggregatedGroups = aggregateStaffToGroups(...)              │
│     → Entfernt alle staffIds                                    │
│     → Gruppiert nach Rolle                                      │
│     → Summiert: FTE, Stunden, Abwesenheiten                     │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼ (Keine personenbezogenen Daten mehr!)
┌─────────────────────────────────────────────────────────────────┐
│  HR-Service (server/services/hr.ts)                             │
│                                                                 │
│  4. Validiere aggregierte Daten                                 │
│     validateAggregatedInput(groups, kMin)                       │
│                                                                 │
│  5. Berechne KPIs pro Level                                     │
│     if (level === "role") {                                     │
│       snapshots = computeRoleSnapshots(input, thresholds)       │
│       → Prüft k-Anonymität pro Rolle                            │
│       → Unterdrückt Rollen mit < k Mitgliedern                  │
│       → Fallback auf PRACTICE wenn nötig                        │
│     } else {                                                    │
│       snapshots = [computePracticeSnapshot(input, thresholds)]  │
│     }                                                           │
│                                                                 │
│  6. Generiere Alerts                                            │
│     alertsBySnapshot = snapshots.map(s => generateHrAlerts(s))  │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  Response: DsgvoHrOverviewResponse                              │
│  {                                                              │
│    timestamp, periodStart, periodEnd,                           │
│    requestedLevel: "role",                                      │
│    aggregationLevel: "practice" (Fallback!),                    │
│    snapshots: [...],                                            │
│    alertsBySnapshot: [...],                                     │
│    compliance: { version, kMin, legalBasis },                   │
│    warnings: ["ROLE nicht möglich wegen k-Anonymität..."]       │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
```

### 13.3 RAG-Query Datenfluss

```
┌─────────────────────────────────────────────────────────────────┐
│  User: "Wie groß sollte ein Behandlungsraum sein?"              │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  POST /api/v1/rag/query                                         │
│  Body: { query: "...", topK: 5 }                                │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  ragQuery.ts                                                    │
│                                                                 │
│  1. Query-Embedding generieren                                  │
│     embedding = await openai.embeddings.create({                │
│       model: "text-embedding-3-small",                          │
│       input: query                                              │
│     })                                                          │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. Ähnlichste Chunks finden (pgvector)                         │
│     SELECT * FROM knowledge_chunks                              │
│     ORDER BY embedding <=> $queryEmbedding                      │
│     LIMIT 5                                                     │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. Kontext aufbauen                                            │
│     chunks.map(c => ({                                          │
│       content: c.content,                                       │
│       source: sources[c.sourceId].title,                        │
│       headingPath: c.headingPath                                │
│     }))                                                         │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. GPT-4o mit Kontext aufrufen                                 │
│     openai.chat.completions.create({                            │
│       model: "gpt-4o",                                          │
│       messages: [                                               │
│         { role: "system", content: `Du bist ein Praxis-Coach... │
│           WISSEN:\n${context.map(c => c.content).join('\n')}` },│
│         { role: "user", content: query }                        │
│       ]                                                         │
│     })                                                          │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  Response: RAGResponse                                          │
│  {                                                              │
│    answer: "Behandlungsräume sollten 9-12 m² haben...",         │
│    citations: [                                                 │
│      { source: "Praxishandbuch", chapter: "Raumplanung" }       │
│    ],                                                           │
│    relevantChunks: [...]                                        │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 14. Zusammenhänge & Abhängigkeiten

### 14.1 Modul-Abhängigkeiten

```
                    ┌─────────────────┐
                    │   shared/       │
                    │  - schema.ts    │
                    │  - staffingEngine│
                    │  - roomTypes    │
                    │  - contracts/   │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
      ┌───────────┐  ┌───────────┐  ┌───────────┐
      │  client/  │  │  server/  │  │  tests/   │
      │           │  │           │  │           │
      │ React App │  │ Express   │  │ Vitest    │
      │ TanStack  │  │ Drizzle   │  │ Tests     │
      │ Wouter    │  │ OpenAI    │  │           │
      └───────────┘  └───────────┘  └───────────┘
```

### 14.2 Datenbankbeziehungen

```
users
  │
  └──< practices (1:n, ownerId)
         │
         ├──< rooms (1:n, practiceId)
         │      │
         │      ├──< workflow_steps (m:n via fromRoomId/toRoomId)
         │      └──< workflow_connections (m:n via fromRoomId/toRoomId)
         │
         ├──< staff (1:n, practiceId)
         │      │
         │      ├──< staff_absences (1:n, staffId)
         │      └──< staff_overtime (1:n, staffId)
         │
         ├──< workflows (1:n, practiceId)
         │      │
         │      └──< workflow_steps (1:n, workflowId)
         │
         ├──< workflow_connections (1:n, practiceId)
         │
         ├──< architectural_elements (1:n, practiceId)
         │
         ├──< hr_alerts (1:n, practiceId)
         │
         ├──< hr_kpi_snapshots (1:n, practiceId)
         │
         └──< simulations (1:n, practiceId)

knowledge_sources
  │
  └──< knowledge_chunks (1:n, sourceId)

knowledge_artifacts (standalone, tenantId optional)
```

### 14.3 Feature-Zusammenhänge

| Feature | Verwendet | Wird verwendet von |
|---------|-----------|-------------------|
| **PracticeContext** | api.ts, storage.ts | Alle Pages, Alle Komponenten |
| **Staffing Engine** | shared/staffingEngine.ts | hrController, StaffingDemandCard |
| **HR-Service** | storage.ts, hrController | HrOverview, HRKpiDashboard |
| **Layout-Analyse** | benchmarks.ts, ragQuery.ts | Dashboard, LayoutEditor |
| **Workflow-System** | rooms, storage.ts | LayoutEditor, advisor.ts |
| **RAG-Pipeline** | knowledge_chunks, OpenAI | AI-Chat, Recommendations |
| **Benchmarks** | Deutsche Standards | advisor.ts, AI-Insights |

### 14.4 Technische Designentscheidungen

1. **Pure Functions für Staffing Engine**
   - Deterministische Berechnung: Same Input = Same Output
   - Keine Side Effects, keine externen Calls
   - Ermöglicht Unit-Tests ohne Mocking

2. **DSGVO-by-Design im HR-Modul**
   - Personenbezogene Daten werden im Controller aggregiert
   - HR-Service sieht niemals staffIds
   - k-Anonymität mit konfigurierbarem k (default: 5)

3. **RAG statt Fine-Tuning**
   - Wissen kann dynamisch aktualisiert werden
   - Zitate für Nachvollziehbarkeit
   - pgvector für effiziente Similarity-Suche

4. **TanStack Query statt Redux**
   - Server-State ist die Single Source of Truth
   - Automatisches Caching und Refetching
   - Optimistic Updates für bessere UX

5. **Wouter statt React Router**
   - Leichtgewichtig (~1.5kB vs ~15kB)
   - API-kompatibel mit React Router
   - Ausreichend für SPA-Routing

---

## Anhang: Glossar

| Begriff | Bedeutung |
|---------|-----------|
| FTE/VZÄ | Full-Time Equivalent / Vollzeitäquivalent |
| ZFA | Zahnmedizinische Fachangestellte |
| DH | Dentalhygieniker/in |
| PM | Praxismanagement |
| KPI | Key Performance Indicator |
| k-Anonymität | Datenschutzprinzip: min. k Personen pro Gruppe |
| RAG | Retrieval-Augmented Generation |
| pgvector | PostgreSQL-Extension für Vektor-Operationen |
| Chunk | Text-Abschnitt für RAG-Embedding |

---

**Dokumentation erstellt:** Dezember 2024
**Staffing Engine Version:** 1.2.0
**HR-Modul Version:** 2.0.0 (DSGVO-konform)
