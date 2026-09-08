'use strict';

const { pool } = require('./auth-service');
const inventoryService = require('./inventory-service');

// ─── Notifications ──────────────────────────────────────────────────────────

const createNotification = async ({
  notification_type, floc_id, equipment_id, reported_by, short_description,
  caused_unplanned_downtime, downtime_start, downtime_end
}) => {
  const result = await pool.query(
    `INSERT INTO maintenance_notifications (
      notification_type, floc_id, equipment_id, reported_by, short_description,
      caused_unplanned_downtime, downtime_start, downtime_end
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *`,
    [notification_type, floc_id || null, equipment_id || null, reported_by,
     short_description, caused_unplanned_downtime || false, downtime_start || null, downtime_end || null]
  );
  return result.rows[0];
};

const listNotifications = async ({ status } = {}) => {
  const conditions = [];
  const params = [];
  if (status) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await pool.query(
    `SELECT * FROM maintenance_notifications ${where} ORDER BY created_at DESC`,
    params
  );
  return result.rows;
};

// ─── Work Orders ─────────────────────────────────────────────────────────────

const createWorkOrder = async ({
  order_type, floc_id, equipment_id, pm_plan_id, notification_id,
  priority, short_description, scheduled_start, scheduled_end, created_by
}) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const woResult = await client.query(
      `INSERT INTO work_orders (
        order_type, floc_id, equipment_id, pm_plan_id, notification_id,
        priority, short_description, scheduled_start, scheduled_end, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [order_type, floc_id || null, equipment_id || null, pm_plan_id || null,
       notification_id || null, priority || 'MEDIUM', short_description,
       scheduled_start || null, scheduled_end || null, created_by]
    );

    const workOrder = woResult.rows[0];

    if (notification_id) {
      await client.query(
        `UPDATE maintenance_notifications SET status = 'CONVERTED_TO_WO' WHERE notification_id = $1`,
        [notification_id]
      );
    }

    await client.query(
      `INSERT INTO audit_log (table_name, record_id, action, new_values, performed_by, user_id)
       VALUES ($1, $2, $3, $4, $5, $5)`,
      ['work_orders', workOrder.work_order_id, 'INSERT',
       JSON.stringify({ wo_number: workOrder.wo_number, order_type, short_description }),
       created_by]
    );

    await client.query('COMMIT');
    return workOrder;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const getWorkOrder = async (workOrderId) => {
  const result = await pool.query(
    `SELECT wo.*,
            e.name AS equipment_name, e.equipment_code,
            fl.name AS floc_name, fl.floc_code,
            u.full_name AS created_by_name,
            cu.full_name AS cleared_by_name
     FROM work_orders wo
     LEFT JOIN equipment e ON e.equipment_id = wo.equipment_id
     LEFT JOIN functional_locations fl ON fl.floc_id = wo.floc_id
     LEFT JOIN users u ON u.user_id = wo.created_by
     LEFT JOIN users cu ON cu.user_id = wo.cleared_by
     WHERE wo.work_order_id = $1`,
    [workOrderId]
  );
  return result.rows[0] || null;
};

const listWorkOrders = async ({ status, equipment_id } = {}) => {
  const conditions = [];
  const params = [];
  if (status) {
    params.push(status);
    conditions.push(`wo.status = $${params.length}`);
  }
  if (equipment_id) {
    params.push(equipment_id);
    conditions.push(`wo.equipment_id = $${params.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await pool.query(
    `SELECT wo.*,
            e.name AS equipment_name, e.equipment_code,
            fl.name AS floc_name
     FROM work_orders wo
     LEFT JOIN equipment e ON e.equipment_id = wo.equipment_id
     LEFT JOIN functional_locations fl ON fl.floc_id = wo.floc_id
     ${where}
     ORDER BY wo.created_at DESC`,
    params
  );
  return result.rows;
};

const updateWorkOrderStatus = async (workOrderId, status, performedBy) => {
  const result = await pool.query(
    `UPDATE work_orders SET status = $1 WHERE work_order_id = $2 RETURNING *`,
    [status, workOrderId]
  );
  if (result.rows.length === 0) throw new Error('Work order not found');

  await pool.query(
    `INSERT INTO audit_log (table_name, record_id, action, new_values, performed_by, user_id)
     VALUES ($1, $2, $3, $4, $5, $5)`,
    ['work_orders', workOrderId, 'UPDATE', JSON.stringify({ status }), performedBy]
  );

  return result.rows[0];
};

// Closeout requires all four failure codes together (DB CHECK constraint
// enforces this too — this validation just gives a clearer error message
// before hitting the database).
const closeWorkOrder = async ({
  work_order_id, part_code_id, damage_code_id, cause_code_id, remedy_code_id,
  food_safety_cleared, cleared_by
}) => {
  if (!part_code_id || !damage_code_id || !cause_code_id || !remedy_code_id) {
    throw new Error('All four failure codes (part, damage, cause, remedy) are required to close a work order.');
  }

  const result = await pool.query(
    `UPDATE work_orders SET
      status = 'CLOSED',
      part_code_id = $1, damage_code_id = $2, cause_code_id = $3, remedy_code_id = $4,
      food_safety_cleared = $5, cleared_by = $6, cleared_at = CURRENT_TIMESTAMP,
      closed_at = CURRENT_TIMESTAMP
     WHERE work_order_id = $7
     RETURNING *`,
    [part_code_id, damage_code_id, cause_code_id, remedy_code_id,
     food_safety_cleared || false, cleared_by, work_order_id]
  );

  if (result.rows.length === 0) throw new Error('Work order not found');

  await pool.query(
    `INSERT INTO audit_log (table_name, record_id, action, new_values, performed_by, user_id)
     VALUES ($1, $2, $3, $4, $5, $5)`,
    ['work_orders', work_order_id, 'UPDATE',
     JSON.stringify({ status: 'CLOSED', part_code_id, damage_code_id, cause_code_id, remedy_code_id }),
     cleared_by]
  );

  return result.rows[0];
};

// ─── Time Confirmations ──────────────────────────────────────────────────────

const recordTimeConfirmation = async ({
  work_order_id, technician_user_id, start_time, end_time, work_notes
}) => {
  const result = await pool.query(
    `INSERT INTO work_order_time_confirmations (
      work_order_id, technician_user_id, start_time, end_time, work_notes
    ) VALUES ($1, $2, $3, $4, $5)
    RETURNING *`,
    [work_order_id, technician_user_id, start_time, end_time, work_notes || null]
  );
  return result.rows[0];
};

// ─── Part Allocation & Issuance ──────────────────────────────────────────────
// Issuance calls the EXISTING inventoryService.createTransaction() rather
// than writing to inventory_transactions directly — this keeps stock
// movement, transaction numbering, and audit logging on the one code path
// the rest of the system already uses and trusts.

const allocatePart = async ({ work_order_id, product_id, quantity_planned }) => {
  const result = await pool.query(
    `INSERT INTO work_order_part_allocations (work_order_id, product_id, quantity_planned)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [work_order_id, product_id, quantity_planned || 1]
  );
  return result.rows[0];
};

const issuePart = async ({
  allocation_id, from_location_id, quantity, unit_cost, performed_by
}) => {
  const allocationResult = await pool.query(
    `SELECT wopa.*, wo.wo_number
     FROM work_order_part_allocations wopa
     JOIN work_orders wo ON wo.work_order_id = wopa.work_order_id
     WHERE wopa.allocation_id = $1`,
    [allocation_id]
  );
  if (allocationResult.rows.length === 0) throw new Error('Part allocation not found');
  const allocation = allocationResult.rows[0];

  if (!from_location_id) {
    throw new Error('from_location_id is required — no default MRO/engineering stores location is configured yet.');
  }

  // Reuses the existing, trusted stock-movement code path.
  const transaction = await inventoryService.createTransaction({
    product_id: allocation.product_id,
    from_location_id,
    to_location_id: null,
    quantity,
    transaction_type: 'ISSUE',
    reference_number: allocation.wo_number,
    notes: `Issued against Work Order ${allocation.wo_number}`,
    unit_cost: unit_cost || null,
    performed_by
  });

  const updated = await pool.query(
    `UPDATE work_order_part_allocations SET
      quantity_issued = quantity_issued + $1,
      is_issued = TRUE,
      issued_at = CURRENT_TIMESTAMP,
      issued_by = $2,
      inventory_transaction_id = $3
     WHERE allocation_id = $4
     RETURNING *`,
    [quantity, performed_by, transaction.transaction.transaction_id, allocation_id]
  );

  return updated.rows[0];
};

// ─── Checklist Items ──────────────────────────────────────────────────────────

const updateChecklistItem = async ({
  item_id, status, measured_value, performed_by
}) => {
  const result = await pool.query(
    `UPDATE work_order_checklist_items SET
      status = $1, measured_value = $2, performed_by = $3, inspected_at = CURRENT_TIMESTAMP
     WHERE item_id = $4
     RETURNING *`,
    [status, measured_value || null, performed_by, item_id]
  );
  if (result.rows.length === 0) throw new Error('Checklist item not found');
  return result.rows[0];
};

const addChecklistItems = async (workOrderId, items) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const inserted = [];
    for (const item of items) {
      const result = await client.query(
        `INSERT INTO work_order_checklist_items (work_order_id, step_sequence, instruction)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [workOrderId, item.step_sequence, item.instruction]
      );
      inserted.push(result.rows[0]);
    }
    await client.query('COMMIT');
    return inserted;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// ─── Asset Register ──────────────────────────────────────────────────────────

const listFunctionalLocations = async () => {
  const result = await pool.query(
    `SELECT fl.*, parent.name AS parent_name
     FROM functional_locations fl
     LEFT JOIN functional_locations parent ON parent.floc_id = fl.parent_floc_id
     ORDER BY fl.floc_code`
  );
  return result.rows;
};

const listEquipment = async ({ floc_id, status } = {}) => {
  const conditions = [];
  const params = [];
  if (floc_id) {
    params.push(floc_id);
    conditions.push(`e.floc_id = $${params.length}`);
  }
  if (status) {
    params.push(status);
    conditions.push(`e.status = $${params.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await pool.query(
    `SELECT e.*, fl.name AS floc_name, fl.floc_code
     FROM equipment e
     LEFT JOIN functional_locations fl ON fl.floc_id = e.floc_id
     ${where}
     ORDER BY e.equipment_code`,
    params
  );
  return result.rows;
};

// ─── Work Order Checklist / Time (read) ──────────────────────────────────────

const getChecklistItems = async (workOrderId) => {
  const result = await pool.query(
    `SELECT ci.*, u.full_name AS performed_by_name
     FROM work_order_checklist_items ci
     LEFT JOIN users u ON u.user_id = ci.performed_by
     WHERE ci.work_order_id = $1
     ORDER BY ci.step_sequence`,
    [workOrderId]
  );
  return result.rows;
};

const getTimeConfirmations = async (workOrderId) => {
  const result = await pool.query(
    `SELECT tc.*, u.full_name AS technician_name
     FROM work_order_time_confirmations tc
     LEFT JOIN users u ON u.user_id = tc.technician_user_id
     WHERE tc.work_order_id = $1
     ORDER BY tc.start_time DESC`,
    [workOrderId]
  );
  return result.rows;
};

// ─── Parts Catalog / Storage / Allocations (read) ────────────────────────────

// Scoped to SPARE_% categories only — this is deliberately NOT a general
// product browser. A work-order parts picker showing raw materials or
// finished goods would be a real usability problem, not just noise.
const listSpareParts = async () => {
  const result = await pool.query(
    `SELECT p.product_id, p.sku, p.product_name, pc.category_code, pc.category_name
     FROM products p
     JOIN product_categories pc ON pc.category_id = p.category_id
     WHERE pc.category_code LIKE 'SPARE_%'
     ORDER BY p.product_name`
  );
  return result.rows;
};

// warehouse_locations, NOT functional_locations — this is physical
// storage (where spares actually sit), a different table from the asset
// hierarchy used elsewhere in this module. Scoped to the 'E-' zone's bins
// specifically (E-01-BIN-01, E-01-BIN-02), not the whole warehouse.
const listEngineeringStorageLocations = async () => {
  const result = await pool.query(
    `SELECT location_id, location_code, location_name
     FROM warehouse_locations
     WHERE location_code LIKE 'E-%' AND location_type = 'bin'
     ORDER BY location_code`
  );
  return result.rows;
};

const getPartAllocations = async (workOrderId) => {
  const result = await pool.query(
    `SELECT wopa.*, p.sku, p.product_name,
            wl.location_code AS issued_from_location_code
     FROM work_order_part_allocations wopa
     JOIN products p ON p.product_id = wopa.product_id
     LEFT JOIN inventory_transactions it ON it.transaction_id = wopa.inventory_transaction_id
     LEFT JOIN warehouse_locations wl ON wl.location_id = it.from_location_id
     WHERE wopa.work_order_id = $1
     ORDER BY wopa.created_at`,
    [workOrderId]
  );
  return result.rows;
};

// ─── Failure Catalogs (read) ──────────────────────────────────────────────────

const listFailureCatalogs = async () => {
  const result = await pool.query(
    `SELECT * FROM failure_catalogs ORDER BY catalog_type, code_name`
  );
  return result.rows;
};

// ─── Asset Register (write) ───────────────────────────────────────────────────

const createFunctionalLocation = async ({ floc_code, name, parent_floc_id, criticality }) => {
  try {
    const result = await pool.query(
      `INSERT INTO functional_locations (floc_code, name, parent_floc_id, criticality)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [floc_code, name, parent_floc_id || null, criticality || 'MEDIUM']
    );
    return result.rows[0];
  } catch (error) {
    if (error.code === '23505') {
      throw new Error(`A functional location with code "${floc_code}" already exists.`);
    }
    throw error;
  }
};

const createEquipment = async ({
  equipment_code, name, model_number, manufacturer, floc_id,
  parent_equipment_id, installation_date, food_contact_surface, status
}) => {
  try {
    const result = await pool.query(
      `INSERT INTO equipment (
        equipment_code, name, model_number, manufacturer, floc_id,
        parent_equipment_id, installation_date, food_contact_surface, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [equipment_code, name, model_number || null, manufacturer || null,
       floc_id || null, parent_equipment_id || null, installation_date || null,
       food_contact_surface || false, status || 'OPERATIONAL']
    );
    return result.rows[0];
  } catch (error) {
    if (error.code === '23505') {
      throw new Error(`Equipment with code "${equipment_code}" already exists.`);
    }
    throw error;
  }
};

// ─── Task Lists ────────────────────────────────────────────────────────────────

const createTaskList = async ({
  title, craft, estimated_duration_minutes, requires_line_shutdown,
  requires_cip_sanitation, operations
}) => {
  if (!Array.isArray(operations) || operations.length === 0) {
    throw new Error('A task list needs at least one operation/step.');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const tlResult = await client.query(
      `INSERT INTO task_lists (title, craft, estimated_duration_minutes, requires_line_shutdown, requires_cip_sanitation)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [title, craft, estimated_duration_minutes,
       requires_line_shutdown ?? true, requires_cip_sanitation ?? false]
    );
    const taskList = tlResult.rows[0];

    for (let i = 0; i < operations.length; i++) {
      await client.query(
        `INSERT INTO task_list_operations (task_list_id, step_sequence, instruction_text, expected_qualitative_result, requires_signoff)
         VALUES ($1, $2, $3, $4, $5)`,
        [taskList.task_list_id, i + 1, operations[i].instruction_text,
         operations[i].expected_qualitative_result || null, operations[i].requires_signoff || false]
      );
    }

    await client.query('COMMIT');
    return taskList;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const listTaskLists = async () => {
  const result = await pool.query(
    `SELECT tl.*, COUNT(tlo.operation_id)::int AS step_count
     FROM task_lists tl
     LEFT JOIN task_list_operations tlo ON tlo.task_list_id = tl.task_list_id
     GROUP BY tl.task_list_id
     ORDER BY tl.title`
  );
  return result.rows;
};

const getTaskList = async (taskListId) => {
  const tlResult = await pool.query(`SELECT * FROM task_lists WHERE task_list_id = $1`, [taskListId]);
  if (tlResult.rows.length === 0) return null;
  const opsResult = await pool.query(
    `SELECT * FROM task_list_operations WHERE task_list_id = $1 ORDER BY step_sequence`,
    [taskListId]
  );
  return { ...tlResult.rows[0], operations: opsResult.rows };
};

// ─── Measuring Points & PM Plans ─────────────────────────────────────────────

const listMeasuringPointsForEquipment = async (equipmentId) => {
  const result = await pool.query(
    `SELECT * FROM measuring_points WHERE equipment_id = $1 ORDER BY name`,
    [equipmentId]
  );
  return result.rows;
};

const createMeasuringPoint = async ({ equipment_id, name, metric_type, unit_of_measure, current_value }) => {
  const result = await pool.query(
    `INSERT INTO measuring_points (equipment_id, name, metric_type, unit_of_measure, current_value)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [equipment_id, name, metric_type, unit_of_measure, current_value || 0]
  );
  return result.rows[0];
};

const recordMeasuringReading = async ({ point_id, reading_value, recorded_by, source }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO measuring_readings (point_id, reading_value, recorded_by, source)
       VALUES ($1, $2, $3, $4)`,
      [point_id, reading_value, recorded_by, source || 'MANUAL']
    );
    const result = await client.query(
      `UPDATE measuring_points SET current_value = $1, last_reading_at = CURRENT_TIMESTAMP
       WHERE point_id = $2
       RETURNING *`,
      [reading_value, point_id]
    );
    if (result.rows.length === 0) throw new Error('Measuring point not found.');
    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Creates a PM plan. If the trigger is counter-based (COUNTER or
// BOTH_FIRST_DUE) and no existing counter_point_id is given, a new
// measuring point is created in the SAME transaction using
// new_measuring_point — so a mid-way failure never leaves an orphaned
// measuring point with no plan attached, or a plan referencing nothing.
const createPMPlan = async ({
  title, equipment_id, task_list_id, trigger_type,
  calendar_interval_days, counter_interval_units,
  counter_point_id, new_measuring_point
}) => {
  const needsCounter = trigger_type === 'COUNTER' || trigger_type === 'BOTH_FIRST_DUE';
  const needsCalendar = trigger_type === 'CALENDAR' || trigger_type === 'BOTH_FIRST_DUE';

  if (needsCalendar && !calendar_interval_days) {
    throw new Error('Calendar interval (days) is required for a calendar-based plan.');
  }
  if (needsCounter && !counter_point_id && !new_measuring_point) {
    throw new Error('A counter-based plan needs either an existing measuring point or a new one to be defined.');
  }
  if (needsCounter && !counter_interval_units) {
    throw new Error('Counter interval (units) is required for a counter-based plan.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let resolvedCounterPointId = counter_point_id || null;
    let currentCounterValue = null;

    if (needsCounter) {
      if (!resolvedCounterPointId) {
        const mpResult = await client.query(
          `INSERT INTO measuring_points (equipment_id, name, metric_type, unit_of_measure, current_value)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [equipment_id, new_measuring_point.name, new_measuring_point.metric_type,
           new_measuring_point.unit_of_measure, new_measuring_point.initial_value || 0]
        );
        resolvedCounterPointId = mpResult.rows[0].point_id;
        currentCounterValue = Number(mpResult.rows[0].current_value);
      } else {
        const mpResult = await client.query(
          `SELECT current_value FROM measuring_points WHERE point_id = $1`,
          [resolvedCounterPointId]
        );
        if (mpResult.rows.length === 0) throw new Error('Selected measuring point not found.');
        currentCounterValue = Number(mpResult.rows[0].current_value);
      }
    }

    // Compute in JS — no CASE/IN logic in the SQL, no reused parameters.
    let nextDueDate = null;
    if (needsCalendar) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() + Number(calendar_interval_days));
      nextDueDate = d.toISOString().split('T')[0]; // YYYY-MM-DD, plain date
    }

    let nextDueCounter = null;
    if (needsCounter) {
      nextDueCounter = currentCounterValue + Number(counter_interval_units);
    }

    const result = await client.query(
      `INSERT INTO pm_plans (
        title, equipment_id, task_list_id, trigger_type,
        calendar_interval_days, counter_point_id, counter_interval_units,
        next_due_date, next_due_counter, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        title, equipment_id, task_list_id, trigger_type,
        calendar_interval_days || null, resolvedCounterPointId, counter_interval_units || null,
        nextDueDate, nextDueCounter, true
      ]
    );

    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const listPMPlans = async () => {
  const result = await pool.query(
    `SELECT pp.*,
            e.name AS equipment_name, e.equipment_code,
            tl.title AS task_list_title,
            mp.name AS counter_point_name, mp.current_value AS counter_current_value, mp.unit_of_measure AS counter_unit,
            (SELECT wo.work_order_id FROM work_orders wo
             WHERE wo.pm_plan_id = pp.pm_plan_id AND wo.status NOT IN ('CLOSED', 'CANCELLED')
             ORDER BY wo.created_at DESC LIMIT 1) AS open_work_order_id
     FROM pm_plans pp
     LEFT JOIN equipment e ON e.equipment_id = pp.equipment_id
     LEFT JOIN task_lists tl ON tl.task_list_id = pp.task_list_id
     LEFT JOIN measuring_points mp ON mp.point_id = pp.counter_point_id
     ORDER BY pp.next_due_date NULLS LAST, pp.title`
  );
  return result.rows;
};

const generateWorkOrderFromPMPlan = async (pmPlanId, createdBy) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const planResult = await client.query(`SELECT * FROM pm_plans WHERE pm_plan_id = $1`, [pmPlanId]);
    if (planResult.rows.length === 0) throw new Error('PM plan not found.');
    const plan = planResult.rows[0];
    if (!plan.is_active) throw new Error('This PM plan is not active.');

    // Idempotency guard — the same protection the eventual background
    // scheduler will rely on. A manager double-clicking this button, or
    // the scheduler running twice before a status changes, must not
    // create a second work order for the same plan.
    const existingResult = await client.query(
      `SELECT work_order_id FROM work_orders
       WHERE pm_plan_id = $1 AND status NOT IN ('CLOSED', 'CANCELLED')
       LIMIT 1`,
      [pmPlanId]
    );
    if (existingResult.rows.length > 0) {
      throw new Error(`An open work order already exists for this PM plan (${existingResult.rows[0].work_order_id}). Close or cancel it before generating another.`);
    }

    const taskListResult = await client.query(`SELECT * FROM task_lists WHERE task_list_id = $1`, [plan.task_list_id]);
    if (taskListResult.rows.length === 0) throw new Error('The task list linked to this PM plan no longer exists.');
    const taskList = taskListResult.rows[0];

    const opsResult = await client.query(
      `SELECT * FROM task_list_operations WHERE task_list_id = $1 ORDER BY step_sequence`,
      [plan.task_list_id]
    );

    const woResult = await client.query(
      `INSERT INTO work_orders (
        order_type, equipment_id, pm_plan_id, priority, short_description, created_by
      ) VALUES ('PREVENTIVE', $1, $2, 'MEDIUM', $3, $4)
      RETURNING *`,
      [plan.equipment_id, pmPlanId, `Preventive maintenance: ${plan.title} (${taskList.title})`, createdBy]
    );
    const workOrder = woResult.rows[0];

    for (const op of opsResult.rows) {
      await client.query(
        `INSERT INTO work_order_checklist_items (work_order_id, step_sequence, instruction)
         VALUES ($1, $2, $3)`,
        [workOrder.work_order_id, op.step_sequence, op.instruction_text]
      );
    }

    // Advance the plan — computed in JS, single-use parameters only,
    // same discipline as the Stage B fix. No CASE/IN reuse in the SQL.
    let newNextDueDate = plan.next_due_date;
    if (plan.trigger_type === 'CALENDAR' || plan.trigger_type === 'BOTH_FIRST_DUE') {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() + Number(plan.calendar_interval_days));
      newNextDueDate = d.toISOString().split('T')[0];
    }

    let newNextDueCounter = plan.next_due_counter;
    let newLastExecutedCounter = plan.last_executed_counter;
    if (plan.trigger_type === 'COUNTER' || plan.trigger_type === 'BOTH_FIRST_DUE') {
      const mpResult = await client.query(`SELECT current_value FROM measuring_points WHERE point_id = $1`, [plan.counter_point_id]);
      const currentValue = mpResult.rows.length > 0 ? Number(mpResult.rows[0].current_value) : 0;
      newLastExecutedCounter = currentValue;
      newNextDueCounter = currentValue + Number(plan.counter_interval_units);
    }

    await client.query(
      `UPDATE pm_plans SET
        last_executed_at = CURRENT_TIMESTAMP,
        last_executed_counter = $1,
        next_due_date = $2,
        next_due_counter = $3
       WHERE pm_plan_id = $4`,
      [newLastExecutedCounter, newNextDueDate, newNextDueCounter, pmPlanId]
    );

    await client.query('COMMIT');
    return workOrder;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  createNotification,
  listNotifications,
  createWorkOrder,
  getWorkOrder,
  listWorkOrders,
  updateWorkOrderStatus,
  closeWorkOrder,
  recordTimeConfirmation,
  allocatePart,
  issuePart,
  updateChecklistItem,
  addChecklistItems,
  listFunctionalLocations,
  listEquipment,
  getChecklistItems,
  getTimeConfirmations,
  listSpareParts,
  listEngineeringStorageLocations,
  getPartAllocations,
  listFailureCatalogs,
  createFunctionalLocation,
  createEquipment,
  createTaskList,
  listTaskLists,
  getTaskList,
  listMeasuringPointsForEquipment,
  createMeasuringPoint,
  recordMeasuringReading,
  createPMPlan,
  listPMPlans,
  generateWorkOrderFromPMPlan
};
