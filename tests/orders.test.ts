import { describe, expect, it } from "vitest";
import { canCancel, canRefund, findOrderNumbers, formatMoney, orderFactsForBot, orderPrefix, type Order } from "@/app/lib/orders";
import { fillPlaceholders } from "@/app/lib/replies";

describe("orders", () => {
  it("makes an order prefix from the company name", () => {
    expect(orderPrefix("Atlas Ring")).toBe("AR");
    expect(orderPrefix("Zeta")).toBe("ZX");
    expect(orderPrefix("Big Blue Box Co")).toBe("BBB");
  });

  it("finds order numbers however they're typed, and ignores phone numbers", () => {
    expect(findOrderNumbers("where is AR-10234 please")).toEqual(["AR-10234"]);
    expect(findOrderNumbers("order ar 10234 and #NW55555")).toEqual(["AR-10234", "NW-55555"]);
    expect(findOrderNumbers("call me on 9876543210")).toEqual([]);
  });

  it("only allows cancelling before shipping, and refunds after", () => {
    expect(canCancel({ status: "processing" })).toBe(true);
    expect(canCancel({ status: "shipped" })).toBe(false);
    expect(canRefund({ status: "delivered" })).toBe(true);
    expect(canRefund({ status: "refunded" })).toBe(false);
    expect(formatMoney(28999)).toBe("₹28,999");
  });

  it("gives the chatbot status and tracking, but never the address", () => {
    const order: Order = {
      id: "1", customerId: "c", orderNumber: "AR-10234", status: "shipped",
      items: [{ name: "Atlas Ring", variant: "Size 9", quantity: 1, price: 28999 }], total: 28999, currency: "INR",
      carrier: "Blue Dart", trackingNumber: "12345678901", shipCity: "Pune",
      placedAt: "2026-11-01T06:00:00Z", shippedAt: "2026-11-02T06:00:00Z", deliveredAt: null, closedAt: null, closedBy: null, source: "demo",
    };
    const facts = orderFactsForBot(order);
    expect(facts).toContain("Tracking number: 12345678901");
    expect(facts).toContain("with Blue Dart");
    expect(facts).not.toContain("Pune");
  });
});

describe("saved replies", () => {
  it("fills placeholders and leaves unknown ones visible", () => {
    expect(fillPlaceholders("Hi {{customer_first_name}}, ticket #{{ticket_id}} {{survey_link}}", { customer_first_name: "Riya", ticket_id: "5003" })).toBe(
      "Hi Riya, ticket #5003 {{survey_link}}"
    );
  });
});
