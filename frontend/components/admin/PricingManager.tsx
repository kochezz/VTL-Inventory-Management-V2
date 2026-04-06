'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import axios from 'axios';
import { Save, RefreshCw, Lock, BadgeDollarSign } from 'lucide-react';

export default function PricingManager() {
  const { user, token } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Security Gate: Only Admin, CEO, or CFO
  const isAuthorized = ['admin', 'ceo', 'cfo'].includes(user?.role?.toLowerCase() || '');

  useEffect(() => {
    if (isAuthorized && token) fetchProducts();
  }, [isAuthorized, token]);

  const fetchProducts = async () => {
    try {
      const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/products?limit=100`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProducts(res.data.products);
      setLoading(false);
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to load products' });
    }
  };

  const handlePriceChange = (index: number, field: 'selling_price' | 'selling_price_zmw', value: string) => {
    const updated = [...products];
    updated[index][field] = parseFloat(value) || 0;
    setProducts(updated);
  };

  const savePrices = async () => {
    setSaving(true);
    setMessage({ type: '', text: '' });
    try {
      await axios.put(`${process.env.NEXT_PUBLIC_API_URL}/products/pricing`, 
        { products }, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessage({ type: 'success', text: 'Pricing successfully updated across POS and ERP systems.' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to save pricing.' });
    } finally {
      setSaving(false);
    }
  };

  if (!isAuthorized) {
    return (
      <div className="bg-red-500/10 border border-red-500 rounded-xl p-6 text-center max-w-2xl mx-auto mt-12">
        <Lock className="w-8 h-8 text-red-400 mx-auto mb-3" />
        <h3 className="text-red-400 font-bold text-lg">Access Restricted</h3>
        <p className="text-sm text-gray-400 mt-1">Global pricing management requires Executive or Administrator privileges.</p>
      </div>
    );
  }

  return (
    <div className="max-w-screen-xl mx-auto space-y-4">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-500/10 rounded-lg">
            <BadgeDollarSign className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Pricing Manager</h1>
            <p className="text-xs text-gray-400">Updates here apply instantly to POS, Wholesale, and Accounting.</p>
          </div>
        </div>
        <button onClick={fetchProducts} className="p-2 bg-dark-800 border border-dark-700 rounded-lg hover:bg-dark-700 transition">
          <RefreshCw className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {message.text && (
        <div className={`p-4 rounded-xl border text-sm flex items-center ${message.type === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
          {message.text}
        </div>
      )}

      <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden">
        {loading ? (
          <p className="p-6 text-center text-gray-400">Loading products...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="bg-dark-900 border-b border-dark-700">
                <tr>
                  <th className="px-6 py-4 font-semibold text-gray-400">Product / SKU</th>
                  <th className="px-6 py-4 font-semibold text-gray-400 w-48">Base USD Price ($)</th>
                  <th className="px-6 py-4 font-semibold text-gray-400 w-48">Local ZMW Price (K)</th>
                  <th className="px-6 py-4 font-semibold text-gray-400 text-right">Implied Ex. Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700">
                {products.map((p, i) => (
                  <tr key={p.product_id} className="hover:bg-dark-750 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-bold text-white">{p.product_name}</span><br/>
                      <span className="text-xs text-gray-500">{p.sku}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">$</span>
                        <input type="number" step="0.01" value={p.selling_price || ''} 
                          onChange={(e) => handlePriceChange(i, 'selling_price', e.target.value)}
                          className="w-full bg-dark-900 border border-dark-600 focus:border-green-500 rounded px-3 py-1.5 text-white outline-none transition" />
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">K</span>
                        <input type="number" step="0.01" value={p.selling_price_zmw || ''} 
                          onChange={(e) => handlePriceChange(i, 'selling_price_zmw', e.target.value)}
                          className="w-full bg-dark-900 border border-dark-600 focus:border-green-500 rounded px-3 py-1.5 text-white outline-none transition" />
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500 text-right font-mono">
                      {p.selling_price > 0 && p.selling_price_zmw > 0 
                        ? `1 USD = ${(p.selling_price_zmw / p.selling_price).toFixed(2)} ZMW` 
                        : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="p-4 border-t border-dark-700 bg-dark-800 flex justify-end">
          <button onClick={savePrices} disabled={saving} 
            className="bg-green-500 hover:bg-green-600 text-white font-bold py-2.5 px-6 rounded-lg flex items-center gap-2 transition disabled:opacity-50">
            <Save className="w-4 h-4" /> {saving ? 'Publishing...' : 'Publish Prices Globally'}
          </button>
        </div>
      </div>
    </div>
  );
}