import { z } from "zod";

export const resetPinSchema = z.object({
  new_pin: z
    .string({ required_error: "new_pin is required" })
    .regex(/^\d{6}$/, { message: "new_pin must be exactly 6 digits" }),
}).strict();

export type ResetPinInput = z.infer<typeof resetPinSchema>;

export const updateCustomerStatusSchema = z.object({
  is_active: z.boolean({ required_error: "is_active is required" }),
}).strict();

export type UpdateCustomerStatusInput = z.infer<typeof updateCustomerStatusSchema>;

export const voidPurchaseSchema = z.object({
  reason: z
    .string({ required_error: "reason is required" })
    .min(1, { message: "reason cannot be empty" })
    .max(500, { message: "reason must be less than 500 characters" }),
}).strict();

export type VoidPurchaseInput = z.infer<typeof voidPurchaseSchema>;

export const updatePointRulesSchema = z.object({
  amount_per_point: z
    .number({ required_error: "amount_per_point is required" })
    .positive({ message: "amount_per_point must be positive" })
    .max(1000000, { message: "amount_per_point is too large" }),
  redemption_wait_days: z
    .number({ required_error: "redemption_wait_days is required" })
    .int({ message: "redemption_wait_days must be an integer" })
    .min(0, { message: "redemption_wait_days must be 0 or greater" })
    .max(365, { message: "redemption_wait_days must be 365 days or less" }),
  inactivity_days: z
    .number({ required_error: "inactivity_days is required" })
    .int({ message: "inactivity_days must be an integer" })
    .positive({ message: "inactivity_days must be positive" })
    .max(365, { message: "inactivity_days must be 365 days or less" }),
}).strict();

export type UpdatePointRulesInput = z.infer<typeof updatePointRulesSchema>;
