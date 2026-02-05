import type { SecurityHeadersResult } from "./types";

const IMPORTANT_HEADERS = [
  "Strict-Transport-Security",
  "Content-Security-Policy",
  "X-Content-Type-Options",
  "X-Frame-Options",
  "X-XSS-Protection",
  "Referrer-Policy",
  "Permissions-Policy",
];

function calculateGrade(presentCount: number, total: number): string {
  const ratio = presentCount / total;
  if (ratio >= 0.95) return "A+";
  if (ratio >= 0.85) return "A";
  if (ratio >= 0.7) return "B";
  if (ratio >= 0.5) return "C";
  if (ratio >= 0.3) return "D";
  return "F";
}

export async function checkSecurityHeaders(url: string): Promise<SecurityHeadersResult> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
    });

    const headers = IMPORTANT_HEADERS.map((name) => {
      const value = res.headers.get(name);
      return {
        name,
        present: value !== null,
        value,
      };
    });

    const presentCount = headers.filter((h) => h.present).length;
    const missingHeaders = headers.filter((h) => !h.present).map((h) => h.name);
    const grade = calculateGrade(presentCount, IMPORTANT_HEADERS.length);

    return {
      grade,
      headers,
      missingHeaders,
      error: null,
    };
  } catch (err) {
    return {
      grade: null,
      headers: [],
      missingHeaders: IMPORTANT_HEADERS,
      error: err instanceof Error ? err.message : "Security headers alınamadı",
    };
  }
}
