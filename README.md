# 🎙️ VocaFlow AI Calling Platform

VocaFlow is an enterprise-grade, low-latency AI-powered conversational voice agent and automated dialer system. It automates inbound receptionist routing, outbound sales call campaigns, booking appointments, customer support, and lead qualification using state-of-the-art LLMs, real-time audio WebSockets, and advanced speech interfaces.

---

## 🚀 Key Features

* **⚡ Real-time Low-Latency Audio Streaming**: Seamless bidirectional raw audio streaming using Twilio Media Streams and WebSockets.
* **🧠 Dynamic Conversational Brain**: Driven by OpenAI (GPT-4o-mini) with specialized prompts customized per agent role.
* **📞 Low-Latency Voice Interface**: 
  * **Deepgram STT**: Live voice streaming Speech-to-Text transcription with active conversational interruption handling.
  * **ElevenLabs TTS**: Premium high-fidelity text-to-speech voice generation.
* **📚 Intelligent Vector RAG Integration**: Integrates document upload (PDF/Docx) and indexes embeddings dynamically into PostgreSQL using `pgvector` for instant knowledge base lookups.
* **📈 Automated Dialer Campaigns**: Bulk outbound dialing scheduled and processed in background tasks using Redis queues and BullMQ workers.
* **🛡️ Enterprise Fault-Tolerance**: Built-in resilient design patterns using **Circuit Breakers** and automatic API retry strategies.
* **📊 Live Call Tracker & Coaching Panel**: Supervise calls in real-time, view live conversation waveforms, and generate analytical post-call coaching reviews.

---

## 🛠️ Technology Stack

### Backend
- **Node.js & Express** (HTTP Rest APIs & WebSockets)
- **Prisma ORM** (Database schemas, models, and migrations)
- **PostgreSQL + pgvector** (Relational & vector embedding database storage)
- **Redis & BullMQ** (Job queues for batch dialer loops)
- **Twilio SDK** (Voice calling and media stream sockets)

### Frontend
- **React + Vite** (High-speed single page app setup)
- **Tailwind CSS** (Premium modern responsive layout styling)
- **Zustand** (Global lightweight reactive client stores)
- **Socket.io-client** (Real-time dashboard state listeners)

---

## ⚙️ Quick Start Installation

### Prerequisites
Make sure you have node (>= 18), PostgreSQL (with public.vector extension), and a running Redis instance.

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/zeeshandeveloper786-lab/VocaFlow-AI-Calling.git
   cd VocaFlow-AI-Calling
   ```

2. **Configure Environment Variables**:
   Copy the `.env.example` file to `.env` in the `server` directory and fill in your credentials:
   ```bash
   cp .env.example server/.env
   ```

3. **Install Dependencies**:
   * Root: `npm install`
   * Backend Server: `cd server && npm install`
   * Frontend Client: `cd ../client && npm install`

4. **Initialize Database**:
   ```bash
   cd ../server
   npx prisma migrate dev
   ```

5. **Start Development Servers**:
   * Server: `npm run dev`
   * Client: `cd ../client && npm run dev`
