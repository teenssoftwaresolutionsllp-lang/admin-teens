export function isTeamReportDesignation(designation?: string | null) {
  const normalized = designation?.trim().toLowerCase() ?? "";

  return (
    /\bmanager\b/.test(normalized) ||
    /\bmanger\b/.test(normalized) ||
    /\bceo\b/.test(normalized) ||
    /\bcto\b/.test(normalized) ||
    normalized.includes("chief executive officer") ||
    normalized.includes("chief technology officer")
  );
}
