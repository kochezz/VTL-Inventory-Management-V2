import axios, { InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';

// EXPO_PUBLIC_API_URL already includes /api (e.g. https://host/api)
// Do NOT add /api again in any endpoint path below
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001/api';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Attach Bearer token to every request
apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await SecureStore.getItemAsync('vtl_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  console.log('API REQUEST:', config.method?.toUpperCase(), BASE_URL + config.url);
  return config;
});

// On 401: attempt refresh, retry once, then force logout
apiClient.interceptors.response.use(
  (response) => {
    console.log('API RESPONSE:', response.status, response.config.url);
    return response;
  },
  async (error) => {
    const status = error.response?.status;
    const url = error.config?.url;
    console.log('API ERROR:', status, url);

    // When the server returns HTML/plain-text, axios puts it in error.response.data
    // as a string. Wrap it so callers always get a meaningful message.
    if (error.response && typeof error.response.data === 'string') {
      const preview = error.response.data.substring(0, 120).replace(/\n/g, ' ');
      error.message = `Server returned ${status} (non-JSON): ${preview}`;
      console.log('API NON-JSON BODY:', preview);
    } else {
      console.log('API ERROR DATA:', JSON.stringify(error.response?.data));
    }

    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = await SecureStore.getItemAsync('vtl_refresh');
        if (!refreshToken) throw new Error('No refresh token');

        // Refresh endpoint — /auth/refresh (baseURL already has /api)
        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
        await SecureStore.setItemAsync('vtl_token', data.token);

        original.headers.Authorization = `Bearer ${data.token}`;
        return apiClient(original);
      } catch {
        await SecureStore.deleteItemAsync('vtl_token');
        await SecureStore.deleteItemAsync('vtl_refresh');
        router.replace('/(auth)/login');
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);

// ── Typed interfaces ─────────────────────────────────────────────────────────

export interface DashboardSummary {
  active_batches: number;
  open_ncrs: number;
  overdue_capas: number;
  low_stock_items: number;
  zero_stock_items: number;
  pending_docs_review: number;
  qms_completion_pct: number;
  recent_transactions_count: number;
}

export interface Alert {
  id: string;
  type: 'NCR' | 'CAPA_OVERDUE' | 'ZERO_STOCK' | 'DOC_REVIEW';
  title: string;
  description: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  created_at: string;
  actor_name: string | null;
}

export interface AlertFeedResponse {
  alerts: Alert[];
  total_this_month: number;
  month_label: string;
}

export interface Batch {
  batch_id: string;
  batch_number: string;
  product_name: string;
  status: string;
  created_at: string;
  created_by_name: string | null;
}

export interface LowStockItem {
  product_id: string;
  product_name: string;
  sku: string;
  quantity: number;
  reorder_level: number;
  warehouse_location: string | null;
}

export interface Transaction {
  transaction_type: string;
  product_name: string;
  quantity: number;
  location: string;
  operator_name: string | null;
  created_at: string;
}

export interface OperationsSummary {
  batches: Batch[];
  low_stock: LowStockItem[];
  recent_transactions: Transaction[];
}

export interface QmsSection {
  section_id: string;
  section_name: string;
  completion_percentage: number;
  total_docs: number;
  released_docs: number;
}

export interface Ncr {
  ncr_id: string;
  ncr_code: string;
  description: string;
  severity: string;
  status: string;
  created_at: string;
  raised_by_name: string | null;
}

export interface Capa {
  capa_id: string;
  capa_code: string;
  action_description: string;
  due_date: string;
  status: string;
  owner_name: string | null;
}

export interface Audit {
  audit_id: string;
  audit_code: string;
  audit_type: string;
  audit_date: string;
  scope: string;
  status: string;
  lead_auditor_name: string | null;
}

export interface DocInReview {
  doc_id: string;
  doc_code: string;
  doc_name: string;
  doc_type: string;
  status: string;
  current_version_id: string;
  version_number: string | null;
  author_name: string | null;
}

export interface QualitySummary {
  qms_sections: QmsSection[];
  open_ncrs: Ncr[];
  overdue_capas: Capa[];
  upcoming_audits: Audit[];
  training_compliance_pct: number;
  docs_in_review: DocInReview[];
}

export interface TrainingUser {
  user_id: string;
  full_name: string;
  role: string;
  acknowledged_count: number;
}

export interface PendingAck {
  user_id: string;
  full_name: string;
  email: string;
  role: string;
  pending_count: number;
}

export interface ActivityItem {
  activity_id: string;
  activity_type: string;
  table_name: string;
  created_at: string;
  actor_name: string | null;
}

export interface PeopleSummary {
  users_by_role: { role: string; count: number }[];
  training_leaderboard: { top_10: TrainingUser[]; bottom_5: TrainingUser[] };
  pending_acknowledgements: PendingAck[];
  recent_activity: ActivityItem[];
}

// ── Batch detail ─────────────────────────────────────────────────────────────

export interface BatchComponent {
  component_id: string;
  component_name: string;
  sku: string;
  quantity_assigned: number;
  quantity_required: number;
  material_status: string;
  supplier_batch_lot: string | null;
  location_name: string | null;
  location_code: string | null;
}

export interface QAGate {
  gate_id: string;
  gate_number: number;
  gate_name: string;
  status: string;
  approved_by_name: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
}

export interface BatchDetail {
  batch_id: string;
  batch_number: string;
  batch_record_code: string;
  product_name: string;
  sku: string;
  production_date: string;
  production_line: string;
  shift: string;
  planned_quantity: number;
  actual_output: number;
  rejected_bottles: number;
  yield_percentage: number;
  status: string;
  display_status: string;
  line_supervisor_name: string | null;
  created_by_name: string | null;
  created_at: string;
  components: BatchComponent[];
  qa_gates: QAGate[];
}

// ── NCR detail ────────────────────────────────────────────────────────────────

export interface NCRDetail {
  ncr_id: string;
  ncr_code: string;
  description: string;
  severity: string;
  status: string;
  raised_by: string;
  raised_by_name: string | null;
  assigned_to: string | null;
  assigned_to_name: string | null;
  root_cause: string | null;
  resolution: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

// ── Commercial summary ────────────────────────────────────────────────────────

export interface CommercialTodayStats {
  today_revenue: number | string;
  today_transactions: number | string;
  avg_order_value: number | string;
  walkin_count: number | string;
}

export interface CommercialWeeklyDay {
  sale_date: string;
  revenue: number | string;
  transactions: number | string;
}

export interface CommercialMonthlyStats {
  month_revenue: number | string;
  month_transactions: number | string;
}

export interface CommercialTopProduct {
  product_name: string;
  sku: string;
  units_sold: number | string;
  revenue: number | string;
}

export interface CommercialVoidStats {
  voided: number | string;
  total: number | string;
  void_rate_pct: number | string;
}

export interface CommercialZeroStock {
  product_name: string;
  sku: string;
  quantity: number | string;
}

export interface CommercialOpenPos {
  open_pos: number | string;
  po_value: number | string;
}

export interface CommercialSummary {
  today_stats: CommercialTodayStats;
  weekly_revenue: CommercialWeeklyDay[];
  monthly_stats: CommercialMonthlyStats;
  top_products: CommercialTopProduct[];
  void_stats: CommercialVoidStats;
  zero_stock: CommercialZeroStock[];
  open_pos: CommercialOpenPos;
}

// ── API methods ──────────────────────────────────────────────────────────────
// NOTE: paths here are RELATIVE to BASE_URL which already ends in /api
// So '/mobile/dashboard' becomes 'https://.../api/mobile/dashboard' ✓
// Do NOT write '/api/mobile/dashboard' — that would double the /api prefix ✗

export const api = {
  getDashboard: (): Promise<DashboardSummary> =>
    apiClient.get('/mobile/dashboard').then((r) => r.data),

  getAlerts: (limit = 50): Promise<AlertFeedResponse> =>
    apiClient.get('/mobile/alerts', { params: { limit } }).then((r) => r.data),

  getOperations: (): Promise<OperationsSummary> =>
    apiClient.get('/mobile/operations').then((r) => r.data),

  getQuality: (): Promise<QualitySummary> =>
    apiClient.get('/mobile/quality').then((r) => r.data),

  getPeople: (): Promise<PeopleSummary> =>
    apiClient.get('/mobile/people').then((r) => r.data),

  getBatch: (id: string): Promise<BatchDetail> =>
    apiClient.get(`/production/batches/${id}`).then((r) => r.data),

  getNCR: (id: string): Promise<NCRDetail> =>
    apiClient.get(`/qms/ncrs/${id}`).then((r) => r.data),

  getCommercial: (): Promise<CommercialSummary> =>
    apiClient.get('/mobile/commercial').then((r) => r.data),

  approveNCR: (
    id: string,
    body: { status: string; root_cause?: string; resolution?: string; signature_password: string },
  ): Promise<NCRDetail> =>
    apiClient.post(`/mobile/approve/ncr/${id}`, body).then((r) => r.data),

  approveCAPA: (
    id: string,
    body: { status: string; effectiveness_review?: string; signature_password: string },
  ): Promise<Capa> =>
    apiClient.post(`/mobile/approve/capa/${id}`, body).then((r) => r.data),

  releaseDocument: (
    versionId: string,
    body: { signature_password: string },
  ): Promise<{ success: boolean; message: string }> =>
    apiClient.post(`/mobile/approve/document/${versionId}`, body).then((r) => r.data),
};

export default api;