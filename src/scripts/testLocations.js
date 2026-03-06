const sequelize = require('../config/database');
const Location = require('../models/Location');

async function testLocations() {
  try {
    await sequelize.sync();
    
    console.log('Testing Location model...');
    
    // Test basic queries
    const totalLocations = await Location.count();
    console.log(`Total locations: ${totalLocations}`);
    
    if (totalLocations === 0) {
      console.log('No locations found. Run "npm run populate-locations" first.');
      return;
    }
    
    // Test regions
    const regions = await Location.findAll({
      attributes: ['region'],
      group: ['region'],
      order: [['region', 'ASC']]
    });
    console.log(`Regions (${regions.length}):`, regions.map(r => r.region));
    
    // Test districts for first region
    if (regions.length > 0) {
      const firstRegion = regions[0].region;
      const districts = await Location.findAll({
        attributes: ['district'],
        where: { region: firstRegion },
        group: ['district'],
        order: [['district', 'ASC']]
      });
      console.log(`Districts in ${firstRegion} (${districts.length}):`, districts.slice(0, 5).map(d => d.district));
    }
    
    // Test search functionality
    const searchResults = await Location.findAll({
      where: {
        village: { [require('sequelize').Op.iLike]: '%BALAKA%' }
      },
      limit: 5
    });
    console.log(`Search results for 'BALAKA' (${searchResults.length}):`, 
      searchResults.map(r => `${r.village}, ${r.traditionalAuthority}, ${r.district}, ${r.region}`));
    
    console.log('Location model test completed successfully!');
    
  } catch (error) {
    console.error('Error testing locations:', error);
  } finally {
    await sequelize.close();
  }
}

if (require.main === module) {
  testLocations();
}

module.exports = testLocations;