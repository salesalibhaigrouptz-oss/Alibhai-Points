import { z } from "zod";

export const cancelRedemptionSchema = z.object({
  reason: z
    .string({ required_error: "reason is required" })
    .min(1, { message: "reason cannot be empty" })
    .max(500, { message: "reason is too long" })
    .optional(),
}).strict();

export type CancelRedemptionInput = z.infer<typeof cancelRedemptionSchema>;

export const directRedeemSchema = z.object({
  points: z
    .number({ required_error: "points is required" })
    .int({ message: "points must be an integer" })
    .positive({ message: "points must be greater than zero" })
    .max(1000000, { message: "points amount is too large" }),
}).strict();

export type DirectRedeemInput = z.infer<typeof directRedeemSchema>;
