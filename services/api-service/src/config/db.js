import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    statement_timeout: 5000,
});

export async function connectDB() {
    await pool.query('SELECT 1');
    console.log('Database connected');
}
  
export { pool };
  
