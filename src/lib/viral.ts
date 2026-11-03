import { invoke } from "@tauri-apps/api/core";

export const SERIES = ["Zombie in America", "Animals Gone Crazy", "Humans vs Monsters", "AI World Gone Wrong", "MADMAN Dark Comedy"];
const SERIES_LABELS = ["Zombie v Americe", "Zvířata se zbláznila", "Lidé proti příšerám", "Svět AI se pokazil", "MADMAN černá komedie"];
export const seriesLabel = (series: string) => SERIES_LABELS[SERIES.indexOf(series)] ?? series;
const STATUSES: Record<string, string> = {
  draft: "rozpracováno", approved: "schváleno", rejected: "zamítnuto", running: "probíhá",
  complete: "dokončeno", cancelled: "zastaveno", failed: "chyba", interrupted: "přerušeno",
};
export const viralStatus = (status: string) => STATUSES[status] ?? status;
const ERRORS: Record<string, string> = {
  YOUTUBE_KEY_MISSING: "Nejprve v části Objevování uložte API klíč pro YouTube.",
  KEYCHAIN_UNAVAILABLE: "Správce pověření Windows není dostupný. Klíč se nepodařilo načíst nebo uložit.",
  INVALID_STORED_KEY: "Uložený klíč nelze načíst. Zadejte ho prosím znovu.",
  INVALID_KEY_FORMAT: "Zkontrolujte formát API klíče z Google Cloud.",
  POLICY_ACCEPTANCE_REQUIRED: "Před uložením klíče potvrďte seznámení s informacemi o datech a podmínkami YouTube.",
  DISCOVERY_BUSY: "Vyhledávání už probíhá. Počkejte na jeho dokončení.",
  CANCELLED: "Vyhledávání bylo zastaveno.",
  LOCAL_QUOTA_EXHAUSTED: "Byl vyčerpán místní limit požadavků. Další kapacita se uvolní během následujících 24 hodin.",
  YOUTUBE_FORBIDDEN: "YouTube požadavek odmítl. V Google Cloud zkontrolujte klíč, zapnutí YouTube Data API v3, omezení klíče a kvótu.",
  YOUTUBE_AUTH_OR_REQUEST_REJECTED: "YouTube odmítl přihlášení nebo požadavek. Zkontrolujte API klíč a nastavení služby.",
  YOUTUBE_TEMPORARILY_UNAVAILABLE: "YouTube je dočasně nedostupný. Zkuste hledání později.",
  YOUTUBE_INVALID_RESPONSE: "YouTube vrátil neplatnou odpověď. Zkuste hledání znovu.",
  YOUTUBE_RESPONSE_READ_FAILED: "Odpověď YouTube se nepodařilo načíst. Zkontrolujte připojení a zkuste to znovu.",
  STALE_PLAN: "Existuje novější verze námětu. Načtěte ji opětovným výběrem námětu.",
  MANUAL_REVIEW_REQUIRED: "Před schválením potvrďte ruční kontrolu uložené verze.",
  APPROVED_REVISION_REQUIRED: "Exportovat lze pouze aktuální ručně schválenou verzi.",
  OUTPUT_EXISTS: "Tento produkční balíček už ve vybrané složce existuje. Vyberte jinou složku.",
  EXPORT_FOLDER_UNAVAILABLE: "Ve vybrané složce nelze vytvořit produkční balíček. Zkontrolujte přístup a volné místo.",
  EXPORT_FINALIZE_FAILED: "Dokončení exportu se nezdařilo. Zkontrolujte vybranou složku.",
  PLAN_REQUIRES_EN_US_9_16: "Produkční plán musí používat americkou angličtinu a formát 9:16.",
  DURATION_REQUIRES_10_TO_30_SECONDS: "Celková délka musí být 10 až 30 sekund.",
  PLAN_REQUIRES_2_TO_12_SHOTS: "Produkční plán musí obsahovat 2 až 12 záběrů.",
  PLAN_REQUIRED_TEXT_MISSING_OR_TOO_LONG: "Vyplňte všechny povinné údaje a zkraťte příliš dlouhé texty.",
  SHOT_TIMELINE_INVALID: "Záběry musí navazovat bez mezer a překryvů. Zkontrolujte jejich začátky a konce.",
  SHOT_TIMELINE_INCOMPLETE: "Konec posledního záběru musí odpovídat celkové délce videa.",
  SHOT_REQUIRED_TEXT_MISSING_OR_TOO_LONG: "Doplňte děj, prompty, kameru a zvuk u každého záběru. Příliš dlouhé texty zkraťte.",
  SHOT_TEXT_TOO_LONG: "Dialog nebo titulek je příliš dlouhý. Zkraťte ho a zkuste uložit znovu.",
  INVALID_EDITORIAL_RUBRIC: "Body hodnocení nesmějí překročit maxima uvedená u jednotlivých kritérií.",
  INVALID_HASHTAGS: "Zadejte 1 až 12 hashtagů začínajících #. Oddělte je mezerami; uvnitř hashtagu mezery být nesmějí.",
  NOTES_TOO_LONG: "Poznámky jsou příliš dlouhé. Zkraťte je a zkuste uložit znovu.",
  VIDEO_NOT_FOUND: "Původní video už není v místní databázi. Obnovte přehled.",
  PLAN_NOT_FOUND: "Námět nebyl nalezen. Obnovte přehled.",
  RUN_INTERRUPTED: "Předchozí vyhledávání bylo přerušeno. Můžete spustit nové.",
  CREATE_STORAGE_FAILED: "Nelze vytvořit místní úložiště. Zkontrolujte oprávnění a volné místo.",
  LOCAL_STORAGE_UNAVAILABLE: "Místní úložiště aplikace není dostupné.",
  STORAGE_INITIALIZATION_FAILED: "Databázi se nepodařilo otevřít. Zkuste aplikaci spustit znovu.",
  VIRAL_WORKER_FAILED: "Pracovní proces selhal. Obnovte přehled a zkuste akci znovu.",
};
export function viralError(error: unknown): string {
  const message = String(error);
  const code = message.match(/\b[A-Z][A-Z_]{3,}\b/)?.[0];
  if (code && ERRORS[code]) return ERRORS[code];
  if (/database.*locked/i.test(message)) return "Databázi právě používá jiná operace. Chvíli počkejte a obnovte přehled.";
  if (/disk.*full|database or disk is full/i.test(message)) return "Na disku není dostatek místa. Uvolněte místo a zkuste akci znovu.";
  return "Akci se nepodařilo dokončit. Obnovte přehled a zkuste to znovu.";
}

