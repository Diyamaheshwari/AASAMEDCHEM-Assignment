const Decimal = require('decimal.js');

// Copy exact formulas from converter.ts for validation
const CONVERSION_FACTORS = {
  g: 1,
  kg: 1000,
  mL: 1,
  L: 1000,
  items: 1,
};

function convertToBase(quantity, unit) {
  const qty = new Decimal(quantity);
  const factor = CONVERSION_FACTORS[unit];
  if (!factor) throw new Error(`Unsupported unit: ${unit}`);
  return qty.times(factor);
}

function convertFromBase(quantityInBase, unit) {
  const qtyBase = new Decimal(quantityInBase);
  const factor = CONVERSION_FACTORS[unit];
  if (!factor) throw new Error(`Unsupported unit: ${unit}`);
  return qtyBase.dividedBy(factor);
}

function calculateUnitPrice(basePrice, unit) {
  const price = new Decimal(basePrice);
  const factor = CONVERSION_FACTORS[unit];
  if (!factor) throw new Error(`Unsupported unit: ${unit}`);
  return price.times(factor);
}

function calculateItemPrice(basePrice, orderedQuantity, orderedUnit) {
  const baseQty = convertToBase(orderedQuantity, orderedUnit);
  const price = new Decimal(basePrice);
  return baseQty.times(price);
}

// Running validation suites
function runTests() {
  console.log('=== RUNNING CONVERSION ENGINE VALIDATION TESTS ===\n');
  let passCount = 0;
  let failCount = 0;

  function assertEqual(actual, expected, testName) {
    if (actual.toString() === expected.toString()) {
      console.log(`[PASS] ${testName}`);
      passCount++;
    } else {
      console.error(`[FAIL] ${testName} - Expected: ${expected}, Got: ${actual}`);
      failCount++;
    }
  }

  // Suite 1: convertToBase
  assertEqual(convertToBase(1.5, 'kg'), 1500, 'convertToBase: 1.5 kg -> 1500 g');
  assertEqual(convertToBase(250, 'g'), 250, 'convertToBase: 250 g -> 250 g');
  assertEqual(convertToBase(2.75, 'L'), 2750, 'convertToBase: 2.75 L -> 2750 mL');
  assertEqual(convertToBase(10, 'items'), 10, 'convertToBase: 10 items -> 10 items');

  // Suite 2: convertFromBase
  assertEqual(convertFromBase(1500, 'kg'), 1.5, 'convertFromBase: 1500 g -> 1.5 kg');
  assertEqual(convertFromBase(350, 'g'), 350, 'convertFromBase: 350 g -> 350 g');
  assertEqual(convertFromBase(2750, 'L'), 2.75, 'convertFromBase: 2750 mL -> 2.75 L');
  assertEqual(convertFromBase(50, 'items'), 50, 'convertFromBase: 50 items -> 50 items');

  // Suite 3: calculateUnitPrice & calculateItemPrice (INR calculations)
  // Reagent: Sodium Chloride AR. Base Price = 0.85 INR/g (₹850/kg)
  const saltBasePrice = '0.85';
  assertEqual(calculateUnitPrice(saltBasePrice, 'kg'), 850, 'calculateUnitPrice: ₹0.85/g -> ₹850/kg');
  assertEqual(calculateItemPrice(saltBasePrice, '1.5', 'kg'), 1275, 'calculateItemPrice: 1.5 kg at ₹0.85/g -> ₹1275.00');
  assertEqual(calculateItemPrice(saltBasePrice, '250', 'g'), 212.5, 'calculateItemPrice: 250 g at ₹0.85/g -> ₹212.50');

  // Reagent: Ethanol 99%. Base Price = 0.15 INR/mL (₹150/L)
  const ethanolBasePrice = '0.15';
  assertEqual(calculateUnitPrice(ethanolBasePrice, 'L'), 150, 'calculateUnitPrice: ₹0.15/mL -> ₹150/L');
  assertEqual(calculateItemPrice(ethanolBasePrice, '3.5', 'L'), 525, 'calculateItemPrice: 3.5 L at ₹0.15/mL -> ₹525.00');

  // Equipment: Volumetric Pipette. Base Price = 320.00 INR/item
  const pipetteBasePrice = '320.00';
  assertEqual(calculateUnitPrice(pipetteBasePrice, 'items'), 320, 'calculateUnitPrice: ₹320/item -> ₹320/item');
  assertEqual(calculateItemPrice(pipetteBasePrice, '5', 'items'), 1600, 'calculateItemPrice: 5 items at ₹320/item -> ₹1600.00');

  console.log(`\n=== TEST RESULTS Summary: ${passCount} PASSED, ${failCount} FAILED ===`);
  if (failCount > 0) {
    process.exit(1);
  }
}

runTests();
