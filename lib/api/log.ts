type LogLevel = "info" | "warn" | "error";

export function log(level: LogLevel, msg: string, data?: Record<string, unknown>) {
  const entry = {
    level,
    msg,
    timestamp: new Date().toISOString(),
    ...data,
  };
  console[level === "error" ? "error" : "log"](JSON.stringify(entry));
}
