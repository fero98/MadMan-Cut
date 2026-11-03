import { useEffect } from "react";
import { TEXT_PRESETS } from "../../lib/presets";
import { addSticker, loadCatalog, loadThumbs, thumbKey, useStickers, type TextTab as Tab } from "../../lib/stickers";
import { useEditor } from "../../lib/store";
import { SOCIAL_LINKS } from "../../lib/social";
import type { StickerItem } from "../../lib/types";
import { TabBar, TabPanel, TextSwatch, gridKeys, lockedProps, useLockReason } from "../ui";
import { EmojiPicker } from "./EmojiPicker";

const TABS: { id: Tab; label: string }[] = [
  { id: "text", label: "Text" },
  { id: "stickers", label: "Stickers" },
  { id: "emoji", label: "Emoji" },
];

/** Sticker tiles are about 72 px; twice that keeps them sharp on a HiDPI screen. */
const STICKER_PX = 144;

function TextStyles() {
  const edit = useEditor((s) => s.edit);
  const lock = useLockReason();
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] content-start gap-2 overflow-y-auto px-3.5 pt-1 pb-3.5">
      <p className="col-span-full text-[12px] text-muted">Sociální sítě MadMan: vloží adresu jako upravitelný text na časovou osu.</p>
      {SOCIAL_LINKS.map((link) => (
        <button
          key={link.id}
          type="button"
          data-social-text={link.id}
          title={`Vložit adresu ${link.label} na pozici přehrávání`}
          onClick={() => edit({ type: "addText", startUs: useEditor.getState().timeUs, text: link.url, style: { ...TEXT_PRESETS[5].style, fontSize: 30, strokeWidth: 2 } })}
          {...lockedProps(lock)}
          className="flex h-12 min-w-0 items-center justify-center rounded-[10px] border border-accent/20 bg-white/[.06] px-2 text-[13px] text-fg hover:border-accent/60 aria-disabled:cursor-not-allowed aria-disabled:opacity-40"
        >
          {link.label}
        </button>
      ))}
      {TEXT_PRESETS.map((p) => (
        <button
          key={p.name}
          type="button"
          title={`Add "${p.name}" text at the playhead`}
          onClick={() => edit({ type: "addText", startUs: useEditor.getState().timeUs, text: p.text, style: p.style })}
          {...lockedProps(lock)}
          className="flex h-16 min-w-0 items-center justify-center rounded-[10px] border border-white/[.08] bg-white/[.1] px-2 transition-colors duration-[120ms] ease-out hover:border-white/30 aria-disabled:cursor-not-allowed aria-disabled:opacity-40 aria-disabled:hover:border-white/[.08]"
        >
          <TextSwatch style={p.style} label={p.name === "Title" ? "TITLE" : p.name} />
        </button>
      ))}
    </div>
  );
}

function StickerTile({ item, first }: { item: StickerItem; first: boolean }) {
  const url = useStickers((s) => s.thumbs[thumbKey(item.key, STICKER_PX)]);
  const adding = useStickers((s) => s.adding.includes(item.key));
  const lock = useLockReason();
  return (
    <button
      type="button"
      data-sticker={item.key}
      tabIndex={first ? 0 : -1}
      aria-label={`Add ${item.name}`}
      title={`Add ${item.name} at the playhead`}
      onClick={() => addSticker(item.key)}
      {...lockedProps(lock)}
      aria-busy={adding}
      className="flex aspect-square min-w-0 items-center justify-center rounded-[10px] border border-white/[.08] bg-white/[.06] transition-colors duration-[120ms] ease-out hover:border-white/30 aria-busy:cursor-progress aria-busy:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-40 aria-disabled:hover:border-white/[.08]"
    >
      {url && <img src={url} alt="" draggable={false} className="max-h-[62%] max-w-[72%]" />}
    </button>
  );
}

function Stickers() {
  const group = useStickers((s) => s.catalog?.groups.find((g) => g.items.every((i) => i.emoji === null)));
  useEffect(() => {
    loadCatalog();
  }, []);
  useEffect(() => {
    if (group) loadThumbs(group.items.map((i) => i.key), STICKER_PX);
  }, [group]);
  return (
    <div onKeyDown={gridKeys("[data-sticker]")} className="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] content-start gap-2 overflow-y-auto px-3.5 pt-1 pb-3.5">
      {group?.items.map((item, i) => (
        <StickerTile key={item.key} item={item} first={i === 0} />
      ))}
    </div>
  );
}

export function TextTab() {
  const tab = useStickers((s) => s.tab);
  return (
    <div className="flex min-h-0 flex-1 flex-col pt-3">
      <TabBar group="text" label="Text" tabs={TABS} value={tab} onChange={(id) => useStickers.setState({ tab: id })} className="mx-3.5 mb-1" />
      <TabPanel group="text" id={tab} className="flex min-h-0 flex-1 flex-col pt-1.5">
        {tab === "text" && <TextStyles />}
        {tab === "stickers" && <Stickers />}
        {tab === "emoji" && <EmojiPicker />}
      </TabPanel>
    </div>
  );
}
