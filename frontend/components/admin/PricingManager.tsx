'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import axios from 'axios';
import { Save, RefreshCw, Lock, BadgeDollarSign, Search, Filter } from 'lucide-react';

interface PricingManagerProps {
  globalRate: number;
}

// --- RETAIL ROUNDING ALGORITHM ---
// Rounds decimals up to .50 or .99 based on standard retail pricing rules
const getRoundedListPrice = (exactPrice: number) => {
  if (!exactPrice) return 0;
  
  // Math.round fixes minor floating point errors like 7.000000001
  const cleanPrice = Math.round(exactPrice * 100) / 100; 
  const intPart = Math.floor(cleanPrice);
  const decPart = cleanPrice - intPart;

  if (decPart === 0) return cleanPrice;             // e.g., 70.00 stays 70.00
  if (decPart <= 0.50) return intPart + 0.50;       // e.g., 140.39 rounds to 140.50
  return intPart + 0.99;                            // e.g., 7.84 rounds to 7.99
};

export default function PricingManager({ globalRate }: PricingManagerProps) {
  const { user, token } = useAuth();
  
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const isAuthorized = ['admin', 'ceo', 'cfo'].includes(user?.role?.toLowerCase() || '');

  useEffect(() => {
    if (isAuthorized && token) {
      fetchData();
    }
  }, [isAuthorized, token]);

  const fetchData = async () => {
    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const [prodRes, catRes] = await Promise.all([
        axios.get(`${process.env.NEXT_PUBLIC_API_URL}/products?limit=500`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${process.env.NEXT_PUBLIC_API_URL}/products/categories`, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => ({ data: [] }))
      ]);
      
      setProducts(prodRes.data.products || []);
      setCategories(catRes.data || []);
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to load pricing data' });
    } finally {
      setLoading(false);
    }
  };

  // Update USD. The Exact ZMW and Rounded ZMW are handled automatically!
  const handlePriceChange = (productId: string, value: string) => {
    const usdPrice = parseFloat(value) || 0;
    const exactZmw = usdPrice * globalRate;

    setProducts(prev => prev.map(p => 
      p.product_id === productId 
        ? { 
            ...p, 
            selling_price: usdPrice,
            selling_price_zmw: getRoundedListPrice(exactZmw) // Apply the retail rounding
          } 
        : p
    ));
  };

  // When globalRate changes at the top level, recalculate all ZMW prices instantly
  useEffect(() => {
    if (products.length > 0) {
      setProducts(prev => prev.map(p => {
        const exactZmw = p.selling_price * globalRate;
        return {
          ...p,
          selling_price_zmw: getRoundedListPrice(exactZmw)
        };
      }));
    }
  }, [globalRate]);

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

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = (p.product_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (p.sku || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory = selectedCategory === '' || p.category_id === selectedCategory;
      
      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, selectedCategory]);

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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-500/10 rounded-lg">
            <BadgeDollarSign className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Pricing Manager</h1>
            <p className="text-xs text-gray-400">Updates here apply instantly to POS, Wholesale, and Accounting.</p>
          </div>
        </div>
        <button onClick={fetchData} className="p-2 bg-dark-800 border border-dark-700 rounded-lg hover:bg-dark-700 transition flex-shrink-0">
          <RefreshCw className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {message.text && (
        <div className={`p-4 rounded-xl border text-sm flex items-center ${message.type === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
          {message.text}
        </div>
      )}

      <div className="bg-dark-800 border border-dark-700 rounded-xl p-4 flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
          <input 
            type="text" 
            placeholder="Search by Product Name or SKU..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-dark-900 border border-dark-600 text-white text-sm rounded-lg pl-10 pr-4 py-2.5 focus:border-green-500 outline-none transition"
          />
        </div>
        
        <div className="md:w-64 relative">
          <Filter className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full bg-dark-900 border border-dark-600 text-white text-sm rounded-lg pl-10 pr-4 py-2.5 focus:border-green-500 outline-none transition appearance-none"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.category_id} value={cat.category_id}>
                {cat.category_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto mb-4"></div>
            <p className="text-gray-400">Loading products & categories...</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-300">
                <thead className="bg-dark-900 border-b border-dark-700">
                  <tr>
                    <th className="px-6 py-4 font-semibold text-gray-400">Product / SKU</th>
                    <th className="px-6 py-4 font-semibold text-gray-400 w-40">Base USD ($)</th>
                    <th className="px-6 py-4 font-semibold text-gray-500 w-40">Exact ZMW (K)</th>
                    <th className="px-6 py-4 font-semibold text-primary-400 w-40">POS List Price (K)</th>
                    <th className="px-6 py-4 font-semibold text-gray-400 text-right">Implied Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-700">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                        No products match your current filters.
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((p) => (
                      <tr key={p.product_id} className="hover:bg-dark-750 transition-colors">
                        <td className="px-6 py-4">
                          <span className="font-bold text-white">{p.product_name}</span><br/>
                          <span className="text-xs text-gray-500">{p.sku}</span>
                        </td>
                        
                        {/* BASE USD */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500">$</span>
                            <input 
                              type="number" 
                              step="0.01" 
                              value={p.selling_price || ''} 
                              onChange={(e) => handlePriceChange(p.product_id, e.target.value)}
                              className="w-full bg-dark-900 border border-dark-600 focus:border-green-500 rounded px-3 py-1.5 text-white outline-none transition" 
                            />
                          </div>
                        </td>

                        {/* EXACT ZMW (Faded/Disabled) */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-600">K</span>
                            <input 
                              type="text" 
                              value={(p.selling_price * globalRate).toFixed(2)} 
                              disabled
                              className="w-full bg-dark-900 border border-dark-700 rounded px-3 py-1.5 text-gray-500 outline-none cursor-not-allowed opacity-60" 
                              title="Exact raw conversion (USD x Rate)"
                            />
                          </div>
                        </td>

                        {/* POS LIST PRICE (Rounded & Emphasized) */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="text-primary-500 font-bold">K</span>
                            <input 
                              type="text" 
                              value={p.selling_price_zmw ? p.selling_price_zmw.toFixed(2) : ''} 
                              disabled
                              className="w-full bg-primary-900/20 border border-primary-500/30 rounded px-3 py-1.5 text-primary-400 font-bold outline-none cursor-not-allowed" 
                              title="Retail rounded price synced to POS"
                            />
                          </div>
                        </td>

                        {/* IMPLIED RATE */}
                        <td className="px-6 py-4 text-xs text-gray-500 text-right font-mono">
                          1 USD = {globalRate.toFixed(2)} ZMW
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            
            <div className="p-4 border-t border-dark-700 bg-dark-800 flex justify-between items-center">
              <span className="text-xs text-gray-500 ml-2">
                Showing {filteredProducts.length} of {products.length} products
              </span>
              <button 
                onClick={savePrices} 
                disabled={saving || filteredProducts.length === 0} 
                className="bg-green-500 hover:bg-green-600 text-white font-bold py-2.5 px-6 rounded-lg flex items-center gap-2 transition disabled:opacity-50"
              >
                <Save className="w-4 h-4" /> {saving ? 'Publishing...' : 'Publish Prices Globally'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}