import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;
const DB_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "db.json");

// Define backend type schemas
interface DBStructure {
  admin: {
    username: string;
    passwordHash: string;
    passwordSalt: string;
    sessionToken?: string;
  } | null;
  dailyCodes: {
    [dateString: string]: string; // Maps YYYY-MM-DD to QR code token
  };
  attendance: Array<{
    id: string;
    name: string;
    date: string;
    time: string;
    timestamp: number;
    code: string;
    ip?: string;
    device?: string;
  }>;
}

// Initialize database
function loadDatabase(): DBStructure {
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_PATH)) {
      const data = fs.readFileSync(DB_PATH, "utf8");
      return JSON.parse(data) as DBStructure;
    }
  } catch (err) {
    console.error("Error reading database file, resetting:", err);
  }

  const defaultDb: DBStructure = {
    admin: null,
    dailyCodes: {},
    attendance: [],
  };
  saveDatabase(defaultDb);
  return defaultDb;
}

function saveDatabase(db: DBStructure) {
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf8");
  } catch (err) {
    console.error("Error writing database file:", err);
  }
}

// Utility to hash passwords helper
function hashPassword(password: string, salt: string): string {
  return crypto.createHmac("sha256", salt).update(password).digest("hex");
}

// Utility to fetch today's date string YYYY-MM-DD in server local date
function getTodayDateString(): string {
  const d = new Date();
  // We use Swedish locale because SV format is YYYY-MM-DD
  return d.toLocaleDateString("sv");
}

// Middleware to parse json
app.use(express.json());

// Get system config state (public)
app.get("/api/config", (req, res) => {
  const db = loadDatabase();
  const today = getTodayDateString();
  
  // Auto-generate code for today if not present
  let todayCode = db.dailyCodes[today];
  if (!todayCode) {
    todayCode = "QR-" + today.replace(/-/g, "") + "-" + crypto.randomBytes(3).toString("hex").toUpperCase();
    db.dailyCodes[today] = todayCode;
    saveDatabase(db);
  }

  res.json({
    success: true,
    isAdminSet: db.admin !== null,
    todayCode,
    todayDate: today,
  });
});

// Setup admin account
app.post("/api/setup-admin", (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password || password.length < 4) {
    res.status(400).json({ success: false, message: "Invalid username or short password" });
    return;
  }

  const db = loadDatabase();
  if (db.admin) {
    res.status(400).json({ success: false, message: "Admin is already configured" });
    return;
  }

  const salt = crypto.randomBytes(16).toString("hex");
  const pHash = hashPassword(password, salt);

  db.admin = {
    username: username.trim(),
    passwordHash: pHash,
    passwordSalt: salt,
  };

  saveDatabase(db);
  res.json({ success: true, message: "Admin account configured successfully!" });
});

// Admin login
app.post("/api/admin/login", (req, res) => {
  const { username, password } = req.body;
  const db = loadDatabase();

  if (!db.admin) {
    res.status(400).json({ success: false, message: "Admin account not initialized" });
    return;
  }

  if (username !== db.admin.username) {
    res.status(401).json({ success: false, message: "Invalid username or password" });
    return;
  }

  const computedHash = hashPassword(password, db.admin.passwordSalt);
  if (computedHash === db.admin.passwordHash) {
    // Generate valid session token
    const token = crypto.randomBytes(32).toString("hex");
    db.admin.sessionToken = token;
    saveDatabase(db);

    res.json({
      success: true,
      token,
      username: db.admin.username,
    });
  } else {
    res.status(401).json({ success: false, message: "Invalid username or password" });
  }
});

// Authentication middleware helper
function verifyAdminToken(req: any, res: any, next: any) {
  const token = req.headers["x-admin-token"];
  if (!token) {
    return res.status(401).json({ success: false, message: "Unauthorized. Admin token missing." });
  }

  const db = loadDatabase();
  if (!db.admin || !db.admin.sessionToken || db.admin.sessionToken !== token) {
    return res.status(401).json({ success: false, message: "Unauthorized. Invalid admin session." });
  }

  next();
}

// Get admin records (requires admin validation)
app.get("/api/admin/records", verifyAdminToken, (req, res) => {
  const db = loadDatabase();
  res.json({
    success: true,
    attendance: db.attendance,
    dailyCodes: db.dailyCodes,
  });
});

// Force refresh today's QR Code
app.post("/api/admin/regenerate-code", verifyAdminToken, (req, res) => {
  const db = loadDatabase();
  const today = getTodayDateString();
  
  // Create unique daily code
  const newCode = "QR-" + today.replace(/-/g, "") + "-" + crypto.randomBytes(3).toString("hex").toUpperCase();
  db.dailyCodes[today] = newCode;
  
  saveDatabase(db);
  res.json({
    success: true,
    message: "New QR pattern generated successfully",
    todayCode: newCode,
  });
});

// Add manual record on Excel grid
app.post("/api/admin/add", verifyAdminToken, (req, res) => {
  const { name, date, time } = req.body;
  if (!name || !name.trim()) {
    res.status(400).json({ success: false, message: "Student Name is required" });
    return;
  }

  const db = loadDatabase();
  const recordDate = date || getTodayDateString();
  const recordTime = time || new Date().toTimeString().split(" ")[0];

  const newRecord = {
    id: crypto.randomUUID(),
    name: name.trim(),
    date: recordDate,
    time: recordTime,
    timestamp: Date.now(),
    code: "MANUAL-INPUT",
    ip: "Admin Console",
    device: "Admin Dashboard",
  };

  db.attendance.push(newRecord);
  saveDatabase(db);

  res.json({
    success: true,
    message: "Attendance entry logged successfully",
    record: newRecord,
  });
});

