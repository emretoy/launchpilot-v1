// ── Site Analysis Types ──

export interface SiteAnalysisRequest {
  url: string;
}

// ── Basic Info ──
export interface BasicInfo {
  url: string;
  finalUrl: string;
  title: string;
  metaDescription: string;
  favicon: string | null;
  language: string | null;
  charset: string | null;
}

// ── Heading Structure ──
export interface HeadingInfo {
  tag: string;
  text: string;
}

export interface HeadingStructure {
  h1: HeadingInfo[];
  h2: HeadingInfo[];
  h3: HeadingInfo[];
  totalH1: number;
  totalH2: number;
  totalH3: number;
}

// ── Meta & SEO ──
export interface MetaSEO {
  canonical: string | null;
  robots: string | null;
  ogTags: Record<string, string>;
  twitterTags: Record<string, string>;
  hreflang: { lang: string; href: string }[];
  viewport: string | null;
}

// ── Content Stats ──
export interface ContentStats {
  wordCount: number;
  paragraphCount: number;
  contentToCodeRatio: number;
}

// ── Links ──
export interface LinkInfo {
  href: string;
  text: string;
  isExternal: boolean;
}

export interface LinksAnalysis {
  internal: LinkInfo[];
  external: LinkInfo[];
  broken: LinkInfo[];
  totalInternal: number;
  totalExternal: number;
  totalBroken: number;
}

// ── Images ──
export interface ImageInfo {
  src: string;
  alt: string | null;
  width: string | null;
  height: string | null;
}

export interface ImagesAnalysis {
  total: number;
  missingAlt: ImageInfo[];
  totalMissingAlt: number;
  images: ImageInfo[];
}

// ── Technical ──
export interface TechnicalInfo {
  hasSchemaOrg: boolean;
  schemaTypes: string[];
  hasSitemap: boolean;
  sitemapUrl: string | null;
  sitemapPageCount: number | null;
  hasRobotsTxt: boolean;
  robotsTxtContent: string | null;
}

// ── Technology Detection ──
export interface TechDetection {
  platform: string | null;
  confidence: number;
  signals: string[];
}

// ── Security ──
export interface SecurityInfo {
  isHttps: boolean;
  hasMixedContent: boolean;
  mixedContentUrls: string[];
}

// ── SSL ──
export interface SSLInfo {
  valid: boolean;
  issuer: string | null;
  expiresAt: string | null;
  daysUntilExpiry: number | null;
  protocol: string | null;
  error: string | null;
}

// ── PageSpeed ──
export interface PageSpeedScores {
  performance: number | null;
  accessibility: number | null;
  bestPractices: number | null;
  seo: number | null;
}

export interface CoreWebVitals {
  lcp: number | null;
  fid: number | null;
  cls: number | null;
  inp: number | null;
  ttfb: number | null;
}

export interface PageSpeedResult {
  scores: PageSpeedScores;
  webVitals: CoreWebVitals;
  error: string | null;
}

// ── Crawl Result ──
export interface CrawlResult {
  basicInfo: BasicInfo;
  headings: HeadingStructure;
  metaSEO: MetaSEO;
  content: ContentStats;
  links: LinksAnalysis;
  images: ImagesAnalysis;
  technical: TechnicalInfo;
  techDetection: TechDetection;
  security: SecurityInfo;
}

// ── Domain Info ──
export interface DomainInfo {
  domainAge: number | null; // gün cinsinden
  registrar: string | null;
  createdDate: string | null;
  firstArchiveDate: string | null;
  error: string | null;
}

// ── Security Headers ──
export interface SecurityHeadersResult {
  grade: string | null; // A+ - F
  headers: {
    name: string;
    present: boolean;
    value: string | null;
  }[];
  missingHeaders: string[];
  error: string | null;
}

// ── Safe Browsing ──
export interface SafeBrowsingResult {
  safe: boolean;
  threats: string[];
  error: string | null;
}

// ── DNS ──
export interface DNSResult {
  aRecords: string[];
  mxRecords: { exchange: string; priority: number }[];
  txtRecords: string[];
  hasSPF: boolean;
  hasDMARC: boolean;
  nameservers: string[];
  error: string | null;
}

// ── HTML Validation ──
export interface HTMLValidationResult {
  errors: number;
  warnings: number;
  details: { type: string; message: string; line: number | null }[];
  error: string | null;
}

