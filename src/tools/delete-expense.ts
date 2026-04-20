import { z } from "zod";
import type { AppContext } from "../context.js";
import { WanderlogError, WanderlogValidationError } from "../errors.js";
import type { Json0Op } from "../ot/apply.js";
import { submitOp } from "./shared.js";

export const deleteExpenseInputSchema = {
  trip_key: z
    .string()
    .min(1)
    .describe("The trip containing the expense. Use wanderlog_list_trips if you don't know the key."),
  expense_id: z
    .number()
    .int()
    .describe("The numeric id of the expense to delete. Use wanderlog_list_expenses to find expense ids."),
};

export const deleteExpenseDescription = `
Deletes an expense from a Wanderlog trip's budget.

Use wanderlog_list_expenses first to get the numeric expense id, then pass it here. This action
cannot be undone through the MCP server.
`.trim();

type Args = {
  trip_key: string;
  expense_id: number;
};

export async function deleteExpense(
  ctx: AppContext,
  args: Args,
): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> {
  try {
    const entry = await ctx.tripCache.getEntry(args.trip_key);
    const trip = entry.snapshot;

    const expenses = trip.itinerary.budget?.expenses ?? [];
    const index = expenses.findIndex((e) => e.id === args.expense_id);
    if (index === -1) {
      throw new WanderlogValidationError(
        `Expense id ${args.expense_id} not found in "${trip.title}".`,
        "Use wanderlog_list_expenses to see available expense ids.",
      );
    }

    const expense = expenses[index]!;

    const ops: Json0Op[] = [
      {
        p: ["itinerary", "budget", "expenses", index],
        ld: expense,
      },
    ];

    await submitOp(ctx, args.trip_key, ops);

    const amt = `${expense.amount.amount.toLocaleString()} ${expense.amount.currencyCode}`;
    return {
      content: [
        {
          type: "text",
          text: `Deleted expense: "${expense.description}" — ${amt} (${expense.category}) on ${expense.date} from "${trip.title}".`,
        },
      ],
    };
  } catch (err) {
    const msg =
      err instanceof WanderlogError
        ? err.toUserMessage()
        : `Unexpected error: ${(err as Error).message}`;
    return { content: [{ type: "text", text: msg }], isError: true };
  }
}
