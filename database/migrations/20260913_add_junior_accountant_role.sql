-- ============================================================================
-- Migration: add_junior_accountant_role
-- Date:      2026-09-13
-- ============================================================================
-- WHAT THIS DOES
-- Adds 'junior_accountant' to the live users_role_check CHECK constraint
-- (18 values total; database/schema.sql's CHECK clause is known-stale and
-- was not used as the source of truth -- the live pg_constraint definition
-- was pulled directly and confirmed via Phase 0 of the Compliance Module
-- audit before this migration was written).
--
-- Migrates Jeremiah Kalasa Mulilo (user_id ee313df8-fd84-4de4-a551-
-- ad58ab58eec3) from role 'cfo' to role 'junior_accountant'. His
-- job_title was already 'Junior Accountant' pre-migration -- only role
-- changes here, job_title is untouched.
--
-- PRE-FLIGHT (performed before this migration ran, not repeated by it)
-- Confirmed zero purchase_orders rows in status 'PENDING_CFO' and zero
-- rows anywhere else (vendors, customers, qms_document_versions,
-- purchase_orders.raised_by, work_orders) referencing Jeremiah's user_id
-- in an open/pending state. A second CFO (Priscilla Makombe Mwanza,
-- c5d9a073-2486-42d2-bf2b-867f287ca0bb) was assigned and cleared the 3
-- purchase orders that were PENDING_CFO at the start of this session
-- before this migration ran, so the 'cfo' role is not left without an
-- active holder.
--
-- DROP + ADD CONSTRAINT, NOT A FRESH CREATE
-- The existing users_role_check constraint (17 values) is ground truth
-- per Phase 0; this ALTERs it in place rather than assuming any other
-- definition.
-- ============================================================================

BEGIN;

ALTER TABLE users DROP CONSTRAINT users_role_check;

ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (
  (role)::text = ANY (ARRAY[
    'engineering','hr_manager','admin','operator','viewer','staff','qa',
    'production_manager','warehouse_staff','cfo','ceo','super_viewer',
    'manager','hr_admin','sales','warehouse_manager','engineering_manager',
    'junior_accountant'
  ]::character varying[])
);

UPDATE users
SET role = 'junior_accountant'
WHERE user_id = 'ee313df8-fd84-4de4-a551-ad58ab58eec3';

COMMIT;

-- ============================================================================
-- ROLLBACK (manual, not automatic -- run only if this needs to be undone)
-- ============================================================================
-- BEGIN;
-- UPDATE users SET role = 'cfo' WHERE user_id = 'ee313df8-fd84-4de4-a551-ad58ab58eec3';
-- ALTER TABLE users DROP CONSTRAINT users_role_check;
-- ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (
--   (role)::text = ANY (ARRAY[
--     'engineering','hr_manager','admin','operator','viewer','staff','qa',
--     'production_manager','warehouse_staff','cfo','ceo','super_viewer',
--     'manager','hr_admin','sales','warehouse_manager','engineering_manager'
--   ]::character varying[])
-- );
-- COMMIT;
