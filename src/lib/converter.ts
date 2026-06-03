import Decimal from 'decimal.js';

// Set high precision config for Decimal (20 digits of precision)
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export type DimensionType = 'weight' | 'volume' | 'count';
export type BaseUnitType = 'g' | 'mL' | 'items';

export const UNIT_DIMENSIONS: Record<string, DimensionType> = {
  g: 'weight',
  kg: 'weight',
  mL: 'volume',
  L: 'volume',
  items: 'count',
};

export const BASE_UNITS: Record<DimensionType, BaseUnitType> = {
  weight: 'g',
  volume: 'mL',
  count: 'items',
};

// Conversion factors: How many base units are in 1 display unit
// e.g. 1 kg = 1000 g (base unit)
// e.g. 1 L = 1000 mL (base unit)
export const CONVERSION_FACTORS: Record<string, number> = {
  g: 1,
  kg: 1000,
  mL: 1,
  L: 1000,
  items: 1,
};

export const UNITS_BY_DIMENSION: Record<DimensionType, string[]> = {
  weight: ['g', 'kg'],
  volume: ['mL', 'L'],
  count: ['items'],
};

/**
 * Converts a quantity from a given unit to its base unit.
 * e.g. 1.5 kg -> 1500 g
 */
export function convertToBase(quantity: number | string | Decimal, unit: string): Decimal {
  const qty = new Decimal(quantity);
  const factor = CONVERSION_FACTORS[unit];
  if (!factor) {
    throw new Error(`Unsupported unit: ${unit}`);
  }
  return qty.times(factor);
}

/**
 * Converts a quantity from the base unit to a display unit.
 * e.g. 1500 g -> 1.5 kg
 */
export function convertFromBase(quantityInBase: number | string | Decimal, unit: string): Decimal {
  const qtyBase = new Decimal(quantityInBase);
  const factor = CONVERSION_FACTORS[unit];
  if (!factor) {
    throw new Error(`Unsupported unit: ${unit}`);
  }
  return qtyBase.dividedBy(factor);
}

/**
 * Calculates the unit price for a display unit based on the base price.
 * e.g. If base price is ₹0.85 per gram, unit price per kg is ₹0.85 * 1000 = ₹850.
 */
export function calculateUnitPrice(basePrice: number | string | Decimal, unit: string): Decimal {
  const price = new Decimal(basePrice);
  const factor = CONVERSION_FACTORS[unit];
  if (!factor) {
    throw new Error(`Unsupported unit: ${unit}`);
  }
  return price.times(factor);
}

/**
 * Calculates the total item price based on the base price, quantity, and unit ordered.
 */
export function calculateItemPrice(
  basePrice: number | string | Decimal,
  orderedQuantity: number | string | Decimal,
  orderedUnit: string
): Decimal {
  const baseQty = convertToBase(orderedQuantity, orderedUnit);
  const price = new Decimal(basePrice);
  return baseQty.times(price);
}

/**
 * Formats a Decimal value to a standard readable string for prices.
 * Currencies (INR) are formatted with 2 decimal places usually, but high decimal precision is preserved if needed.
 */
export function formatCurrency(amount: number | string | Decimal, precision: number = 2): string {
  const amt = new Decimal(amount);
  return amt.toFixed(precision);
}

/**
 * Formats a quantity, stripping trailing zeros for clean display if it is a whole number, 
 * or showing up to specified decimal places.
 */
export function formatQuantity(qty: number | string | Decimal, maxDecimals: number = 4): string {
  const q = new Decimal(qty);
  // If it's an integer, display as integer
  if (q.isInteger()) {
    return q.toFixed(0);
  }
  // Otherwise, format with maxDecimals and trim trailing zeros
  const fixed = q.toFixed(maxDecimals);
  return parseFloat(fixed).toString();
}
