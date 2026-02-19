# BACKEND UPDATE: Include Stage Info in IPQC Review

## Problem

The QA review endpoint doesn't return stage information, so the frontend can't tell which fields to show.

## Solution

Update the `getIPQCForReview` function in `production-service.js` to include stage fields.

---

## Find This Function (around line 1220-1260)

Look for:
```javascript
async function getIPQCForReview(ipqcId) {
```

## Update the SQL Query

**Find this query:**
```javascript
const query = `
  SELECT 
    ipqc.ipqc_id,
    ipqc.batch_id,
    batch.batch_number,
    batch.product_name,
    ipqc.check_sequence,
    ipqc.check_time,
    ipqc.fill_volume_ml,
    ipqc.cap_torque_nm,
    ... etc
  FROM batch_ipqc_records ipqc
  INNER JOIN production_batches batch ON ipqc.batch_id = batch.batch_id
  WHERE ipqc.ipqc_id = $1
`;
```

**Replace with this (ADD stage fields):**
```javascript
const query = `
  SELECT 
    ipqc.ipqc_id,
    ipqc.batch_id,
    batch.batch_number,
    batch.product_name,
    ipqc.check_sequence,
    ipqc.check_time,
    
    -- ADD THESE STAGE FIELDS
    ipqc.stage_id,
    ipqc.stage_sequence,
    ipqc.stage_name,
    ipqc.stage_code,
    ipqc.stage_category,
    
    -- Water treatment fields
    ipqc.water_source,
    ipqc.raw_water_ph,
    ipqc.raw_water_conductivity,
    ipqc.ro_conductivity,
    ipqc.uv_system_status,
    ipqc.ozone_system_status,
    ipqc.ozone_residual_ppm,
    ipqc.water_treatment_approved,
    ipqc.water_treatment_notes,
    ipqc.line_clearance_verified,
    ipqc.equipment_cleaned,
    
    -- Filling fields
    ipqc.fill_volume_ml,
    ipqc.fill_volume_within_spec,
    ipqc.fill_temperature,
    ipqc.fill_pressure,
    ipqc.rinsing_pressure,
    
    -- Capping fields
    ipqc.cap_torque_nm,
    ipqc.cap_torque_within_spec,
    
    -- Visual inspection fields
    ipqc.visual_inspection_pass,
    ipqc.visual_inspection_notes,
    ipqc.label_position_correct,
    ipqc.label_position_notes,
    ipqc.bottle_integrity,
    ipqc.seal_integrity,
    
    -- Coding fields
    ipqc.coding_legible,
    ipqc.coding_notes,
    ipqc.tamper_evidence,
    
    -- Common fields
    ipqc.all_checks_passed,
    ipqc.operator_name,
    ipqc.notes,
    ipqc.created_at,
    ipqc.qa_status,
    ipqc.qa_reviewed_by,
    ipqc.qa_reviewed_at,
    ipqc.qa_rejection_reason
  FROM batch_ipqc_records ipqc
  INNER JOIN production_batches batch ON ipqc.batch_id = batch.batch_id
  WHERE ipqc.ipqc_id = $1
`;
```

---

## Quick Find & Replace

In your `production-service.js`:

**Search for:**
```
async function getIPQCForReview(ipqcId)
```

**Then find the SELECT statement and add these 5 lines after `ipqc.check_time,`:**
```sql
    ipqc.stage_id,
    ipqc.stage_sequence,
    ipqc.stage_name,
    ipqc.stage_code,
    ipqc.stage_category,
```

**And add all the water treatment fields if they're not already there.**

---

## Test After Update

```bash
curl http://localhost:3001/api/production/ipqc/IPQC_ID/review \
  -H "Authorization: Bearer TOKEN" \
  | jq '.ipqc_check | {stage_name, stage_code, raw_water_ph}'
```

**Expected:**
```json
{
  "stage_name": "Pre-Production Verification",
  "stage_code": "PRE_PRODUCTION",
  "raw_water_ph": 7.2
}
```

---

## Then Replace Frontend

After backend is updated:

```bash
cp IPQCReviewModal_Updated.tsx frontend/components/production/IPQCReviewModal.tsx
```

Restart both backend and frontend.

---

## What You'll See

**Before:** QA review shows ALL fields (fill volume, cap torque, etc.) even for water treatment check

**After:** QA review shows ONLY water treatment fields for Stage 1 check:
- Water Source
- pH
- Conductivity
- RO Conductivity
- UV System
- Ozone System
- Ozone Residual
- Line Clearance
- Equipment Cleaned
- Treatment Notes

**Much cleaner and less confusing!** ✅
