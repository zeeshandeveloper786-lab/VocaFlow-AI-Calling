## SECTION 8 — FEATURE WORKING STATUS

| Feature | Status | Notes |
|---|---|---|
| User Registration and Login | FULLY WORKING | JWT pair, bcrypt, tenant creation |
| JWT Authentication | FULLY WORKING | 15m access + 7d refresh, DB lookup on every request |
| Multi-tenant Isolation | FULLY WORKING | tenantId enforced on all queries |
| AI Agent Builder | FULLY WORKING | Full CRUD, Zod validation |
| Knowledge Base Upload and RAG | FULLY WORKING | Requires OPENAI_API_KEY |
| Appointment Booking | PARTIALLY WORKING | Slot logic bug (returns busy instead of free) |
| Google Calendar Sync | PARTIALLY WORKING | OAuth works, slot bug exists |
| Outbound Auto Dialer | PARTIALLY WORKING | Queue works, stop doesn't drain queue |
| Inbound AI Receptionist | PARTIALLY WORKING | Call flow works, agent lookup broken, sentiment crash |
| Real-time Transcription | NOT WORKING | Deepgram code exists but media stream not connected |
| Sentiment Analysis | PARTIALLY WORKING | Stored in DB but return type mismatch causes undefined values |
| Objection Handling | PARTIALLY WORKING | Detection works, socket event not emitted |
| CRM Lead Management | FULLY WORKING | Full CRUD, scoring, hot leads |
| Multi-Agent Routing | FULLY WORKING | LLM-based routing to 3 agent types |
| Human Handoff | FULLY WORKING | Twilio call update + socket event |
| Analytics Dashboard | PARTIALLY WORKING | Data exists, field name mismatches with frontend |
| AI Prompt Studio | FULLY WORKING | Edit + test prompts live |
| Workflow Automation | FULLY WORKING | 4 action types, condition evaluation, logging |
| AI Call Scoring | FULLY WORKING | Auto-triggered on call end, requires OPENAI_API_KEY |
| Coaching Reports | PARTIALLY WORKING | Read works, auto-generation never triggered |
| Live Call Page | PARTIALLY WORKING | UI works, activeCall store never populated |
| WebSocket Real-time Events | MOSTLY WORKING | Most events work, objection_detected missing |
| Docker Setup | FULLY WORKING | 4 containers, health checks, volume mounts |

---

## SECTION 9 — KNOWN ISSUES AND BUGS

### Critical Bugs

1. **`sentiment.js` return type mismatch** (`server/src/lib/sentiment.js`)
   - `analyzeSentiment()` returns a plain `number` (float)
   - `webhookCtrl.js` gatherHandler destructures it as `{ sentiment, score }` → both undefined
   - Fix: return `{ sentiment: score > 0.6 ? 'POSITIVE' : score < 0.4 ? 'NEGATIVE' : 'NEUTRAL', score }`

2. **`PhoneNumber` model missing `agentId`** (`server/prisma/schema.prisma`)
   - `inboundHandler` reads `phoneNumber?.agentId` → always undefined
   - Agent is never loaded for inbound calls → opening script always default
   - Fix: add `agentId String?` and relation to `PhoneNumber` model + migration

3. **`getSlots` inverted logic** (`server/src/lib/gcal.js` line ~100)
   - `if (!isFree)` pushes slot → returns BUSY slots, not free ones
   - Fix: change to `if (isFree)`

4. **Duplicate route mounting** (`server/src/app.js`)
   - `app.use('/auth', router)` AND `app.use(router)` both mount the full router
   - Every route is accessible at two paths (e.g., `/auth/agents` and `/agents`)
   - Fix: remove `app.use('/auth', router)` or scope it to auth routes only

5. **`stopDialer` doesn't stop jobs** (`server/src/controllers/dialerCtrl.js`)
   - Only sets Redis flag, doesn't drain BullMQ queue
   - Fix: `await queue.drain()` or `await queue.obliterate()`

6. **`analyzeCall` never called** (`server/src/lib/coach.js`)
   - Coaching reports never auto-generated
   - Fix: call `analyzeCall(call.id, call.tenantId)` in `callStatusHandler` after call completes

7. **`objection_detected` socket event never emitted**
   - Frontend `LiveCall.jsx` listens for `objection_detected` but server never emits it
   - Fix: emit from `gatherHandler` when objection is detected

### Frontend Data Mismatches

8. **Dashboard `overview` field names wrong** (`client/src/pages/Dashboard.jsx`)
   - Reads: `overview.totalLeads`, `overview.totalAppointments`
   - API returns: `activeLeads`, `bookedAppointments`

