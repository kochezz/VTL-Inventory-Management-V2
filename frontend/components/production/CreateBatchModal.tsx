'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import axios from 'axios';
import { X, Plus, Check, AlertCircle, Package, Calendar, Clock } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface Product {
  product_id: string;
  product_name: string;
  sku: string;
  component_count: number;
}

interface Location {
  location_id: string;
  location_name: string;
  location_code: string;
  available_quantity: number;
  free_quantity: number;
  sufficient: boolean;
}

interface Component {
  component_id: string;
  component_name: string;
  sku: string;
  quantity_required: number;
  locations: Location[];
}

interface ComponentSelection {
  componentId: string;
  locationId: string;
  quantityRequired: number;
  quantityAssigned: number;
}

interface CreateBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// Brand mapping for batch numbering
const BRAND_CODES: { [key: string]: string } = {
  'FreshDrip': 'R',      // Regular
  'PureFlow': 'P',       // Premium
  'AquaVita': 'R',       // Regular
  '5-Gallon': '5G'       // 5 Gallon
};

// Size mapping for batch numbering
const SIZE_CODES: { [key: string]: string } = {
  '500ml': '500',
  '500ML': '500',
  '750ml': '750',
  '750ML': '750',
  '1L': '1000',
  '1.5L': '1500',
  '5 Gallon': 'A',  // A for new bottles (blow-from-preform)
  '5-Gallon New': 'A',
  '5-Gallon Refill': 'B',  // B for refill (returnable bottles)
};

