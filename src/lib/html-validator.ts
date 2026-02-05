import type { HTMLValidationResult } from "./types";

interface W3CMessage {
  type: "error" | "info" | "warning";
  message: string;
  lastLine?: number;
  subType?: string;
}

export async function validateHTML(url: string): Promise<HTMLValidationResult> {
  try {
    const res = await fetch(
      `https://validator.w3.org/nu/?doc=${encodeURIComponent(url)}&out=json`,
      {
        headers: {
          "User-Agent": "LaunchPilot/1.0",
        },
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!res.ok) {
      return {
        errors: 0,
        warnings: 0,
        details: [],
        error: `W3C Validator yanıt vermedi: ${res.status}`,
      };
    }

    const data = await res.json();
    const messages: W3CMessage[] = data.messages || [];

    const errors = messages.filter((m) => m.type === "error");
    const warnings = messages.filter(
      (m) => m.type === "info" && m.subType === "warning"
    );

    const details = messages.slice(0, 20).map((m) => ({
      type: m.type === "error" ? "error" : "warning",
      message: m.message,
      line: m.lastLine || null,
    }));

    return {
      errors: errors.length,
      warnings: warnings.length,
      details,
      error: null,
    };
  } catch (err) {
    return {
      errors: 0,
      warnings: 0,
      details: [],
      error: err instanceof Error ? err.message : "HTML doğrulama başarısız",
    };
  }
}
