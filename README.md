<div align="center">

<img src="assets/logo.png" alt="Freeroute Logo" width="120" style="border-radius: 20px; margin-bottom: 16px;" />

# Freeroute

**Universal AI Gateway & LLMOps Control Plane**

High-performance, OpenAI-compatible AI gateway with multi-tier failover combos, live model catalogs, 14+ CLI tool auto-configurators, and persistent local storage.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-15-black.svg)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-SQLite-2D3748.svg)](https://www.prisma.io/)
[![OpenAI Compatible](https://img.shields.io/badge/API-OpenAI%20Compatible-green.svg)](https://platform.openai.com/docs/api-reference)

</div>

---

## 🌟 Overview

**Freeroute** is a self-hosted AI Gateway and LLMOps control plane designed for developers, engineering teams, and AI power users. It acts as a single, unified endpoint (`http://localhost:20128/v1`) that connects your local applications and developer tools to any AI model provider with automatic failovers, intelligent load balancing, cost tracking, and 1-click CLI tool integrations.

Your credentials, models, combos, and telemetry are safely stored in your user directory (`~/.freeroute/freeroute.db`), ensuring your data persists seamlessly across application updates, git pulls, and rebuilds.

---

## 📸 Screenshots

### 1. Main Dashboard
Unified view of real-time request volume, TTFT latency, estimated spend, and active providers.
![Main Dashboard](assets/screenshots/dashboard.png)

### 2. Intelligent Routing Combos
Group multiple models into smart virtual endpoints with failover, round-robin, weighted, or latency-based routing.
![Intelligent Combos](assets/screenshots/combos.png)

### 3. Multi-Tier Fallback Configuration
Visual priority tiers: if Tier 1 times out or errors (e.g. rate limit, 5xx), Freeroute seamlessly fails over to Tier 2 in milliseconds.
![Combo Modal](assets/screenshots/combo-modal.png)

### 4. Curated Providers Catalog
Connect industry-standard AI providers with a single API key: Groq, Experiential Labs, Google Gemini, NVIDIA NIM, Ollama Cloud, OpenRouter, and KiosAPI.
![Providers Catalog](assets/screenshots/providers.png)

### 5. 14+ CLI & Developer Tools Hub
Directly configure Claude Code, Cursor, Windsurf, Continue.dev, Cline, Roo Code, Aider, OpenCode, Goose, and more.
![CLI Tools Hub](assets/screenshots/cli-tools.png)

### 6. CLI Custom Model Settings
Inspect and customize models, combos, and environment tokens before applying them to your developer environments.
![CLI Tool Settings](assets/screenshots/cli-settings-modal.png)

### 7. Activitys & Telemetry
Full visibility into incoming requests, TTFT, tokens per second, status codes, and error traces.
![Activitys Dashboard](assets/screenshots/activitys.png)

### 8. Database & Backup Management
Inspect active SQLite storage (`~/.freeroute/freeroute.db`), monitor entity counts, and export/restore 1-click JSON backups.
![Database & Backup](assets/screenshots/database-backup.png)

---

## 🚀 Key Features

- **⚡ Universal OpenAI Compatibility**: Drop-in replacement for OpenAI API endpoints (`/v1/chat/completions`, `/v1/models`). Works with official OpenAI SDKs, LangChain, LlamaIndex, LiteLLM, and any cURL client.
- **🔀 Resilient Combos & Fallbacks**: Define prioritized fallback tiers across providers. Never experience downtime due to rate limits (429), provider outages (500/503), or quota exhaustion.
- **🛠️ 14+ Developer Tools Integrations**: 1-click configuration injector for:
  - Claude Code
  - Cursor
  - Windsurf
  - Continue.dev
  - Cline
  - Roo Code
  - Aider
  - OpenCode
  - Goose
  - OpenInterpreter
  - LibreChat
  - Promptfoo
  - Bolt.diy
  - Ollama
- **🏢 Curated AI Providers**:
  - [Groq](https://groq.com)
  - [Experiential Labs](https://platform.experientiallabs.ai/)
  - [Google Gemini](https://ai.google.dev/)
  - [NVIDIA NIM](https://build.nvidia.com)
  - [Ollama Cloud](https://ollama.ai)
  - [OpenRouter](https://openrouter.ai)
  - [KiosAPI](https://kiosapi.com/v1/) ([Docs](https://kiosapi.mintlify.app/))
- **🔒 Persistent User Storage**: Stored outside project source code in `~/.freeroute/freeroute.db` (`C:\Users\<user>\.freeroute\freeroute.db` on Windows).
- **💾 1-Click Backup & Restore**: Export your full database state (keys, providers, combos, settings) to a portable JSON backup and restore it anywhere.
- **📊 Real-Time Activity Telemetry**: Monitor latency, TTFT, token throughput, live costs, and request status in the **Activitys** dashboard.

---

## 🏗️ Architecture & How It Works

```
                     +-----------------------------------+
                     |  Developer Tools / Apps / cURL   |
                     | (Claude Code, Cursor, Python SDK)|
                     +-----------------+-----------------+
                                       |
                                       | HTTP POST /v1/chat/completions
                                       v
                     +-----------------------------------+
                     |       FREEROUTE AI GATEWAY        |
                     |        (Port :20128)             |
                     +-----------------+-----------------+
                                       |
            +--------------------------+--------------------------+
            |                          |                          |
            v                          v                          v
   [Authentication]            [Combo Resolver]           [Telemetry Logger]
   SHA-256 API Key             Failover & Strategy        TTFT, Tokens/s, Cost
   Validation                  Tier 1 -> Tier 2           Saved to Activitys
            |                          |                          |
            +--------------------------+--------------------------+
                                       |
                   +-------------------+-------------------+
                   |                                       |
                   v                                       v
         [Tier 1: Primary Model]               [Tier 2: Fallback Model]
         e.g., Groq LLaMA 3.3 70B              e.g., Gemini 2.0 Flash
         (If 429/500/timeout) -------- failover ------> (Success 200 OK)
                   |                                       |
                   +-------------------+-------------------+
                                       |
                                       v
                     +-----------------------------------+
                     |  Streamed OpenAI-Compatible Resp  |
                     +-----------------------------------+
```

---

## 📦 Installation & Setup

### Prerequisites
- **Node.js**: `v18.0.0` or higher
- **npm** or **pnpm**

### Step-by-Step Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/neuralnexustech/freeroute.git
   cd freeroute
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Zero-Config Database (No `.env` required):**
   Freeroute automatically creates and connects to your local database in `~/.freeroute/freeroute.db` without needing any `.env` file!
   *(Optional)* If you wish to customize the port or settings:
   ```bash
   cp .env.example .env
   ```

4. **Initialize the Database:**
   ```bash
   npx prisma db push
   npm run db:seed
   ```

5. **Start the Development Gateway:**
   ```bash
   npm run dev
   ```

   Open [http://localhost:20128](http://localhost:20128) in your browser to access the Freeroute Dashboard.

---

## 💻 Quick Usage Guide

### 1. Connect a Provider
1. Open **Dashboard → Providers**.
2. Click on a provider (e.g. **OpenRouter**, **Groq**, or **KiosAPI**).
3. Enter your API key and click **Save**.
4. Click **Pull Models** to fetch all available models into your catalog.

### 2. Create a Gateway API Key
1. Open **Dashboard → API Keys**.
2. Click **Create API Key**, enter a label (e.g., `my-coding-agent`), and copy your key (`xpl_...`).

### 3. Configure a Fallback Combo
1. Open **Dashboard → Combos** → Click **Create Combo**.
2. Name your combo (e.g., `smart-coding-fallback`).
3. Set strategy to **Failover**.
4. Add **Tier 1** (e.g. fast free model) and **Tier 2** (e.g. fallback high-capacity model).
5. Click **Create Combo**.

### 4. Send Requests to the Gateway

#### Using cURL:
```bash
curl http://localhost:20128/v1/chat/completions \
  -H "Authorization: Bearer xpl_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "smart-coding-fallback",
    "messages": [
      {"role": "system", "content": "You are a helpful coding assistant."},
      {"role": "user", "content": "Write a python script to parse CSV files."}
    ]
  }'
```

#### Using Python (OpenAI SDK):
```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:20128/v1",
    api_key="xpl_your_api_key_here"
)

response = client.chat.completions.create(
    model="smart-coding-fallback",  # Can be a combo or single model slug
    messages=[
        {"role": "user", "content": "Hello from Freeroute!"}
    ]
)

print(response.choices[0].message.content)
```

#### Using Node.js (OpenAI SDK):
```typescript
import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: "http://localhost:20128/v1",
  apiKey: "xpl_your_api_key_here",
});

async function main() {
  const completion = await openai.chat.completions.create({
    model: "smart-coding-fallback",
    messages: [{ role: "user", content: "Explain async/await in JavaScript" }],
  });

  console.log(completion.choices[0].message.content);
}

main();
```

---

## 💾 Database & Backups

Freeroute stores your configuration in an independent user directory:
- **Windows**: `C:\Users\<username>\.freeroute\freeroute.db`
- **Linux / macOS**: `~/.freeroute/freeroute.db`

### 1-Click Backups
- Go to **Dashboard → Settings → Database & Backup**.
- Click **Export Backup (.json)** to download your complete database snapshot.
- To restore or migrate to a new machine, click **Upload Backup File (.json)** and select your backup file.

---

## 🏢 About Neural Nexus Tech

[Neural Nexus Tech](https://www.neuralnexustech.com/) is an engineering and AI research laboratory building next-generation developer tooling, high-availability AI gateways, LLMOps orchestration frameworks, and intelligent autonomous workflows.

- **Website**: [https://www.neuralnexustech.com/](https://www.neuralnexustech.com/)
- **GitHub**: [https://github.com/neuralnexustech](https://github.com/neuralnexustech)

---

## 🛡️ License

This project is distributed under the **MIT License with Attribution Requirement**. You are free to use, modify, and distribute this software, provided you retain attribution to the original author.

See [LICENSE](LICENSE) for full terms.

---

<div align="center">

### Powered by [(neuralnexustech)](https://github.com/neuralnexustech) · [neuralnexustech.com](https://www.neuralnexustech.com/)

</div>