// Save edits inside Excel cell grid
app.post("/api/admin/update", verifyAdminToken, (req, res) => {
  const { id, name, date, time } = req.body;
  if (!id) {
    res.status(400).json({ success: false, message: "Record ID is required" });
    return;
  }

  const db = loadDatabase();
  const index = db.attendance.findIndex((r) => r.id === id);

  if (index === -1) {
    res.status(404).json({ success: false, message: "Record not found" });
    return;
  }

  if (name !== undefined) db.attendance[index].name = name.trim();
  if (date !== undefined) db.attendance[index].date = date;
  if (time !== undefined) db.attendance[index].time = time;

  saveDatabase(db);
  res.json({
    success: true,
    message: "Excel row updated successfully",
    record: db.attendance[index],
  });
});

// Delete attendance record
app.delete("/api/admin/delete/:id", verifyAdminToken, (req, res) => {
  const { id } = req.params;
  const db = loadDatabase();
  
  const initialLength = db.attendance.length;
  db.attendance = db.attendance.filter((r) => r.id !== id);

  if (db.attendance.length === initialLength) {
    res.status(404).json({ success: false, message: "Record does not exist" });
    return;
  }

  saveDatabase(db);
  res.json({ success: true, message: "Excel row removed successfully" });
});

// Clean slate (erase all logs)
app.post("/api/admin/clear-all", verifyAdminToken, (req, res) => {
  const db = loadDatabase();
  db.attendance = [];
  saveDatabase(db);
  res.json({ success: true, message: "All attendance records cleared" });
});

// Student scan submit attendance
app.post("/api/submit-attendance", (req, res) => {
  const { name, code } = req.body;
  
  if (!name || !name.trim()) {
    res.status(400).json({ success: false, message: "Please input your name" });
    return;
  }

  if (!code) {
    res.status(400).json({ success: false, message: "A valid QR session code is required" });
    return;
  }

  const db = loadDatabase();
  const today = getTodayDateString();
  const currentActiveCode = db.dailyCodes[today];

  // We find if the code matches today's or any previous code, but to avoid scanner bypass,
  // let's verify if the scanned code equals today's active code or if it's correct.
  // The client passes the code it scanned, we check if it is active.
  const codeOwnerDate = Object.keys(db.dailyCodes).find(
    (dateStr) => db.dailyCodes[dateStr] === code
  );

  if (!codeOwnerDate) {
    res.status(400).json({
      success: false,
      message: "This QR Code is invalid. Please scan the official active QR code.",
    });
    return;
  }

  if (codeOwnerDate !== today) {
    res.status(400).json({
      success: false,
      message: `This QR code has expired (Active on ${codeOwnerDate}). Please scan today's live QR code.`,
    });
    return;
  }

  // To prevent multiple entries by the same student on the same day, check if name matches today
  const isAlreadyRegistered = db.attendance.some(
    (record) =>
      record.date === today &&
      record.name.trim().toLowerCase() === name.trim().toLowerCase()
  );

  if (isAlreadyRegistered) {
    res.status(400).json({
      success: false,
      message: `Your attendance is already recorded for today (${today}). Duplicate entry blocked.`,
    });
    return;
  }

  // Get user device info
  const userAgent = req.headers["user-agent"] || "Unknown Browser";
  let deviceName = "Mobile Device";
  if (userAgent.match(/android/i)) {
    deviceName = "Android";
  } else if (userAgent.match(/iphone|ipad/i)) {
    deviceName = "iOS Device";
  } else if (userAgent.match(/windows/i)) {
    deviceName = "Windows PC";
  } else if (userAgent.match(/macintosh/i)) {
    deviceName = "MacBook";
  }

  const recordTime = new Date().toTimeString().split(" ")[0];

  const rawIp = req.ip || (Array.isArray(req.headers["x-forwarded-for"]) ? req.headers["x-forwarded-for"][0] : req.headers["x-forwarded-for"]) || "Web";

  const newRecord = {
    id: crypto.randomUUID(),
    name: name.trim(),
    date: today,
    time: recordTime,
    timestamp: Date.now(),
    code,
    ip: String(rawIp),
    device: deviceName,
  };

  db.attendance.push(newRecord);
  saveDatabase(db);

  res.json({
    success: true,
    message: "Thank you! Your attendance has been successfully logged.",
    record: { name: newRecord.name, date: newRecord.date, time: newRecord.time },
  });
});

// Setup Vite Dev server or Serve Static files in Production
async function bootstrap() {
  if (process.env.NODE_ENV !== "production") {
    // Development mode
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite middleware mounted for development");
  } else {
    // Production mode
    const distPath = path.join(process.cwd(), "dist");
    
    // Serve static frontend assets
    app.use(express.static(distPath));
    
    // Fallback all secondary routing to SPA index.html
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Production static handler mounted for /dist files");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error("Failed to bootstrap server application:", err);
});
