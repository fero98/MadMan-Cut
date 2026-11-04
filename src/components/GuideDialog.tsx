import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import guideVideo from "../../assets/madman/guide.mp4";
import aiGuideVideo from "../../assets/madman/ai-guide.mp4";
import { useGuide } from "../lib/guide";
import { IconButton } from "./ui";

/** Local subtitled guide. Closing removes the player and returns focus to its opener. */
export function GuideDialog() {
  const open = useGuide((s) => s.open);
  const section = useGuide((s) => s.section);
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
      className="overlay m-auto w-[min(960px,calc(100vw-40px))] max-h-[calc(100vh-40px)] overflow-y-auto rounded-[20px] p-4 text-fg backdrop:bg-black/70"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="guide-title" className="text-[17px] font-semibold">{section === "ai" ? "Připojení AI – videonávod" : "Průvodce MadMan Cut"}</h2>
        <IconButton label="Zavřít průvodce" round onClick={() => useGuide.setState({ open: false })}><X size={16} /></IconButton>
      </div>
      <video aria-label="Instruktážní video v češtině" className="block max-h-[calc(100vh-135px)] w-full rounded-xl bg-black" controls autoPlay muted playsInline preload="metadata" src={section === "ai" ? aiGuideVideo : guideVideo} />
      <p className="mt-2 text-[12px] text-muted">České titulky jsou součástí obrazu. Video je bez zvuku.</p>
      <section aria-labelledby="ai-tips-title" className="mt-5 rounded-xl border border-white/10 bg-white/[.04] p-4">
        <h3 id="ai-tips-title" className="text-[15px] font-semibold">Tipy a rady pro práci s AI</h3>
        <p className="mt-2 text-[13px] text-muted">Otevřete projekt a tlačítkem AI připojte dostupného agenta. Výsledek vždy zkontrolujte; možnosti závisí na připojeném agentovi a jeho nastavení.</p>
        <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-[13px] text-fg/85">
          <li><strong>Vlastní doplněk:</strong> v editoru otevřete Doplňky → Nainstalované → Vytvořit doplněk a popište, co má dělat. Třeba: „Odstraň klipy kratší než půl sekundy.“</li>
          <li><strong>Vlastní obrazový efekt:</strong> požádejte AI o doplněk s efektem, například o vzhled staré videokazety. Hotový efekt přidáte vybranému klipu v Úpravy → Efekty.</li>
          <li><strong>Střih a titulky:</strong> požádejte AI například o odstranění dlouhých pauz nebo vytvoření titulků. U mluveného slova může být nejprve potřeba přepis.</li>
          <li><strong>Hudba a formát:</strong> můžete požádat o vyhledání zvuku a pomoc s úpravou videa na výšku. Dostupnost závisí na zdrojích a připojení.</li>
          <li><strong>Váš styl:</strong> v části Váš styl zapište pravidla, například aby hudba nepřehlušovala řeč. AI se jimi při práci může řídit.</li>
        </ul>
      </section>
    </dialog>
  );
}
