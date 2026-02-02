'use client';

import { useState, useEffect } from 'react';
import { ArrowRightLeft, Check, AlertCircle } from 'lucide-react';
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

interface TransferFormProps {
  token: string;
  onSuccess: () => void;
}

export default function TransferForm({ token, onSuccess }: TransferFormProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [availableStock, setAvailableStock] = useState<number | null>(null);
  const [checkingStock, setCheckingStock] = useState(false);

  // Form fields
  const [selectedProduct, setSelectedProduct] = useState('');
  const [fromLocation, setFromLocation] = useState('');
  const [toLocation, setToLocation] = useState('');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetchProducts();
    fetchLocations();
  }, []);

  // FIXED: Only check stock when we have product, location, AND a valid quantity
  useEffect(() => {
    if (selectedProduct && fromLocation && quantity && parseFloat(quantity) > 0) {
      checkStockAvailability();
    } else if (!quantity || parseFloat(quantity) === 0) {
      // Reset stock display when quantity is cleared
      setAvailableStock(null);
    }
  }, [selectedProduct, fromLocation, quantity]);

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
      if (response.data.length > 1) {
        setFromLocation(response.data[0].location_id);
        setToLocation(response.data[1].location_id);
      }
    } catch (error) {
      console.error('Error fetching locations:', error);
    }
  };

  const checkStockAvailability = async () => {
    setCheckingStock(true);
    try {
      // FIXED: Always send a valid number, never NaN
      const requiredQty = parseFloat(quantity) || 0;
      
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/inventory/check-availability`,
        {
          product_id: selectedProduct,
          location_id: fromLocation,
          required_quantity: requiredQty  // Always a valid number
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAvailableStock(response.data.available_qty);
    } catch (error) {
      console.error('Error checking availability:', error);
      setAvailableStock(0);
    } finally {
      setCheckingStock(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (fromLocation === toLocation) {
      setError('Source and destination locations must be different');
      return;
    }

    const quantityNum = parseFloat(quantity);
    
    // Validate quantity is a valid number
    if (isNaN(quantityNum) || quantityNum <= 0) {
      setError('Please enter a valid quantity greater than 0');
      return;
    }

    if (availableStock !== null && quantityNum > availableStock) {
      setError(`Insufficient stock. Available: ${availableStock.toLocaleString()}`);
      return;
    }

    setLoading(true);

    try {
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/inventory/transactions`,
        {
          product_id: selectedProduct,
          from_location_id: fromLocation,
          to_location_id: toLocation,
          quantity: quantityNum,
          transaction_type: 'TRANSFER',
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
      setError(error.response?.data?.message || 'Failed to transfer inventory');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedProduct('');
    setQuantity('');
    setNotes('');
    setSuccess(false);
    setError('');
    setAvailableStock(null);
  };

  const selectedProductData = products.find(p => p.product_id === selectedProduct);
  const fromLocationData = locations.find(l => l.location_id === fromLocation);
  const toLocationData = locations.find(l => l.location_id === toLocation);
  const quantityNum = parseFloat(quantity) || 0;
  const hasInsufficientStock = availableStock !== null && quantityNum > 0 && quantityNum > availableStock;
  const sameLocation = fromLocation === toLocation;

  if (success) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-purple-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Check className="w-8 h-8 text-purple-400" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">Transfer Complete!</h3>
        <p className="text-gray-400">Stock transferred successfully</p>
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

      {sameLocation && fromLocation && toLocation && (
        <div className="bg-yellow-500/10 border border-yellow-500 text-yellow-500 px-4 py-3 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>Source and destination locations must be different</span>
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

      {/* From Location */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          From Location (Source) *
        </label>
        <select
          value={fromLocation}
          onChange={(e) => setFromLocation(e.target.value)}
          required
          className="w-full px-4 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          {locations.map((location) => (
            <option key={location.location_id} value={location.location_id}>
              {location.location_code} - {location.location_name}
            </option>
          ))}
        </select>
        {availableStock !== null && selectedProduct && (
          <p className="text-xs text-gray-400 mt-1">
            Available: <span className="font-semibold text-white">{availableStock.toLocaleString()}</span> {selectedProductData?.base_uom}
          </p>
        )}
        {checkingStock && (
          <p className="text-xs text-gray-400 mt-1">
            Checking stock availability...
          </p>
        )}
      </div>

      {/* Transfer Arrow Indicator */}
      {fromLocationData && toLocationData && (
        <div className="flex items-center gap-4 py-4 px-6 bg-dark-700 rounded-lg border border-dark-600">
          <div className="flex-1">
            <p className="text-xs text-gray-400 mb-1">From</p>
            <p className="text-sm font-medium text-white">{fromLocationData.location_code}</p>
          </div>
          <ArrowRightLeft className="w-6 h-6 text-purple-400 flex-shrink-0" />
          <div className="flex-1 text-right">
            <p className="text-xs text-gray-400 mb-1">To</p>
            <p className="text-sm font-medium text-white">{toLocationData.location_code}</p>
          </div>
        </div>
      )}

      {/* To Location */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          To Location (Destination) *
        </label>
        <select
          value={toLocation}
          onChange={(e) => setToLocation(e.target.value)}
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

      {/* Quantity and Unit */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Quantity to Transfer *
          </label>
          <input
            type="number"
            min="0"
            step="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
            className={`w-full px-4 py-2.5 border rounded-lg text-white focus:outline-none focus:ring-2 transition-colors ${
              hasInsufficientStock
                ? 'bg-red-900/20 border-red-500 focus:ring-red-500'
                : 'bg-dark-700 border-dark-600 focus:ring-primary-500'
            }`}
            placeholder="Enter quantity"
          />
          {hasInsufficientStock && (
            <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
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
        disabled={loading || !selectedProduct || !quantity || hasInsufficientStock || sameLocation}
        className="w-full px-4 py-3 bg-purple-500 hover:bg-purple-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        <ArrowRightLeft className="w-5 h-5" />
        {loading ? 'Processing...' : 'Transfer Stock'}
      </button>
    </form>
  );
}
