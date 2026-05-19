# VocaFlow AI — Complete Project Audit Report
> Generated: May 16, 2026 | Based on actual code review of all files

---

## SECTION 1 — PROJECT OVERVIEW

**What it is:** VocaFlow AI is a multi-tenant AI-powered call center platform. It handles both inbound and outbound phone calls using AI agents, transcribes speech in real-time, scores leads, detects objections, books appointments, and provides coaching reports.

**Problem it solves:** Replaces human call center agents with AI that can handle sales calls, support queries, and appointment booking — with real-time monitoring, CRM management, and workflow automation.

**Tech Stack:**
- Backend: Node.js (ESM), Express.js, Prisma ORM, BullMQ
- Frontend: React 18, Vite, Tailwind CSS, Recharts, Framer Motion, Socket.io-client
- Database: PostgreSQL with pgvector extension (via Docker)
- AI: OpenAI GPT-4o (LLM + embeddings via text-embedding-3-small), LangGraph (supervisor agent)
- Telephony: Twilio (voice calls, SMS, TwiML)
- TTS: ElevenLabs
- STT: Deepgram (live streaming)
- Queue: BullMQ + Redis
- Cache/State: Redis (ioredis)
- Auth: JWT (access 15m + refresh 7d), bcryptjs
- Calendar: Google Calendar API (OAuth2)
- Containerization: Docker Compose (4 services: db, redis, server, client)

---

## SECTION 2 — BACKEND COMPLETE AUDIT

### 2.1 Auth System
**File:** `server/src/controllers/authCtrl.js`
**Routes:** `server/src/routes/auth.js`

| Function | What it does | DB Tables |
|---|---|---|
| `register` | Creates Tenant + User + TenantUser in transaction | Tenant, User, TenantUser (write) |
| `login` | Validates credentials, returns JWT pair | User, TenantUser (read) |
| `refresh` | Issues new access token from refresh token | none |
| `logout` | Returns 200 (stateless, no token blacklist) | none |
| `changePassword` | Verifies old password, updates hash | User (read+write) |

**Status:** COMPLETE. No placeholder code. Proper bcrypt (cost 12), transaction on register.
**Issue:** `logout` is stateless — tokens remain valid until expiry. No token blacklist.

---

### 2.2 Tenant System
**File:** `server/src/controllers/tenantCtrl.js`

| Function | What it does |
|---|---|
| `getMe` | Returns current tenant data |
| `updateMe` | Updates tenant name only |
| `getPhoneNumbers` | Lists phone numbers for tenant |

**Status:** PARTIALLY COMPLETE. Only `name` field is updatable. No phone/plan update. `PhoneNumber` records can be read but not created/deleted via API.

---

### 2.3 Agent CRUD
**File:** `server/src/controllers/agentCtrl.js`

- Full CRUD: list, create, getOne, update, soft-delete (sets `deletedAt`)
- Zod validation on create/update
- Tenant isolation enforced on all operations
- Fields: name, personality, tone, language, agentType, systemPrompt, openingScript, objectionScript, voiceId, cloneVoiceId, useClonedVoice
- **Status:** FULLY COMPLETE

---

### 2.4 Knowledge Base + RAG
**Files:** `server/src/controllers/uploadCtrl.js`, `server/src/lib/rag.js`, `server/src/lib/embeddings.js`

- PDF upload → `pdf-parse` → text extraction → `KnowledgeDoc` created → `ingestDoc()` chunks text (500 chars) → OpenAI `text-embedding-3-small` → stored as `vector(1536)` in pgvector
- CSV upload → parse → bulk `Lead` create
- RAG query: embed query → cosine similarity search via `$queryRawUnsafe` with pgvector `<=>` operator → top 5 chunks returned
- **Status:** FULLY COMPLETE. Requires `OPENAI_API_KEY`.

---

### 2.5 Appointment Booking + Google Calendar
**Files:** `server/src/controllers/appointmentCtrl.js`, `server/src/lib/gcal.js`, `server/src/routes/calendar.js`

- OAuth2 flow: `getAuthUrl` → redirect → `handleCallback` → stores tokens in Tenant
- `getSlots` / `getAvailableSlots`: queries Google Calendar freebusy, returns 30-min slots 9am-5pm
- `bookSlot`: creates Google Calendar event, triggers `appointment_booked` workflow
- `createEvent`, `updateEvent`, `deleteEvent`: full CRUD on calendar events
- Reschedule/cancel appointments via `appointmentCtrl.js`
- **Issue:** `getSlots` has inverted logic — returns BUSY slots as available (line: `if (!isFree)` should be `if (isFree)`)
- **Status:** PARTIALLY WORKING — OAuth flow complete, slot logic has a bug

---

