# 🔧 COMPLETE PATCH: Add Returned Bottle Inspection to MultiStageIPQCModal.tsx

## CHANGE 1: Update Imports (Line 10)

**FIND:**
```typescript
import { X, Droplet, Gauge, Package, Eye, FileText, CheckCircle, AlertCircle } from 'lucide-react';
```

**REPLACE WITH:**
```typescript
import { X, Droplet, Gauge, Package, Eye, FileText, CheckCircle, AlertCircle, Search } from 'lucide-react';
```

---

## CHANGE 2: Add State Fields (After line ~90, in the formData useState)

**FIND the section with bottle_blow fields (around line 85-90):**
```typescript
    // BOTTLE_BLOW fields
    bottle_blow_visual_pass: false,
    bottle_integrity: '',
    bottle_blow_equipment_cleaned: false,
    bottle_blow_notes: '',
```

**ADD AFTER IT:**
```typescript
    // RETURNED_BOTTLE_INSPECTION fields (for Re-Fill products)
    exterior_clean: false,
    no_cracks_damage: false,
    cap_threads_intact: false,
    base_not_damaged: false,
    no_discoloration: false,
    no_foreign_odors: false,
    bottles_acceptable: false,
    returned_bottle_notes: '',
```

---

## CHANGE 3: Add Payload Handler (After line ~162, after BOTTLE_BLOW handler)

**FIND:**
```typescript
      else if (nextStage.next_stage_code === 'BOTTLE_BLOW') {
        payload.visual_inspection_pass = formData.bottle_blow_visual_pass;
        payload.bottle_integrity = formData.bottle_integrity === 'OK' ? 'OK' : 'Compromised';
        payload.equipment_cleaned = formData.bottle_blow_equipment_cleaned;
        payload.visual_inspection_notes = formData.bottle_blow_notes;
      }
```

**ADD AFTER IT:**
```typescript
      else if (nextStage.next_stage_code === 'RETURNED_BOTTLE_INSPECTION') {
        // Store inspection checklist in stage_custom_data
        payload.stage_custom_data = {
          exterior_clean: formData.exterior_clean,
          no_cracks_damage: formData.no_cracks_damage,
          cap_threads_intact: formData.cap_threads_intact,
          base_not_damaged: formData.base_not_damaged,
          no_discoloration: formData.no_discoloration,
          no_foreign_odors: formData.no_foreign_odors,
          bottles_acceptable: formData.bottles_acceptable
        };
        
        // Map to standard fields for compatibility
        payload.visual_inspection_pass = formData.bottles_acceptable;
        payload.visual_inspection_notes = formData.returned_bottle_notes;
        payload.bottle_integrity = formData.no_cracks_damage && formData.base_not_damaged ? 'OK' : 'Compromised';
      }
```

---

## CHANGE 4: Add Icon Handler (In getStageIcon function, around line 274)

**FIND:**
```typescript
    switch (nextStage.next_stage_code) {
      case 'WATER_TREATMENT':
      case 'PRE_PRODUCTION':
        return <Droplet className="w-5 h-5" />;
      case 'BOTTLE_BLOW':
        return <Eye className="w-5 h-5" />;
```

**ADD AFTER BOTTLE_BLOW:**
```typescript
      case 'RETURNED_BOTTLE_INSPECTION':
        return <Search className="w-5 h-5" />;
```

---

## CHANGE 5: Add Color Handler (In getStageColor function, around line 292)

**FIND:**
```typescript
    switch (nextStage.next_stage_code) {
      case 'WATER_TREATMENT':
      case 'PRE_PRODUCTION':
        return 'text-blue-400';
      case 'BOTTLE_BLOW':
        return 'text-yellow-400';
```

**ADD AFTER BOTTLE_BLOW:**
```typescript
      case 'RETURNED_BOTTLE_INSPECTION':
        return 'text-purple-400';
```

---

## CHANGE 6: Add Form Section (After BOTTLE_BLOW form, around line 591)

**FIND the end of BOTTLE_BLOW section:**
```typescript
          {nextStage.next_stage_code === 'BOTTLE_BLOW' && (
            <div className="space-y-4">
              {/* ... BOTTLE_BLOW form fields ... */}
            </div>
          )}
```

