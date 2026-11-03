import { useState } from "react";
import { ClipboardCopy, FolderOpen, MessageSquare } from "lucide-react";
import { copyDiagnostics, openLogs } from "../lib/diagnostics";
import { IconButton, Menu, type MenuEntry } from "./ui";

/** Local diagnostics; no feedback is sent to an external project. */
const feedbackMenu = (): MenuEntry[] => [
  { label: "Kopírovat diagnostiku", icon: <ClipboardCopy size={15} />, run: () => void copyDiagnostics() },
  { label: "Otevřít složku záznamů", icon: <FolderOpen size={15} />, run: openLogs },
];

export function FeedbackButton() {
  const [menu, setMenu] = useState<{ at: { x: number; y: number }; keyboard: boolean; back: HTMLElement } | null>(null);
  return (
    <div className="bar flex rounded-full">
      <IconButton
        round
        data-feedback
        aria-haspopup="menu"
        aria-expanded={!!menu}
        label="Diagnostika"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setMenu({ at: { x: r.left, y: r.bottom + 6 }, keyboard: e.detail === 0, back: e.currentTarget });
        }}
      >
        <MessageSquare size={16} />
      </IconButton>
      {menu && (
        <Menu
          items={feedbackMenu()}
          at={menu.at}
          label="Diagnostika"
          keyboard={menu.keyboard}
          onClose={() => {
            menu.back.focus();
            setMenu(null);
          }}
        />
      )}
    </div>
  );
}

/** Under a failure: the log says what went wrong, for a bug report. */
export function LogsButton() {
  return (
    <button type="button" onClick={openLogs} className="-mx-1.5 rounded-md px-1.5 py-0.5 text-[12px] font-semibold text-accent transition-colors duration-[120ms] ease-out hover:bg-white/[.08]">
      Otevřít složku záznamů
    </button>
  );
}
