export type HealthStatus = "healthy" | "degraded" | "unhealthy";

export type ServiceStatus = "up" | "down" | "unknown";

export type ServiceName = "convex" | "clerk" | "blob";

export interface ServiceCheckResult {
  status: ServiceStatus;
  latencyMs?: number;
  error?: string;
}

export type ServicesMap = Record<ServiceName, ServiceCheckResult>;

export interface HealthPayload {
  status: HealthStatus;
  timestamp: string;
  uptime: number;
  environment: string;
  version: string;
  services: ServicesMap;
  error?: string;
}

/**
 * Promote service-level states to overall health.
 * - Any "down" -> "degraded"
 * - Otherwise preserve provided fallback (defaults to "healthy")
 */
export function overallStatus(
  services: ServicesMap,
  fallback: HealthStatus = "healthy",
): HealthStatus {
  const hasDown = Object.values(services).some((service) => service.status === "down");

  if (hasDown) return "degraded";
  return fallback;
}
