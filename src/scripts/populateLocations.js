require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const xlsx = require('xlsx');
const path = require('path');
const { sequelize } = require('../models');
const Location = require('../models/Location');

async function populateLocations() {
  try {
    const xlsxPath = path.join(__dirname, '../../xlsx-Kenya-Counties-Constituencies-Wards.xlsx');
    console.log(`Reading: ${xlsxPath}`);

    const workbook = xlsx.readFile(xlsxPath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    // Skip header row (row 0)
    const locations = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const county       = (row[1] || '').toString().trim();
      const constituency = (row[3] || '').toString().trim();
      const ward         = (row[5] || '').toString().trim();

      if (!county || !constituency || !ward) continue;

      locations.push({
        region: county,               // County = Region
        district: constituency,       // Constituency = District
        traditionalAuthority: ward,   // Ward = Traditional Authority
        village: ward                 // No 4th level — use ward as village
      });
    }

    console.log(`Parsed ${locations.length} location records`);

    // Ensure table exists
    await Location.sync({ force: false });

    // Clear and re-import
    await Location.destroy({ where: {} });
    console.log('Cleared existing location data');

    const batchSize = 500;
    for (let i = 0; i < locations.length; i += batchSize) {
      await Location.bulkCreate(locations.slice(i, i + batchSize), { ignoreDuplicates: true });
      console.log(`Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(locations.length / batchSize)}`);
    }

    const regionCount = await Location.count({ distinct: true, col: 'region' });
    const districtCount = await Location.count({ distinct: true, col: 'district' });
    const wardCount = await Location.count({ distinct: true, col: 'traditionalAuthority' });

    console.log(`\nSummary:`);
    console.log(`  Counties  (regions):        ${regionCount}`);
    console.log(`  Constituencies (districts): ${districtCount}`);
    console.log(`  Wards (TAs):                ${wardCount}`);
    console.log(`  Total rows:                 ${locations.length}`);

  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

if (require.main === module) {
  populateLocations()
    .then(() => {
      console.log('\nLocation population completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed:', error);
      process.exit(1);
    });
}

module.exports = populateLocations;
