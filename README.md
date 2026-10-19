# SEVENTS Enterprise OS

**SEVENTS OS** is a modern, modular, cloud-native Construction Enterprise Operating System built specifically for general contractors, engineering firms, and infrastructure developers. It unifies project management, commercial governance, field operations, procurement, quality/safety compliance, and autonomous AI copilots into a single platform.

Detailed documentation and step-by-step instructions for all features are available in the [Comprehensive User Guide](docs/USER-GUIDE.md).

---

## Key Capabilities

- **Organization & Role Authority:** Multi-company, branch, and department structure with a granular permissions matrix, temporary delegations, and financial Delegation of Authority (DoA) thresholds.
- **Master Data & Numbering Schemes:** Configurable units of measure, cost codes, multi-currency exchange rates, and automated document numbering schemes.
- **CRM & Tender Bidding Pipeline:** Opportunity tracking, tender document management, BOQ cost estimation across trades, and structured Bid / No-Bid sign-offs.
- **Project Scheduling & Execution:** Work Breakdown Structures (WBS), interactive Gantt charts, critical path calculation, 2-to-6 week lookahead planning, and delay event logging.
- **Site Operations:** Digital Daily Progress Reports (DPR), equipment hour meters, workforce headcounts, geo-tagged photo evidence, and site weather logs.
- **Quality & Safety Governance:** Inspection & Test Plans (ITP), Work Inspection Requests (WIR), Non-Conformance Reports (NCR) with CAPA workflows, Safe Work Hours calculation, and digital Permits to Work (PTW).
- **Commercial Management:** Main contract administration, variation orders with financial/schedule impact, Extension of Time (EOT) claims, and certified payment applications.
- **Procurement & Inventory:** Material Requisitions (MR), supplier quote comparisons, Purchase Orders with DoA spending gates, and Goods Receipt Notes (GRN) with 3-way matching.
- **Subcontractor Governance:** Trade partner prequalification, compliance documents, back-to-back agreements, and certified progress valuations.
- **Billing & Accounting Governance:** Client progress billings, retention accounting, receivables/payables management, and financial accounting period locks.
- **Visual Workflow Designer:** Interactive drag-and-drop workflow canvas with automated decision gates, approval routing, and real-time task inboxes.
- **Executive Portfolio Analytics:** Portfolio health summaries, cost variance waterfall (Budget vs Committed vs Incurred), and custom tabular report builder with CSV export.
- **AI Knowledge Engine & Search:** Document vectorization for drawings, specifications, RFIs, and contracts with zero-hallucination semantic search.
- **Autonomous AI Copilots & Tool Registry:** Construction-specific autonomous agents with scoped operational tools and strict Human-In-The-Loop (HITL) approval gates.
- **AI Operations Control Room:** Real-time run queue, step timeline tracing, token spend tracking, emergency kill switches, and security incident triage.
- **Pluggable AI Architecture:** Dynamic provider switcher supporting cloud LLMs, local air-gapped engines, and custom OpenAI-compatible endpoints (Groq, DeepSeek, Ollama, OpenRouter, Mistral, vLLM).
- **Mobile Field Mode & Offline PWA Sync:** Progressive Web App for remote construction job sites with local storage capture and background sync queue.
- **Integrations & APIs:** Scoped M2M API keys, outbound webhooks with HMAC signatures, and accounting connectors.

---

## Pluggable AI Engine & Dynamic Provider Setup

SEVENTS OS provides an open, pluggable architecture for AI models. You can easily switch between cloud providers or connect your own custom self-hosted LLM endpoints.

### Supported Providers Out-of-the-Box
1. **OpenAI** (`gpt-4o`, `gpt-4o-mini`, `o1-mini`)
2. **Google Gemini** (`gemini-1.5-flash`, `gemini-1.5-pro`, `gemini-2.0-flash`)
3. **Anthropic Claude** (`claude-3-5-sonnet`, `claude-3-5-haiku`)
4. **Azure OpenAI** (Private Virtual Network deployment)
5. **SEVENTS Local Engine** (Air-gapped local mock and deterministic embeddings)

### Connecting Any Custom Provider or Model
Administrators can register any custom OpenAI-compatible endpoint directly via the UI (**AI Agent Studio** ➔ **AI Providers & Adapters** ➔ **`+ Add Custom AI Provider`**):
- **Groq Cloud** (`https://api.groq.com/openai/v1`)
- **DeepSeek** (`https://api.deepseek.com/v1`)
- **Local Ollama** (`http://localhost:11434/v1`)
- **OpenRouter** (`https://openrouter.ai/api/v1`)
- **Mistral AI** (`https://api.mistral.ai/v1`)
- **Custom vLLM / LMStudio server**

Any provider can be ping-tested with live latency reporting and toggled as the active system provider with a single click. Additional models can also be added on the fly to any provider.

---

## Tech Stack & Architecture

- **Backend:** Node.js, Fastify, TypeScript. Clean modular architecture with dedicated route handlers, service layer, repository, and automated tests for each functional area.
- **Database & Auth:** PostgreSQL (Supabase) with Row-Level Security (RLS) policies enforcing multi-tenant isolation at the database layer.
- **Frontend:** React 18, Vite, TypeScript, Tailwind CSS, and interactive canvas components (`@xyflow/react`).
- **Full TypeScript Type Safety:** Both frontend and backend share strict type definitions with 100% build verification.

---

## Getting Started

### Prerequisites
- Node.js ≥ 20
- npm ≥ 10
- PostgreSQL database / Supabase project

### Backend Setup
```bash
cd backend
npm install
cp .env.example .env   # configure SUPABASE_URL, SUPABASE_ANON_KEY, and provider API keys
npm run build          # verifies TypeScript compilation
npm run dev            # starts API server on http://localhost:3000
```

### Frontend Setup
```bash
cd frontend
npm install
cp .env.example .env.local   # configure VITE_API_URL and Supabase keys
npm run build                # verifies TypeScript and Vite bundle
npm run dev                  # starts Vite dev server on http://localhost:5173
```

### Running Test Suites
```bash
# Run backend tests (740+ unit and integration tests)
cd backend
npm test

# Run frontend tests
cd frontend
npm test
```

---

## Documentation
- [User Guide (Module by Module)](docs/USER-GUIDE.md)
- [System Architecture & Decisions](DECISIONS.md)
- [Developer Guidelines](CLAUDE.md)
