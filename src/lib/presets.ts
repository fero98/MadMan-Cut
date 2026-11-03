import captionStyles from "../../assets/presets/captions.json";
import type { Adjust, Animation, AnimationKind, CaptionPreset, Crop, KeywordPick, Shape, TextShadow, TextStyle, Transform, TransitionKind } from "./types";

export const FORMATS = [
  { label: "9:16", hint: "Reels, TikTok, Shorts", width: 1080, height: 1920 },
  { label: "16:9", hint: "YouTube", width: 1920, height: 1080 },
  { label: "1:1", hint: "Square", width: 1080, height: 1080 },
  { label: "4:5", hint: "Instagram feed", width: 1080, height: 1350 },
];

export function formatLabel(width: number, height: number) {
  return FORMATS.find((f) => f.width === width && f.height === height)?.label ?? `${width}×${height}`;
}

export const DEFAULT_TRANSFORM: Transform = { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 };
export const NO_CROP: Crop = { left: 0, top: 0, right: 0, bottom: 0 };
export const NO_SHAPE: Shape = { radius: 0, borderWidth: 0, borderColor: "#ffffff", shadow: 0 };
export const NO_ADJUST: Adjust = { exposure: 0, tint: 0, highlights: 0, shadows: 0, fade: 0, brightness: 0, contrast: 0, saturation: 0, temperature: 0, vignette: 0 };

export const ADJUST_ROWS: { key: keyof Adjust; label: string; min: number }[] = [
  { key: "exposure", label: "Expozice", min: -100 },
  { key: "brightness", label: "Jas", min: -100 },
  { key: "contrast", label: "Kontrast", min: -100 },
  { key: "highlights", label: "Světla", min: -100 },
  { key: "shadows", label: "Stíny", min: -100 },
  { key: "saturation", label: "Sytost", min: -100 },
  { key: "temperature", label: "Teplota", min: -100 },
  { key: "tint", label: "Odstín", min: -100 },
  { key: "fade", label: "Vybledlý", min: 0 },
  { key: "vignette", label: "Vinětace", min: 0 },
];

export const TEXT_PRESETS: { name: string; text: string; style: TextStyle }[] = [
  { name: "Classic", text: "Your text", style: { fontSize: 84, color: "#ffffff", bold: true, strokeWidth: 7, strokeColor: "#000000", background: null } },
  { name: "Title", text: "BIG TITLE", style: { fontSize: 130, color: "#ffffff", bold: true, strokeWidth: 0, strokeColor: "#000000", background: null } },
  { name: "Label", text: "Label", style: { fontSize: 72, color: "#111111", bold: true, strokeWidth: 0, strokeColor: "#000000", background: "#ffffffee" } },
  { name: "Highlight", text: "Highlight", style: { fontSize: 84, color: "#111111", bold: true, strokeWidth: 0, strokeColor: "#000000", background: "#ffd400ee" } },
  { name: "Neon", text: "Neon", style: { fontSize: 96, color: "#9cffd9", bold: true, strokeWidth: 5, strokeColor: "#0b6b4f", background: null } },
  { name: "Plain", text: "Plain text", style: { fontSize: 64, color: "#ffffff", bold: false, strokeWidth: 0, strokeColor: "#000000", background: null } },
];

/**
 * Caption styles, shared with the engine and MCP (assets/presets/captions.json); Reel comes first. A style
 * without a font keeps the font the captions have, so a font picked separately survives it.
 */
export const CAPTION_STYLES = captionStyles as CaptionPreset[];

const lower = (c: string | null | undefined) => (c ?? "").toLowerCase();

/** The background box's corner radius, as a share of the font size, of a text that never changed it. */
export const BOX_RADIUS = 0.25;

/**
 * Whether `b` has the look of preset `a`, whatever font it has and, when `a` sets none, its case; a karaoke
 * highlight and key words count, so Karaoke is not Reel.
 */
