import { neon } from '@netlify/neon';
import { Project } from '../types';

// The sql tag function is configured automatically with the
// `NETLIFY_DATABASE_URL` environment variable provided by Netlify.
const sql = neon();

const TABLE_NAME = 'scheduler_projects';

/**
 * Initializes the database by creating the necessary tables if they don't exist.
 * This function is idempotent.
 */
export const initDb = async () => {
  // We store the entire project object as a single JSONB column.
  // This simplifies data handling by matching the application's state structure,
  // avoiding complex joins and migrations for nested objects like tasks or units.
  await sql`
    CREATE TABLE IF NOT EXISTS ${sql(TABLE_NAME)} (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL
    );
  `;
};

/**
 * Fetches all projects from the database.
 * @returns A promise that resolves to an array of Project objects.
 */
export const getAllProjects = async (): Promise<Project[]> => {
  const result = await sql`SELECT data FROM ${sql(TABLE_NAME)}`;
  // The 'data' column contains the JSON representation of our Project object.
  return result.map((row: any) => row.data as Project);
};

/**
 * Saves a project to the database.
 * If a project with the same ID exists, it will be updated (upsert).
 * @param project The project object to save.
 */
export const saveProject = async (project: Project): Promise<void> => {
  // The project object must be stringified before being inserted into a JSONB column.
  const data = JSON.stringify(project);
  await sql`
    INSERT INTO ${sql(TABLE_NAME)} (id, data)
    VALUES (${project.id}, ${data})
    ON CONFLICT (id) DO UPDATE
    SET data = EXCLUDED.data;
  `;
};

/**
 * Deletes a project from the database using its ID.
 * @param projectId The ID of the project to delete.
 */
export const deleteProject = async (projectId: string): Promise<void> => {
  await sql`DELETE FROM ${sql(TABLE_NAME)} WHERE id = ${projectId}`;
};
