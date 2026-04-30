/**
 * Status page payload builders.
 */

import { normalizeStatusAudience } from "./validators.js";

export function buildStatusCurrentPayload(current, { site, audience }) {
  const components = Array.isArray(current.components)
    ? current.components.filter((component) => {
        if (site && String(component.domain).toLowerCase() !== site) {
          return false;
        }
        if (audience && normalizeStatusAudience(component.kind) !== audience) {
          return false;
        }
        return true;
      })
    : [];
  const affectedComponents = components.filter((component) => component.status && component.status !== "ok");
  const unresolvedIncidents = affectedComponents.flatMap((component) => {
    const incidents = Array.isArray(component.incidents) ? component.incidents : [];
    return incidents
      .filter((incident) => incident && !incident.end_ts)
      .map((incident) => ({
        label: component.label ?? `${component.domain} · ${component.kind}`,
        domain: component.domain,
        kind: component.kind,
        status: incident.status,
        startTs: incident.start_ts,
      }));
  });

  return {
    resource: "status-current",
    source: "https://bgm-status.ry.mk/api/status",
    updatedAt: current.updated_at,
    upstreamStatus: current.status,
    upstreamMessage: current.message,
    monitored: components.length,
    affected: affectedComponents.length,
    status: summarizeCurrentStatus(components),
    filters: {
      site,
      audience,
    },
    affectedComponents: affectedComponents.map((component) => ({
      label: component.label ?? `${component.domain} · ${component.kind}`,
      domain: component.domain,
      kind: component.kind,
      status: component.status,
      lastCheck: component.last_check,
    })),
    unresolvedIncidents,
  };
}

export function summarizeCurrentStatus(components) {
  let worst = "ok";
  for (const component of components) {
    if (component?.status === "down") {
      return "down";
    }
    if (component?.status === "degraded") {
      worst = "degraded";
    }
  }
  return worst;
}
