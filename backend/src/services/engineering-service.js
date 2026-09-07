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
  getTaskList
};
