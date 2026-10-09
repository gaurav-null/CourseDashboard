import pg from 'pg';
import { courseCatalog } from '../backend/src/data.js';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgresql://gradguide:localdev@localhost:5432/gradguide',
});

async function seed(): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query(`
      CREATE TABLE IF NOT EXISTS courses (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        university TEXT NOT NULL,
        country TEXT NOT NULL,
        fees_usd INTEGER NOT NULL CHECK (fees_usd >= 0),
        intake_months TEXT[] NOT NULL,
        min_gpa NUMERIC(2, 1) NOT NULL CHECK (min_gpa >= 0 AND min_gpa <= 4),
        degree_required TEXT NOT NULL CHECK (degree_required IN ('bachelor', 'master', 'phd')),
        field_of_study TEXT NOT NULL,
        rank INTEGER NOT NULL CHECK (rank > 0)
      )
    `);
    await client.query('TRUNCATE courses');

    for (const course of courseCatalog) {
      await client.query(
        `INSERT INTO courses
          (id, name, university, country, fees_usd, intake_months, min_gpa, degree_required, field_of_study, rank)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          course.id,
          course.name,
          course.university,
          course.country,
          course.feesUsd,
          course.intakeMonths,
          course.minGpa,
          course.degreeRequired,
          course.fieldOfStudy,
          course.rank,
        ],
      );
    }

    await client.query('COMMIT');
    console.log(JSON.stringify({ level: 'info', event: 'courses_seeded', count: courseCatalog.length }));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((error: unknown) => {
  console.error(JSON.stringify({ level: 'error', event: 'course_seed_failed', message: error instanceof Error ? error.message : 'Unknown error' }));
  process.exitCode = 1;
});
