'use client';

import { useState, useEffect } from 'react';
import { TruckIcon, Check, AlertCircle, FileText, AlertOctagon } from 'lucide-react';
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

interface ReceiveFormProps {
  token: string;
  onSuccess: () => void;
}

export default function ReceiveForm({ token, onSuccess }: ReceiveFormProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Form fields
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [quantity, setQuantity] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [notes, setNotes] = useState('');

  // QMS Integration
  const [showNCRModal, setShowNCRModal] = useState(false);

  useEffect(() => {
    fetchProducts();
    fetchLocations();
  }, []);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/inventory/transactions`,
        {
          product_id: selectedProduct,
          to_location_id: selectedLocation,
          quantity: parseFloat(quantity),
          transaction_type: 'RECEIVE',
          reference_number: referenceNumber || null,
          unit_cost: unitCost ? parseFloat(unitCost) : null,
          notes: notes || null
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setSuccess(true);
      setTimeout(() => {
        resetForm();
        onSuccess();
      }, 1500);
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to receive inventory');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedProduct('');
    setQuantity('');
    setReferenceNumber('');
    setUnitCost('');
    setNotes('');
    setSuccess(false);
    setError('');
  };

  const selectedProductData = products.find(p => p.product_id === selectedProduct);

  if (success) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Check className="w-8 h-8 text-green-400" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">Inventory Received!</h3>
        <p className="text-gray-400">Transaction recorded successfully</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* QMS Action Bar */}
      <div className="flex justify-end gap-3 pb-4 border-b border-dark-700">
        <button type="button" onClick={() => window.open('/qms/documents?search=QA-INV-REC-SOP-001', '_blank')} className="px-3 py-1.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors">
          <FileText className="w-4 h-4"/> Receiving SOP
        </button>
        <button type="button" onClick={() => setShowNCRModal(true)} className="px-3 py-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors">
          <AlertOctagon className="w-4 h-4"/> Log Damaged Goods (NCR)
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
              className="w-full px-4 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Enter quantity"
            />
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

        {/* Location */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Receiving Location *
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
        </div>

        {/* Reference Number (PO) */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            PO / Reference Number
          </label>
          <input
            type="text"
            value={referenceNumber}
            onChange={(e) => setReferenceNumber(e.target.value)}
            className="w-full px-4 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="e.g., PO-2024-001"
          />
        </div>

        {/* Unit Cost */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Unit Cost ($)
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={unitCost}
            onChange={(e) => setUnitCost(e.target.value)}
            className="w-full px-4 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="0.00"
          />
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
          disabled={loading || !selectedProduct || !quantity}
          className="w-full px-4 py-3 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <TruckIcon className="w-5 h-5" />
          {loading ? 'Processing...' : 'Receive Inventory'}
        </button>
      </form>

      <RaiseNCRModal 
        isOpen={showNCRModal} 
        onClose={() => setShowNCRModal(false)} 
        sourceModule="Inventory" 
        sourceId={referenceNumber || 'Direct Receive'} 
      />
    </div>
  );
}