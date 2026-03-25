const express = require('express');
const { authenticateToken } = require('../middleware/auth.middleware');
const { getBanks, getMySubaccount, saveSubaccount, getBalance, getSettlements, syncMySettlements } = require('../controllers/subaccountController');

const router = express.Router();
router.use(authenticateToken);

router.get('/banks', getBanks);
router.get('/subaccount', getMySubaccount);
router.post('/subaccount', saveSubaccount);
router.get('/balance', getBalance);
router.get('/settlements', getSettlements);
router.post('/sync', syncMySettlements);

module.exports = router;
