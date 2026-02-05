import { UrlInput } from "@/components/url-input";
import { AuthButton } from "@/components/auth-button";

const categories = [
  { name: "Performans", desc: "PageSpeed & Core Web Vitals" },
  { name: "SEO", desc: "Meta tag'ler, başlıklar, sitemap" },
  { name: "Güvenlik", desc: "SSL, HTTP header'ları, Safe Browsing" },
  { name: "Erişilebilirlik", desc: "Alt tag, dil, erişim standartları" },
  { name: "Best Practices", desc: "HTML doğrulama, robots.txt, favicon" },
  { name: "Domain Güven", desc: "Domain yaşı, trust sinyalleri, DNS" },
  { name: "İçerik", desc: "Kelime sayısı, link yapısı, görseller" },
  { name: "Teknoloji", desc: "Analytics, platform, CSS framework" },
];

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center px-4">
      {/* Header */}
      <header className="w-full max-w-4xl flex items-center justify-between py-4">
        <span className="text-lg font-bold tracking-tight">LaunchPilot</span>
        <AuthButton />
      </header>

      <div className="flex-1 flex flex-col items-center justify-center">
      <div className="text-center space-y-6 max-w-2xl">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          LaunchPilot
        </h1>
        <p className="text-lg text-muted-foreground">
          Sitenizin tam kimlik taramasını yapın. 8 kategori, 100 üzerinden puanlama,
          detaylı rapor — tek bir yerde.
        </p>
        <UrlInput />
      </div>

      {/* Neleri Analiz Ediyoruz */}
      <div className="mt-16 max-w-3xl w-full">
        <h2 className="text-center text-sm font-medium text-muted-foreground uppercase tracking-wider mb-6">
          Neleri Analiz Ediyoruz?
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {categories.map((cat) => (
            <div
              key={cat.name}
              className="text-center p-4 rounded-xl border bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <p className="text-sm font-medium">{cat.name}</p>
              <p className="text-xs text-muted-foreground mt-1">{cat.desc}</p>
            </div>
          ))}
        </div>
      </div>
      </div>
    </main>
  );
}