### 2.6 Outbound Dialer + BullMQ
**Files:** `server/src/controllers/dialerCtrl.js`, `server/src/lib/queue.js`, `server/src/workers/callWorker.js`

- `startDialer`: fetches PENDING leads → adds `outbound-call` jobs to BullMQ `calls` queue → sets Redis key `dialer:{tenantId}` = "running"
- `stopDialer`: sets Redis key to "stopped" (does NOT drain queue — jobs already queued will still run)
- Worker (`callWorker.js`): processes `outbound-call` jobs → `twilioClient.calls.create()` → creates `Call` record → updates lead status to CONTACTED
- Outbound webhook URL: `/webhooks/twilio/outbound-handler` → same as `inboundHandler`
- **Issue:** `stopDialer` only sets a Redis flag but doesn't actually stop BullMQ workers or drain the queue
- **Status:** PARTIALLY WORKING

---

### 2.7 Inbound Webhooks + Gather Pipeline
**File:** `server/src/controllers/webhookCtrl.js`

**inboundHandler:**
1. Looks up `PhoneNumber` by `req.body.To`
2. Creates `Call` record
3. Stores call context in Redis (`call:{CallSid}`)
4. Returns TwiML: `<Say>` opening script + `<Gather>` pointing to `/webhooks/twilio/gather`

**gatherHandler:**
1. Gets `SpeechResult` from Twilio
2. Loads call context from Redis
3. `queryRAG(speechResult, tenantId)` — gets knowledge base context
4. `routeCall(speechResult, tenantId)` — LLM classifies intent → returns agent module
5. `agentModule.handleTurn(speech, ragContext, agent)` — LLM generates reply
6. `analyzeSentiment(speechResult)` — LLM returns 0-1 score
7. `handleObjection(speechResult, tenantId)` — LLM detects objection type
8. Emits `transcript` + `sentiment` via Socket.io to tenant room
9. Updates `Call` transcript + sentiment in DB
10. Returns TwiML: `<Say>` AI reply + `<Gather>` loop

**callStatusHandler:**
1. On `completed`: updates Call status/duration, runs `scoreCall`, runs `CALL_ENDED` workflow
2. On `failed/busy/no-answer`: sets status to MISSED

**Issue:** `inboundHandler` looks up `PhoneNumber` by `To` but `PhoneNumber` model has no `agentId` field in schema — `phoneNumber?.agentId` will always be undefined. Agent is never loaded from phone number.
**Status:** PARTIALLY WORKING — call flow works but agent lookup from phone number is broken

---

### 2.8 Sentiment Analysis
**File:** `server/src/lib/sentiment.js`

- Uses GPT-4o to return a float 0-1
- Called in `gatherHandler` on every speech turn
- Result stored in `Call.sentimentScore`
- **Issue:** Returns raw float but `webhookCtrl` stores it as `sentiment` (string field) AND `sentimentScore` (float) — inconsistent. `analyzeSentiment` returns just a number but `gatherHandler` expects `{ sentiment, score }` object — **this will crash** on every gather call.
- **Status:** BROKEN — return type mismatch between `sentiment.js` and `webhookCtrl.js`

---

### 2.9 Objection Handling
**Files:** `server/src/lib/objections.js`, `server/src/controllers/objectionCtrl.js`

- `handleObjection`: GPT-4o JSON mode → `{ detected, type, response }`
- Types: TOO_EXPENSIVE, CALL_LATER, NOT_INTERESTED, NEED_TEAM, GENERIC
- `objectionCtrl`: manual API trigger, updates `Call.analysis` JSON, fires `OBJECTION_DETECTED` workflow
- Auto-called in `gatherHandler` on every turn (result ignored if error)
- **Status:** COMPLETE for manual trigger. Auto-detection in gather works but result is not emitted as `objection_detected` socket event (frontend listens for it but server never emits it)

---

### 2.10 Human Handoff
**Files:** `server/src/lib/handoff.js`, `server/src/controllers/handoffCtrl.js`

- `initiateHandoff`: generates LLM summary of transcript → updates Call status to TRANSFERRED → emits `human_handoff` socket event
- `transferCall` in `callsCtrl.js`: uses Twilio API to update live call TwiML to `<Dial>` human number
- Two separate handoff paths exist (handoffCtrl vs callsCtrl) — both registered on `/calls` routes
- **Status:** COMPLETE

---

### 2.11 Multi-Agent Routing
**Files:** `server/src/agents/router.js`, `server/src/agents/sales.js`, `server/src/agents/support.js`, `server/src/agents/booking.js`, `server/src/agents/supervisor.js`

