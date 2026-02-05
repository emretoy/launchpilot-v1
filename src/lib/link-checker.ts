import type { LinkInfo } from "./types";

const TIMEOUT = 5000;
const MAX_CONCURRENT = 10;

async function isLinkBroken(link: LinkInfo): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

    const res = await fetch(link.href, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; LaunchPilotBot/1.0; +https://launchpilot.dev)",
      },
    });

    clearTimeout(timeoutId);

    // Some servers don't support HEAD, try GET if 405
    if (res.status === 405) {
      const getRes = await fetch(link.href, {
        method: "GET",
        redirect: "follow",
        signal: AbortSignal.timeout(TIMEOUT),
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; LaunchPilotBot/1.0; +https://launchpilot.dev)",
        },
      });
      return getRes.status >= 400;
    }

    return res.status >= 400;
  } catch {
    // Network error or timeout = broken
    return true;
  }
}

export async function checkLinks(links: LinkInfo[]): Promise<LinkInfo[]> {
  const broken: LinkInfo[] = [];

  // Deduplicate by href
  const seen = new Set<string>();
  const unique = links.filter((link) => {
    if (seen.has(link.href)) return false;
    seen.add(link.href);
    return true;
  });

  // Process in batches to avoid overwhelming the target server
  for (let i = 0; i < unique.length; i += MAX_CONCURRENT) {
    const batch = unique.slice(i, i + MAX_CONCURRENT);
    const results = await Promise.all(
      batch.map(async (link) => ({
        link,
        isBroken: await isLinkBroken(link),
      }))
    );

    for (const { link, isBroken } of results) {
      if (isBroken) broken.push(link);
    }
  }

  return broken;
}
