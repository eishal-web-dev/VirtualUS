import { z } from "zod";

// E.164: + followed by 8 to 15 digits, first digit 1-9.
export const e164Schema = z
  .string()
  .regex(/^\+[1-9]\d{7,14}$/, "Phone number must be in E.164 format, e.g. +13125551234");

export const areaCodeSchema = z
  .string()
  .regex(/^\d{3}$/, "Area code must be exactly 3 digits");

export const signupSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(200),
  businessName: z.string().max(200).optional(),
  country: z.string().max(2).default("US"),
});

export const purchaseNumberSchema = z.object({
  phoneNumber: e164Schema,
  areaCode: areaCodeSchema,
});

export const outboundCallSchema = z.object({
  To: e164Schema.optional(),
  to: e164Schema.optional(),
});

export function isValidE164(value: string): boolean {
  return e164Schema.safeParse(value).success;
}
