import { useEffect, useState } from "react";
import { AlertTriangle, Check, Loader2 } from "lucide-react";
import { api, errorText, plainError } from "../../../lib/api";
import { useSetup } from "../../../lib/setup";
import { SPEECH_LANGUAGES, setSpeechLanguage, setSpeechModel, speechModelLabel, speechModelPicked, useSpeech } from "../../../lib/speech";
import { useEditor } from "../../../lib/store";
import type { SpeechModel, SpeechSetup } from "../../../lib/types";
import { JobError, Select } from "../../panel/SpeechControls";
import { AiLock, Button, Field, LockReason, ProgressBar, useLockReason } from "../../ui";
import { StepActions } from "../StepActions";

const JOB = "speech-model:setup";
const STOP = "Stop downloading the speech model";

/** What the last Download asked for, so Try again and Resume download only offer to go on with that. */
let asked: { model: string; language: string } | null = null;

const LIST = new Intl.ListFormat("cs", { type: "conjunction" });

const languageName = (id: string) => SPEECH_LANGUAGES.find(([code]) => code === id)?.[1] ?? id;

/**
 * Word error rate in % on FLEURS of base, small and large-v3-turbo. base and small: Radford et al., "Robust Speech
 * Recognition via Large-Scale Weak Supervision" (arXiv:2212.04356), Table 13. large-v3-turbo: the labels of the FLEURS
 * chart in OpenAI's announcement, github.com/openai/whisper/discussions/2363, measured with beam size 5 on the full
 * model; nobody publishes what the q5_0 file Nuzky downloads loses. The two sources evaluate a little differently.
 */
const WER: Record<string, [number, number, number]> = {
  en: [8.9, 6.1, 4.4],
  cs: [66.0, 37.6, 11.2],
  sk: [60.6, 33.3, 9.7],
  de: [17.9, 10.2, 5.8],
  pl: [30.8, 14.7, 5.4],
  es: [9.9, 5.6, 3.1],
  fr: [28.5, 15.0, 5.8],
  it: [17.9, 9.8, 3.2],
  uk: [37.7, 19.3, 6.9],
};
const MODEL_ORDER = ["base", "small", "large-v3-turbo-q5_0", "large-v3-q5_0"];

/**
 * How many times quicker base and small recognise speech than large-v3-turbo-q5_0, on the GPU and on the processor.
 * Measured 2026-10-17 on an Apple M4 Pro with Nuzky's recognition (`nuzky-analyze words`, release build, 4 threads)
 * on 3 minutes of Czech and of English speech: Metal 8.2–8.6× and 3.6–3.7×, processor 11.4–11.6× and 4.0–4.2×.
 */
const QUICKER = { gpu: [8, 4], cpu: [11, 4] };

/**
 * On the GPU the most accurate model is quick enough. On the processor a smaller one is several times quicker: Fast
 * where it already gets fewer than 1 word in 10 wrong, else Balanced.
 */
function recommend(language: string, gpu: boolean) {
  if (gpu) return "large-v3-turbo-q5_0";
  return (WER[language]?.[0] ?? 100) < 10 ? "base" : "small";
}

/** How many words a model gets wrong in `language` and how much quicker than Most accurate it is, as far as known. */
function note(model: string, language: string, gpu: boolean) {
  if (model === "large-v3-q5_0") return "Větší model, obvykle pomalejší; kvalitu porovnejte na své nahrávce.";
  const i = MODEL_ORDER.indexOf(model);
  const wer = WER[language]?.[i];
  const times = QUICKER[gpu ? "gpu" : "cpu"][i];
  return [wer !== undefined && `asi ${Math.round(wer)} % chyb v testu`, times && `až ${times}× rychlejší v testu`].filter(Boolean).join(" · ");
}

/** Captions model: the spoken language, the model, and Download for everything the first transcript needs. */
export function CaptionsStep() {
  return (
    <AiLock>
      <Step />
    </AiLock>
  );
}

