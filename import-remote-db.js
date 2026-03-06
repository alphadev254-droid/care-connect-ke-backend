const fs = require('fs');
const mysql = require('mysql2');

// Remote Database Configuration
const config = {
  host: 'database-1.cxsc2ycqaycg.eu-north-1.rds.amazonaws.com',
  port: 3306,
  user: 'admin',
  password: 'FsjgmkAHooHPLVyAMnwo',
  database: 'home_care_db',
  multipleStatements: true,
  connectTimeout: 30000, // 30 seconds
  authPlugins: {
    mysql_native_password: () => require('mysql2/lib/auth_plugins/mysql_native_password'),
    caching_sha2_password: () => require('mysql2/lib/auth_plugins/caching_sha2_password'),
    sha256_password: () => require('mysql2/lib/auth_plugins/sha256_password')
  }
};

const sqlFilePath = 'C:\\Users\\HP\\Downloads\\homecare_db (2).sql';

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  Remote Database Import Tool');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');
console.log('Remote Host:', config.host);
console.log('Database:', config.database);
console.log('User:', config.user);
console.log('Port:', config.port);
console.log('SQL File:', sqlFilePath);
console.log('');

// Check if file exists
if (!fs.existsSync(sqlFilePath)) {
  console.error('❌ Error: SQL file not found!');
  console.error('Path:', sqlFilePath);
  process.exit(1);
}

// Get file size
const stats = fs.statSync(sqlFilePath);
const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
console.log(`📦 File size: ${fileSizeInMB} MB`);
console.log('');

// Create connection
const connection = mysql.createConnection(config);

console.log('🔌 Connecting to remote MySQL server...');

connection.connect((err) => {
  if (err) {
    console.error('❌ Connection failed:', err.message);
    console.error('');
    console.error('💡 Common issues:');
    console.error('  - Incorrect remote host/IP address');
    console.error('  - Firewall blocking port 3306');
    console.error('  - MySQL not configured for remote connections');
    console.error('  - Wrong username or password');
    console.error('  - Database does not exist on remote server');
    console.error('');
    console.error('Full error:', err);
    process.exit(1);
  }

  console.log('✅ Connected to remote MySQL server');
  console.log('');
  console.log('📖 Reading SQL file...');

  // Read the SQL file
  const sql = fs.readFileSync(sqlFilePath, 'utf8');

  console.log('✅ SQL file loaded');
  console.log('');
  console.log('⚙️  Executing SQL statements...');
  console.log('   (This may take a while for large files)');
  console.log('');

  const startTime = Date.now();

  // Execute the SQL
  connection.query(sql, (error, results) => {
    if (error) {
      console.error('❌ Import failed:', error.message);
      console.error('');
      console.error('Error details:', error);
      connection.end();
      process.exit(1);
    }

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log('✅ Database imported successfully!');
    console.log(`⏱️  Time taken: ${duration} seconds`);
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  Import completed!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    connection.end();
  });
});
