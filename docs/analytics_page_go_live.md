# 📊 Analytics Dashboard: Live Data Migration Guide

**Document Version:** 1.0
**Purpose:** This guide provides the exact steps required to transition the Analytics Dashboard (`frontend/app/analytics/page.tsx`) from using static mock data to the live backend API route (`/api/analytics/dashboard`).

**Prerequisites:** - The `analytics-service.js` and `analytics-routes.js` files must already be created in the backend.
- The system should have enough real production data (batches, IPQC records, yield summaries) to populate the charts.

---

## Step 1: Activate the Backend Route
Before updating the frontend, you must tell the Express server to use the new analytics routes.

1. Open `backend/server.js`
2. Locate your route imports (usually near the top) and add:
   ```javascript
   const analyticsRoutes = require('./src/routes/analytics-routes');


Locate your route declarations (where app.use is called) and add:

app.use('/api/analytics', analyticsRoutes);

Step 2: Update Frontend State & Interfaces
Open frontend/app/analytics/page.tsx. You need to replace the hardcoded arrays with React state variables.

1. Add the Data Interfaces (at the top of the file, after imports):

interface DashboardData {
  kpis: {
    totalOutput: number;
    avgYield: string;
    oee: string;
  };
  productionOutputData: any[];
  rejectionData: any[];
  complianceData: any[];
}


2. Replace the Mock Data with useState Hooks:
Find the section inside your component where timeRange is defined and add these states:

const [timeRange, setTimeRange] = useState('30d');
const [activeTab, setActiveTab] = useState<'overview' | 'production' | 'inventory' | 'quality'>('overview');

// NEW: Add states for live data
const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
const [isFetching, setIsFetching] = useState(true);

(Note: You can now safely delete all the hardcoded arrays like productionOutputData, rejectionData, complianceData, inventoryTrends, etc.)

Step 3: Implement the Data Fetching Logic
Below your existing authentication useEffect, add the function to fetch data from your new API. This will automatically re-fetch whenever the user changes the timeRange dropdown.

useEffect(() => {
  if (isAuthenticated && token) {
    fetchDashboardData();
  }
}, [isAuthenticated, token, timeRange]); // Re-runs when timeRange changes

const fetchDashboardData = async () => {
  try {
    setIsFetching(true);
    const response = await axios.get(`${API_URL}/analytics/dashboard`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { timeRange }
    });
    
    if (response.data.success) {
      setDashboardData(response.data.data);
    }
  } catch (error) {
    console.error('Failed to fetch analytics dashboard data:', error);
  } finally {
    setIsFetching(false);
  }
};

Step 4: Update the UI Rendering
Wrap your main content or charts in a loading state, and map your UI components to the new dashboardData state object.

1. Add a Loading Spinner:
Inside your main return block, wrap the tab content logic to check for the fetching state:

{isFetching ? (
  <div className="flex justify-center items-center h-64 w-full">
    <RefreshCw className="w-8 h-8 text-primary-500 animate-spin" />
  </div>
) : dashboardData ? (
  <>
    {/* --- YOUR EXISTING TABS (overview, production, etc.) GO HERE --- */}
  </>
) : (
  <div className="text-center py-12">
    <AlertOctagon className="w-12 h-12 text-gray-600 mx-auto mb-3" />
    <p className="text-gray-400">Failed to load dashboard data.</p>
  </div>
)}

2. Map the KPI Cards:
Update the value props in your KPI cards to pull from dashboardData.kpis:

<KPICard 
  title="Total Output (Units)" 
  value={dashboardData.kpis.totalOutput.toLocaleString()} 
  subtext="Selected period" 
  trend={0} // To be calculated dynamically
  icon={Factory} 
  colorClass="blue" 
/>
<KPICard 
  title="Avg Production Yield" 
  value={`${dashboardData.kpis.avgYield}%`} 
  subtext="target: 98.0%" 
  trend={0} 
  icon={TrendingUp} 
  colorClass="green" 
/>

3. Feed the Charts:
Update the data={...} prop on all Recharts components to point to the new state:

<ComposedChart data={dashboardData.productionOutputData}>

<AreaChart data={dashboardData.productionOutputData}>

<Pie data={dashboardData.rejectionData}>

<BarChart data={dashboardData.complianceData}>


Step 5: Test the Integration
Ensure your backend server is running (npm run dev).

Navigate to the Analytics page on the frontend.

Change the Time Range dropdown (e.g., from "Last 30 Days" to "Last 7 Days").

Verify that the RefreshCw loading spinner appears and the charts instantly re-render with the updated time groupings from your live PostgreSQL database.
