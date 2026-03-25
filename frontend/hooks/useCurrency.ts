'use client';

import { useSettings } from '@/hooks/useSettings';

export function useCurrency() {
  const { settings } = useSettings();

  /**
   * Converts a base USD amount to the globally selected currency
   * and formats it beautifully (e.g., $10.00, €9.20, ZMW 265.50)
   */
  const formatPrice = (baseAmount: number | null | undefined) => {
    // Handle empty or invalid numbers gracefully
    if (baseAmount === null || baseAmount === undefined || isNaN(baseAmount)) {
      return 'N/A';
    }

    // safely cast settings to 'any' to bypass strict TypeScript interface checks
    const safeSettings = settings as any;

    // 1. Get the target currency and rates from global settings
    const targetCurrency = safeSettings?.currency || 'USD';
    const rates = safeSettings?.exchange_rates || {};

    // 2. Calculate the multiplier 
    // (If the API fails or rates are missing, it defaults to 1 so the app doesn't crash)
    const multiplier = rates[targetCurrency] || 1;

    // 3. Convert the amount
    const convertedAmount = baseAmount * multiplier;

    // 4. Format the output using native browser currency formatting
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: targetCurrency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(convertedAmount);
  };

  return { formatPrice, currentCurrency: (settings as any)?.currency || 'USD' };
}