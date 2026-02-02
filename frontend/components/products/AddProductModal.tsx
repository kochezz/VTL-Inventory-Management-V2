'use client';

import { useState } from 'react';
import { X, Plus, AlertCircle } from 'lucide-react';
import axios from 'axios';

interface Category {
  category_id: string;
  category_name: string;
}

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  token: string;
  categories: Category[];
}

export default function AddProductModal({
  isOpen,
  onClose,
  onSuccess,
  token,
  categories
}: AddProductModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form fields
  const [sku, setSku] = useState('');
  const [productName, setProductName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [baseUom, setBaseUom] = useState('piece');
  const [standardCost, setStandardCost] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [reorderLevel, setReorderLevel] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/products`,
        {
          sku,
          product_name: productName,
          description,
          category_id: categoryId,
          base_uom: baseUom,
          standard_cost: parseFloat(standardCost),
          selling_price: parseFloat(sellingPrice),
          reorder_level: parseInt(reorderLevel),
          is_active: true
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Reset form
      setSku('');
      setProductName('');
      setDescription('');
      setCategoryId('');
      setBaseUom('piece');
      setStandardCost('');
      setSellingPrice('');
      setReorderLevel('');

      onSuccess();
      onClose();
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to create product');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-dark-800 border border-dark-700 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-dark-700">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Plus className="w-6 h-6 text-primary-400" />
            Add New Product
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-dark-700 transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* SKU */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                SKU *
              </label>
              <input
                type="text"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                required
                placeholder="e.g., WB-500-001"
                className="w-full px-4 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Product Name */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Product Name *
              </label>
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                required
                placeholder="e.g., 500ML PET Bottle"
                className="w-full px-4 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Product description..."
              className="w-full px-4 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Category *
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                required
                className="w-full px-4 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Select category</option>
                {categories.map(cat => (
                  <option key={cat.category_id} value={cat.category_id}>
                    {cat.category_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Unit of Measure */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Unit of Measure *
              </label>
              <select
                value={baseUom}
                onChange={(e) => setBaseUom(e.target.value)}
                required
                className="w-full px-4 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="piece">Piece</option>
                <option value="carton">Carton</option>
                <option value="pallet">Pallet</option>
                <option value="case">Case</option>
                <option value="bottle">Bottle</option>
                <option value="unit">Unit</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Standard Cost */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Standard Cost ($) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={standardCost}
                onChange={(e) => setStandardCost(e.target.value)}
                required
                placeholder="0.00"
                className="w-full px-4 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Selling Price */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Selling Price ($) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                required
                placeholder="0.00"
                className="w-full px-4 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Reorder Level */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Reorder Level *
              </label>
              <input
                type="number"
                min="0"
                value={reorderLevel}
                onChange={(e) => setReorderLevel(e.target.value)}
                required
                placeholder="100"
                className="w-full px-4 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4 border-t border-dark-700">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-dark-700 hover:bg-dark-600 text-white rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5" />
                  Create Product
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
