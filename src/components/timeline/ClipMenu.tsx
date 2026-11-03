import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ClipboardCopy, ClipboardPaste, Copy, ListChecks, Paintbrush, Replace, Split, BetweenHorizontalStart, Snowflake, Trash2, Unlink } from "lucide-react";
import { chose } from "../../lib/exit";
import { pickAndReplace } from "../panel/assets";
import { AI_EDITING, NOTHING_COPIED, attributeTargets, canSplitClip, copySelection, cutSelection, deleteSelection, detachAudio, detachBlocker, duplicateSelection, findClip, freezeAtPlayhead, freezeBlocker, isFreeze, pasteAttributes, pasteAttributesBlocker, pasteClips, selectTrack, splitAtPlayhead, useAiLocked, useEditor } from "../../lib/store";
import type { Clip } from "../../lib/types";

export interface MenuAt {
  clipId: string;
  x: number;
  y: number;
}

function Item({ icon, label, shortcut, disabled, reason, onSelect }: { icon: ReactNode; label: string; shortcut?: string; disabled?: boolean; reason?: string | null; onSelect: () => void }) {
  return (
    // Disabled items stay reachable with ↑/↓, as in other menus, so their reason is read out.
    <button
      type="button"
      role="menuitem"
      aria-disabled={disabled || undefined}
      title={disabled ? (reason ?? undefined) : undefined}
      onClick={
        disabled
          ? undefined
          : (e) => {
              chose(e.currentTarget);
              onSelect();
            }
      }
      className="group flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-[13px] text-fg hover:bg-white/[.08] focus-visible:bg-white/[.08] aria-disabled:cursor-not-allowed aria-disabled:text-subtle aria-disabled:hover:bg-transparent aria-disabled:focus-visible:bg-white/[.08]"
    >
      <span className="text-muted group-aria-disabled:text-subtle">{icon}</span>
      <span className="flex-1">{label}</span>
      {shortcut && <span className="text-[12px] text-muted group-aria-disabled:text-subtle">{shortcut}</span>}
    </button>
  );
}

/**
 * Right-click menu for a clip. Every action applies to the selection, which a right-click outside
 * it replaces with the clicked clip; with several clips selected the labels say how many.
 */
