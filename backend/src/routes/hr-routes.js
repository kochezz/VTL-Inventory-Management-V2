'use strict';

const express = require('express');
const router  = express.Router();

const { authenticate }                   = require('../middleware/auth-middleware');
const { requireHrAccess, requireHrAdmin } = require('../middleware/hr-middleware');
const hrService                           = require('../services/hr-service');

// Authenticate every HR request
router.use(authenticate);

// ─── Dashboard & Overview ────────────────────────────────────────────────────

router.get('/dashboard', requireHrAccess, async (req, res) => {
  try {
    res.json(await hrService.getDashboardStats());
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/compliance', requireHrAdmin, async (req, res) => {
  try {
    res.json(await hrService.getComplianceSnapshot());
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/departments', requireHrAccess, async (req, res) => {
  try {
    res.json(await hrService.getDepartments());
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── Employees ───────────────────────────────────────────────────────────────

router.get('/employees', requireHrAccess, async (req, res) => {
  try {
    res.json(await hrService.getAllEmployees(req.user.role));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/employees/:userId', requireHrAccess, async (req, res) => {
  try {
    const data = await hrService.getEmployeeByUserId(req.params.userId, req.user.role);
    if (!data) return res.status(404).json({ message: 'Not found' });
    res.json(data);
  } catch (error) {
    if (error.message === 'Employee not found') return res.status(404).json({ message: 'Not found' });
    res.status(500).json({ message: error.message });
  }
});

router.post('/employees/:userId/record', requireHrAdmin, async (req, res) => {
  try {
    res.status(201).json(
      await hrService.createHrRecord(req.params.userId, req.body, req.user.user_id)
    );
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/employees/:userId/record', requireHrAdmin, async (req, res) => {
  try {
    res.json(
      await hrService.updateHrRecord(req.params.userId, req.body, req.user.user_id)
    );
  } catch (error) {
    if (error.message === 'Employee HR record not found') return res.status(404).json({ message: 'Not found' });
    res.status(500).json({ message: error.message });
  }
});

// ─── Onboarding ──────────────────────────────────────────────────────────────

router.get('/employees/:userId/onboarding', requireHrAccess, async (req, res) => {
  try {
    res.json(await hrService.getOnboardingProgress(req.params.userId));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/employees/:userId/onboarding/:module', requireHrAccess, async (req, res) => {
  try {
    res.json(
      await hrService.upsertOnboardingModule(
        req.params.userId,
        req.params.module,
        req.body,
        req.user.user_id
      )
    );
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── SOP Training ────────────────────────────────────────────────────────────

router.get('/employees/:userId/sop-training', requireHrAccess, async (req, res) => {
  try {
    res.json(await hrService.getSopTrainingRecords(req.params.userId));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/employees/:userId/sop-training', requireHrAdmin, async (req, res) => {
  try {
    res.status(201).json(
      await hrService.upsertSopTraining(req.params.userId, req.body, req.user.user_id)
    );
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── Reviews ─────────────────────────────────────────────────────────────────

router.get('/employees/:userId/reviews', requireHrAccess, async (req, res) => {
  try {
    res.json(await hrService.getReviews(req.params.userId));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/employees/:userId/reviews', requireHrAdmin, async (req, res) => {
  try {
    res.status(201).json(
      await hrService.createReview(req.params.userId, req.body, req.user.user_id)
    );
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/reviews/:reviewId', requireHrAdmin, async (req, res) => {
  try {
    res.json(
      await hrService.updateReview(req.params.reviewId, req.body, req.user.user_id)
    );
  } catch (error) {
    if (error.message === 'Review not found') return res.status(404).json({ message: 'Not found' });
    res.status(500).json({ message: error.message });
  }
});

// ─── PIPs ────────────────────────────────────────────────────────────────────

router.get('/employees/:userId/pips', requireHrAccess, async (req, res) => {
  try {
    res.json(await hrService.getPipRecords(req.params.userId));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/employees/:userId/pips', requireHrAdmin, async (req, res) => {
  try {
    res.status(201).json(
      await hrService.createPip(req.params.userId, req.body, req.user.user_id)
    );
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── Performance Ratings ─────────────────────────────────────────────────────

router.get('/employees/:userId/ratings', requireHrAccess, async (req, res) => {
  try {
    res.json(await hrService.getPerformanceRatings(req.params.userId));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/employees/:userId/ratings', requireHrAdmin, async (req, res) => {
  try {
    res.json(
      await hrService.upsertPerformanceRating(req.params.userId, req.body, req.user.user_id)
    );
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── Leave Balances ───────────────────────────────────────────────────────────

router.get('/employees/:userId/leave-balance', requireHrAccess, async (req, res) => {
  try {
    res.json(await hrService.getLeaveBalance(req.params.userId));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/employees/:userId/leave-balance', requireHrAdmin, async (req, res) => {
  try {
    res.json(
      await hrService.upsertLeaveBalance(
        req.params.userId,
        new Date().getFullYear(),
        req.body
      )
    );
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
