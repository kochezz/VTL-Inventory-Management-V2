# 🎯 SOLUTION: Update Existing Stage Code

## The Situation

✅ **Stage already exists!** Line 12 in your CSV:
- stage_id: `8ef012bd-fba8-4537-9a98-482ff9df4edd`
- stage_name: "Returned Bottle Inspection"  
- stage_code: `BOTTLE_INSPECTION` ← Currently this
- stage_sequence: 2

❌ **Frontend expects:** `RETURNED_BOTTLE_INSPECTION`

---

## Solution: Update the Stage Code

```sql
-- Update the existing stage code to match frontend
UPDATE ipqc_stage_definitions
SET stage_code = 'RETURNED_BOTTLE_INSPECTION'
WHERE stage_id = '8ef012bd-fba8-4537-9a98-482ff9df4edd';

-- Verify the change
SELECT stage_id, stage_sequence, stage_name, stage_code
FROM ipqc_stage_definitions
WHERE stage_id = '8ef012bd-fba8-4537-9a98-482ff9df4edd';
```

**Should show:**
```
stage_code: RETURNED_BOTTLE_INSPECTION ✅
```

---

## After This Change

1. **Restart frontend** (Ctrl+C, then `npm run dev`)
2. **Go to 5 Gal Re-Fill batch**
3. **Click "Record IPQC" for Stage 2**
4. **Should now show:** "Returned Bottle Inspection (Re-Fill)" form with all checkboxes! ✅

---

## Alternative: Update Frontend Instead

If you prefer to keep the database as-is, update the frontend:

**File:** `MultiStageIPQCModal.tsx`

**Change everywhere you see:**
```typescript
'RETURNED_BOTTLE_INSPECTION'
```

**To:**
```typescript
'BOTTLE_INSPECTION'
```

---

## Recommended: Update Database

The database approach is cleaner because `RETURNED_BOTTLE_INSPECTION` is more descriptive than just `BOTTLE_INSPECTION`.

**Run the UPDATE SQL above and test!** 🚀
