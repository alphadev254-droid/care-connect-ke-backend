const express = require('express');
const { Op } = require('sequelize');
const Location = require('../models/Location');
const { Caregiver, User } = require('../models');
const { authenticateToken } = require('../middleware/auth.middleware');

const router = express.Router();

// Get all locations (for admin filters)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const locations = await Location.findAll({
      attributes: ['id', 'region', 'district', 'traditionalAuthority'],
      group: ['region', 'district', 'traditionalAuthority', 'id'],
      order: [['region', 'ASC'], ['district', 'ASC']]
    });
    
    res.json({
      success: true,
      locations
    });
  } catch (error) {
    console.error('Error fetching locations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch locations'
    });
  }
});

// Get all regions
router.get('/regions', async (req, res) => {
  try {
    const regions = await Location.findAll({
      attributes: ['region'],
      group: ['region'],
      order: [['region', 'ASC']]
    });
    
    res.json({
      success: true,
      data: regions.map(r => r.region)
    });
  } catch (error) {
    console.error('Error fetching regions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch regions'
    });
  }
});

// Get districts by region
router.get('/districts/:region', async (req, res) => {
  try {
    const { region } = req.params;
    
    const districts = await Location.findAll({
      attributes: ['district'],
      where: { region },
      group: ['district'],
      order: [['district', 'ASC']]
    });
    
    res.json({
      success: true,
      data: districts.map(d => d.district)
    });
  } catch (error) {
    console.error('Error fetching districts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch districts'
    });
  }
});

// Get traditional authorities by district
router.get('/traditional-authorities/:region/:district', async (req, res) => {
  try {
    const { region, district } = req.params;
    
    const tas = await Location.findAll({
      attributes: ['traditionalAuthority'],
      where: { region, district },
      group: ['traditionalAuthority'],
      order: [['traditionalAuthority', 'ASC']]
    });
    
    res.json({
      success: true,
      data: tas.map(ta => ta.traditionalAuthority)
    });
  } catch (error) {
    console.error('Error fetching traditional authorities:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch traditional authorities'
    });
  }
});

// Get villages by traditional authority
router.get('/villages/:region/:district/:ta', async (req, res) => {
  try {
    const { region, district, ta } = req.params;
    
    const villages = await Location.findAll({
      attributes: ['village'],
      where: { 
        region, 
        district, 
        traditionalAuthority: ta 
      },
      order: [['village', 'ASC']]
    });
    
    res.json({
      success: true,
      data: villages.map(v => v.village)
    });
  } catch (error) {
    console.error('Error fetching villages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch villages'
    });
  }
});

// Search locations
router.get('/search', async (req, res) => {
  try {
    const { q, type = 'all' } = req.query;
    
    if (!q || q.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters long'
      });
    }
    
    const searchCondition = {
      [Op.or]: []
    };
    
    if (type === 'all' || type === 'region') {
      searchCondition[Op.or].push({
        region: { [Op.iLike]: `%${q}%` }
      });
    }
    
    if (type === 'all' || type === 'district') {
      searchCondition[Op.or].push({
        district: { [Op.iLike]: `%${q}%` }
      });
    }
    
    if (type === 'all' || type === 'ta') {
      searchCondition[Op.or].push({
        traditionalAuthority: { [Op.iLike]: `%${q}%` }
      });
    }
    
    if (type === 'all' || type === 'village') {
      searchCondition[Op.or].push({
        village: { [Op.iLike]: `%${q}%` }
      });
    }
    
    const locations = await Location.findAll({
      where: searchCondition,
      limit: 50,
      order: [['region', 'ASC'], ['district', 'ASC'], ['traditionalAuthority', 'ASC'], ['village', 'ASC']]
    });
    
    res.json({
      success: true,
      data: locations
    });
  } catch (error) {
    console.error('Error searching locations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search locations'
    });
  }
});

// Get location hierarchy (for dropdowns)
router.get('/hierarchy', async (req, res) => {
  try {
    const locations = await Location.findAll({
      attributes: ['region', 'district', 'traditionalAuthority'],
      group: ['region', 'district', 'traditionalAuthority'],
      order: [['region', 'ASC'], ['district', 'ASC'], ['traditionalAuthority', 'ASC']]
    });
    
    // Build hierarchical structure
    const hierarchy = {};
    
    locations.forEach(location => {
      const { region, district, traditionalAuthority } = location;
      
      if (!hierarchy[region]) {
        hierarchy[region] = {};
      }
      
      if (!hierarchy[region][district]) {
        hierarchy[region][district] = [];
      }
      
      if (!hierarchy[region][district].includes(traditionalAuthority)) {
        hierarchy[region][district].push(traditionalAuthority);
      }
    });
    
    res.json({
      success: true,
      data: hierarchy
    });
  } catch (error) {
    console.error('Error fetching location hierarchy:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch location hierarchy'
    });
  }
});

module.exports = router;

// Get unique districts for admin filters
router.get('/districts', authenticateToken, async (req, res) => {
  try {
    const districts = await Location.findAll({
      attributes: ['district', 'region'],
      group: ['district', 'region'],
      order: [['region', 'ASC'], ['district', 'ASC']]
    });
    
    res.json({
      success: true,
      districts
    });
  } catch (error) {
    console.error('Error fetching districts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch districts'
    });
  }
});

// Get unique traditional authorities for admin filters
router.get('/traditional-authorities', authenticateToken, async (req, res) => {
  try {
    const tas = await Location.findAll({
      attributes: ['traditionalAuthority', 'district', 'region'],
      group: ['traditionalAuthority', 'district', 'region'],
      order: [['region', 'ASC'], ['district', 'ASC'], ['traditionalAuthority', 'ASC']]
    });
    
    res.json({
      success: true,
      traditionalAuthorities: tas
    });
  } catch (error) {
    console.error('Error fetching traditional authorities:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch traditional authorities'
    });
  }
});

// Get unique villages for admin filters
router.get('/villages', authenticateToken, async (req, res) => {
  try {
    const villages = await Location.findAll({
      attributes: ['village', 'traditionalAuthority', 'district', 'region'],
      group: ['village', 'traditionalAuthority', 'district', 'region'],
      order: [['region', 'ASC'], ['district', 'ASC'], ['traditionalAuthority', 'ASC'], ['village', 'ASC']]
    });
    
    res.json({
      success: true,
      villages
    });
  } catch (error) {
    console.error('Error fetching villages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch villages'
    });
  }
});