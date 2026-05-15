'use strict';

const express    = require('express');
const router     = express.Router();
const multer     = require('multer');

const { authenticate }                    = require('../middleware/auth-middleware');
const { requireHrAccess, requireHrAdmin } = require('../middleware/hr-middleware');
const hrService                           = require('../services/hr-service');
const hrDocService                        = require('../services/hr-document-service');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
    ];
    allowed.includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error('Only PDF, JPG, and PNG files are accepted for HR documents.'));
  },
});

// Authenticate every HR request
router.use(authenticate);

// ─── Dashboard & Overview ─────────────────────────────────────────────────────

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

// FIX: was requireHrAdmin — changed to requireHrAccess so hr_admin and
// hr_manager roles can both load the Reports To dropdown on the HR record
// creation form. Returns only non-sensitive fields (no salary, no password).
router.get('/active-users', requireHrAccess, async (req, res) => {
  try {
    res.json(await hrService.getActiveUsersForHrRecord());
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── Employees ────────────────────────────────────────────────────────────────

router.get('/employees', requireHrAccess, async (req, res) => {
  try {
    res.json(await hrService.getAllEmployees(req.user.role));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/employees-missing-records', requireHrAdmin, async (req, res) => {
  try {
    res.json(await hrService.getUsersMissingHrRecord());
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

// ─── Onboarding ───────────────────────────────────────────────────────────────

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

// ─── SOP Training ─────────────────────────────────────────────────────────────

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

// ─── Reviews ──────────────────────────────────────────────────────────────────

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

// ─── PIPs ─────────────────────────────────────────────────────────────────────

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

// ─── Performance Ratings ──────────────────────────────────────────────────────

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

// ─── Personnel Documents ──────────────────────────────────────────────────────

// GET — list documents (no file data)
router.get('/employees/:userId/documents', requireHrAccess, async (req, res) => {
  try {
    res.json(await hrDocService.getPersonnelDocuments(req.params.userId));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST — upload a new document
router.post(
  '/employees/:userId/documents',
  requireHrAccess,
  upload.single('document_file'),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });

      const meta = {
        document_type:    req.body.document_type,
        document_title:   req.body.document_title,
        document_date:    req.body.document_date   || null,
        version:          req.body.version         || '1.0',
        notes:            req.body.notes           || null,
        is_gate_document: req.body.is_gate_document === 'true',
        gate_category:    req.body.gate_category   || null,
      };

      if (!meta.document_type) {
        return res.status(400).json({ message: 'document_type is required.' });
      }

      const doc = await hrDocService.uploadPersonnelDocument(
        req.params.userId,
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        meta,
        req.user.user_id
      );

      res.status(201).json(doc);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// POST — manager sign-off on a document
router.post(
  '/documents/:documentId/sign-off',
  requireHrAccess,
  async (req, res) => {
    try {
      const { signature_password, sign_note } = req.body;
      if (!signature_password) {
        return res.status(400).json({ message: 'Digital signature (password) is required.' });
      }
      res.json(await hrDocService.managerSignOffDocument(
        req.params.documentId,
        req.user.user_id,
        signature_password,
        sign_note || null
      ));
    } catch (error) {
      if (error.message.includes('Invalid digital signature')) {
        return res.status(401).json({ message: error.message });
      }
      res.status(500).json({ message: error.message });
    }
  }
);

// GET — download a document file
router.get(
  '/documents/:documentId/download',
  requireHrAccess,
  async (req, res) => {
    try {
      const { fileBuffer, originalName, mimeType } =
        await hrDocService.downloadPersonnelDocument(
          req.params.documentId,
          req.user.user_id
        );
      res.setHeader('Content-Disposition', `attachment; filename="${originalName}"`);
      res.setHeader('Content-Type', mimeType || 'application/octet-stream');
      res.send(fileBuffer);
    } catch (error) {
      res.status(404).json({ message: error.message });
    }
  }
);

// GET — check gating status for a user
router.get(
  '/employees/:userId/gate-status/:category',
  requireHrAccess,
  async (req, res) => {
    try {
      const { category } = req.params;
      if (!['onboarding', 'probation'].includes(category)) {
        return res.status(400).json({ message: 'category must be onboarding or probation' });
      }
      res.json(await hrDocService.checkGatingDocuments(req.params.userId, category));
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

router.get('/probation-schedule', requireHrAccess, async (req, res) => {
  try {
    const { pool } = require('../services/auth-service');
    const result = await pool.query(
      `SELECT * FROM v_hr_probation_schedule ORDER BY start_date`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;