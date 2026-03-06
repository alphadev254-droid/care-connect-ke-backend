const express = require('express');
const {
  getSpecialties,
  getSpecialtyById,
  createSpecialty,
  updateSpecialty,
  deleteSpecialty,
  restoreSpecialty,
  updateSpecialtyFees
} = require('../controllers/specialtyController');
const { authenticateToken } = require('../middleware/auth.middleware');
const { requireAdmin } = require('../middleware/roleCheck.middleware');
const { requirePermission } = require('../middleware/permissions');

const router = express.Router();

// Public routes
router.get('/', getSpecialties);
router.get('/:id', getSpecialtyById);

// Admin only routes with permissions
router.post('/', authenticateToken, requirePermission('create_specialties'), createSpecialty);
router.put('/:id', authenticateToken, requirePermission('edit_specialties'), updateSpecialty);
router.delete('/:id', authenticateToken, requirePermission('delete_specialties'), deleteSpecialty);
router.patch('/:id/restore', authenticateToken, requirePermission('edit_specialties'), restoreSpecialty);
router.patch('/:id/fees', authenticateToken, requirePermission('edit_specialties'), updateSpecialtyFees);

module.exports = router;