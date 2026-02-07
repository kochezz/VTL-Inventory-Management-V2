import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

class ProductionService {
  // ---------------------------------------------------------------------------
  // 1. Core Batch Management
  // ---------------------------------------------------------------------------

  /**
   * Fetch all batches with optional filtering
   * @param {Object} filters - { status, productId, search }
   */
  async getBatches(filters = {}) {
    try {
      // Build query parameters
      const params = {};
      if (filters.status && filters.status !== 'all') params.status = filters.status;
      if (filters.productId) params.productId = filters.productId;
      if (filters.search) params.search = filters.search;

      // ✅ FIX: Use global 'axios' so the useAuth interceptor injects the token
      const response = await axios.get(`${API_URL}/production/batches`, { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching batches:', error);
      throw error;
    }
  }

  /**
   * Create a new batch (This is likely where your seed loading issue was)
   * @param {Object} batchData 
   */
  async createBatch(batchData) {
    try {
      const response = await axios.post(`${API_URL}/production/batches`, batchData);
      return response.data;
    } catch (error) {
      console.error('Error creating batch:', error);
      throw error;
    }
  }

  /**
   * Update the status of a batch (e.g., Draft -> In Progress)
   * @param {number|string} id 
   * @param {string} status 
   */
  async updateBatchStatus(id, status) {
    try {
      const response = await axios.patch(`${API_URL}/production/batches/${id}/status`, { status });
      return response.data;
    } catch (error) {
      console.error('Error updating batch status:', error);
      throw error;
    }
  }

  /**
   * Get full details for a single batch
   * @param {number|string} id 
   */
  async getBatchDetails(id) {
    try {
      const response = await axios.get(`${API_URL}/production/batches/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching batch details:', error);
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // 2. Operations Management (Your specific logic)
  // ---------------------------------------------------------------------------

  /**
   * Get operations for a specific batch
   * @param {number|string} batchId 
   */
  async getBatchOperations(batchId) {
    try {
      const response = await axios.get(`${API_URL}/production/batches/${batchId}/operations`);
      return response.data;
    } catch (error) {
      console.error('Error fetching batch operations:', error);
      throw error;
    }
  }

  /**
   * Update the status of a specific operation step
   * @param {number|string} operationId 
   * @param {string} status 
   * @param {Object} data - Optional data (e.g., actual_time, notes)
   */
  async updateOperationStatus(operationId, status, data = {}) {
    try {
      const response = await axios.patch(`${API_URL}/production/operations/${operationId}/status`, {
        status,
        ...data
      });
      return response.data;
    } catch (error) {
      console.error('Error updating operation status:', error);
      throw error;
    }
  }

  /**
   * Assign a user to a specific operation
   * @param {number|string} operationId 
   * @param {number|string} userId 
   */
  async assignUserToOperation(operationId, userId) {
    try {
      const response = await axios.post(`${API_URL}/production/operations/${operationId}/assign`, {
        user_id: userId
      });
      return response.data;
    } catch (error) {
      console.error('Error assigning user to operation:', error);
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // 3. (Removed) setAuthToken
  // ---------------------------------------------------------------------------
  // Note: I removed setAuthToken() because it is no longer needed. 
  // The global interceptor in useAuth.ts now handles this automatically.
}

// Export a singleton instance
export const productionService = new ProductionService();
export default productionService;