- `routeCall`: GPT-4o classifies intent → BOOKING/SALES/SUPPORT/FOLLOWUP → returns agent module
- Each agent module has `handleTurn(transcript, ragContext, agentConfig)` → GPT-4o with agent's systemPrompt
- `supervisor.js`: Full LangGraph StateGraph with supervisor → sales/support/booking nodes, RAG + calendar integration
- **Issue:** `supervisor.js` is defined but never called — `routeCall` uses simple agents (sales/support/booking), not the LangGraph supervisor
- **Status:** COMPLETE (simple routing). LangGraph supervisor exists but unused.

---

### 2.12 CRM Lead Management
**File:** `server/src/controllers/leadCtrl.js`

- Full CRUD with soft delete, pagination, filtering by status/agentId
- Bulk create, CSV upload
- `getScore`: returns lead + latest call
- `rescore`: triggers `scoreCall` on latest call transcript
- `getHotLeads`: leads with score >= 70 or status QUALIFIED/BOOKED
- **Status:** FULLY COMPLETE

---

### 2.13 Analytics
**File:** `server/src/controllers/analyticsCtrl.js`

| Endpoint | What it returns |
|---|---|
| `getOverview` | totalCalls, missedCalls, activeLeads, conversionRate, bookingRate, avgDuration |
| `getCalls` | Daily call counts for last 7 days |
| `getLeads` | Lead counts grouped by status |
| `getAgents` | Per-agent call count + avg sentiment score |
| `getSentiment` | Daily avg sentiment for last 30 days |

**Issue:** `getOverview` returns `totalCalls`, `activeLeads` etc. but frontend Dashboard reads `overview.totalLeads` and `overview.totalAppointments` which don't exist in the response.
**Status:** PARTIALLY WORKING — data exists but field name mismatches with frontend

---

### 2.14 Prompt Studio
**File:** `server/src/controllers/promptStudioCtrl.js`

- `getPrompts`: returns agent's systemPrompt, openingScript, objectionScript
- `savePrompts`: updates those 3 fields on Agent
- `testPrompt`: calls GPT-4o with provided systemPrompt + testMessage
- **Status:** FULLY COMPLETE

---

### 2.15 Workflow Automation
**File:** `server/src/lib/workflow.js`, `server/src/routes/workflows.js`

**Triggers:** CALL_ENDED, OBJECTION_DETECTED, appointment_booked, lead_scored (custom)
**Actions:** SEND_SMS (Twilio), BOOK_MEETING (creates Appointment), UPDATE_LEAD_STATUS / CREATE_CRM_RECORD (updates Lead), NOTIFY_TEAM (socket emit)
**Conditions:** equals, greater_than, less_than, score_gte, score_lte

- Full CRUD for workflows in routes (inline, no separate controller)
- `executeWorkflow` called from webhookCtrl (CALL_ENDED), objectionCtrl (OBJECTION_DETECTED), gcal (appointment_booked)
- WorkflowLog created after each execution
- **Status:** FULLY COMPLETE

---

### 2.16 Call Scoring
**File:** `server/src/lib/scorer.js`

- GPT-4o JSON mode → `{ score, conversionChance, urgency, keyInsights, scoreReason }`
- Updates `Lead.score` and `Lead.scoreReason`
- Emits `lead_scored` socket event to tenant room
- Called automatically on call completion in `callStatusHandler`
- **Status:** FULLY COMPLETE. Requires `OPENAI_API_KEY`.

---

### 2.17 Coaching Reports
**Files:** `server/src/lib/coach.js`, `server/src/controllers/coachCtrl.js`

- `analyzeCall`: GPT-4o → `{ mistakes: [{moment, issue, betterResponse}], insights }` → creates `CoachingReport`
- **Issue:** `analyzeCall` is defined in `coach.js` but is NEVER CALLED anywhere in the codebase. No route or webhook triggers it.
- `coachCtrl`: list reports, get by callId, weekly digest (grouped by agent)
- **Status:** PARTIALLY WORKING — read endpoints work, but reports are never auto-generated

---

### 2.18 WebSocket Events
**File:** `server/src/lib/socket.js`

- Socket.io server on path `/api/socket.io`
- JWT auth middleware on connection
- Clients join room `tenant-{tenantId}`
- Events emitted: `transcript`, `sentiment`, `lead_scored`, `human_handoff`, `call_transferred`, `team_notification`, `caller_speaking`, `caller_stopped`
- **Issue:** `objection_detected` event is never emitted by server but frontend listens for it
- **Status:** MOSTLY COMPLETE

---

### 2.19 Redis Usage

| Key Pattern | Purpose |
|---|---|
| `call:{CallSid}` | Call context (callId, agentId, tenantId) during active call |
| `dialer:{tenantId}` | Dialer running/stopped state |
| BullMQ internal keys | Job queue state for `calls` queue |

---

### 2.20 Worker Processes
**Files:** `server/src/workers/callWorker.js`, `server/src/workers/index.js`

