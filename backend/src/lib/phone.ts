import { z } from "zod";

/**
 * A phone number in international form without the plus, as it is stored and texted:
 * 2348031234567, 447700900123. Or null.
 *
 * Accepts what the web app's phone field sends (country code and number, digits only) and
 * what people type by hand: +44 7700 900123, 0044 7700 900123, and a Nigerian number as
 * dialled at home, 0803 123 4567.
 */
export function normalizePhone(input: string): string | null {
  const raw = input.trim();
  if (!/^\+?[\d\s().-]+$/.test(raw)) return null;
  let digits = raw.replace(/\D/g, "");
  if (!raw.startsWith("+")) {
    if (digits.startsWith("00")) digits = digits.slice(2);
    else if (digits.startsWith("0")) digits = `234${digits.slice(1)}`;
  }
  // "+234 0803…": the trunk zero is not dialled after the country code.
  if (digits.startsWith("2340")) digits = `234${digits.slice(4)}`;
  // E.164: at most fifteen digits, country code included.
  if (!/^[1-9]\d{7,14}$/.test(digits)) return null;
  if (digits.startsWith("234") && digits.length !== 13) return null;
  return digits;
}

/** Mobile numbers: 70x, 80x, 81x, 90x, 91x... ten digits after the country code. */
export const isNigerianMobile = (phone: string) => /^234[789][01]\d{8}$/.test(phone);

const hint = "e.g. +234 803 123 4567";

/** A required phone number, stored normalized. */
export const phoneField = (label: string) =>
  z
    .string({ error: `${label} is required.` })
    .trim()
    .max(30)
    .transform((v, ctx) => {
      const phone = normalizePhone(v);
      if (!phone)
        ctx.addIssue({ code: "custom", message: `${label} should be a phone number with its country, ${hint}.` });
      return phone ?? z.NEVER;
    });

/** An optional phone number: empty, or stored normalized. */
export const optionalPhoneField = (label: string) =>
  z
    .string()
    .trim()
    .max(30)
    .default("")
    .transform((v, ctx) => {
      if (v === "") return "";
      const phone = normalizePhone(v);
      if (!phone)
        ctx.addIssue({ code: "custom", message: `${label} should be a phone number with its country, ${hint}.` });
      return phone ?? z.NEVER;
    });
