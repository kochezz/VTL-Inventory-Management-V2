// Shared formatting for the compliance module's flexible-cadence fields.
//
// recurrence_type (the pre-flexible-cadence ONE_OFF_EXPIRY/MONTHLY_RECURRING/
// ANNUAL_RECURRING enum) is deprecated and NULL for every category created
// since the flexible-cadence migration -- createComplianceCategory in
// compliance-service.js never sets it. Any frontend code that reads it
// directly (e.g. category.recurrence_type.replace(...)) crashes the moment
// it hits a post-migration row. cadence_type + interval_months are the only
// source of truth going forward; this is the one place that turns them into
// a display string, so nothing else needs to touch recurrence_type again.
export function formatCadence(
  cadenceType: 'ONE_OFF' | 'RECURRING' | null | undefined,
  intervalMonths: number | null | undefined
): string {
  if (cadenceType === 'ONE_OFF') return 'One-off / Expiry';
  if (cadenceType === 'RECURRING') {
    if (intervalMonths === 1) return 'Every month';
    if (intervalMonths != null) return `Every ${intervalMonths} months`;
    return 'Recurring (interval not set)';
  }
  return 'Cadence not set';
}
