import { Prisma } from "@prisma/client";

/** Persist a JSON numeric amount (decimals allowed) without float binary noise. */
export function toPrismaDecimal(value: number): Prisma.Decimal {
  return new Prisma.Decimal(String(value));
}
