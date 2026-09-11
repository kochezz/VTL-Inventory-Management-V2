'use strict';

const express = require('express');
const router = express.Router();

const { authenticate } = require('../middleware/auth-middleware');
const { requireEngineeringAccess, requireEngineeringManager } = require('../middleware/engineering-middleware');
const engineeringService = require('../services/engineering-service');
const EngineeringEmailService = require('../services/engineering-email-service');

// Authenticate every Engineering request
router.use(authenticate);

// ─── Notifications ──────────────────────────────────────────────────────────

router.get('/notifications', requireEngineeringAccess, async (req, res) => {
  try {
    res.json(await engineeringService.listNotifications({ status: req.query.status }));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/notifications', requireEngineeringAccess, async (req, res) => {
  try {
    const notification = await engineeringService.createNotification({
      ...req.body,
      reported_by: req.user.user_id
    });
    EngineeringEmailService.notifyNewIssue(notification).catch(console.error);
    res.status(201).json(notification);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// ─── Asset Register ──────────────────────────────────────────────────────────

router.get('/assets/locations', requireEngineeringAccess, async (req, res) => {
  try {
    res.json(await engineeringService.listFunctionalLocations());
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/assets/equipment', requireEngineeringAccess, async (req, res) => {
  try {
    res.json(await engineeringService.listEquipment({
      floc_id: req.query.floc_id,
      status: req.query.status
    }));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/assets/locations', requireEngineeringManager, async (req, res) => {
  try {
    res.status(201).json(await engineeringService.createFunctionalLocation(req.body));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.post('/assets/equipment', requireEngineeringManager, async (req, res) => {
  try {
    res.status(201).json(await engineeringService.createEquipment(req.body));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// ─── Task Lists ──────────────────────────────────────────────────────────────

router.get('/task-lists', requireEngineeringAccess, async (req, res) => {
  try {
    res.json(await engineeringService.listTaskLists());
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/task-lists/:id', requireEngineeringAccess, async (req, res) => {
  try {
    const taskList = await engineeringService.getTaskList(req.params.id);
    if (!taskList) return res.status(404).json({ message: 'Task list not found' });
    res.json(taskList);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/task-lists', requireEngineeringManager, async (req, res) => {
  try {
    res.status(201).json(await engineeringService.createTaskList(req.body));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// ─── Measuring Points & PM Plans ──────────────────────────────────────────────

router.get('/equipment/:equipmentId/measuring-points', requireEngineeringAccess, async (req, res) => {
  try {
    res.json(await engineeringService.listMeasuringPointsForEquipment(req.params.equipmentId));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/equipment/:equipmentId/measuring-points', requireEngineeringManager, async (req, res) => {
  try {
    res.status(201).json(await engineeringService.createMeasuringPoint({
      ...req.body,
      equipment_id: req.params.equipmentId
    }));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.post('/measuring-points/:pointId/readings', requireEngineeringAccess, async (req, res) => {
  try {
    res.status(201).json(await engineeringService.recordMeasuringReading({
      ...req.body,
      point_id: req.params.pointId,
      recorded_by: req.user.user_id
    }));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.get('/pm-plans', requireEngineeringAccess, async (req, res) => {
  try {
    res.json(await engineeringService.listPMPlans());
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/pm-plans', requireEngineeringManager, async (req, res) => {
  try {
    res.status(201).json(await engineeringService.createPMPlan(req.body));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.post('/pm-plans/:id/generate-work-order', requireEngineeringManager, async (req, res) => {
  try {
    res.status(201).json(await engineeringService.generateWorkOrderFromPMPlan(req.params.id, req.user.user_id));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.patch('/pm-plans/:id', requireEngineeringManager, async (req, res) => {
  try {
    if (typeof req.body.is_active !== 'boolean') {
      return res.status(400).json({ message: 'is_active must be a boolean.' });
    }
    res.json(await engineeringService.updatePMPlanActive(req.params.id, req.body.is_active));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// ─── Failure Catalogs ────────────────────────────────────────────────────────

router.get('/failure-catalogs', requireEngineeringAccess, async (req, res) => {
  try {
    res.json(await engineeringService.listFailureCatalogs());
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── Work Orders ─────────────────────────────────────────────────────────────

router.get('/work-orders', requireEngineeringAccess, async (req, res) => {
  try {
    res.json(await engineeringService.listWorkOrders({
      status: req.query.status,
      equipment_id: req.query.equipment_id
    }));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/work-orders/:id', requireEngineeringAccess, async (req, res) => {
  try {
    const wo = await engineeringService.getWorkOrder(req.params.id);
    if (!wo) return res.status(404).json({ message: 'Work order not found' });
    res.json(wo);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/work-orders', requireEngineeringManager, async (req, res) => {
  try {
    const workOrder = await engineeringService.createWorkOrder({
      ...req.body,
      created_by: req.user.user_id
    });
    EngineeringEmailService.notifyWorkOrderCreated(workOrder).catch(console.error);
    res.status(201).json(workOrder);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Status transitions (draft -> approved -> scheduled -> in_progress -> teco_complete)
// stay at engineering-tech level; only closing the WO with failure codes is
// a manager action, handled separately below.
router.patch('/work-orders/:id/status', requireEngineeringAccess, async (req, res) => {
  try {
    if (req.body.status === 'APPROVED' && !['admin', 'engineering_manager'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied. Approving a work order requires the engineering manager role.' });
    }
    const updated = await engineeringService.updateWorkOrderStatus(req.params.id, req.body.status, req.user.user_id);
    if (req.body.status === 'APPROVED') {
      EngineeringEmailService.notifyWorkOrderApproved(updated).catch(console.error);
    }
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.post('/work-orders/:id/close', requireEngineeringManager, async (req, res) => {
  try {
    res.json(await engineeringService.closeWorkOrder({
      ...req.body,
      work_order_id: req.params.id,
      cleared_by: req.user.user_id
    }));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// ─── Time Confirmations ──────────────────────────────────────────────────────

router.post('/work-orders/:id/time', requireEngineeringAccess, async (req, res) => {
  try {
    res.status(201).json(await engineeringService.recordTimeConfirmation({
      ...req.body,
      work_order_id: req.params.id,
      technician_user_id: req.user.user_id
    }));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.get('/work-orders/:id/checklist', requireEngineeringAccess, async (req, res) => {
  try {
    res.json(await engineeringService.getChecklistItems(req.params.id));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/work-orders/:id/time', requireEngineeringAccess, async (req, res) => {
  try {
    res.json(await engineeringService.getTimeConfirmations(req.params.id));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── Parts ────────────────────────────────────────────────────────────────────

router.post('/work-orders/:id/parts', requireEngineeringAccess, async (req, res) => {
  try {
    res.status(201).json(await engineeringService.allocatePart({
      ...req.body,
      work_order_id: req.params.id
    }));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.post('/parts/:allocationId/issue', requireEngineeringAccess, async (req, res) => {
  try {
    res.json(await engineeringService.issuePart({
      ...req.body,
      allocation_id: req.params.allocationId,
      performed_by: req.user.user_id
    }));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.get('/parts/catalog', requireEngineeringAccess, async (req, res) => {
  try {
    res.json(await engineeringService.listSpareParts());
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/parts/storage-locations', requireEngineeringAccess, async (req, res) => {
  try {
    res.json(await engineeringService.listEngineeringStorageLocations());
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/work-orders/:id/parts', requireEngineeringAccess, async (req, res) => {
  try {
    res.json(await engineeringService.getPartAllocations(req.params.id));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── Checklist ────────────────────────────────────────────────────────────────

router.post('/work-orders/:id/checklist', requireEngineeringManager, async (req, res) => {
  try {
    res.status(201).json(await engineeringService.addChecklistItems(req.params.id, req.body.items));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.patch('/checklist/:itemId', requireEngineeringAccess, async (req, res) => {
  try {
    res.json(await engineeringService.updateChecklistItem({
      ...req.body,
      item_id: req.params.itemId,
      performed_by: req.user.user_id
    }));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;
