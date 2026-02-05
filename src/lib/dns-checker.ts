import type { DNSResult } from "./types";

function extractDomain(url: string): string {
  return new URL(url).hostname.replace(/^www\./, "");
}

async function queryDNS(domain: string, type: string): Promise<unknown[]> {
  try {
    const res = await fetch(
      `https://dns.google/resolve?name=${domain}&type=${type}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.Answer || [];
  } catch {
    return [];
  }
}

export async function checkDNS(url: string): Promise<DNSResult> {
  try {
    const domain = extractDomain(url);

    const [aResults, mxResults, txtResults, nsResults] = await Promise.all([
      queryDNS(domain, "A"),
      queryDNS(domain, "MX"),
      queryDNS(domain, "TXT"),
      queryDNS(domain, "NS"),
    ]);

    const aRecords = aResults.map((r: unknown) => (r as { data: string }).data).filter(Boolean);

    const mxRecords = mxResults.map((r: unknown) => {
      const data = (r as { data: string }).data;
      // MX format: "10 mail.example.com."
      const parts = data.split(" ");
      return {
        priority: parseInt(parts[0]) || 0,
        exchange: parts.slice(1).join(" ").replace(/\.$/, ""),
      };
    });

    const txtRecords = txtResults.map((r: unknown) => {
      const data = (r as { data: string }).data;
      // Remove surrounding quotes
      return data.replace(/^"|"$/g, "");
    });

    const nameservers = nsResults.map((r: unknown) =>
      (r as { data: string }).data.replace(/\.$/, "")
    );

    // Check for SPF
    const hasSPF = txtRecords.some((txt) => txt.startsWith("v=spf1"));

    // Check for DMARC
    let hasDMARC = false;
    try {
      const dmarcResults = await queryDNS(`_dmarc.${domain}`, "TXT");
      hasDMARC = dmarcResults.some((r: unknown) =>
        (r as { data: string }).data.includes("v=DMARC1")
      );
    } catch {
      // DMARC kontrolü başarısız
    }

    return {
      aRecords,
      mxRecords,
      txtRecords: txtRecords.slice(0, 10), // limit
      hasSPF,
      hasDMARC,
      nameservers,
      error: null,
    };
  } catch (err) {
    return {
      aRecords: [],
      mxRecords: [],
      txtRecords: [],
      hasSPF: false,
      hasDMARC: false,
      nameservers: [],
      error: err instanceof Error ? err.message : "DNS kontrolü başarısız",
    };
  }
}
