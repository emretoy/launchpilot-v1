import * as tls from "tls";
import type { SSLInfo } from "./types";

function getSSLCertificate(
  hostname: string,
  port = 443,
  timeoutMs = 10000
): Promise<tls.PeerCertificate | null> {
  return new Promise((resolve) => {
    const socket = tls.connect(
      { host: hostname, port, servername: hostname, rejectUnauthorized: false },
      () => {
        const cert = socket.getPeerCertificate();
        socket.destroy();
        resolve(cert && Object.keys(cert).length > 0 ? cert : null);
      }
    );

    socket.setTimeout(timeoutMs, () => {
      socket.destroy();
      resolve(null);
    });

    socket.on("error", () => {
      socket.destroy();
      resolve(null);
    });
  });
}

export async function checkSSL(url: string): Promise<SSLInfo> {
  try {
    const urlObj = new URL(url);

    if (urlObj.protocol !== "https:") {
      return {
        valid: false,
        issuer: null,
        expiresAt: null,
        daysUntilExpiry: null,
        protocol: null,
        error: "Site does not use HTTPS",
      };
    }

    const hostname = urlObj.hostname;
    const cert = await getSSLCertificate(hostname);

    if (!cert) {
      // TLS bağlantı kurulamadı — basit fetch ile sadece geçerliliği kontrol et
      try {
        const res = await fetch(url, {
          method: "HEAD",
          redirect: "follow",
          signal: AbortSignal.timeout(10000),
        });
        return {
          valid: res.ok || res.status < 500,
          issuer: null,
          expiresAt: null,
          daysUntilExpiry: null,
          protocol: "TLS",
          error: "Certificate details unavailable",
        };
      } catch {
        return {
          valid: false,
          issuer: null,
          expiresAt: null,
          daysUntilExpiry: null,
          protocol: null,
          error: "SSL connection failed",
        };
      }
    }

    // Sertifika bilgilerini çıkar
    const issuerParts: string[] = [];
    if (cert.issuer) {
      if (cert.issuer.O) issuerParts.push(cert.issuer.O);
      if (cert.issuer.CN && cert.issuer.CN !== cert.issuer.O) issuerParts.push(cert.issuer.CN);
    }
    const issuer = issuerParts.length > 0 ? issuerParts.join(" - ") : null;

    const expiresAt = cert.valid_to || null;
    let daysUntilExpiry: number | null = null;

    if (expiresAt) {
      const expDate = new Date(expiresAt);
      const now = new Date();
      daysUntilExpiry = Math.ceil(
        (expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
    }

    // Sertifikanın geçerli olup olmadığını kontrol et
    const now = new Date();
    const validFrom = cert.valid_from ? new Date(cert.valid_from) : null;
    const validTo = expiresAt ? new Date(expiresAt) : null;
    const valid = validFrom !== null && validTo !== null && now >= validFrom && now <= validTo;

    return {
      valid,
      issuer,
      expiresAt,
      daysUntilExpiry,
      protocol: "TLS",
      error: null,
    };
  } catch (err) {
    return {
      valid: false,
      issuer: null,
      expiresAt: null,
      daysUntilExpiry: null,
      protocol: null,
      error: err instanceof Error ? err.message : "SSL check failed",
    };
  }
}