9. **Dashboard `callStats.daily` doesn't exist**
   - API returns array directly, not `{ daily: [] }`

10. **Dashboard `leadStats.pending/qualified/booked` don't exist**
    - API returns `[{ status, _count: { id } }]` array

11. **Dialer `status.running` always false** (`client/src/pages/Dialer.jsx`)
    - API returns `{ success: true, data: { status: "running" } }`
    - Component reads `statusRes.data.running` → undefined → always false

12. **`activeCall` store never populated** (`client/src/store/callStore.js`)
    - `LiveCall.jsx` reads `activeCall?.twilioSid` for handoff
    - `setActiveCall` / `addActiveCall` never called anywhere in codebase

### Missing Error Handling

13. **`appointmentCtrl.js`** — no ownership check before update/cancel (any authenticated user can modify any appointment by ID)

14. **`adminCtrl.tenantDetail`** — no null check if tenant not found → will crash with `Cannot read properties of null`

15. **`promptStudioCtrl.testPrompt`** — no auth check on systemPrompt content (any user can test any prompt)

16. **`webhookCtrl.inboundHandler`** — if `tenantId` is null (unknown phone number), creates Call with `tenantId: "unknown"` which will fail FK constraint

### Empty/Placeholder Code

17. **`WorkflowForm.jsx`** — component exists but is never imported or used anywhere

18. **Settings "Add Number" button** — renders but has no onClick handler or API call

19. **`server/src/lib/mediaStream.js`** — file exists but media stream is explicitly skipped in `index.js`

20. **`server/audit.mjs` and `server/audit2.mjs`** — debug/audit scripts left in repo root

---

## SECTION 10 — ENVIRONMENT VARIABLES

| Variable | Service | Set in .env | Notes |
|---|---|---|---|
| `DATABASE_URL` | PostgreSQL (Prisma) | ✅ `postgresql://postgres:123456@db:5432/VocaFlow` | Docker internal URL |
| `DIRECT_URL` | PostgreSQL (Prisma adapter) | ✅ `postgresql://postgres:123456@db:5432/VocaFlow` | Must be `db:5432` inside Docker |
| `JWT_SECRET` | JWT access tokens | ✅ Set | 43-char random string |
| `JWT_REFRESH_SECRET` | JWT refresh tokens | ✅ Set | 64-char hex string |
| `REDIS_URL` | Redis / BullMQ | ✅ `redis://redis:6379` | Docker internal URL |
| `PORT` | Express server | ✅ `3001` | |
| `SERVER_URL` | Twilio webhook base URL | ✅ `http://localhost:3001` | **Must be public URL for Twilio webhooks** — localhost won't work in production |
| `HUMAN_AGENT_NUMBER` | Handoff destination | ✅ `+19789714887` | |
| `GOOGLE_CLIENT_ID` | Google OAuth | ✅ Set | |
| `GOOGLE_CLIENT_SECRET` | Google OAuth | ✅ Set | |
| `DEEPGRAM_API_KEY` | Deepgram STT | ✅ Set | Not connected to call pipeline |
| `ELEVENLABS_API_KEY` | ElevenLabs TTS | ✅ Set | Not connected to call pipeline |
| `TWILIO_ACCOUNT_SID` | Twilio | ✅ Set | |
| `TWILIO_AUTH_TOKEN` | Twilio | ✅ Set | |
| `TWILIO_PHONE_NUMBER` | Twilio outbound caller ID | ✅ `(978) 971-4887` | **Format issue** — should be E.164 format `+19789714887` not `(978) 971-4887` |
| `OPENAI_API_KEY` | OpenAI LLM + embeddings | ✅ Set | Required for all AI features |

### Missing Variables (not in .env but may be needed)
| Variable | Where needed | Notes |
|---|---|---|
| `ELEVENLABS_VOICE_ID` | `tts.js` | Falls back to hardcoded `21m00Tcm4TlvDq8ikWAM` |
| `VITE_API_URL` | Frontend axios + socket | Falls back to `http://localhost:3001` |

---

## SUMMARY

**Total Routes:** 54 API endpoints + 4 webhook endpoints

**Working well:** Auth, Agent CRUD, Lead CRM, Workflow Automation, Prompt Studio, Knowledge Base, Super Admin, Docker setup

**Needs fixes:** Sentiment return type (critical crash), PhoneNumber agentId (agent never loaded), Calendar slot logic, Dashboard data mapping, Dialer status reading, Coaching auto-generation

**Not connected:** Deepgram live transcription, ElevenLabs TTS (Twilio alice voice used instead)

**Routing bug:** Double router mount causes all routes accessible at two paths
