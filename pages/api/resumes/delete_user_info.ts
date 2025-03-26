import { PoolClient } from 'pg';

export async function deleteUserInfo(user_id: number, client: PoolClient): Promise<void> {
  try {
    // Delete from all user-related tables except users.resume
    await client.query('DELETE FROM users.user_info WHERE user_id = $1', [user_id]);
    await client.query('DELETE FROM users.summary WHERE user_id = $1', [user_id]);
    await client.query('DELETE FROM users.projects WHERE user_id = $1', [user_id]);
    await client.query('DELETE FROM users.experience WHERE user_id = $1', [user_id]);
    await client.query('DELETE FROM users.education WHERE user_id = $1', [user_id]);
    await client.query('DELETE FROM users.skills_link WHERE user_id = $1', [user_id]);
    // Note: We don’t delete from users.skills or public tables (locations, companies, schools) as they’re shared
  } catch (err) {
    console.error('Error deleting user info:', err);
    throw err;
  }
}