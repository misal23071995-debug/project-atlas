# Project Atlas: a support operations platform

Atlas is a multi-company support desk built the way a CX lead would want one. It covers the whole operation, not just the inbox:

- **Channels:** an AI chatbot that hands over to live chat with an agent, email, and tickets logged by hand.
- **The desk:** a three-panel ticket workspace, automation rules, customer profiles with their orders, and file attachments.
- **Running the team:** SLA tracking, quality checks (QC), training, rostering and capacity planning.
- **Reporting:** a dashboard with a day-by-day breakdown, and reports that tie it all together.
- **Ready for a real company:** two-step sign-in, invites, an audit log, rate limits, error alerts, and tests that run on every change.

The demo company is a fictional smart-ring brand, **Atlas Ring**.

I built it around one question every support team faces: **how do you handle more customers, faster, without the quality of support slipping?** Each module answers part of that, and they feed each other. QC scores assign training. The ticket forecast sets the staffing target. Bot handovers show which help articles to write next.

**Live demo**
- Customer chat (no login): https://project-atlas-pied.vercel.app/support/atlas-ring
- Agent desk: https://project-atlas-pied.vercel.app. Sign up to create your own workspace, then **Settings → Demo data → Load demo data** to fill it with 90 days of realistic activity.

---

## Modules

| Module | What it does |
|---|---|
| **AI chatbot** | Answers customers only from published help articles and shows which article it used. Looks up the customer's order when they give an order number that matches their email. Hands over to a person when it can't help, with the full transcript attached. Collects a star rating after each chat. |
| **Live chat** | After a handover the chat stays open: the agent replies from the ticket and the answer appears in the customer's chat window within seconds. The ticket shows whether the customer is still in the chat and updates as they type back. Replies to a customer who has left are also emailed, and reopening the support page picks the chat up again. Solving the ticket closes the chat with a rating. |
| **Email** | Incoming emails become tickets, and the AI fills in summary, category and sentiment. Customer replies land on the same ticket, and reopen it if it was closed. Agent replies go out by email. Customers get an automatic acknowledgement with their ticket number, and a survey link when the ticket is resolved. |
| **Ticket desk** | An inbox with saved views (yours, unassigned, past SLA, at risk, waiting on customer and more) and live counts. Each ticket opens in three panels: its properties, one timeline of messages, internal notes and changes, and the customer's details. The reply box can send and set the status in one step. An AI copilot drafts replies, and saved replies fill in placeholders such as the customer's name and the survey link. |
| **Automation** | Rules that run when a ticket is created, the customer replies, the SLA is breached, or a ticket has waited on the customer for a set time. Each rule checks conditions (channel, category, priority, sentiment, words in the message and more) and then sets priority or status, assigns, tags or adds a note. New tickets can be assigned automatically, in turn or to whoever has the fewest open tickets, and only to people on shift in the roster. |
| **Customer profiles and orders** | One page per customer with every ticket, bot chat and order, plus their total spend and satisfaction. Agents see the customer's recent orders next to each ticket, and the bot uses them to answer order questions. |
| **File attachments** | Agents attach files to replies, and files that customers send by email are saved on the ticket. Files up to 10 MB are kept in private storage and opened through links that expire. |
| **SLA tracking** | First-reply and resolution targets for each priority. Each ticket shows a live countdown: on track, at risk, breached, or paused while waiting on the customer. Breaches and at-risk tickets appear on the dashboard. |
| **CSAT** | A private survey link on every ticket, plus ratings at the end of bot chats. Shown on the ticket, per agent and in Reports. |
| **Quality (QC)** | An editable, weighted scorecard. The AI scores a conversation first; a QA analyst or lead checks it and finalises the score. Results are broken down by agent and by criterion. |
| **Training** | Courses with a lesson and a quiz. The AI can write the quiz questions. Leads assign courses with due dates. **A low QC score on a criterion assigns the linked course automatically.** |
| **Rostering** | Weekly shift calendar with shift templates, breaks and overnight shifts. Agents request leave and leads approve it. |
| **Capacity planning** | Forecasts contacts per hour from ticket history, works out the agents needed with **Erlang C** plus shrinkage, and lays it over the roster as a heat map of staffing gaps. |
| **Reports** | Any date range, compared with the period before. Covers volume trend, first reply and resolution times (median and average), SLA met %, CSAT, agents, channels, contact reasons, QC, bot deflection and training. Every table downloads as CSV. |
| **Workspaces and roles** | Each company has its own private workspace. Each person has a role: Admin, Team Lead, Agent or QA Analyst. Each role sees and can change only what it should. |
| **Account security** | Admins invite people by email. Password reset, optional two-step sign-in with an authenticator app, and a switch that turns off public sign-up for a company deployment. An audit log records who changed the team, sign-in security, settings, rules and orders. |

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
| A handover keeps the customer in the same chat | Being told "we'll email you" after explaining the problem feels like starting again. The agent picks up where the bot stopped. |
| SLA due times are fixed when a ticket is created | Changing the targets later shouldn't rewrite last month's results. |
| The SLA clock pauses on "Waiting on Customer" | Agents shouldn't be penalised for time the customer takes to reply. |
| The AI scores QC first, a person finalises it | It's fast enough to review more conversations, and a person remains accountable for each score. The report shows how far the AI's scores differ from the final ones. |
| QC feeds training directly | Coaching happens when the gap is found, not at the next monthly review. |
| Capacity uses Erlang C, not "tickets ÷ agents" | Queues don't scale linearly. Erlang C is the standard contact-centre staffing model. |
| Only a ticket's own customer can reply onto it by email | A guessed ticket number can't be used to post into someone else's ticket. |
| AI and email providers are swappable | Gemini's free tier and a "not connected" email mode let it run at no cost. Moving to a paid model or a real mail provider is a configuration change. |
| Auto-assignment only picks people on shift | A ticket assigned to someone who's off for the day is a ticket nobody is working. |
| Rules run in order and log every run | A lead can see which rule changed a ticket and why, instead of guessing. |
| Attachments stay private | Files are never public links. Each one opens through a link that expires after a short time. |
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
| Capacity, SLA targets, saved replies, email settings, automation | ✓ | ✓ | | |
| Write and assign training | ✓ | ✓ | | ✓ |
| See team reports | ✓ | ✓ | | ✓ |
| Team members, workspace settings, demo data, audit log | ✓ | | | |

