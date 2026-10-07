import { z } from "zod";

export const createRedemptionSchema = z.object({
  points: z
    .number({ required_error: "points is required" })
    .int({ message: "points must be an integer" })
    .positive({ message: "points must be greater than zero" })
    .max(1000000, { message: "points amount is too large" }),
}).strict();

export type CreateRedemptionInput = z.infer<typeof createRedemptionSchema>;
