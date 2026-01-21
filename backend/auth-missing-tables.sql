-- auth-missing-tables.sql
-- Creates the 3 missing authentication tables for Vilagio Inventory System
-- Run this in Neon SQL Editor

-- ============================================================================
-- ROLES TABLE (for RBAC)
-- ============================================================================
CREATE TABLE IF NOT EXISTS roles (
    role_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_name VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    permissions JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_role_name CHECK (role_name ~ '^[a-z_]+$')
);

-- Create index for roles
CREATE INDEX IF NOT EXISTS idx_roles_name ON roles(role_name);

-- ============================================================================
-- USER SESSIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    refresh_token TEXT NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_revoked BOOLEAN DEFAULT false
);

-- Create indexes for sessions
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(refresh_token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON user_sessions(is_revoked, expires_at);

-- ============================================================================
-- PASSWORD RESET TOKENS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    token_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for password reset tokens
CREATE INDEX IF NOT EXISTS idx_reset_tokens_user ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_reset_tokens_expires ON password_reset_tokens(expires_at);

-- ============================================================================
-- SEED DATA: Default Roles
-- ============================================================================
INSERT INTO roles (role_name, display_name, description, permissions) VALUES
(
    'admin',
    'Administrator',
    'Full system access with all permissions',
    '[
        "inventory.view", "inventory.create", "inventory.update", "inventory.delete",
        "transactions.view", "transactions.create", "transactions.update", "transactions.delete",
        "batches.view", "batches.create", "batches.update", "batches.delete",
        "reports.view", "reports.create", "reports.export",
        "users.view", "users.create", "users.update", "users.delete",
        "settings.view", "settings.update"
    ]'::jsonb
),
(
    'manager',
    'Manager',
    'Can manage inventory and view reports',
    '[
        "inventory.view", "inventory.create", "inventory.update",
        "transactions.view", "transactions.create", "transactions.update",
        "batches.view", "batches.create", "batches.update",
        "reports.view", "reports.create", "reports.export",
        "users.view"
    ]'::jsonb
),
(
    'staff',
    'Staff Member',
    'Can process transactions and view inventory',
    '[
        "inventory.view",
        "transactions.view", "transactions.create",
        "batches.view",
        "reports.view"
    ]'::jsonb
),
(
    'viewer',
    'Viewer',
    'Read-only access to inventory and reports',
    '[
        "inventory.view",
        "transactions.view",
        "batches.view",
        "reports.view"
    ]'::jsonb
)
ON CONFLICT (role_name) DO NOTHING;

-- ============================================================================
-- Update trigger for roles table
-- ============================================================================
CREATE TRIGGER update_roles_updated_at
    BEFORE UPDATE ON roles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Verification Query
-- ============================================================================
-- Run this to verify everything was created:
-- SELECT table_name FROM information_schema.tables WHERE table_name IN ('roles', 'user_sessions', 'password_reset_tokens');
-- SELECT * FROM roles;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Successfully created 3 missing tables: roles, user_sessions, password_reset_tokens';
    RAISE NOTICE 'Created 4 default roles: admin, manager, staff, viewer';
END $$;
