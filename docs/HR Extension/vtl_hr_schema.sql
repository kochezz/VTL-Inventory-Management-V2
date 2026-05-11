-- =============================================================================
-- VTL-ERP · HR MODULE DATABASE SCHEMA  (v1.1 — CORRECTED)
-- Vilagio Trading Limited — freshDRIP Water Bottling, Chingola, Zambia
-- =============================================================================
-- Target:   PostgreSQL 14+ on Neon Tech Cloud
-- Run in:   Neon SQL Editor (paste entire script, execute once)
-- Depends:  Existing VTL-ERP schema (users + audit_log tables must exist)
--
-- KEY CORRECTIONS FROM v1.0:
--   · users table PK is user_id (uuid), NOT id
--   · users table already has: full_name, preferred_name, national_id,
--     personal_email, phone_number, home_address, emergency_contacts,
--     job_title, department, reports_to, employment_status, employment_type,
--     employee_number, employment_date, date_of_birth, gender, nationality,
--     photo_url, badge_number
--   · users.role is VARCHAR with a CHECK constraint — NOT a pg enum type
--   · hr_employees is now a lean EXTENSION table (HR-only fields only)
--     It does NOT duplicate fields already in users
--   · All REFERENCES users(id) corrected to REFERENCES users(user_id)
--
-- DESIGN PRINCIPLE:
--   users         = authentication + identity master record (existing)
--   hr_employees  = HR-specific extension (contract, probation, salary, flags)
--   Join them on: users.user_id = hr_employees.user_id
--
-- SAFE TO RUN ON EXISTING DATABASE:
--   · All CREATE statements use IF NOT EXISTS
--   · RBAC update uses DROP/ADD CHECK constraint (idempotent)
--   · No existing tables or data are modified
--   · Run Section 25 verification queries after execution
-- =============================================================================


-- =============================================================================
-- SECTION 0: SAFETY CHECKS
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'users'
  ) THEN
    RAISE EXCEPTION 'SAFETY CHECK FAILED: users table not found. '
      'Run the base VTL-ERP schema.sql before this script.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'users'
      AND column_name  = 'user_id'
  ) THEN
    RAISE EXCEPTION 'SAFETY CHECK FAILED: users.user_id column not found. '
      'Verify the users table primary key column name.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'audit_log'
  ) THEN
    RAISE EXCEPTION 'SAFETY CHECK FAILED: audit_log table not found. '
      'Run the base VTL-ERP schema.sql before this script.';
  END IF;

  RAISE NOTICE 'Safety checks passed. Proceeding with HR schema installation.';
END $$;


-- =============================================================================
-- SECTION 1: ENUM TYPE DEFINITIONS
-- =============================================================================

-- HR employment lifecycle status (HR module tracking — complements users.employment_status)
DO $$ BEGIN
  CREATE TYPE hr_employment_status AS ENUM (
    'pre_start',      -- Offer accepted, not yet started
    'onboarding',     -- Day 1 through end of probation
    'probation',      -- Actively on probation
    'confirmed',      -- Probation passed, confirmed employee
    'pip_active',     -- Currently on a Performance Improvement Plan
    'notice_period',  -- Serving notice
    'exited'          -- Employment ended
  );
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Type hr_employment_status already exists — skipping.';
END $$;

-- Contract types per Zambian Employment Code Act 2019
DO $$ BEGIN
  CREATE TYPE hr_contract_type AS ENUM (
    'permanent',      -- No fixed end date, expires at retirement age
    'long_term',      -- Fixed term > 12 months
    'short_term',     -- Fixed term <= 12 months
    'probationary'    -- Probationary period only (max 6 months)
  );
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Type hr_contract_type already exists — skipping.';
END $$;

-- Onboarding module identifiers (maps to D3 Onboarding Programme)
DO $$ BEGIN
  CREATE TYPE hr_onboarding_module AS ENUM (
    'phase_1_induction',     -- MD-led company induction (Day 1 AM)
    'phase_2_gmp_safety',    -- GMP, HACCP awareness, safety (Day 1-2)
    'module_a_finance',      -- Finance dept technical training
    'module_b_operations',   -- Production & operations training
    'module_c_engineering',  -- Engineering & maintenance training
    'module_d_qa_qc',        -- Quality assurance & lab training
    'module_e_sales_admin',  -- Sales & administration training
    'module_f_mgmt_systems'  -- Management systems (senior roles only)
  );
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Type hr_onboarding_module already exists — skipping.';
END $$;

-- Completion status per module
DO $$ BEGIN
  CREATE TYPE hr_module_status AS ENUM (
    'not_started',
    'in_progress',
    'completed',
    'not_applicable'
  );
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Type hr_module_status already exists — skipping.';
END $$;

-- Review types
DO $$ BEGIN
  CREATE TYPE hr_review_type AS ENUM (
    'day_30',
    'day_90',
    'pip_30_day',
    'pip_final',
    'annual_h1',
    'annual_h2'
  );
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Type hr_review_type already exists — skipping.';
END $$;

-- Review and probation outcomes
DO $$ BEGIN
  CREATE TYPE hr_review_outcome AS ENUM (
    'on_track',
    'action_required',
    'serious_concern',
    'confirmed',
    'extended',
    'probation_failed',
    'pip_passed',
    'pip_failed',
    'pending'
  );
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Type hr_review_outcome already exists — skipping.';
END $$;

-- Output performance rating (1–5 from D2 Output Scorecard)
DO $$ BEGIN
  CREATE TYPE hr_performance_rating AS ENUM (
    'rating_1_unacceptable',
    'rating_2_below_target',
    'rating_3_on_target',
    'rating_4_above_target',
    'rating_5_exceptional'
  );
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Type hr_performance_rating already exists — skipping.';
END $$;