- Single BullMQ worker on `calls` queue
- Handles `outbound-call` jobs: fetch lead → Twilio call create → DB record → update lead status
- Worker wrapped in try/catch — if Redis unavailable, `callWorker` is null and logged as warning
- **Status:** COMPLETE

---

### 2.21 Deepgram / Media Stream
**Files:** `server/src/lib/deepgram.js`, `server/src/lib/stream.js`, `server/src/lib/vad.js`

- `startLiveSession`: opens Deepgram WebSocket with nova-2 model, mulaw 8000Hz
- Emits `transcript`, `caller_speaking`, `caller_stopped` via Socket.io
- VAD: `interruptAI` destroys TTS stream on speech start
- `stream.js`: wrapper around deepgram for media stream forwarding
- **Critical Issue:** Media stream is explicitly skipped in `index.js` (`console.log('✅ Skipping Media Stream for now')`). Deepgram live transcription is NOT connected to the call pipeline. The gather pipeline uses Twilio's built-in speech recognition instead.
- **Status:** CODE EXISTS BUT NOT CONNECTED


---

## SECTION 3 — COMPLETE API ENDPOINT LIST

> Base URL: `http://localhost:3001`
> Note: Due to `app.use('/auth', router)` AND `app.use(router)`, all routes are accessible both with and without `/auth` prefix. This is a routing bug.

