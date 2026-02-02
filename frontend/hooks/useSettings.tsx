'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface SystemSettings {
  company_name: string;
  company_address: string;
  company_phone: string;
  company_email: string;
  company_website: string;
  currency: string;
  timezone: string;
  date_format: string;
  low_stock_threshold: number;
  enable_email_notifications: boolean;
  enable_low_stock_alerts: boolean;
  enable_transaction_alerts: boolean;
  backup_frequency: string;
  auto_backup_enabled: boolean;
  session_timeout_minutes: number;
  require_password_change_days: number;
  min_password_length: number;
}

export interface ExchangeRates {
  [key: string]: number;
}

interface SettingsContextType {
  settings: SystemSettings;
  exchangeRates: ExchangeRates;
  updateSettings: (newSettings: Partial<SystemSettings>) => Promise<void>;
  formatCurrency: (amount: number, fromCurrency?: string) => string;
  convertCurrency: (amount: number, fromCurrency: string, toCurrency?: string) => number;
  isLoading: boolean;
  lastUpdated: Date | null;
}

const defaultSettings: SystemSettings = {
  company_name: 'Vilagio Technologies Ltd.',
  company_address: 'Plot 28441, Gymkhana, Kitwe Road, Chingola, Zambia',
  company_phone: '+260 571 669 256',
  company_email: 'info@vilag.io',
  company_website: 'https://vilag.io',
  currency: 'USD',
  timezone: 'Africa/Lusaka',
  date_format: 'DD/MM/YYYY',
  low_stock_threshold: 100,
  enable_email_notifications: true,
  enable_low_stock_alerts: true,
  enable_transaction_alerts: false,
  backup_frequency: 'daily',
  auto_backup_enabled: true,
  session_timeout_minutes: 30,
  require_password_change_days: 90,
  min_password_length: 8
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SystemSettings>(defaultSettings);
  const [exchangeRates, setExchangeRates] = useState<ExchangeRates>({});
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Load settings from localStorage on mount
  useEffect(() => {
    const loadSettings = () => {
      try {
        const saved = localStorage.getItem('vilagio_settings');
        if (saved) {
          const parsed = JSON.parse(saved);
          setSettings({ ...defaultSettings, ...parsed });
        }
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading settings:', error);
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []);

  // Load exchange rates when currency changes
  useEffect(() => {
    const fetchExchangeRates = async () => {
      try {
        // Using exchangerate-api.com (free tier - 1500 requests/month)
        const response = await fetch(
          `https://api.exchangerate-api.com/v4/latest/${settings.currency}`
        );
        
        if (response.ok) {
          const data = await response.json();
          setExchangeRates(data.rates);
          setLastUpdated(new Date(data.date));
          
          // Cache exchange rates in localStorage (valid for 24 hours)
          localStorage.setItem('vilagio_exchange_rates', JSON.stringify({
            rates: data.rates,
            base: settings.currency,
            timestamp: Date.now()
          }));
        }
      } catch (error) {
        console.error('Error fetching exchange rates:', error);
        
        // Try to load cached rates
        try {
          const cached = localStorage.getItem('vilagio_exchange_rates');
          if (cached) {
            const { rates, base, timestamp } = JSON.parse(cached);
            // Use cached rates if less than 24 hours old and same base currency
            if (base === settings.currency && Date.now() - timestamp < 24 * 60 * 60 * 1000) {
              setExchangeRates(rates);
              setLastUpdated(new Date(timestamp));
            }
          }
        } catch (cacheError) {
          console.error('Error loading cached rates:', cacheError);
        }
      }
    };

    fetchExchangeRates();
  }, [settings.currency]);

  const updateSettings = async (newSettings: Partial<SystemSettings>) => {
    try {
      const updated = { ...settings, ...newSettings };
      
      // Save to localStorage
      localStorage.setItem('vilagio_settings', JSON.stringify(updated));
      
      // Update state
      setSettings(updated);
      
      // In production, also save to backend:
      // await axios.put(`${process.env.NEXT_PUBLIC_API_URL}/settings`, updated, {
      //   headers: { Authorization: `Bearer ${token}` }
      // });
      
    } catch (error) {
      console.error('Error saving settings:', error);
      throw error;
    }
  };

  const getCurrencySymbol = (currency: string): string => {
    const symbols: { [key: string]: string } = {
      'USD': '$',
      'EUR': '€',
      'ZMW': 'ZK',
      'CNY': '¥',
      'ZAR': 'R'
    };
    return symbols[currency] || currency + ' ';
  };

  const formatCurrency = (amount: number, fromCurrency?: string): string => {
    const targetCurrency = settings.currency;
    const symbol = getCurrencySymbol(targetCurrency);
    
    // If fromCurrency is provided and different from target, convert first
    let finalAmount = amount;
    if (fromCurrency && fromCurrency !== targetCurrency && exchangeRates[targetCurrency]) {
      finalAmount = convertCurrency(amount, fromCurrency, targetCurrency);
    }
    
    // Format with proper decimals and thousands separator
    const formatted = finalAmount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    
    return `${symbol}${formatted}`;
  };

  const convertCurrency = (
    amount: number, 
    fromCurrency: string, 
    toCurrency?: string
  ): number => {
    const target = toCurrency || settings.currency;
    
    if (fromCurrency === target) {
      return amount;
    }
    
    // If we have exchange rates and both currencies are available
    if (exchangeRates[fromCurrency] && exchangeRates[target]) {
      // Convert to base currency first, then to target
      const inBaseCurrency = amount / exchangeRates[fromCurrency];
      return inBaseCurrency * exchangeRates[target];
    }
    
    // If no exchange rate available, return original amount
    console.warn(`Exchange rate not available for ${fromCurrency} to ${target}`);
    return amount;
  };

  return (
    <SettingsContext.Provider
      value={{
        settings,
        exchangeRates,
        updateSettings,
        formatCurrency,
        convertCurrency,
        isLoading,
        lastUpdated
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
