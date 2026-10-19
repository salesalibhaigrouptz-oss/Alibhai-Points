import { z } from "zod";

export const completeRegistrationSchema = z.object({
  full_name: z
    .string({ required_error: "Full name is required" })
    .trim()
    .min(2, { message: "Full name must be at least 2 characters long" })
    .max(100, { message: "Full name must be less than 100 characters" })
    .regex(/^[a-zA-Z\s'-]+$/, { message: "Full name can only contain letters, spaces, hyphens, and apostrophes" }),
  city: z
    .string({ required_error: "City is required" })
    .trim()
    .min(2, { message: "City must be at least 2 characters long" })
    .max(60, { message: "City must be less than 60 characters" }),
}).strict();

export type CompleteRegistrationInput = z.infer<typeof completeRegistrationSchema>;

export const loginSchema = z
  .object({
    phone: z.string({ required_error: "Phone number is required" }).trim(),
    pin: z
      .string({ required_error: "PIN is required" })
      .trim()
      .regex(/^\d{6}$/, { message: "PIN must be exactly 6 digits" }),
  })
  .strict();

export type LoginInput = z.infer<typeof loginSchema>;

export const changePinSchema = z.object({
  current_pin: z
    .string({ required_error: "current_pin is required" })
    .regex(/^\d{6}$/, { message: "current_pin must be exactly 6 digits" }),
  new_pin: z
    .string({ required_error: "new_pin is required" })
    .regex(/^\d{6}$/, { message: "new_pin must be exactly 6 digits" }),
}).strict();

export type ChangePinInput = z.infer<typeof changePinSchema>;

export const signupSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, { message: "Full name must be at least 2 characters long" })
    .max(100)
    .optional(),
  full_name: z
    .string()
    .trim()
    .min(2, { message: "Full name must be at least 2 characters long" })
    .max(100)
    .optional(),
  city: z
    .string()
    .trim()
    .min(2, { message: "City must be at least 2 characters long" })
    .max(60)
    .optional(),
  phone: z.string({ required_error: "Phone number is required" }).trim(),
  pin: z
    .string({ required_error: "PIN is required" })
    .trim()
    .regex(/^\d{6}$/, { message: "PIN must be exactly 6 digits" }),
});

export type SignupInput = z.infer<typeof signupSchema>;
