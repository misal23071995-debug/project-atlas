# Project Atlas: a support operations platform

Atlas is a multi-company support desk built the way a CX lead would want one. It covers the whole operation, not just the inbox:

- **Channels:** an AI chatbot, email, and tickets logged by hand.
- **Running the team:** SLA tracking, quality checks (QC), training, rostering and capacity planning.
- **Reporting:** dashboards and reports that tie it all together.

The demo company is a fictional smart-ring brand, **Atlas Ring**.

I built it around one question every support team faces: **how do you handle more customers, faster, without the quality of support slipping?** Each module answers part of that, and they feed each other. QC scores assign training. The ticket forecast sets the staffing target. Bot handovers show which help articles to write next.

**Live demo**
- Customer chat (no login): https://project-atlas-pied.vercel.app/support/atlas-ring
- Agent desk: https://project-atlas-pied.vercel.app. Sign up to create your own workspace, then **Settings → Demo data → Load demo data** to fill it with 90 days of realistic activity.

---

## Modules

| Module | What it does |
|---|---|
| **AI chatbot** | Answers customers only from published help articles and shows which article it used. Hands over to a person when it can't help, with the full transcript attached. Collects a star rating after each chat. |
| **Email** | Incoming emails become tickets, and the AI fills in summary, category and sentiment. Customer replies land on the same ticket, and reopen it if it was closed. Agent replies go out by email. Customers get an automatic acknowledgement with their ticket number, and a survey link when the ticket is resolved. |
| **Ticket desk** | Queue with search and filters, priority, status and assignment. Internal notes and a full activity log. An AI copilot that drafts replies. Saved replies with placeholders such as the customer's name and the survey link. |
| **SLA tracking** | First-reply and resolution targets for each priority. Each ticket shows a live countdown: on track, at risk, breached, or paused while waiting on the customer. Breaches and at-risk tickets appear on the dashboard. |
| **CSAT** | A private survey link on every ticket, plus ratings at the end of bot chats. Shown on the ticket, per agent and in Reports. |
| **Quality (QC)** | An editable, weighted scorecard. The AI scores a conversation first; a QA analyst or lead checks it and finalises the score. Results are broken down by agent and by criterion. |
| **Training** | Courses with a lesson and a quiz. The AI can write the quiz questions. Leads assign courses with due dates. **A low QC score on a criterion assigns the linked course automatically.** |
| **Rostering** | Weekly shift calendar with shift templates, breaks and overnight shifts. Agents request leave and leads approve it. |
| **Capacity planning** | Forecasts contacts per hour from ticket history, works out the agents needed with **Erlang C** plus shrinkage, and lays it over the roster as a heat map of staffing gaps. |
| **Reports** | Any date range, compared with the period before. Covers volume trend, first reply and resolution times (median and average), SLA met %, CSAT, agents, channels, contact reasons, QC, bot deflection and training. Every table downloads as CSV. |
| **Workspaces and roles** | Each company has its own private workspace. Each person has a role: Admin, Team Lead, Agent or QA Analyst. Each role sees and can change only what it should. |

## How the pieces connect

```
Contacts arrive (chat, email, phone) ──→ Tickets with SLA clocks ──→ Agents resolve, customer rates it
        │                                         │                              │
  Bot can't answer                     Ticket history forecasts             QC scores the conversation
        │                                 volume per hour                           │
 Knowledge Gaps report                            │                       Low score on a criterion
        │                             Erlang C → agents needed                      │
 Team writes the article                          │                     Training course auto-assigned
        │                          Roster gaps show where to add shifts             │
 Bot answers it next time                                                Agent passes the quiz
```

Reports pull from every one of these, so a lead can see the whole loop in one place.

## Design decisions

