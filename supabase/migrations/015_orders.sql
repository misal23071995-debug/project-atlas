-- Orders: each customer's purchases, shown on their profile and next to their tickets,
-- and used by the chatbot to answer "where is my order?". Filled by hand, by demo data, or later by Shopify.
-- Run once in the Supabase SQL Editor. Safe to re-run.

create table if not exists orders (
  id bigint generated always as identity primary key,
  org_id uuid not null references organizations (id) on delete cascade,
  customer_id uuid not null references customers (id) on delete cascade,
  -- What the customer sees on their receipt, e.g. AR-10234
  order_number text not null,
  status text not null default 'processing'
    check (status in ('processing', 'shipped', 'delivered', 'cancelled', 'returned', 'refunded')),
  -- [{ "name": "Atlas Ring", "variant": "Size 9 · Matte Black", "quantity": 1, "price": 24999 }]
  items jsonb not null default '[]',
  total numeric(12, 2) not null default 0 check (total >= 0),
  currency text not null default 'INR',
  carrier text,
  tracking_number text,
  -- Ship-to city only; full addresses stay with the shop
  ship_city text,
  placed_at timestamptz not null default now(),
  shipped_at timestamptz,
  delivered_at timestamptz,
  -- Set when an agent cancels or refunds it
  closed_at timestamptz,
  closed_by text,
  source text not null default 'manual' check (source in ('manual', 'demo', 'shopify')),
  created_at timestamptz not null default now(),
  unique (org_id, order_number)
);

create index if not exists orders_customer_idx on orders (org_id, customer_id, placed_at desc);

alter table orders enable row level security;
