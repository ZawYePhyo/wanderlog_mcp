import { z } from "zod";
import type { AppContext } from "../context.js";
import { WanderlogError } from "../errors.js";

export const getBudgetSummaryInputSchema = {
  trip_key: z
    .string()
    .min(1)
    .describe("The trip to summarise. Use wanderlog_list_trips if you don't know the key."),
};

export const getBudgetSummaryDescription = `
Returns an aggregated budget summary for a Wanderlog trip: total spent vs budget, and a
breakdown of spending by category.

Use this to answer questions like "how much have I spent so far?" or "what's left in my budget?".
For a raw list of every individual expense, use wanderlog_list_expenses instead.
`.trim();

type Args = { trip_key: string };

export async function getBudgetSummary(
  ctx: AppContext,
  args: Args,
): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> {
  try {
    const entry = await ctx.tripCache.getEntry(args.trip_key);
    const trip = entry.snapshot;
    const budget = trip.itinerary.budget;

    if (!budget || budget.expenses.length === 0) {
      const budgetLine =
        budget?.amount?.amount != null
          ? `Budget: ${budget.amount.amount.toLocaleString()} ${budget.amount.currencyCode}`
          : "No budget total set.";
      return {
        content: [
          {
            type: "text",
            text: `Budget summary for "${trip.title}"\n\n${budgetLine}\nSpent: 0\nNo expenses recorded yet.`,
          },
        ],
      };
    }

    // Aggregate by category — all amounts are summed in their native currency.
    // If expenses use multiple currencies we group per-currency per-category.
    type Key = string; // "category|currencyCode"
    const byCategory = new Map<Key, number>();
    let defaultCurrency = budget.amount?.currencyCode ?? "";

    for (const exp of budget.expenses) {
      const key = `${exp.category}|${exp.amount.currencyCode}`;
      byCategory.set(key, (byCategory.get(key) ?? 0) + exp.amount.amount);
      if (!defaultCurrency) defaultCurrency = exp.amount.currencyCode;
    }

    // Total spent (per currency)
    const totalByCurrency = new Map<string, number>();
    for (const exp of budget.expenses) {
      const cur = exp.amount.currencyCode;
      totalByCurrency.set(cur, (totalByCurrency.get(cur) ?? 0) + exp.amount.amount);
    }

    const lines: string[] = [];
    lines.push(`Budget summary for "${trip.title}"`);
    lines.push("");

    if (budget.amount?.amount != null) {
      const budgetTotal = budget.amount.amount;
      const cur = budget.amount.currencyCode;
      const spent = totalByCurrency.get(cur) ?? 0;
      const remaining = budgetTotal - spent;
      lines.push(`Budget:    ${budgetTotal.toLocaleString()} ${cur}`);
      lines.push(`Spent:     ${spent.toLocaleString()} ${cur}`);
      lines.push(`Remaining: ${remaining.toLocaleString()} ${cur}`);
    } else {
      for (const [cur, total] of totalByCurrency) {
        lines.push(`Spent: ${total.toLocaleString()} ${cur}`);
      }
    }

    lines.push("");
    lines.push("By category:");

    // Sort by descending spend within the default currency, others appended after
    const entries = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);
    for (const [key, total] of entries) {
      const [category, currency] = key.split("|") as [string, string];
      lines.push(`  ${category.padEnd(18)}  ${total.toLocaleString().padStart(12)} ${currency}`);
    }

    lines.push("");
    lines.push(`${budget.expenses.length} expense(s) total`);

    return { content: [{ type: "text", text: lines.join("\n") }] };
  } catch (err) {
    const msg =
      err instanceof WanderlogError
        ? err.toUserMessage()
        : `Unexpected error: ${(err as Error).message}`;
    return { content: [{ type: "text", text: msg }], isError: true };
  }
}
