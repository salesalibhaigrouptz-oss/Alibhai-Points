import { z } from "zod";

export const previewPurchaseSchema = z.object({
  customer_code: z
    .string({ required_error: "customer_code is required" })
    .min(1, { message: "customer_code cannot be empty" })
    .max(20, { message: "customer_code is too long" })
    .trim(),
  purchase_amount: z
    .number({ required_error: "purchase_amount is required" })
    .positive({ message: "purchase_amount must be greater than zero" })
    .max(1000000000, { message: "purchase_amount is too large" })
    .refine((val) => Number.isInteger(val * 100), {
      message: "purchase_amount can have at most 2 decimal places",
    }),
}).strict();

export type PreviewPurchaseInput = z.infer<typeof previewPurchaseSchema>;

export const recordPurchaseSchema = z.object({
  customer_code: z
    .string({ required_error: "customer_code is required" })
    .min(1, { message: "customer_code cannot be empty" })
    .max(20, { message: "customer_code is too long" })
    .trim(),
  purchase_amount: z
    .number({ required_error: "purchase_amount is required" })
    .positive({ message: "purchase_amount must be greater than zero" })
    .max(1000000000, { message: "purchase_amount is too large" })
    .refine((val) => Number.isInteger(val * 100), {
      message: "purchase_amount can have at most 2 decimal places",
    }),
  idempotency_key: z
    .string({ required_error: "idempotency_key is required" })
    .uuid({ message: "idempotency_key must be a valid UUID" }),
}).strict();

export type RecordPurchaseInput = z.infer<typeof recordPurchaseSchema>;
