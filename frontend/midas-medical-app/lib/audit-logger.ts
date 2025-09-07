// Audit logging utility for HIPAA compliance
export interface AuditLogEntry {
  userId: string
  userName: string
  action: string
  resourceType: string
  resourceId: string
  ipAddress: string
  userAgent: string
  details: string
  riskLevel: "low" | "medium" | "high"
  timestamp: string
}

export class AuditLogger {
  private static instance: AuditLogger
  private logs: AuditLogEntry[] = []

  private constructor() {}

  public static getInstance(): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger()
    }
    return AuditLogger.instance
  }

  public async log(entry: Omit<AuditLogEntry, "timestamp">): Promise<void> {
    const auditEntry: AuditLogEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
    }

    // In production, this would write to a secure audit database
    this.logs.push(auditEntry)

    // Log to console for development
    console.log("[AUDIT]", auditEntry)

    // TODO: In production, implement:
    // - Write to secure audit database
    // - Send to SIEM system
    // - Trigger alerts for high-risk events
    // - Ensure tamper-proof logging
  }

  public async getLogs(filters?: {
    userId?: string
    action?: string
    riskLevel?: string
    startDate?: Date
    endDate?: Date
  }): Promise<AuditLogEntry[]> {
    let filteredLogs = [...this.logs]

    if (filters) {
      if (filters.userId) {
        filteredLogs = filteredLogs.filter((log) => log.userId === filters.userId)
      }
      if (filters.action) {
        filteredLogs = filteredLogs.filter((log) => log.action === filters.action)
      }
      if (filters.riskLevel) {
        filteredLogs = filteredLogs.filter((log) => log.riskLevel === filters.riskLevel)
      }
      if (filters.startDate) {
        filteredLogs = filteredLogs.filter((log) => new Date(log.timestamp) >= filters.startDate!)
      }
      if (filters.endDate) {
        filteredLogs = filteredLogs.filter((log) => new Date(log.timestamp) <= filters.endDate!)
      }
    }

    return filteredLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }
}

// Audit action constants
export const AUDIT_ACTIONS = {
  USER_LOGIN: "USER_LOGIN",
  USER_LOGOUT: "USER_LOGOUT",
  USER_CREATED: "USER_CREATED",
  USER_UPDATED: "USER_UPDATED",
  USER_DELETED: "USER_DELETED",
  PASSWORD_RESET: "PASSWORD_RESET",
  IMAGE_UPLOADED: "IMAGE_UPLOADED",
  ANALYSIS_CREATED: "ANALYSIS_CREATED",
  ANALYSIS_REVIEWED: "ANALYSIS_REVIEWED",
  REPORT_GENERATED: "REPORT_GENERATED",
  DATA_EXPORT: "DATA_EXPORT",
  SYSTEM_CONFIG_CHANGED: "SYSTEM_CONFIG_CHANGED",
  SECURITY_ALERT: "SECURITY_ALERT",
} as const

// Risk level determination
export function determineRiskLevel(action: string, resourceType: string): "low" | "medium" | "high" {
  const highRiskActions = ["DATA_EXPORT", "USER_DELETED", "SYSTEM_CONFIG_CHANGED", "SECURITY_ALERT"]
  const mediumRiskActions = ["USER_CREATED", "ANALYSIS_REVIEWED", "PASSWORD_RESET", "REPORT_GENERATED"]

  if (highRiskActions.includes(action)) {
    return "high"
  } else if (mediumRiskActions.includes(action)) {
    return "medium"
  } else {
    return "low"
  }
}