// ── Page Analysis ──
export interface PageAnalysis {
  analytics: {
    hasGoogleAnalytics: boolean;
    hasGTM: boolean;
    hasMetaPixel: boolean;
    hasHotjar: boolean;
    otherTools: string[];
  };
  socialLinks: { platform: string; url: string }[];
  cta: {
    forms: number;
    buttons: number;
    hasContactForm: boolean;
  };
  trustSignals: {
    hasPrivacyPolicy: boolean;
    hasTerms: boolean;
    hasContactInfo: boolean;
    hasPhoneNumber: boolean;
    hasEmail: boolean;
    hasAddress: boolean;
  };
  fonts: string[];
  cssFrameworks: string[];
  cookieConsent: {
    detected: boolean;
    patterns: string[];
  };
}

// ── Online Presence ──
export interface GoogleIndexResult {
  isIndexed: boolean;
  indexedPageCount: number;
  hasRichSnippet: boolean;
  serpAppearance: string | null; // ilk SERP sonucu özeti
  brandMentions: number;
  noData?: boolean; // API key yoksa true
}

export interface SocialProfileVerification {
  platform: string;
  url: string;
  accessible: boolean;
}

export interface SocialPresenceResult {
  profiles: SocialProfileVerification[];
  totalVerified: number;
  totalInvalid: number;
}

export interface WebmasterVerification {
  google: boolean;
  bing: boolean;
  yandex: boolean;
}

export interface WaybackHistory {
  firstSnapshot: string | null; // ISO date
  lastSnapshot: string | null;
  snapshotCount: number;
  websiteAge: number | null; // yıl cinsinden
}

export interface StructuredDataCompleteness {
  schemaTypes: string[];
  schemaComplete: boolean; // en az 1 schema + @type var
  ogComplete: boolean; // og:title + og:description + og:image
  twitterCardComplete: boolean; // twitter:card + twitter:title
}

export interface OnlinePresenceResult {
  googleIndex: GoogleIndexResult;
  socialPresence: SocialPresenceResult;
  webmasterTags: WebmasterVerification;
  waybackHistory: WaybackHistory;
  structuredData: StructuredDataCompleteness;
}

// ── Scoring ──
export interface CategoryScore {
  score: number; // 0-100
  label: string;
  color: "green" | "lime" | "yellow" | "orange" | "red";
  details: string[];
  noData?: boolean; // Veri kaynağı yoksa true — skor hesaba katılmaz
}

export interface ScoringResult {
  overall: number; // 0-100
  overallColor: "green" | "lime" | "yellow" | "orange" | "red";
  categories: {
    performance: CategoryScore;
    seo: CategoryScore;
    security: CategoryScore;
    accessibility: CategoryScore;
    bestPractices: CategoryScore;
    domainTrust: CategoryScore;
    content: CategoryScore;
    technology: CategoryScore;
    onlinePresence: CategoryScore;
  };
}

// ── Full Analysis Result (eski, geri uyumluluk) ──
export interface AnalysisResult {
  crawl: CrawlResult;
  pageSpeed: PageSpeedResult;
  ssl: SSLInfo;
  analyzedAt: string;
  duration: number;
}

// ── Recommendations ──
export interface Recommendation {
  category: string;
  priority: "critical" | "high" | "medium" | "low";
  title: string;
  description: string;
  howTo: string;
  effort: "Kolay" | "Orta" | "Zor";
}

// ── Treatment Plan ──
export interface TreatmentPhase {
  id: "acil" | "temel" | "ileri";
  name: string;
  description: string;
  steps: Recommendation[];
}

export interface TreatmentPlan {
  phases: TreatmentPhase[];
  totalSteps: number;
}

// ── Scan History (localStorage) ──
export interface ScanHistoryEntry {
  url: string;
  overallScore: number;
  categoryScores: Record<string, number>;
  recommendationKeys?: string[];
  analyzedAt: string;
}

// ── Validation ──
export interface ValidationCheckResult {
  field: string;
  verified: boolean;
  reason?: string;
}

export interface ValidationSummary {
  totalChecks: number;
  verified: number;
  unverified: number;
  filtered: number;
  verificationScore: number; // 0-100
  duration: number; // ms
  checks: ValidationCheckResult[];
}

