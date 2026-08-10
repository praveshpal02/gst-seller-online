import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

interface MeeshoImportRecord {
  id: string;
  userId: string;
  gstin: string;
  periodMonth: string;
  periodYear: string;
  marketplace: 'MEESHO';
  filesMeta: {
    tcsSales?: string;
    tcsSalesReturn?: string;
    taxInvoice?: string;
  };
  status: 'IMPORTED';
  createdAt: string;
}

// In-memory persistent database store for imports
const meeshoImportDatabase: MeeshoImportRecord[] = [];

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", service: "GST Online Seller API" });
  });

  // Meesho Import Endpoint
  app.post("/api/meesho-import", (req, res) => {
    const { userId, gstin, periodMonth, periodYear, marketplace, filesMeta, forceReplace } = req.body;

    if (!userId || !gstin || !periodMonth || !periodYear) {
      return res.status(400).json({
        success: false,
        message: "Missing required profile or period information."
      });
    }

    // Check duplicate upload for same user + GSTIN + marketplace + period + year
    const existing = meeshoImportDatabase.find(
      (rec) =>
        rec.userId === userId &&
        rec.gstin === gstin &&
        rec.marketplace === 'MEESHO' &&
        rec.periodMonth.toLowerCase() === periodMonth.toLowerCase() &&
        rec.periodYear === periodYear
    );

    if (existing && !forceReplace) {
      return res.status(200).json({
        success: false,
        isDuplicate: true,
        message: `This Meesho report has already been uploaded for ${periodMonth} ${periodYear}.`,
        existingRecord: existing
      });
    }

    // Create new import record
    const newRecord: MeeshoImportRecord = {
      id: `imp_meesho_${Date.now()}`,
      userId,
      gstin,
      periodMonth,
      periodYear,
      marketplace: 'MEESHO',
      filesMeta: filesMeta || {},
      status: 'IMPORTED',
      createdAt: new Date().toISOString()
    };

    meeshoImportDatabase.push(newRecord);

    return res.status(200).json({
      success: true,
      isDuplicate: false,
      record: newRecord,
      message: `Meesho GST files uploaded and registered successfully for ${periodMonth} ${periodYear}.`
    });
  });

  // List past imports endpoint
  app.get("/api/meesho-imports", (req, res) => {
    const { userId, gstin } = req.query;
    let filtered = meeshoImportDatabase;
    if (userId) filtered = filtered.filter(r => r.userId === userId);
    if (gstin) filtered = filtered.filter(r => r.gstin === gstin);
    res.json({ imports: filtered });
  });

  // Delete Meesho import session
  app.delete("/api/meesho-import", (req, res) => {
    const { userId, gstin, periodMonth, periodYear, marketplace } = req.body;

    if (!gstin || !periodMonth || !periodYear) {
      return res.status(400).json({
        success: false,
        message: "Missing required gstin, periodMonth, or periodYear."
      });
    }

    let deletedCount = 0;
    for (let i = meeshoImportDatabase.length - 1; i >= 0; i--) {
      const rec = meeshoImportDatabase[i];
      if (
        (!userId || rec.userId === userId) &&
        rec.gstin === gstin &&
        rec.periodMonth.toLowerCase() === periodMonth.toLowerCase() &&
        rec.periodYear === periodYear &&
        (!marketplace || rec.marketplace === marketplace)
      ) {
        meeshoImportDatabase.splice(i, 1);
        deletedCount++;
      }
    }

    return res.status(200).json({
      success: true,
      deletedCount,
      message: `Meesho import session deleted successfully for ${periodMonth} ${periodYear}.`
    });
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