export function formatViralReport(raw: string): string {
  const report = JSON.parse(raw) as {
    generatedAt: number; top20: import("./viral-types").ViralVideo[];
    top5Adaptations: import("./viral-types").ViralProject[];
    top3Ready: import("./viral-types").ViralProject[];
  };
  const count = (n: number | null) => n === null ? "N/A" : n.toLocaleString("cs-CZ");
  const listPlans = (plans: typeof report.top5Adaptations) => plans.length ? plans.map((p, i) => `${i + 1}. ${p.plan.title} — ${viralStatus(p.status)}, verze ${p.revision}, ${p.plan.durationSeconds} s`).join("\n") : "Zatím žádné náměty.";
  return ["MADMAN STUDIO — denní přehled", `Vytvořeno: ${new Date(report.generatedAt * 1000).toLocaleString("cs-CZ")}`,
    "Výběr ze získaného vzorku, nikoli úplný žebříček YouTube.", "", "NALEZENÁ VIDEA (nejvýše 20)",
    report.top20.length ? report.top20.map((v, i) => `${i + 1}. ${v.title} — ${v.author}\nZhlédnutí: ${count(v.views)}; To se mi líbí: ${count(v.likes)}; Komentáře: ${count(v.comments)}\nhttps://www.youtube.com/watch?v=${v.id}`).join("\n\n") : "Zatím nebyla nalezena žádná videa.",
    "", "VLASTNÍ NÁMĚTY (nejvýše 5)", listPlans(report.top5Adaptations), "", "SCHVÁLENO K VÝROBĚ (nejvýše 3)", listPlans(report.top3Ready),
    "", "Trendy a denní srovnání: N/A — odvozená analytika čeká na povolení YouTube.", "Automatické zveřejňování: vypnuto.",
  ].join("\n");
}
export type { ViralVideo, ViralPlan, ViralShot, ViralProject } from "./viral-types";
import type { ViralDashboard } from "./viral-types";
export interface ViralState {
  keyConfigured: boolean; keyError: string | null; busy: boolean;
  dashboard: ViralDashboard;
}
export const viralOpenUrl = (url: string) => invoke<void>("open_sound_page", { url });
export const viralCall = <T = null>(op: string, value: Record<string, unknown> = {}) => invoke<T>("viral_lab", { op, value });
