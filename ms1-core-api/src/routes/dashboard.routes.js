const { Router } = require('express');
const dashboardService = require('../services/dashboard.service');
const sessionService = require('../services/session.service');
const { authenticate } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/role.middleware');

const router = Router();

router.get('/learner', authenticate, requireRole('learner'), async (req, res) => {
  try {
    const dashboard = await dashboardService.getLearnerDashboard(req.user.id);
    res.json(dashboard);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/admin', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const dashboard = await dashboardService.getAdminDashboard(req.user.id);
    res.json(dashboard);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/levels/trend/:dimension', authenticate, async (req, res) => {
  try {
    const validDimensions = ['pronunciation', 'vocabulary', 'grammar', 'overall'];
    if (!validDimensions.includes(req.params.dimension)) {
      return res.status(400).json({ error: 'Invalid dimension' });
    }
    const trend = await sessionService.getLevelTrend(req.user.id, req.params.dimension);
    res.json(trend);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const userRepository = require('../repositories/user.repository');

router.delete('/users/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    await userRepository.delete(req.params.id);
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
