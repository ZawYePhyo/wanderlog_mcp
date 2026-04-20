import { z } from "zod";
import type { AppContext } from "../context.js";
import { WanderlogError } from "../errors.js";

export const listExpensesInputSchema = {
  trip_key: z
    .string()
    .min(1)
    .describe("The trip to list expenses for. Use wanderlog_list_trips if you don't know the key."),
};

export const listExpensesDescription = `
Lists all expenses recorded in a Wanderlog trip's budget.

Returns each expense with its amount, currency, category, description, and date. Also shows the
overall budget total if one is set. Use wanderlog_get_budget_summary for an aggregated view by
category instead of a raw list.
`.trim();

type Args = { trip_key: string };

export async function listExpenses(
  ctx: AppContext,
  args: Args,
): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> {
  try {
    const entry = await ctx.tripCache.getEntry(args.trip_key);
    const trip = entry.snapshot;
    const budget = trip.itinerary.budget;

    if (!budget || budget.expenses.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No expenses recorded in "${trip.title}" yet.`,
          },
        ],
      };
    }

    const lines: string[] = [];
    lines.push(`Expenses for "${trip.title}":`);
    lines.push("");

    if (budget.amount?.amount != null) {
      lines.push(
        `Budget total: ${budget.amount.amount.toLocaleString()} ${budget.amount.currencyCode}`,
      );
      lines.push("");
    }

    for (const exp of budget.expenses) {
      const amt = `${exp.amount.amount.toLocaleString()} ${exp.amount.currencyCode}`;
      lines.push(
        `• [id:${exp.id}] ${exp.date}  ${exp.category.padEnd(16)}  ${amt.padStart(14)}  ${exp.description}`,
      );
    }

    lines.push("");
    lines.push(`Total: ${budget.expenses.length} expense(s)`);

    return { content: [{ type: "text", text: lines.join("\n") }] };
  } catch (err) {
    const msg =
      err instanceof WanderlogError
        ? err.toUserMessage()
        : `Unexpected error: ${(err as Error).message}`;
    return { content: [{ type: "text", text: msg }], isError: true };
  }
}
