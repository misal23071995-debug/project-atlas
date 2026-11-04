import "server-only";
import { getSupabase } from "./supabase";
import { getSlaTargets } from "./sla";
import { getScorecard } from "./quality";
import { addStarterReplies, listSavedReplies } from "./replies";
import {
  CHANNELS,
  DEMO_AGENTS,
  DEMO_EMAIL_DOMAIN,
  DEMO_REVIEWER,
  DEMO_TAG,
  DEMO_TOPICS,
  DEVICES,
  FIRST_NAMES,
  LAST_NAMES,
  LOCATIONS,
  QC_FEEDBACK,
} from "@/app/lib/demo/content";
import { DEFAULT_SLA_TARGETS } from "@/app/lib/sla";
import { totalScore, type CriterionScore } from "@/app/lib/quality/types";
import type { HandoffType } from "@/app/lib/bot/types";
import type { TicketPriority, TicketStatus } from "@/app/lib/tickets";
import { orderPrefix, type OrderItem, type OrderStatus } from "@/app/lib/orders";

// Fills a workspace with about 90 days of realistic, clearly marked demo activity, and removes it again.
// Demo tickets carry the "Demo data" tag and demo customers an @demo-customers.example email.

const DAYS = 90;
const MIN = 60_000;
const DAY = 24 * 60 * MIN;
const BATCH = 500;
// India Standard Time, where the demo team works
const IST_OFFSET = 5.5 * 60 * MIN;
// Contacts per hour of the local day, relative
const HOUR_WEIGHTS = [1, 0.5, 0.3, 0.3, 0.3, 0.5, 1, 2, 4, 6, 7, 8, 8, 7, 6, 6, 6, 7, 8, 8, 7, 5, 3, 2];
const PRIORITIES: { priority: TicketPriority; weight: number }[] = [
  { priority: "Urgent", weight: 5 },
  { priority: "High", weight: 22 },
  { priority: "Medium", weight: 52 },
  { priority: "Low", weight: 21 },
];
const CSAT_PRAISE = ["Quick and friendly, thank you!", "Sorted in one reply. Great service.", "Very helpful and clear."];
const CSAT_COMPLAINTS = ["Took too long to get an answer.", "I had to explain my problem twice.", "Fixed in the end, but slow."];
const HANDOFFS: { type: HandoffType; weight: number; reason: string }[] = [
  { type: "needs_staff", weight: 45, reason: "Needs an agent to check the order or account" },
  { type: "not_covered", weight: 25, reason: "No help article covers this question" },
  { type: "customer_request", weight: 20, reason: "Customer asked to talk to a person" },
  { type: "upset", weight: 10, reason: "Customer is frustrated" },
];

const DEMO_PRODUCTS: OrderItem[] = [
  { name: "Atlas Ring", variant: "Size 8 · Matte Black", quantity: 1, price: 28999 },
  { name: "Atlas Ring", variant: "Size 9 · Silver", quantity: 1, price: 28999 },
  { name: "Atlas Ring", variant: "Size 10 · Rose Gold", quantity: 1, price: 30999 },
  { name: "Atlas Ring", variant: "Size 7 · Gold", quantity: 1, price: 30999 },
];
const DEMO_ADD_ONS: OrderItem[] = [
  { name: "Atlas Care+ (1 year)", quantity: 1, price: 2499 },
  { name: "Spare charging dock", quantity: 1, price: 1999 },
  { name: "Atlas+ membership (1 year)", quantity: 1, price: 2999 },
];
const CARRIERS = ["Blue Dart", "Delhivery", "DTDC", "Ekart"];
const ORDER_TOPICS = ["Orders & Shipping", "Returns & Refunds", "Sizing", "Warranty"];

