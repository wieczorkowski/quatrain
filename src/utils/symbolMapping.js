const cmeMonthCodes = {
  F: '01', // January
  G: '02', // February
  H: '03', // March
  J: '04', // April
  K: '05', // May
  M: '06', // June
  N: '07', // July
  Q: '08', // August
  U: '09', // September
  V: '10', // October
  X: '11', // November
  Z: '12', // December
};

const ninjaTraderMonths = {
  '01': 'F', '02': 'G', '03': 'H', '04': 'J',
  '05': 'K', '06': 'M', '07': 'N', '08': 'Q',
  '09': 'U', '10': 'V', '11': 'X', '12': 'Z'
};

/**
 * Converts a CME futures symbol (e.g., ESM5, NQH24) to NinjaTrader format (e.g., ES 06-25).
 * Handles single-digit or two-digit years. Assumes single digit years are in the current/next decade.
 * Returns the original symbol if it doesn't match the expected futures format or conversion fails.
 * @param {string} cmeSymbol - The CME symbol (e.g., "ESM5", "NQH24").
 * @returns {string} The NinjaTrader symbol (e.g., "ES 06-25") or the original cmeSymbol.
 */
export const convertCmeToNinjaTrader = (cmeSymbol) => {
  if (!cmeSymbol || typeof cmeSymbol !== 'string') {
    console.error("Invalid CME symbol input:", cmeSymbol);
    return cmeSymbol; // Return original on invalid input
  }

  // Regex to capture root, month code, and year (1 or 2 digits)
  // Allows for roots of varying lengths (e.g., ES, NQ, ZN, 6E)
  const match = cmeSymbol.match(/^([A-Z0-9]{1,3})([FGHJKMNQUVXZ])(\d{1,2})$/i);

  if (!match) {
    // console.warn(`Symbol "${cmeSymbol}" does not match expected CME futures format (e.g., ESM5, NQH24). Returning original.`);
    // Don't warn for every non-future symbol, just return it
    return cmeSymbol;
  }

  const [, root, monthCode, yearDigits] = match;
  const upperMonthCode = monthCode.toUpperCase();

  const month = cmeMonthCodes[upperMonthCode];
  if (!month) {
    // Should not happen due to regex, but good practice to check
    console.error(`Invalid CME month code "${upperMonthCode}" in symbol "${cmeSymbol}"`);
    return cmeSymbol; // Return original on error
  }

  let year;
  const yearDigitsNum = parseInt(yearDigits, 10);

  if (yearDigits.length === 1) {
    // Handle single-digit year: Compare with the last digit of the current year
    const currentYear = new Date().getFullYear();
    const currentYearLastDigit = currentYear % 10; // e.g., 4 for 2024

    // If symbol's digit >= current year's last digit, assume current decade
    // If symbol's digit < current year's last digit, assume next decade
    if (yearDigitsNum >= currentYearLastDigit) {
      year = Math.floor(currentYear / 10) * 10 + yearDigitsNum; // e.g., 2024 -> floor(202.4)*10 + 5 = 2020 + 5 = 2025
    } else {
      year = Math.floor(currentYear / 10) * 10 + 10 + yearDigitsNum; // e.g., 2024 -> floor(202.4)*10 + 10 + 3 = 2020 + 10 + 3 = 2033
    }
  } else { // 2 digit year
    // Assume 20xx century
    year = 2000 + yearDigitsNum; // e.g., 24 -> 2024
  }

  // Ensure year calculation produced a number
  if (isNaN(year)) {
    console.error(`Could not determine year for symbol "${cmeSymbol}"`);
    return cmeSymbol; // Return original on error
  }

  const twoDigitYearStr = String(year % 100).padStart(2, '0'); // Get '25' from 2025

  // Format: Root Space Month-Year
  return `${root.toUpperCase()} ${month}-${twoDigitYearStr}`;
};

/**
 * Converts a NinjaTrader futures symbol (e.g., ES 06-25) to CME format (e.g., ESM5).
 * Returns the original symbol if it doesn't match the expected NinjaTrader futures format or conversion fails.
 * Assumes 2-digit years refer to the 2000s (e.g., 25 -> 2025).
 * Uses single-digit year for CME format if year is within current decade + 10 years.
 * @param {string} ntSymbol - The NinjaTrader symbol (e.g., "ES 06-25").
 * @returns {string} The CME symbol (e.g., "ESM5", "NQH24") or the original ntSymbol.
 */
export const convertNinjaTraderToCme = (ntSymbol) => {
  if (!ntSymbol || typeof ntSymbol !== 'string') {
    console.error("Invalid NinjaTrader symbol input:", ntSymbol);
    return ntSymbol; // Return original on invalid input
  }

  // Regex to capture root, month, and year
  // Allows for roots of varying lengths (e.g., ES, NQ, ZN, 6E)
  const match = ntSymbol.match(/^([A-Z0-9]{1,3}) (\d{2})-(\d{2})$/i);

  if (!match) {
    // Don't warn for every non-future symbol, just return it
    return ntSymbol;
  }

  const [, root, monthDigits, yearDigits] = match;
  const upperRoot = root.toUpperCase();

  const monthCode = ninjaTraderMonths[monthDigits];
  if (!monthCode) {
    console.error(`Invalid month digits "${monthDigits}" in NinjaTrader symbol "${ntSymbol}"`);
    return ntSymbol; // Return original on error
  }

  const yearNum = parseInt(yearDigits, 10);
  const fullYear = 2000 + yearNum; // Assume 20xx

  // Determine if we should use single-digit or two-digit year for CME
  const currentYear = new Date().getFullYear();
  let yearCode;
  // Use single digit if the year is within the next ~9 years relative to current decade start
  if (fullYear >= (Math.floor(currentYear / 10) * 10) && fullYear < (Math.floor(currentYear / 10) * 10 + 10)) {
     yearCode = String(fullYear % 10); // Single digit (e.g., 5 for 2025)
  } else {
     yearCode = String(fullYear % 100).padStart(2, '0'); // Two digits (e.g., 33 for 2033)
  }

  // Format: RootMonthCodeYearCode
  return `${upperRoot}${monthCode}${yearCode}`;
}; 