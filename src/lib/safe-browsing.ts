import type { SafeBrowsingResult } from "./types";

export async function checkSafeBrowsing(url: string): Promise<SafeBrowsingResult> {
  const apiKey = process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    // API key yoksa, basit kontrol yap — varsayılan güvenli
    return {
      safe: true,
      threats: [],
      error: "Google API key yok — Safe Browsing atlandı",
    };
  }

  try {
    const res = await fetch(
      `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client: {
            clientId: "launchpilot",
            clientVersion: "1.0.0",
          },
          threatInfo: {
            threatTypes: [
              "MALWARE",
              "SOCIAL_ENGINEERING",
              "UNWANTED_SOFTWARE",
              "POTENTIALLY_HARMFUL_APPLICATION",
            ],
            platformTypes: ["ANY_PLATFORM"],
            threatEntryTypes: ["URL"],
            threatEntries: [{ url }],
          },
        }),
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!res.ok) {
      return {
        safe: true,
        threats: [],
        error: `Safe Browsing API hatası: ${res.status}`,
      };
    }

    const data = await res.json();
    const matches = data.matches || [];

    return {
      safe: matches.length === 0,
      threats: matches.map(
        (m: { threatType: string }) => m.threatType
      ),
      error: null,
    };
  } catch (err) {
    return {
      safe: true,
      threats: [],
      error: err instanceof Error ? err.message : "Safe Browsing kontrolü başarısız",
    };
  }
}