// Small seeded random generator, so every load looks the same
function random(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rand = () => number;
const pick = <T,>(rand: Rand, items: readonly T[]) => items[Math.floor(rand() * items.length)];
function weighted<T extends { weight: number }>(rand: Rand, items: readonly T[]) {
  let r = rand() * items.reduce((sum, i) => sum + i.weight, 0);
  for (const item of items) if ((r -= item.weight) < 0) return item;
  return items[items.length - 1];
}
// Log-normal: most values near the median, a long tail of slow ones
function lognormal(rand: Rand, median: number, spread: number) {
  const normal = Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
  return median * Math.exp(spread * normal);
}
const iso = (ms: number) => new Date(ms).toISOString();

async function insertAll(table: string, rows: Record<string, unknown>[], select?: string) {
  const out: Record<string, unknown>[] = [];
  for (let i = 0; i < rows.length; i += BATCH) {
    const query = getSupabase().from(table).insert(rows.slice(i, i + BATCH));
    const { data, error } = select ? await query.select(select) : await query;
    if (error) throw new Error(`Failed to save demo ${table}: ${error.message}`);
    if (data) out.push(...(data as unknown as Record<string, unknown>[]));
  }
  return out;
}

export async function countDemoTickets(orgId: string) {
  const { count, error } = await getSupabase()
    .from("tickets")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .contains("tags", [DEMO_TAG]);
  if (error) throw new Error(`Failed to check demo data: ${error.message}`);
  return count ?? 0;
}

export async function loadDemoData(orgId: string, slug: string) {
  if ((await countDemoTickets(orgId)) > 0) throw new Error("Demo data is already loaded. Remove it first to load it again.");

  const rand = random(20261104);
  const now = Date.now();
  const targets = (await getSlaTargets(orgId)) ?? DEFAULT_SLA_TARGETS;
  const criteria = await getScorecard(orgId);

  // ---- Customers ----
  const people = Array.from({ length: 420 }, (_, i) => {
    const first = pick(rand, FIRST_NAMES);
    const last = pick(rand, LAST_NAMES);
    return {
      org_id: orgId,
      name: `${first} ${last}`,
      // The workspace is in the address so two workspaces never share a demo customer
      email: `${first}.${last}.${i}@${slug}.${DEMO_EMAIL_DOMAIN}`.toLowerCase(),
      location: pick(rand, LOCATIONS),
      device: pick(rand, DEVICES),
      orders: 1 + Math.floor(rand() * 3),
      csat: rand() < 0.6 ? 3 + Math.floor(rand() * 3) : null,
      created_at: iso(now - (DAYS + 30) * DAY + rand() * DAYS * DAY),
    };
  });
  const customers = (await insertAll("customers", people, "id, name, email")) as { id: string; name: string; email: string }[];

  // ---- Orders: one or two per customer over the last few months ----
  const { data: orgRow } = await getSupabase().from("organizations").select("name").eq("id", orgId).single();
  const prefix = orderPrefix(orgRow?.name ?? slug);
  const latestOrder = new Map<string, string>();
  const orderRows: Record<string, unknown>[] = [];
  let orderSeq = 10000 + Math.floor(rand() * 5000);
  for (const customer of customers) {
    const count = rand() < 0.3 ? 2 : 1;
    for (let n = 0; n < count; n++) {
      const placed = now - (1 + rand() * (DAYS + 20)) * DAY;
      const age = (now - placed) / DAY;
      const roll = rand();
      const status: OrderStatus =
        age < 1.5 ? "processing" : age < 6 ? "shipped" : roll < 0.04 ? "refunded" : roll < 0.07 ? "returned" : roll < 0.09 ? "cancelled" : "delivered";
      const items: OrderItem[] = [pick(rand, DEMO_PRODUCTS)];
      if (rand() < 0.3) items.push(pick(rand, DEMO_ADD_ONS));
      const shipped = status === "cancelled" || status === "processing" ? null : placed + (0.5 + rand() * 1.5) * DAY;
      const delivered = shipped && status !== "shipped" ? shipped + (2 + rand() * 4) * DAY : null;
      const orderNumber = `${prefix}-${orderSeq++}`;
      orderRows.push({
        org_id: orgId,
        customer_id: customer.id,
        order_number: orderNumber,
        status,
        items,
        total: items.reduce((sum, i) => sum + i.price * i.quantity, 0),
        carrier: shipped ? pick(rand, CARRIERS) : null,
        tracking_number: shipped ? String(Math.floor(1e10 + rand() * 9e10)) : null,
        ship_city: pick(rand, LOCATIONS).split(",")[0],
        placed_at: iso(placed),
        shipped_at: shipped ? iso(shipped) : null,
        delivered_at: delivered ? iso(Math.min(delivered, now - MIN)) : null,
        closed_at: ["cancelled", "refunded"].includes(status) ? iso(placed + 3 * DAY) : null,
        closed_by: ["cancelled", "refunded"].includes(status) ? pick(rand, DEMO_AGENTS).name : null,
        source: "demo",
      });
      // Tickets quote the customer's latest order that actually went through
      if (status !== "cancelled") latestOrder.set(customer.id, orderNumber);
    }
  }
  const { error: orderError } = await getSupabase().from("orders").insert(orderRows);
  // PGRST205: orders aren't set up in this database yet, so skip them
  if (orderError && orderError.code !== "PGRST205") throw new Error(`Failed to save demo orders: ${orderError.message}`);
  const hasOrders = !orderError;

  // ---- Tickets ----
  type Draft = {
    row: Record<string, unknown>;
    customer: string;
    customerEmail: string;
    agent: (typeof DEMO_AGENTS)[number];
    topic: (typeof DEMO_TOPICS)[number];
    question: string;
    firstReplyAt: number | null;
    resolvedAt: number | null;
    followUp: boolean;
  };
  const drafts: Draft[] = [];
  const startDay = Math.floor((now + IST_OFFSET) / DAY) - (DAYS - 1);

  for (let d = 0; d < DAYS; d++) {
    const dayStart = (startDay + d) * DAY - IST_OFFSET;
    const weekday = new Date(dayStart + IST_OFFSET).getUTCDay();
    // Busier on weekdays, slowly growing, and a sync problem after a firmware release three weeks ago
    const incident = d >= DAYS - 24 && d < DAYS - 19;
    const volume = Math.round((weekday === 0 || weekday === 6 ? 7 : 12) * (0.85 + (0.3 * d) / DAYS) * (incident ? 1.8 : 1) * (0.8 + rand() * 0.4));

    for (let n = 0; n < volume; n++) {
      const hour = weighted(rand, HOUR_WEIGHTS.map((weight, h) => ({ h, weight }))).h;
      const created = dayStart + hour * 60 * MIN + rand() * 60 * MIN;
      if (created > now - 10 * MIN) continue;

      const topic = incident && rand() < 0.55 ? DEMO_TOPICS[0] : weighted(rand, DEMO_TOPICS);
      const channel = weighted(rand, CHANNELS).channel;
      const priority = topic.category === "Sync & App" && incident && rand() < 0.4 ? "High" : weighted(rand, PRIORITIES).priority;
      const agent = weighted(rand, DEMO_AGENTS);
      const target = targets[priority];
      const customer = pick(rand, customers);
      // Order questions quote the customer's order number, as real ones do
      const orderNumber = latestOrder.get(customer.id);
      const question =
        hasOrders && orderNumber && ORDER_TOPICS.includes(topic.category) && rand() < 0.7
          ? `${pick(rand, topic.questions)} My order number is ${orderNumber}.`
          : pick(rand, topic.questions);

      // Phone calls are answered live; everything else waits in the queue
      const replyMinutes =
        channel === "Phone"
          ? 1 + rand() * 4
          : Math.max(1, lognormal(rand, target.firstResponseMinutes * 0.35 * agent.speed * (incident ? 1.6 : 1), 0.75));
      const resolveMinutes = Math.max(replyMinutes + 5, lognormal(rand, target.resolutionMinutes * 0.3 * agent.speed, 0.85));

      // A live queue: many of the last few days' tickets are still being worked, and a few still wait for a reply
      // Mostly tickets still inside their resolution target, with the odd one that has slipped past it
      const recent = now - created < 3 * DAY;
      const withinTarget = created + target.resolutionMinutes * MIN > now;
      const stillOpen = recent && rand() < (withinTarget ? 0.85 : 0.08);
      const replyDue = created + target.firstResponseMinutes * MIN > now;
      const noReplyYet = stillOpen && rand() < (replyDue ? 0.6 : 0.05);

      const firstReplyAt = !noReplyYet && created + replyMinutes * MIN <= now ? created + replyMinutes * MIN : null;
      const resolvedAt = !stillOpen && created + resolveMinutes * MIN <= now ? created + resolveMinutes * MIN : null;

      let status: TicketStatus;
      let pausedAt: number | null = null;
      if (resolvedAt) {
        status = now - resolvedAt > 5 * DAY && rand() < 0.5 ? "Closed" : "Resolved";
      } else if (!firstReplyAt) {
        status = "Open";
      } else {
        const r = rand();
        status = r < 0.35 ? "Pending" : r < 0.65 ? "Waiting on Customer" : r < 0.8 ? "Escalated" : "Open";
        if (status === "Waiting on Customer") pausedAt = firstReplyAt + (now - firstReplyAt) * rand();
      }

      // About a third of customers answer the survey; happier with the stronger agents
      const rated = resolvedAt !== null && rand() < 0.32;
      const ratedAt = rated ? Math.min(now - MIN, resolvedAt! + (1 + rand() * 20) * 60 * MIN) : null;
      const csat = rated ? Math.max(1, Math.min(5, Math.round(4.2 + agent.quality * 0.9 + (rand() - 0.55) * 2.2))) : null;

      drafts.push({
        customer: customer.name,
        customerEmail: customer.email,
        agent,
        topic,
        question,
        firstReplyAt,
        resolvedAt,
        followUp: rand() < 0.45,
        row: {
          org_id: orgId,
          customer_id: customer.id,
          subject: pick(rand, topic.subjects),
          description: question,
          summary: `Customer needs help with ${topic.category.toLowerCase()}.`,
          intent: topic.category,
          sentiment: priority === "Urgent" || priority === "High" ? "Frustrated" : rand() < 0.15 ? "Positive" : "Neutral",
          confidence: 70 + Math.floor(rand() * 28),
          priority,
          status,
          // A few new tickets are still waiting for someone to pick them up
          assigned_to: !firstReplyAt && rand() < 0.5 ? "Unassigned" : agent.name,
          channel,
          category: topic.category,
          tags: [topic.category, DEMO_TAG],
          created_at: iso(created),
          updated_at: iso(resolvedAt ?? firstReplyAt ?? created),
          first_response_at: firstReplyAt ? iso(firstReplyAt) : null,
          resolved_at: resolvedAt ? iso(resolvedAt) : null,
          first_response_due_at: iso(created + target.firstResponseMinutes * MIN),
          resolution_due_at: iso(created + target.resolutionMinutes * MIN),
          sla_paused_at: pausedAt ? iso(pausedAt) : null,
          sla_paused_minutes: 0,
          csat_rating: csat,
          csat_comment: csat !== null && rand() < 0.3 ? pick(rand, csat >= 4 ? CSAT_PRAISE : CSAT_COMPLAINTS) : null,
          csat_rated_at: ratedAt ? iso(ratedAt) : null,
        },
      });
    }
  }

  const ids = (await insertAll("tickets", drafts.map((d) => d.row), "id")) as { id: number }[];
  if (ids.length !== drafts.length) throw new Error("Failed to save demo tickets");

  // ---- Messages and activity ----
  const messages: Record<string, unknown>[] = [];
  const activities: Record<string, unknown>[] = [];
  drafts.forEach((d, i) => {
    const ticketId = ids[i].id;
    const created = Date.parse(d.row.created_at as string);
    messages.push({ ticket_id: ticketId, sender: d.customer, role: "customer", body: d.question, created_at: iso(created) });
    activities.push({ ticket_id: ticketId, title: `Ticket Created via ${d.row.channel}`, color: "bg-green-500", created_at: iso(created) });

    if (d.firstReplyAt) {
      messages.push({ ticket_id: ticketId, sender: d.agent.name, role: "agent", body: pick(rand, d.topic.replies), created_at: iso(d.firstReplyAt) });
      activities.push({ ticket_id: ticketId, title: `Reply sent by ${d.agent.name}`, color: "bg-indigo-500", created_at: iso(d.firstReplyAt) });
    }
    if (d.resolvedAt) {
      if (d.followUp) {
        const at = d.firstReplyAt! + (d.resolvedAt - d.firstReplyAt!) * 0.8;
        messages.push({ ticket_id: ticketId, sender: d.customer, role: "customer", body: pick(rand, d.topic.closings), created_at: iso(at) });
      }
      activities.push({
        ticket_id: ticketId,
        title: `Status changed to ${d.row.status} by ${d.agent.name}`,
        color: "bg-blue-500",
        created_at: iso(d.resolvedAt),
      });
    }
  });
  await insertAll("ticket_messages", messages);
  await insertAll("ticket_activities", activities);

  // ---- Quality reviews: about one in eight resolved tickets, a few days later ----
  const reviews: Record<string, unknown>[] = [];
  drafts.forEach((d, i) => {
    if (!d.resolvedAt || !d.firstReplyAt || rand() > 0.13) return;
    const reviewedAt = d.resolvedAt + (1 + rand() * 3) * DAY;
    if (reviewedAt > now) return;

    const score = (id: string, noise: number) =>
      Math.max(1, Math.min(5, Math.round(3.9 + d.agent.quality + (d.agent.strengths[id] ?? 0) + (rand() - 0.5) * noise)));
    const scores: CriterionScore[] = criteria.map((c) => ({ id: c.id, label: c.label, weight: c.weight, score: score(c.id, 1.6) }));
    const aiScores: CriterionScore[] = scores.map((s) => ({
      ...s,
      score: Math.max(1, Math.min(5, s.score + (rand() < 0.25 ? (rand() < 0.5 ? -1 : 1) : 0))),
      reason: "",
    }));
    const total = totalScore(scores);
    const band = total >= 80 ? "high" : total >= 60 ? "mid" : "low";

    reviews.push({
      org_id: orgId,
      ticket_id: ids[i].id,
      agent_name: d.agent.name,
      status: "reviewed",
      ai_scores: aiScores,
      ai_total: totalScore(aiScores),
      ai_summary: "Demo review",
      scores,
      total,
      feedback: pick(rand, QC_FEEDBACK[band]),
      reviewed_by: DEMO_REVIEWER,
      reviewed_at: iso(reviewedAt),
      created_at: iso(d.resolvedAt + DAY / 2),
      updated_at: iso(reviewedAt),
    });
  });
  const { error: reviewError } = await getSupabase().from("qa_reviews").insert(reviews);
  // PGRST205: quality checks aren't set up in this workspace's database, so skip them
  if (reviewError && reviewError.code !== "PGRST205") throw new Error(`Failed to save demo reviews: ${reviewError.message}`);

  // ---- Bot chats: every AI Chatbot ticket was a handover; about twice as many the bot solved alone ----
  type Chat = { row: Record<string, unknown>; question: string; answer: string };
  const chats: Chat[] = [];
  drafts.forEach((d, i) => {
    if (d.row.channel !== "AI Chatbot") return;
    const created = Date.parse(d.row.created_at as string) - (2 + rand() * 6) * MIN;
    const handoff = weighted(rand, HANDOFFS);
    const rated = d.resolvedAt && rand() < 0.35;
    chats.push({
      question: d.question,
      answer: "Let me pass you to our support team, who can look into this for you.",
      row: {
        org_id: orgId,
        customer_name: d.customer,
        // The same person as the ticket, so the chat shows on their profile
        customer_email: d.customerEmail,
        status: "handed_off",
        topic: d.topic.category,
        ticket_id: ids[i].id,
        customer_messages: 1 + Math.floor(rand() * 3),
        handoff_reason: handoff.reason,
        handoff_type: handoff.type,
        csat_rating: rated ? (rand() < 0.7 ? 4 + Math.round(rand()) : 2 + Math.round(rand())) : null,
        rated_at: rated ? iso(d.resolvedAt!) : null,
        created_at: iso(created),
        updated_at: iso(created + 5 * MIN),
      },
    });
  });

  const solvedCount = Math.round(chats.length * 1.9);
  for (let n = 0; n < solvedCount; n++) {
    const created = now - rand() * DAYS * DAY;
    const topic = weighted(rand, DEMO_TOPICS);
    const name = `${pick(rand, FIRST_NAMES)} ${pick(rand, LAST_NAMES)}`;
    const rated = rand() < 0.42;
    chats.push({
      question: pick(rand, topic.questions),
      answer: pick(rand, topic.replies),
      row: {
        org_id: orgId,
        customer_name: name,
        customer_email: `${name.replace(" ", ".")}.bot${n}@${slug}.${DEMO_EMAIL_DOMAIN}`.toLowerCase(),
        status: "resolved",
        topic: topic.category,
        customer_messages: 1 + Math.floor(rand() * 2),
        csat_rating: rated ? (rand() < 0.82 ? 4 + Math.round(rand()) : 2 + Math.round(rand())) : null,
        rated_at: rated ? iso(Math.min(now, created + 4 * MIN)) : null,
        created_at: iso(created),
        updated_at: iso(created + 3 * MIN),
      },
    });
  }

  const chatIds = (await insertAll("bot_conversations", chats.map((c) => c.row), "id")) as { id: string }[];
  const botMessages: Record<string, unknown>[] = [];
  chats.forEach((c, i) => {
    const at = Date.parse(c.row.created_at as string);
    botMessages.push({ conversation_id: chatIds[i].id, role: "customer", body: c.question, created_at: iso(at) });
    botMessages.push({ conversation_id: chatIds[i].id, role: "bot", body: c.answer, created_at: iso(at + 20_000) });
  });
  await insertAll("bot_messages", botMessages);

  // Agents need something in the saved replies list to show off
  if ((await listSavedReplies(orgId))?.length === 0) await addStarterReplies(orgId, "Atlas");

  return { tickets: ids.length, reviews: reviews.length, chats: chats.length };
}

// Removes only rows marked as demo data. Messages, activity and reviews go with their tickets.
export async function removeDemoData(orgId: string) {
  const supabase = getSupabase();
  // Matches both name@demo-customers.example and name@workspace.demo-customers.example
  const domain = `%${DEMO_EMAIL_DOMAIN}`;

  const tickets = await supabase.from("tickets").delete({ count: "exact" }).eq("org_id", orgId).contains("tags", [DEMO_TAG]);
  if (tickets.error) throw new Error(`Failed to remove demo tickets: ${tickets.error.message}`);

  const chats = await supabase.from("bot_conversations").delete({ count: "exact" }).eq("org_id", orgId).like("customer_email", domain);
  if (chats.error && chats.error.code !== "PGRST205") throw new Error(`Failed to remove demo chats: ${chats.error.message}`);

  const customers = await supabase.from("customers").delete().eq("org_id", orgId).like("email", domain);
  if (customers.error) throw new Error(`Failed to remove demo customers: ${customers.error.message}`);

  return { tickets: tickets.count ?? 0, chats: chats.count ?? 0 };
}
