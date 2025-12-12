# Phase 2.5: Knowledge Artifact System

This document describes the knowledge artifact system implemented in Phase 2.5, which enables extracting structured knowledge from coaching documents and using it to power the simulation and dashboard with data-driven defaults.

## Overview

The artifact system consists of three main components:
1. **Knowledge Ingestion** - Extract text chunks from documents and store with embeddings
2. **Artifact Building** - Use AI to extract structured artifacts from knowledge chunks
3. **Runtime Integration** - Use artifacts as dynamic defaults in simulation and dashboard

## HOWTO: End-to-End Usage

### 1. Ingest Knowledge Documents

Place `.docx` files in the `/knowledge-docs/` directory, then run:

```bash
npx tsx scripts/ingest-knowledge.ts
```

This will:
- Parse each document into chunks with heading hierarchy
- Generate embeddings using OpenAI text-embedding-3-small
- Store chunks in `knowledge_chunks` table with hash-based upsert (skips unchanged content)

### 2. Build Artifacts

Run the artifact builder (processes 20 artifacts per batch to stay within rate limits):

```bash
npx tsx scripts/build-artifacts.ts
```

This will:
- Query knowledge chunks for each module/topic combination
- Use GPT-4o to extract structured benchmarks, rules, formulas
- Store in `knowledge_artifacts` table with source citations
- Use hash-based upsert to avoid duplicate processing

Repeat until all expected artifacts are built. Check progress with:

```bash
curl http://localhost:5000/api/benchmarks
```

### 3. Run the Application

```bash
npm run dev
```

The application will automatically:
- Load artifacts from the database with 5-minute cache
- Use knowledge-powered defaults in simulation calculations
- Display citations inline with recommendations on the dashboard

### 4. Verify Integration

Run smoke tests:

```bash
npx tsx tests/artifacts-smoke.test.ts
```

Test the benchmarks endpoint:

```bash
curl http://localhost:5000/api/benchmarks | jq
```

## Changed Files

### New Files
- `shared/taxonomy.ts` - Artifact types, modules, and SAFE_DEFAULTS
- `scripts/build-artifacts.ts` - Batch artifact extraction script
- `server/ai/artifactService.ts` - Query artifacts with caching and citations
- `server/ai/artifactBenchmarks.ts` - Knowledge-powered benchmark wrappers
- `tests/artifacts-smoke.test.ts` - Zod schema and simulator smoke tests

### Modified Files
- `shared/schema.ts` - Added `knowledge_artifacts` table
- `server/simulation.ts` - Made async, uses `getKnowledgePoweredScheduling()`
- `server/routes.ts` - Added `/api/benchmarks` endpoint, awaits async simulation
- `server/ai/advisor.ts` - Uses `evaluateRoomSizeWithKnowledge()` and `getKnowledgePoweredRecommendations()`

## Database Schema

### knowledge_artifacts Table
```sql
CREATE TABLE knowledge_artifacts (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR,
  artifact_type TEXT NOT NULL,  -- rule, benchmark, formula, template, checklist, playbook
  module TEXT NOT NULL,         -- dashboard, layout, staffing, scheduling, hygiene, billing, marketing, qm
  topic TEXT NOT NULL,
  payload_json JSONB NOT NULL,
  source_citations JSONB NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.8,
  version INTEGER NOT NULL DEFAULT 1,
  source_hash TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

## Artifact Types

| Type | Payload Fields | Use Case |
|------|---------------|----------|
| benchmark | metric, unit, min, max, optimal, description, source | Room sizes, staffing ratios |
| rule | condition, action, priority, description | Layout recommendations |
| formula | name, formula, variables, description | Capacity calculations |
| checklist | name, items, frequency, description | QM checklists |
| template | name, template, variables, description | Document templates |
| playbook | name, steps, description | Process workflows |

## Modules

- `dashboard` - Health score weights and display rules
- `layout` - Room sizes, distances, placement rules
- `staffing` - MFA per doctor, support ratios
- `scheduling` - Service times, buffers, max wait times
- `hygiene` - RKI guidelines, Hygieneverordnung
- `billing` - EBM codes, GOZ procedures
- `marketing` - Patient retention, acquisition
- `qm` - QM-RL compliance, audit requirements

## Safe Defaults

If no artifacts are found, the system falls back to `SAFE_DEFAULTS` defined in `shared/taxonomy.ts`:

- Room sizes: Reception 8-14m², Waiting 15-35m², Treatment 9-12m², Lab 8-15m², Office 10-18m²
- Staffing: 1.0-2.0 MFA per doctor, 2.5-4.0 support per physician
- Scheduling: Checkup 20min, Treatment 45min, Cleaning 30min, Buffer 5min, Max wait 15min

## Caching Strategy

Artifacts are cached for 5 minutes in-memory (`CACHE_TTL = 5 * 60 * 1000`). The cache is refreshed automatically when:
- Cache expires
- Application restarts
- `clearCache()` is called explicitly

## Environment Variables Required

- `DATABASE_URL` - PostgreSQL connection string
- `OPENAI_API_KEY` (or `AI_INTEGRATIONS_OPENAI_API_KEY`) - For embeddings and artifact extraction
- `TAVILY_API_KEY` (optional) - For web search augmentation in coach chat

## Assumptions

1. Documents are in German, matching the medical practice domain
2. Embeddings use OpenAI text-embedding-3-small (1536 dimensions)
3. Artifacts are tenant-agnostic (tenant_id is null) for now
4. Confidence threshold for artifact usage is 0.8 (below this, falls back to defaults)
5. The build script processes 20 artifacts per run to avoid API rate limits
