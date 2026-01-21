# Vilagio Inventory Management System - Complete Project Documentation

**Last Updated:** January 20, 2026  
**Current Phase:** Phase 3 - Week 7 Day 1  
**Project Status:** Frontend Authentication Setup Complete (70%), Backend Pending

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [System Architecture](#system-architecture)
3. [Technology Stack](#technology-stack)
4. [Complete Project Roadmap](#complete-project-roadmap)
5. [Phase 1: Planning & Database Design (COMPLETE)](#phase-1-planning--database-design)
6. [Phase 2: Core Data Population (COMPLETE)](#phase-2-core-data-population)
7. [Phase 3: Authentication System (IN PROGRESS)](#phase-3-authentication-system)
8. [Current Status - Detailed Breakdown](#current-status---detailed-breakdown)
9. [Known Issues & Solutions](#known-issues--solutions)
10. [Next Steps - Immediate Actions](#next-steps---immediate-actions)
11. [Remaining Work - Phase 3 & Beyond](#remaining-work)
12. [File Structure Reference](#file-structure-reference)
13. [Environment Configuration](#environment-configuration)
14. [Database Schema Reference](#database-schema-reference)
15. [Authentication Flow](#authentication-flow)
16. [API Endpoints Reference](#api-endpoints-reference)

---

## Project Overview

### What We're Building

The **Vilagio Inventory Management System** is a comprehensive web application for managing water bottle production inventory at Vilagio Technologies Ltd. The system provides:

- **Product Management** - Track 88+ water bottle products across multiple categories
- **Inventory Tracking** - Real-time stock levels, locations, and movements
- **User Management** - Role-based access control (Admin, Manager, Staff, Viewer)
- **Transaction Recording** - Production, sales, purchases, adjustments
- **Reporting & Analytics** - Stock reports, movement history, low stock alerts
- **Authentication & Security** - JWT-based secure authentication

### Business Context

- **Company:** Vilagio Technologies Ltd.
- **Domain:** vilag.io
- **Tagline:** "NOTHING BETTER"
- **Industry:** Water bottle production and distribution
- **Product Range:** 88 products across 12 categories (500ml to 20L bottles)

### Brand Identity

**Colors:**
- Primary Blue: #4267B3
- Dark Charcoal: #616771
- Medium Gray: #90949C
- Light Background: #E9EBEE

**Logo:** Striped globe design (white for dark backgrounds, black for light)

---

## System Architecture

### High-Level Architecture

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│   Frontend      │────────▶│   Backend API   │────────▶│   Database      │
│   (Next.js)     │  REST   │   (Node.js)     │   SQL   │  (PostgreSQL)   │
│   Port: 3000    │         │   Port: 3001    │         │    (Neon)       │
└─────────────────┘         └─────────────────┘         └─────────────────┘
        │                            │
        │                            │
        ▼                            ▼
┌─────────────────┐         ┌─────────────────┐
│  Static Assets  │         │  JWT Tokens     │
│  (Logo, Images) │         │  (Auth Service) │
└─────────────────┘         └─────────────────┘
```

### Component Breakdown

**Frontend (Next.js 14 + TypeScript)**
- User Interface with dark theme
- Authentication forms
- Dashboard and inventory views
- State management (Zustand)
- API integration (Axios)

**Backend (Node.js + Express)**
- RESTful API endpoints
- JWT authentication service
- Business logic layer
- Database queries
- Security middleware

**Database (PostgreSQL via Neon)**
- Product catalog (88 products)
- Inventory records (80+ entries)
- User management
- Transaction history
- Audit logging

---

## Technology Stack

### Frontend Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 14.2.35 | React framework with App Router |
| React | 18.2.0 | UI component library |
| TypeScript | 5.3.3 | Type-safe JavaScript |
| Tailwind CSS | 3.4.19 | Utility-first CSS framework |
| Zustand | 4.4.7 | State management |
| Axios | 1.6.2 | HTTP client |
| Lucide React | 0.303.0 | Icon library |
| React Hook Form | 7.49.2 | Form validation |

**Tailwind Plugins:**
- @tailwindcss/forms (0.5.11)
- @tailwindcss/typography (0.5.19)

### Backend Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | ≥18.0.0 | JavaScript runtime |
| Express.js | Latest | Web framework |
| PostgreSQL | Latest | Relational database |
| bcrypt | Latest | Password hashing |
| jsonwebtoken | Latest | JWT token generation |
| pg | Latest | PostgreSQL client |

### Database & Hosting

| Service | Purpose |
|---------|---------|
| Neon | PostgreSQL database hosting |
| Neon SQL Editor | Web-based database management |

### Development Tools

- Git (Version control)
- Windows 10/11 (Development environment)
- Git Bash / Windows Terminal
- VS Code (Recommended IDE)
- npm (Package manager)

---

## Complete Project Roadmap

### Phase 1: Planning & Database Design ✅ COMPLETE
**Duration:** Week 1-2  
**Status:** 100% Complete

- [x] Requirements gathering
- [x] Database schema design
- [x] Entity-Relationship diagrams
- [x] Technology stack selection
- [x] Project structure planning

### Phase 2: Core Data Population ✅ COMPLETE
**Duration:** Week 3-5  
**Status:** 100% Complete

- [x] Create products table (88 products)
- [x] Create categories table (12 categories)
- [x] Create locations table (6 warehouse locations)
- [x] Populate inventory records (80+ entries)
- [x] Set up transaction types
- [x] Configure measurement units

**Achievements:**
- 88 water bottle products catalogued
- 12 product categories defined
- 6 warehouse locations configured
- 80+ inventory records created
- Complete product catalog operational

### Phase 3: Authentication System ⏳ IN PROGRESS
**Duration:** Week 6-8 (Current: Week 7 Day 1)  
**Status:** 70% Complete

**Week 6:** ✅ Database Authentication Tables
- [x] Create users table
- [x] Create roles table (4 roles)
- [x] Create user_sessions table
- [x] Create password_reset_tokens table
- [x] Create audit_log table
- [x] Create admin user (admin@vilag.io)

**Week 7 Day 1:** ⏳ Frontend Setup (Current)
- [x] Next.js project initialization
- [x] Tailwind CSS configuration
- [x] Logo integration
- [x] useAuth hook creation
- [x] Login page creation
- [x] Dashboard layout creation
- [x] Dashboard page creation
- [ ] Backend API setup **← NEXT STEP**
- [ ] Authentication testing
- [ ] Protected routes

**Week 7-8:** 📋 Remaining Authentication Work
- [ ] Backend authentication API
- [ ] Password reset functionality
- [ ] Session management
- [ ] Refresh token handling
- [ ] Role-based access control
- [ ] Authentication testing

### Phase 4: Inventory Management (PENDING)
**Duration:** Week 9-12  
**Status:** 0% Complete

- [ ] Inventory listing pages
- [ ] Product search and filters
- [ ] Stock level displays
- [ ] Location management
- [ ] Low stock alerts
- [ ] Inventory reports

### Phase 5: Transaction Management (PENDING)
**Duration:** Week 13-15  
**Status:** 0% Complete

- [ ] Transaction recording forms
- [ ] Purchase orders
- [ ] Sales records
- [ ] Stock adjustments
- [ ] Movement tracking
- [ ] Transaction history

### Phase 6: Reporting & Analytics (PENDING)
**Duration:** Week 16-18  
**Status:** 0% Complete

- [ ] Dashboard analytics
- [ ] Stock reports
- [ ] Movement reports
- [ ] User activity reports
- [ ] Export functionality (PDF, Excel)
- [ ] Custom report builder

### Phase 7: Testing & Deployment (PENDING)
**Duration:** Week 19-20  
**Status:** 0% Complete

- [ ] Unit testing
- [ ] Integration testing
- [ ] User acceptance testing
- [ ] Performance optimization
- [ ] Production deployment
- [ ] Documentation finalization

---

## Phase 1: Planning & Database Design

### Completed Deliverables

1. **Database Schema** - Complete ERD with 15+ tables
2. **Entity Relationships** - Defined relationships between all entities
3. **Technology Selection** - Next.js, Node.js, PostgreSQL stack chosen
4. **Project Structure** - Folder hierarchy established

### Key Decisions Made

- **Database:** PostgreSQL via Neon (cloud-hosted)
- **Frontend:** Next.js 14 with App Router
- **Authentication:** JWT tokens with bcrypt hashing
- **Styling:** Tailwind CSS with custom Vilagio theme
- **State Management:** Zustand for simplicity

---

## Phase 2: Core Data Population

### Database Tables Created

**1. categories**
- 12 water bottle categories
- Size-based categorization (500ml to 20L)
- Active status tracking

**2. products**
- 88 unique water bottle products
- SKU system (e.g., WB-500-001)
- Pricing, specifications, dimensions
- Category relationships

**3. locations**
- 6 warehouse locations (WH-A through WH-F)
- Capacity tracking
- Location types (Main, Overflow, Retail, etc.)

**4. inventory**
- 80+ inventory records
- Stock quantities by location
- Reorder levels
- Last updated timestamps

**5. transaction_types**
- 9 transaction types
- Purchase, Sale, Production, Adjustment, etc.
- Impact on stock (increase/decrease)

**6. units_of_measurement**
- 6 measurement units
- Pieces, Cartons, Pallets, Cases, Bottles, Units

### Sample Data Statistics

- **Total Products:** 88
- **Total Categories:** 12
- **Total Locations:** 6
- **Total Inventory Records:** 80+
- **Active Products:** 88 (100%)
- **Products with Stock:** 80+

---

## Phase 3: Authentication System

### Week 6: Database Tables (COMPLETE ✅)

**Tables Created:**

**1. users**
```sql
- user_id (UUID, PRIMARY KEY)
- email (VARCHAR 255, UNIQUE)
- password_hash (VARCHAR 255)
- full_name (VARCHAR 255)
- role (VARCHAR 50)
- is_active (BOOLEAN)
- is_verified (BOOLEAN)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
- last_login (TIMESTAMP)
```

**2. roles**
```sql
- role_id (SERIAL, PRIMARY KEY)
- role_name (VARCHAR 50, UNIQUE)
- display_name (VARCHAR 100)
- description (TEXT)
- permissions (JSONB)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

**Default Roles Created:**
1. **admin** - Full system access (14 permissions)
2. **manager** - Inventory + Reports (11 permissions)
3. **staff** - Transactions + Viewing (5 permissions)
4. **viewer** - Read-only access (4 permissions)

**3. user_sessions**
```sql
- session_id (UUID, PRIMARY KEY)
- user_id (UUID, FOREIGN KEY)
- refresh_token (TEXT)
- ip_address (VARCHAR 45)
- user_agent (TEXT)
- expires_at (TIMESTAMP)
- created_at (TIMESTAMP)
- is_revoked (BOOLEAN)
```

**4. password_reset_tokens**
```sql
- token_id (SERIAL, PRIMARY KEY)
- user_id (UUID, FOREIGN KEY)
- token (VARCHAR 255, UNIQUE)
- expires_at (TIMESTAMP)
- used (BOOLEAN)
- created_at (TIMESTAMP)
```

**5. audit_log**
```sql
- log_id (SERIAL, PRIMARY KEY)
- user_id (UUID)
- action (VARCHAR 100)
- table_name (VARCHAR 100)
- record_id (TEXT)
- old_values (JSONB)
- new_values (JSONB)
- ip_address (VARCHAR 45)
- created_at (TIMESTAMP)
```

**Default Admin User Created:**
- Email: admin@vilag.io
- Password: Admin@123
- Role: admin
- Status: Active, Verified

---

### Week 7 Day 1: Frontend Setup (IN PROGRESS ⏳)

#### Completed Items ✅

**1. Next.js Project Initialized**
- Location: `C:\Users\willi\GitHub\VTL_Inventory_MGT\frontend`
- Next.js version: 14.2.35
- TypeScript enabled
- App Router configured
- ESLint configured

**2. Dependencies Installed**
```json
{
  "dependencies": {
    "next": "^14.0.4",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "axios": "^1.6.2",
    "zustand": "^4.4.7"
  },
  "devDependencies": {
    "@tailwindcss/forms": "^0.5.11",
    "@tailwindcss/typography": "^0.5.19",
    "tailwindcss": "^3.4.19",
    "typescript": "^5.3.3",
    "autoprefixer": "^10.4.23",
    "postcss": "^8.5.6"
  }
}
```

**3. Configuration Files Created**

**tailwind.config.js**
- Vilagio color palette configured
- Dark mode enabled
- Custom animations added
- Form and typography plugins loaded

**postcss.config.mjs**
- Tailwind CSS plugin configured
- Autoprefixer enabled

**next.config.js**
- CommonJS format (module.exports)
- Basic Next.js configuration

**.env.local**
```
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

**4. Folder Structure Created**
```
frontend/
├── app/
│   ├── favicon.ico
│   ├── globals.css
│   ├── layout.tsx
│   ├── page.tsx
│   ├── dashboard/
│   │   └── page.tsx
│   └── login/
│       └── page.tsx
├── components/
│   └── layout/
│       └── DashboardLayout.tsx
├── hooks/
│   └── useAuth.ts
├── public/
│   ├── logo-white.png (46KB)
│   └── logo-black.png (43KB)
├── .env.local
├── next.config.js
├── postcss.config.mjs
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

**5. Core Files Implemented**

**hooks/useAuth.ts** ✅
- Zustand store for authentication state
- Login function with API integration
- Logout function with token cleanup
- Refresh token handling
- Axios interceptor for auto token refresh
- LocalStorage persistence

**app/layout.tsx** ✅
- Root layout with Inter font
- Metadata configuration
- Global CSS import

**app/globals.css** ✅
- Tailwind directives
- Minimal custom styles

**app/page.tsx** ✅
- Homepage with automatic routing
- Redirects to /login or /dashboard based on auth state
- Loading state

**app/login/page.tsx** ✅ (Simplified Version)
- Login form with email/password
- Error handling
- Pre-filled credentials for testing
- Basic dark theme styling
- Submit button with loading state

**app/dashboard/page.tsx** ✅
- Protected route (requires authentication)
- Dashboard layout integration
- Stats cards (4 metrics)
- Quick actions section
- Recent activity placeholder
- Welcome message with user name

**components/layout/DashboardLayout.tsx** ✅
- Responsive sidebar (desktop + mobile)
- Navigation menu (6 items)
- Role-based menu filtering
- User profile display
- Logout functionality
- Top search bar
- Notification bell
- Vilagio logo integration

**6. Logo Files**
- logo-white.png (46KB) - For dark backgrounds ✅
- logo-black.png (43KB) - For light backgrounds ✅
- Location: `frontend/public/`

**7. Styling & Theme**
- Dark theme implemented (dark-950 background)
- Vilagio blue accent color (#4267B3)
- Gradient backgrounds
- Hover effects and transitions
- Responsive design (mobile + desktop)

#### Current Issues ⚠️

**Issue 1: White Login Screen**
- **Problem:** Login page displays all white, can't see form elements
- **Cause:** Possible Tailwind CSS cache issue or color classes not loading
- **Status:** Needs cache clear and restart

**Issue 2: Login Fails with Network Error**
- **Problem:** Login attempt fails with error
- **Cause:** Backend API not running (expected)
- **Expected Behavior:** Will work once backend is setup
- **Next Step:** Setup backend authentication API

**Issue 3: Logo Not Displaying**
- **Status:** May need verification that logo files are in correct location
- **Location:** Should be in `frontend/public/logo-white.png`

---

## Current Status - Detailed Breakdown

### What's Working ✅

1. **Database** (100% Complete)
   - All authentication tables created
   - Admin user exists with bcrypt password
   - 4 roles configured with permissions
   - 88 products + 80+ inventory records from Phase 2

2. **Frontend Structure** (90% Complete)
   - Next.js project running successfully
   - File structure correct
   - Dependencies installed
   - Configuration files in place
   - Logo files present

3. **Frontend Components** (85% Complete)
   - useAuth hook implemented
   - Login page created
   - Dashboard layout created
   - Dashboard page created
   - Homepage routing logic

4. **Styling** (75% Complete)
   - Tailwind configuration with Vilagio colors
   - Dark theme setup
   - Component styles defined
   - Responsive design implemented

### What's Not Working ⚠️

1. **Login UI Display** (Critical)
   - Login page shows white screen
   - Form elements not visible
   - Likely cache issue

2. **Authentication Flow** (Expected - No Backend)
   - Login attempts fail (network error)
   - No backend API to connect to
   - Expected behavior until backend setup

3. **Protected Routes** (Partially Working)
   - Authentication check in place
   - Redirects implemented
   - Can't test fully without backend

### What's Missing 📋

1. **Backend API** (0% Complete)
   - Express server not created
   - No authentication endpoints
   - No JWT token generation
   - No password verification

2. **Backend Files Needed:**
   - server.js
   - auth-service.js
   - auth-middleware.js
   - auth-routes.js
   - package.json for backend

3. **Environment Setup:**
   - Backend .env file
   - Database connection string
   - JWT secrets

---

## Known Issues & Solutions

### Issue 1: White Login Screen ⚠️

**Problem:**
- Login page displays all white
- Can't see form elements or submit button
- Logo not visible

**Root Causes:**
1. Tailwind CSS not applying custom colors
2. Webpack cache corruption
3. PostCSS configuration issue

**Solution:**
```bash
# Stop dev server (Ctrl+C)

# Delete ALL cache
rm -rf .next
rm -rf node_modules/.cache

# Restart dev server
npm run dev

# If still white, check:
# 1. Logo files exist in public/
# 2. tailwind.config.js has dark-* colors
# 3. Browser console for errors (F12)
```

### Issue 2: Login Network Error ✅ Expected

**Problem:**
- Login fails with "Login failed" or "Network Error"
- Console shows: `Cannot reach http://localhost:3001/api/auth/login`

**Root Cause:**
- Backend API server not running
- Expected behavior - this is not a bug

**Solution:**
- Setup backend authentication API (next step)
- Start backend server on port 3001
- Then login will work

### Issue 3: Case Sensitivity in Filenames ⚠️

**Problem:**
- Windows created `Page.tsx` instead of `page.tsx`
- Next.js requires lowercase for special files

**Solution:**
```bash
# Rename any capital P to lowercase p
mv app/Page.tsx app/page.tsx
mv app/login/LoginPage.tsx app/login/page.tsx
```

**Rule:**
- Special Next.js files MUST be lowercase: `page.tsx`, `layout.tsx`, `error.tsx`
- Regular components CAN be any case: `DashboardLayout.tsx`, `UserProfile.tsx`

### Issue 4: Missing Logo Files ⚠️

**Problem:**
- Logo not displaying on login page
- Image 404 error

**Solution:**
1. Download logo files from chat outputs:
   - `logo-white.png`
   - `logo-black.png`
2. Copy to: `C:\Users\willi\GitHub\VTL_Inventory_MGT\frontend\public\`
3. Verify with: `ls -la public/logo-*.png`

---

## Next Steps - Immediate Actions

### Priority 1: Fix Login UI Display 🔥

**Action Items:**
1. Clear all cache files
2. Restart dev server
3. Verify login page renders correctly
4. Check browser console for errors

**Commands:**
```bash
cd C:\Users\willi\GitHub\VTL_Inventory_MGT\frontend
rm -rf .next node_modules/.cache
npm run dev
```

**Verification:**
- Visit http://localhost:3000/login
- Should see dark background
- Should see "Vilagio Login" header
- Should see email and password fields
- Should see blue "Sign In" button

---

### Priority 2: Setup Backend Authentication API 🚀

#### Step 1: Create Backend Folder Structure

```bash
cd C:\Users\willi\GitHub\VTL_Inventory_MGT
mkdir backend
cd backend
mkdir src
mkdir src/services
mkdir src/middleware
mkdir src/routes
```

#### Step 2: Initialize Backend Project

```bash
npm init -y
npm install express pg bcrypt jsonwebtoken dotenv cors
npm install --save-dev nodemon
```

#### Step 3: Create Backend Files

**backend/package.json**
```json
{
  "name": "vilagio-inventory-backend",
  "version": "1.0.0",
  "description": "Vilagio Inventory Management API",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "pg": "^8.11.3",
    "bcrypt": "^5.1.1",
    "jsonwebtoken": "^9.0.2",
    "dotenv": "^16.3.1",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "nodemon": "^3.0.2"
  }
}
```

**backend/.env**
```
DATABASE_URL=your_neon_connection_string_here
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_REFRESH_SECRET=your_super_secret_refresh_key_change_this_in_production
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
PORT=3001
```

**backend/server.js**
```javascript
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./src/routes/auth-routes');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Vilagio API is running' });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(`🚀 Vilagio API running on http://localhost:${PORT}`);
});
```

**backend/src/services/auth-service.js**
```javascript
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Generate access token
const generateAccessToken = (user) => {
  return jwt.sign(
    { 
      user_id: user.user_id, 
      email: user.email, 
      role: user.role 
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );
};

// Generate refresh token
const generateRefreshToken = (user) => {
  return jwt.sign(
    { user_id: user.user_id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
};

// Login function
const login = async (email, password, ipAddress, userAgent) => {
  try {
    // Find user
    const userResult = await pool.query(
      'SELECT * FROM users WHERE email = $1 AND is_active = true',
      [email]
    );

    if (userResult.rows.length === 0) {
      throw new Error('Invalid credentials');
    }

    const user = userResult.rows[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Store refresh token in session
    await pool.query(
      `INSERT INTO user_sessions (user_id, refresh_token, ip_address, user_agent, expires_at)
       VALUES ($1, $2, $3, $4, NOW() + INTERVAL '7 days')`,
      [user.user_id, refreshToken, ipAddress, userAgent]
    );

    // Update last login
    await pool.query(
      'UPDATE users SET last_login = NOW() WHERE user_id = $1',
      [user.user_id]
    );

    // Return user data and tokens (don't send password hash)
    const { password_hash, ...userData } = user;
    
    return {
      user: userData,
      accessToken,
      refreshToken
    };
  } catch (error) {
    throw error;
  }
};

// Logout function
const logout = async (refreshToken) => {
  try {
    await pool.query(
      'UPDATE user_sessions SET is_revoked = true WHERE refresh_token = $1',
      [refreshToken]
    );
    return { message: 'Logged out successfully' };
  } catch (error) {
    throw error;
  }
};

// Refresh token function
const refreshAccessToken = async (refreshToken) => {
  try {
    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    // Check if session is valid
    const sessionResult = await pool.query(
      `SELECT * FROM user_sessions 
       WHERE refresh_token = $1 
       AND is_revoked = false 
       AND expires_at > NOW()`,
      [refreshToken]
    );

    if (sessionResult.rows.length === 0) {
      throw new Error('Invalid refresh token');
    }

    // Get user
    const userResult = await pool.query(
      'SELECT * FROM users WHERE user_id = $1 AND is_active = true',
      [decoded.user_id]
    );

    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }

    const user = userResult.rows[0];

    // Generate new access token
    const newAccessToken = generateAccessToken(user);

    const { password_hash, ...userData } = user;

    return {
      accessToken: newAccessToken,
      user: userData
    };
  } catch (error) {
    throw error;
  }
};

module.exports = {
  login,
  logout,
  refreshAccessToken
};
```

**backend/src/middleware/auth-middleware.js**
```javascript
const jwt = require('jsonwebtoken');

const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1]; // Bearer TOKEN

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    return res.status(401).json({ message: 'Invalid token' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    next();
  };
};

module.exports = { authenticate, authorize };
```

**backend/src/routes/auth-routes.js**
```javascript
const express = require('express');
const router = express.Router();
const authService = require('../services/auth-service');
const { authenticate } = require('../middleware/auth-middleware');

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'];

    const result = await authService.login(email, password, ipAddress, userAgent);
    res.json(result);
  } catch (error) {
    res.status(401).json({ message: error.message });
  }
});

// Logout
router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const result = await authService.logout(refreshToken);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Refresh token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const result = await authService.refreshAccessToken(refreshToken);
    res.json(result);
  } catch (error) {
    res.status(401).json({ message: error.message });
  }
});

// Get current user
router.get('/me', authenticate, async (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
```

#### Step 4: Configure Backend Environment

1. Get your Neon database connection string from Neon dashboard
2. Update `backend/.env` with your actual DATABASE_URL
3. Generate secure JWT secrets:
   ```bash
   # On Git Bash or Linux
   openssl rand -base64 32
   
   # Or use Node.js
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

#### Step 5: Start Backend Server

```bash
cd backend
npm run dev
```

**Expected Output:**
```
🚀 Vilagio API running on http://localhost:3001
```

#### Step 6: Test Backend

```bash
# Test health endpoint
curl http://localhost:3001/health

# Expected: {"status":"ok","message":"Vilagio API is running"}

# Test login endpoint
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@vilag.io","password":"Admin@123"}'

# Expected: {"user":{...},"accessToken":"...","refreshToken":"..."}
```

#### Step 7: Test Full Login Flow

1. Start backend: `cd backend && npm run dev` (Port 3001)
2. Start frontend: `cd frontend && npm run dev` (Port 3000)
3. Visit: http://localhost:3000/login
4. Enter credentials:
   - Email: admin@vilag.io
   - Password: Admin@123
5. Click "Sign In"
6. Should redirect to: http://localhost:3000/dashboard
7. Should see: Welcome message with "System Administrator"

---

### Priority 3: Verify Protected Routes ✅

**After backend is running:**

1. Test unauthenticated access:
   - Visit http://localhost:3000/dashboard directly
   - Should redirect to /login

2. Test authenticated access:
   - Login at /login
   - Should redirect to /dashboard
   - Should see dashboard with stats

3. Test logout:
   - Click logout button in sidebar
   - Should redirect to /login
   - Should clear tokens from localStorage

---

## Remaining Work

### Phase 3 Completion (Week 7-8)

**Week 7 Remaining:**
- [ ] Backend authentication API (Priority 2 above)
- [ ] Test login flow end-to-end
- [ ] Fix any UI issues
- [ ] Verify protected routes
- [ ] Test token refresh

**Week 8:**
- [ ] Password reset functionality
- [ ] Email verification (optional)
- [ ] Remember me functionality
- [ ] Session timeout handling
- [ ] Multi-device session management
- [ ] Admin user management UI

### Phase 4: Inventory Management (Weeks 9-12)

**Core Features:**
- [ ] Product listing page
- [ ] Product detail page
- [ ] Product search with filters
- [ ] Stock level indicators
- [ ] Low stock alerts
- [ ] Location-based inventory view
- [ ] Inventory reports

**UI Components:**
- [ ] Product card component
- [ ] Data table component
- [ ] Filter panel component
- [ ] Search bar component
- [ ] Pagination component

### Phase 5: Transaction Management (Weeks 13-15)

**Features:**
- [ ] Record new transaction
- [ ] Transaction history
- [ ] Transaction filtering
- [ ] Bulk transactions
- [ ] Transaction approvals (for certain roles)
- [ ] Transaction reports

**Transaction Types:**
- [ ] Purchase (stock in)
- [ ] Sale (stock out)
- [ ] Production (manufacturing)
- [ ] Adjustment (corrections)
- [ ] Transfer (between locations)
- [ ] Return (customer returns)
- [ ] Damage (write-offs)

### Phase 6: Reporting & Analytics (Weeks 16-18)

**Reports:**
- [ ] Stock level report
- [ ] Stock movement report
- [ ] Low stock report
- [ ] Transaction history report
- [ ] Location capacity report
- [ ] Product performance report
- [ ] User activity report

**Analytics:**
- [ ] Dashboard charts (Chart.js or Recharts)
- [ ] Trend analysis
- [ ] Stock turnover metrics
- [ ] Revenue analytics
- [ ] Prediction/forecasting (basic)

**Export Features:**
- [ ] Export to PDF
- [ ] Export to Excel
- [ ] Export to CSV
- [ ] Print functionality

### Phase 7: Testing & Deployment (Weeks 19-20)

**Testing:**
- [ ] Unit tests (Jest)
- [ ] Integration tests
- [ ] API endpoint tests
- [ ] UI component tests
- [ ] End-to-end tests (Playwright)
- [ ] Load testing
- [ ] Security testing

**Deployment:**
- [ ] Production database setup
- [ ] Environment configuration
- [ ] Frontend deployment (Vercel)
- [ ] Backend deployment (Railway/Render)
- [ ] Domain configuration
- [ ] SSL certificates
- [ ] Performance optimization
- [ ] Monitoring setup

**Documentation:**
- [ ] User manual
- [ ] Admin guide
- [ ] API documentation
- [ ] Developer setup guide
- [ ] Deployment guide

---

## File Structure Reference

### Complete Project Structure

```
VTL_Inventory_MGT/
│
├── frontend/                           # Next.js Frontend
│   ├── app/                           # Next.js App Router
│   │   ├── dashboard/
│   │   │   └── page.tsx              # Dashboard page
│   │   ├── login/
│   │   │   └── page.tsx              # Login page
│   │   ├── favicon.ico
│   │   ├── globals.css               # Global styles
│   │   ├── layout.tsx                # Root layout
│   │   └── page.tsx                  # Homepage (redirects)
│   │
│   ├── components/                    # React Components
│   │   └── layout/
│   │       └── DashboardLayout.tsx   # Main dashboard layout
│   │
│   ├── hooks/                         # Custom React Hooks
│   │   └── useAuth.ts                # Authentication hook
│   │
│   ├── public/                        # Static Assets
│   │   ├── logo-white.png            # Vilagio logo (white)
│   │   └── logo-black.png            # Vilagio logo (black)
│   │
│   ├── .env.local                     # Environment variables
│   ├── .eslintrc.json                # ESLint configuration
│   ├── .gitignore
│   ├── next.config.js                # Next.js configuration
│   ├── package.json                  # Frontend dependencies
│   ├── postcss.config.mjs            # PostCSS configuration
│   ├── tailwind.config.js            # Tailwind configuration
│   └── tsconfig.json                 # TypeScript configuration
│
├── backend/                           # Node.js Backend (TO BE CREATED)
│   ├── src/
│   │   ├── middleware/
│   │   │   └── auth-middleware.js    # JWT authentication
│   │   ├── routes/
│   │   │   └── auth-routes.js        # Auth endpoints
│   │   └── services/
│   │       └── auth-service.js       # Auth business logic
│   │
│   ├── .env                          # Backend environment variables
│   ├── .gitignore
│   ├── package.json                  # Backend dependencies
│   └── server.js                     # Express server
│
└── database/                          # Database Scripts (Reference)
    ├── schema/
    │   ├── auth-schema.sql           # Authentication tables
    │   ├── products-schema.sql       # Product tables (Phase 2)
    │   └── inventory-schema.sql      # Inventory tables (Phase 2)
    │
    ├── seeds/
    │   ├── products-seed.sql         # 88 products data
    │   ├── categories-seed.sql       # 12 categories data
    │   └── inventory-seed.sql        # 80+ inventory records
    │
    └── fixes/
        ├── auth-missing-tables.sql   # Fix missing auth tables
        └── add-missing-columns.sql   # Fix missing user columns
```

---

## Environment Configuration

### Frontend Environment (.env.local)

```env
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3001/api

# Optional: For production
# NEXT_PUBLIC_API_URL=https://api.vilag.io/api
```

### Backend Environment (.env)

```env
# Database
DATABASE_URL=postgresql://user:password@host.neon.tech/vilagio_inventory?sslmode=require

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_REFRESH_SECRET=your_super_secret_refresh_key_change_this_in_production
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Server Configuration
PORT=3001
NODE_ENV=development

# Optional: Email Configuration (for password reset)
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=your-email@gmail.com
# SMTP_PASS=your-app-password
```

### Neon Database Connection String Format

```
postgresql://[user]:[password]@[host]/[database]?sslmode=require
```

**Get from Neon Dashboard:**
1. Go to https://console.neon.tech
2. Select your project: vilagio_inventory
3. Go to "Connection Details"
4. Copy "Connection String"
5. Paste into `DATABASE_URL` in backend/.env

---

## Database Schema Reference

### Authentication Tables (Phase 3)

**users**
- Primary user account table
- Stores email, password hash, role
- Active/verified status flags

**roles**
- Role definitions with permissions
- 4 default roles: admin, manager, staff, viewer
- JSONB permissions for flexibility

**user_sessions**
- Active user sessions
- Refresh token storage
- IP address and user agent tracking

**password_reset_tokens**
- Temporary tokens for password reset
- Expiration and usage tracking

**audit_log**
- Comprehensive activity logging
- Stores old and new values (JSONB)
- User and action tracking

### Product Tables (Phase 2 - Already Complete)

**categories**
- 12 water bottle categories
- Size-based organization

**products**
- 88 unique products
- SKU, pricing, specifications
- Category relationships

**inventory**
- Stock levels by location
- 80+ records
- Reorder levels

**locations**
- 6 warehouse locations
- Capacity and type information

**transaction_types**
- 9 transaction types
- Stock impact definitions

**units_of_measurement**
- 6 measurement units
- Conversion factors

---

## Authentication Flow

### Login Sequence

```
1. User enters email and password
   ↓
2. Frontend: useAuth.login(email, password)
   ↓
3. POST /api/auth/login
   ↓
4. Backend: Find user in database
   ↓
5. Backend: Verify password with bcrypt
   ↓
6. Backend: Generate JWT access token (15min)
   ↓
7. Backend: Generate JWT refresh token (7 days)
   ↓
8. Backend: Store refresh token in user_sessions
   ↓
9. Backend: Update last_login timestamp
   ↓
10. Backend: Return user data + tokens
    ↓
11. Frontend: Store in Zustand + localStorage
    ↓
12. Frontend: Set Authorization header
    ↓
13. Frontend: Redirect to /dashboard
```

### Protected Route Access

```
1. User visits /dashboard
   ↓
2. useAuth checks isAuthenticated
   ↓
3. If not authenticated → redirect to /login
   ↓
4. If authenticated → render dashboard
   ↓
5. On API call: Include Authorization header
   ↓
6. Backend: Verify JWT token
   ↓
7. If token expired → use refresh token
   ↓
8. If refresh fails → logout and redirect
```

### Token Refresh Flow

```
1. Access token expires (after 15 minutes)
   ↓
2. API request fails with 401 Unauthorized
   ↓
3. Axios interceptor catches error
   ↓
4. POST /api/auth/refresh with refresh token
   ↓
5. Backend: Verify refresh token
   ↓
6. Backend: Generate new access token
   ↓
7. Frontend: Update access token in store
   ↓
8. Retry original API request
   ↓
9. If refresh fails → logout user
```

### Logout Flow

```
1. User clicks logout button
   ↓
2. Frontend: useAuth.logout()
   ↓
3. POST /api/auth/logout with refresh token
   ↓
4. Backend: Revoke session in database
   ↓
5. Frontend: Clear tokens from store
   ↓
6. Frontend: Clear localStorage
   ↓
7. Frontend: Remove Authorization header
   ↓
8. Frontend: Redirect to /login
```

---

## API Endpoints Reference

### Authentication Endpoints

**POST /api/auth/login**
- **Purpose:** User login
- **Body:** `{ email, password }`
- **Response:** `{ user, accessToken, refreshToken }`
- **Status Codes:**
  - 200: Success
  - 401: Invalid credentials
  - 500: Server error

**POST /api/auth/logout**
- **Purpose:** User logout
- **Body:** `{ refreshToken }`
- **Response:** `{ message: 'Logged out successfully' }`
- **Status Codes:**
  - 200: Success
  - 400: Invalid request

**POST /api/auth/refresh**
- **Purpose:** Refresh access token
- **Body:** `{ refreshToken }`
- **Response:** `{ accessToken, user }`
- **Status Codes:**
  - 200: Success
  - 401: Invalid/expired refresh token

**GET /api/auth/me**
- **Purpose:** Get current user info
- **Headers:** `Authorization: Bearer {accessToken}`
- **Response:** `{ user }`
- **Status Codes:**
  - 200: Success
  - 401: Unauthorized

### Future Endpoints (Phase 4+)

**Products:**
- GET /api/products
- GET /api/products/:id
- POST /api/products
- PUT /api/products/:id
- DELETE /api/products/:id

**Inventory:**
- GET /api/inventory
- GET /api/inventory/:id
- PUT /api/inventory/:id

**Transactions:**
- GET /api/transactions
- GET /api/transactions/:id
- POST /api/transactions

**Reports:**
- GET /api/reports/stock-levels
- GET /api/reports/movements
- GET /api/reports/low-stock

---

## Testing Credentials

### Default Admin Account

**Email:** admin@vilag.io  
**Password:** Admin@123  
**Role:** admin  
**Permissions:** Full system access (14 permissions)

**⚠️ IMPORTANT:** Change this password in production!

### Testing Checklist

**Before Backend Setup:**
- [ ] Login page displays correctly
- [ ] Form fields are visible
- [ ] Logo displays
- [ ] Validation works
- [ ] Error shows: "Network Error" (expected)

**After Backend Setup:**
- [ ] Login succeeds with admin credentials
- [ ] Redirects to /dashboard
- [ ] User name displays in sidebar
- [ ] Stats show on dashboard
- [ ] Logout works
- [ ] Token refresh works (after 15 min)
- [ ] Protected routes redirect to login when not authenticated

---

## Development Workflow

### Daily Development Process

1. **Start Backend Server**
   ```bash
   cd backend
   npm run dev
   # Runs on http://localhost:3001
   ```

2. **Start Frontend Server** (in new terminal)
   ```bash
   cd frontend
   npm run dev
   # Runs on http://localhost:3000
   ```

3. **Make Changes**
   - Edit files in VSCode or your preferred editor
   - Both servers hot-reload automatically

4. **Test Changes**
   - Frontend: Visit http://localhost:3000
   - Backend: Use curl, Postman, or Thunder Client

5. **Commit Changes**
   ```bash
   git add .
   git commit -m "Description of changes"
   git push origin main
   ```

### Debugging Tips

**Frontend Debugging:**
- Open browser DevTools (F12)
- Check Console tab for errors
- Check Network tab for API calls
- Use React DevTools extension

**Backend Debugging:**
- Check terminal for console.log output
- Use Postman/Thunder Client to test endpoints
- Check Neon database with SQL Editor

**Database Debugging:**
- Use Neon SQL Editor web interface
- Run SELECT queries to verify data
- Check for constraint violations

---

## Common Commands Reference

### Frontend Commands

```bash
# Development
npm run dev          # Start dev server (port 3000)
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint

# Package Management
npm install          # Install dependencies
npm install [pkg]    # Add package
npm uninstall [pkg]  # Remove package

# Troubleshooting
rm -rf .next node_modules/.cache  # Clear cache
npm install --legacy-peer-deps    # Install with legacy deps
```

### Backend Commands

```bash
# Development
npm run dev          # Start dev server with nodemon (port 3001)
npm start           # Start production server

# Package Management
npm install         # Install dependencies
npm install [pkg]   # Add package

# Database
psql $DATABASE_URL  # Connect to Neon database (if psql installed)
```

### Git Commands

```bash
# Status and Staging
git status          # Check file status
git add .           # Stage all changes
git add [file]      # Stage specific file

# Committing
git commit -m "message"  # Commit with message
git push origin main     # Push to GitHub

# Branching
git branch          # List branches
git checkout -b [branch]  # Create and switch to branch
git merge [branch]  # Merge branch

# Undoing
git reset --hard    # Discard all local changes
git checkout [file] # Discard changes to specific file
```

---

## Key Contacts & Resources

### Project Information

- **Company:** Vilagio Technologies Ltd.
- **Domain:** www.vilag.io
- **Project:** Inventory Management System
- **Start Date:** Week 1 (Planning phase)
- **Current Phase:** Phase 3 - Week 7 Day 1

### Technical Resources

**Documentation:**
- Next.js: https://nextjs.org/docs
- Tailwind CSS: https://tailwindcss.com/docs
- PostgreSQL: https://www.postgresql.org/docs/
- Neon: https://neon.tech/docs
- JWT: https://jwt.io/introduction

**Development Tools:**
- GitHub Repository: (Your repo URL)
- Neon Dashboard: https://console.neon.tech
- VS Code: https://code.visualstudio.com

---

## Troubleshooting Guide

### Frontend Issues

**Issue: Dev server won't start**
```bash
# Solution 1: Clear cache
rm -rf .next node_modules/.cache
npm run dev

# Solution 2: Reinstall dependencies
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
npm run dev

# Solution 3: Check port 3000
# Kill any process using port 3000
# Windows: netstat -ano | findstr :3000
```

**Issue: Tailwind styles not applying**
```bash
# Check tailwind.config.js exists
# Check postcss.config.mjs exists
# Clear cache and restart
rm -rf .next
npm run dev
```

**Issue: Module not found errors**
```bash
# Check tsconfig.json has path aliases
# Install missing packages
npm install [missing-package] --legacy-peer-deps
```

### Backend Issues

**Issue: Database connection fails**
- Verify DATABASE_URL in .env
- Check Neon database is active
- Test connection with psql or Neon SQL Editor
- Ensure SSL mode is set: ?sslmode=require

**Issue: JWT token errors**
- Verify JWT_SECRET in .env
- Check token expiration times
- Ensure tokens are being passed in headers

**Issue: CORS errors**
- Verify cors middleware is enabled
- Check frontend URL is allowed
- Ensure proper headers are set

### Database Issues

**Issue: Missing tables**
- Run the SQL scripts in order
- Check Neon SQL Editor for errors
- Verify tables exist with: `\dt` or SELECT * FROM information_schema.tables

**Issue: Admin user doesn't exist**
- Run create-admin-direct.sql
- Verify with: SELECT * FROM users WHERE email = 'admin@vilag.io'

**Issue: Password verification fails**
- Ensure bcrypt hash was created properly
- Password is: Admin@123 (case-sensitive)
- Verify hash in database is 60 characters

---

## Success Criteria

### Phase 3 Complete When:

✅ **Database:**
- All 5 authentication tables exist
- Admin user created and verified
- 4 roles configured with permissions

✅ **Backend:**
- Express server running on port 3001
- Login endpoint working
- Logout endpoint working
- Refresh token endpoint working
- JWT tokens generated correctly
- Password verification working

✅ **Frontend:**
- Next.js running on port 3000
- Login page displays correctly with logo
- Dashboard displays after login
- Protected routes working
- Token refresh automatic
- Logout redirects to login
- User info displays in sidebar

✅ **Integration:**
- Full login flow works end-to-end
- API calls succeed from frontend to backend
- Tokens stored and used correctly
- Session management working

---

## Final Notes

### Important Reminders

1. **Security:**
   - Never commit .env files to Git
   - Change default passwords in production
   - Use strong JWT secrets
   - Enable HTTPS in production

2. **Performance:**
   - Keep access tokens short-lived (15 min)
   - Use refresh tokens for extended sessions
   - Cache static assets
   - Optimize database queries

3. **Best Practices:**
   - Write clean, commented code
   - Follow TypeScript types
   - Use consistent naming conventions
   - Test before committing

4. **Git Workflow:**
   - Commit frequently with clear messages
   - Create feature branches for big changes
   - Don't commit node_modules or .next
   - Keep .gitignore updated

### What to Do If Stuck

1. **Check this document first** - Most answers are here
2. **Check browser console** - F12 for frontend errors
3. **Check terminal output** - For backend errors
4. **Verify environment variables** - .env.local and .env
5. **Clear cache and restart** - Fixes 80% of issues
6. **Check database** - Use Neon SQL Editor to verify data

### Project Timeline

```
✅ Phase 1 (Week 1-2):   Planning & Design
✅ Phase 2 (Week 3-5):   Database & Data Population
⏳ Phase 3 (Week 6-8):   Authentication System (Current: Week 7 Day 1)
📋 Phase 4 (Week 9-12):  Inventory Management
📋 Phase 5 (Week 13-15): Transaction Management
📋 Phase 6 (Week 16-18): Reporting & Analytics
📋 Phase 7 (Week 19-20): Testing & Deployment
```

**Estimated Completion:** Week 20

---

## Document End

**This document should contain everything needed to:**
1. Understand what we're building
2. Know where we are in the project
3. See what's been completed
4. Understand what needs to be done next
5. Continue development in a new conversation

**Last Status:** Frontend 70% complete, Backend 0% complete, Next step is backend API setup.

**Key Files Ready:**
- Frontend: 100% of files created
- Backend: 0% of files created (next priority)
- Database: 100% complete

**Ready to Continue:** YES - Start with Priority 2 (Backend API Setup)