// ── Website DNA Types ──
export type DNASiteType = "e-commerce" | "blog" | "corporate" | "saas" | "portfolio" | "landing-page" | "forum" | "news" | "directory" | "education" | "unknown";
export type DNATargetAudience = "B2B" | "B2C" | "both" | "unknown";
export type DNAMarketScope = "local" | "national" | "global" | "unknown";
export type DNAMaturityLevel = "newborn" | "young" | "growing" | "mature" | "veteran";
export type DNASiteScale = "single-page" | "small" | "medium" | "large" | "enterprise";
export type DNARevenueModelType = "e-commerce" | "advertising" | "saas" | "lead-generation" | "content-media" | "non-profit" | "unknown";

export interface DNAIdentity {
  siteType: DNASiteType;
  siteTypeConfidence: number; // 0-100
  industry: string | null;
  brandName: string;
  signals: string[];
}

export interface DNATargetMarket {
  audience: DNATargetAudience;
  marketScope: DNAMarketScope;
  languages: string[];
  primaryLanguage: string | null;
}

export interface DNAMaturity {
  level: DNAMaturityLevel;
  score: number; // 0-100
  signals: string[];
}

export interface DNAScale {
  level: DNASiteScale;
  estimatedPages: number | null;
  signals: string[];
}

export interface DNARevenueModel {
  primary: DNARevenueModelType;
  signals: string[];
}

export interface DNAContact {
  methods: string[];
  socialPlatforms: string[];
  hasPhysicalAddress: boolean;
}

export interface DNATechStack {
  platform: string | null;
  jsFramework: string | null;
  hosting: string | null;
  emailProvider: string | null;
  cdnProvider: string | null;
  marketingTools: string[];
}

export interface DNALegalTrust {
  hasPrivacyPolicy: boolean;
  hasTerms: boolean;
  hasKVKK: boolean;
  hasCookieConsent: boolean;
  sslDetails: string | null;
}

export interface DNAContentStructure {
  hasBlog: boolean;
  hasAuth: boolean;
  hasSearch: boolean;
  hasMobileApp: boolean;
  hasNewsletter: boolean;
  hasEcommerce: boolean;
}

export interface DNAAISynthesis {
  summary: string | null;
  sophisticationScore: number | null; // 0-100
  growthStage: string | null;
}

export interface WebsiteDNA {
  identity: DNAIdentity;
  targetMarket: DNATargetMarket;
  maturity: DNAMaturity;
  scale: DNAScale;
  revenueModel: DNARevenueModel;
  contact: DNAContact;
  techStack: DNATechStack;
  legalTrust: DNALegalTrust;
  contentStructure: DNAContentStructure;
  aiSynthesis: DNAAISynthesis;
}

// ── SEO Authority Report ──
export interface AuthoritySubScore {
  score: number;
  max: number;
  label: string;
  details: string[];
  noData?: boolean;
}

export interface SEOAuthorityReport {
  overall: number;   // 0-100
  color: CategoryScore["color"];
  verdict: "onay" | "guclendir" | "yeniden-yapilandir";
  categories: {
    intent: AuthoritySubScore;          // max 20
    topicalAuthority: AuthoritySubScore; // max 20
    technical: AuthoritySubScore;        // max 20
    trust: AuthoritySubScore;            // max 20
    backlinkMention: AuthoritySubScore;  // max 20
  };
  communityInsights: string[];  // Reddit alıntıları (skorlara göre seçilir)
  actionPlan: string[];         // 30 günlük plan (verdict'e göre)
}

// ── GEO Authority Report ──
export interface GEOAuthorityReport {
  overall: number;   // 0-100
  color: CategoryScore["color"];
  verdict: "onay" | "guclendir" | "yeniden-yapilandir";
  categories: {
    seoFoundation: AuthoritySubScore;    // max 20
    structuredData: AuthoritySubScore;   // max 20
    citability: AuthoritySubScore;       // max 20
    brandMention: AuthoritySubScore;     // max 20
    llmVisibility: AuthoritySubScore;    // max 20
  };
  communityInsights: string[];
  actionPlan: string[];
}

