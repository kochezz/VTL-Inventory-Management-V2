'use client';

import { useState, useEffect } from 'react';
import { Package, Check, AlertCircle } from 'lucide-react';
import axios from 'axios';

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

interface IssueFormProps {
  token: string;
  onSuccess: () => void;
}

export default function IssueForm({ token, onSuccess }: IssueFormProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [checkingStock, setCheckingStock] = useState(false);
  const [availableStock, setAvailableStock] = useState<number | null>(null);

  // Form fields
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [quantity, setQuantity] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetchProducts();
    fetchLocations();
  }, []);

  useEffect(() => {
    if (selectedProduct && selectedLocation) {
      checkStockAvailability();
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

  const checkStockAvailability = async () => {
    setCheckingStock(true);
    try {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/inventory/check-availability`,
        {
          product_id: selectedProduct,
          location_id: selectedLocation,
          required_quantity: parseFloat(quantity) || 0
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAvailableStock(response.data.available_qty);
    } catch (error) {
      console.error('Error checking availability:', error);
      setAvailableStock(null);
    } finally {
      setCheckingStock(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate stock availability
    if (availableStock !== null && parseFloat(quantity) > availableStock) {
      setError(`Insufficient stock. Only ${availableStock} available.`);
      return;
    }

    setLoading(true);

    try {
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/inventory/transactions`,
        {
          product_id: selectedProduct,
          from_location_id: selectedLocation,
          quantity: parseFloat(quantity),
          transaction_type: 'ISSUE',
          reference_number: referenceNumber || null,
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
      setError(error.response?.data?.message || 'Failed to issue inventory');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedProduct('');
    setQuantity('');
    setReferenceNumber('');
    setNotes('');
    setSuccess(false);
    setError('');
    setAvailableStock(null);
  };

  const selectedProductData = products.find(p => p.product_id === selectedProduct);
  const selectedLocationData = locations.find(l => l.location_id === selectedLocation);

  if (success) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Check className="w-8 h-8 text-blue-400" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">Inventory Issued!</h3>
        <p className="text-gray-400">Materials issued to production successfully</p>
      </div>
    );
  }

  return (
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

      {/* Source Location */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Issue From (Source Location) *
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

      {/* Stock Availability Display */}
      {selectedProduct && selectedLocation && availableStock !== null && (
        <div className="bg-dark-700 rounded-lg p-4 border border-dark-600">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Available at {selectedLocationData?.location_code}:</span>
            <span className={`text-lg font-bold ${
              availableStock > 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {availableStock.toLocaleString()} {selectedProductData?.base_uom}
            </span>
          </div>
        </div>
      )}

      {/* Quantity and Unit */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Quantity to Issue *
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
          {availableStock !== null && quantity && parseFloat(quantity) > availableStock && (
            <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Exceeds available stock
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

      {/* Production Order Reference */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Production Order / Reference Number
        </label>
        <input
          type="text"
          value={referenceNumber}
          onChange={(e) => setReferenceNumber(e.target.value)}
          className="w-full px-4 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="e.g., PROD-2024-001"
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
        disabled={loading || !selectedProduct || !quantity || (availableStock !== null && parseFloat(quantity) > availableStock)}
        className="w-full px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        <Package className="w-5 h-5" />
        {loading ? 'Processing...' : 'Issue to Production'}
      </button>
    </form>
  );
}
