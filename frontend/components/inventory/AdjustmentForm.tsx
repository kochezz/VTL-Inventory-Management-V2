'use client';

import { useState, useEffect } from 'react';
import { Settings, Check, AlertCircle, Plus, Minus, FileText, AlertOctagon } from 'lucide-react';
import axios from 'axios';
import RaiseNCRModal from '@/components/qms/RaiseNCRModal';

interface Product {
  product_id: string;
  sku: string;
  product_name: string;
  base_uom: string;
}

interface Location {
  location_id: string;
  location_code: string;
  location_name: string;
  location_type: string;
}

interface Reason {
  value: string;
  label: string;
}

interface AdjustmentFormProps {
  token: string;
  onSuccess: () => void;
}

export default function AdjustmentForm({ token, onSuccess }: AdjustmentFormProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [reasons, setReasons] = useState<Reason[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [currentStock, setCurrentStock] = useState<number | null>(null);

  // Form fields
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [adjustmentType, setAdjustmentType] = useState<'add' | 'remove'>('add');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  // QMS Integration
  const [showNCRModal, setShowNCRModal] = useState(false);

  useEffect(() => {
    fetchProducts();
    fetchLocations();
    fetchReasons();
  }, []);

  useEffect(() => {
    if (selectedProduct && selectedLocation) {
      fetchCurrentStock();
    }
  }, [selectedProduct, selectedLocation]);

  const fetchProducts = async () => {
    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/products?limit=100`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setProducts(response.data.products);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const fetchLocations = async () => {
    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/inventory/locations`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setLocations(response.data);
      if (response.data.length > 0) {
        setSelectedLocation(response.data[0].location_id);
      }
    } catch (error) {
      console.error('Error fetching locations:', error);
    }
  };

  const fetchReasons = async () => {
    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/inventory/adjustment-reasons`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setReasons(response.data);
      if (response.data.length > 0) {
        setReason(response.data[0].value);
      }
    } catch (error) {
      console.error('Error fetching reasons:', error);
    }
  };

  const fetchCurrentStock = async () => {
    try {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/inventory/check-availability`,
        {
          product_id: selectedProduct,
          location_id: selectedLocation,
          required_quantity: 0
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCurrentStock(response.data.on_hand || 0);
    } catch (error) {
      console.error('Error fetching current stock:', error);
      setCurrentStock(0);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const adjustmentQuantity = adjustmentType === 'add' 
      ? parseFloat(quantity) 
      : -parseFloat(quantity);

    if (currentStock !== null && adjustmentType === 'remove') {
      const newStock = currentStock - parseFloat(quantity);
      if (newStock < 0) {
        setError(`Cannot remove ${quantity}. Would result in negative stock.`);
        setLoading(false);
        return;
      }
    }

    try {
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/inventory/transactions`,
        {
          product_id: selectedProduct,
          to_location_id: selectedLocation,
          quantity: adjustmentQuantity,
          transaction_type: 'ADJUSTMENT',
          notes: `${reason}${notes ? ': ' + notes : ''}` 
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setSuccess(true);
      setTimeout(() => {
        resetForm();
        onSuccess();
      }, 1500);
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to adjust inventory');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedProduct('');
    setAdjustmentType('add');
    setQuantity('');
    setNotes('');
    setSuccess(false);
    setError('');
    setCurrentStock(null);
  };

  const selectedProductData = products.find(p => p.product_id === selectedProduct);
  const selectedLocationData = locations.find(l => l.location_id === selectedLocation);
  const quantityNum = parseFloat(quantity) || 0;
  const newStock = currentStock !== null 
    ? (adjustmentType === 'add' ? currentStock + quantityNum : currentStock - quantityNum)
    : null;
  const wouldBeNegative = newStock !== null && newStock < 0;

  if (success) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Check className="w-8 h-8 text-yellow-400" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">Adjustment Complete!</h3>
        <p className="text-gray-400">Inventory adjusted successfully</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* QMS Action Bar */}
      <div className="flex justify-end gap-3 pb-4 border-b border-dark-700">
        <button type="button" onClick={() => window.open('/qms/documents?search=QA-INV-ADJ-SOP-004', '_blank')} className="px-3 py-1.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors">
          <FileText className="w-4 h-4"/> Adjustment SOP
        </button>
        <button type="button" onClick={() => setShowNCRModal(true)} className="px-3 py-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors">
          <AlertOctagon className="w-4 h-4"/> Log Variance (NCR)
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Product Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Product *
          </label>
          <select
            value={selectedProduct}
            onChange={(e) => setSelectedProduct(e.target.value)}
            required
            className="w-full px-4 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Select a product</option>
            {products.map((product) => (
              <option key={product.product_id} value={product.product_id}>
                {product.sku} - {product.product_name}
              </option>
            ))}
          </select>
        </div>

        {/* Location */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Location *
          </label>
          <select
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            required
            className="w-full px-4 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {locations.map((location) => (
              <option key={location.location_id} value={location.location_id}>
                {location.location_code} - {location.location_name}
              </option>
            ))}
          </select>
          {currentStock !== null && selectedProduct && (
            <p className="text-xs text-gray-400 mt-1">
              Current Stock: <span className="font-semibold text-white">{currentStock.toLocaleString()}</span> {selectedProductData?.base_uom}
            </p>
          )}
        </div>

        {/* Adjustment Type */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-3">
            Adjustment Type *
          </label>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setAdjustmentType('add')}
              className={`p-4 rounded-lg border-2 transition-all ${
                adjustmentType === 'add'
                  ? 'border-green-500 bg-green-500/10'
                  : 'border-dark-600 bg-dark-700 hover:border-dark-500'
              }`}
            >
              <Plus className={`w-6 h-6 mx-auto mb-2 ${
                adjustmentType === 'add' ? 'text-green-400' : 'text-gray-400'
              }`} />
              <span className={`font-medium ${
                adjustmentType === 'add' ? 'text-green-400' : 'text-gray-300'
              }`}>
                Add Stock
              </span>
            </button>

            <button
              type="button"
              onClick={() => setAdjustmentType('remove')}
              className={`p-4 rounded-lg border-2 transition-all ${
                adjustmentType === 'remove'
                  ? 'border-red-500 bg-red-500/10'
                  : 'border-dark-600 bg-dark-700 hover:border-dark-500'
              }`}
            >
              <Minus className={`w-6 h-6 mx-auto mb-2 ${
                adjustmentType === 'remove' ? 'text-red-400' : 'text-gray-400'
              }`} />
              <span className={`font-medium ${
                adjustmentType === 'remove' ? 'text-red-400' : 'text-gray-300'
              }`}>
                Remove Stock
              </span>
            </button>
          </div>
        </div>

        {/* Quantity and Unit */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Quantity *
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
              className={`w-full px-4 py-2.5 border rounded-lg text-white focus:outline-none focus:ring-2 transition-colors ${
                wouldBeNegative
                  ? 'bg-red-900/20 border-red-500 focus:ring-red-500'
                  : 'bg-dark-700 border-dark-600 focus:ring-primary-500'
              }`}
              placeholder="Enter quantity"
            />
            {wouldBeNegative && (
              <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Would result in negative stock
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Unit of Measure
            </label>
            <input
              type="text"
              value={selectedProductData?.base_uom || ''}
              disabled
              className="w-full px-4 py-2.5 bg-dark-800 border border-dark-600 rounded-lg text-gray-400"
            />
          </div>
        </div>

        {/* Stock Preview */}
        {quantity && currentStock !== null && selectedProduct && (
          <div className="bg-dark-700 rounded-lg p-4 border border-dark-600">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-gray-400">Current Stock:</span>
              <span className="text-white font-medium">
                {currentStock.toLocaleString()} {selectedProductData?.base_uom}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-gray-400">Adjustment:</span>
              <span className={`font-medium ${
                adjustmentType === 'add' ? 'text-green-400' : 'text-red-400'
              }`}>
                {adjustmentType === 'add' ? '+' : '-'}{quantityNum.toLocaleString()} {selectedProductData?.base_uom}
              </span>
            </div>
            <div className="h-px bg-dark-600 my-3"></div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400 font-medium">New Stock:</span>
              <span className={`text-xl font-bold ${
                wouldBeNegative ? 'text-red-400' : 'text-white'
              }`}>
                {newStock !== null ? newStock.toLocaleString() : '-'} {selectedProductData?.base_uom}
              </span>
            </div>
          </div>
        )}

        {/* Reason */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Reason *
          </label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            className="w-full px-4 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {reasons.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full px-4 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            placeholder="Add any additional details..."
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading || !selectedProduct || !quantity || wouldBeNegative}
          className={`w-full px-4 py-3 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
            adjustmentType === 'add'
              ? 'bg-green-500 hover:bg-green-600 text-white'
              : 'bg-red-500 hover:bg-red-600 text-white'
          }`}
        >
          <Settings className="w-5 h-5" />
          {loading ? 'Processing...' : `${adjustmentType === 'add' ? 'Add' : 'Remove'} Stock`}
        </button>
      </form>

      <RaiseNCRModal 
        isOpen={showNCRModal} 
        onClose={() => setShowNCRModal(false)} 
        sourceModule="Inventory" 
        sourceId={selectedProductData ? `Stock Variance - ${selectedProductData.sku}` : 'Stock Adjustment'} 
      />
    </div>
  );
}