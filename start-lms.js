// Start script to run the LMS server
// This script checks for dependencies and starts the appropriate server

const fs = require('fs');
const { exec } = require('child_process');

console.log('🔍 Checking LMS setup...\n');

// Check if better-sqlite3 is available
let useSqlite = false;
try {
    require.resolve('better-sqlite3');
    useSqlite = true;
    console.log('✅ SQLite available - using persistent database');
} catch (e) {
    console.log('⚠️  SQLite not available - using in-memory database');
    console.log('   (Data will reset when server restarts)\n');
}

// Start the appropriate server
const serverFile = useSqlite ? 'server.js' : 'server-simple.js';

if (!fs.existsSync(serverFile)) {
    console.log(`❌ Server file not found: ${serverFile}`);
    console.log('   Creating simplified server...\n');

    // If server-simple doesn't exist, direct user to use what we have
    console.log('Please run: node server-memory.js');
    process.exit(1);
}

console.log(`🚀 Starting LMS Server...\n`);
exec(`node ${serverFile}`, (error, stdout, stderr) => {
    if (error) {
        console.error(`❌ Error: ${error.message}`);
        return;
    }
    if (stderr) {
        console.error(`stderr: ${stderr}`);
        return;
    }
    console.log(stdout);
});