| METHOD | PATH | CONTROLLER FUNCTION | AUTH REQUIRED | WHAT IT DOES |
|---|---|---|---|---|
| GET | /health | inline | No | Health check |
| POST | /auth/register | authCtrl.register | No | Register user + tenant |
| POST | /auth/login | authCtrl.login | No | Login, get JWT pair |
| POST | /auth/refresh | authCtrl.refresh | No | Refresh access token |
| POST | /auth/logout | authCtrl.logout | No | Logout (stateless) |
| POST | /auth/change-password | authCtrl.changePassword | Yes | Change password |
| GET | /tenant/me | tenantCtrl.getMe | Yes | Get tenant profile |
| PUT | /tenant/me | tenantCtrl.updateMe | Yes (TENANT_ADMIN) | Update tenant name |
| GET | /tenant/phone-numbers | tenantCtrl.getPhoneNumbers | Yes | List phone numbers |
| GET | /agents | agentCtrl.list | Yes | List agents |
| POST | /agents | agentCtrl.create | Yes (TENANT_ADMIN) | Create agent |
| GET | /agents/:id | agentCtrl.getOne | Yes | Get agent |
| PUT | /agents/:id | agentCtrl.update | Yes (TENANT_ADMIN) | Update agent |
| DELETE | /agents/:id | agentCtrl.remove | Yes (TENANT_ADMIN) | Soft delete agent |
| GET | /leads | leadCtrl.getLeads | Yes | List leads (paginated) |
| POST | /leads | leadCtrl.create | Yes | Create lead |
| POST | /leads/bulk | leadCtrl.bulkCreate | Yes (TENANT_ADMIN) | Bulk create leads |
| GET | /leads/priority/hot | leadCtrl.getHotLeads | Yes | Get hot leads |
| GET | /leads/:id | leadCtrl.getOne | Yes | Get lead |
| GET | /leads/:id/score | leadCtrl.getScore | Yes | Get lead score |
| POST | /leads/:id/rescore | leadCtrl.rescore | Yes | Re-score lead |
| PUT | /leads/:id | leadCtrl.update | Yes | Update lead |
| DELETE | /leads/:id | leadCtrl.remove | Yes | Soft delete lead |
| GET | /calls | callsCtrl.list | Yes (TENANT_ADMIN) | List calls (paginated) |
| POST | /calls/:id/transfer | handoffCtrl.transferCall | Yes (TENANT_ADMIN) | Transfer call to human |
| POST | /calls/handoff | handoffCtrl.transferCall | Yes | Manual handoff |
| GET | /analytics/overview | analyticsCtrl.getOverview | Yes | Overview stats |
| GET | /analytics/calls | analyticsCtrl.getCalls | Yes | Daily call counts |
| GET | /analytics/leads | analyticsCtrl.getLeads | Yes | Lead status counts |
| GET | /analytics/sentiment | analyticsCtrl.getSentiment | Yes | Sentiment trend |
| GET | /analytics/agents | analyticsCtrl.getAgents | Yes | Agent performance |
| GET | /workflows | inline | Yes (TENANT_ADMIN) | List workflows |
| POST | /workflows | inline | Yes (TENANT_ADMIN) | Create workflow |
| PUT | /workflows/:id | inline | Yes (TENANT_ADMIN) | Update workflow |
| DELETE | /workflows/:id | inline | Yes (TENANT_ADMIN) | Delete workflow |
| POST | /upload/leads-csv | uploadCtrl.uploadCSV | Yes | Upload leads CSV |
| POST | /upload/pdf | uploadCtrl.uploadPdf | Yes | Upload PDF to KB |
| GET | /upload/knowledge-docs | uploadCtrl.listDocs | Yes | List KB documents |
| DELETE | /upload/knowledge-docs/:id | uploadCtrl.deleteDoc | Yes | Delete KB document |
| POST | /dialer/start | dialerCtrl.startDialer | Yes (TENANT_ADMIN) | Start outbound campaign |
| POST | /dialer/stop | dialerCtrl.stopDialer | Yes | Stop campaign |
| GET | /dialer/status | dialerCtrl.getStatus | Yes | Get dialer status |
| GET | /calendar/auth | gcal.getAuthUrl | Yes (TENANT_ADMIN) | Get Google OAuth URL |
| GET | /calendar/status | inline | Yes | Check calendar connection |
| POST | /calendar/disconnect | inline | Yes (TENANT_ADMIN) | Disconnect calendar |
| GET | /calendar/callback | gcal.handleCallback | No | OAuth callback |
| GET | /calendar/slots | gcal.getSlots | Yes | Get available slots |
| POST | /calendar/book | gcal.bookSlot | Yes | Book appointment slot |
| PUT | /calendar/appointments/:id | appointmentCtrl.rescheduleAppointment | Yes | Reschedule appointment |
| DELETE | /calendar/appointments/:id | appointmentCtrl.cancelAppointment | Yes | Cancel appointment |
| GET | /coaching/reports | coachCtrl.listReports | Yes | List coaching reports |
| GET | /coaching/reports/:callId | coachCtrl.getReportByCallId | Yes | Get report by call |
| GET | /coaching/digest | coachCtrl.getWeeklyDigest | Yes | Weekly digest |
| POST | /objections/handle | objectionCtrl.handleObjectionRoute | Yes | Handle objection |
| GET | /prompt-studio/:agentId | promptStudioCtrl.getPrompts | Yes | Get agent prompts |
| PUT | /prompt-studio/:agentId | promptStudioCtrl.savePrompts | Yes | Save agent prompts |
| POST | /prompt-studio/test | promptStudioCtrl.testPrompt | Yes | Test prompt with LLM |
| GET | /admin/profile | adminCtrl.getProfile | Yes (SUPER_ADMIN) | Get super admin profile |
| GET | /admin/stats | adminCtrl.stats | Yes (SUPER_ADMIN) | Platform-wide stats |
| GET | /admin/tenants | adminCtrl.allTenants | Yes (SUPER_ADMIN) | List all tenants |
| GET | /admin/tenants/:id | adminCtrl.tenantDetail | Yes (SUPER_ADMIN) | Tenant detail |
| PUT | /admin/tenants/:id | adminCtrl.updateTenant | Yes (SUPER_ADMIN) | Update tenant |
| DELETE | /admin/tenants/:id | adminCtrl.deleteTenant | Yes (SUPER_ADMIN) | Delete tenant + users |
| PUT | /admin/profile | adminCtrl.updateSuperAdmin | Yes (SUPER_ADMIN) | Update super admin |
| POST | /webhooks/twilio/inbound | webhookCtrl.inboundHandler | Twilio sig | Inbound call webhook |
| POST | /webhooks/twilio/outbound-handler | webhookCtrl.inboundHandler | Twilio sig | Outbound call webhook |
| POST | /webhooks/twilio/call-status | webhookCtrl.callStatusHandler | Twilio sig | Call status update |
| POST | /webhooks/twilio/gather | webhookCtrl.gatherHandler | Twilio sig | Speech gather handler |


---

## SECTION 4 — DATABASE SCHEMA AUDIT

### Models

**Tenant**
- id (uuid PK), name, phone, plan, googleAccessToken?, googleRefreshToken?, googleCalendarId?, createdAt
- Relations: TenantUser[], Agent[], Lead[], Call[], Appointment[], KnowledgeDoc[], Embedding[], Workflow[], CoachingReport[], PhoneNumber[], WorkflowLog[]

**User**
- id (uuid PK), name?, email (unique), passwordHash, createdAt
- Relations: TenantUser[]

**TenantUser** (join table)
- id (uuid PK), userId (FK→User), tenantId (FK→Tenant), role (SUPER_ADMIN|TENANT_ADMIN), createdAt
- Unique: [userId, tenantId]

**PhoneNumber**
- id, tenantId (FK→Tenant), number, label?, createdAt
- **Issue:** No `agentId` field — `inboundHandler` tries to read `phoneNumber?.agentId` which will always be undefined

**Agent**
- id, tenantId (FK→Tenant), name, personality, tone, language, systemPrompt, openingScript?, objectionScript?, voiceId, cloneVoiceId?, useClonedVoice (bool), agentType (default RECEPTIONIST), createdAt, deletedAt?
- Relations: Lead[], Call[], Appointment[], CoachingReport[]

