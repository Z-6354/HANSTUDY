/** 应用运行日志信息（工作区根目录 logs/ 与 audit/） */

export interface AppLogInfo {
  logDir: string
  currentLogFile: string
  auditDir: string
  currentAuditFile: string
}
