import React, { useState, useRef, useEffect } from "react";
import { 
  FileSpreadsheet, 
  Search, 
  Trash2, 
  Plus, 
  Filter, 
  Download, 
  RefreshCw, 
  Edit3, 
  AlertTriangle,
  Grid3X3,
  Calendar,
  Check,
  X
} from "lucide-react";
import { AttendanceRecord } from "../types";

interface ExcelSheetProps {
  records: AttendanceRecord[];
  onUpdateRecord: (id: string, name: string, date: string, time: string) => Promise<boolean>;
  onDeleteRecord: (id: string) => Promise<boolean>;
  onAddRecord: (name: string, date: string, time: string) => Promise<boolean>;
  onClearAll: () => Promise<boolean>;
  onRefreshAll: () => Promise<void>;
  isLoading: boolean;
}

export default function ExcelSheet({
  records,
  onUpdateRecord,
  onDeleteRecord,
  onAddRecord,
  onClearAll,
  onRefreshAll,
  isLoading
}: ExcelSheetProps) {
  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "yesterday">("all");
  const [customFilterDate, setCustomFilterDate] = useState("");
  
  // Manual adding row state
  const [isInserting, setIsInserting] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDate, setNewDate] = useState(() => new Date().toLocaleDateString("sv"));
  const [newTime, setNewTime] = useState(() => new Date().toTimeString().split(" ")[0].substring(0, 5));

  // Cell editing state
  const [editingCell, setEditingCell] = useState<{ id: string; field: "name" | "date" | "time" } | null>(null);
  const [editValue, setEditValue] = useState("");
  const cellInputRef = useRef<HTMLInputElement>(null);

  // Clear modal confirmation
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Focus input when entering editing mode
  useEffect(() => {
    if (editingCell && cellInputRef.current) {
      cellInputRef.current.focus();
      cellInputRef.current.select();
    }
  }, [editingCell]);

  // Helper date conversions
  const todayStr = new Date().toLocaleDateString("sv");
  const yesterdayStr = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toLocaleDateString("sv");
  })();

  // Filter records
  const filteredRecords = records.filter(rec => {
    // Search query
    const matchesSearch = rec.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          rec.code.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Date filter
    let matchesDate = true;
    if (dateFilter === "today") {
      matchesDate = rec.date === todayStr;
    } else if (dateFilter === "yesterday") {
      matchesDate = rec.date === yesterdayStr;
    } else if (customFilterDate) {
      matchesDate = rec.date === customFilterDate;
    }

    return matchesSearch && matchesDate;
  });

  // Sort: show newest registrations at the top by timestamp (or reverse index)
  const sortedRecords = [...filteredRecords].sort((a, b) => b.timestamp - a.timestamp);

  // Trigger double click edit
  const startEditing = (record: AttendanceRecord, field: "name" | "date" | "time") => {
    setEditingCell({ id: record.id, field });
    setEditValue(record[field]);
  };

  const saveCellEdit = async (record: AttendanceRecord) => {
    if (!editingCell) return;
    
    // Validate
    if (editingCell.field === "name" && !editValue.trim()) {
      setEditingCell(null);
      return;
    }

    const updatedName = editingCell.field === "name" ? editValue : record.name;
    const updatedDate = editingCell.field === "date" ? editValue : record.date;
    const updatedTime = editingCell.field === "time" ? editValue : record.time;

    const success = await onUpdateRecord(record.id, updatedName, updatedDate, updatedTime);
    if (success) {
      setEditingCell(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, record: AttendanceRecord) => {
    if (e.key === "Enter") {
      saveCellEdit(record);
    } else if (e.key === "Escape") {
      setEditingCell(null);
    }
  };

  // Submit manual insert row
  const handleInsertRow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    // Convert newTime (HH:MM or HH:MM:SS)
    const formattedTime = newTime.length === 5 ? `${newTime}:00` : newTime;
    const success = await onAddRecord(newName, newDate, formattedTime);
    if (success) {
      setNewName("");
      setIsInserting(false);
    }
  };

  // Download real CSV/Excel formatted sheet
  const handleDownloadExcel = () => {
    if (records.length === 0) {
      alert("No attendance records to export!");
      return;
    }

    const docDate = new Date().toLocaleDateString("sv");
    
    // Column Header mapping
    const headers = ["A_INDEX", "B_STUDENT_NAME", "C_ATTENDANCE_DATE", "D_SUBMISSION_TIME", "E_SECURITY_QR_TOKEN", "F_SUBMISSION_SOURCE", "G_DEVICE_OS"];
    
    // Data Rows format
    const rows = records.map((rec, i) => [
      i + 1,
      `"${rec.name.replace(/"/g, '""')}"`,
      rec.date,
      rec.time,
      rec.code,
      `"${rec.ip || "Web Portal"}"`,
      `"${rec.device || "Mobile Browser"}"`
    ]);

    // Use BOM \uFEFF to specify UTF-8 encoding in Excel
    const csvContent = "\uFEFF" + [
      "STUDENT ATTENDANCE EXCEL DATABASE",
      `Exported On: ${docDate} ${new Date().toLocaleTimeString()}`,
      `Total Students Logged: ${records.length}`,
      "", // blank divider line
      headers.join(","),
      ...rows.map(e => e.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Student_Attendance_Sheet_${docDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden" id="excel-sheet-panel">
      {/* Excel Ribbon / Control Bar */}
      <div className="bg-[#107c41] px-5 py-4 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#0b592e]">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/15 rounded-lg">
            <FileSpreadsheet className="h-6 w-6" id="spreadsheet-icon" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold tracking-tight">attendance_database.xlsx</h2>
            <p className="text-xs text-emerald-100 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-emerald-300 rounded-full animate-ping"></span>
              Live Grid Sheet • Direct Excel Integration
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Refresh Sheet */}
          <button 
            type="button"
            onClick={onRefreshAll}
            className="p-2 hover:bg-[#0b592e] bg-emerald-800/40 rounded-lg text-emerald-50 transition-colors flex items-center gap-1 text-sm font-medium"
            title="Refresh logs from server"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh Grid
          </button>

          {/* Download CSV button */}
          <button
            type="button"
            onClick={handleDownloadExcel}
            className="px-3 py-2 bg-yellow-500 hover:bg-yellow-600 text-slate-950 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Download className="h-4 w-4" />
            Download Excel file (.CSV)
          </button>
        </div>
      </div>

      {/* Grid Menu controls: search, manual insert, date filtering */}
      <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row gap-3 items-center justify-between">
        {/* Search */}
        <div className="relative w-full md:w-72">
          <span className="absolute left-3 top-2.5 text-slate-400">
            <Search className="h-4 w-4" />
          </span>
          <input
            type="text"
            placeholder="Search student or QR code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-700"
          />
        </div>

        {/* Date Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto text-xs">
          <div className="flex border border-slate-200 rounded-lg overflow-hidden bg-white">
            <button
              onClick={() => { setDateFilter("all"); setCustomFilterDate(""); }}
              className={`px-3 py-1.5 font-medium transition-colors ${dateFilter === "all" ? "bg-slate-200 text-slate-800" : "text-slate-500 hover:bg-slate-100"}`}
            >
              All Time ({records.length})
            </button>
            <button
              onClick={() => { setDateFilter("today"); setCustomFilterDate(""); }}
              className={`px-3 py-1.5 font-medium transition-colors ${dateFilter === "today" ? "bg-emerald-50 text-emerald-700 border-l border-r border-slate-200" : "text-slate-500 hover:bg-slate-100"}`}
            >
              Today ({records.filter(r => r.date === todayStr).length})
            </button>
            <button
              onClick={() => { setDateFilter("yesterday"); setCustomFilterDate(""); }}
              className={`px-3 py-1.5 font-medium transition-colors ${dateFilter === "yesterday" ? "bg-slate-200 text-slate-800" : "text-slate-500 hover:bg-slate-100"}`}
            >
              Yesterday ({records.filter(r => r.date === yesterdayStr).length})
            </button>
          </div>

          {/* Date Picker Input */}
          <div className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-slate-400" />
            <input
              type="date"
              value={customFilterDate}
              onChange={(e) => {
                setCustomFilterDate(e.target.value);
                setDateFilter("all"); // clear relative filter
              }}
              className="border border-slate-200 bg-white rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-700 text-xs"
            />
          </div>

          <button
            onClick={() => setIsInserting(!isInserting)}
            className="ml-auto md:ml-0 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold rounded-lg flex items-center gap-1 text-xs border border-emerald-200 transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            Insert Row
          </button>
        </div>
      </div>

      {/* Manual row insert portal sheet */}
      {isInserting && (
        <form onSubmit={handleInsertRow} className="p-4 bg-emerald-50/50 border-b border-slate-200 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Student Name</label>
            <input
              type="text"
              placeholder="e.g. Shyamal Sadhu"
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full text-sm border border-slate-200 px-3 py-1.5 bg-white rounded-md text-slate-700 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div className="w-40">
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Date</label>
            <input
              type="date"
              required
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="w-full text-sm border border-slate-200 px-2 py-1.5 bg-white rounded-md text-slate-700 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div className="w-32">
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Time</label>
            <input
              type="time"
              required
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
              className="w-full text-sm border border-slate-200 px-2 py-1.5 bg-white rounded-md text-slate-700 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div className="flex gap-1.5">
            <button
              type="submit"
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 font-semibold text-white rounded-md text-xs transition-colors cursor-pointer"
            >
              Add Attendance
            </button>
            <button
              type="button"
              onClick={() => setIsInserting(false)}
              className="px-3 py-2 bg-slate-200 hover:bg-slate-300 font-semibold text-slate-700 rounded-md text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Excel layout display */}
      <div className="overflow-x-auto excel-grid max-h-[500px]">
        <table className="w-full text-left border-collapse font-mono text-sm">
          {/* A, B, C, D Table design headers */}
          <thead>
            <tr className="bg-slate-100 text-slate-500 border-b border-slate-200 select-none">
              <th className="w-12 bg-slate-200/60 border-r border-slate-200 text-center py-1 font-bold text-xs"></th>
              <th className="px-3 py-1 border-r border-slate-200 font-bold text-xs">
                A <span className="text-slate-400 font-normal">Student Name</span>
              </th>
              <th className="px-3 py-1 border-r border-slate-200 font-bold text-xs w-44">
                B <span className="text-slate-400 font-normal">Date (YYYY-MM-DD)</span>
              </th>
              <th className="px-3 py-1 border-r border-slate-200 font-bold text-xs w-36">
                C <span className="text-slate-400 font-normal">Time (HH:MM:SS)</span>
              </th>
              <th className="px-3 py-1 border-r border-slate-200 font-bold text-xs w-44">
                D <span className="text-slate-400 font-normal">Security Token</span>
              </th>
              <th className="px-3 py-1 border-r border-slate-200 font-bold text-xs w-36">
                E <span className="text-slate-400 font-normal">Source IP</span>
              </th>
              <th className="px-3 py-1 font-bold text-xs w-20 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedRecords.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-slate-400 bg-white">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Grid3X3 className="h-8 w-8 text-slate-300 stroke-[1.5]" />
                    <p className="text-sm font-sans font-medium">No records found matching filters.</p>
                    <p className="text-xs max-w-sm font-sans leading-normal">
                      Students will appear in realtime as they scan the QR code and submit their name. Or click <span className="text-emerald-700 font-bold">"Insert Row"</span> to add manually.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              sortedRecords.map((record, index) => {
                // Serial count represents rows in Excel
                const rowIndex = sortedRecords.length - index;
                
                return (
                  <tr 
                    key={record.id}
                    className="border-b border-slate-200 hover:bg-emerald-50/15 group transition-colors"
                  >
                    {/* Row sequence number (1, 2, 3...) */}
                    <td className="bg-slate-100/70 border-r border-slate-200 text-center text-xs text-slate-400 font-bold select-none py-2 font-mono">
                      {rowIndex}
                    </td>

                    {/* Student Name */}
                    <td 
                      className="px-3 py-2 border-r border-slate-200 relative cursor-pointer font-sans"
                      onDoubleClick={() => startEditing(record, "name")}
                      title="Double-click to edit name"
                    >
                      {editingCell?.id === record.id && editingCell?.field === "name" ? (
                        <div className="absolute inset-0 p-1 bg-white z-10 flex items-center">
                          <input
                            ref={cellInputRef}
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => saveCellEdit(record)}
                            onKeyDown={(e) => handleKeyDown(e, record)}
                            className="w-full h-full px-2 border-2 border-emerald-500 rounded focus:outline-none text-sm text-slate-800"
                          />
                        </div>
                      ) : (
                        <div className="flex justify-between items-center w-full">
                          <span className="font-medium text-slate-800 group-hover:text-emerald-950">{record.name}</span>
                          <Edit3 className="h-3 w-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity ml-1.5" />
                        </div>
                      )}
                    </td>

                    {/* Date */}
                    <td 
                      className="px-3 py-2 border-r border-slate-200 relative cursor-pointer text-slate-600"
                      onDoubleClick={() => startEditing(record, "date")}
                      title="Double-click to edit date"
                    >
                      {editingCell?.id === record.id && editingCell?.field === "date" ? (
                        <div className="absolute inset-0 p-1 bg-white z-10 flex items-center">
                          <input
                            ref={cellInputRef}
                            type="date"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => saveCellEdit(record)}
                            onKeyDown={(e) => handleKeyDown(e, record)}
                            className="w-full h-full px-1.5 border-2 border-emerald-500 rounded focus:outline-none text-sm text-slate-700"
                          />
                        </div>
                      ) : (
                        <div className="flex justify-between items-center w-full">
                          <span>{record.date}</span>
                          <Edit3 className="h-3 w-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity ml-1.5" />
                        </div>
                      )}
                    </td>

                    {/* Time */}
                    <td 
                      className="px-3 py-2 border-r border-slate-200 relative cursor-pointer text-slate-600"
                      onDoubleClick={() => startEditing(record, "time")}
                      title="Double-click to edit time"
                    >
                      {editingCell?.id === record.id && editingCell?.field === "time" ? (
                        <div className="absolute inset-0 p-1 bg-white z-10 flex items-center">
                          <input
                            ref={cellInputRef}
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => saveCellEdit(record)}
                            onKeyDown={(e) => handleKeyDown(e, record)}
                            className="w-full h-full px-1.5 border-2 border-emerald-500 rounded focus:outline-none text-sm text-slate-700"
                          />
                        </div>
                      ) : (
                        <div className="flex justify-between items-center w-full">
                          <span>{record.time}</span>
                          <Edit3 className="h-3 w-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity ml-1.5" />
                        </div>
                      )}
                    </td>

                    {/* QR Code scanned token */}
                    <td className="px-3 py-2 border-r border-slate-200 text-xs text-slate-400 select-all font-mono truncate max-w-[150px]" title={record.code}>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold mr-1.5 ${record.code === 'MANUAL-INPUT' ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                        {record.code === 'MANUAL-INPUT' ? 'Manual' : 'QR Scan'}
                      </span>
                      {record.code.substring(0, 16)}...
                    </td>

                    {/* Submissions IP source info */}
                    <td className="px-3 py-2 border-r  border-slate-200 text-xs text-slate-500 font-sans truncate max-w-[120px]">
                      <div className="truncate" title={`${record.ip || "Unknown"} on ${record.device || "Unknown"}`}>
                        <span className="font-mono">{record.ip || "Web"}</span>
                        <span className="text-[10px] text-slate-400 block">{record.device}</span>
                      </div>
                    </td>

                    {/* Action buttons (Delete) */}
                    <td className="px-2 py-1.5 text-center flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Do you want to delete row #${rowIndex} (${record.name})?`)) {
                            onDeleteRecord(record.id);
                          }
                        }}
                        className="p-1 px-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-100 text-rose-600 hover:text-rose-700 rounded-lg transition-colors cursor-pointer"
                        title="Delete record from Excel"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Spreadsheet footer stats and database controls */}
      <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3">
        <div className="text-xs text-slate-500 font-sans flex items-center gap-3 flex-wrap">
          <span>Row count: <strong className="font-mono text-slate-700">{records.length}</strong> loaded</span>
          <span className="text-slate-300">|</span>
          <span>Today Present: <strong className="font-mono text-emerald-700">{records.filter(r => r.date === todayStr).length}</strong></span>
          <span className="text-slate-300">|</span>
          <span>Double-click cells to modify directly in the table!</span>
        </div>

        {records.length > 0 && (
          <div className="relative">
            {!showClearConfirm ? (
              <button
                type="button"
                onClick={() => setShowClearConfirm(true)}
                className="text-xs text-rose-600 font-bold hover:bg-rose-50 px-2 py-1.5 rounded transition-colors border border-transparent hover:border-rose-200 cursor-pointer"
              >
                Clear Excel Sheet Data
              </button>
            ) : (
              <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded p-1.5 z-10">
                <span className="text-xs text-rose-700 font-semibold flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Erase ALL logs?
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await onClearAll();
                    if (ok) setShowClearConfirm(false);
                  }}
                  className="px-2 py-1 bg-rose-600 hover:bg-rose-700 font-bold text-white rounded text-[10px] transition-colors cursor-pointer"
                >
                  Yes, Clear All
                </button>
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(false)}
                  className="px-2 py-1 bg-slate-200 hover:bg-slate-300 font-bold text-slate-700 rounded text-[10px] transition-colors cursor-pointer"
                >
                  No
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
