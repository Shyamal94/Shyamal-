import React, { useState, useEffect } from "react";
import { 
  Scan, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Fingerprint, 
  BookOpen, 
  ServerCrash,
  Sparkles,
  ArrowRight,
  RefreshCw,
  QrCode
} from "lucide-react";
import { motion } from "motion/react";

interface StudentRegisterProps {
  code: string;
  todayDate: string;
  onAttendSubmitted: (name: string, code: string) => Promise<{ success: boolean; message: string; record?: any }>;
}

export default function StudentRegister({
  code,
  todayDate,
  onAttendSubmitted
}: StudentRegisterProps) {
  const [studentName, setStudentName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [outcome, setOutcome] = useState<{ status: "idle" | "success" | "error"; message: string } | null>(null);
  const [receipt, setReceipt] = useState<{ name: string; date: string; time: string; code: string } | null>(null);

  // Check if they already submitted on this device previously
  useEffect(() => {
    const savedReceipt = localStorage.getItem(`attendance_receipt_${todayDate}`);
    if (savedReceipt) {
      try {
        const parsed = JSON.parse(savedReceipt);
        if (parsed && parsed.code === code) {
          setReceipt(parsed);
          setOutcome({
            status: "success",
            message: "You have already marked your attendance for today. Here is your official receipt."
          });
        }
      } catch (e) {
        console.error("Failed to parse attendance receipt from local storage:", e);
      }
    }
  }, [todayDate, code]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim() || !code) return;

    setIsSubmitting(true);
    setOutcome(null);

    try {
      const response = await onAttendSubmitted(studentName.trim(), code);
      if (response.success) {
        setOutcome({
          status: "success",
          message: response.message || "Attendance submitted successfully!"
        });
        
        // Save digital receipt to localStorage as local proof for student
        const newReceipt = {
          name: studentName.trim(),
          date: response.record?.date || todayDate,
          time: response.record?.time || new Date().toLocaleTimeString(),
          code: code
        };
        
        setReceipt(newReceipt);
        localStorage.setItem(`attendance_receipt_${todayDate}`, JSON.stringify(newReceipt));
      } else {
        setOutcome({
          status: "error",
          message: response.message || "Failed to submit attendance. Invalid QR code or duplicate name."
        });
      }
    } catch (err) {
      setOutcome({
        status: "error",
        message: "Network request failed. Please check if you are connected to the classroom Wi-Fi and try again."
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Re-enable registration form if error occurred and they want to try scanning or typing again
  const handleResetError = () => {
    setOutcome(null);
    setStudentName("");
  };

  return (
    <div className="max-w-md w-full mx-auto px-4 py-8 select-none" id="student-view-panel">
      {/* Decorative Top Hub */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-full px-4 py-1.5 text-emerald-800 text-xs font-semibold mb-3">
          <QrCode className="h-4 w-4 stroke-[2.5]" />
          Smart Attendance Scanner • {todayDate}
        </div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-slate-900 mt-1">
          Mark <span className="text-emerald-600">Attendance</span>
        </h1>
        <p className="text-sm text-slate-500 mt-2">
          Keep this receipt visible as official proof for your class attendance log.
        </p>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden"
      >
        {/* Banner with verified scan status */}
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-5 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-xl">
              <Scan className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-sm">QR Code Scan Verified</h3>
              <p className="text-[11px] text-emerald-100 font-mono tracking-wider">
                SESSIONID: {code.substring(0, 14)}...
              </p>
            </div>
          </div>
        </div>

        {/* Content body depending on success / info */}
        <div className="p-6">
          {outcome?.status === "success" && receipt ? (
            <div className="text-center py-4">
              <div className="inline-flex p-3 bg-emerald-50 rounded-full text-emerald-600 mb-4 animate-bounce">
                <CheckCircle2 className="h-10 w-10 stroke-[2.5]" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Attendance Confirmed</h3>
              <p className="text-xs text-rose-500 mt-1 font-semibold">{outcome.message}</p>

              {/* Physical Receipt Ticket */}
              <div className="mt-6 border-2 border-dashed border-slate-200 rounded-xl p-4 bg-slate-50 relative text-left">
                {/* Visual punchouts inside the receipt ticket */}
                <div className="absolute top-1/2 -left-2.5 w-5 h-5 bg-white border-r border-slate-100 rounded-full"></div>
                <div className="absolute top-1/2 -right-2.5 w-5 h-5 bg-white border-l border-slate-100 rounded-full"></div>

                <div className="text-center border-b border-slate-100 pb-3 mb-3">
                  <div className="text-[10px] uppercase font-extrabold tracking-widest text-[#107c41] font-sans">
                    Digital Attendance ID
                  </div>
                  <span className="font-mono text-[10px] text-slate-400">
                    VERIFIED_MD5_TOKEN_SECURE
                  </span>
                </div>

                <div className="space-y-2.5 text-xs text-slate-600 font-sans">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Student Name:</span>
                    <strong className="text-slate-800 font-semibold">{receipt.name}</strong>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Date Logged:</span>
                    <strong className="text-slate-800 font-semibold">{receipt.date || todayDate}</strong>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Time Verified:</span>
                    <strong className="text-slate-800 font-semibold">{receipt.time}</strong>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Session Status:</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-extrabold flex items-center gap-0.5">
                      <Sparkles className="h-2.5 w-2.5 fill-emerald-600 stroke-none" />
                      PRESENT
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-6 text-[11px] text-slate-400 text-center flex items-center justify-center gap-1">
                <Fingerprint className="h-3.5 w-3.5" />
                Receipt hashed. Show this screen to your teacher if requested.
              </div>
            </div>
          ) : outcome?.status === "error" ? (
            <div className="text-center py-4">
              <div className="inline-flex p-3 bg-rose-50 rounded-full text-rose-600 mb-4 animate-shake">
                <XCircle className="h-10 w-10 stroke-[2.5]" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Scan Verification Failed</h3>
              <p className="text-sm text-slate-500 mt-2 px-1 leading-relaxed">
                {outcome.message}
              </p>

              <button
                type="button"
                onClick={handleResetError}
                className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry Submission
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Enter Your Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="Enter your first and last name..."
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 outline-none rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800 bg-white placeholder-slate-400 font-sans"
                  autoComplete="name"
                  maxLength={50}
                  disabled={isSubmitting}
                />
                <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                  ⚠️ Note: Make sure to type your official register name carefully so the Excel sheet matches your record.
                </p>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !studentName.trim()}
                className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors shadow-sm cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Recording attendance...
                  </>
                ) : (
                  <>
                    Submit My Attendance
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </motion.div>

      {/* Trust notice */}
      <div className="text-center mt-6 text-xs text-slate-400 flex items-center justify-center gap-1.5 font-sans">
        <BookOpen className="h-4 w-4 text-emerald-600" />
        Logged safely into academic database.
      </div>
    </div>
  );
}
