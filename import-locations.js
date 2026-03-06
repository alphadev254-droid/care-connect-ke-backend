const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Database configuration
const dbConfig = {
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: 'brianndesa001',
  database: 'home_care_db'
};

// CSV file path
const csvFilePath = path.join(__dirname, 'LIST OF DISTRICTS & TAs.csv');

async function importLocations() {
  let connection;

  try {
    console.log('Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('Connected successfully!');

    // Read CSV file
    console.log('Reading CSV file...');
    const csvContent = fs.readFileSync(csvFilePath, 'utf-8');
    const lines = csvContent.split('\n');

    // Skip first empty line and header line (lines 0 and 1)
    const dataLines = lines.slice(2).filter(line => line.trim() !== '');

    console.log(`Found ${dataLines.length} records to import`);

    // Prepare batch insert
    const batchSize = 500;
    let inserted = 0;
    let skipped = 0;

    const insertQuery = `
      INSERT INTO locations (region, district, traditional_authority, village, createdAt, updatedAt)
      VALUES ?
    `;

    for (let i = 0; i < dataLines.length; i += batchSize) {
      const batch = dataLines.slice(i, i + batchSize);
      const values = [];

      for (const line of batch) {
        // Parse CSV line (handle commas in values)
        const columns = line.split(',');

        if (columns.length >= 4) {
          const region = columns[0]?.trim() || null;
          const district = columns[1]?.trim() || null;
          const ta = columns[2]?.trim() || null;
          const village = columns[3]?.trim() || null;

          // Skip if essential data is missing
          if (!region && !district && !ta && !village) {
            skipped++;
            continue;
          }

          const now = new Date();
          values.push([region, district, ta, village, now, now]);
        } else {
          skipped++;
        }
      }

      if (values.length > 0) {
        await connection.query(insertQuery, [values]);
        inserted += values.length;
        console.log(`Imported ${inserted} records...`);
      }
    }

    console.log('\n--- Import Complete ---');
    console.log(`Total records imported: ${inserted}`);
    console.log(`Records skipped: ${skipped}`);

  } catch (error) {
    console.error('Error during import:', error.message);

    if (error.code === 'ECONNREFUSED') {
      console.error('Could not connect to the database. Please check:');
      console.error('1. The database server is running');
      console.error('2. The IP address and port are correct');
      console.error('3. Firewall allows connections on port 3306');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('Access denied. Please check username and password.');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.error('Database does not exist. Please update the database name in dbConfig.');
    }

    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed.');
    }
  }
}

// Run the import
importLocations()
  .then(() => {
    console.log('Script completed successfully!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Script failed:', err.message);
    process.exit(1);
  });