## Tech stack

- **Next.js 16** (App Router, Server Actions) on **Vercel**
- **Supabase**: Postgres, Auth and Storage. The server checks the workspace and role on every request, and the database refuses direct access from the browser.
- **Google Gemini** (`gemini-3.5-flash-lite`, free tier) with structured JSON output. It powers the chatbot, the copilot, QC scoring, quiz writing and reading emails.
- **Resend** for outgoing email (optional). Incoming email arrives through a per-workspace webhook that accepts Postmark's format, or simple JSON from any other provider.
- **Tailwind CSS**
- **Vitest** and **GitHub Actions**: every push is type-checked, linted, tested and built before it deploys.
- Built with **Claude Code** as an AI pair programmer

## Running it safely

- **Tests:** 43 automated tests cover SLA clocks, automation rules, email parsing, attachments, orders, reports, staffing maths and live chat presence. They run with `npm test`, and on every push to GitHub alongside the type check, lint and a full build.
- **Rate limits:** chat, live chat, surveys, sign-ups, incoming email, password resets and two-step codes are each limited per visitor or workspace, so one person can't flood the queue or use up the AI quota.
- **Errors:** every server error is saved in the database, and emailed to the team if `ALERT_EMAIL` is set.
- **Uptime:** `/api/health` answers when the app and database are up, for a monitor such as UptimeRobot.

## Run it locally

1. Create a free [Supabase](https://supabase.com) project. In the **SQL Editor**, run `supabase/schema.sql`, then each file in `supabase/migrations/` in order, `001` to `019`.
2. Get a free Gemini API key from [Google AI Studio](https://aistudio.google.com).
3. Copy `.env.example` to `.env.local` and fill in `GEMINI_API_KEY`, `SUPABASE_URL` and `SUPABASE_SECRET_KEY`. To send real email, also fill in `RESEND_API_KEY` and `EMAIL_FROM`. The other settings (error alerts, closing sign-up) are explained in the file.
4. Run the app:

   ```bash
   npm install
   npm run dev
   ```

   `npm test` runs the tests.

5. Open http://localhost:3000/signup to create your workspace and admin account. Then go to **Settings → Demo data** to load sample activity, and **Settings → Email → Test inbox** to try the email flow without a mail provider.

The customer chat for a workspace is at `/support/<workspace-slug>`.

## What I'd build next

- **WhatsApp, Instagram and Facebook messages**, feeding the same queue, SLAs and live replies.
- **Voice:** calls through a phone provider, logged on the ticket with the recording.
- **Business-hours SLAs**, so clocks stop outside the team's working hours.
- **A public help centre** built from the same articles the bot reads.

---

*Atlas Ring is a fictional brand. All help articles, customers, agents and demo data are made up.*
