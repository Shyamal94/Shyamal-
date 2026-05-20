import React, { useState, useEffect } from "react";
import QRCode from "qrcode";
import { 
  ShieldAlert, 
  User, 
  Lock, 
  Key, 
  QrCode, 
  Check, 
  Copy, 
  ArrowRight, 
  RotateCw, 
  Users, 
  Clock, 
  Settings, 
  LogOut,
  Download,
  ExternalLink,
  Laptop,
  Database
} from "lucide-react";
import { motion } from "motion/react";
import { AttendanceRecord, ApiResponse } from "./types";
import ExcelSheet from "./components/ExcelSheet";
import StudentRegister from "./components/StudentRegister";

export default function App() {
  // Config & Public settings
  const [isAdminSet, setIsAdminSet] = useState(false);
  const [adminToken, setAdminToken] = useState<string | null>(() => localStorage.getItem("attendance_admin_token"));
  const [adminUser, setAdminUser] = useState<string | null>(() => localStorage.getItem("attendance_admin_username"));
  const [todayCode, setTodayCode] = useState<string>("");
  const [todayDate, setTodayDate] = useState<string>("");
  
  // Scanned QR code param
  const [scannedCode, setScannedCode] = useState<string | null>(null);

  // Form states (Admin setup & Login)
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);

  // Logs & Admin dashboard state
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  
  // Real-time polling timer ID
  const [pollIntervalId, setPollIntervalId] = useState<any>(null);

  // Read URL params and setup public configs
  useEffect(() => {
    // Check if '?code=XXXX' exists in URL
    const params = new URLSearchParams(window.location.search);
    const codeInUrl = params.get("code");
    if (codeInUrl) {
      setScannedCode(codeInUrl);
    }

    // Load configuration
    fetchConfig();
  }, []);

  // Whenever today's code loads, construct the QR Code data URL
  useEffect(() => {
    if (todayCode) {
      const liveScanUrl = `${window.location.origin}/?code=${todayCode}`;
      QRCode.toDataURL(liveScanUrl, {
        width: 320,
        margin: 2,
        color: {
          dark: "#0f172a", // slate 900
          light: "#ffffff"
        }
      })
      .then(url => {
        setQrDataUrl(url);
      })
      .catch(err => {
        console.error("Failed to generate QR Code data URL:", err);
      });
    }
  }, [todayCode]);

  // If the admin is authenticated, fetch records & start polling
  useEffect(() => {
    if (adminToken) {
      fetchRecords();

      // Poll server every 3 seconds to get live attendance registrations
      const timer = setInterval(() => {
        pollRecords();
      }, 3000);

      setPollIntervalId(timer);

      return () => {
        if (timer) clearInterval(timer);
      };
    } else {
      if (pollIntervalId) {
        clearInterval(pollIntervalId);
        setPollIntervalId(null);
      }
      setRecords([]);
    }
  }, [adminToken]);

  // Public Configuration fetcher
  const fetchConfig = async () => {
    try {
      const res = await fetch("/api/config");
      const data: ApiResponse = await res.json();
      if (data.success && data.data) {
        // Wait, server returns the direct object inside JSON or root keys
      }
      // Since response format in server is res.json({ success, isAdminSet, todayCode, todayDate })
      const rawData = await res.json().catch(() => null) || await (await fetch("/api/config")).json();
      if (rawData) {
        setIsAdminSet(rawData.isAdminSet);
        setTodayCode(rawData.todayCode);
        setTodayDate(rawData.todayDate);
      }
    } catch (err) {
      console.error("Failed to load backend system configs:", err);
    }
  };

  // Admin Logs Fetcher
  const fetchRecords = async () => {
    if (!adminToken) return;
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/records", {
        headers: {
          "x-admin-token": adminToken
        }
      });

      if (res.status === 401) {
        // Unauthorized (session expired?)
        handleLogout();
        return;
      }

      const raw = await res.json();
      if (raw.success) {
        setRecords(raw.attendance);
      }
    } catch (err) {
      console.error("Failed to fetch database logs:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Silent polling for realtime edits without showing full loader spinner
  const pollRecords = async () => {
    if (!adminToken) return;
    try {
      const res = await fetch("/api/admin/records", {
        headers: {
          "x-admin-token": adminToken
        }
      });
      if (res.ok) {
        const raw = await res.json();
        if (raw.success) {
          setRecords(raw.attendance);
        }
      }
    } catch (e) {
      // ignore transient network dropouts quietly during poll
    }
  };

  // Setup Admin account first time
  const handleAdminSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (password !== confirmPassword) {
      setAuthError("Passwords do not match!");
      return;
    }

    if (password.length < 4) {
      setAuthError("Password must be at least 4 characters long.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/setup-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (data.success) {
        setIsAdminSet(true);
        setUsername("");
        setPassword("");
        setConfirmPassword("");
        alert("Admin configuration created! Please login now.");
      } else {
        setAuthError(data.message || "Failed to configure admin settings.");
      }
    } catch (err) {
      setAuthError("Server communication failed.");
    } finally {
      setIsLoading(false);
    }
  };

  // Admin standard Login
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (data.success && data.token) {
        localStorage.setItem("attendance_admin_token", data.token);
        localStorage.setItem("attendance_admin_username", data.username);
        setAdminToken(data.token);
        setAdminUser(data.username);
        setUsername("");
        setPassword("");
      } else {
        setAuthError(data.message || "Invalid credentials.");
      }
    } catch (err) {
      setAuthError("Server validation failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("attendance_admin_token");
    localStorage.removeItem("attendance_admin_username");
    setAdminToken(null);
    setAdminUser(null);
    if (pollIntervalId) {
      clearInterval(pollIntervalId);
      setPollIntervalId(null);
    }
  };

  // Submit student name matching QR
  const handleStudentSubmit = async (name: string, code: string) => {
    const res = await fetch("/api/submit-attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, code })
    });
    return await res.json();
  };

  // Update Excel row
  const handleUpdateRecord = async (id: string, name: string, date: string, time: string) => {
    if (!adminToken) return false;
    try {
      const res = await fetch("/api/admin/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": adminToken
        },
        body: JSON.stringify({ id, name, date, time })
      });
      const data = await res.json();
      if (data.success) {
        // optimistically update state
        setRecords(prev => prev.map(rec => rec.id === id ? { ...rec, name, date, time } : rec));
        return true;
      } else {
        alert(data.message || "Failed to update row.");
        return false;
      }
    } catch (e) {
      alert("Network request failed.");
      return false;
    }
  };

  // Delete Excel Row
  const handleDeleteRecord = async (id: string) => {
    if (!adminToken) return false;
    try {
      const res = await fetch(`/api/admin/delete/${id}`, {
        method: "DELETE",
        headers: { "x-admin-token": adminToken }
      });
      const data = await res.json();
      if (data.success) {
        setRecords(prev => prev.filter(rec => rec.id !== id));
        return true;
      } else {
        alert(data.message || "Delete failed.");
        return false;
      }
    } catch (e) {
      alert("Server failure.");
      return false;
    }
  };

  // Add Row Manually
  const handleAddRecord = async (name: string, date: string, time: string) => {
    if (!adminToken) return false;
    try {
      const res = await fetch("/api/admin/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": adminToken
        },
        body: JSON.stringify({ name, date, time })
      });
      const data = await res.json();
      if (data.success && data.record) {
        setRecords(prev => [data.record, ...prev]);
        return true;
      } else {
        alert(data.message || "Manual insert failed.");
        return false;
      }
    } catch (e) {
      alert("Server error manually syncing.");
      return false;
    }
  };

  // Clear Spreadsheet Data completely
  const handleClearAll = async () => {
    if (!adminToken) return false;
    try {
      const res = await fetch("/api/admin/clear-all", {
        method: "POST",
        headers: { "x-admin-token": adminToken }
      });
      const data = await res.json();
      if (data.success) {
        setRecords([]);
        return true;
      } else {
        alert(data.message || "Failed to empty database.");
        return false;
      }
    } catch (e) {
      alert("Network request failed.");
      return false;
    }
  };

  // Rotate daily QR session token
  const handleRotateQrCode = async () => {
    if (!adminToken) return;
    try {
      const res = await fetch("/api/admin/regenerate-code", {
        method: "POST",
        headers: { "x-admin-token": adminToken }
      });
      const data = await res.json();
      if (data.success && data.todayCode) {
        setTodayCode(data.todayCode);
        alert("Today's QR session token rotated successfully! Refreshing code...");
      }
    } catch (e) {
      alert("Network exception communicating with security key ring.");
    }
  };

  // Copy scan Link to board clipboard
  const handleCopyLink = () => {
    const link = `${window.location.origin}/?code=${todayCode}`;
    navigator.clipboard.writeText(link);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // QR PNG download helper
  const handleDownloadQrImg = () => {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `Attendance_QR_${todayDate}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // ================= SCENARIO 1: STUDENT VIEW =================
  if (scannedCode) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center">
        <StudentRegister
          code={scannedCode}
          todayDate={todayDate}
          onAttendSubmitted={handleStudentSubmit}
        />
        <div className="py-4 text-center">
          <p className="text-xs text-slate-400">
            Scanning for: <strong className="font-mono text-emerald-700">{todayDate}</strong>
          </p>
        </div>
      </div>
    );
  }

  // ================= SCENARIO 2: ADMIN IS SET UP & AUTHENTICATED =================
  if (adminToken) {
    const liveScanUrl = `${window.location.origin}/?code=${todayCode}`;

    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col" id="admin-main-interface">
        {/* Navigation Admin Header bar */}
        <header className="bg-slate-900 text-white px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4 shadow-md border-b border-slate-800 select-none">
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 bg-emerald-500 rounded-lg text-slate-950 font-bold flex items-center">
              <Database className="h-5 w-5" />
            </span>
            <div>
              <h1 className="font-display text-xl font-extrabold tracking-tight flex items-center gap-2">
                QR Attendance console <span className="text-emerald-400 text-xs px-2 py-0.5 rounded-full bg-emerald-950/60 font-mono tracking-widest border border-emerald-900">ADMIN</span>
              </h1>
              <p className="text-xs text-slate-400 font-sans">
                Logged in: <strong className="text-white">{adminUser}</strong> • Active Campus Node
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden md:flex items-center gap-1.5 text-xs text-slate-400 font-sans pr-2 border-r border-slate-800">
              <Clock className="w-4 h-4 text-emerald-400" />
              SYSTEM TIME: {new Date().toLocaleTimeString()}
            </span>
            
            <button
              type="button"
              onClick={handleLogout}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 font-bold rounded-lg text-xs text-rose-300 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out Securely
            </button>
          </div>
        </header>

        {/* Dashboard Panels Layout */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-5 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN: QR CODE GENERATOR MANAGER (lg:col-span-4) */}
          <section className="lg:col-span-4 flex flex-col gap-6" id="qr-control-section">
            <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
              <div className="border-b border-slate-200 p-4 bg-slate-50/70 flex justify-between items-center">
                <h3 className="font-display font-bold text-slate-800 text-sm flex items-center gap-2">
                  <QrCode className="h-4 w-4 text-emerald-600" />
                  Live Attendance QR Generator
                </h3>
                <span className="px-2 py-0.5 font-bold text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-full font-mono">
                  ACTIVE
                </span>
              </div>

              <div className="p-6 flex flex-col items-center">
                {/* Visual date sign */}
                <div className="text-center mb-4">
                  <div className="text-xs uppercase font-extrabold tracking-wider text-slate-400 font-sans">Today's Active Date</div>
                  <strong className="text-xl font-display font-extrabold text-[#107c41]">
                    {todayDate ? new Date(todayDate).toDateString() : "Loading..."}
                  </strong>
                </div>

                {/* QR Code Container styled with depth */}
                <div className="p-4 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 relative group">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt="Student Attendance Registration Scanned QR"
                      className="w-56 h-56 rounded-md select-none pointer-events-none"
                    />
                  ) : (
                    <div className="w-56 h-56 bg-white flex items-center justify-center text-slate-300 animate-pulse font-mono text-xs">
                      Generating key...
                    </div>
                  )}

                  {/* Anti-spoof frame overlay corner decoration */}
                  <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-emerald-500 rounded-tl"></div>
                  <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-emerald-500 rounded-tr"></div>
                  <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-emerald-500 rounded-bl"></div>
                  <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-emerald-500 rounded-br"></div>
                </div>

                {/* Display token */}
                <div className="mt-4 p-2 bg-slate-100 rounded-lg text-center w-full">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Scan Security Token</span>
                  <code className="text-xs text-slate-700 font-semibold font-mono tracking-wider break-all px-1">
                    {todayCode || "Generating code..."}
                  </code>
                </div>

                {/* Action buttons */}
                <div className="w-full space-y-2 mt-5">
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="w-full py-2.5 px-4 bg-slate-900 text-white hover:bg-slate-800 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    {isCopied ? (
                      <>
                        <Check className="h-4 w-4 text-emerald-400" />
                        URL Link Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 text-slate-400" />
                        Copy Direct Student URL
                      </>
                    )}
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleDownloadQrImg}
                      className="py-2 px-3 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl font-bold text-xs flex items-center justify-center gap-1 text-center transition-colors cursor-pointer"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Save PNG image
                    </button>

                    <button
                      type="button"
                      onClick={handleRotateQrCode}
                      className="py-2 px-3 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-xl font-bold text-xs flex items-center justify-center gap-1 text-center transition-colors border border-rose-100 cursor-pointer"
                      title="Force rotate active QR scan key immediately"
                    >
                      <RotateCw className="h-3.5 w-3.5" />
                      Rotate QR Code
                    </button>
                  </div>
                </div>
              </div>

              {/* Security info box */}
              <div className="bg-slate-50 p-4 border-t border-slate-200 text-xs text-slate-500 space-y-2 font-sans leading-relaxed">
                <p className="font-semibold text-slate-700 flex items-center gap-1">
                  💡 How Student Scanning Works:
                </p>
                <ol className="list-decimal list-inside pl-1 space-y-1">
                  <li>Show this QR screen on the projector or class whiteboard.</li>
                  <li>Students scan it with their default mobile camera app.</li>
                  <li>They are prompted to enter their Name directly.</li>
                  <li>On click, they register on the adjacent Excel spreadsheet database in real-time.</li>
                </ol>
                <p className="text-[10px] text-rose-500 font-medium">
                  🔒 Prevention: Rotate the QR code if students shared screenshots outside of class. The old scan URLs will immediately expire.
                </p>
              </div>
            </div>

            {/* Micro statistic panel */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow shadow-slate-100 flex items-center gap-3">
                <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-tight">Today Logged</span>
                  <p className="text-xl font-mono font-extrabold text-slate-900">
                    {records.filter(r => r.date === todayDate).length}
                  </p>
                </div>
              </div>
              
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow shadow-slate-100 flex items-center gap-3">
                <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-tight">System Status</span>
                  <p className="text-xs font-bold text-emerald-700 flex items-center gap-1 mt-1">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse-fast"></span>
                    SYNCING OK
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* RIGHT COLUMN: INTERACTIVE EXCEL GRID SPREADSHEET (lg:col-span-8) */}
          <section className="lg:col-span-8 overflow-hidden" id="excel-grid-section">
            <ExcelSheet
              records={records}
              onUpdateRecord={handleUpdateRecord}
              onDeleteRecord={handleDeleteRecord}
              onAddRecord={handleAddRecord}
              onClearAll={handleClearAll}
              onRefreshAll={fetchRecords}
              isLoading={isLoading}
            />
          </section>
        </main>
      </div>
    );
  }

  // ================= SCENARIO 3: ADMIN IS CONFIGURING SETUP ACCOUNTS (FIRST LOAD) =================
  if (!isAdminSet) {
    return (
      <div className="min-h-screen bg-gradient-to-tr from-slate-900 to-slate-950 flex flex-col justify-center items-center px-4 select-none">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="max-w-md w-full bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden p-8"
        >
          <div className="text-center mb-6">
            <div className="inline-flex p-3 bg-emerald-500/10 rounded-full text-emerald-400 mb-3 border border-emerald-500/20">
              <Settings className="h-8 w-8 animate-spin-slow" />
            </div>
            <h2 className="font-display text-2xl font-black text-white tracking-tight">Initialize Credentials</h2>
            <p className="text-sm text-slate-400 mt-1">
              Set up your first admin username and password. This is required to access the daily attendance excel ledger.
            </p>
          </div>

          {authError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-center gap-2 mb-4">
              <ShieldAlert className="h-4 w-4 flex-shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleAdminSetup} className="space-y-4 font-sans">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Admin Name</label>
              <div className="relative">
                <span className="absolute left-3.5 top-3 text-slate-500">
                  <User className="h-4.5 w-4.5" />
                </span>
                <input
                  type="text"
                  required
                  placeholder="e.g. Shyamal Professor"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 outline-none rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-slate-600 focus:border-emerald-500 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Admin Password</label>
              <div className="relative">
                <span className="absolute left-3.5 top-3 text-slate-500">
                  <Lock className="h-4.5 w-4.5" />
                </span>
                <input
                  type="password"
                  required
                  placeholder="Create secure password..."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 outline-none rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-slate-600 focus:border-emerald-500 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Confirm Admin Password</label>
              <div className="relative">
                <span className="absolute left-3.5 top-3 text-slate-500">
                  <Key className="h-4.5 w-4.5" />
                </span>
                <input
                  type="password"
                  required
                  placeholder="Re-type secure password..."
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 outline-none rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-slate-600 focus:border-emerald-500 text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm rounded-xl transition-colors shadow-lg cursor-pointer flex items-center justify-center gap-2 mt-2"
            >
              {isLoading ? "Saving Setup..." : "Configure Admin Account"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  // ================= SCENARIO 4: ADMIN STANDARD LOGIN PORTAL =================
  return (
    <div className="min-h-screen bg-gradient-to-tr from-slate-900 to-slate-950 flex flex-col justify-center items-center px-4 select-none">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="max-w-md w-full bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden p-8"
      >
        <div className="text-center mb-6">
          <div className="inline-flex p-3 bg-emerald-500/10 rounded-full text-emerald-400 mb-3 border border-emerald-500/20">
            <Lock className="h-8 w-8" />
          </div>
          <h2 className="font-display text-2xl font-black text-white tracking-tight">Admin Portal Login</h2>
          <p className="text-sm text-slate-400 mt-1">
            Sign in below to verify security details and manage student logs.
          </p>
        </div>

        {authError && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-center gap-2 mb-4">
            <ShieldAlert className="h-4 w-4 flex-shrink-0" />
            <span>{authError}</span>
          </div>
        )}

        <form onSubmit={handleAdminLogin} className="space-y-4 font-sans">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Admin Username</label>
            <div className="relative">
              <span className="absolute left-3.5 top-3 text-slate-500">
                <User className="h-4.5 w-4.5" />
              </span>
              <input
                type="text"
                required
                placeholder="Enter admin name..."
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 outline-none rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-slate-600 focus:border-emerald-500 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Password</label>
            <div className="relative">
              <span className="absolute left-3.5 top-3 text-slate-500">
                <Lock className="h-4.5 w-4.5" />
              </span>
              <input
                type="password"
                required
                placeholder="Enter secret password..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 outline-none rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-slate-600 focus:border-emerald-500 text-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm rounded-xl transition-colors shadow-lg cursor-pointer flex items-center justify-center gap-2 mt-2"
          >
            {isLoading ? "Signing in..." : "Validate Credentials"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-slate-800/80 text-center">
          <p className="text-[11px] text-slate-500 uppercase tracking-widest font-sans flex items-center justify-center gap-1.5">
            <Laptop className="h-3.5 w-3.5 text-emerald-500" />
            ATTENDANCE RECORDING CLIENT v1.0.0
          </p>
        </div>
      </motion.div>
    </div>
  );
}
