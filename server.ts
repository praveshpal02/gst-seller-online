import express from "express";
import path from "path";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import { createServer as createViteServer } from "vite";
import { pool, initDatabaseSchema } from "./src/server/db.js";

interface AuthUser {
  id: string;
  email: string;
  name: string;
  businessName: string;
  isLoggedIn: boolean;
}

// Helper: Extract authenticated user from session cookie
async function getAuthUser(req: express.Request): Promise<AuthUser | null> {
  try {
    const sessionId = req.cookies?.session_id || (req.headers['x-session-id'] as string);
    if (!sessionId) return null;

    const res = await pool.query(
      `SELECT u.id, u.email, u.name, u.business_name
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.id = $1 AND s.expires_at > CURRENT_TIMESTAMP`,
      [sessionId]
    );

    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      businessName: row.business_name || '',
      isLoggedIn: true
    };
  } catch (err) {
    console.error('getAuthUser error:', err);
    return null;
  }
}

async function startServer() {
  // Initialize database schema
  try {
    await initDatabaseSchema();
  } catch (e) {
    console.error('Failed database schema initialization:', e);
  }

  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(cookieParser());

  // Health check endpoint
  app.get("/api/health", async (req, res) => {
    try {
      const dbCheck = await pool.query('SELECT 1');
      res.json({ status: "ok", service: "GST Online Seller API", database: "connected" });
    } catch (e: any) {
      res.json({ status: "ok", service: "GST Online Seller API", database: "error", error: e.message });
    }
  });

  // =======================================
  // AUTHENTICATION ROUTES
  // =======================================

  // REGISTER
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password, name, businessName } = req.body;

      if (!email || !password || !name) {
        return res.status(400).json({ success: false, message: "Email, password, and name are required." });
      }

      const cleanEmail = email.trim().toLowerCase();
      if (password.length < 6) {
        return res.status(400).json({ success: false, message: "Password must be at least 6 characters long." });
      }

      // Check existing
      const existing = await pool.query("SELECT id FROM users WHERE email = $1", [cleanEmail]);
      if (existing.rows.length > 0) {
        return res.status(400).json({ success: false, message: "An account with this email address already exists." });
      }

      const userId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const passwordHash = await bcrypt.hash(password, 10);

      await pool.query(
        `INSERT INTO users (id, email, password_hash, name, business_name)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, cleanEmail, passwordHash, name.trim(), businessName?.trim() || '']
      );

      // Create session (30 days)
      const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      await pool.query(
        `INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)`,
        [sessionId, userId, expiresAt]
      );

      res.cookie('session_id', sessionId, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000,
        secure: process.env.NODE_ENV === 'production'
      });

      const user: AuthUser = {
        id: userId,
        email: cleanEmail,
        name: name.trim(),
        businessName: businessName?.trim() || '',
        isLoggedIn: true
      };

      return res.json({ success: true, user, sessionId });
    } catch (err: any) {
      console.error('Registration error:', err);
      return res.status(500).json({ success: false, message: err.message || 'Server error during registration.' });
    }
  });

  // LOGIN
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ success: false, message: "Email and password are required." });
      }

      const cleanEmail = email.trim().toLowerCase();
      const userRes = await pool.query("SELECT * FROM users WHERE email = $1", [cleanEmail]);

      if (userRes.rows.length === 0) {
        return res.status(401).json({ success: false, message: "Invalid email or password." });
      }

      const dbUser = userRes.rows[0];
      const match = await bcrypt.compare(password, dbUser.password_hash);
      if (!match) {
        return res.status(401).json({ success: false, message: "Invalid email or password." });
      }

      // Create new session
      const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      await pool.query(
        `INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)`,
        [sessionId, dbUser.id, expiresAt]
      );

      res.cookie('session_id', sessionId, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000,
        secure: process.env.NODE_ENV === 'production'
      });

      const user: AuthUser = {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        businessName: dbUser.business_name || '',
        isLoggedIn: true
      };

      return res.json({ success: true, user, sessionId });
    } catch (err: any) {
      console.error('Login error:', err);
      return res.status(500).json({ success: false, message: err.message || 'Server error during login.' });
    }
  });

  // LOGOUT
  app.post("/api/auth/logout", async (req, res) => {
    try {
      const sessionId = req.cookies?.session_id || req.headers['x-session-id'];
      if (sessionId) {
        await pool.query("DELETE FROM sessions WHERE id = $1", [sessionId]);
      }
      res.clearCookie('session_id');
      return res.json({ success: true, message: "Logged out successfully." });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // ME
  app.get("/api/auth/me", async (req, res) => {
    try {
      const user = await getAuthUser(req);
      if (!user) {
        return res.status(401).json({ success: false, user: null });
      }
      return res.json({ success: true, user });
    } catch (err: any) {
      return res.status(500).json({ success: false, user: null, error: err.message });
    }
  });

  // =======================================
  // SELLER PROFILES ROUTES
  // =======================================

  app.get("/api/profiles", async (req, res) => {
    try {
      const user = await getAuthUser(req);
      if (!user) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      const profilesRes = await pool.query(
        `SELECT id, gstin, trade_name as "tradeName", party_name as "partyName",
                return_type as "returnType", period_month as "periodMonth",
                period_year as "periodYear", is_active as "isActive",
                added_date as "addedDate", last_used_date as "lastUsedDate",
                state_code as "stateCode", state_name as "stateName"
         FROM seller_profiles
         WHERE user_id = $1
         ORDER BY updated_at DESC`,
        [user.id]
      );

      return res.json({ success: true, profiles: profilesRes.rows });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post("/api/profiles", async (req, res) => {
    try {
      const user = await getAuthUser(req);
      if (!user) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      const { profile } = req.body;
      if (!profile || !profile.gstin || !profile.tradeName) {
        return res.status(400).json({ success: false, message: "Missing required profile fields." });
      }

      const profileId = profile.id || `gstin_${Date.now()}`;

      // If set active, set other profiles for this user to inactive
      if (profile.isActive) {
        await pool.query(
          `UPDATE seller_profiles SET is_active = false WHERE user_id = $1`,
          [user.id]
        );
      }

      await pool.query(
        `INSERT INTO seller_profiles (
          id, user_id, gstin, trade_name, party_name, return_type, period_month,
          period_year, is_active, state_code, state_name, added_date, last_used_date, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO UPDATE SET
          gstin = EXCLUDED.gstin,
          trade_name = EXCLUDED.trade_name,
          party_name = EXCLUDED.party_name,
          return_type = EXCLUDED.return_type,
          period_month = EXCLUDED.period_month,
          period_year = EXCLUDED.period_year,
          is_active = EXCLUDED.is_active,
          state_code = EXCLUDED.state_code,
          state_name = EXCLUDED.state_name,
          last_used_date = EXCLUDED.last_used_date,
          updated_at = CURRENT_TIMESTAMP`,
        [
          profileId,
          user.id,
          profile.gstin,
          profile.tradeName,
          profile.partyName || null,
          profile.returnType || 'Monthly',
          profile.periodMonth,
          profile.periodYear,
          !!profile.isActive,
          profile.stateCode || null,
          profile.stateName || null,
          profile.addedDate || new Date().toLocaleDateString('en-GB').replace(/\//g, '-'),
          profile.lastUsedDate || new Date().toLocaleDateString('en-GB').replace(/\//g, '-')
        ]
      );

      return res.json({ success: true, message: "Profile saved successfully.", profileId });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  app.delete("/api/profiles/:id", async (req, res) => {
    try {
      const user = await getAuthUser(req);
      if (!user) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      const { id } = req.params;
      await pool.query(`DELETE FROM seller_profiles WHERE id = $1 AND user_id = $2`, [id, user.id]);
      return res.json({ success: true, message: "Profile deleted." });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // =======================================
  // TRANSACTIONS ROUTES
  // =======================================

  app.get("/api/transactions", async (req, res) => {
    try {
      const user = await getAuthUser(req);
      if (!user) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      const { gstin, periodMonth, periodYear } = req.query;
      if (!gstin || !periodMonth || !periodYear) {
        return res.status(400).json({ success: false, message: "Missing required query parameters." });
      }

      const txRes = await pool.query(
        `SELECT data FROM meesho_transactions
         WHERE user_id = $1 AND gstin = $2 AND LOWER(period_month) = LOWER($3) AND LOWER(period_year) = LOWER($4)
         ORDER BY created_at ASC`,
        [user.id, String(gstin), String(periodMonth), String(periodYear)]
      );

      const transactions = txRes.rows.map(row => row.data);
      return res.json({ success: true, transactions });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post("/api/transactions", async (req, res) => {
    try {
      const user = await getAuthUser(req);
      if (!user) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      const { gstin, periodMonth, periodYear, marketplace = 'MEESHO', transactions, overwrite } = req.body;

      if (!gstin || !periodMonth || !periodYear || !Array.isArray(transactions)) {
        return res.status(400).json({ success: false, message: "Missing required transaction fields." });
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        if (overwrite) {
          await client.query(
            `DELETE FROM meesho_transactions
             WHERE user_id = $1 AND gstin = $2 AND LOWER(period_month) = LOWER($3) AND LOWER(period_year) = LOWER($4)`,
            [user.id, String(gstin), String(periodMonth), String(periodYear)]
          );
        }

        for (const tx of transactions) {
          const txId = tx.id || `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          await client.query(
            `INSERT INTO meesho_transactions (id, user_id, gstin, period_month, period_year, marketplace, data)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, user_id = EXCLUDED.user_id, gstin = EXCLUDED.gstin, period_month = EXCLUDED.period_month, period_year = EXCLUDED.period_year`,
            [txId, user.id, String(gstin), String(periodMonth), String(periodYear), String(marketplace), JSON.stringify(tx)]
          );
        }

        await client.query('COMMIT');
        return res.json({ success: true, count: transactions.length, message: "Transactions saved to database successfully." });
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  app.delete("/api/transactions", async (req, res) => {
    try {
      const user = await getAuthUser(req);
      if (!user) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      const { gstin, periodMonth, periodYear, id } = req.body;

      if (id) {
        await pool.query(`DELETE FROM meesho_transactions WHERE id = $1 AND user_id = $2`, [id, user.id]);
        return res.json({ success: true, message: "Transaction deleted." });
      }

      if (gstin && periodMonth && periodYear) {
        await pool.query(
          `DELETE FROM meesho_transactions
           WHERE user_id = $1 AND gstin = $2 AND LOWER(period_month) = LOWER($3) AND period_year = $4`,
          [user.id, gstin, String(periodMonth), String(periodYear)]
        );
        return res.json({ success: true, message: "All transactions cleared for session." });
      }

      return res.status(400).json({ success: false, message: "Missing params for transaction deletion." });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // =======================================
  // MANUAL GSTR-1 ENTRIES ROUTES
  // =======================================

  app.get("/api/manual-entries", async (req, res) => {
    try {
      const user = await getAuthUser(req);
      if (!user) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      const { gstin, periodMonth, periodYear } = req.query;
      const resData = await pool.query(
        `SELECT data FROM manual_gstr1_entries
         WHERE user_id = $1 AND gstin = $2 AND LOWER(period_month) = LOWER($3) AND period_year = $4`,
        [user.id, String(gstin), String(periodMonth), String(periodYear)]
      );

      const entries = resData.rows.map(row => row.data);
      return res.json({ success: true, entries });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post("/api/manual-entries", async (req, res) => {
    try {
      const user = await getAuthUser(req);
      if (!user) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      const { gstin, periodMonth, periodYear, entry } = req.body;
      if (!gstin || !periodMonth || !periodYear || !entry) {
        return res.status(400).json({ success: false, message: "Missing entry parameter." });
      }

      const entryId = entry.id || `manual_${Date.now()}`;
      await pool.query(
        `INSERT INTO manual_gstr1_entries (id, user_id, gstin, period_month, period_year, section, data)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
        [entryId, user.id, gstin, periodMonth, periodYear, entry.section || 'b2cs', JSON.stringify(entry)]
      );

      return res.json({ success: true, message: "Manual entry saved." });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  app.delete("/api/manual-entries/:id", async (req, res) => {
    try {
      const user = await getAuthUser(req);
      if (!user) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      const { id } = req.params;
      await pool.query(`DELETE FROM manual_gstr1_entries WHERE id = $1 AND user_id = $2`, [id, user.id]);
      return res.json({ success: true, message: "Manual entry deleted." });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // =======================================
  // LOCALSTORAGE ONE-TIME MIGRATION ROUTE
  // =======================================

  app.post("/api/migrate-local-data", async (req, res) => {
    try {
      const user = await getAuthUser(req);
      if (!user) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      const { profiles, transactionsGrouped } = req.body;

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Migrate profiles
        if (Array.isArray(profiles)) {
          for (const prof of profiles) {
            await client.query(
              `INSERT INTO seller_profiles (
                id, user_id, gstin, trade_name, party_name, return_type, period_month,
                period_year, is_active, state_code, state_name, added_date, last_used_date
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
              ON CONFLICT (id) DO NOTHING`,
              [
                prof.id || `gstin_${Date.now()}`,
                user.id,
                prof.gstin,
                prof.tradeName,
                prof.partyName || null,
                prof.returnType || 'Monthly',
                prof.periodMonth,
                prof.periodYear,
                !!prof.isActive,
                prof.stateCode || null,
                prof.stateName || null,
                prof.addedDate || new Date().toLocaleDateString('en-GB').replace(/\//g, '-'),
                prof.lastUsedDate || new Date().toLocaleDateString('en-GB').replace(/\//g, '-')
              ]
            );
          }
        }

        // Migrate transactions grouped by gstin_month_year
        if (transactionsGrouped && typeof transactionsGrouped === 'object') {
          for (const item of Object.values(transactionsGrouped) as any[]) {
            const { gstin, periodMonth, periodYear, transactions } = item;
            if (gstin && periodMonth && periodYear && Array.isArray(transactions)) {
              for (const tx of transactions) {
                const txId = tx.id || `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
                await client.query(
                  `INSERT INTO meesho_transactions (id, user_id, gstin, period_month, period_year, marketplace, data)
                   VALUES ($1, $2, $3, $4, $5, 'MEESHO', $6)
                   ON CONFLICT (id) DO NOTHING`,
                  [txId, user.id, gstin, periodMonth, periodYear, JSON.stringify(tx)]
                );
              }
            }
          }
        }

        await client.query('COMMIT');
        return res.json({ success: true, message: "Migration completed successfully." });
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // Delete Meesho Import Session API
  app.post("/api/meesho-import", async (req, res) => {
    try {
      const user = await getAuthUser(req);
      if (!user) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      const { gstin, periodMonth, periodYear, filesMeta, recordCount = 0 } = req.body;
      if (!gstin || !periodMonth || !periodYear) {
        return res.status(400).json({ success: false, message: "Missing required parameters." });
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        await client.query(
          `DELETE FROM uploaded_files
           WHERE user_id = $1 AND gstin = $2 AND LOWER(period_month) = LOWER($3) AND period_year = $4`,
          [user.id, gstin, String(periodMonth), String(periodYear)]
        );

        if (filesMeta) {
          if (filesMeta.tcsSales) {
            await client.query(
              `INSERT INTO uploaded_files (id, user_id, gstin, period_month, period_year, file_name, file_type, record_count)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
              [`file_${Date.now()}_1`, user.id, gstin, periodMonth, periodYear, filesMeta.tcsSales, 'tcs_sales', recordCount]
            );
          }
          if (filesMeta.tcsSalesReturn) {
            await client.query(
              `INSERT INTO uploaded_files (id, user_id, gstin, period_month, period_year, file_name, file_type, record_count)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
              [`file_${Date.now()}_2`, user.id, gstin, periodMonth, periodYear, filesMeta.tcsSalesReturn, 'tcs_sales_return', recordCount]
            );
          }
          if (filesMeta.taxInvoice) {
            await client.query(
              `INSERT INTO uploaded_files (id, user_id, gstin, period_month, period_year, file_name, file_type, record_count)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
              [`file_${Date.now()}_3`, user.id, gstin, periodMonth, periodYear, filesMeta.taxInvoice, 'tax_invoice_details', recordCount]
            );
          }
        }

        await client.query('COMMIT');
        return res.json({ success: true, message: "File metadata saved to database." });
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  app.get("/api/uploaded-files", async (req, res) => {
    try {
      const user = await getAuthUser(req);
      if (!user) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      const { gstin, periodMonth, periodYear } = req.query;
      const filesRes = await pool.query(
        `SELECT id, file_name as "fileName", file_type as "fileType", record_count as "recordCount", uploaded_at as "uploadedAt"
         FROM uploaded_files
         WHERE user_id = $1 AND gstin = $2 AND LOWER(period_month) = LOWER($3) AND period_year = $4
         ORDER BY uploaded_at DESC`,
        [user.id, String(gstin), String(periodMonth), String(periodYear)]
      );

      return res.json({ success: true, files: filesRes.rows });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // GSTR-1 Report Persistence APIs
  app.get("/api/gstr1-reports", async (req, res) => {
    try {
      const user = await getAuthUser(req);
      if (!user) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      const { gstin, periodMonth, periodYear } = req.query;
      const reportRes = await pool.query(
        `SELECT data FROM gstr1_reports
         WHERE user_id = $1 AND gstin = $2 AND LOWER(period_month) = LOWER($3) AND period_year = $4
         ORDER BY updated_at DESC LIMIT 1`,
        [user.id, String(gstin), String(periodMonth), String(periodYear)]
      );

      if (reportRes.rows.length === 0) {
        return res.json({ success: true, report: null });
      }

      return res.json({ success: true, report: reportRes.rows[0].data });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post("/api/gstr1-reports", async (req, res) => {
    try {
      const user = await getAuthUser(req);
      if (!user) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      const { gstin, periodMonth, periodYear, reportData } = req.body;
      if (!gstin || !periodMonth || !periodYear || !reportData) {
        return res.status(400).json({ success: false, message: "Missing required report parameters." });
      }

      const reportId = `rep_${user.id}_${gstin}_${periodMonth}_${periodYear}`;
      await pool.query(
        `INSERT INTO gstr1_reports (id, user_id, gstin, period_month, period_year, data, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = CURRENT_TIMESTAMP`,
        [reportId, user.id, gstin, periodMonth, periodYear, JSON.stringify(reportData)]
      );

      return res.json({ success: true, message: "Report saved successfully." });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  app.delete("/api/meesho-import", async (req, res) => {
    try {
      const user = await getAuthUser(req);
      if (!user) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      const { gstin, periodMonth, periodYear } = req.body;
      if (!gstin || !periodMonth || !periodYear) {
        return res.status(400).json({ success: false, message: "Missing parameters." });
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const deleteRes = await client.query(
          `DELETE FROM meesho_transactions
           WHERE user_id = $1 AND gstin = $2 AND LOWER(period_month) = LOWER($3) AND period_year = $4`,
          [user.id, gstin, String(periodMonth), String(periodYear)]
        );

        await client.query(
          `DELETE FROM uploaded_files
           WHERE user_id = $1 AND gstin = $2 AND LOWER(period_month) = LOWER($3) AND period_year = $4`,
          [user.id, gstin, String(periodMonth), String(periodYear)]
        );

        await client.query(
          `DELETE FROM gstr1_reports
           WHERE user_id = $1 AND gstin = $2 AND LOWER(period_month) = LOWER($3) AND period_year = $4`,
          [user.id, gstin, String(periodMonth), String(periodYear)]
        );

        await client.query('COMMIT');
        return res.json({ success: true, deletedCount: deleteRes.rowCount, message: "Session deleted from database." });
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // Vite middleware for development vs static serve for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
