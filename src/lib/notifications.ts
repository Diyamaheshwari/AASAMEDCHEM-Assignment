import { query } from './db';

interface NotificationPayload {
  userId: string;
  title: string;
  message: string;
  type: string;
  link?: string;
}

/**
 * Creates a notification for a specific user.
 */
export async function createNotification({
  userId,
  title,
  message,
  type,
  link
}: NotificationPayload) {
  try {
    await query(
      `INSERT INTO notifications (user_id, title, message, type, link)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, title, message, type, link || null]
    );
  } catch (error) {
    console.error('Failed to create notification:', error);
  }
}

/**
 * Broadcasts a notification to all Admin users.
 */
export async function notifyAllAdmins({
  title,
  message,
  type,
  link
}: Omit<NotificationPayload, 'userId'>) {
  try {
    const adminsRes = await query("SELECT id FROM users WHERE role = 'admin'");
    const promises = adminsRes.rows.map((admin) =>
      createNotification({
        userId: admin.id,
        title,
        message,
        type,
        link,
      })
    );
    await Promise.all(promises);
  } catch (error) {
    console.error('Failed to notify admins:', error);
  }
}

/**
 * Broadcasts a notification to all Staff members (Admins and Sellers).
 */
export async function notifyAllStaff({
  title,
  message,
  type,
  link
}: Omit<NotificationPayload, 'userId'>) {
  try {
    const staffRes = await query("SELECT id FROM users WHERE role IN ('admin', 'seller')");
    const promises = staffRes.rows.map((staff) =>
      createNotification({
        userId: staff.id,
        title,
        message,
        type,
        link,
      })
    );
    await Promise.all(promises);
  } catch (error) {
    console.error('Failed to notify staff:', error);
  }
}