| Decision | Why |
|---|---|
| The bot answers only from articles | A confident wrong answer costs more trust than "let me get a person". |
| Every handover carries the transcript | Making customers repeat themselves is one of the most common complaints in support. |
| SLA due times are fixed when a ticket is created | Changing the targets later shouldn't rewrite last month's results. |
| The SLA clock pauses on "Waiting on Customer" | Agents shouldn't be penalised for time the customer takes to reply. |
| The AI scores QC first, a person finalises it | It's fast enough to review more conversations, and a person remains accountable for each score. The report shows how far the AI's scores differ from the final ones. |
| QC feeds training directly | Coaching happens when the gap is found, not at the next monthly review. |
| Capacity uses Erlang C, not "tickets ÷ agents" | Queues don't scale linearly. Erlang C is the standard contact-centre staffing model. |
| Only a ticket's own customer can reply onto it by email | A guessed ticket number can't be used to post into someone else's ticket. |
| AI and email providers are swappable | Gemini's free tier and a "not connected" email mode let it run at no cost. Moving to a paid model or a real mail provider is a configuration change. |
| Demo data is tagged and removable | A realistic demo without polluting real data. |

## Metrics tracked

| Metric | Where |
|---|---|
| First reply and resolution time, median and average | Reports, Dashboard |
| SLA met %, breached and at-risk tickets now | Reports, Dashboard, ticket inbox |
| CSAT, from ticket surveys and bot chats, overall and per agent | Reports, ticket page |
| Bot deflection rate and handover reasons | Reports, Dashboard, Knowledge Gaps |
| QC average, by agent and by criterion | Quality, Reports |
| Training passed and overdue | Training, Reports |
| Contacts by channel and by contact reason | Reports |
| Agents needed vs rostered, per hour | Capacity |

## Roles

| | Admin | Team Lead | Agent | QA Analyst |
|---|:-:|:-:|:-:|:-:|
| Work tickets | ✓ | ✓ | ✓ | |
| Internal notes | ✓ | ✓ | ✓ | ✓ |
| Score quality | ✓ | ✓ | | ✓ |
| Build the roster, approve leave | ✓ | ✓ | | |
| Capacity, SLA targets, saved replies, email settings | ✓ | ✓ | | |
| Write and assign training | ✓ | ✓ | | ✓ |
| See team reports | ✓ | ✓ | | ✓ |
| Team members, workspace settings, demo data | ✓ | | | |

## Tech stack

- **Next.js 16** (App Router, Server Actions) on **Vercel**
- **Supabase**: Postgres and Auth. The server checks the workspace and role on every request.
- **Google Gemini** (`gemini-3.5-flash-lite`, free tier) with structured JSON output. It powers the chatbot, the copilot, QC scoring, quiz writing and reading emails.
- **Resend** for outgoing email (optional). Incoming email arrives through a per-workspace webhook that accepts Postmark's format, or simple JSON from any other provider.
- **Tailwind CSS**
- Built with **Claude Code** as an AI pair programmer

## Run it locally

1. Create a free [Supabase](https://supabase.com) project. In the **SQL Editor**, run `supabase/schema.sql`, then each file in `supabase/migrations/` in order, `001` to `013`.
2. Get a free Gemini API key from [Google AI Studio](https://aistudio.google.com).
3. Copy `.env.example` to `.env.local` and fill in `GEMINI_API_KEY`, `SUPABASE_URL` and `SUPABASE_SECRET_KEY`. To send real email, also fill in `RESEND_API_KEY` and `EMAIL_FROM`.
4. Run the app:

   ```bash
   npm install
   npm run dev
   ```

5. Open http://localhost:3000/signup to create your workspace and admin account. Then go to **Settings → Demo data** to load sample activity, and **Settings → Email → Test inbox** to try the email flow without a mail provider.

The customer chat for a workspace is at `/support/<workspace-slug>`.

## What I'd build next

- **Social and voice channels:** Meta (Facebook, Instagram, WhatsApp), X, and a calling tool, feeding the same queue and SLAs.
- **Order lookup in the bot**, to remove the most common "needs staff" handover.
- **Business-hours SLAs** and automatic escalation rules.
- **Invite-only sign-up** for company deployments.

---

*Atlas Ring is a fictional brand. All help articles, customers, agents and demo data are made up.*