export function sameStyle(a: TextStyle, b: TextStyle) {
  return (
    a.fontSize === b.fontSize &&
    lower(a.color) === lower(b.color) &&
    a.bold === b.bold &&
    a.strokeWidth === b.strokeWidth &&
    lower(a.strokeColor) === lower(b.strokeColor) &&
    lower(a.background) === lower(b.background) &&
    lower(a.highlight) === lower(b.highlight) &&
    lower(a.keywords?.color) === lower(b.keywords?.color) &&
    (a.keywords?.pick ?? null) === (b.keywords?.pick ?? null) &&
    (!a.letterCase || a.letterCase === (b.letterCase ?? "none")) &&
    (a.align ?? "center") === (b.align ?? "center") &&
    (a.boxRadius ?? BOX_RADIUS) === (b.boxRadius ?? BOX_RADIUS) &&
    (a.letterSpacing ?? 0) === (b.letterSpacing ?? 0) &&
    (a.lineSpacing ?? 0) === (b.lineSpacing ?? 0) &&
    sameShadow(a.shadow, b.shadow)
  );
}

function sameShadow(a: TextShadow | null | undefined, b: TextShadow | null | undefined) {
  if (!a || !b) return !a && !b;
  return lower(a.color) === lower(b.color) && a.opacity === b.opacity && a.blur === b.blur && a.distance === b.distance && a.angle === b.angle;
}

// By kind only: the engine shortens an animation to a short caption.
const sameAnimation = (a: Animation | null | undefined, b: Animation | null | undefined) => (a?.kind ?? null) === (b?.kind ?? null);

/** Whether captions in `style` with these animations look like `preset`: its font counts only when it brings one. */
export function isLook(preset: CaptionPreset, style: TextStyle, animIn: Animation | null | undefined, animOut: Animation | null | undefined) {
  return (
    sameStyle(preset.style, style) &&
    (!preset.style.fontFamily || preset.style.fontFamily === style.fontFamily) &&
    sameAnimation(preset.animIn, animIn) &&
    sameAnimation(preset.animOut, animOut)
  );
}

/** Which words of a caption the key word colour marks. */
export const KEYWORD_PICKS: { id: KeywordPick | "off"; label: string; title: string }[] = [
  { id: "off", label: "Off", title: "No key words" },
  { id: "emphasis", label: "Emphasis", title: "Numbers and words said louder than the rest" },
  { id: "first", label: "First", title: "The first word of every caption" },
  { id: "last", label: "Last", title: "The last word of every caption" },
  { id: "longest", label: "Longest", title: "The longest word of every caption" },
];
export const KEYWORD_COLOR = "#ffd400";

/** Typewriter only makes sense for text; the engine treats it as Fade on media. */
export const ANIMATIONS: { kind: AnimationKind; label: string; textOnly?: boolean }[] = [
  { kind: "fade", label: "Vybledlý" },
  { kind: "zoomIn", label: "Zoom in" },
  { kind: "zoomOut", label: "Zoom out" },
  { kind: "slideUp", label: "Slide up" },
  { kind: "slideDown", label: "Slide down" },
  { kind: "slideLeft", label: "Slide left" },
  { kind: "slideRight", label: "Slide right" },
  { kind: "pop", label: "Pop" },
  { kind: "typewriter", label: "Typewriter", textOnly: true },
];

export const TRANSITIONS: { kind: TransitionKind; label: string }[] = [
  { kind: "dissolve", label: "Prolnutí" },
  { kind: "fadeBlack", label: "Do černé" },
  { kind: "fadeWhite", label: "Bílý záblesk" },
  { kind: "slideLeft", label: "Posun vlevo" },
  { kind: "slideUp", label: "Posun nahoru" },
  { kind: "slideRight", label: "Posun vpravo" },
  { kind: "slideDown", label: "Posun dolů" },
  { kind: "zoomIn", label: "Přiblížení" },
  { kind: "wipeLeft", label: "Setření vlevo" },
  { kind: "wipeRight", label: "Setření vpravo" },
  { kind: "wipeUp", label: "Setření nahoru" },
  { kind: "wipeDown", label: "Setření dolů" },
  { kind: "blur", label: "Rozostření" },
];

export const DEFAULT_TRANSITION_US = 500_000;

