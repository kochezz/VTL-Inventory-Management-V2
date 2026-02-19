# 🔧 EXACT FIX - Add stage_code to INSERT Statement

## The Bug

**File:** `backend/src/services/production-service.js`  
**Function:** `recordMultiStageIPQC` (line 1759)  
**Line:** 1788-1860

The INSERT statement is **missing `stage_code`** in the column list!

---

## ✅ The Fix

### Find This (lines 1788-1797):

```sql
const insertQuery = `
  INSERT INTO batch_ipqc_records (
    batch_id,
    check_sequence,
    check_time,
    stage_id,
    stage_sequence,
    stage_name,
    stage_category,
```

### Replace With (ADD stage_code):

```sql
const insertQuery = `
  INSERT INTO batch_ipqc_records (
    batch_id,
    check_sequence,
    check_time,
    stage_id,
    stage_sequence,
    stage_name,
    stage_code,        -- ← ADD THIS LINE
    stage_category,
```

---

### Then Find the VALUES section (lines 1863-1870):

```javascript
const values = [
  batchId,                                    // $1
  checkSequence,                              // $2
  ipqcData.check_time || new Date(),         // $3
  ipqcData.stage_id,                          // $4
  ipqcData.stage_sequence,                    // $5
  ipqcData.stage_name,                        // $6
  ipqcData.stage_category,                    // $7
```

### Replace With (ADD stage_code parameter):

```javascript
const values = [
  batchId,                                    // $1
  checkSequence,                              // $2
  ipqcData.check_time || new Date(),         // $3
  ipqcData.stage_id,                          // $4
  ipqcData.stage_sequence,                    // $5
  ipqcData.stage_name,                        // $6
  ipqcData.stage_code,                        // $7 ← ADD THIS LINE
  ipqcData.stage_category,                    // $8 ← NOW $8 instead of $7
```

---

### Update Parameter Numbers in VALUES

**CRITICAL:** After adding stage_code as $7, all subsequent parameters shift by 1!

**Current (lines 1848-1859):**
```sql
) VALUES (
  $1, $2, $3, $4, $5, $6, $7,           -- batch_id through stage_category
  $8, $9, $10, $11, $12, $13, $14, $15, $16,    -- water treatment (currently $8-$16)
  $17, $18, $19, $20, $21,                       -- filling
  $22, $23,                                      -- capping
  $24, $25, $26, $27, $28, $29, $30, $31, $32,  -- inspection
  $33, $34,                                      -- equipment
  $35,                                           -- all_checks_passed
  $36, $37, $38,                                 -- operator
  $39,                                           -- qa_status
  $40                                            -- custom_data
)
```

**New (ADD $7 for stage_code, shift everything after):**
```sql
) VALUES (
  $1, $2, $3, $4, $5, $6, $7, $8,       -- batch_id through stage_category (added $7)
  $9, $10, $11, $12, $13, $14, $15, $16, $17,    -- water treatment (now $9-$17)
  $18, $19, $20, $21, $22,                       -- filling (now $18-$22)
  $23, $24,                                      -- capping (now $23-$24)
  $25, $26, $27, $28, $29, $30, $31, $32, $33,  -- inspection (now $25-$33)
  $34, $35,                                      -- equipment (now $34-$35)
  $36,                                           -- all_checks_passed (now $36)
  $37, $38, $39,                                 -- operator (now $37-$39)
  $40,                                           -- qa_status (now $40)
  $41                                            -- custom_data (now $41)
)
```

---

### Update the values array accordingly

**Current (lines 1872-1882):**
```javascript
// Water treatment
ipqcData.water_source || null,             // $8
ipqcData.raw_water_ph || null,             // $9
ipqcData.raw_water_conductivity || null,   // $10
```

**New (shift by 1):**
```javascript
// Water treatment
ipqcData.water_source || null,             // $9  ← was $8
ipqcData.raw_water_ph || null,             // $10 ← was $9
ipqcData.raw_water_conductivity || null,   // $11 ← was $10
```

**Continue this pattern for ALL subsequent values** (lines 1872-1920)

---

## 🚀 Quick Fix Summary

**3 Changes Needed:**

1. **Line 1796:** Add `stage_code,` after `stage_name,`

2. **Line 1869:** Add `ipqcData.stage_code,` after `ipqcData.stage_name,` and BEFORE `ipqcData.stage_category,`

3. **Lines 1848-1859:** Update all `$X` parameter numbers to shift by +1 after $7

---

## ✅ After Fix

### Test by recording a BOTTLE_BLOW check

Then check database:
```sql
SELECT 
  ipqc_id,
  stage_name,
  stage_code,
  bottle_integrity,
  visual_inspection_pass
FROM batch_ipqc_records
ORDER BY created_at DESC
LIMIT 1;
```

**Expected:**
```
stage_name: "Preform Blowing & Bottle Inspection"
stage_code: "BOTTLE_BLOW"           ← NOW HAS VALUE!
bottle_integrity: "OK"              ← NOW HAS VALUE!
visual_inspection_pass: true        ← NOW HAS VALUE!
```

---

## 📊 Why This Fixes Everything

### Before Fix:
```
stage_code: NULL  → QA modal can't find BOTTLE_BLOW section → Shows only notes
```

### After Fix:
```
stage_code: "BOTTLE_BLOW"  → QA modal finds section → Shows all inspection fields!
```

---

**This is THE fix - add stage_code to the INSERT and shift parameter numbers!** 🎯