**Lead**
- id, tenantId, agentId?, name, phone, email?, notes?, status (default PENDING), score?, scoreReason?, priority?, createdAt, deletedAt?
- Relations: Call[], Appointment[]

**Call**
- id, tenantId, agentId?, leadId?, direction, status, transcript?, sentiment?, sentimentScore?, analysis?, duration?, recordingUrl?, twilioSid? (unique), createdAt
- Relations: CoachingReport?

**Appointment**
- id, tenantId, leadId (required), agentId (required), calendarEventId?, scheduledAt, status (default PENDING), createdAt

**KnowledgeDoc**
- id, tenantId, fileName, content, createdAt
- Relations: Embedding[]

**Embedding**
- id, docId (FK→KnowledgeDoc), tenantId, chunkText, vector (vector(1536) — pgvector)

**Workflow**
- id, tenantId, name, trigger, conditions (Json), actions (Json), active (bool), createdAt, updatedAt
- Relations: WorkflowLog[]

**WorkflowLog**
- id, tenantId, workflowId, trigger, status, payload (Json), createdAt

**CoachingReport**
- id, callId (unique FK→Call), tenantId, agentId?, mistakes (Json), insights, weeklyDigest (bool), createdAt

### Usage Status
| Model | Used | Notes |
|---|---|---|
| Tenant | ✅ | Fully used |
| User | ✅ | Fully used |
| TenantUser | ✅ | Fully used |
| PhoneNumber | ⚠️ | Read only, no create/delete API, missing agentId field |
| Agent | ✅ | Fully used |
| Lead | ✅ | Fully used |
| Call | ✅ | Fully used |
| Appointment | ⚠️ | Created via workflow/calendar, reschedule/cancel only |
| KnowledgeDoc | ✅ | Fully used |
| Embedding | ✅ | Used for RAG |
| Workflow | ✅ | Fully used |
| WorkflowLog | ✅ | Written on every workflow execution |
| CoachingReport | ⚠️ | Read endpoints work, but `analyzeCall` never called — no auto-generation |


---

## SECTION 5 — FRONTEND COMPLETE AUDIT

### Pages

**Login** (`/login`)
- Calls: `POST /auth/login`
- State: email, password, error
- On success: decodes JWT, routes SUPER_ADMIN → `/super-admin`, others → `/dashboard`
- Status: FULLY WORKING

**Register** (`/register`)
- Calls: `POST /auth/register`
- State: name, orgName, email, password
- Status: FULLY WORKING

**Dashboard** (`/dashboard`)
- Calls: `/analytics/overview`, `/analytics/calls`, `/analytics/leads`
- Charts: LineChart (calls last 7 days), PieChart (lead status)
- **Issue:** Reads `overview.totalLeads`, `overview.totalAppointments` — these fields don't exist in API response (API returns `activeLeads`, `bookedAppointments`)
- **Issue:** `callStats.daily` doesn't exist — API returns array directly, not `{ daily: [] }`
- **Issue:** `leadStats.pending/qualified/booked` don't exist — API returns `[{ status, _count }]` array
- Status: PARTIALLY WORKING — renders but shows 0 for most stats

**Agents** (`/agents`)
- Calls: `GET /agents`, `DELETE /agents/:id`
- Uses `useAgents` hook, `SlideOver` + `AgentForm` components
- Status: FULLY WORKING

**Leads** (`/leads`)
- Calls: `GET /leads`, `POST /leads`, `PUT /leads/:id`, `DELETE /leads/:id`
- Features: pagination, bulk delete, country code selector, add/edit modal
- Status: FULLY WORKING