export default function CreateBatchModal({ isOpen, onClose, onSuccess }: CreateBatchModalProps) {
  const { isAuthenticated, token } = useAuth();
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1: Basic Info
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [productionDate, setProductionDate] = useState(new Date().toISOString().split('T')[0]);
  const [plannedQuantity, setPlannedQuantity] = useState<number>(1000);
  const [productionLine, setProductionLine] = useState('Victory Star');
  const [shift, setShift] = useState<'day' | 'night'>('day');

  // Step 2: Component Selection
  const [components, setComponents] = useState<Component[]>([]);
  const [selectedComponents, setSelectedComponents] = useState<ComponentSelection[]>([]);

  // Fetch products when modal opens AND token exists
  useEffect(() => {
    if (isOpen && isAuthenticated && token) {
      fetchFinishedProducts();
      resetForm();
    }
  }, [isOpen, isAuthenticated, token]);

  const resetForm = () => {
    setStep(1);
    setSelectedProduct(null);
    setProductionDate(new Date().toISOString().split('T')[0]);
    setPlannedQuantity(1000);
    setProductionLine('Victory Star');
    setShift('day');
    setComponents([]);
    setSelectedComponents([]);
    setError('');
  };

  // Generate batch number based on product
  const generateBatchNumber = (productName: string, date: Date): string => {
    // Extract brand and size from product name
    let brandCode = 'R';  // Default to Regular
    let sizeCode = '500';  // Default to 500ml

    // Find brand code
    for (const [brand, code] of Object.entries(BRAND_CODES)) {
      if (productName.includes(brand)) {
        brandCode = code;
        break;
      }
    }

    // Find size code
    for (const [size, code] of Object.entries(SIZE_CODES)) {
      if (productName.includes(size)) {
        sizeCode = code;
        break;
      }
    }

    // Format: PROD-R500-DDMMYY-XXX
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear().toString().slice(-2);
    const dateStr = `${day}${month}${year}`;

    // Note: Sequential number will be assigned by backend
    return `PROD-${brandCode}${sizeCode}-${dateStr}`;
  };

  const fetchFinishedProducts = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${API_URL}/production/finished-products`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setProducts(Array.isArray(response.data) ? response.data : []);
      setLoading(false);
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to load products');
      setLoading(false);
    }
  };

  const fetchComponentsForProduct = async (productId: string) => {
    try {
      setLoading(true);
      setError('');
      
      const response = await axios.get(
        `${API_URL}/production/available-components`,
        {
          params: { productId },
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      const componentData = response.data.components || [];
      setComponents(Array.isArray(componentData) ? componentData : []);

      const autoSelected = componentData
        .filter((comp: Component) => {
          if (!comp.locations || comp.locations.length === 0) {
            return false;
          }
          return true;
        })
        .map((comp: Component) => {
          const firstSufficientLocation = comp.locations?.find(loc => loc.sufficient);
          const locationToUse = firstSufficientLocation || comp.locations?.[0];
          const requiredQty = comp.quantity_required * plannedQuantity;
          const bufferQty = Math.ceil(requiredQty * 0.05);
          
          // FIX 1: Use Math.ceil for totalQty
          const totalQty = Math.ceil(requiredQty + bufferQty);

          if (!locationToUse || !locationToUse.location_id) {
            throw new Error(`Component ${comp.component_name} has no valid inventory location`);
          }

          return {
            componentId: comp.component_id,
            locationId: locationToUse.location_id,
            quantityRequired: parseFloat(comp.quantity_required.toString()),
            quantityAssigned: totalQty
          };
        });

      if (autoSelected.length === 0) {
        throw new Error('No components have available inventory');
      }
      
      setSelectedComponents(autoSelected);
      setLoading(false);
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to load components');
      setLoading(false);
    }
  };

  const handleProductSelect = async (productId: string) => {
    setSelectedProduct(productId);
    await fetchComponentsForProduct(productId);
  };

  const handleStep1Next = () => {
    if (!selectedProduct) {
      setError('Please select a product');
      return;
    }
    if (!plannedQuantity || plannedQuantity <= 0) {
      setError('Please enter a valid quantity');
      return;
    }
    
    // Recalculate component quantities with current plannedQuantity
    setSelectedComponents(prev => prev.map(sc => {
      // Find the component to get quantity_required
      const component = components.find(c => c.component_id === sc.componentId);
      if (!component) return sc;
      
      const requiredQty = component.quantity_required * plannedQuantity;
      const bufferQty = Math.ceil(requiredQty * 0.05);
      
      // FIX 2: Use Math.ceil for totalQty
      const totalQty = Math.ceil(requiredQty + bufferQty);
      
      return {
        ...sc,
        quantityRequired: parseFloat(component.quantity_required.toString()),
        quantityAssigned: totalQty
      };
    }));
    
    setError('');
    setStep(2);
  };

  const handleComponentLocationChange = (componentId: string, locationId: string) => {
    setSelectedComponents(prev => {
      const updated = prev.map(sc =>
        sc.componentId === componentId
          ? { ...sc, locationId }
          : sc
      );
      return updated;
    });
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError('');

      const invalidComponents = selectedComponents.filter(
        sc => !sc.locationId || !sc.componentId
      );
      
      if (invalidComponents.length > 0) {
        throw new Error('Some components have invalid location selections');
      }

      const batchResponse = await axios.post(
        `${API_URL}/production/batches`,
        {
          product_id: selectedProduct,
          production_date: productionDate,
          planned_quantity: plannedQuantity,
          production_line: productionLine,
          shift: shift
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const batchId = batchResponse.data.batch?.batch_id;
      
      if (!batchId) {
        throw new Error('Failed to get batch ID from server response');
      }
      
      // Assign components
      await axios.post(
        `${API_URL}/production/batches/${batchId}/assign-components`,
        { components: selectedComponents },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setLoading(false);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Failed to create batch');
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const selectedProductData = products.find(p => p.product_id === selectedProduct);
  const previewBatchNumber = selectedProductData 
    ? generateBatchNumber(selectedProductData.product_name, new Date(productionDate))
    : '';

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-dark-800 rounded-xl border border-dark-700 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-dark-700 sticky top-0 bg-dark-800 z-10">
          <div>
            <h2 className="text-2xl font-bold text-white">Create Production Batch</h2>
            <p className="text-sm text-gray-400 mt-1">
              Step {step} of 3: {step === 1 ? 'Basic Information' : step === 2 ? 'Component Selection' : 'Review & Confirm'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-6 py-4 border-b border-dark-700">
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`flex-1 h-2 rounded-full ${
                  s <= step ? 'bg-blue-500' : 'bg-dark-700'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-4 bg-red-500/10 border border-red-500 text-red-400 px-4 py-3 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {loading && step === 1 && !selectedProduct && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-gray-400">Loading products...</p>
            </div>
          )}

          {/* Step 1: Basic Info */}
          {step === 1 && !loading && (
            <div className="space-y-6">
              {/* Batch Number Preview */}
              {previewBatchNumber && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                  <p className="text-sm text-gray-400 mb-1">Batch Number Preview:</p>
                  <p className="text-xl font-mono text-blue-400">{previewBatchNumber}-XXX</p>
                  <p className="text-xs text-gray-500 mt-1">Sequential number will be auto-assigned</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Select Product *
                </label>
                {products.length === 0 ? (
                  <div className="text-center py-8 bg-dark-900 rounded-lg border border-dark-700">
                    <Package className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400">No finished products available</p>
                    <p className="text-sm text-gray-500 mt-1">Products with BOM will appear here</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {products.map((product) => (
                      <button
                        key={product.product_id}
                        onClick={() => handleProductSelect(product.product_id)}
                        className={`p-4 rounded-lg border-2 transition-all text-left ${
                          selectedProduct === product.product_id
                            ? 'border-blue-500 bg-blue-500/10'
                            : 'border-dark-700 bg-dark-900 hover:border-dark-600'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-white">{product.product_name}</p>
                            <p className="text-sm text-gray-400">{product.sku}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {product.component_count} components
                            </p>
                          </div>
                          {selectedProduct === product.product_id && (
                            <Check className="w-5 h-5 text-blue-400" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Production Date *
                  </label>
                  <input
                    type="date"
                    value={productionDate}
                    onChange={(e) => setProductionDate(e.target.value)}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Planned Quantity *
                  </label>
                  <input
                    type="number"
                    value={plannedQuantity}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      setPlannedQuantity(isNaN(value) ? 0 : value);
                    }}
                    min="1"
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Production Line *
                  </label>
                  <input
                    type="text"
                    value={productionLine}
                    onChange={(e) => setProductionLine(e.target.value)}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Shift *
                  </label>
                  <select
                    value={shift}
                    onChange={(e) => setShift(e.target.value as 'day' | 'night')}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="day">Day Shift</option>
                    <option value="night">Night Shift</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Component Selection */}
          {step === 2 && (
            <div className="space-y-4">
              {loading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                  <p className="text-gray-400">Loading components...</p>
                </div>
              ) : components.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-400">No components found for this product</p>
                </div>
              ) : (
                components.map((component) => {
                  const selection = selectedComponents.find(sc => sc.componentId === component.component_id);
                  const selectedLocation = component.locations?.find(loc => loc.location_id === selection?.locationId);

                  return (
                    <div key={component.component_id} className="bg-dark-900 rounded-lg p-4 border border-dark-700">
                      <div className="mb-3">
                        <h3 className="font-medium text-white">{component.component_name}</h3>
                        <p className="text-sm text-gray-400">{component.sku}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Required: {(component.quantity_required * plannedQuantity).toLocaleString()} units
                          (with 5% buffer: {Math.ceil((component.quantity_required * plannedQuantity) * 1.05).toLocaleString()})
                        </p>
                      </div>

                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Select Location
                      </label>
                      <select
                        value={selection?.locationId || ''}
                        onChange={(e) => handleComponentLocationChange(component.component_id, e.target.value)}
                        className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {component.locations && component.locations.map((location) => (
                          <option key={location.location_id} value={location.location_id}>
                            {location.location_code} - {location.location_name} 
                            ({location.available_quantity.toLocaleString()} available)
                            {location.sufficient ? ' ✓' : ' ⚠️ Insufficient'}
                          </option>
                        ))}
                      </select>

                      {selectedLocation && (
                        <div className="mt-2 text-xs text-gray-400">
                          Available: {selectedLocation.available_quantity.toLocaleString()} | 
                          Free: {selectedLocation.free_quantity.toLocaleString()}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Step 3: Review */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="bg-dark-900 rounded-lg p-4 border border-dark-700">
                <h3 className="font-medium text-white mb-4">Batch Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">Batch Number:</span>
                    <p className="text-white font-mono">{previewBatchNumber}-XXX</p>
                  </div>
                  <div>
                    <span className="text-gray-400">Product:</span>
                    <p className="text-white">{selectedProductData?.product_name}</p>
                  </div>
                  <div>
                    <span className="text-gray-400">Date:</span>
                    <p className="text-white">{productionDate}</p>
                  </div>
                  <div>
                    <span className="text-gray-400">Quantity:</span>
                    <p className="text-white">{plannedQuantity.toLocaleString()} units</p>
                  </div>
                  <div>
                    <span className="text-gray-400">Line:</span>
                    <p className="text-white">{productionLine}</p>
                  </div>
                  <div>
                    <span className="text-gray-400">Shift:</span>
                    <p className="text-white capitalize">{shift}</p>
                  </div>
                </div>
              </div>

              <div className="bg-dark-900 rounded-lg p-4 border border-dark-700">
                <h3 className="font-medium text-white mb-4">Component Assignments</h3>
                <div className="space-y-3">
                  {components.map((component) => {
                    const selection = selectedComponents.find(sc => sc.componentId === component.component_id);
                    const selectedLocation = component.locations?.find(loc => loc.location_id === selection?.locationId);

                    return (
                      <div key={component.component_id} className="flex justify-between items-start text-sm">
                        <div>
                          <p className="text-white">{component.component_name}</p>
                          <p className="text-gray-400 text-xs">{selectedLocation?.location_code} - {selectedLocation?.location_name}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-white">{selection?.quantityAssigned.toLocaleString()} units</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-dark-700 p-6 flex justify-between sticky bottom-0 bg-dark-800">
          <button
            onClick={() => {
              if (step > 1) setStep(step - 1);
              else onClose();
            }}
            className="px-6 py-2.5 bg-dark-700 hover:bg-dark-600 text-white rounded-lg transition-colors"
          >
            {step === 1 ? 'Cancel' : 'Back'}
          </button>

          <button
            onClick={() => {
              if (step === 1) handleStep1Next();
              else if (step === 2) setStep(3);
              else handleSubmit();
            }}
            disabled={loading || (step === 1 && !selectedProduct)}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                Creating...
              </>
            ) : step === 3 ? (
              <>
                <Plus className="w-4 h-4" />
                Create Batch
              </>
            ) : (
              'Next'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}