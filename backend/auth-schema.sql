-- auth-schema.sql
-- Authentication and Authorization Schema for Vilagio Inventory System
-- Week 7 Day 1: User Management, Roles, and Sessions

-- ============================================================================
-- USERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'viewer',
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    
    -- Constraints
    CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT valid_role CHECK (role IN ('admin', 'manager', 'staff', 'viewer'))
);

-- Create indexes for users table
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active ON users(is_active);

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
CREATE INDEX idx_roles_name ON roles(role_name);

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
CREATE INDEX idx_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_sessions_token ON user_sessions(refresh_token);
CREATE INDEX idx_sessions_expires ON user_sessions(expires_at);
CREATE INDEX idx_sessions_active ON user_sessions(is_revoked, expires_at);

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
CREATE INDEX idx_reset_tokens_user ON password_reset_tokens(user_id);
CREATE INDEX idx_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX idx_reset_tokens_expires ON password_reset_tokens(expires_at);

-- ============================================================================
-- AUDIT LOG TABLE (for security tracking)
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_log (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id UUID,
    changes JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for audit log
CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_action ON audit_log(action);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_created ON audit_log(created_at);

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
-- SEED DATA: Default Admin User
-- ============================================================================
-- Password: Admin@123 (hashed with bcrypt)
-- NOTE: Change this password immediately after first login!
INSERT INTO users (email, password_hash, full_name, role, is_active, is_verified)
VALUES (
    'admin@vilag.io',
    '$2b$10$rqQZXqX5qJ5qJ5qJ5qJ5qeXYZ1234567890ABCDEFGHIJ',  -- Placeholder - will be replaced
    'System Administrator',
    'admin',
    true,
    true
)
ON CONFLICT (email) DO NOTHING;

-- ============================================================================
-- FUNCTIONS: Update timestamp trigger
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update triggers
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_roles_updated_at
    BEFORE UPDATE ON roles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- FUNCTIONS: Clean expired sessions
-- ============================================================================
CREATE OR REPLACE FUNCTION clean_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM user_sessions
    WHERE expires_at < CURRENT_TIMESTAMP
       OR is_revoked = true;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTIONS: Clean expired reset tokens
-- ============================================================================
CREATE OR REPLACE FUNCTION clean_expired_reset_tokens()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM password_reset_tokens
    WHERE expires_at < CURRENT_TIMESTAMP
       OR used = true;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VIEWS: Active Users
-- ============================================================================
CREATE OR REPLACE VIEW active_users AS
SELECT 
    user_id,
    email,
    full_name,
    role,
    created_at,
    last_login,
    (
        SELECT COUNT(*)
        FROM user_sessions
        WHERE user_sessions.user_id = users.user_id
          AND expires_at > CURRENT_TIMESTAMP
          AND is_revoked = false
    ) as active_sessions
FROM users
WHERE is_active = true
ORDER BY created_at DESC;

-- ============================================================================
-- VIEWS: User Activity
-- ============================================================================
CREATE OR REPLACE VIEW user_activity AS
SELECT 
    u.user_id,
    u.email,
    u.full_name,
    u.role,
    u.last_login,
    COUNT(DISTINCT s.session_id) as session_count,
    COUNT(DISTINCT a.log_id) as action_count,
    MAX(a.created_at) as last_action
FROM users u
LEFT JOIN user_sessions s ON u.user_id = s.user_id 
    AND s.expires_at > CURRENT_TIMESTAMP 
    AND s.is_revoked = false
LEFT JOIN audit_log a ON u.user_id = a.user_id 
    AND a.created_at > CURRENT_TIMESTAMP - INTERVAL '30 days'
WHERE u.is_active = true
GROUP BY u.user_id, u.email, u.full_name, u.role, u.last_login
ORDER BY u.last_login DESC NULLS LAST;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE users IS 'Application users with authentication credentials';
COMMENT ON TABLE roles IS 'Role definitions with RBAC permissions';
COMMENT ON TABLE user_sessions IS 'Active user sessions with refresh tokens';
COMMENT ON TABLE password_reset_tokens IS 'Temporary tokens for password reset';
COMMENT ON TABLE audit_log IS 'Security audit trail for user actions';

COMMENT ON COLUMN users.role IS 'User role: admin, manager, staff, or viewer';
COMMENT ON COLUMN users.is_active IS 'Whether user account is active';
COMMENT ON COLUMN users.is_verified IS 'Whether user email is verified';
COMMENT ON COLUMN roles.permissions IS 'JSON array of permission strings';
COMMENT ON COLUMN user_sessions.refresh_token IS 'JWT refresh token for session renewal';
COMMENT ON COLUMN audit_log.changes IS 'JSON object containing before/after values';

-- ============================================================================
-- GRANTS (adjust as needed for your environment)
-- ============================================================================
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO vilagio_app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO vilagio_app;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO vilagio_app;

COMMIT;
