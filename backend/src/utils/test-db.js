// =============================================================================
// EduDrive — Database Connection Verification Script
// =============================================================================
// Esegui questo script con `npm run db:test` (o dalla root `npm run db:test`)
// per verificare istantaneamente la connessione al database locale o cloud
// (es. Neon.tech PostgreSQL Serverless).
// =============================================================================

import 'dotenv/config';
import pg from 'pg';

console.log('🔄 Tentativo di connessione al database in corso...\n');

if (!process.env.DATABASE_URL) {
  console.error('❌ ERRORE: Variabile DATABASE_URL non trovata nel file .env!');
  console.error('Assicurati di aver configurato correttamente backend/.env');
  process.exit(1);
}

const isCloudDB =
  process.env.NODE_ENV === 'production' ||
  process.env.DB_SSL === 'true' ||
  process.env.DATABASE_URL?.includes('neon.tech') ||
  process.env.DATABASE_URL?.includes('sslmode=require');

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ...(isCloudDB
    ? {
      ssl: {
        rejectUnauthorized: false,
      },
    }
    : {}),
});

try {
  const client = await pool.connect();
  const res = await client.query('SELECT version();');

  console.log('✅ Connessione al database completata con successo!');
  console.log(`📡 URL Configurato: ${process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@')}`);
  console.log(`🔐 Modalità SSL: ${isCloudDB ? 'Attiva (Cloud / Neon Ready)' : 'Disattivata (Locale)'}`);
  console.log(`🗄️  Versione Server DB: ${res.rows[0].version.split(',')[0]}`);
  console.log('\nPuoi ora avviare la sincronizzazione delle tabelle con: npm run db:push\n');

  client.release();
  await pool.end();
  process.exit(0);
} catch (error) {
  console.error('❌ Errore durante la connessione al database:');
  const errorMsg =
    error.errors?.map((e) => e.message || e.code).join(' | ') ||
    error.message ||
    error.toString();
  console.error(`   ${errorMsg}`);
  console.error('\nConsiglio per Neon.tech: assicurati di aver copiato la stringa con "?sslmode=require" o imposta DB_SSL=true nel .env');
  await pool.end();
  process.exit(1);
}