// ── AEO Authority Report ──
export interface AEOAuthorityReport {
  overall: number;   // 0-100
  color: CategoryScore["color"];
  verdict: "onay" | "guclendir" | "yeniden-yapilandir";
  categories: {
    answerBlocks: AuthoritySubScore;      // max 20
    faqHowToSchema: AuthoritySubScore;    // max 20
    snippetTargeting: AuthoritySubScore;  // max 20
    intentMatch: AuthoritySubScore;       // max 20
    measurement: AuthoritySubScore;       // max 20
  };
  communityInsights: string[];
  actionPlan: string[];
}

// ── Backlink Authority Report ──
export interface BacklinkAuthorityReport {
  overall: number;   // 0-100
  color: CategoryScore["color"];
  verdict: "onay" | "guclendir" | "yeniden-yapilandir";
  categories: {
    relevance: AuthoritySubScore;          // max 30
    trafficSignal: AuthoritySubScore;      // max 20
    linkDiversity: AuthoritySubScore;      // max 20
    anchorNaturalness: AuthoritySubScore;  // max 10
    mentionSignal: AuthoritySubScore;      // max 20
  };
  communityInsights: string[];
  actionPlan: string[];
}

// ── Blog Authority Report ──
export interface BlogAuthorityReport {
  overall: number;   // 0-100
  color: CategoryScore["color"];
  verdict: "onay" | "guclendir" | "yeniden-yapilandir";
  categories: {
    contentDepth: AuthoritySubScore;       // max 30
    pillarCluster: AuthoritySubScore;      // max 20
    originality: AuthoritySubScore;        // max 15
    assetProduction: AuthoritySubScore;    // max 15
    trustSignals: AuthoritySubScore;       // max 10
    distributionSignal: AuthoritySubScore; // max 10
  };
  communityInsights: string[];
  actionPlan: string[];
}

// ── Task (Görev Yönetimi) ──
export interface Task {
  id: string;
  user_id: string;
  domain: string;
  category: string;
  priority: "critical" | "high" | "medium" | "low";
  title: string;
  description: string;
  how_to: string;
  effort: "Kolay" | "Orta" | "Zor";
  recommendation_key: string;
  status: "pending" | "completed" | "verified" | "regressed";
  completed_at: string | null;
  verified_at: string | null;
  scan_id: string | null;
  created_at: string;
}

// ── Blog Topic Scanner Types ──

export interface BlogTopic {
  id: string;
  user_id: string;
  domain: string;
  title: string;
  description: string | null;
  source: string;
  source_detail: string | null;
  relevance_score: number;
  difficulty: "Kolay" | "Orta" | "Zor";
  search_volume: "Düşük" | "Orta" | "Yüksek";
  category: string | null;
  keywords: string[];
  suggested_format: string | null;
  status: "suggested" | "planned" | "writing" | "published" | "rejected";
  planned_date: string | null;
  scan_id: string | null;
  created_at: string;
}

export interface BlogTopicScanRequest {
  domain: string;
  industry: string;
  siteType: string;
  language: string;
  country: string;
  brandName: string;
  dnaSummary: string | null;
  blogAuthorityScore: number | null;
}

export interface BlogTopicScanResult {
  topics: BlogTopic[];
  sourceStats: {
    autocomplete: number;
    paa: number;
    reddit: number;
    competitor: number;
    trends: number;
    ai: number;
  };
  scanDuration: number;
}

// ── Full Analysis Result (Part 1 — yeni her şey dahil) ──
export interface FullAnalysisResult {
  crawl: CrawlResult;
  pageSpeed: PageSpeedResult;
  ssl: SSLInfo;
  domainInfo: DomainInfo;
  securityHeaders: SecurityHeadersResult;
  safeBrowsing: SafeBrowsingResult;
  dns: DNSResult;
  htmlValidation: HTMLValidationResult;
  pageAnalysis: PageAnalysis;
  scoring: ScoringResult;
  recommendations: Recommendation[];
  treatmentPlan?: TreatmentPlan;
  dna?: WebsiteDNA;
  onlinePresence?: OnlinePresenceResult;
  seoAuthority?: SEOAuthorityReport;
  geoAuthority?: GEOAuthorityReport;
  aeoAuthority?: AEOAuthorityReport;
  backlinkAuthority?: BacklinkAuthorityReport;
  blogAuthority?: BlogAuthorityReport;
  aiSummary?: string | null;
  aiPrompt?: string | null;
  validationSummary?: ValidationSummary | null;
  analyzedAt: string;
  duration: number;
}
