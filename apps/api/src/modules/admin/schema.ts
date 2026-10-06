import { z } from "zod";

export const resetPinSchema = z.object({
  new_pin: z
    .string({ required_error: "new_pin is required" })
    .regex(/^\d{6}$/, { message: "new_pin must be exactly 6 digits" }),
});

export type ResetPinInput = z.infer<typeof resetPinSchema>;
