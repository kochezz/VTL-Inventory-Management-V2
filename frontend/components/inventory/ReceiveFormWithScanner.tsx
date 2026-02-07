// =====================================================
// VILAGIO RECEIVE FORM WITH BARCODE SCANNING
// File: ReceiveFormWithScanner.tsx
// Location: frontend/components/inventory/ReceiveFormWithScanner.tsx
// Purpose: Example integration of barcode scanning in transaction form
// =====================================================

'use client';

import React, { useState, useEffect } from 'react';
import BarcodeScanner from '../barcode/BarcodeScanner';
import { Camera, Package, MapPin, CheckCircle, X } from 'lucide-react';

interface Product {
  product_id: string;
  sku: string;
  product_name: string;
  barcode_data: string;
  base_uom: string;
  standard_cost: number;
  total_stock: number;
}

interface Location {
  location_id: string;
  location_name: string;
  location_code: string;
  location_barcode: string;
}

interface ReceiveFormWithScannerProps {
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}

const ReceiveFormWithScanner: React.FC<ReceiveFormWithScannerProps> = ({
  onSubmit,
  onCancel
}) => {
  // Form state
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [quantity, setQuantity] = useState<string>('');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [unitCost, setUnitCost] = useState<string>('');
  
  // Scanner state
  const [scanMode, setScanMode] = useState<'none' | 'product' | 'location'>('none');
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Handle product barcode scan
   */
  const handleProductScan = async (barcode: string, format: string) => {
    try {
      setScanError('');
      
      // Call API to lookup product
      const response = await fetch('/api/barcode/scan/product', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          barcodeData: barcode,
          scanAction: 'receive',
          deviceType: 'web-camera'
        })
      });

      const result = await response.json();

      if (result.success && result.data) {
        setSelectedProduct(result.data);
        setUnitCost(result.data.standard_cost.toString());
        setScanMode('none');
        setIsScanning(false);
        
        // Show success notification
        alert(`Product scanned: ${result.data.product_name}`);
      } else {
        setScanError(result.message || 'Product not found');
        setTimeout(() => setScanError(''), 3000);
      }
    } catch (error) {
      console.error('Error scanning product:', error);
      setScanError('Failed to scan product. Please try again.');
      setTimeout(() => setScanError(''), 3000);
    }
  };

  /**
   * Handle location barcode scan
   */
  const handleLocationScan = async (barcode: string, format: string) => {
    try {
      setScanError('');
      
      // Call API to lookup location
      const response = await fetch('/api/barcode/scan/location', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          barcodeData: barcode,
          scanAction: 'receive',
          deviceType: 'web-camera'
        })
      });

      const result = await response.json();

      if (result.success && result.data) {
        setSelectedLocation(result.data);
        setScanMode('none');
        setIsScanning(false);
        
        // Show success notification
        alert(`Location scanned: ${result.data.location_name}`);
      } else {
        setScanError(result.message || 'Location not found');
        setTimeout(() => setScanError(''), 3000);
      }
    } catch (error) {
      console.error('Error scanning location:', error);
      setScanError('Failed to scan location. Please try again.');
      setTimeout(() => setScanError(''), 3000);
    }
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!selectedProduct) {
      alert('Please select or scan a product');
      return;
    }
    
    if (!selectedLocation) {
      alert('Please select or scan a location');
      return;
    }
    
    if (!quantity || parseFloat(quantity) <= 0) {
      alert('Please enter a valid quantity');
      return;
    }

    setIsSubmitting(true);

    try {
      const transactionData = {
        transactionType: 'receive',
        productId: selectedProduct.product_id,
        toLocationId: selectedLocation.location_id,
        quantity: parseFloat(quantity),
        uom: selectedProduct.base_uom,
        unitCost: unitCost ? parseFloat(unitCost) : selectedProduct.standard_cost,
        referenceDocumentNumber: referenceNumber,
        notes
      };

      await onSubmit(transactionData);
      
      // Reset form
      setSelectedProduct(null);
      setSelectedLocation(null);
      setQuantity('');
      setReferenceNumber('');
      setNotes('');
      setUnitCost('');
      
    } catch (error) {
      console.error('Error submitting transaction:', error);
      alert('Failed to submit transaction. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Open scanner for product
   */
  const openProductScanner = () => {
    setScanMode('product');
    setIsScanning(true);
    setScanError('');
  };

  /**
   * Open scanner for location
   */
  const openLocationScanner = () => {
    setScanMode('location');
    setIsScanning(true);
    setScanError('');
  };

  /**
   * Close scanner
   */
  const closeScanner = () => {
    setScanMode('none');
    setIsScanning(false);
    setScanError('');
  };

  return (
    <div className="receive-form-container">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          Receive Inventory
        </h2>

        {/* Barcode Scanner Modal */}
        {scanMode !== 'none' && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">
                  {scanMode === 'product' ? 'Scan Product Barcode' : 'Scan Location Barcode'}
                </h3>
                <button
                  onClick={closeScanner}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {scanError && (
                <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-lg text-red-700">
                  {scanError}
                </div>
              )}

              <BarcodeScanner
                onScan={(barcode, format) => {
                  if (scanMode === 'product') {
                    handleProductScan(barcode, format);
                  } else {
                    handleLocationScan(barcode, format);
                  }
                }}
                onError={(error) => {
                  setScanError(error.message);
                }}
                continuousMode={false}
                isActive={isScanning}
                showOverlay={true}
              />

              <div className="mt-4 flex justify-end">
                <button
                  onClick={closeScanner}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Product Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Product *
            </label>
            
            {selectedProduct ? (
              <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <div>
                    <div className="font-semibold text-gray-900">
                      {selectedProduct.product_name}
                    </div>
                    <div className="text-sm text-gray-600">
                      SKU: {selectedProduct.sku}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedProduct(null)}
                  className="text-red-600 hover:text-red-700 text-sm font-medium"
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={openProductScanner}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  <Camera className="w-5 h-5" />
                  Scan Product Barcode
                </button>
                <button
                  type="button"
                  className="px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
                  onClick={() => alert('Manual selection would open product dropdown')}
                >
                  Select Manually
                </button>
              </div>
            )}
          </div>

          {/* Location Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Destination Location *
            </label>
            
            {selectedLocation ? (
              <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <div>
                    <div className="font-semibold text-gray-900">
                      {selectedLocation.location_name}
                    </div>
                    <div className="text-sm text-gray-600">
                      Code: {selectedLocation.location_code}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedLocation(null)}
                  className="text-red-600 hover:text-red-700 text-sm font-medium"
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={openLocationScanner}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  <MapPin className="w-5 h-5" />
                  Scan Location Barcode
                </button>
                <button
                  type="button"
                  className="px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
                  onClick={() => alert('Manual selection would open location dropdown')}
                >
                  Select Manually
                </button>
              </div>
            )}
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quantity *
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter quantity"
                min="0"
                step="1"
                required
              />
              {selectedProduct && (
                <span className="text-sm text-gray-600 font-medium">
                  {selectedProduct.base_uom}
                </span>
              )}
            </div>
          </div>

          {/* Unit Cost */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Unit Cost
            </label>
            <input
              type="number"
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter unit cost"
              min="0"
              step="0.01"
            />
          </div>

          {/* Reference Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reference Document Number
            </label>
            <input
              type="text"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., PO-2024-001"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Additional notes..."
              rows={3}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:bg-gray-400"
              disabled={isSubmitting || !selectedProduct || !selectedLocation || !quantity}
            >
              {isSubmitting ? 'Processing...' : 'Receive Inventory'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReceiveFormWithScanner;
