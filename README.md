# Project Atlas: AI-first customer support

Atlas is a working support desk for a fictional smart-ring brand, **Atlas Ring**. It pairs an AI chatbot that answers customers on its own with a ticket desk where agents pick up whatever the bot can't solve, and it measures how well that split works.

I built it to explore one question that every support team faces: **how do you cut ticket volume with AI without making the customer experience worse?**

**Live demo**
- Customer chatbot (no login): https://project-atlas-pied.vercel.app/support
- Agent desk: https://project-atlas-pied.vercel.app (invite-only login; ask me for a demo account)

---

## The problem

Most support queues are full of repeat questions: "my ring won't sync", "how long does the battery last", "what's your return policy". Agents spend their time on answers that already exist in a help article, while customers with real problems wait longer.

A chatbot can absorb that volume, but only if it:

1. **answers correctly**, with no invented policies or promises,
2. **knows when to stop** and hand over to a person, with the context attached, and
3. **gets measured**, so the team can see whether it actually helps and what to fix next.

## What it does

### For customers: self-service chat
- Customers give their name and email, then ask questions in plain language.
- The bot answers **only from published help articles** and shows which article it used.
- If the articles don't cover the question, it says so instead of guessing.
- It never promises refunds, replacements or exceptions.
- After each chat, the customer rates it from 1 to 5 stars, with an optional comment.

### Handover to a human
The bot passes the chat to an agent when:
- no article answers the question,
- the request needs a staff action (looking up an order, approving a return or warranty claim),
- the customer asks for a person, or
- the customer is upset, or has said twice that the steps didn't help.

A handover creates a ticket with the **full chat transcript**, a one-line reason for the agent, and a priority based on the customer's sentiment. The customer never has to repeat themselves.

### For agents: the ticket desk
- Sign in with your own account. It's invite-only, and every reply and change records who made it.
- Ticket queue with search and filters, status, priority and assignment.
- **AI Copilot** on each ticket: Gemini summarises the issue, detects intent and sentiment, and drafts a reply for the agent to edit.
- Private **internal notes** for the team.
- A **New Ticket** form for phone, email and walk-in requests, with AI summary and intent filled in automatically.

### For the CX lead: measurement and improvement
- **Dashboard:** open tickets, urgent backlog, average first response time, channel mix and agent workload, all from live data.
- **Chatbot panel:**
  - **deflection rate**, the share of chats solved without a ticket,
  - handovers and top topics,
  - **chat CSAT**, split into *AI-solved* and *handed-over* chats, which answers whether the bot hurts satisfaction.
- **Knowledge Gaps report:** every handover grouped by reason. Questions with no matching article are listed by topic, each with a **Write article** button.
- **Knowledge Base editor:** agents add, edit and unpublish articles, and the bot uses the changes immediately.

## The improvement loop

```
Customer asks → Bot answers from articles ──→ Solved (counts toward deflection)
                       │
                       └─ can't answer → Ticket with transcript → Agent resolves
                                               │
                                  Knowledge Gaps report shows the question
                                               │
                                  Agent writes the missing article
                                               │
                                  Next customer with that question is answered by the bot
```

This loop is the core idea. The bot doesn't need to be perfect on day one. It needs to show the team exactly what to teach it next.

## Design decisions

| Decision | Why |
|---|---|
| Answer only from articles | A wrong confident answer costs more trust than "let me get a person". |
| Hand over early when the customer is upset | Deflection that creates angry customers isn't a win. |
| Transcript on every handover | Making customers repeat themselves is one of the most common complaints in support. |
| CSAT split by outcome | Average CSAT can hide a bot that frustrates people. The split shows it. |
| Gaps grouped by reason | "No article" is a content fix; "needs staff" may be a process or policy fix. They need different owners. |
| Agents edit the knowledge base | The support team, not engineers, should own what the bot says. |

## Metrics tracked

| Metric | Where |
|---|---|
| Deflection rate (chats solved without a ticket) | Dashboard → AI Chatbot |
| Handovers by reason | Knowledge Gaps |
| Chat CSAT, overall / AI-solved / handed over | Dashboard → AI Chatbot |
| CSAT response rate | Dashboard → AI Chatbot |
| Open backlog by priority, escalations, unassigned | Dashboard |
| Average time to first agent reply | Dashboard |
| Workload per agent | Dashboard |

## Tech stack

- **Next.js 16** (App Router, Server Actions) on **Vercel**
- **Supabase** for Postgres and Auth
- **Google Gemini** (`gemini-3.5-flash-lite`, free tier) with structured JSON output for the chatbot and the agent copilot
- **Tailwind CSS**
- Built with **Claude Code** as an AI pair programmer

## Run it locally

1. Create a free [Supabase](https://supabase.com) project. In **SQL Editor**, run `supabase/schema.sql`, then each file in `supabase/migrations/` in order.
2. Get a free Gemini API key from [Google AI Studio](https://aistudio.google.com).
3. Copy `.env.example` to `.env.local` and fill in `GEMINI_API_KEY`, `SUPABASE_URL` and `SUPABASE_SECRET_KEY`.
4. Create an agent account in Supabase: **Authentication → Users → Add user**, and tick **Auto Confirm User**.
5. Run the app:

   ```bash
   npm install
   npm run dev
   ```

Then open http://localhost:3000 for the agent desk, or http://localhost:3000/support for the customer chat.

## What I'd build next

- **Email channel:** send agent replies to customers by email, and turn incoming emails into tickets.
- **Order lookup:** let the bot answer "where is my order?" itself, the most common staff-action handover.
- **Weekly gap digest:** email the CX lead the top unanswered questions every Monday.
- **SLA timers and escalation rules** on tickets.

---

*Atlas Ring is a fictional brand. All help articles and demo data are made up.*
