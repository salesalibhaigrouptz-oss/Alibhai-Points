import { z } from "zod";

export const completeRegistrationSchema = z.object({
  full_name: z
    .string({ required_error: "Full name is required" })
    .trim()
    .min(2, { message: "Full name must be at least 2 characters long" }),
});

export type CompleteRegistrationInput = z.infer<typeof completeRegistrationSchema>;