**Calls** (`/calls`)
- Calls: `GET /calls` (via `useCalls` hook)
- Features: active calls display, transcript expand, objection modal, filters (client-side only — filters don't affect API query)
- Status: PARTIALLY WORKING — filters are UI-only, not sent to API

**Analytics** (`/analytics`)
- Calls: `/analytics/overview`, `/analytics/calls`, `/analytics/sentiment`, `/analytics/agents`
- Charts: BarChart (agent performance), LineChart (sentiment trend)
- **Issue:** Overview cards show `handoffRate` and `objectionRate` which API doesn't return
- Status: PARTIALLY WORKING — charts render, some stats show 0

**Dialer** (`/dialer`)
- Calls: `GET /leads`, `GET /calls`, `GET /dialer/status`, `POST /dialer/start`, `POST /dialer/stop`
- Features: agent selector, start/stop campaign, lead table, status stats
- **Issue:** `status.running` is always false — API returns `{ data: { status: "running" } }` but component reads `statusRes.data.running`
- Status: PARTIALLY WORKING

**LiveCall** (`/live-call` or `/calls/live/:callId`)
- Socket events: transcript, caller_speaking, caller_stopped, human_handoff, objection_detected, sentiment
- Features: real-time transcript, sentiment indicator, wave animation, transfer button
- **Issue:** `activeCall` from `callStore` is never set anywhere — `activeCall?.twilioSid` will always be undefined on handoff
- Status: PARTIALLY WORKING — UI works, handoff broken

**KnowledgeBase** (`/knowledge-base`)
- Calls: `GET /upload/knowledge-docs`, `POST /upload/pdf`, `DELETE /upload/knowledge-docs/:id`
- Features: PDF upload, polling for chunk count, delete
- Status: FULLY WORKING

**Workflows** (`/workflows`)
- Calls: `GET /workflows`, `POST /workflows`, `PUT /workflows/:id`, `DELETE /workflows/:id`
- Features: drag-and-drop canvas builder, trigger/condition/action blocks
- Status: FULLY WORKING

**Coaching** (`/coaching`)
- Calls: `GET /coaching/reports`, `GET /coaching/digest`
- Features: report table, weekly digest panel, detail modal with mistakes
- Status: FULLY WORKING (but no data unless coaching reports are generated)

**Settings** (`/settings`)
- Calls: `GET /tenant/me`, `PUT /tenant/me`, `GET /calendar/status`, `GET /calendar/auth`, `POST /calendar/disconnect`, `GET /tenant/phone-numbers`
- Features: profile tab, calendar connect/disconnect, phone numbers list
- **Issue:** "Add Number" button has no functionality (no API call)
- Status: PARTIALLY WORKING

**PromptStudio** (`/prompt-studio`)
- Calls: `GET /prompt-studio/:agentId`, `PUT /prompt-studio/:agentId`, `POST /prompt-studio/test`
- Features: agent selector, 3 prompt editors, live chat test panel
- Status: FULLY WORKING

**SuperAdmin** (`/super-admin`)
- Calls: `/admin/stats`, `/admin/tenants`, `/admin/tenants/:id`, `/admin/profile`, PUT/DELETE admin endpoints
- Features: dashboard stats, tenant list with search, expand/edit/delete tenants, profile management
- Status: FULLY WORKING

---

### Reusable Components

| Component | What it does | Used in |
|---|---|---|
| `Layout.jsx` | Sidebar nav + main content wrapper | All pages |
| `ProtectedRoute.jsx` | Redirects to /login if not auth, role check | App.jsx |
| `AgentForm.jsx` | Create/edit agent form | Agents page |
| `SlideOver.jsx` | Slide-in panel from right | Agents page |
| `Toast.jsx` | Toast notification display | App.jsx (global) |
| `TranscriptView.jsx` | Renders call transcript | Calls page |
| `WorkflowForm.jsx` | Workflow form (appears unused — Workflows page has inline form) | Not used |


---

## SECTION 6 — DATA FLOW PIPELINES

### INBOUND CALL PIPELINE

```
1. Twilio dials tenant's number
2. POST /webhooks/twilio/inbound (validateTwilio middleware)
3. inboundHandler:
   - prisma.phoneNumber.findFirst({ where: { number: req.body.To } })
   - [BUG] phoneNumber.agentId doesn't exist in schema → agent = null always
   - prisma.call.create({ direction: INBOUND, status: INITIATED })
   - redis.set("call:{CallSid}", { callId, agentId, tenantId })
   - Returns TwiML: <Say> opening script + <Gather action="/webhooks/twilio/gather">

4. Caller speaks → Twilio STT → POST /webhooks/twilio/gather
5. gatherHandler:
   a. speechResult = req.body.SpeechResult
   b. ctx = redis.get("call:{CallSid}")
   c. ragContext = queryRAG(speechResult, tenantId)
      → embed(speechResult) via OpenAI text-embedding-3-small
      → $queryRawUnsafe cosine similarity on Embedding table
      → returns top 5 chunks joined
   d. agentModule = routeCall(speechResult, tenantId)
      → GPT-4o classifies: BOOKING|SALES|SUPPORT|FOLLOWUP
      → returns booking/sales/support/supervisor module
   e. aiReply = agentModule.handleTurn(speechResult, ragContext, agent)
      → GPT-4o with agent systemPrompt + RAG context
   f. [BUG] analyzeSentiment returns float, but code expects {sentiment, score} object
      → sentimentResult.sentiment = undefined, sentimentResult.score = undefined
   g. handleObjection(speechResult, tenantId) → GPT-4o JSON → ignored if error
   h. socket.emit("transcript", {role:"caller", text}) to tenant room
   i. socket.emit("transcript", {role:"ai", text}) to tenant room
   j. socket.emit("sentiment", {sentiment, score}) to tenant room
   k. prisma.call.update({ transcript, sentiment, sentimentScore })
   l. Returns TwiML: <Say> aiReply + <Gather> (loops back to step 4)

6. Call ends → POST /webhooks/twilio/call-status
7. callStatusHandler:
   - status=completed: update Call(status=COMPLETED, duration)
   - scoreCall(transcript, leadId, tenantId) → GPT-4o → update Lead.score → emit lead_scored
   - executeWorkflow("CALL_ENDED", data, tenantId)
   - status=failed/busy/no-answer: update Call(status=MISSED)
```

### OUTBOUND CALL PIPELINE

```
1. POST /dialer/start { agentId }
2. dialerCtrl.startDialer:
   - prisma.lead.findMany({ status: PENDING })
   - queue.add("outbound-call", { leadId, tenantId, agentId }) for each lead
   - redis.set("dialer:{tenantId}", "running")

3. BullMQ Worker (callWorker.js) picks up job:
   - prisma.lead.findUnique(leadId)
   - twilioClient.calls.create({ to: lead.phone, from: TWILIO_PHONE_NUMBER, url: SERVER_URL/webhooks/twilio/outbound-handler })
   - prisma.call.create({ direction: OUTBOUND, status: INITIATED })
   - prisma.lead.update({ status: CONTACTED })

4. Twilio calls lead → POST /webhooks/twilio/outbound-handler
   → Same as inboundHandler (same function)
   → Same gather loop as inbound
```

### AI RESPONSE PIPELINE

```
Speech Input
  → queryRAG(text, tenantId)
      → OpenAI text-embedding-3-small (1536 dims)
      → pgvector cosine similarity search
      → top 5 chunks
  → routeCall(text, tenantId)
      → GPT-4o: "Classify intent: BOOKING|SALES|SUPPORT|FOLLOWUP"
      → returns agent module
  → agentModule.handleTurn(text, ragContext, agentConfig)
      → systemPrompt = agentConfig.systemPrompt || default
      → userMessage = "Context:\n{ragContext}\n\nCaller said: {text}"
      → GPT-4o (gpt-4o model, text mode)
      → returns string reply
  → TwiML <Say voice="alice"> reply </Say>
```

### WORKFLOW AUTOMATION PIPELINE

```
Trigger event fires (e.g., CALL_ENDED from callStatusHandler)
  → executeWorkflow("CALL_ENDED", { phone, leadId, duration, sentiment }, tenantId)
  → prisma.workflow.findMany({ tenantId, active: true, trigger: "CALL_ENDED" })
  → For each workflow:
      → checkConditions(wf.conditions, data)
          → evaluates: equals, greater_than, less_than, score_gte, score_lte
      → If conditions pass, execute actions:
          → SEND_SMS: twilioClient.messages.create()
          → BOOK_MEETING: prisma.appointment.create()
          → UPDATE_LEAD_STATUS: prisma.lead.update({ status })
          → NOTIFY_TEAM: socket.emit("team_notification")
      → prisma.workflowLog.create({ status: SUCCESS|FAILED, payload })
```

---

## SECTION 7 — THIRD PARTY INTEGRATIONS STATUS

| Integration | Connected | Functions | Breaks if missing | Error handling |
|---|---|---|---|---|
| **OpenAI** | ✅ Key set | `chat()`, `getReply()`, `streamChat()`, `embed()` | LLM, RAG, sentiment, scoring, coaching, objections, routing all fail | Warns on startup if missing, uses "placeholder" key (will 401) |
| **Twilio Voice** | ✅ Key set | `twilioClient.calls.create()`, `.update()`, `validateRequest()` | Inbound/outbound calls, SMS, handoff all fail | Verified on startup |
| **Twilio SMS** | ✅ (same creds) | `twilioClient.messages.create()` in workflow.js | SEND_SMS workflow action fails | try/catch with console.error |
| **ElevenLabs** | ✅ Key set | `synthesize()` in tts.js | TTS synthesis fails, returns null | Returns null if client not initialized |
| **Deepgram** | ✅ Key set | `startLiveSession()`, `sendAudio()`, `stopLiveSession()` | Live transcription fails | Error handler closes connection |
| **Google Calendar** | ✅ Keys set | `getAuthUrl()`, `handleCallback()`, `getSlots()`, `bookSlot()`, `createEvent()` | Calendar features fail | try/catch, throws errors |
| **BullMQ + Redis** | ✅ Running | `queue.add()`, Worker | Outbound dialer fails | Worker wrapped in try/catch, null if Redis down |

**Note:** ElevenLabs and Deepgram are fully implemented but not connected to the active call pipeline (media stream is skipped). Twilio's built-in `<Say voice="alice">` is used for TTS and `<Gather input="speech">` for STT.

