import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import guideVideo from "../../assets/madman/guide.mp4";
import { useGuide } from "../lib/guide";
import { IconButton } from "./ui";

/** Local subtitled guide. Closing removes the player and returns focus to its opener. */
export function GuideDialog() {
  const open = useGuide((s) => s.open);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.current?.showModal();
    return () => opener?.focus();
  }, [open]);
  if (!open) return null;
  return (
    <dialog
      ref={dialog}
      aria-labelledby="guide-title"
      onCancel={(e) => { e.preventDefault(); useGuide.setState({ open: false }); }}
      className="overlay m-auto w-[min(960px,calc(100vw-40px))] max-h-[calc(100vh-40px)] rounded-[20px] p-4 text-fg backdrop:bg-black/70"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="guide-title" className="text-[17px] font-semibold">Průvodce MadMan Cut</h2>
        <IconButton label="Zavřít průvodce" round onClick={() => useGuide.setState({ open: false })}><X size={16} /></IconButton>
      </div>
      <video aria-label="Instruktážní video s českými titulky" className="block max-h-[calc(100vh-135px)] w-full rounded-xl bg-black" controls autoPlay muted playsInline preload="metadata" src={guideVideo} />
      <p className="mt-2 text-[12px] text-muted">České titulky jsou součástí obrazu. Video je bez zvuku.</p>
    </dialog>
  );
}