export function ClipMenu({ at, onClose }: { at: MenuAt; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const project = useEditor((s) => s.snap!.project);
  const selection = useEditor((s) => s.selection);
  const [pos, setPos] = useState({ x: at.x, y: at.y });
  const found = findClip(project, at.clipId);
  const picked = selection.map((id) => findClip(project, id)?.clip).filter((c): c is Clip => !!c);
  const locked = useAiLocked();
  const clipboard = useEditor((s) => s.clipboard);
  const splittable = useEditor((s) => picked.filter((c) => canSplitClip(c, s.timeUs, project.canvas.fps)).length);
  const atEdge = useEditor((s) => picked.some((c) => s.timeUs >= c.startUs && s.timeUs <= c.startUs + c.durationUs));
  const freezeReason = useEditor((s) =>
    picked.length > 1 ? "vyberte jeden videoklip pro zmrazení snímku" : found ? freezeBlocker(project, selection, Math.round(s.timeUs), found.clip) : null,
  );

  // Focus goes back where it was when the menu opened, unless an action moved it elsewhere.
  const [opener] = useState(() => document.activeElement as HTMLElement | null);
  useLayoutEffect(
    () => () => {
      const active = document.activeElement;
      const lost = !active || active === document.body || !!ref.current?.contains(active);
      if (lost && opener?.isConnected && opener !== document.body) opener.focus({ preventScroll: true });
    },
    [opener],
  );

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Keep the menu inside the window.
    // Its size before it grows in from 96 % (menu-in).
    setPos({ x: Math.min(at.x, window.innerWidth - el.offsetWidth - 8), y: Math.min(at.y, window.innerHeight - el.offsetHeight - 8) });
    el.querySelector<HTMLElement>("[role=menuitem]:not([aria-disabled=true])")?.focus();
  }, [at]);

  useEffect(() => {
    const close = (e: Event) => !ref.current?.contains(e.target as Node) && onClose();
    // Esc closes the menu only, wherever focus is, and never also clears the selection.
    const esc = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener("pointerdown", close, true);
    window.addEventListener("wheel", close, true);
    window.addEventListener("blur", onClose);
    window.addEventListener("keydown", esc, true);
    return () => {
      window.removeEventListener("pointerdown", close, true);
      window.removeEventListener("wheel", close, true);
      window.removeEventListener("blur", onClose);
      window.removeEventListener("keydown", esc, true);
    };
  }, [onClose]);

  if (!found || picked.length === 0) return null;
  const { clip } = found;
  const n = picked.length;
  const many = (one: string, verb: string) => (n === 1 ? one : `${verb} (${n})`);
  const detachable = picked.filter((c) => !detachBlocker(project, c));
  const detachReason = n === 1 ? detachBlocker(project, picked[0]) : "Žádný z vybraných klipů neobsahuje zvuk k oddělení";
  const replaceReason =
    n > 1
      ? "Pro nahrazení média vyberte jeden klip"
      : clip.content.type !== "media"
        ? "Média lze nahradit pouze u videa, obrázku nebo zvuku"
        : isFreeze(clip)
          ? "Zmrazený snímek nelze nahradit; zmrazte snímek nového videa"
          : null;
  const copies = clipboard?.length ?? 0;
  const looks = attributeTargets(project, selection, clipboard).reduce((sum, g) => sum + g.clipIds.length, 0);
  const run = (fn: () => unknown) => () => {
    onClose();
    fn();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = [...(ref.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    items[(i + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length]?.focus();
  };

  return (
    <div
      ref={ref}
      data-exit
      role="menu"
      aria-label={n === 1 ? "Akce klipu" : `Akce pro ${n} klipů`}
      onKeyDown={onKeyDown}
      onContextMenu={(e) => e.preventDefault()}
      className="overlay menu-in fixed z-[110] w-72 rounded-xl p-1"
      style={{ left: pos.x, top: pos.y, transformOrigin: `${at.x - pos.x}px ${at.y - pos.y}px` }}
    >
      {/* Split takes the selected clips under the playhead, like S. */}
      <Item
        icon={<Split size={14} />}
        label={n === 1 || splittable === 0 ? "Rozdělit v místě přehrávání" : splittable === n ? `Rozdělit ${n} klipů` : `Rozdělit ${splittable} z ${n} klipů`}
        shortcut="S"
        disabled={locked || splittable === 0}
        reason={
          locked
            ? AI_EDITING
            : atEdge
              ? "Přesuňte přehrávací značku alespoň o snímek od okraje klipu"
              : n === 1
                ? "Pro rozdělení přesuňte přehrávací značku na tento klip"
                : "Pro rozdělení přesuňte přehrávací značku na vybrané klipy"
        }
        onSelect={run(splitAtPlayhead)}
      />
      <Item
        icon={<Snowflake size={14} />}
        label="Zmrazit snímek"
        shortcut="Shift+R"
        disabled={locked || !!freezeReason}
        reason={locked ? AI_EDITING : freezeReason && freezeReason[0].toUpperCase() + freezeReason.slice(1)}
        onSelect={run(() => freezeAtPlayhead(clip))}
      />
      <Item icon={<Copy size={14} />} label={many("Duplikovat", "Duplikovat")} shortcut="Ctrl+D" disabled={locked} reason={AI_EDITING} onSelect={run(duplicateSelection)} />
      <Item
        icon={<Unlink size={14} />}
        label={n === 1 || detachable.length === 0 ? "Oddělit zvuk" : `Oddělit zvuk u ${detachable.length} klipů`}
        disabled={locked || detachable.length === 0}
        reason={locked ? AI_EDITING : detachReason}
        onSelect={run(() => detachAudio(detachable.map((c) => c.id)))}
      />
      <Item
        icon={<Replace size={14} />}
        label="Nahradit média…"
        disabled={locked || !!replaceReason}
        reason={locked ? AI_EDITING : replaceReason}
        onSelect={run(() => pickAndReplace(clip.id, found.track.kind === "audio"))}
      />
      <Item icon={<ListChecks size={14} />} label="Vybrat vše na stopě" onSelect={run(() => selectTrack(clip.id))} />
      <div className="mx-2 my-1 h-px bg-white/[.08]" />
      <Item icon={<BetweenHorizontalStart size={14} />} label={many("Vyjmout", "Vyjmout")} shortcut="Ctrl+X" disabled={locked} reason={AI_EDITING} onSelect={run(cutSelection)} />
      <Item icon={<ClipboardCopy size={14} />} label={many("Kopírovat", "Kopírovat")} shortcut="Ctrl+C" onSelect={run(copySelection)} />
      <Item
        icon={<ClipboardPaste size={14} />}
        label={copies > 1 ? `Vložit ${copies} klipů v místě přehrávání` : "Vložit v místě přehrávání"}
        shortcut="Ctrl+V"
        disabled={locked || copies === 0}
        reason={locked ? AI_EDITING : NOTHING_COPIED}
        onSelect={run(pasteClips)}
      />
      <Item
        icon={<Paintbrush size={14} />}
        label={looks > 1 ? `Vložit vlastnosti do ${looks} klipů` : "Vložit vlastnosti"}
        shortcut="Ctrl+Alt+V"
        disabled={locked || looks === 0}
        reason={locked ? AI_EDITING : pasteAttributesBlocker(project, selection, clipboard)}
        onSelect={run(pasteAttributes)}
      />
      <div className="mx-2 my-1 h-px bg-white/[.08]" />
      <Item icon={<Trash2 size={14} />} label={many("Odstranit", "Odstranit")} shortcut="Del" disabled={locked} reason={AI_EDITING} onSelect={run(deleteSelection)} />
    </div>
  );
}
