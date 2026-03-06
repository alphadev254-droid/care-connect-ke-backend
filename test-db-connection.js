const mysql = require('mysql2/promise');

async function testConnection() {
  try {
    console.log('🔌 Testing MySQL connection...');
    console.log('Host: 91.108.121.232');
    console.log('Port: 3306');
    console.log('User: homecare_user2');
    console.log('Database: home_care_db');
    
    const connection = await mysql.createConnection({
      host: '91.108.121.232',
      port: 3306,
      user: 'homecare_user2',
      password: 'AnotherStrongPassword123!',
      database: 'home_care_db',
      connectTimeout: 10000
    });

    console.log('✅ Connection successful!');
    
    // Test query
    const [rows] = await connection.execute('SELECT 1 + 1 AS result');
    console.log('✅ Query test:', rows);
    
    await connection.end();
    console.log('✅ Connection closed');
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.error('Error code:', error.code);
    process.exit(1);
  }
}

testConnection();
