# 🔧 EXACT FIX - VALUES Placeholders Mismatch

## The Problem

You have **8 columns** in your INSERT but only **7 placeholders** on line 1850!

### Column Count (Lines 1789-1848): 8 columns before water treatment

```sql
INSERT INTO batch_ipqc_records (
  batch_id,           -- 1
  check_sequence,     -- 2
  check_time,         -- 3
  stage_id,           -- 4
  stage_sequence,     -- 5
  stage_name,         -- 6
  stage_code,         -- 7  ← YOU ADDED THIS
  stage_category,     -- 8  ← THIS SHIFTED TO 8th
  
  -- Water treatment fields start here...
```

### VALUES Placeholders (Lines 1849-1860): Only 7 placeholders!

```sql
) VALUES (
  $1, $2, $3, $4, $5, $6, $7,  ← ONLY 7 PLACEHOLDERS! MISSING $8!
  $8, $9, $10, ...              ← Water treatment incorrectly starts at $8
```

**This causes a parameter mismatch!**

---

## ✅ THE FIX

### Find Line 1850:

**CURRENT (WRONG):**
```sql
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
```

**CHANGE TO:**
```sql
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
```

**Just add `, $8` at the end of line 1850!**

---

### Then Update ALL Following Lines (1851-1859):

**CURRENT (WRONG):**
```sql
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,               ← Missing $8
        $8, $9, $10, $11, $12, $13, $14, $15, $16,    ← Line 1851
        $17, $18, $19, $20, $21,                      ← Line 1852
        $22, $23,                                     ← Line 1853
        $24, $25, $26, $27, $28, $29, $30, $31, $32,  ← Line 1854
        $33, $34,                                     ← Line 1855
        $35,                                          ← Line 1856
        $36, $37, $38,                                ← Line 1857
        $39,                                          ← Line 1858
        $40                                           ← Line 1859
      )
```

**REPLACE WITH (CORRECT):**
```sql
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,              ← Added $8
        $9, $10, $11, $12, $13, $14, $15, $16, $17,      ← Line 1851 - ALL SHIFTED +1
        $18, $19, $20, $21, $22,                         ← Line 1852
        $23, $24,                                        ← Line 1853
        $25, $26, $27, $28, $29, $30, $31, $32, $33,     ← Line 1854
        $34, $35,                                        ← Line 1855
        $36,                                             ← Line 1856
        $37, $38, $39,                                   ← Line 1857
        $40,                                             ← Line 1858
        $41                                              ← Line 1859 - Changed from $40 to $41
      )
```

---

## 📊 Line-by-Line Changes

**Line 1850:** Add `, $8` at the end
```diff
-       $1, $2, $3, $4, $5, $6, $7,
+       $1, $2, $3, $4, $5, $6, $7, $8,
```

**Line 1851:** Change to $9-$17 (was $8-$16)
```diff
-       $8, $9, $10, $11, $12, $13, $14, $15, $16,
+       $9, $10, $11, $12, $13, $14, $15, $16, $17,
```

**Line 1852:** Change to $18-$22 (was $17-$21)
```diff
-       $17, $18, $19, $20, $21,
+       $18, $19, $20, $21, $22,
```

**Line 1853:** Change to $23-$24 (was $22-$23)
```diff
-       $22, $23,
+       $23, $24,
```

**Line 1854:** Change to $25-$33 (was $24-$32)
```diff
-       $24, $25, $26, $27, $28, $29, $30, $31, $32,
+       $25, $26, $27, $28, $29, $30, $31, $32, $33,
```

**Line 1855:** Change to $34-$35 (was $33-$34)
```diff
-       $33, $34,
+       $34, $35,
```

**Line 1856:** Change to $36 (was $35)
```diff
-       $35,
+       $36,
```

**Line 1857:** Change to $37-$39 (was $36-$38)
```diff
-       $36, $37, $38,
+       $37, $38, $39,
```

**Line 1858:** Change to $40 (was $39)
```diff
-       $39,
+       $40,
```

**Line 1859:** Change to $41 (was $40)
```diff
-       $40
+       $41
```

---

## 🎯 Why This Matters

### With Current Wrong Code:
- Column 7 is `stage_code` → but gets value from parameter $7 which is `ipqcData.stage_category` ❌
- Column 8 is `stage_category` → but gets value from parameter $8 which is `ipqcData.water_source` ❌
- Everything after is WRONG!

### After Fix:
- Column 7 is `stage_code` → gets value from parameter $7 which is `ipqcData.stage_code` ✅
- Column 8 is `stage_category` → gets value from parameter $8 which is `ipqcData.stage_category` ✅
- Everything lines up correctly! ✅

---

## ✅ Quick Copy-Paste Fix

**Replace lines 1849-1860 with:**

```sql
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14, $15, $16, $17,
        $18, $19, $20, $21, $22,
        $23, $24,
        $25, $26, $27, $28, $29, $30, $31, $32, $33,
        $34, $35,
        $36,
        $37, $38, $39,
        $40,
        $41
      )
      RETURNING *
    `;
```

---

## 🧪 After Fix - Test

1. **Restart backend:**
   ```bash
   cd backend
   pkill node
   npm run dev
   ```

2. **Record a BOTTLE_BLOW check**

3. **Check database:**
   ```sql
   SELECT stage_code, bottle_integrity 
   FROM batch_ipqc_records 
   ORDER BY created_at DESC 
   LIMIT 1;
   ```

4. **Should return:**
   ```
   stage_code: BOTTLE_BLOW       ← NOT NULL!
   bottle_integrity: OK          ← NOT NULL!
   ```

---

**Replace those VALUES lines and it will work!** 🚀