function Step() {
  const lock = useLockReason();
  const language = useSpeech((s) => s.language);
  const model = useSpeech((s) => s.model);
  const job = useEditor((s) => s.jobs[JOB]);
  // Every speech model download, also an agent's, can change what is downloaded.
  const downloads = useEditor((s) =>
    Object.values(s.jobs)
      .filter((j) => j.kind === "speech-model")
      .map((j) => j.status)
      .join(),
  );
  const done = useSetup((s) => s.states.captions === "done");
  const [models, setModels] = useState<SpeechModel[] | null>(null);
  const [setup, setSetup] = useState<SpeechSetup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const running = job?.status === "running";

  // Again when a download starts and ends, so the cards say what is downloaded and what is left.
  useEffect(() => {
    let live = true;
    Promise.all([api.speechModels(), api.speechSetup(language)]).then(
      ([models, setup]) => {
        if (!live) return;
        setModels(models);
        setSetup(setup);
      },
      (e) => live && setError(plainError(errorText(e))),
    );
    return () => {
      live = false;
    };
  }, [language, downloads]);

  const recommended = setup && recommend(language, setup.gpu);
  // Until a model is picked anywhere, the step starts on the one it recommends.
  useEffect(() => {
    if (recommended && !speechModelPicked()) setSpeechModel(recommended);
  }, [recommended]);

  const downloaded = !!models?.find((m) => m.id === model)?.downloaded;
  // Keep the chosen card visible when the model list is taller than the dialog.
  useEffect(() => {
    document.querySelector<HTMLInputElement>(`#setup-panel input[name="captions-model"]:checked`)?.closest("label")?.scrollIntoView({ block: "nearest" });
  }, [model, models]);
  useEffect(() => {
    if (downloaded && !done) useSetup.getState().finishStep("captions");
  }, [downloaded, done]);

  // Starting, stopping or ending a download removes the button that was pressed; the focus goes to what took its place.
  useEffect(() => {
    if (document.activeElement !== document.body) return;
    document.querySelector<HTMLElement>(running ? `#setup-panel button[aria-label="${STOP}"]` : "#setup-panel footer button:not([data-sample])")?.focus();
  }, [running, job?.status]);

  if (!models || !setup)
    return error ? (
      <p className="mt-3 flex gap-1.5 text-[12px] text-danger" role="alert">
        <AlertTriangle size={14} className="mt-px shrink-0" />
      Modely se nepodařilo načíst: {error}
      </p>
    ) : null;

  const askedNow = asked?.model === model && asked.language === language;
  const again = job && askedNow ? job.status : null;
  const busy = running ? "Wait for the download to finish" : null;
  const name = languageName(language);
  const picked = models.find((m) => m.id === model);
  const parts = (
    [
      [`model ${speechModelLabel(model, picked?.label ?? model)}`, setup.models.find((m) => m.id === model)?.missingMb ?? 0, picked?.sizeMb ?? 0],
      [`model časování slov (${name})`, setup.wordTimingMissingMb, setup.wordTimingMb ?? 0],
      ["detektor řeči", setup.voiceDetectorMissingMb, 0],
    ] as const
  ).filter(([, left]) => left > 0);
  const missing = parts.reduce((sum, [, left]) => sum + left, 0);
  const contents = LIST.format(parts.map(([what, left, size]) => `${left < size ? "zbytek: " : ""}${what} (${left} MB)`));
  // On the processor the recommendation depends on the language; a model picked over it stays, and so does a downloaded
  // one at least as big, since a bigger model gets fewer words wrong in every language in WER.
  const changeLanguage = (next: string) => {
    const to = recommend(next, setup.gpu);
    if (model === recommended && !(downloaded && MODEL_ORDER.indexOf(model) >= MODEL_ORDER.indexOf(to))) setSpeechModel(to);
    setSpeechLanguage(next);
  };
  const download = () => {
    asked = { model, language };
    setError(null);
    api.startSpeechSetup(model, language).catch((e) => setError(plainError(errorText(e))));
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-1 pt-3">
        <Field
          label="Jazyk mluveného slova"
          hint={
            language === "auto"
              ? "Přesné časování slov je dostupné pro češtinu a angličtinu; výběrem jazyka stáhnete příslušný model."
              : setup.wordTimingMb === null
                ? "Časování slov pro vybraný jazyk je přibližné, proto může být střih mezi slovy mírně nepřesný."
                : "Pro vybraný jazyk je dostupný model časování slov pro přesnější střih."
          }
        >
          <Select value={language} disabled={!!(lock ?? busy)} title={lock ?? busy ?? undefined} onChange={(e) => changeLanguage(e.target.value)}>
            {SPEECH_LANGUAGES.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </Select>
        </Field>
        <div role="radiogroup" aria-label="Model" className="flex flex-col gap-1.5">
          {models.map((m) => {
            const on = m.id === model;
            return (
              <label
                key={m.id}
                title={lock ?? busy ?? undefined}
                className={`flex cursor-pointer items-start gap-2.5 rounded-xl px-3 py-2 transition-colors duration-[120ms] ease-out has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-40 ${
                  on ? "bg-white/[.08] shadow-[inset_0_0_0_1.5px_var(--color-accent)]" : "bg-white/[.055] shadow-[inset_0_0_0_1px_rgb(255_255_255/.06)] has-[:enabled]:hover:bg-white/[.08]"
                }`}
              >
                <span className="relative mt-0.5 inline-flex">
                  <input
                    type="radio"
                    name="captions-model"
                    value={m.id}
                    checked={on}
                    disabled={!!(lock ?? busy)}
                    onChange={() => setSpeechModel(m.id)}
                    className="peer absolute inset-0 m-0 h-full w-full cursor-[inherit] opacity-0"
                  />
                  <span
                    aria-hidden
                    className={`size-4 rounded-full border transition-colors duration-[120ms] ease-out peer-focus-visible:outline-2 peer-focus-visible:outline-offset-1 peer-focus-visible:outline-accent ${
                      on ? "border-[5px] border-accent-strong bg-white" : "border-white/25 bg-white/[.07]"
                    }`}
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2 leading-5">
                    <span className="text-[13px] font-medium text-fg">{speechModelLabel(m.id, m.label)}</span>
                    {m.id === recommended && <span className="text-[12px] font-medium text-fg">Doporučeno</span>}
                    <span className="tabular ml-auto text-[12px] text-muted">{m.sizeMb} MB</span>
                  </span>
                  <span className="flex items-center gap-2 text-[12px] leading-4 text-muted">
                    <span className="tabular min-w-0 flex-1">{note(m.id, language, setup.gpu)}</span>
                    {m.downloaded ? (
                      <span className="flex shrink-0 items-center gap-1 text-fg">
                        <Check size={12} strokeWidth={3} className="text-ok" /> Staženo
                      </span>
                    ) : (
                      <span className="shrink-0">Nestaženo</span>
                    )}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
        <p className="text-[12px] text-muted">
          {setup.gpu ? "Tento počítač rozpoznává řeč pomocí grafické karty." : "Tento počítač rozpoznává řeč procesorem, proto jsou menší modely výrazně rychlejší."}
        </p>
        <p className="text-[12px] text-muted">Přesnost vychází z testovací sady FLEURS; rychlost byla měřena na Apple M4 Pro. Na vašem videu a počítači se výsledky mohou lišit.</p>
      </div>
      {running ? (
        <LockReason.Provider value={null}>
          <div className="mt-3 flex flex-col gap-1.5" role="status">
            <div className="flex items-center gap-2 text-[12px]">
              <Loader2 size={13} className="shrink-0 animate-spin text-accent" />
              <span className="min-w-0 flex-1 truncate text-fg">{job.phase ?? "Spouštění"}</span>
              {job.progress > 0 && <span className="tabular text-muted">{Math.round(job.progress * 100)}%</span>}
              <Button variant="ghost" className="h-7 px-2" aria-label={STOP} onClick={() => void api.cancelJob(JOB)}>
                Zastavit
              </Button>
            </div>
            <ProgressBar value={job.progress} label="Stahování modelu řeči" />
          </div>
        </LockReason.Provider>
      ) : error && askedNow ? (
        <p className="mt-3 flex gap-1.5 text-[12px] text-fg" role="alert">
          <AlertTriangle size={14} className="mt-px shrink-0 text-warn" />
          {error}
        </p>
      ) : again === "failed" ? (
        <div className="mt-3">
          <JobError job={job} />
        </div>
      ) : again === "cancelled" ? (
        <p className="mt-3 text-[12px] text-muted" role="status">
          Zastaveno. Stahování můžete obnovit od místa, kde skončilo.
        </p>
      ) : missing > 0 ? (
        <p className="tabular mt-3 text-[12px] text-muted">Ke stažení: {contents}.</p>
      ) : null}
      {/* A stop while the last file was checked leaves nothing to fetch, only to install. */}
      {!running && (missing > 0 || !downloaded) && (
        <StepActions>
          <Button pill variant={done ? "secondary" : "primary"} onClick={download}>
            {again === "failed" ? "Zkusit znovu" : again === "cancelled" ? "Pokračovat ve stahování" : missing > 0 ? `Stáhnout ${missing} MB` : "Stáhnout"}
          </Button>
        </StepActions>
      )}
    </div>
  );
}
