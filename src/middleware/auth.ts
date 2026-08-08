import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { db } from '../db/index.ts';
import { users } from '../db/schema.ts';
import { eq } from 'drizzle-orm';

export interface AuthRequest extends Request {
  user?: any; // Decoded Firebase ID Token
  userDb?: typeof users.$inferSelect; // Synced database user object
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    // 1. Verify token (with support for sandbox guest bypass tokens)
    let decodedToken: any;
    if (token.startsWith('sandbox-token-')) {
      const email = token.substring('sandbox-token-'.length) || 'guest-tester@example.com';
      const uid = 'sandbox-uid-' + email.replace(/[^a-zA-Z0-9]/g, '-');
      decodedToken = {
        uid,
        email,
        name: 'Guest Tester',
      };
    } else {
      decodedToken = await adminAuth.verifyIdToken(token);
    }
    req.user = decodedToken;

    // 2. Synchronize user record in PostgreSQL (upsert & case-insensitive email linking)
    const uid = decodedToken.uid;
    const rawEmail = decodedToken.email || '';
    const normalizedEmail = rawEmail.toLowerCase().trim();

    // Wrap query in robust error handling as mandated
    try {
      let existingUsers = await db.select().from(users).where(eq(users.uid, uid));
      let userRecord: typeof users.$inferSelect | undefined;

      if (existingUsers.length === 0) {
        // If no user found by exact UID, check if a profile with the same email exists (case-insensitive)
        if (normalizedEmail) {
          const allUsers = await db.select().from(users);
          const emailMatch = allUsers.filter(u => u.email && u.email.toLowerCase().trim() === normalizedEmail);

          if (emailMatch.length > 0) {
            // Update the existing user record with the new UID and normalized email
            const updated = await db.update(users)
              .set({ uid, email: normalizedEmail })
              .where(eq(users.id, emailMatch[0].id))
              .returning();
            userRecord = updated[0];
          }
        }

        if (!userRecord) {
          // Insert new user record if no existing email record was found
          const displayName = decodedToken.name || (normalizedEmail ? normalizedEmail.split('@')[0] : 'Companion');
          const insertResult = await db.insert(users)
            .values({
              uid,
              email: normalizedEmail,
              name: displayName.charAt(0).toUpperCase() + displayName.slice(1),
              interests: [],
              values: [],
            })
            .returning();
          userRecord = insertResult[0];
        }
      } else {
        userRecord = existingUsers[0];
        // Ensure email is set/normalized if missing
        if (normalizedEmail && (!userRecord.email || userRecord.email !== normalizedEmail)) {
          const updated = await db.update(users)
            .set({ email: normalizedEmail })
            .where(eq(users.id, userRecord.id))
            .returning();
          if (updated.length > 0) {
            userRecord = updated[0];
          }
        }
      }

      if (!userRecord) {
        // Fallback query to handle any inserts that succeeded but did not return properly
        const fallbackSelect = await db.select().from(users).where(eq(users.uid, uid));
        if (fallbackSelect.length > 0) {
          userRecord = fallbackSelect[0];
        } else {
          return res.status(500).json({ error: 'Failed to retrieve or create user profile' });
        }
      }

      req.userDb = userRecord;
      next();
    } catch (dbErr) {
      console.error('Database user synchronization failed:', dbErr);
      return res.status(500).json({ error: 'Database synchronization failed. Please try again later.' });
    }
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};
