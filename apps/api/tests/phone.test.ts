import { describe, it, expect } from "vitest";
import { toE164, isValidTanzanianPhone } from "../src/utils/phone.js";
import { AppError } from "../src/utils/errors.js";

describe("Phone Normalization (toE164)", () => {
  it("should normalize 10-digit number starting with 07 (e.g. 0712345678)", () => {
    expect(toE164("0712345678")).toBe("+255712345678");
  });

  it("should normalize 10-digit number starting with 06 (e.g. 0655123456)", () => {
    expect(toE164("0655123456")).toBe("+255655123456");
  });

  it("should normalize 9-digit local number (e.g. 712345678)", () => {
    expect(toE164("712345678")).toBe("+255712345678");
  });

  it("should normalize 9-digit local number starting with 6 (e.g. 682123456)", () => {
    expect(toE164("682123456")).toBe("+255682123456");
  });

  it("should normalize 12-digit number starting with 255 (e.g. 255712345678)", () => {
    expect(toE164("255712345678")).toBe("+255712345678");
  });

  it("should keep valid E.164 number with +255 (e.g. +255712345678)", () => {
    expect(toE164("+255712345678")).toBe("+255712345678");
  });

  it("should ignore spaces, dashes, dots and parentheses", () => {
    expect(toE164("+255 (712) 345-678")).toBe("+255712345678");
    expect(toE164("0712 345 678")).toBe("+255712345678");
    expect(toE164("0712-345-678")).toBe("+255712345678");
  });

  it("should throw AppError INVALID_PHONE for numbers that are too short", () => {
    expect(() => toE164("07123")).toThrowError(AppError);
    try {
      toE164("07123");
    } catch (e: any) {
      expect(e.code).toBe("INVALID_PHONE");
      expect(e.statusCode).toBe(400);
    }
  });

  it("should throw AppError INVALID_PHONE for numbers that are too long", () => {
    expect(() => toE164("25571234567899999")).toThrow(AppError);
  });

  it("should throw AppError INVALID_PHONE for invalid formats or non-phone strings", () => {
    expect(() => toE164("not-a-phone")).toThrow(AppError);
    expect(() => toE164("")).toThrow(AppError);
  });

  it("isValidTanzanianPhone helper correctly reports validity", () => {
    expect(isValidTanzanianPhone("0712345678")).toBe(true);
    expect(isValidTanzanianPhone("+255712345678")).toBe(true);
    expect(isValidTanzanianPhone("invalid")).toBe(false);
  });
});