export const FILTERS: { id: string; label: string; adjust: Adjust }[] = [
  { id: "none", label: "Bez filtru", adjust: NO_ADJUST },
  { id: "vivid", label: "Živé barvy", adjust: { ...NO_ADJUST, brightness: 0.03, contrast: 0.15, saturation: 0.35 } },
  { id: "warm", label: "Teplý", adjust: { ...NO_ADJUST, saturation: 0.1, temperature: 0.35 } },
  { id: "cool", label: "Chladný", adjust: { ...NO_ADJUST, brightness: 0.02, temperature: -0.35 } },
  { id: "mono", label: "Černobílý", adjust: { ...NO_ADJUST, contrast: 0.2, saturation: -1 } },
  { id: "fade", label: "Vybledlý", adjust: { ...NO_ADJUST, fade: 0.6, contrast: -0.1, saturation: -0.2 } },
  { id: "moody", label: "Temná nálada", adjust: { ...NO_ADJUST, shadows: -0.5, brightness: -0.05, contrast: 0.3, saturation: -0.2, temperature: -0.1, vignette: 0.45 } },
  { id: "punch", label: "Výrazný", adjust: { ...NO_ADJUST, contrast: 0.5, saturation: 0.1, vignette: 0.25 } },
  { id: "madman-cinema", label: "Filmový kontrast", adjust: { ...NO_ADJUST, contrast: 0.25, saturation: -0.12, shadows: -0.18, highlights: -0.1, temperature: -0.08, vignette: 0.2 } },
  { id: "madman-golden", label: "Zlatá hodinka", adjust: { ...NO_ADJUST, brightness: 0.04, contrast: 0.12, saturation: 0.12, temperature: 0.28, highlights: -0.12 } },
  { id: "madman-noir", label: "Noir", adjust: { ...NO_ADJUST, contrast: 0.38, saturation: -1, shadows: -0.22, vignette: 0.3 } },
  { id: "madman-softfilm", label: "Jemný film", adjust: { ...NO_ADJUST, contrast: -0.06, saturation: -0.16, temperature: 0.08, fade: 0.25, highlights: -0.14 } },
  { id: "madman-night", label: "Chladná noc", adjust: { ...NO_ADJUST, brightness: -0.1, contrast: 0.2, saturation: -0.22, temperature: -0.28, shadows: -0.12, vignette: 0.2 } },
  { id: "madman-portrait", label: "Jemný portrét", adjust: { ...NO_ADJUST, brightness: 0.04, contrast: -0.08, saturation: -0.05, temperature: 0.1, shadows: 0.15, highlights: -0.15 } },
];

export function sameAdjust(a: Adjust, b: Adjust) {
  return (Object.keys(NO_ADJUST) as (keyof Adjust)[]).every((k) => Math.abs(a[k] - b[k]) < 0.005);
}

/** Rough CSS approximation of an Adjust, for preset tiles only. The engine does the real grading. */
export function adjustCss(a: Adjust): { filter: string; tint: string | null; vignette: number } {
  const wb = [1.15 * a.temperature + 0.9 * a.tint, 0.15 * a.temperature - 0.9 * a.tint, -1.15 * a.temperature + 0.9 * a.tint].map((v) => 2 ** v);
  const y = 0.2126 * wb[0] + 0.7152 * wb[1] + 0.0722 * wb[2];
  const gain = wb.map((v) => (v / y) ** (1 / 2.4));
  const top = Math.max(...gain);
  const light = 2 ** (0.83 * a.exposure + 0.9 * a.brightness) * (1 + a.fade * 0.2) + a.highlights * 0.1 + a.shadows * 0.1;
  const contrast = ((1 + 0.55 * a.contrast + a.highlights * 0.1 - a.shadows * 0.1) * (1 - a.fade * 0.3)) / (1 + a.fade * 0.2);
  // Contrast before brightness: brightness above 1 would clip a bright sky before fade's contrast could bring it back.
  const filter = `contrast(${Math.max(0, contrast)}) brightness(${Math.max(0, light * top)}) saturate(${1 + a.saturation})`;
  const tint = a.temperature === 0 && a.tint === 0 ? null : `rgb(${gain.map((v) => Math.round((255 * v) / top)).join(",")})`;
  return { filter, tint, vignette: a.vignette };
}

export const SPEED_PRESETS = [0.5, 1, 1.5, 2, 3];
