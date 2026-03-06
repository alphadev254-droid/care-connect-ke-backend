const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');
const sequelize = require('../config/database');
const Location = require('../models/Location');

async function populateLocations() {
  try {
    // Sync the database
    await sequelize.sync();
    
    console.log('Starting to populate locations...');
    
    const csvFilePath = path.join(__dirname, '../../LIST OF DISTRICTS & TAs.csv');
    console.log(`Looking for CSV file at: ${csvFilePath}`);
    
    // Check if file exists
    if (!fs.existsSync(csvFilePath)) {
      console.error(`CSV file not found at: ${csvFilePath}`);
      console.log('Current directory:', __dirname);
      console.log('Files in parent directory:', fs.readdirSync(path.join(__dirname, '../..')));
      throw new Error(`CSV file not found at: ${csvFilePath}`);
    }
    
    console.log(`Reading CSV file from: ${csvFilePath}`);
    const locations = [];
    
    return new Promise((resolve, reject) => {
      let rowCount = 0;
      fs.createReadStream(csvFilePath)
        .pipe(csv({ headers: ['empty', 'Region', 'District', 'TA', 'Village'] }))
        .on('data', (row) => {
          rowCount++;
          if (rowCount <= 5) console.log(`Row ${rowCount}:`, row); // Debug first 5 rows
          
          // Skip empty rows and header row
          if (row.empty && row.Region && row.District && row.TA && 
              row.empty !== 'Region' && row.empty.trim() !== '') {
            locations.push({
              region: row.empty.trim(),
              district: row.Region.trim(),
              traditionalAuthority: row.District.trim(),
              village: row.TA.trim()
            });
          }
        })
        .on('end', async () => {
          try {
            console.log(`Processing ${locations.length} location records...`);
            
            // Clear existing data
            await Location.destroy({ where: {} });
            console.log('Cleared existing location data');
            
            // Insert in batches to avoid memory issues
            const batchSize = 1000;
            for (let i = 0; i < locations.length; i += batchSize) {
              const batch = locations.slice(i, i + batchSize);
              await Location.bulkCreate(batch, { 
                ignoreDuplicates: true,
                validate: true 
              });
              console.log(`Inserted batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(locations.length/batchSize)}`);
            }
            
            console.log(`Successfully populated ${locations.length} location records`);
            
            // Show summary statistics
            const regionCount = await Location.count({
              distinct: true,
              col: 'region'
            });
            const districtCount = await Location.count({
              distinct: true,
              col: 'district'
            });
            const taCount = await Location.count({
              distinct: true,
              col: 'traditionalAuthority'
            });
            
            console.log(`Summary:`);
            console.log(`- Regions: ${regionCount}`);
            console.log(`- Districts: ${districtCount}`);
            console.log(`- Traditional Authorities: ${taCount}`);
            console.log(`- Villages: ${locations.length}`);
            
            resolve();
          } catch (error) {
            console.error('Error inserting data:', error);
            reject(error);
          }
        })
        .on('error', (error) => {
          console.error('Error reading CSV file:', error);
          reject(error);
        });
    });
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Run the script if called directly
if (require.main === module) {
  populateLocations()
    .then(() => {
      console.log('Location population completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed to populate locations:', error);
      process.exit(1);
    });
}

module.exports = populateLocations;