**ADD AFTER IT (before WASHING section):**
```typescript
          {/* STAGE 2: RETURNED BOTTLE INSPECTION (Re-Fill) */}
          {nextStage.next_stage_code === 'RETURNED_BOTTLE_INSPECTION' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Search className="w-5 h-5 text-purple-400" />
                Returned Bottle Inspection (Re-Fill)
              </h3>
              
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4">
                <p className="text-sm text-purple-300 mb-3">
                  Inspect returned 5-gallon bottles before refilling. All items must pass inspection.
                </p>
                
                <div className="space-y-3">
                  {/* Exterior Clean */}
                  <label className="flex items-center gap-3 text-white cursor-pointer hover:bg-dark-700 p-2 rounded transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.exterior_clean}
                      onChange={(e) => setFormData({ ...formData, exterior_clean: e.target.checked })}
                      className="w-5 h-5 rounded border-dark-600 text-purple-500 focus:ring-2 focus:ring-purple-500"
                    />
                    <span className="flex-1">Bottle exterior is clean (no dirt, old labels removed)</span>
                  </label>

                  {/* No Cracks/Damage */}
                  <label className="flex items-center gap-3 text-white cursor-pointer hover:bg-dark-700 p-2 rounded transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.no_cracks_damage}
                      onChange={(e) => setFormData({ ...formData, no_cracks_damage: e.target.checked })}
                      className="w-5 h-5 rounded border-dark-600 text-purple-500 focus:ring-2 focus:ring-purple-500"
                    />
                    <span className="flex-1">No visible cracks or structural damage</span>
                  </label>

                  {/* Cap Threads */}
                  <label className="flex items-center gap-3 text-white cursor-pointer hover:bg-dark-700 p-2 rounded transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.cap_threads_intact}
                      onChange={(e) => setFormData({ ...formData, cap_threads_intact: e.target.checked })}
                      className="w-5 h-5 rounded border-dark-600 text-purple-500 focus:ring-2 focus:ring-purple-500"
                    />
                    <span className="flex-1">Cap threads are intact (not stripped or damaged)</span>
                  </label>

                  {/* Base Not Damaged */}
                  <label className="flex items-center gap-3 text-white cursor-pointer hover:bg-dark-700 p-2 rounded transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.base_not_damaged}
                      onChange={(e) => setFormData({ ...formData, base_not_damaged: e.target.checked })}
                      className="w-5 h-5 rounded border-dark-600 text-purple-500 focus:ring-2 focus:ring-purple-500"
                    />
                    <span className="flex-1">Bottle base/bottom is not damaged or cracked</span>
                  </label>

                  {/* No Discoloration */}
                  <label className="flex items-center gap-3 text-white cursor-pointer hover:bg-dark-700 p-2 rounded transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.no_discoloration}
                      onChange={(e) => setFormData({ ...formData, no_discoloration: e.target.checked })}
                      className="w-5 h-5 rounded border-dark-600 text-purple-500 focus:ring-2 focus:ring-purple-500"
                    />
                    <span className="flex-1">No discoloration or cloudiness in plastic</span>
                  </label>

                  {/* No Foreign Odors */}
                  <label className="flex items-center gap-3 text-white cursor-pointer hover:bg-dark-700 p-2 rounded transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.no_foreign_odors}
                      onChange={(e) => setFormData({ ...formData, no_foreign_odors: e.target.checked })}
                      className="w-5 h-5 rounded border-dark-600 text-purple-500 focus:ring-2 focus:ring-purple-500"
                    />
                    <span className="flex-1">No foreign odors detected</span>
                  </label>

                  {/* Final Acceptance */}
                  <div className="pt-3 mt-3 border-t border-purple-500/20">
                    <label className="flex items-center gap-3 text-white cursor-pointer hover:bg-dark-700 p-2 rounded transition-colors font-medium">
                      <input
                        type="checkbox"
                        checked={formData.bottles_acceptable}
                        onChange={(e) => setFormData({ ...formData, bottles_acceptable: e.target.checked })}
                        className="w-5 h-5 rounded border-dark-600 text-purple-500 focus:ring-2 focus:ring-purple-500"
                      />
                      <span className="flex-1">✓ All bottles in batch are acceptable for refilling</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Inspection Notes (Optional)
                </label>
                <textarea
                  value={formData.returned_bottle_notes}
                  onChange={(e) => setFormData({ ...formData, returned_bottle_notes: e.target.value })}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  rows={3}
                  placeholder="Note any bottles rejected, issues found, or other observations..."
                />
              </div>
            </div>
          )}
```

---

## Summary - 6 Changes Total

1. ✅ Import `Search` icon
2. ✅ Add 8 state fields for inspection
3. ✅ Add payload handler
4. ✅ Add icon handler
5. ✅ Add color handler  
6. ✅ Add complete form section

**After making these changes:**
- Restart frontend
- Go to 5 Gal Re-Fill batch
- Stage 2 will show "Returned Bottle Inspection" with all checkboxes

**Apply these 6 changes in order and you're done!** 🚀
