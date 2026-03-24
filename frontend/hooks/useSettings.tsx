'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api, useAuth } from '@/hooks/useAuth'; // Added useAuth import

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

  // Load settings and rates from the BACKEND on mount
  useEffect(() => {
    const fetchSettings = async () => {
      // FIX: Check if we actually have a token before trying to fetch protected data
      const { token } = useAuth.getState(); 
      if (!token) {
        setIsLoading(false);
        return; 
      }

      try {
        setIsLoading(true);
        // Calls the new backend route we created: GET /api/settings
        const response = await api.get('/settings');
        
        if (response.data) {
          // Merge backend settings with defaults to ensure no missing fields
          setSettings({ ...defaultSettings, ...response.data });
          
          // The backend now securely provides the exchange rates!
          if (response.data.exchange_rates) {
            setExchangeRates(response.data.exchange_rates);
          }
          if (response.data.rates_last_updated) {
            setLastUpdated(new Date(response.data.rates_last_updated));
          }
        }
      } catch (error) {
        console.error('Failed to load system settings from database:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const updateSettings = async (newSettings: Partial<SystemSettings>) => {
    try {
      // 1. Send the update to the PostgreSQL database via our API
      const response = await api.put('/settings', newSettings);
      
      // 2. Update the local state instantly so the UI feels fast
      const updated = { ...settings, ...response.data.settings };
      setSettings(updated);
      
      // 3. Keep localStorage as a minor fallback (optional)
      localStorage.setItem('vilagio_settings', JSON.stringify(updated));
      
    } catch (error) {
      console.error('Error saving settings to database:', error);
      throw error;
    }
  };

  const getCurrencySymbol = (currency: string): string => {
    const symbols: { [key: string]: string } = {
      'USD': '$',
      'EUR': '€',
      'ZMW': 'ZK ',
      'CNY': '¥',
      'ZAR': 'R '
    };
    return symbols[currency] || currency + ' ';
  };

  const convertCurrency = (
    amount: number, 
    fromCurrency: string, 
    toCurrency?: string
  ): number => {
    // If the backend hasn't loaded rates yet, just return the raw amount
    if (Object.keys(exchangeRates).length === 0) return amount;

    const target = toCurrency || settings.currency;
    
    if (fromCurrency === target) {
      return amount;
    }
    
    // Convert based on the USD baseline from our backend ER-API
    const rateFrom = exchangeRates[fromCurrency] || 1;
    const rateTo = exchangeRates[target] || 1;
    
    // Convert to base USD first, then multiply by target rate
    const inBaseUSD = amount / rateFrom;
    return inBaseUSD * rateTo;
  };

  const formatCurrency = (amount: number, fromCurrency: string = 'USD'): string => {
    if (amount === null || amount === undefined || isNaN(amount)) {
      return 'N/A';
    }

    const targetCurrency = settings.currency;
    const symbol = getCurrencySymbol(targetCurrency);
    
    // Convert the amount to the target currency
    let finalAmount = convertCurrency(amount, fromCurrency, targetCurrency);
    
    // Format with proper decimals and thousands separator
    const formatted = finalAmount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    
    return `${symbol}${formatted}`;
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