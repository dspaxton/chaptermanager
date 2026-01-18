import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import { pool } from '../index';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export function configurePassport() {
  // Google OAuth Strategy
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL: `${process.env.APP_URL}/api/auth/google/callback`,
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            const email = profile.emails?.[0]?.value;
            if (!email) {
              return done(new Error('No email provided by Google'));
            }

            // Check if OAuth link exists
            const oauthResult = await pool.query(
              'SELECT user_id FROM user_oauth WHERE provider = $1 AND provider_id = $2',
              ['google', profile.id]
            );

            let userId: string;

            if (oauthResult.rows.length > 0) {
              // Existing OAuth user
              userId = oauthResult.rows[0].user_id;

              // Update tokens
              await pool.query(
                `UPDATE user_oauth
                 SET access_token = $1, refresh_token = $2
                 WHERE provider = 'google' AND provider_id = $3`,
                [accessToken, refreshToken, profile.id]
              );
            } else {
              // Check if user exists with this email
              const userResult = await pool.query(
                'SELECT id FROM users WHERE email = $1',
                [email]
              );

              if (userResult.rows.length > 0) {
                // Link OAuth to existing user
                userId = userResult.rows[0].id;
              } else {
                // Create new user
                userId = uuidv4();
                await pool.query(
                  `INSERT INTO users (id, email, role, is_active, is_verified)
                   VALUES ($1, $2, 'member', true, true)`,
                  [userId, email]
                );

                // Create member profile
                const memberId = uuidv4();
                await pool.query(
                  `INSERT INTO members (id, user_id, first_name, last_name, status, chapter_join_date)
                   VALUES ($1, $2, $3, $4, 'prospect', CURRENT_DATE)`,
                  [memberId, userId, profile.name?.givenName || '', profile.name?.familyName || '']
                );
              }

              // Create OAuth link
              await pool.query(
                `INSERT INTO user_oauth (user_id, provider, provider_id, access_token, refresh_token)
                 VALUES ($1, 'google', $2, $3, $4)`,
                [userId, profile.id, accessToken, refreshToken]
              );
            }

            // Get full user data
            const user = await pool.query(
              `SELECT u.id, u.email, u.role, m.id as member_id
               FROM users u
               LEFT JOIN members m ON m.user_id = u.id
               WHERE u.id = $1`,
              [userId]
            );

            done(null, user.rows[0]);
          } catch (error) {
            logger.error('Google OAuth error:', error);
            done(error as Error);
          }
        }
      )
    );

    logger.info('Google OAuth strategy configured');
  }

  // Facebook OAuth Strategy
  if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
    passport.use(
      new FacebookStrategy(
        {
          clientID: process.env.FACEBOOK_APP_ID,
          clientSecret: process.env.FACEBOOK_APP_SECRET,
          callbackURL: `${process.env.APP_URL}/api/auth/facebook/callback`,
          profileFields: ['id', 'emails', 'name'],
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            const email = profile.emails?.[0]?.value;
            if (!email) {
              return done(new Error('No email provided by Facebook'));
            }

            // Similar logic to Google OAuth
            const oauthResult = await pool.query(
              'SELECT user_id FROM user_oauth WHERE provider = $1 AND provider_id = $2',
              ['facebook', profile.id]
            );

            let userId: string;

            if (oauthResult.rows.length > 0) {
              userId = oauthResult.rows[0].user_id;

              await pool.query(
                `UPDATE user_oauth
                 SET access_token = $1, refresh_token = $2
                 WHERE provider = 'facebook' AND provider_id = $3`,
                [accessToken, refreshToken, profile.id]
              );
            } else {
              const userResult = await pool.query(
                'SELECT id FROM users WHERE email = $1',
                [email]
              );

              if (userResult.rows.length > 0) {
                userId = userResult.rows[0].id;
              } else {
                userId = uuidv4();
                await pool.query(
                  `INSERT INTO users (id, email, role, is_active, is_verified)
                   VALUES ($1, $2, 'member', true, true)`,
                  [userId, email]
                );

                const memberId = uuidv4();
                await pool.query(
                  `INSERT INTO members (id, user_id, first_name, last_name, status, chapter_join_date)
                   VALUES ($1, $2, $3, $4, 'prospect', CURRENT_DATE)`,
                  [memberId, userId, profile.name?.givenName || '', profile.name?.familyName || '']
                );
              }

              await pool.query(
                `INSERT INTO user_oauth (user_id, provider, provider_id, access_token, refresh_token)
                 VALUES ($1, 'facebook', $2, $3, $4)`,
                [userId, profile.id, accessToken, refreshToken]
              );
            }

            const user = await pool.query(
              `SELECT u.id, u.email, u.role, m.id as member_id
               FROM users u
               LEFT JOIN members m ON m.user_id = u.id
               WHERE u.id = $1`,
              [userId]
            );

            done(null, user.rows[0]);
          } catch (error) {
            logger.error('Facebook OAuth error:', error);
            done(error as Error);
          }
        }
      )
    );

    logger.info('Facebook OAuth strategy configured');
  }
}