-- Personnel document types
DO $$ BEGIN
  CREATE TYPE hr_document_type AS ENUM (
    'employment_contract',
    'contract_schedule_1',
    'schedule_3_receipt',
    'nrc_passport_copy',
    'phase_1_signoff',
    'phase_2_signoff',
    'module_signoff',
    'sop_training_record',
    'day_14_checkin_note',
    'day_30_review_form',
    'day_90_review_form',
    'confirmation_letter',
    'pip_document',
    'written_warning',
    'leave_record',
    'sick_leave_certificate',
    'salary_change_letter',
    'training_certificate',
    'exit_documentation',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Type hr_document_type already exists — skipping.';
END $$;

-- Leave types per Zambian Employment Code Act 2019
DO $$ BEGIN
  CREATE TYPE hr_leave_type AS ENUM (
    'annual',
    'sick',
    'maternity',
    'paternity',
    'bereavement',
    'unpaid',
    'public_holiday',
    'study',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Type hr_leave_type already exists — skipping.';
END $$;

-- Leave status
DO $$ BEGIN
  CREATE TYPE hr_leave_status AS ENUM (
    'requested',
    'approved',
    'rejected',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Type hr_leave_status already exists — skipping.';
END $$;


-- =============================================================================
-- SECTION 2: RBAC — ADD HR ROLES TO users TABLE
-- =============================================================================
-- users.role is VARCHAR with a CHECK constraint (confirmed from schema inspection).
-- We drop the existing constraint and recreate it with the two new HR roles added.
-- This is safe and idempotent.

DO $$
DECLARE
  existing_constraint TEXT;
BEGIN
  -- Find the existing CHECK constraint name on users.role
  SELECT constraint_name INTO existing_constraint
  FROM information_schema.table_constraints
  WHERE table_schema    = 'public'
    AND table_name      = 'users'
    AND constraint_type = 'CHECK'
    AND constraint_name LIKE '%role%'
  LIMIT 1;

  IF existing_constraint IS NOT NULL THEN
    EXECUTE 'ALTER TABLE users DROP CONSTRAINT IF EXISTS ' || existing_constraint;
    RAISE NOTICE 'Dropped existing role CHECK constraint: %', existing_constraint;
  ELSE
    RAISE NOTICE 'No existing role CHECK constraint found — will add fresh constraint.';
  END IF;

  -- Add updated constraint including all existing roles plus two new HR roles
  ALTER TABLE users ADD CONSTRAINT users_role_check
    CHECK (role IN (
      'admin',
      'warehouse_manager',
      'warehouse_staff',
      'production_manager',
      'viewer',
      'hr_admin',    -- MD: full HR read/write, sees salary data, all records
      'hr_manager'   -- Line managers: update onboarding for direct reports
    ));

  RAISE NOTICE 'Role CHECK constraint updated with hr_admin and hr_manager.';
END $$;


-- =============================================================================
-- SECTION 3: DEPARTMENTS TABLE
-- =============================================================================
-- Structured replacement for users.department (which is free text).
-- The HR module uses department_id (FK). Existing users.department text field
-- is left untouched for backwards compatibility.

CREATE TABLE IF NOT EXISTS hr_departments (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  code             VARCHAR(20)  UNIQUE NOT NULL,
  name             VARCHAR(100) NOT NULL,
  description      TEXT,
  head_user_id     UUID         REFERENCES users(user_id) ON DELETE SET NULL,
  is_active        BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE hr_departments IS
  'Structured department registry. head_user_id references the department head in users. '
  'Complements users.department (free text) with a proper FK-able structure for HR module.';

-- Seed the four VTL departments
INSERT INTO hr_departments (code, name, description) VALUES
  ('FIN',   'Finance',
   'CFO, Junior Accountant'),
  ('OPS',   'Operations',
   'Operations Manager, Senior Engineer, Junior Engineers, Production Operators'),
  ('QA',    'Quality Assurance',
   'QA Operatives, QC Lab Analyst'),
  ('SALES', 'Sales & Administration',
   'Sales & Admin Officers')
ON CONFLICT (code) DO NOTHING;

RAISE NOTICE 'hr_departments created and seeded with 4 departments.';


-- =============================================================================
-- SECTION 4: CORE HR EMPLOYEES EXTENSION TABLE
-- =============================================================================
-- This table EXTENDS users — it does NOT duplicate fields already in users.
-- Join on: users.user_id = hr_employees.user_id
--
-- Fields intentionally NOT included (already in users):
--   full_name, preferred_name, email, personal_email, phone_number,
--   home_address, emergency_contacts, national_id, nationality,
--   date_of_birth, gender, photo_url, job_title, department (text),
--   reports_to (text), employment_status (text), employment_type,
--   employee_number, employment_date, badge_number, is_active

CREATE TABLE IF NOT EXISTS hr_employees (
  -- Primary link to users table
  user_id               UUID         PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,

  -- Structured HR relationships (structured versions of users free-text fields)
  department_id         UUID         REFERENCES hr_departments(id) ON DELETE SET NULL,
  reports_to_user_id    UUID         REFERENCES users(user_id) ON DELETE SET NULL,

  -- HR-specific employment fields (not in users)
  hr_status             hr_employment_status NOT NULL DEFAULT 'pre_start',
  contract_type         hr_contract_type     NOT NULL DEFAULT 'permanent',

  -- Probation tracking (employment_date is in users)
  -- probation_end_date cannot be a generated column because it references users.employment_date
  -- It is populated by trigger on insert
  probation_end_date    DATE,
  probation_extended_to DATE,
  confirmation_date     DATE,
  offer_accepted_date   DATE,

  -- Exit management
  notice_start_date     DATE,
  exit_date             DATE,
  exit_reason           TEXT,

  -- Remuneration (visible to hr_admin role only — enforced at API layer)
  basic_salary_zmw      NUMERIC(12,2),
  salary_effective_date DATE,
  napsa_member_number   VARCHAR(50),

  -- Onboarding completion flag (auto-maintained by trigger)
  onboarding_complete   BOOLEAN      NOT NULL DEFAULT FALSE,

  -- Audit
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_by            UUID         REFERENCES users(user_id),
  updated_by            UUID         REFERENCES users(user_id)
);

COMMENT ON TABLE hr_employees IS
  'HR extension table for users. One row per employee, keyed on user_id. '
  'Contains only fields NOT already present in the users table. '
  'To get a full employee profile: SELECT u.*, e.* FROM users u JOIN hr_employees e USING (user_id). '
  'hr_status mirrors users.employment_status in HR enum form — kept in sync by trigger. '
  'salary fields are sensitive; restrict to hr_admin at the API/RLS layer.';

COMMENT ON COLUMN hr_employees.user_id IS
  'PK and FK to users.user_id. One-to-one relationship.';
COMMENT ON COLUMN hr_employees.department_id IS
  'Structured FK to hr_departments. Complements users.department (free text).';
COMMENT ON COLUMN hr_employees.reports_to_user_id IS
  'Structured FK to users.user_id of the line manager. Complements users.reports_to (free text).';
COMMENT ON COLUMN hr_employees.probation_end_date IS
  'Set by trigger on insert to users.employment_date + 90 days. '
  'Override with probation_extended_to when probation is extended.';
COMMENT ON COLUMN hr_employees.onboarding_complete IS
  'Auto-set TRUE by trigger when all required hr_onboarding_progress rows '
  'reach completed or not_applicable status.';


-- =============================================================================
-- SECTION 5: PROBATION DATE POPULATION TRIGGER
-- =============================================================================
-- When an hr_employees row is inserted, look up employment_date from users
-- and compute the probation_end_date automatically.

CREATE OR REPLACE FUNCTION hr_set_probation_end_date()
RETURNS TRIGGER AS $$
DECLARE
  emp_date DATE;
BEGIN
  SELECT employment_date INTO emp_date
  FROM users
  WHERE user_id = NEW.user_id;

  IF emp_date IS NOT NULL THEN
    NEW.probation_end_date := emp_date + INTERVAL '90 days';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_hr_probation_end_date ON hr_employees;
CREATE TRIGGER trg_hr_probation_end_date
  BEFORE INSERT ON hr_employees
  FOR EACH ROW
  WHEN (NEW.probation_end_date IS NULL)
  EXECUTE FUNCTION hr_set_probation_end_date();


-- =============================================================================
-- SECTION 6: EMPLOYMENT CONTRACTS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS hr_contracts (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID         NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  contract_reference    VARCHAR(50)  UNIQUE NOT NULL,

  -- Terms (job_title is read from users; stored here as-of the contract date)
  job_title_at_signing  VARCHAR(150) NOT NULL,
  department_id         UUID         REFERENCES hr_departments(id),
  contract_type         hr_contract_type NOT NULL,

  -- Financial terms (ZMW)
  basic_salary_zmw      NUMERIC(12,2) NOT NULL,
  salary_review_date    DATE,
  transport_allowance   NUMERIC(10,2) DEFAULT 0,
  other_allowances_json JSONB         DEFAULT '{}',

  -- Duration
  effective_date        DATE          NOT NULL,
  end_date              DATE,                          -- NULL for permanent
  probation_months      INTEGER       NOT NULL DEFAULT 3 CHECK (probation_months <= 6),
  notice_period_days    INTEGER       NOT NULL DEFAULT 30,

  -- Signing status
  signed_date           DATE,
  signed_by_employee    BOOLEAN       NOT NULL DEFAULT FALSE,
  signed_by_md          BOOLEAN       NOT NULL DEFAULT FALSE,
  document_ref          TEXT,

  -- Status
  is_current            BOOLEAN       NOT NULL DEFAULT TRUE,
  superseded_by_id      UUID          REFERENCES hr_contracts(id),

  -- Audit
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_by            UUID          REFERENCES users(user_id)
);

COMMENT ON TABLE hr_contracts IS
  'Employment contract records per user. When terms change, current row is superseded '
  'and a new row created. job_title_at_signing captures the title as stated in the contract, '
  'independent of any future changes to users.job_title.';

COMMENT ON COLUMN hr_contracts.probation_months IS
  'Maximum 6 months per Zambian Employment Code Act 2019 (Section 2.1 of D7/D8 contracts).';


-- =============================================================================
-- SECTION 7: ONBOARDING PROGRESS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS hr_onboarding_progress (
  id                  UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID              NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  module              hr_onboarding_module NOT NULL,
  status              hr_module_status  NOT NULL DEFAULT 'not_started',

  -- Scheduling
  scheduled_date      DATE,
  started_date        DATE,
  completed_date      DATE,

  -- Sign-off (both parties required per D3 Onboarding Programme)
  trainer_user_id     UUID              REFERENCES users(user_id),
  trainer_signed_date DATE,
  trainee_signed_date DATE,

  -- Assessment (mandatory for phase_2_gmp_safety — min 80% to pass)
  assessment_score    NUMERIC(5,2)      CHECK (assessment_score BETWEEN 0 AND 100),
  assessment_passed   BOOLEAN GENERATED ALWAYS AS (
                        CASE WHEN assessment_score IS NOT NULL
                             THEN assessment_score >= 80.0
                             ELSE NULL END
                      ) STORED,
  retest_required     BOOLEAN           NOT NULL DEFAULT FALSE,
  retest_date         DATE,
  retest_score        NUMERIC(5,2)      CHECK (retest_score BETWEEN 0 AND 100),

  notes               TEXT,

  -- Audit
  created_at          TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ       NOT NULL DEFAULT NOW(),

  -- One row per user per module
  UNIQUE (user_id, module)
);

COMMENT ON TABLE hr_onboarding_progress IS
  'One row per user per onboarding module. Tracks completion per D3 Onboarding Programme. '
  'phase_2_gmp_safety requires assessment_score >= 80 to pass (Employment Code compliance). '
  'hr_employees.onboarding_complete is set TRUE when all required modules are complete.';


-- =============================================================================
-- SECTION 8: COMPETENCY SIGN-OFF ITEMS
-- =============================================================================
CREATE TABLE IF NOT EXISTS hr_competency_signoffs (
  id               UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  progress_id      UUID              NOT NULL REFERENCES hr_onboarding_progress(id) ON DELETE CASCADE,
  user_id          UUID              NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  module           hr_onboarding_module NOT NULL,

  -- Competency item (maps to numbered items in D3 module checklists)
  item_sequence    INTEGER           NOT NULL,
  item_code        VARCHAR(50)       NOT NULL,  -- e.g. 'MOD_B_001'
  item_description TEXT              NOT NULL,  -- Verbatim from D3 checklist

  -- Sign-off
  trainee_initials VARCHAR(10),
  trainer_initials VARCHAR(10),
  signed_date      DATE,
  assessed_by      UUID              REFERENCES users(user_id),

  created_at       TIMESTAMPTZ       NOT NULL DEFAULT NOW(),

  UNIQUE (progress_id, item_code)
);

COMMENT ON TABLE hr_competency_signoffs IS
  'Granular task-level sign-offs within each onboarding module. '
  'Maps to the numbered competency checklists in D3 (e.g. "Can perform fill volume check independently"). '
  'These records constitute the legal competency evidence for the personnel file.';


-- =============================================================================
-- SECTION 9: SOP TRAINING RECORDS
-- =============================================================================
CREATE TABLE IF NOT EXISTS hr_sop_training_records (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID         NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,

  -- SOP identity (no FK to QMS — QMS table may not exist yet)
  sop_reference    VARCHAR(30)  NOT NULL,   -- e.g. 'VTL-OPS-001'
  sop_title        VARCHAR(200) NOT NULL,
  sop_version      VARCHAR(10)  NOT NULL DEFAULT '1.0',
  sop_category     VARCHAR(50),             -- e.g. 'Operations', 'QA', 'Engineering'

  -- Training event
  trained_date     DATE         NOT NULL,
  trainer_name     VARCHAR(200),
  trainer_user_id  UUID         REFERENCES users(user_id),
  training_method  VARCHAR(100),

  -- Assessment
  assessed         BOOLEAN      NOT NULL DEFAULT FALSE,
  assessment_pass  BOOLEAN,
  assessment_date  DATE,

  -- Acknowledgement
  employee_signed  BOOLEAN      NOT NULL DEFAULT FALSE,
  signed_date      DATE,

  -- Expiry tracking
  valid_until      DATE,
  is_current       BOOLEAN      NOT NULL DEFAULT TRUE,

  -- Audit
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_by       UUID         REFERENCES users(user_id)
);

COMMENT ON TABLE hr_sop_training_records IS
  'Log of SOP training completed by each user. HR module reads these to show '
  'SOP compliance in the onboarding tracker. SOP content/versions live in QMS — '
  'this table is the HR training log only (no FK dependency on QMS). '
  'sop_reference (e.g. VTL-OPS-001) is the join key when QMS tables are built.';


-- =============================================================================
-- SECTION 10: PROBATION & PERFORMANCE REVIEWS
-- =============================================================================
CREATE TABLE IF NOT EXISTS hr_reviews (
  id                              UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                         UUID              NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  review_type                     hr_review_type    NOT NULL,
  review_date                     DATE              NOT NULL,
  scheduled_date                  DATE,

  -- Reviewers
  conducted_by_user_id            UUID              NOT NULL REFERENCES users(user_id),
  line_manager_user_id            UUID              REFERENCES users(user_id),
  line_manager_assessment_received BOOLEAN          NOT NULL DEFAULT FALSE,
  line_manager_assessment_date    DATE,

  -- Onboarding gate check (Day 90 only)
  onboarding_complete_verified    BOOLEAN,
  onboarding_notes                TEXT,

  -- Output performance scores (from D2 Output Scorecard)
  -- Structure: {"financial_outputs": 3, "reporting": 4, "gmp_safety": 3, "weighted_score": 3.2}
  performance_scores_json         JSONB             DEFAULT '{}',
  weighted_overall_score          NUMERIC(3,1)      CHECK (weighted_overall_score BETWEEN 1 AND 5),

  -- Behavioural assessment per criterion {criterion, assessment, example}
  behavioural_assessment_json     JSONB             DEFAULT '{}',

  -- Employee self-assessment (verbatim responses per D5 form)
  employee_self_assessment_json   JSONB             DEFAULT '{}',

  -- Outcome
  outcome                         hr_review_outcome NOT NULL DEFAULT 'pending',
  outcome_justification           TEXT,

  -- Action items [{action, responsible_user_id, deadline, closed_date}]
  action_items_json               JSONB             DEFAULT '[]',

  -- Confirmation (Day 90)
  confirmed_in_post               BOOLEAN,
  confirmation_letter_ref         TEXT,

  -- Signatures
  md_signed                       BOOLEAN           NOT NULL DEFAULT FALSE,
  md_signed_date                  DATE,
  line_manager_signed             BOOLEAN           NOT NULL DEFAULT FALSE,
  line_manager_signed_date        DATE,
  employee_signed                 BOOLEAN           NOT NULL DEFAULT FALSE,
  employee_signed_date            DATE,
  employee_refused_sign           BOOLEAN           NOT NULL DEFAULT FALSE,

  -- Audit
  created_at                      TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at                      TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  created_by                      UUID              REFERENCES users(user_id)
);

COMMENT ON TABLE hr_reviews IS
  'All formal reviews: Day 30, Day 90, PIP check-ins, and half-yearly performance reviews. '
  'Maps to D5 review forms and D2 output scorecard ratings. '
  'weighted_overall_score drives the PIP alert trigger (score <= 2.0). '
  'outcome drives the employment status sync trigger.';


-- =============================================================================
-- SECTION 11: PERFORMANCE IMPROVEMENT PLANS
-- =============================================================================
CREATE TABLE IF NOT EXISTS hr_pips (
  id                      UUID                 PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID                 NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  review_id               UUID                 REFERENCES hr_reviews(id),

  -- Dates
  issued_date             DATE                 NOT NULL,
  pip_end_date            DATE                 NOT NULL,
  checkin_date            DATE,
  closed_date             DATE,

  -- Trigger
  triggered_by_rating     hr_performance_rating NOT NULL DEFAULT 'rating_2_below_target',

  -- Performance gaps [{output_area, target, actual, evidence}]
  performance_gap_json    JSONB                NOT NULL DEFAULT '[]',

  -- SMART targets [{target, measurement, deadline, verified_by}]
  targets_json            JSONB                NOT NULL DEFAULT '[]',

  -- Support offered [{support, provided_by, date}]
  support_json            JSONB                NOT NULL DEFAULT '[]',

  consequence_acknowledged BOOLEAN             NOT NULL DEFAULT FALSE,

  -- Outcome
  outcome                 VARCHAR(20)          CHECK (outcome IN ('passed','failed','extended')),
  outcome_notes           TEXT,
  final_rating            hr_performance_rating,

  -- Signatures
  md_signed               BOOLEAN              NOT NULL DEFAULT FALSE,
  md_signed_date          DATE,
  line_manager_signed     BOOLEAN              NOT NULL DEFAULT FALSE,
  employee_signed         BOOLEAN              NOT NULL DEFAULT FALSE,
  employee_signed_date    DATE,
  employee_refused        BOOLEAN              NOT NULL DEFAULT FALSE,

  is_active               BOOLEAN              NOT NULL DEFAULT TRUE,

  -- Audit
  created_at              TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
  created_by              UUID                 REFERENCES users(user_id)
);

COMMENT ON TABLE hr_pips IS
  'Performance Improvement Plans. Must be issued within 5 working days of a Rating 2 review. '
  'Maps to the D5 PIP template. One active PIP per user at a time (enforced at API layer). '
  'Triggers system alert automatically via hr_alert_on_rating_2 function.';


-- =============================================================================
-- SECTION 12: QUARTERLY OUTPUT RATINGS
-- =============================================================================
CREATE TABLE IF NOT EXISTS hr_performance_ratings (
  id                UUID                 PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID                 NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  review_id         UUID                 REFERENCES hr_reviews(id),

  -- Period
  quarter           INTEGER              NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  year              INTEGER              NOT NULL,
  rating_date       DATE                 NOT NULL,

  -- Per-category output scores (structure varies by role — stored as JSONB)
  -- Example: {"financial_outputs": 3, "reporting": 4, "compliance": 3}
  output_scores_json JSONB               NOT NULL DEFAULT '{}',

  overall_rating    hr_performance_rating NOT NULL,
  overall_score     NUMERIC(3,1)         CHECK (overall_score BETWEEN 1 AND 5),

  -- MD notes and action
  md_notes          TEXT,
  action_required   BOOLEAN              NOT NULL DEFAULT FALSE,
  action_type       VARCHAR(20)          CHECK (action_type IN ('pip','warning','bonus','none')),

  -- Bonus eligibility auto-computed
  bonus_eligible    BOOLEAN GENERATED ALWAYS AS (
                      overall_rating IN ('rating_4_above_target','rating_5_exceptional')
                    ) STORED,

  rated_by          UUID                 NOT NULL REFERENCES users(user_id),
  created_at        TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ          NOT NULL DEFAULT NOW(),

  UNIQUE (user_id, quarter, year)
);

COMMENT ON TABLE hr_performance_ratings IS
  'Quarterly output ratings for all employees. Maps to D2 Section 9 (Quarterly Register). '
  'bonus_eligible auto-computes TRUE at Rating 4 or 5. '
  'Rating 2 triggers PIP alert via hr_alert_on_rating_2 trigger.';


-- =============================================================================
-- SECTION 13: LEAVE MANAGEMENT
-- =============================================================================
CREATE TABLE IF NOT EXISTS hr_leave_requests (
  id               UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID            NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  leave_type       hr_leave_type   NOT NULL,
  status           hr_leave_status NOT NULL DEFAULT 'requested',

  -- Dates
  requested_date   DATE            NOT NULL DEFAULT CURRENT_DATE,
  start_date       DATE            NOT NULL,
  end_date         DATE            NOT NULL,
  working_days     INTEGER,        -- Populated at application layer

  -- Details
  reason           TEXT,
  supporting_doc_ref TEXT,         -- Reference to filed document in hr_personnel_documents

  -- Approval
  approved_by      UUID            REFERENCES users(user_id),
  approved_date    DATE,
  rejection_reason TEXT,

  created_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_leave_dates CHECK (end_date >= start_date)
);

COMMENT ON TABLE hr_leave_requests IS
  'Leave requests and approvals. Annual leave accrues at 2 days/month per '
  'Employment Code Act 2019. Sick leave: 26 days/year. '
  'working_days calculated at application layer (excludes weekends and public holidays).';

CREATE TABLE IF NOT EXISTS hr_leave_balances (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  leave_year            INTEGER     NOT NULL,

  -- Annual leave (2 days/month accrual per Employment Code Act 2019)
  annual_entitlement    NUMERIC(5,1) NOT NULL DEFAULT 0,
  annual_taken          NUMERIC(5,1) NOT NULL DEFAULT 0,
  annual_carried_over   NUMERIC(5,1) NOT NULL DEFAULT 0,
  annual_balance        NUMERIC(5,1) GENERATED ALWAYS AS (
                          annual_entitlement + annual_carried_over - annual_taken
                        ) STORED,

  -- Sick leave (26 days per full year of service)
  sick_entitlement      NUMERIC(5,1) NOT NULL DEFAULT 0,
  sick_taken            NUMERIC(5,1) NOT NULL DEFAULT 0,
  sick_balance          NUMERIC(5,1) GENERATED ALWAYS AS (sick_entitlement - sick_taken) STORED,

  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (user_id, leave_year)
);

COMMENT ON TABLE hr_leave_balances IS
  'Annual leave balance per user per calendar year. annual_entitlement is updated '
  'monthly by the application scheduler as each month of continuous service completes. '
  'Carry-over cap of 10 days enforced at application layer.';


-- =============================================================================
-- SECTION 14: PERSONNEL DOCUMENT REGISTRY
-- =============================================================================
CREATE TABLE IF NOT EXISTS hr_personnel_documents (
  id              UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID              NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  document_type   hr_document_type  NOT NULL,

  -- Document metadata
  document_title  VARCHAR(300)      NOT NULL,
  document_date   DATE,
  version         VARCHAR(10)       DEFAULT '1.0',

  -- External storage reference (files live in Vercel Blob/S3, NOT in the DB)
  storage_url     TEXT,
  storage_bucket  VARCHAR(100),
  filename        VARCHAR(300),
  file_size_bytes BIGINT,
  content_type    VARCHAR(100),

  -- Filing status
  is_filed        BOOLEAN           NOT NULL DEFAULT FALSE,
  filed_date      DATE,
  filed_by        UUID              REFERENCES users(user_id),

  -- Retention
  retain_until    DATE,             -- NULL = retain indefinitely

  notes           TEXT,

  -- Audit
  created_at      TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  created_by      UUID              REFERENCES users(user_id)
);

COMMENT ON TABLE hr_personnel_documents IS
  'Document registry for the personnel file. Metadata and storage references only — '
  'actual files stored in Vercel Blob or S3. '
  'Maps to D7/D8 Master Guide Section 7 personnel file checklist. '
  'is_filed = FALSE flags documents recorded but not yet formally filed.';


-- =============================================================================
-- SECTION 15: INDEXES
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_hr_employees_department
  ON hr_employees(department_id);
CREATE INDEX IF NOT EXISTS idx_hr_employees_status
  ON hr_employees(hr_status) WHERE hr_status != 'exited';
CREATE INDEX IF NOT EXISTS idx_hr_employees_manager
  ON hr_employees(reports_to_user_id);
CREATE INDEX IF NOT EXISTS idx_hr_employees_probation
  ON hr_employees(probation_end_date)
  WHERE hr_status IN ('onboarding','probation');

CREATE INDEX IF NOT EXISTS idx_hr_onboarding_user
  ON hr_onboarding_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_hr_onboarding_incomplete
  ON hr_onboarding_progress(user_id, status)
  WHERE status NOT IN ('completed','not_applicable');

CREATE INDEX IF NOT EXISTS idx_hr_competency_progress
  ON hr_competency_signoffs(progress_id);
CREATE INDEX IF NOT EXISTS idx_hr_competency_user
  ON hr_competency_signoffs(user_id);

CREATE INDEX IF NOT EXISTS idx_hr_sop_user
  ON hr_sop_training_records(user_id, sop_reference);
CREATE INDEX IF NOT EXISTS idx_hr_sop_current
  ON hr_sop_training_records(user_id, is_current)
  WHERE is_current = TRUE;

CREATE INDEX IF NOT EXISTS idx_hr_contracts_user
  ON hr_contracts(user_id, is_current);

CREATE INDEX IF NOT EXISTS idx_hr_reviews_user_type
  ON hr_reviews(user_id, review_type, review_date);
CREATE INDEX IF NOT EXISTS idx_hr_reviews_pending
  ON hr_reviews(outcome, review_date)
  WHERE outcome = 'pending';

CREATE INDEX IF NOT EXISTS idx_hr_pips_user
  ON hr_pips(user_id);
CREATE INDEX IF NOT EXISTS idx_hr_pips_active
  ON hr_pips(user_id, is_active)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_hr_ratings_user
  ON hr_performance_ratings(user_id, year, quarter);

CREATE INDEX IF NOT EXISTS idx_hr_leave_user
  ON hr_leave_requests(user_id, status);
CREATE INDEX IF NOT EXISTS idx_hr_leave_dates
  ON hr_leave_requests(start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_hr_balances_user
  ON hr_leave_balances(user_id, leave_year);

CREATE INDEX IF NOT EXISTS idx_hr_documents_user
  ON hr_personnel_documents(user_id, document_type);
CREATE INDEX IF NOT EXISTS idx_hr_documents_unfiled
  ON hr_personnel_documents(user_id, is_filed)
  WHERE is_filed = FALSE;


-- =============================================================================
-- SECTION 16: TIMESTAMP UPDATE TRIGGER
-- =============================================================================
CREATE OR REPLACE FUNCTION hr_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'hr_employees',
    'hr_departments',
    'hr_contracts',
    'hr_onboarding_progress',
    'hr_sop_training_records',
    'hr_reviews',
    'hr_pips',
    'hr_performance_ratings',
    'hr_leave_requests',
    'hr_leave_balances',
    'hr_personnel_documents'
  ] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_hr_updated_at ON %I;
       CREATE TRIGGER trg_hr_updated_at
         BEFORE UPDATE ON %I
         FOR EACH ROW EXECUTE FUNCTION hr_update_updated_at();',
      tbl, tbl
    );
  END LOOP;
  RAISE NOTICE 'Timestamp triggers applied to 11 HR tables.';
END $$;


-- =============================================================================
-- SECTION 17: EMPLOYMENT STATUS SYNC TRIGGER
-- =============================================================================
-- When a review outcome is finalised, sync hr_employees.hr_status
-- and optionally users.employment_status.

CREATE OR REPLACE FUNCTION hr_sync_status_on_review()
RETURNS TRIGGER AS $$
BEGIN
  -- Sync hr_employees based on review outcome
  CASE NEW.outcome
    WHEN 'confirmed' THEN
      UPDATE hr_employees SET
        hr_status         = 'confirmed',
        confirmation_date = NEW.review_date,
        updated_at        = NOW()
      WHERE user_id = NEW.user_id;

      -- Mirror to users table
      UPDATE users SET
        employment_status = 'confirmed',
        updated_at        = NOW()
      WHERE user_id = NEW.user_id;

    WHEN 'extended' THEN
      UPDATE hr_employees SET
        hr_status             = 'probation',
        probation_extended_to = NEW.review_date + INTERVAL '90 days',
        updated_at            = NOW()
      WHERE user_id = NEW.user_id;

    WHEN 'probation_failed' THEN
      UPDATE hr_employees SET
        hr_status    = 'exited',
        exit_date    = NEW.review_date,
        exit_reason  = 'Probation failed — see review ' || NEW.id::TEXT,
        updated_at   = NOW()
      WHERE user_id = NEW.user_id;

      UPDATE users SET
        is_active         = FALSE,
        employment_status = 'exited',
        updated_at        = NOW()
      WHERE user_id = NEW.user_id;

    ELSE
      NULL; -- pending / on_track / action_required etc. — no status change
  END CASE;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_hr_review_status_sync ON hr_reviews;
CREATE TRIGGER trg_hr_review_status_sync
  AFTER INSERT OR UPDATE OF outcome ON hr_reviews
  FOR EACH ROW
  WHEN (NEW.outcome != 'pending')
  EXECUTE FUNCTION hr_sync_status_on_review();


-- =============================================================================
-- SECTION 18: ONBOARDING COMPLETION TRIGGER
-- =============================================================================
CREATE OR REPLACE FUNCTION hr_check_onboarding_completion()
RETURNS TRIGGER AS $$
DECLARE
  incomplete_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO incomplete_count
  FROM hr_onboarding_progress
  WHERE user_id = NEW.user_id
    AND status NOT IN ('completed', 'not_applicable');

  IF incomplete_count = 0 THEN
    UPDATE hr_employees
    SET onboarding_complete = TRUE, updated_at = NOW()
    WHERE user_id = NEW.user_id
      AND onboarding_complete = FALSE;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_hr_onboarding_completion ON hr_onboarding_progress;
CREATE TRIGGER trg_hr_onboarding_completion
  AFTER INSERT OR UPDATE OF status ON hr_onboarding_progress
  FOR EACH ROW
  WHEN (NEW.status = 'completed')
  EXECUTE FUNCTION hr_check_onboarding_completion();


-- =============================================================================
-- SECTION 19: PIP ALERT TRIGGER
-- =============================================================================
-- Fires when a review is saved with a weighted score <= 2.0
-- Inserts into system_alerts using the existing VTL-ERP alert pattern.

CREATE OR REPLACE FUNCTION hr_alert_on_rating_2()
RETURNS TRIGGER AS $$
DECLARE
  emp_name TEXT;
BEGIN
  IF NEW.weighted_overall_score <= 2.0
    AND (OLD.weighted_overall_score IS NULL
         OR OLD.weighted_overall_score IS DISTINCT FROM NEW.weighted_overall_score)
  THEN
    SELECT full_name INTO emp_name
    FROM users WHERE user_id = NEW.user_id;

    INSERT INTO system_alerts (
      alert_type,
      severity,
      title,
      message,
      reference_table,
      reference_id
    ) VALUES (
      'hr_pip_required',
      'high',
      'PIP Required: ' || COALESCE(emp_name, 'Employee'),
      'Review scored ' || NEW.weighted_overall_score ||
        '/5. A Performance Improvement Plan must be issued within 5 working days. ' ||
        'Review ID: ' || NEW.id::TEXT,
      'hr_reviews',
      NEW.id
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_hr_pip_alert ON hr_reviews;
CREATE TRIGGER trg_hr_pip_alert
  AFTER UPDATE OF weighted_overall_score ON hr_reviews
  FOR EACH ROW EXECUTE FUNCTION hr_alert_on_rating_2();


-- =============================================================================
-- SECTION 20: PROBATION ALERT FUNCTION
-- =============================================================================
-- Call daily from application scheduler (wire into system-health.js).
-- Generates system_alerts for upcoming Day 30 and Day 90 reviews.

CREATE OR REPLACE FUNCTION hr_generate_probation_alerts()
RETURNS INTEGER AS $$
DECLARE
  rec             RECORD;
  alerts_created  INTEGER := 0;
  day30_due       DATE;
  day90_due       DATE;
BEGIN
  FOR rec IN
    SELECT
      e.user_id,
      u.full_name,
      u.employment_date,
      e.probation_end_date,
      e.probation_extended_to,
      e.hr_status,
      (SELECT COUNT(*) FROM hr_reviews r
       WHERE r.user_id = e.user_id AND r.review_type = 'day_30') AS has_day_30,
      (SELECT COUNT(*) FROM hr_reviews r
       WHERE r.user_id = e.user_id AND r.review_type = 'day_90') AS has_day_90
    FROM hr_employees e
    JOIN users u ON u.user_id = e.user_id
    WHERE u.is_active = TRUE
      AND e.hr_status IN ('onboarding', 'probation')
  LOOP
    day30_due := rec.employment_date + INTERVAL '28 days';
    day90_due := COALESCE(rec.probation_extended_to, rec.probation_end_date);

    -- Day 30 alert: fire when within 7 days of the due date and review not done
    IF rec.has_day_30 = 0
       AND CURRENT_DATE BETWEEN day30_due - 7 AND day30_due + 5
    THEN
      INSERT INTO system_alerts (
        alert_type, severity, title, message, reference_table, reference_id
      ) VALUES (
        'hr_probation_review_due',
        'medium',
        'Day 30 Review Due: ' || rec.full_name,
        'Day 30 mid-probation review due on or around ' ||
          to_char(day30_due, 'DD Mon YYYY') || '. Schedule with MD immediately.',
        'hr_employees',
        rec.user_id
      ) ON CONFLICT DO NOTHING;
      alerts_created := alerts_created + 1;
    END IF;

    -- Day 90 alert: fire when within 10 days of probation end and review not done
    IF rec.has_day_90 = 0
       AND CURRENT_DATE BETWEEN day90_due - 10 AND day90_due + 3
    THEN
      INSERT INTO system_alerts (
        alert_type, severity, title, message, reference_table, reference_id
      ) VALUES (
        'hr_probation_review_due',
        'high',
        'Day 90 FINAL Review Due: ' || rec.full_name,
        'Final probationary review must be completed by ' ||
          to_char(day90_due, 'DD Mon YYYY') ||
          '. Outcome: Confirm / Extend / Fail.',
        'hr_employees',
        rec.user_id
      ) ON CONFLICT DO NOTHING;
      alerts_created := alerts_created + 1;
    END IF;
  END LOOP;

  RETURN alerts_created;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION hr_generate_probation_alerts() IS
  'Call daily from system-health.js to generate system_alerts for upcoming probation reviews. '
  'Returns count of new alerts created.';


-- =============================================================================
-- SECTION 21: AUDIT LOG INTEGRATION
-- =============================================================================
-- Plugs into the existing VTL-ERP audit_log table.
-- Adjust column names below if your audit_log schema differs.

CREATE OR REPLACE FUNCTION hr_audit_trigger()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log (
    table_name,
    record_id,
    action,
    old_values,
    new_values,
    changed_by,
    changed_at
  ) VALUES (
    TG_TABLE_NAME,
    CASE TG_OP
      WHEN 'DELETE' THEN (OLD.user_id)::TEXT
      ELSE (NEW.user_id)::TEXT
    END,
    TG_OP,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
    CASE WHEN TG_OP = 'DELETE' THEN OLD.created_by ELSE NEW.created_by END,
    NOW()
  );
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'hr_employees',
    'hr_contracts',
    'hr_reviews',
    'hr_pips',
    'hr_performance_ratings'
  ] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_hr_audit ON %I;
       CREATE TRIGGER trg_hr_audit
         AFTER INSERT OR UPDATE OR DELETE ON %I
         FOR EACH ROW EXECUTE FUNCTION hr_audit_trigger();',
      tbl, tbl
    );
  END LOOP;
  RAISE NOTICE 'Audit triggers applied to 5 sensitive HR tables.';
END $$;


-- =============================================================================
-- SECTION 22: system_alerts COMPATIBILITY
-- =============================================================================
-- Add reference_table and reference_id columns if they don't already exist.
-- These are used by the PIP and probation alert functions above.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'system_alerts'
      AND column_name  = 'reference_table'
  ) THEN
    ALTER TABLE system_alerts
      ADD COLUMN reference_table VARCHAR(100),
      ADD COLUMN reference_id    UUID;
    RAISE NOTICE 'Added reference_table and reference_id columns to system_alerts.';
  ELSE
    RAISE NOTICE 'system_alerts reference columns already exist — skipping.';
  END IF;
END $$;


-- =============================================================================
-- SECTION 23: VIEWS
-- =============================================================================

-- ─── V1: HR Dashboard KPI Cards ─────────────────────────────────────────────
CREATE OR REPLACE VIEW v_hr_dashboard AS
SELECT
  COUNT(*)  FILTER (WHERE e.hr_status != 'exited')                    AS total_active,
  COUNT(*)  FILTER (WHERE e.hr_status = 'onboarding')                 AS onboarding,
  COUNT(*)  FILTER (WHERE e.hr_status = 'probation')                  AS on_probation,
  COUNT(*)  FILTER (WHERE e.hr_status = 'confirmed')                  AS confirmed,
  COUNT(*)  FILTER (WHERE e.hr_status = 'pip_active')                 AS on_pip,
  COUNT(*)  FILTER (WHERE e.onboarding_complete = FALSE
                      AND e.hr_status NOT IN ('exited','pre_start'))   AS incomplete_onboarding,
  COUNT(*)  FILTER (
    WHERE e.hr_status IN ('onboarding','probation')
      AND COALESCE(e.probation_extended_to, e.probation_end_date)
          BETWEEN CURRENT_DATE AND CURRENT_DATE + 14
  )                                                                    AS probation_due_14_days,
  COUNT(*)  FILTER (
    WHERE e.hr_status IN ('onboarding','probation')
      AND (u.employment_date + 28) BETWEEN CURRENT_DATE AND CURRENT_DATE + 7
  )                                                                    AS day_30_due_7_days
FROM hr_employees e
JOIN users u ON u.user_id = e.user_id;

COMMENT ON VIEW v_hr_dashboard IS
  'Single-row aggregate for HR dashboard KPI cards. Used by /app/hr/page.tsx.';


-- ─── V2: Employee Status Board ───────────────────────────────────────────────
CREATE OR REPLACE VIEW v_hr_employee_status AS
SELECT
  u.user_id,
  u.employee_number,
  u.full_name,
  u.job_title,
  u.email,
  u.badge_number,
  u.photo_url,
  u.is_active,
  d.name                                                   AS department,
  e.hr_status,
  u.employment_date                                        AS start_date,
  e.probation_end_date,
  e.probation_extended_to,
  COALESCE(e.probation_extended_to, e.probation_end_date) AS effective_probation_end,
  e.confirmation_date,
  e.onboarding_complete,
  e.contract_type,

  -- Days employed
  (CURRENT_DATE - u.employment_date)                       AS days_employed,

  -- Days until probation end (negative = overdue)
  (COALESCE(e.probation_extended_to, e.probation_end_date) - CURRENT_DATE)
                                                           AS days_to_probation_end,

  -- Onboarding completion percentage
  ROUND(
    100.0 * COUNT(op.user_id) FILTER (WHERE op.status IN ('completed','not_applicable'))
    / NULLIF(COUNT(op.user_id), 0), 0
  )                                                        AS onboarding_pct,

  -- Most recent review outcome
  (SELECT outcome FROM hr_reviews r
   WHERE r.user_id = u.user_id
   ORDER BY r.review_date DESC LIMIT 1)                   AS latest_review_outcome,

  -- Active PIP flag
  EXISTS (SELECT 1 FROM hr_pips p
          WHERE p.user_id = u.user_id AND p.is_active = TRUE)
                                                           AS has_active_pip,

  -- Line manager name
  mgr.full_name                                            AS reports_to_name
FROM hr_employees e
JOIN users u  ON u.user_id  = e.user_id
LEFT JOIN hr_departments d   ON d.id      = e.department_id
LEFT JOIN users mgr           ON mgr.user_id = e.reports_to_user_id
LEFT JOIN hr_onboarding_progress op ON op.user_id = e.user_id
WHERE e.hr_status != 'exited'
GROUP BY
  u.user_id, u.employee_number, u.full_name, u.job_title, u.email,
  u.badge_number, u.photo_url, u.is_active, d.name, e.hr_status,
  u.employment_date, e.probation_end_date, e.probation_extended_to,
  e.confirmation_date, e.onboarding_complete, e.contract_type, mgr.full_name;

COMMENT ON VIEW v_hr_employee_status IS
  'Per-employee status board with onboarding %, probation countdown, and PIP flag. '
  'Joins users + hr_employees + departments. Used by /app/hr/employees/page.tsx.';


-- ─── V3: Onboarding Tracker ─────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_hr_onboarding_tracker AS
SELECT
  u.user_id,
  u.employee_number,
  u.full_name,
  u.job_title,
  d.name                                                          AS department,
  u.employment_date                                               AS start_date,
  op.module,
  op.status,
  op.scheduled_date,
  op.started_date,
  op.completed_date,
  op.trainer_signed_date,
  op.trainee_signed_date,
  op.assessment_score,
  op.assessment_passed,
  op.retest_required,

  -- Days in progress (to surface overdue modules)
  CASE WHEN op.started_date IS NOT NULL AND op.status = 'in_progress'
       THEN (CURRENT_DATE - op.started_date)
       ELSE NULL END                                              AS days_in_progress,

  -- Overdue flag: in progress for more than 14 days
  CASE WHEN op.started_date IS NOT NULL
            AND op.status = 'in_progress'
            AND (CURRENT_DATE - op.started_date) > 14
       THEN TRUE ELSE FALSE END                                  AS is_overdue
FROM hr_employees e
JOIN users u  ON u.user_id  = e.user_id
LEFT JOIN hr_departments d   ON d.id      = e.department_id
LEFT JOIN hr_onboarding_progress op ON op.user_id = e.user_id
WHERE u.is_active = TRUE
ORDER BY u.employment_date, u.full_name, op.module;

COMMENT ON VIEW v_hr_onboarding_tracker IS
  'Module-level onboarding progress for all active employees. '
  'Used by /app/hr/onboarding/page.tsx and the MD Onboarding Master Tracker (D3).';


-- ─── V4: SOP Training Compliance ────────────────────────────────────────────
CREATE OR REPLACE VIEW v_hr_sop_compliance AS
SELECT
  u.user_id,
  u.full_name,
  u.job_title,
  d.name                  AS department,
  st.sop_reference,
  st.sop_title,
  st.sop_version,
  st.trained_date,
  st.employee_signed,
  st.signed_date,
  st.valid_until,
  st.is_current,
  CASE
    WHEN st.valid_until IS NULL                                    THEN 'no_expiry'
    WHEN st.valid_until < CURRENT_DATE                             THEN 'expired'
    WHEN st.valid_until BETWEEN CURRENT_DATE AND CURRENT_DATE + 30 THEN 'expiring_soon'
    ELSE 'current'
  END                     AS expiry_status
FROM hr_employees e
JOIN users u  ON u.user_id  = e.user_id
LEFT JOIN hr_departments d   ON d.id      = e.department_id
LEFT JOIN hr_sop_training_records st ON st.user_id = e.user_id AND st.is_current = TRUE
WHERE u.is_active = TRUE
ORDER BY u.full_name, st.sop_reference;

COMMENT ON VIEW v_hr_sop_compliance IS
  'SOP training status per employee. Shows current records only. '
  'expiry_status flags records needing renewal. '
  'Used by HR module and surfaced in QMS compliance reporting.';


-- ─── V5: Probation Review Schedule ──────────────────────────────────────────
CREATE OR REPLACE VIEW v_hr_probation_schedule AS
SELECT
  u.user_id,
  u.employee_number,
  u.full_name,
  u.job_title,
  d.name                                                           AS department,
  u.employment_date                                                AS start_date,
  (u.employment_date + 28)                                         AS day_30_due,
  COALESCE(e.probation_extended_to, e.probation_end_date)         AS day_90_due,
  e.hr_status,

  -- Day 30 review status
  d30.outcome                                                      AS day_30_outcome,
  d30.review_date                                                  AS day_30_completed,
  (d30.id IS NULL AND CURRENT_DATE >= (u.employment_date + 23))   AS day_30_overdue,

  -- Day 90 review status
  d90.outcome                                                      AS day_90_outcome,
  d90.review_date                                                  AS day_90_completed,
  (d90.id IS NULL AND CURRENT_DATE >=
    COALESCE(e.probation_extended_to, e.probation_end_date))       AS day_90_overdue,

  e.confirmation_date
FROM hr_employees e
JOIN users u  ON u.user_id  = e.user_id
LEFT JOIN hr_departments d   ON d.id = e.department_id
LEFT JOIN hr_reviews d30     ON d30.user_id = u.user_id AND d30.review_type = 'day_30'
LEFT JOIN hr_reviews d90     ON d90.user_id = u.user_id AND d90.review_type = 'day_90'
WHERE e.hr_status IN ('onboarding','probation','confirmed')
  AND u.is_active = TRUE
ORDER BY u.employment_date;

COMMENT ON VIEW v_hr_probation_schedule IS
  'Probation review schedule with overdue flags. '
  'Used by /app/hr/reviews/page.tsx and the MD daily briefing rhythm.';


-- ─── V6: Quarterly Ratings Register ─────────────────────────────────────────
CREATE OR REPLACE VIEW v_hr_quarterly_ratings AS
SELECT
  pr.year,
  pr.quarter,
  u.user_id,
  u.employee_number,
  u.full_name,
  u.job_title,
  d.name                  AS department,
  pr.overall_rating,
  pr.overall_score,
  pr.bonus_eligible,
  pr.action_required,
  pr.action_type,
  pr.md_notes,
  pr.created_at           AS rated_at,
  EXISTS (
    SELECT 1 FROM hr_pips p
    WHERE p.user_id = u.user_id
      AND p.issued_date BETWEEN
          make_date(pr.year, (pr.quarter - 1) * 3 + 1, 1)
          AND make_date(pr.year, pr.quarter * 3, 1) + 90
  )                       AS pip_issued_this_quarter
FROM hr_performance_ratings pr
JOIN hr_employees e  ON e.user_id = pr.user_id
JOIN users u         ON u.user_id = pr.user_id
LEFT JOIN hr_departments d ON d.id = e.department_id
ORDER BY pr.year DESC, pr.quarter DESC, u.full_name;

COMMENT ON VIEW v_hr_quarterly_ratings IS
  'The MD Quarterly Business Output Review register (D2 Section 9). '
  'Shows ratings for all staff per quarter with PIP flag. '
  'Used by /app/hr/performance/page.tsx.';


-- ─── V7: Compliance Snapshot (MD Monthly Checklist) ─────────────────────────
CREATE OR REPLACE VIEW v_hr_compliance_snapshot AS
SELECT
  -- Headcount
  (SELECT COUNT(*) FROM hr_employees e
   JOIN users u ON u.user_id = e.user_id
   WHERE u.is_active = TRUE)                                           AS total_active,

  -- Missing signed contracts
  (SELECT COUNT(DISTINCT e.user_id) FROM hr_employees e
   JOIN users u ON u.user_id = e.user_id
   WHERE u.is_active = TRUE
     AND NOT EXISTS (
       SELECT 1 FROM hr_personnel_documents d
       WHERE d.user_id = e.user_id
         AND d.document_type = 'employment_contract'
         AND d.is_filed = TRUE
     ))                                                                AS missing_contracts,

  -- Missing Schedule 3 (document receipt acknowledgement)
  (SELECT COUNT(DISTINCT e.user_id) FROM hr_employees e
   JOIN users u ON u.user_id = e.user_id
   WHERE u.is_active = TRUE
     AND NOT EXISTS (
       SELECT 1 FROM hr_personnel_documents d
       WHERE d.user_id = e.user_id
         AND d.document_type = 'schedule_3_receipt'
         AND d.is_filed = TRUE
     ))                                                                AS missing_schedule_3,

  -- Overdue probation reviews
  (SELECT COUNT(*) FROM v_hr_probation_schedule WHERE day_30_overdue = TRUE)
                                                                       AS overdue_day_30,
  (SELECT COUNT(*) FROM v_hr_probation_schedule WHERE day_90_overdue = TRUE)
                                                                       AS overdue_day_90,

  -- Active PIPs
  (SELECT COUNT(*) FROM hr_pips WHERE is_active = TRUE)               AS active_pips,

  -- Incomplete onboarding
  (SELECT COUNT(*) FROM hr_employees e
   JOIN users u ON u.user_id = e.user_id
   WHERE u.is_active = TRUE
     AND e.onboarding_complete = FALSE
     AND e.hr_status NOT IN ('pre_start','exited'))                   AS incomplete_onboarding,

  -- Expired SOP training records
  (SELECT COUNT(*) FROM v_hr_sop_compliance WHERE expiry_status = 'expired')
                                                                       AS expired_sop_training,
  (SELECT COUNT(*) FROM v_hr_sop_compliance WHERE expiry_status = 'expiring_soon')
                                                                       AS expiring_sop_30_days,

  CURRENT_DATE                                                         AS snapshot_date;

COMMENT ON VIEW v_hr_compliance_snapshot IS
  'Single-row compliance health summary for the MD Monthly Verification Checklist (D2 Section 11). '
  'All non-zero values require immediate MD attention.';


-- =============================================================================
-- SECTION 24: DEPARTMENT HEAD FK (deferred — hr_employees must exist first)
-- =============================================================================
ALTER TABLE hr_departments
  ADD CONSTRAINT IF NOT EXISTS fk_hr_dept_head
  FOREIGN KEY (head_user_id) REFERENCES users(user_id) ON DELETE SET NULL;


-- =============================================================================
-- SECTION 25: VERIFICATION QUERIES
-- =============================================================================

-- 25.1 Table count — expect 12
SELECT COUNT(*) AS hr_tables_created,
       string_agg(table_name ORDER BY table_name, ', ') AS table_names
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE 'hr_%';

-- 25.2 View count — expect 7
SELECT COUNT(*) AS hr_views_created,
       string_agg(table_name ORDER BY table_name, ', ') AS view_names
FROM information_schema.views
WHERE table_schema = 'public' AND table_name LIKE 'v_hr_%';

-- 25.3 Enum types — expect 10
SELECT typname AS enum_name,
       string_agg(enumlabel ORDER BY enumsortorder, ' | ') AS values
FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid
WHERE typname LIKE 'hr_%'
GROUP BY typname ORDER BY typname;

-- 25.4 Departments seeded — expect FIN, OPS, QA, SALES
SELECT code, name FROM hr_departments ORDER BY code;

-- 25.5 RBAC roles — expect hr_admin and hr_manager in the constraint
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'users_role_check';

-- 25.6 Dashboard view — should return one row of zeros (no employees yet)
SELECT * FROM v_hr_dashboard;

-- 25.7 Compliance snapshot — should return one row
SELECT * FROM v_hr_compliance_snapshot;

-- 25.8 Trigger count — expect 16+
SELECT COUNT(*) AS hr_triggers
FROM information_schema.triggers
WHERE trigger_name LIKE 'trg_hr_%';

-- 25.9 Full table list (all tables, to see the complete picture)
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' ORDER BY table_name;

-- 25.10 Confirm hr_employees PK and FK
SELECT
  kcu.column_name,
  tc.constraint_type,
  ccu.table_name  AS references_table,
  ccu.column_name AS references_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.table_name   = 'hr_employees'
ORDER BY tc.constraint_type, kcu.column_name;
-- Expect: user_id as PK, user_id FK → users.user_id,
--         department_id FK → hr_departments.id,
--         reports_to_user_id FK → users.user_id


-- =============================================================================
-- INSTALLATION COMPLETE
-- =============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '================================================================';
  RAISE NOTICE ' VTL HR MODULE SCHEMA v1.1 — INSTALLED';
  RAISE NOTICE '================================================================';
  RAISE NOTICE ' Tables:    12 hr_ tables';
  RAISE NOTICE ' Views:      7 v_hr_ views';
  RAISE NOTICE ' ENUMs:     10 hr_ types';
  RAISE NOTICE ' Functions:  7 (triggers, alerts, probation scheduler)';
  RAISE NOTICE ' Triggers:  16+ (timestamps, status sync, audit, alerts)';
  RAISE NOTICE ' Seed data:  4 departments (FIN, OPS, QA, SALES)';
  RAISE NOTICE '';
  RAISE NOTICE ' KEY DESIGN: hr_employees is a lean extension of users.';
  RAISE NOTICE ' Full employee profile query:';
  RAISE NOTICE '   SELECT u.*, e.* FROM users u JOIN hr_employees e USING (user_id)';
  RAISE NOTICE '';
  RAISE NOTICE ' NEXT STEPS:';
  RAISE NOTICE '  1. Run Section 25 verification queries — confirm all pass';
  RAISE NOTICE '  2. Check audit_log column names match hr_audit_trigger()';
  RAISE NOTICE '  3. Wire hr_generate_probation_alerts() into system-health.js';
  RAISE NOTICE '  4. Build backend: hr-routes.js + hr-service.js';
  RAISE NOTICE '  5. Build frontend: /app/hr/ pages';
  RAISE NOTICE '================================================================';
END $$;
