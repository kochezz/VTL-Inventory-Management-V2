// ============================================================================
// VILAGIO - CREATE BATCH FORM COMPONENT (UPDATED WITH MULTI-LOCATION)
// ============================================================================
// Purpose: Production planner interface with multi-location inventory display
// Author: Vilagio Development Team
// Updated: 2025-02-05
// ============================================================================

'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';

type CreateBatchFormProps = {
  onSuccess?: () => void;
  onCancel?: () => void;
};

type Product = {
  product_id: string;
  product_name: string;
  size?: string | null;
  sku: string;
  components_count: number;
  has_complete_bom: boolean;
};

type LocationInventory = {
  inventory_id: string;
  location_id: string;
  location_code: string;
  location_name: string;
  location_type: string;
  quantity_available: number;
  quantity_on_hand: number;
  quantity_allocated: number;
  product_name: string;
  component_sku: string;
  component_type: string;
  supplier_name: string;
  batch_lot: string;
};

export default function CreateBatchForm({ onSuccess, onCancel }: CreateBatchFormProps) {
  // Form state
  const [formData, setFormData] = useState({
    productId: '',
    productionDate: new Date().toISOString().split('T')[0],
    shift: 'day',
    plannedQuantity: 10000,
    productionLine: 'Victory Star 3-in-1 Rinse-Fill-Cap Line',
    notes: ''
  });

  // Component assignment state
  const [components, setComponents] = useState<{
    bottle: any | null;
    cap: any | null;
    label: any | null;
  }>({
    bottle: null,
    cap: null,
    label: null
  });

  // Available inventory (multi-location)
  const [availableInventory, setAvailableInventory] = useState<{
    bottles: LocationInventory[];
    caps: LocationInventory[];
    labels: LocationInventory[];
  }>({
    bottles: [],
    caps: [],
    labels: []
  });

  // Products list (finished goods only)
  const [products, setProducts] = useState<Product[]>([]);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showComponentSelector, setShowComponentSelector] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingComponents, setLoadingComponents] = useState(false);

  // Fetch finished products on mount
  useEffect(() => {
    fetchFinishedProducts();
  }, []);

  // Fetch available inventory when product is selected
  useEffect(() => {
    if (formData.productId) {
      fetchAvailableInventory(formData.productId);
      setShowComponentSelector(true);
    } else {
      setShowComponentSelector(false);
      setAvailableInventory({ bottles: [], caps: [], labels: [] });
    }
  }, [formData.productId]);

  // Fetch finished products (products with BOM defined)
  const fetchFinishedProducts = async () => {
    try {
      setLoadingProducts(true);
      const token = localStorage.getItem('accessToken');
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/production/finished-products`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      const productsData = response.data.data || [];
      setProducts(productsData);
      
      if (productsData.length === 0) {
        setError('No finished products found with Bill of Materials configured. Please configure BOM first.');
      }
    } catch (err) {
      console.error('Error fetching products:', err);
      setError('Failed to load products. Please refresh the page.');
    } finally {
      setLoadingProducts(false);
    }
  };

  // Fetch available inventory (multi-location)
  const fetchAvailableInventory = async (productId: string) => {
    try {
      setLoadingComponents(true);
      setError('');
      const token = localStorage.getItem('accessToken');
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/production/available-components?productId=${productId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setAvailableInventory(response.data.data || { bottles: [], caps: [], labels: [] });
      
      // Check if any component type has no inventory
      const data = response.data.data;
      if (data.bottles.length === 0 || data.caps.length === 0 || data.labels.length === 0) {
        setError('Warning: Some components have no available inventory. Check stock levels.');
      }
    } catch (err: any) {
      console.error('Error fetching inventory:', err);
      if (err.response?.status === 404) {
        setError(err.response.data.message || 'No Bill of Materials found for this product');
      } else {
        setError('Failed to load component inventory');
      }
      setAvailableInventory({ bottles: [], caps: [], labels: [] });
    } finally {
      setLoadingComponents(false);
    }
  };

  // Handle form input change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Handle component selection
  const handleComponentSelect = (type: string, inventory: LocationInventory) => {
    const bufferPercentage = 1.05; // 5% buffer
    const quantityNeeded = Math.ceil(formData.plannedQuantity * bufferPercentage);
    
    setComponents(prev => ({
      ...prev,
      [type]: {
        inventoryId: inventory.inventory_id,
        componentName: inventory.product_name,
        plannedQuantity: quantityNeeded,
        supplierName: inventory.supplier_name,
        supplierBatchLot: inventory.batch_lot,
        warehouseLocationId: inventory.location_id,
        warehouseLocationName: inventory.location_name,
        warehouseLocationCode: inventory.location_code,
        availableQuantity: inventory.quantity_available
      }
    }));
  };

  // Remove component
  const handleComponentRemove = (type: string) => {
    setComponents(prev => ({ ...prev, [type]: null }));
  };

  // Save as draft
  const handleSaveDraft = async () => {
    setLoading(true);
    setError('');
    
    try {
      const token = localStorage.getItem('accessToken');
      
      // Create batch
      const batchResponse = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/production/batches`,
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      const batchId = batchResponse.data.data.batch_id;
      
      // Assign components if any selected
      const selectedComponents = Object.entries(components)
        .filter(([_, comp]) => comp !== null)
        .map(([type, comp]) => ({
          ...comp,
          componentType: type
        }));
      
      if (selectedComponents.length > 0) {
        await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/production/batches/${batchId}/assign-components`,
          { components: selectedComponents },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
      
      if (onSuccess) onSuccess();
      
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save batch');
    } finally {
      setLoading(false);
    }
  };

  // Submit for QA approval
  const handleSubmitForQA = async () => {
    // Validate all components assigned
    if (!components.bottle || !components.cap || !components.label) {
      setError('Please assign all components (Bottles, Caps, Labels) before submitting for QA');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const token = localStorage.getItem('accessToken');
      
      // Create batch
      const batchResponse = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/production/batches`,
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      const batchId = batchResponse.data.data.batch_id;
      
      // Assign components
      const selectedComponents = Object.entries(components)
        .filter(([_, comp]) => comp !== null)
        .map(([type, comp]) => ({
          ...comp,
          componentType: type
        }));
      
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/production/batches/${batchId}/assign-components`,
        { components: selectedComponents },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Submit for QA
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/production/batches/${batchId}/submit-for-qa`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (onSuccess) onSuccess();
      
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to submit batch');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-dark-800 rounded-lg p-6 border border-dark-700">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Create New Production Batch</h2>
          <p className="text-gray-400 text-sm mt-1">Plan a new batch and assign materials from inventory</p>
        </div>
        <button
          onClick={onCancel}
          className="text-gray-400 hover:text-white transition"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 bg-red-500/10 border border-red-500 rounded-lg p-4">
          <p className="text-red-500 text-sm">{error}</p>
        </div>
      )}

      {/* Form */}
      <div className="space-y-6">
        {/* Basic Information */}
        <div>
          <h3 className="text-lg font-semibold text-white mb-4">Basic Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Product Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Product * {loadingProducts && <span className="text-xs text-gray-500">(Loading...)</span>}
              </label>
              <select
                name="productId"
                value={formData.productId}
                onChange={handleChange}
                disabled={loadingProducts || products.length === 0}
                className="w-full bg-dark-700 border border-dark-600 text-white rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                required
              >
                <option value="">
                  {loadingProducts ? 'Loading products...' : products.length === 0 ? 'No products available' : 'Select Product'}
                </option>
                {products.map(product => (
                  <option key={product.product_id} value={product.product_id}>
                    {product.product_name} {product.size ? `- ${product.size}` : ''} 
                    {!product.has_complete_bom && ' (⚠ Incomplete BOM)'}
                  </option>
                ))}
              </select>
              {formData.productId && (
                <p className="text-xs text-gray-500 mt-1">
                  {products.find(p => p.product_id === formData.productId)?.sku}
                </p>
              )}
            </div>

            {/* Production Date */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Production Date *
              </label>
              <input
                type="date"
                name="productionDate"
                value={formData.productionDate}
                onChange={handleChange}
                className="w-full bg-dark-700 border border-dark-600 text-white rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            {/* Shift */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Shift *
              </label>
              <div className="flex gap-4">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="shift"
                    value="day"
                    checked={formData.shift === 'day'}
                    onChange={handleChange}
                    className="mr-2 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-white">Day</span>
                </label>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="shift"
                    value="night"
                    checked={formData.shift === 'night'}
                    onChange={handleChange}
                    className="mr-2 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-white">Night</span>
                </label>
              </div>
            </div>

            {/* Planned Quantity */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Planned Quantity (units) *
              </label>
              <input
                type="number"
                name="plannedQuantity"
                value={formData.plannedQuantity}
                onChange={handleChange}
                min="1"
                step="1"
                className="w-full bg-dark-700 border border-dark-600 text-white rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          {/* Production Line */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Production Line
            </label>
            <input
              type="text"
              name="productionLine"
              value={formData.productionLine}
              onChange={handleChange}
              className="w-full bg-dark-700 border border-dark-600 text-white rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Notes */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Notes
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={3}
              className="w-full bg-dark-700 border border-dark-600 text-white rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Any additional notes for this batch..."
            />
          </div>
        </div>

        {/* Component Assignment */}
        {showComponentSelector && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Assign Components</h3>
              {loadingComponents && (
                <span className="text-sm text-gray-400">Loading inventory...</span>
              )}
            </div>
            
            {/* Bottles */}
            <MultiLocationComponentSelector
              type="bottle"
              label="🍾 Bottles (PET Preforms)"
              component={components.bottle}
              availableItems={availableInventory.bottles}
              plannedQuantity={formData.plannedQuantity}
              onSelect={handleComponentSelect}
              onRemove={handleComponentRemove}
              loading={loadingComponents}
            />

            {/* Caps */}
            <MultiLocationComponentSelector
              type="cap"
              label="🔘 Caps"
              component={components.cap}
              availableItems={availableInventory.caps}
              plannedQuantity={formData.plannedQuantity}
              onSelect={handleComponentSelect}
              onRemove={handleComponentRemove}
              loading={loadingComponents}
            />

            {/* Labels */}
            <MultiLocationComponentSelector
              type="label"
              label="🏷️ Labels"
              component={components.label}
              availableItems={availableInventory.labels}
              plannedQuantity={formData.plannedQuantity}
              onSelect={handleComponentSelect}
              onRemove={handleComponentRemove}
              loading={loadingComponents}
            />
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-4 pt-4 border-t border-dark-700">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-6 py-2.5 text-gray-400 border border-dark-600 rounded-lg hover:bg-dark-700 transition disabled:opacity-50"
          >
            Cancel
          </button>
          
          <button
            onClick={handleSaveDraft}
            disabled={loading || !formData.productId}
            className="px-6 py-2.5 bg-dark-600 text-white rounded-lg hover:bg-dark-500 transition disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Draft'}
          </button>
          
          <button
            onClick={handleSubmitForQA}
            disabled={loading || !formData.productId || !components.bottle || !components.cap || !components.label}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex-1"
          >
            {loading ? 'Submitting...' : 'Submit for QA Approval'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Multi-Location Component Selector Sub-component
function MultiLocationComponentSelector({ 
  type, 
  label, 
  component, 
  availableItems, 
  plannedQuantity, 
  onSelect, 
  onRemove,
  loading 
}: {
  type: string;
  label: string;
  component: any;
  availableItems: LocationInventory[];
  plannedQuantity: number;
  onSelect: (type: string, inventory: LocationInventory) => void;
  onRemove: (type: string) => void;
  loading?: boolean;
}) {
  const [showSelector, setShowSelector] = useState(false);
  const bufferQuantity = Math.ceil(plannedQuantity * 1.05);
  
  // Group items by product to show multi-location availability
  const groupedItems = availableItems.reduce((acc, item) => {
    const key = item.component_sku;
    if (!acc[key]) {
      acc[key] = {
        sku: item.component_sku,
        name: item.product_name,
        locations: []
      };
    }
    acc[key].locations.push(item);
    return acc;
  }, {} as Record<string, { sku: string; name: string; locations: LocationInventory[] }>);

  if (component) {
    // Component assigned
    return (
      <div className="mb-4 bg-dark-700 border border-dark-600 rounded-lg p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{label.split(' ')[0]}</span>
              <span className="text-white font-medium">{component.componentName}</span>
              <span className="px-2 py-1 bg-green-500/20 text-green-500 text-xs rounded">✓ Assigned</span>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-400">Warehouse Location</p>
                <p className="text-white">{component.warehouseLocationCode} - {component.warehouseLocationName}</p>
              </div>
              <div>
                <p className="text-gray-400">Available at Location</p>
                <p className="text-white">{component.availableQuantity.toLocaleString()} units</p>
              </div>
              <div>
                <p className="text-gray-400">Supplier</p>
                <p className="text-white">{component.supplierName}</p>
              </div>
              <div>
                <p className="text-gray-400">Quantity to Reserve</p>
                <p className="text-white">
                  {component.plannedQuantity.toLocaleString()} units
                  <span className="text-gray-500 ml-2">(+5% buffer)</span>
                </p>
              </div>
            </div>
            
            {component.availableQuantity < component.plannedQuantity && (
              <div className="mt-2 px-3 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded text-yellow-500 text-sm">
                ⚠ Warning: Available quantity ({component.availableQuantity.toLocaleString()}) is less than required ({component.plannedQuantity.toLocaleString()})
              </div>
            )}
          </div>
          
          <button
            onClick={() => onRemove(type)}
            className="ml-4 text-red-500 hover:text-red-400 transition"
            title="Remove assignment"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // Component not assigned
  return (
    <div className="mb-4">
      {!showSelector ? (
        <button
          onClick={() => setShowSelector(true)}
          disabled={loading}
          className="w-full bg-dark-700 border border-dark-600 rounded-lg p-4 text-left hover:bg-dark-650 transition group disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="flex items-center justify-between">
            <span className="text-white">{label}</span>
            <div className="flex items-center gap-2">
              {loading ? (
                <span className="text-gray-400 text-sm">Loading...</span>
              ) : availableItems.length === 0 ? (
                <span className="text-red-500 text-sm">⚠ No inventory</span>
              ) : (
                <>
                  <span className="text-gray-400 text-sm">
                    {Object.keys(groupedItems).length} option(s) available
                  </span>
                  <svg className="w-5 h-5 text-gray-400 group-hover:text-white transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </>
              )}
            </div>
          </div>
        </button>
      ) : (
        <div className="bg-dark-700 border border-dark-600 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <span className="text-white font-medium">{label}</span>
            <button
              onClick={() => setShowSelector(false)}
              className="text-gray-400 hover:text-white transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <p className="text-sm text-gray-400 mb-4">
            Required: {bufferQuantity.toLocaleString()} units (includes 5% buffer)
          </p>
          
          {availableItems.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400">No available inventory for this component</p>
              <p className="text-sm text-gray-500 mt-2">Check stock levels or configure Bill of Materials</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
              {Object.entries(groupedItems).map(([sku, group]) => {
                const totalAvailable = group.locations.reduce((sum, loc) => sum + loc.quantity_available, 0);
                const hasSufficientStock = totalAvailable >= bufferQuantity;
                
                return (
                  <div key={sku} className="bg-dark-800 border border-dark-600 rounded-lg p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <p className="text-white font-medium">{group.name}</p>
                        <p className="text-xs text-gray-500">SKU: {sku}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-medium ${hasSufficientStock ? 'text-green-500' : 'text-yellow-500'}`}>
                          {totalAvailable.toLocaleString()} total
                        </p>
                        <p className="text-xs text-gray-500">{group.locations.length} location(s)</p>
                      </div>
                    </div>
                    
                    {/* Show each location */}
                    <div className="space-y-1.5 mt-2 pt-2 border-t border-dark-700">
                      {group.locations.map((location, idx) => {
                        const canFulfill = location.quantity_available >= bufferQuantity;
                        
                        return (
                          <button
                            key={idx}
                            onClick={() => {
                              onSelect(type, location);
                              setShowSelector(false);
                            }}
                            disabled={location.quantity_available < bufferQuantity}
                            className="w-full flex items-center justify-between px-3 py-2 bg-dark-750 hover:bg-dark-700 rounded text-left transition disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <div className="flex-1">
                              <p className="text-sm text-white">{location.location_code} - {location.location_name}</p>
                              <p className="text-xs text-gray-500">{location.location_type}</p>
                            </div>
                            <div className="text-right">
                              <p className={`text-sm font-medium ${canFulfill ? 'text-white' : 'text-yellow-500'}`}>
                                {location.quantity_available.toLocaleString()}
                              </p>
                              <p className="text-xs text-gray-500">
                                {canFulfill ? '✓ Sufficient' : '⚠ Insufficient'}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
