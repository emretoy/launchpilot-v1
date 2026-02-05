import type { DomainInfo } from "./types";

function extractDomain(url: string): string {
  const hostname = new URL(url).hostname;
  // Remove www. prefix
  return hostname.replace(/^www\./, "");
}

async function getRDAPInfo(domain: string): Promise<{ registrar: string | null; createdDate: string | null }> {
  try {
    const res = await fetch(`https://rdap.org/domain/${domain}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return { registrar: null, createdDate: null };

    const data = await res.json();

    let registrar: string | null = null;
    if (data.entities) {
      for (const entity of data.entities) {
        if (entity.roles?.includes("registrar")) {
          registrar = entity.vcardArray?.[1]?.find((v: string[]) => v[0] === "fn")?.[3] || null;
          if (!registrar && entity.handle) {
            registrar = entity.handle;
          }
        }
      }
    }

    let createdDate: string | null = null;
    if (data.events) {
      const regEvent = data.events.find((e: { eventAction: string }) => e.eventAction === "registration");
      if (regEvent) {
        createdDate = regEvent.eventDate;
      }
    }

    return { registrar, createdDate };
  } catch {
    return { registrar: null, createdDate: null };
  }
}

async function getWebArchiveDate(domain: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://archive.org/wayback/available?url=${domain}&timestamp=19900101`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return null;

    const data = await res.json();
    const timestamp = data.archived_snapshots?.closest?.timestamp;
    if (!timestamp) return null;

    // Format: YYYYMMDDHHmmss → YYYY-MM-DD
    return `${timestamp.slice(0, 4)}-${timestamp.slice(4, 6)}-${timestamp.slice(6, 8)}`;
  } catch {
    return null;
  }
}

function calculateDomainAge(createdDate: string | null, archiveDate: string | null): number | null {
  const dateStr = createdDate || archiveDate;
  if (!dateStr) return null;

  const created = new Date(dateStr);
  if (isNaN(created.getTime())) return null;

  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export async function getDomainInfo(url: string): Promise<DomainInfo> {
  try {
    const domain = extractDomain(url);

    const [rdap, archiveDate] = await Promise.all([
      getRDAPInfo(domain),
      getWebArchiveDate(domain),
    ]);

    const domainAge = calculateDomainAge(rdap.createdDate, archiveDate);

    return {
      domainAge,
      registrar: rdap.registrar,
      createdDate: rdap.createdDate,
      firstArchiveDate: archiveDate,
      error: null,
    };
  } catch (err) {
    return {
      domainAge: null,
      registrar: null,
      createdDate: null,
      firstArchiveDate: null,
      error: err instanceof Error ? err.message : "Domain info alınamadı",
    };
  }
}
