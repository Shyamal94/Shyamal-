export interface AttendanceRecord {
  id: string;
  name: string;
  date: string;       // format: YYYY-MM-DD
  time: string;       // format: HH:MM:SS
  timestamp: number;  // epoch millis
  code: string;       // QR code scanned
  ip?: string;
  device?: string;
}

export interface AdminConfig {
  isAdminSet: boolean;
  username: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
}

export interface DailyCodeInfo {
  date: string;
  code: string;
  active: boolean;
}
