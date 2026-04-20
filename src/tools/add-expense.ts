import { z } from "zod";
import type { AppContext } from "../context.js";
import { WanderlogError } from "../errors.js";
import type { Json0Op } from "../ot/apply.js";
import type { Expense } from "../types.js";
import { generateBlockId, requireUserId, submitOp } from "./shared.js";

const VALID_CATEGORIES = [
  "flights",
  "lodging",
  "carRental",
  "publicTransit",
  "food",
  "drinks",
  "sightseeing",
  "activities",
  "shopping",
  "gas",
  "groceries",
  "other",
] as const;

export const addExpenseInputSchema = {
  trip_key: z
    .string()
    .min(1)
    .describe("The trip to add the expense to. Use wanderlog_list_trips if you don't know the key."),
  amount: z
    .number()
    .positive()
    .describe("Expense amount (e.g. 1500)."),
  currency_code: z
    .string()
    .length(3)
    .describe("ISO 4217 currency code (e.g. 'JPY', 'USD', 'EUR')."),
  category: z
    .enum(VALID_CATEGORIES)
    .describe(
      "Expense category. One of: flights, lodging, carRental, publicTransit, food, drinks, sightseeing, activities, shopping, gas, groceries, other.",
    ),
  description: z
    .string()
    .min(1)
    .describe("Short description of the expense (e.g. 'Shinkansen Tokyo→Kyoto')."),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be an ISO date: YYYY-MM-DD")
    .describe("Date of the expense in ISO format (YYYY-MM-DD)."),
};

export const addExpenseDescription = `
Adds an expense to a Wanderlog trip's budget tracker.

Provide the amount, ISO currency code, category, a short description, and the date. The expense
will appear in the trip's budget section and show up in wanderlog_list_expenses and
wanderlog_get_budget_summary.

Valid categories: flights, lodging, carRental, publicTransit, food, drinks, sightseeing,
activities, shopping, gas, groceries, other.
`.trim();

type Args = {
  trip_key: string;
  amount: number;
  currency_code: string;
  category: (typeof VALID_CATEGORIES)[number];
  description: string;
  date: string;
};

export async function addExpense(
  ctx: AppContext,
  args: Args,
): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> {
  try {
    const userId = requireUserId(ctx);
    const entry = await ctx.tripCache.getEntry(args.trip_key);
    const trip = entry.snapshot;

    const expenses = trip.itinerary.budget?.expenses ?? [];
    const insertIndex = expenses.length;

    const newExpense: Expense = {
      id: generateBlockId(),
      amount: { amount: args.amount, currencyCode: args.currency_code.toUpperCase() },
      category: args.category,
      description: args.description,
      date: args.date,
      blockId: null,
      paidByUserId: userId,
      paidByUser: { type: "user", id: userId },
      splitWith: { type: "noSplit", users: [] },
    };

    const ops: Json0Op[] = [
      {
        p: ["itinerary", "budget", "expenses", insertIndex],
        li: newExpense,
      },
    ];

    await submitOp(ctx, args.trip_key, ops);

    const amt = `${args.amount.toLocaleString()} ${args.currency_code.toUpperCase()}`;
    return {
      content: [
        {
          type: "text",
          text: `Added expense: ${args.description} — ${amt} (${args.category}) on ${args.date} to "${trip.title}". Expense id: ${newExpense.id}.`,
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
