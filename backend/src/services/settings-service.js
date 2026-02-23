const { pool } = require('../services/auth-service');
const axios = require('axios');

class SettingsService {
  // Free, reliable, open API for daily exchange rates
  static EXCHANGE_API_URL = 'https://open.er-api.com/v6/latest/USD';

  static async getSettings() {
    // 1. Get settings from DB
    const result = await pool.query('SELECT * FROM system_settings LIMIT 1');
    let settings = result.rows[0];

    // If no settings exist yet, create default ones
    if (!settings) {
      const defaultInsert = await pool.query(`
        INSERT INTO system_settings (currency, timezone, low_stock_threshold) 
        VALUES ('USD', 'Africa/Lusaka', 100) RETURNING *
      `);
      settings = defaultInsert.rows[0];
    }

    // 2. Fetch today's live exchange rates in the background
    try {
      // Only fetch if rates are older than 12 hours to save bandwidth
      const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
      
      if (!settings.exchange_rates || new Date(settings.rates_last_updated) < twelveHoursAgo) {
        const response = await axios.get(this.EXCHANGE_API_URL);
        const rates = response.data.rates;

        // Save the new live rates to the database
        await pool.query(
          `UPDATE system_settings SET exchange_rates = $1, rates_last_updated = CURRENT_TIMESTAMP`,
          [JSON.stringify(rates)]
        );
        
        settings.exchange_rates = rates;
        settings.rates_last_updated = new Date();
      }
    } catch (error) {
      console.error('Failed to fetch live exchange rates:', error.message);
      // It will gracefully fall back to the last known rates stored in the DB
    }

    return settings;
  }

  static async updateSettings(updates) {
    const { 
      company_name, company_email, currency, timezone, 
      low_stock_threshold, enable_email_notifications 
    } = updates;

    const result = await pool.query(
      `UPDATE system_settings SET 
        company_name = COALESCE($1, company_name),
        company_email = COALESCE($2, company_email),
        currency = COALESCE($3, currency),
        timezone = COALESCE($4, timezone),
        low_stock_threshold = COALESCE($5, low_stock_threshold),
        enable_email_notifications = COALESCE($6, enable_email_notifications),
        updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [company_name, company_email, currency, timezone, low_stock_threshold, enable_email_notifications]
    );

    return result.rows[0];
  }
}

module.exports = SettingsService;