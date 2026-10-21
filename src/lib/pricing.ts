// Shared pricing utilities between client and server

export interface BatchPricing {
  1?: number;
  2?: number;
  3?: number;
  4?: number;
  5?: number;
  [key: string]: number | undefined;
}

/**
 * Validates whether a price value is a valid whole-rupee amount >= 1.
 * Returns true if valid, false if invalid (empty, 0, negative, decimal, non-numeric).
 */
export function isValidPrice(value: any): boolean {
  if (value === null || value === undefined || value === '') return false;
  const num = Number(value);
  if (isNaN(num)) return false;
  if (!Number.isFinite(num)) return false;
  if (!Number.isInteger(num)) return false;
  return num >= 1 && num <= 100000;
}

/**
 * Shared whole-rupee rounding function.
 * Rounds to nearest whole rupee, minimum 1.
 */
export function roundPrice(value: number): number {
  if (isNaN(value) || !Number.isFinite(value)) return 1;
  return Math.max(1, Math.round(value));
}

/**
 * Calculates default batch pricing tiers from a base hourly rate.
 * Tiers:
 * 1 (1-on-1): 100% of base rate
 * 2 (Duo): 80% (20% discount)
 * 3 (Trio): 70% (30% discount)
 * 4 (Cohort): 60% (40% discount)
 * 5 (Masterclass): 50% (50% discount)
 * All values are rounded to whole rupees.
 */
export function calculateBatchPricing(baseRate: number): Record<number, number> {
  const safeBase = roundPrice(baseRate);
  return {
    1: safeBase,
    2: roundPrice(safeBase * 0.8),
    3: roundPrice(safeBase * 0.7),
    4: roundPrice(safeBase * 0.6),
    5: roundPrice(safeBase * 0.5)
  };
}

/**
 * Calculates seat price for a given capacity (1 to 5).
 * Respects custom batchPricing if configured, otherwise falls back to standard discounts.
 */
export function calculateSeatPrice(peerOrBaseRate: any, capacity: number = 1): number {
  const cap = Math.min(Math.max(capacity || 1, 1), 5);

  if (peerOrBaseRate && typeof peerOrBaseRate === 'object') {
    const bp = peerOrBaseRate.batchPricing;
    if (bp && typeof bp === 'object') {
      const customPrice = bp[cap] ?? bp[String(cap)];
      if (isValidPrice(customPrice)) {
        return Number(customPrice);
      }
    }
    const base = (peerOrBaseRate.hourlyRate !== undefined && isValidPrice(peerOrBaseRate.hourlyRate))
      ? Number(peerOrBaseRate.hourlyRate)
      : 499;
    return calculateSeatPrice(base, cap);
  }

  const base = isValidPrice(peerOrBaseRate) ? Number(peerOrBaseRate) : 499;
  if (cap <= 1) return base;
  if (cap === 2) return roundPrice(base * 0.8);
  if (cap === 3) return roundPrice(base * 0.7);
  if (cap === 4) return roundPrice(base * 0.6);
  return roundPrice(base * 0.5);
}
