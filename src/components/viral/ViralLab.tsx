import { useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { ArrowUpRight, Check, Download, Loader2, Play, RefreshCw, ShieldCheck, Square, X } from "lucide-react";
import { SERIES, seriesLabel, viralStatus, viralError, formatViralReport, viralOpenUrl as openUrl, viralCall, type ViralPlan, type ViralProject, type ViralState, type ViralVideo } from "../../lib/viral";

const TABS = ["OBJEVOVÁNÍ", "TRENDY", "NÁMĚTY", "SCÉNÁŘE", "AI PRODUKCE", "PŘIPRAVENO K VÝROBĚ"];
const button = "inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-xs text-fg hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed";
const input = "w-full rounded-lg border border-white/15 bg-black/20 p-2 text-sm text-fg outline-none focus:border-accent";
const number = (value: number | null) => value === null ? "N/A" : value.toLocaleString("cs-CZ");
const date = (value: number) => new Date(value * 1000).toLocaleString("cs-CZ");

export function ViralLab() {
  const [state, setState] = useState<ViralState | null>(null);
  const [tab, setTab] = useState(TABS[0]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [key, setKey] = useState("");
  const [policies, setPolicies] = useState(false);
  const [series, setSeries] = useState(SERIES[0]);
  const [period, setPeriod] = useState(30);
  const [million, setMillion] = useState(false);
  const [source, setSource] = useState<ViralVideo | null>(null);
  const [notes, setNotes] = useState("");
  const [selected, setSelected] = useState<ViralProject | null>(null);
  const [draft, setDraft] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [report, setReport] = useState("");
  const mounted = useRef(true);

  async function refresh() {
    const next = await viralCall<ViralState>("state");
    if (mounted.current) setState(next);
    return next;
  }
  useEffect(() => {
    mounted.current = true;
    void refresh().catch(e => setError(viralError(e)));
    const timer = setInterval(() => { void refresh().catch(e => { if (mounted.current) setError(viralError(e)); }); }, 5000);
    return () => { mounted.current = false; clearInterval(timer); };
  }, []);

  async function action(work: () => Promise<unknown>) {
    setWorking(true); setError(null); setNotice(null);
    try { await work(); await refresh(); }
    catch (e) { setError(viralError(e)); }
    finally { setWorking(false); }
  }
  function choose(project: ViralProject) {
    setSelected(project); setDraft(JSON.stringify(project.plan, null, 2)); setReviewed(false); setNotice(null);
  }
  async function discover() {
    setDiscovering(true); setError(null); setNotice(null);
    try {
      const result = await viralCall<{ found: number }>("discover");
      if (mounted.current) setNotice(`Hledání dokončeno. Zkontrolováno videí: ${result.found}. Jde o získaný vzorek, nikoli úplný žebříček YouTube.`);
    } catch (e) { if (mounted.current) setError(viralError(e)); }
    finally { if (mounted.current) { setDiscovering(false); void refresh().catch(e => setError(viralError(e))); } }
  }
  async function create(sourceId: string | null) {
    await action(async () => {
      const created = await viralCall<{ id: number }>("create", { sourceId, series });
      const next = await refresh();
      const project = next.dashboard.projects.find(p => p.id === created.id);
      if (project) choose(project);
      setTab("NÁMĚTY");
    });
  }
  async function save() {
    if (!selected) return;
    await action(async () => {
      const plan = JSON.parse(draft) as ViralPlan;
      await viralCall("save", { id: selected.id, revision: selected.revision, plan });
      const next = await refresh();
      const project = next.dashboard.projects.find(p => p.id === selected.id);
      if (project) choose(project);
      setNotice("Uložena nová rozpracovaná verze. Předchozí schválení už neplatí.");
    });
  }
  const current = state?.dashboard.projects.find(p => p.id === selected?.id) ?? null;
  const dirty = !!selected && draft !== JSON.stringify(selected.plan, null, 2);
  const draftPlan = selected ? JSON.parse(draft) as ViralPlan : null;
  function editPlan(patch: Partial<ViralPlan>) {
    if (draftPlan) { setDraft(JSON.stringify({ ...draftPlan, ...patch }, null, 2)); setReviewed(false); }
  }
  const stale = !!current && current.revision !== selected?.revision;
  const busy = working || discovering || !!state?.busy;
  const videos = (state?.dashboard.videos ?? []).filter(v => {
    const published = Date.parse(v.publishedAt);
    return Number.isFinite(published) && published >= Date.now() - period * 86400000 && (!million || (v.views !== null && v.views >= 1000000));
  });
  const projects = state?.dashboard.projects ?? [];
  const ready = projects.filter(p => p.status === "approved" && p.revision === p.approvedRevision);

  return <div className="flex min-h-0 flex-1 flex-col" aria-label="MADMAN Viral Lab">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-5">
      <div><p className="text-[10px] font-semibold tracking-[.22em] text-accent">MADMAN STUDIO</p><h1 className="mt-1 text-xl font-semibold text-fg">Viral Lab</h1><p className="mt-1 text-xs text-muted">Publikum USA · videa v americké angličtině · 9:16 · 10–30 sekund</p></div>
      <div className="flex gap-2">
        <button className={button} onClick={() => void action(refresh)} disabled={working}><RefreshCw size={14} />Obnovit</button>
        {discovering || state?.busy ? <button className={button} onClick={() => void viralCall("cancel").catch(e => setError(viralError(e)))}><Square size={14} />Zastavit hledání</button> :
          <button className={`${button} border-accent/50 bg-accent/15`} disabled={!state?.keyConfigured || working} onClick={() => void discover()}><Play size={14} />Vyhledat videa</button>}
      </div>
    </div>
    <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-white/10 px-3 py-2" aria-label="Sekce Viral Lab">
      {TABS.map(t => <button key={t} type="button" aria-current={tab === t ? "page" : undefined} onClick={() => setTab(t)} className={`whitespace-nowrap rounded-md px-3 py-2 text-[10px] font-semibold tracking-wide ${tab === t ? "bg-accent/15 text-accent" : "text-muted hover:text-fg"}`}>{t}</button>)}
    </nav>
    <div className="min-h-0 flex-1 overflow-y-auto p-5">
      {error && <div role="alert" className="mb-4 break-words rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</div>}
      {notice && <p role="status" className="mb-4 rounded-lg bg-accent/10 p-3 text-sm text-fg">{notice}</p>}
      {!state && !error && <p role="status" className="flex gap-2 text-muted"><Loader2 size={16} className="animate-spin" />Načítání pracovního prostoru…</p>}
      {tab === "OBJEVOVÁNÍ" && <>
        <details className="mb-5 rounded-xl border border-white/10 p-4" open={!state?.keyConfigured}>
          <summary className="cursor-pointer text-sm font-medium text-fg">Připojení k YouTube · {state?.keyConfigured ? "Klíč je uložen ve Správci pověření Windows" : "Vyžaduje nastavení"}</summary>
          <p className="my-3 text-xs leading-relaxed text-muted">Viral Lab odesílá vyhledávací dotazy a API klíč Googlu přes HTTPS. Statistiky a náměty ukládá v tomto počítači. Nestahuje cizí videa, nezveřejňuje obsah ani nevolá AI služby a neodesílá telemetrii. Veřejná data z API se uchovávají nejvýše 30 dní. Odstraněním klíče připojení zrušíte. Exportované produkční balíčky klíč neobsahují.</p>
          {state?.keyError && <p className="mb-2 text-xs text-red-200">{viralError(state.keyError)}</p>}
          <div className="flex flex-wrap gap-2">
            <label className="min-w-48 flex-1"><span className="mb-1 block text-xs text-muted">API klíč pro YouTube Data API v3</span><input className={input} type="password" autoComplete="off" spellCheck={false} value={key} onChange={e => setKey(e.target.value)} placeholder="Zadejte vlastní API klíč z Google Cloud" /></label>
            <button className={`${button} self-end`} disabled={!key || !policies || busy} onClick={() => void action(async () => { await viralCall("key", { key, acceptedPolicies: policies }); setKey(""); setNotice("API klíč byl bezpečně uložen. Přístup ověří první vyhledávání."); })}>Uložit klíč</button>
            <button className={`${button} self-end`} disabled={!state?.keyConfigured || busy} onClick={() => void action(() => viralCall("key", { key: "", acceptedPolicies: true }))}>Odstranit klíč</button>
          </div>
          <label className="mt-3 flex items-start gap-2 text-xs text-muted"><input type="checkbox" checked={policies} onChange={e => setPolicies(e.target.checked)} />Seznámil/a jsem se s informacemi o zpracování dat a souhlasím s podmínkami YouTube.</label>
          <div className="mt-2 flex flex-wrap gap-3">
            {[['Podmínky YouTube', 'https://www.youtube.com/t/terms'], ['Ochrana soukromí Google', 'https://policies.google.com/privacy'], ['Nastavení API v Google Cloud', 'https://console.cloud.google.com/apis/library/youtube.googleapis.com']].map(([label, url]) => <button key={url} className="text-xs text-accent underline" onClick={() => void openUrl(url).catch(e => setError(viralError(e)))}>{label}</button>)}
          </div>
        </details>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <label className="text-xs text-muted">Zveřejněno <select aria-label="Období zveřejnění" className="ml-2 rounded bg-black/30 p-2 text-fg" value={period} onChange={e => setPeriod(Number(e.target.value))}><option value={7}>Posledních 7 dní</option><option value={30}>Posledních 30 dní</option></select></label>
          <label className="flex items-center gap-2 text-xs text-muted"><input type="checkbox" checked={million} onChange={e => setMillion(e.target.checked)} />Alespoň 1 milion zhlédnutí</label>
          <span className="ml-auto text-xs text-muted">Zbývající hledání: {state?.dashboard.searchesRemaining ?? "N/A"}/30 za posledních 24 hodin</span>
        </div>
        <p className="mb-4 text-xs leading-relaxed text-muted">Původní údaje z YouTube jsou seřazené podle počtu zhlédnutí. Formát Shorts a vhodnost pro americké publikum vyžadují kontrolu. Nová videa mohou mít méně než milion zhlédnutí. Skóre původních videí: N/A; odvozená analytika není aktivní.</p>
        {!videos.length && <Empty title="Zatím nebyla nalezena žádná videa" text="Uložte API klíč pro YouTube a spusťte hledání. Zobrazí se skutečně nalezená videa a dostupné statistiky." />}
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">{videos.slice(0, 100).map(v => <article key={v.id} className="rounded-xl border border-white/10 bg-white/[.025] p-4">
          <div className="mb-2 flex items-start justify-between gap-2"><h2 className="text-sm font-semibold text-fg">{v.title}</h2><button aria-label={`Otevřít původní video: ${v.title}`} className="shrink-0 text-accent" onClick={() => void openUrl(`https://www.youtube.com/watch?v=${v.id}`).catch(e => setError(viralError(e)))}><ArrowUpRight size={17} /></button></div>
          <p className="text-xs text-muted">{v.author} · {v.durationSeconds === null ? "N/A" : `${v.durationSeconds}s`} · {v.review === "short_confirmed" ? "Short ručně potvrzen" : v.review === "rejected" ? "Zamítnuto" : "Formát Shorts neověřen"}</p>
          <dl className="my-3 grid grid-cols-3 gap-2 text-xs">{[["Zhlédnutí", v.views], ["To se mi líbí", v.likes], ["Komentáře", v.comments]].map(([name, val]) => <div key={String(name)}><dt className="text-muted">{name}</dt><dd className="mt-1 font-medium text-fg">{number(val as number | null)}</dd></div>)}</dl>
          <p className="text-[10px] text-muted">Zveřejněno: {v.publishedAt} · Ověřeno: {date(v.checkedAt)}</p>
          <div className="mt-3 flex flex-wrap gap-2"><button className={button} onClick={() => { setSource(v); setNotes(v.notes); }}>Zkontrolovat formát</button><button className={button} disabled={busy || dirty || v.review === "rejected"} onClick={() => void create(v.id)}>Vytvořit vlastní námět</button></div>
        </article>)}</div>
        {source && <section className="mt-5 rounded-xl border border-accent/30 p-4" aria-label="Kontrola původního videa"><h2 className="text-sm font-semibold text-fg">Kontrola: {source.title}</h2><p className="my-2 text-xs text-muted">Otevřete původní video a zhlédněte ho. Zaznamenejte úvodní háček, obecný komediální princip a nejasnosti. Nevkládejte chráněné dialogy ani nestahujte cizí záběry.</p><textarea aria-label="Poznámky k původnímu videu" className={`${input} min-h-24`} value={notes} maxLength={8000} onChange={e => setNotes(e.target.value)} /><div className="mt-3 flex flex-wrap gap-2">{[["short_confirmed", "Potvrdit formát Shorts"], ["unverified", "Uložit jako neověřené"], ["rejected", "Zamítnout"]].map(([review, label]) => <button className={button} key={review} disabled={busy} onClick={() => void action(async () => { await viralCall("review", { id: source.id, review, notes }); setSource(null); })}>{label}</button>)}<button className={button} onClick={() => setSource(null)}>Zavřít</button></div></section>}
      </>}
      {tab === "TRENDY" && <>
        <Empty title="Pokročilá analytika není aktivní" text="Výpočty růstu, denní srovnání a skóre trendů vyžadují příslušné povolení YouTube. Nyní jsou dostupné původní statistiky a historie vyhledávání." />
        <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-xs"><thead className="text-muted"><tr><th className="p-2">Spuštěno</th><th className="p-2">Stav</th><th className="p-2">Nalezená videa</th><th className="p-2">Podrobnosti</th></tr></thead><tbody>{state?.dashboard.runs.map(r => <tr key={r.id} className="border-t border-white/10 text-fg"><td className="p-2">{date(r.startedAt)}</td><td className="p-2">{viralStatus(r.status)}</td><td className="p-2">{r.found}</td><td className="p-2">{r.error ? viralError(r.error) : "—"}</td></tr>)}</tbody></table></div>
        <button className={`${button} my-4`} disabled={working} onClick={() => void action(async () => { const result = await viralCall<{ report: string }>("report"); setReport(formatViralReport(result.report)); })}>Vytvořit denní přehled</button>
        {report && <><p className="mb-2 text-xs text-muted">Přehled obsahuje až 20 videí, 5 vlastních námětů a 3 schválené produkční plány. Jde o užší výběr, nikoli předpověď virality. Pro exportované kopie statistik platí pravidla uchovávání dat.</p><textarea readOnly aria-label="Denní přehled" className={`${input} min-h-80 font-mono text-xs`} value={report} /></>}
      </>}
      {["NÁMĚTY", "SCÉNÁŘE", "AI PRODUKCE"].includes(tab) && <>
        <div className="mb-4 flex flex-wrap items-center gap-2"><label className="text-xs text-muted">Série <select className="ml-2 rounded bg-black/30 p-2 text-fg" value={series} onChange={e => setSeries(e.target.value)}>{SERIES.map(s => <option key={s} value={s}>{seriesLabel(s)}</option>)}</select></label><button className={button} disabled={busy || dirty} onClick={() => void create(null)}>Vytvořit ukázkový námět</button></div>
        <p className="mb-4 text-xs leading-relaxed text-muted">Bezplatné lokální šablony obsahují upravitelné příběhy a produkční plány. Nejde o výstup AI ani automatickou analýzu cizího videa. AI model zatím není připojený. Před schválením námět zkontrolujte a upravte podle sebe.</p>
        <div className="mb-4 flex flex-wrap gap-2">{projects.map(p => <button key={p.id} disabled={dirty || working} className={`${button} ${selected?.id === p.id ? "border-accent text-accent" : ""}`} onClick={() => choose(p)}>#{p.id} {p.plan.title} · v{p.revision} · {viralStatus(p.status)}</button>)}</div>
        {!selected ? <Empty title="Vyberte nebo vytvořte námět" text="Každý námět obsahuje vlastní příběh, čtyři časované záběry, dialogy v americké angličtině, prompty, zvukové poznámky a titulky." /> : <>
          <div className="mb-3 flex flex-wrap items-center gap-2"><h2 className="mr-auto text-base font-semibold text-fg">{selected.plan.title}</h2><span className="text-xs text-muted">{selected.plan.durationSeconds}s · {selected.plan.aspectRatio} · {selected.plan.language}</span></div>
          {draftPlan && <div className="space-y-4">
            <label className="block text-xs text-muted">Anglický název<input aria-label="Anglický název" className={`${input} mt-1`} value={draftPlan.title} maxLength={200} onChange={e => editPlan({ title: e.target.value })} /></label>
            {tab === "NÁMĚTY" && <>
              <Field label="Popis" value={draftPlan.description} onChange={description => editPlan({ description })} />
              <Field label="Originalita a obecný komediální princip" value={draftPlan.originalityNotes} onChange={originalityNotes => editPlan({ originalityNotes })} />
              <Field label="Stálý vzhled postav a prostředí" value={draftPlan.characterBible} onChange={characterBible => editPlan({ characterBible })} />
              <Field label="Výrobní náročnost" value={draftPlan.effort} onChange={effort => editPlan({ effort })} />
            </>}
            {tab === "SCÉNÁŘE" && <Field label="Úplný scénář v americké angličtině" value={draftPlan.script} onChange={script => editPlan({ script })} large />}
            {tab !== "NÁMĚTY" && draftPlan.shots.map((s, i) => {
              const editShot = (patch: Partial<typeof s>) => editPlan({ shots: draftPlan.shots.map((shot, index) => index === i ? { ...shot, ...patch } : shot) });
              return <article className="space-y-3 rounded-lg border border-white/10 p-4 text-xs text-fg" key={i}>
                <h3 className="font-semibold text-accent">Záběr {i + 1} · {s.start}–{s.end}s</h3>
                {tab === "AI PRODUKCE" && <>
                  <div className="flex gap-3">{(["start", "end"] as const).map(k => <label key={k} className="text-muted">{k === "start" ? "Začátek" : "Konec"} (sekundy)<input type="number" min={0} max={30} step={1} className={`${input} mt-1`} value={s[k]} onChange={e => editShot({ [k]: Number(e.target.value) })} /></label>)}</div>
                  <Field label={`Záběr ${i + 1}: děj`} value={s.action} onChange={action => editShot({ action })} />
                  <Field label={`Záběr ${i + 1}: prompt pro obrázek`} value={s.imagePrompt} onChange={imagePrompt => editShot({ imagePrompt })} />
                  <Field label={`Záběr ${i + 1}: prompt pro video`} value={s.videoPrompt} onChange={videoPrompt => editShot({ videoPrompt })} />
                  <Field label={`Záběr ${i + 1}: kamera`} value={s.camera} onChange={camera => editShot({ camera })} />
                  <Field label={`Záběr ${i + 1}: zvukové efekty`} value={s.sfx} onChange={sfx => editShot({ sfx })} />
                </>}
                <Field label={`Záběr ${i + 1}: dialog`} value={s.dialogue} onChange={dialogue => editShot({ dialogue })} />
                <Field label={`Záběr ${i + 1}: titulek`} value={s.caption} onChange={caption => editShot({ caption })} />
              </article>;
            })}
            {tab === "AI PRODUKCE" && <>
              <label className="block text-xs text-muted">Celková délka (10–30 sekund)<input type="number" className={`${input} mt-1`} min={10} max={30} step={1} value={draftPlan.durationSeconds} onChange={e => editPlan({ durationSeconds: Number(e.target.value) })} /></label>
              <Field label="Hudební atmosféra a licence" value={draftPlan.music} onChange={music => editPlan({ music })} />
              <Field label="Úvodní snímek" value={draftPlan.openingFrame} onChange={openingFrame => editPlan({ openingFrame })} />
              <label className="block text-xs text-muted">Hashtagy pro YouTube<input className={`${input} mt-1`} value={draftPlan.hashtags.join(" ")} onChange={e => editPlan({ hashtags: e.target.value.split(/\s+/).filter(Boolean) })} /></label>
            </>}
            <details className="rounded-lg border border-white/10 p-3 text-xs text-muted"><summary className="cursor-pointer">Redakční hodnocení vlastního námětu</summary>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">{["Úvodní háček", "Humor", "Tempo", "Opakované sledování", "Vhodnost pro USA", "Proveditelnost", "Možnost pokračování"].map((label, i) => <label key={label}>{label} / {[20, 20, 15, 15, 10, 10, 10][i]}<input className={`${input} mt-1`} type="number" min={0} max={[20, 20, 15, 15, 10, 10, 10][i]} step={1} value={draftPlan.rubric?.[i] ?? ""} onChange={e => { const rubric = [...(draftPlan.rubric ?? [0, 0, 0, 0, 0, 0, 0])]; rubric[i] = Number(e.target.value); editPlan({ rubric: rubric as ViralPlan["rubric"] }); }} /></label>)}</div>
              <button className={`${button} mt-3`} onClick={() => editPlan({ rubric: null })}>Vymazat hodnocení</button>
            </details>
            <p className="text-xs text-muted">MADMAN VIRAL SCORE: {draftPlan.rubric ? `${draftPlan.rubric.reduce((a, b) => a + b, 0)}/100` : "N/A — zatím nehodnoceno"}. Interní redakční odhad vlastního námětu, nikoli pravděpodobnost virality.</p>
          </div>}
          {stale && <p role="alert" className="my-2 text-xs text-red-200">Existuje novější verze. Před uložením ji načtěte opětovným výběrem námětu.</p>}
          <div className="my-3 flex flex-wrap gap-2"><button className={button} disabled={working || !dirty || stale} onClick={() => void save()}>Uložit novou verzi</button><button className={button} disabled={!dirty || working} onClick={() => choose(current ?? selected)}>Zahodit neuložené úpravy</button><button className={button} disabled={working || dirty || stale} onClick={() => void action(() => viralCall("decide", { id: selected.id, revision: selected.revision, approve: false, reviewed: false }))}><X size={14} />Zamítnout</button></div>
          <label className="my-3 flex items-start gap-2 text-xs text-muted"><input type="checkbox" checked={reviewed} onChange={e => setReviewed(e.target.checked)} />Zkontroloval/a jsem uloženou verzi: americkou angličtinu, originalitu, časování a práva k podkladům a hudbě. Jde o produkční plán; video zatím nebylo vytvořeno.</label>
          <button className={`${button} border-accent/50`} disabled={working || dirty || stale || !reviewed} onClick={() => void action(async () => { await viralCall("decide", { id: selected.id, revision: selected.revision, approve: true, reviewed }); setReviewed(false); setNotice("Tato verze je schválená. Export najdete v části PŘIPRAVENO K VÝROBĚ."); })}><Check size={14} />Schválit uloženou verzi</button>
        </>}
      </>}
      {tab === "PŘIPRAVENO K VÝROBĚ" && <>
        <p className="mb-4 flex items-center gap-2 text-xs text-muted"><ShieldCheck size={15} />Zde jsou pouze ručně schválené verze. Automatické zveřejňování není zapnuté.</p>
        {!ready.length && <Empty title="Zatím nemáte schválený produkční plán" text="V části SCÉNÁŘE zkontrolujte a schvalte uloženou verzi námětu. Každá další úprava schválení zruší." />}
        <div className="space-y-3">{ready.map(p => <article key={p.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 p-4"><div className="mr-auto min-w-0"><h2 className="text-sm font-semibold text-fg">{p.plan.title}</h2><p className="mt-1 text-xs text-muted">v{p.revision} · {p.plan.durationSeconds}s · {p.plan.effort}</p></div><button className={button} disabled={working || dirty} onClick={() => { choose(p); setTab("SCÉNÁŘE"); }}>Zkontrolovat</button><button className={button} disabled={working} onClick={() => void action(async () => {
          const parent = await open({ directory: true, multiple: false, title: "Vyberte složku pro produkční balíček" });
          if (typeof parent !== "string") return;
          const result = await viralCall<{ path: string }>("export", { id: p.id, revision: p.revision, parent });
          setNotice(`Produkční balíček byl exportován: ${result.path}`);
          await revealItemInDir(result.path);
        })}><Download size={14} />Exportovat balíček</button></article>)}</div>
      </>}
    </div>
  </div>;
}

function Empty({ title, text }: { title: string; text: string }) {
  return <div className="rounded-xl border border-dashed border-white/15 bg-white/[.02] p-6"><h2 className="text-sm font-semibold text-fg">{title}</h2><p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted">{text}</p></div>;
}

function Field({ label, value, onChange, large = false }: { label: string; value: string; onChange: (value: string) => void; large?: boolean }) {
  return <label className="block text-xs text-muted">{label}<textarea aria-label={label} className={`${input} mt-1 ${large ? "min-h-56" : "min-h-20"}`} value={value} maxLength={16000} onChange={e => onChange(e.target.value)} /></label>;
}
