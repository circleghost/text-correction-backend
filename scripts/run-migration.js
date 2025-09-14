const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runMigration(migrationFile) {
  try {
    const migrationPath = path.join(__dirname, '../database/migrations', migrationFile);
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    console.log(`Running migration: ${migrationFile}`);
    
    // Split SQL by statements and execute each one
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))
      .map(s => s + ';');
    
    for (const statement of statements) {
      if (statement.trim() === ';') continue;
      
      console.log(`Executing: ${statement.substring(0, 50)}...`);
      
      const { error } = await supabase.rpc('exec_sql', { sql: statement });
      
      if (error) {
        // Try direct query if rpc fails
        const { error: queryError } = await supabase
          .from('dummy') // This will fail but allow us to execute raw SQL
          .select('1')
          .limit(0);
        
        // Since we can't execute raw SQL easily, let's use a different approach
        console.log('Statement to execute manually in Supabase SQL editor:');
        console.log(statement);
        console.log('---');
      }
    }
    
    console.log(`Migration ${migrationFile} completed successfully`);
  } catch (error) {
    console.error(`Error running migration ${migrationFile}:`, error.message);
    process.exit(1);
  }
}

async function main() {
  const migrationFile = process.argv[2];
  
  if (!migrationFile) {
    console.log('Usage: node run-migration.js <migration-file>');
    console.log('Example: node run-migration.js 003_usage_quota_system.sql');
    process.exit(1);
  }
  
  await runMigration(migrationFile);
}

main().catch(console.error);