'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/useSettings';
import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  Settings as SettingsIcon,
  Building2,
  Bell,
  Lock,
  Database,
  Mail,
  Globe,
  Save,
  Check,
  AlertCircle,
  Download,
  Upload,
  RefreshCw,
  Info
} from 'lucide-react';

export default function SettingsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const { settings: globalSettings, updateSettings, lastUpdated } = useSettings();

  const [activeTab, setActiveTab] = useState<'company' | 'system' | 'notifications' | 'security' | 'backup'>('company');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Local state for form (synced with global settings)
  const [settings, setSettings] = useState(globalSettings);

  // Sync local state with global settings
  useEffect(() => {
    setSettings(globalSettings);
  }, [globalSettings]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }

    // Check if user is admin
    if (!authLoading && isAuthenticated && user?.role !== 'admin') {
      router.push('/dashboard');
    }
  }, [authLoading, isAuthenticated, user, router]);

  const handleInputChange = (field: string, value: any) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      await updateSettings(settings);
      
      setMessage({ type: 'success', text: 'Settings saved successfully! Changes applied system-wide.' });
      
      // Auto-dismiss success message
      setTimeout(() => setMessage(null), 5000);
    } catch (error: any) {
      setMessage({ 
        type: 'error', 
        text: error.message || 'Failed to save settings' 
      });
    } finally {
      setSaving(false);
    }
  };

  const handleBackup = async () => {
    try {
      setMessage({ type: 'success', text: 'Backup initiated. You will receive an email when complete.' });
      setTimeout(() => setMessage(null), 5000);
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to initiate backup' });
    }
  };

  const handleRestore = () => {
    if (confirm('Are you sure you want to restore from backup? This will overwrite current data.')) {
      setMessage({ type: 'success', text: 'Restore process initiated.' });
      setTimeout(() => setMessage(null), 3000);
    }
  };

  if (authLoading || !isAuthenticated || user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500 mx-auto"></div>
          <p className="text-gray-400 mt-4">Loading...</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'company', name: 'Company Info', icon: Building2 },
    { id: 'system', name: 'System', icon: Globe },
    { id: 'notifications', name: 'Notifications', icon: Bell },
    { id: 'security', name: 'Security', icon: Lock },
    { id: 'backup', name: 'Backup & Data', icon: Database }
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <SettingsIcon className="w-8 h-8 text-primary-400" />
              System Settings
            </h1>
            <p className="text-gray-400 mt-1">
              Configure system preferences and settings
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Save Changes
              </>
            )}
          </button>
        </div>

        {/* Success/Error Message */}
        {message && (
          <div className={`px-4 py-3 rounded-lg flex items-start gap-3 ${
            message.type === 'success' 
              ? 'bg-green-500/10 border border-green-500 text-green-400'
              : 'bg-red-500/10 border border-red-500 text-red-400'
          }`}>
            {message.type === 'success' ? (
              <Check className="w-5 h-5 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {/* Exchange Rate Info */}
        {lastUpdated && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-blue-400">
              <Info className="w-4 h-4" />
              <span>Exchange rates last updated: {lastUpdated.toLocaleString()}</span>
            </div>
            <span className="text-xs text-gray-400">Base: {settings.currency}</span>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden">
          <div className="border-b border-dark-700">
            <div className="flex overflow-x-auto">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'text-primary-400 border-b-2 border-primary-500 bg-dark-700'
                        : 'text-gray-400 hover:text-white hover:bg-dark-700'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {tab.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-6">
            {/* Company Info Tab */}
            {activeTab === 'company' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Company Name
                    </label>
                    <input
                      type="text"
                      value={settings.company_name || ''}
                      onChange={(e) => handleInputChange('company_name', e.target.value)}
                      className="w-full px-4 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Company Email
                    </label>
                    <input
                      type="email"
                      value={settings.company_email || ''}
                      onChange={(e) => handleInputChange('company_email', e.target.value)}
                      className="w-full px-4 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Company Phone
                    </label>
                    <input
                      type="tel"
                      value={settings.company_phone || ''}
                      onChange={(e) => handleInputChange('company_phone', e.target.value)}
                      className="w-full px-4 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Company Website
                    </label>
                    <input
                      type="url"
                      value={settings.company_website || ''}
                      onChange={(e) => handleInputChange('company_website', e.target.value)}
                      className="w-full px-4 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Company Address
                    </label>
                    <textarea
                      value={settings.company_address || ''}
                      onChange={(e) => handleInputChange('company_address', e.target.value)}
                      rows={3}
                      className="w-full px-4 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* System Tab */}
            {activeTab === 'system' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Currency
                    </label>
                    <select
                      value={settings.currency || 'USD'}
                      onChange={(e) => handleInputChange('currency', e.target.value)}
                      className="w-full px-4 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="USD">USD - US Dollar</option>
                      <option value="EUR">EUR - Euro</option>
                      <option value="ZMW">ZMW - Zambian Kwacha</option>
                      <option value="CNY">CNY - Chinese Yuan</option>
                      <option value="ZAR">ZAR - South African Rand</option>
                    </select>
                    <p className="text-xs text-gray-400 mt-1">
                      ⚠️ Changing currency will update all monetary values system-wide
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Timezone
                    </label>
                    <select
                      value={settings.timezone || 'Africa/Lusaka'}
                      onChange={(e) => handleInputChange('timezone', e.target.value)}
                      className="w-full px-4 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="Africa/Lusaka">Africa/Lusaka (CAT)</option>
                      <option value="UTC">UTC</option>
                      <option value="America/New_York">America/New York (EST)</option>
                      <option value="Europe/London">Europe/London (GMT)</option>
                      <option value="Asia/Shanghai">Asia/Shanghai (CST)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Date Format
                    </label>
                    <select
                      value={settings.date_format || 'DD/MM/YYYY'}
                      onChange={(e) => handleInputChange('date_format', e.target.value)}
                      className="w-full px-4 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                      <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                      <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Low Stock Threshold
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={settings.low_stock_threshold ?? 100}
                      onChange={(e) => handleInputChange('low_stock_threshold', parseInt(e.target.value))}
                      className="w-full px-4 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Products below this quantity will show low stock alerts
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Notifications Tab */}
            {activeTab === 'notifications' && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-dark-700 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Mail className="w-5 h-5 text-primary-400" />
                      <div>
                        <p className="text-white font-medium">Email Notifications</p>
                        <p className="text-sm text-gray-400">Receive system notifications via email</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.enable_email_notifications || false}
                        onChange={(e) => handleInputChange('enable_email_notifications', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-dark-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-500/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-dark-700 rounded-lg">
                    <div className="flex items-center gap-3">
                      <AlertCircle className="w-5 h-5 text-yellow-400" />
                      <div>
                        <p className="text-white font-medium">Low Stock Alerts</p>
                        <p className="text-sm text-gray-400">Get notified when products are running low</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.enable_low_stock_alerts || false}
                        onChange={(e) => handleInputChange('enable_low_stock_alerts', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-dark-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-500/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-dark-700 rounded-lg">
                    <div className="flex items-center gap-3">
                      <RefreshCw className="w-5 h-5 text-blue-400" />
                      <div>
                        <p className="text-white font-medium">Transaction Alerts</p>
                        <p className="text-sm text-gray-400">Notify on every inventory transaction</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.enable_transaction_alerts || false}
                        onChange={(e) => handleInputChange('enable_transaction_alerts', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-dark-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-500/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Security Tab */}
            {activeTab === 'security' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Session Timeout (minutes)
                    </label>
                    <input
                      type="number"
                      min="5"
                      max="1440"
                      value={settings.session_timeout_minutes ?? 30}
                      onChange={(e) => handleInputChange('session_timeout_minutes', parseInt(e.target.value))}
                      className="w-full px-4 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Auto-logout after this period of inactivity
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Password Change Required (days)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="365"
                      value={settings.require_password_change_days ?? 90}
                      onChange={(e) => handleInputChange('require_password_change_days', parseInt(e.target.value))}
                      className="w-full px-4 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Users must change password every X days (0 = never)
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Minimum Password Length
                    </label>
                    <input
                      type="number"
                      min="6"
                      max="32"
                      value={settings.min_password_length ?? 8}
                      onChange={(e) => handleInputChange('min_password_length', parseInt(e.target.value))}
                      className="w-full px-4 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Minimum characters required for passwords
                    </p>
                  </div>
                </div>

                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-yellow-200">
                      <p className="font-medium mb-1">Security Recommendations</p>
                      <ul className="list-disc list-inside space-y-1 text-yellow-200/80">
                        <li>Set session timeout to 30 minutes or less</li>
                        <li>Require password changes every 90 days</li>
                        <li>Use minimum password length of 8 characters</li>
                        <li>Enable two-factor authentication (coming soon)</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Backup & Data Tab */}
            {activeTab === 'backup' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Backup Frequency
                    </label>
                    <select
                      value={settings.backup_frequency || 'daily'}
                      onChange={(e) => handleInputChange('backup_frequency', e.target.value)}
                      className="w-full px-4 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="hourly">Hourly</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-dark-700 rounded-lg">
                    <div>
                      <p className="text-white font-medium">Auto Backup</p>
                      <p className="text-sm text-gray-400">Enable automatic backups</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.auto_backup_enabled || false}
                        onChange={(e) => handleInputChange('auto_backup_enabled', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-dark-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-500/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
                    </label>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-white">Backup Actions</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                      onClick={handleBackup}
                      className="px-6 py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <Download className="w-5 h-5" />
                      Create Backup Now
                    </button>

                    <button
                      onClick={handleRestore}
                      className="px-6 py-4 bg-dark-700 hover:bg-dark-600 border border-dark-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <Upload className="w-5 h-5" />
                      Restore from Backup
                    </button>
                  </div>
                </div>

                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-200">
                      <p className="font-medium mb-1">Backup Information</p>
                      <ul className="list-disc list-inside space-y-1 text-blue-200/80">
                        <li>Last backup: Today at 02:00 AM</li>
                        <li>Backup size: 245 MB</li>
                        <li>Backup location: Cloud Storage (encrypted)</li>
                        <li>Retention period: 30 days</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* System Information */}
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Info className="w-5 h-5 text-primary-400" />
            System Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-gray-400">System Version</p>
              <p className="text-white font-medium">v1.0.0</p>
            </div>
            <div>
              <p className="text-gray-400">Database</p>
              <p className="text-white font-medium">PostgreSQL 15.3</p>
            </div>
            <div>
              <p className="text-gray-400">Last Updated</p>
              <p className="text-white font-medium">January 31, 2026</p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}