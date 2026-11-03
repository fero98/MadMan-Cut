import type { ComponentType } from "react";
import type { SetupStep } from "../../lib/setup";
import { AiStep } from "./steps/AiStep";
import { CaptionsStep } from "./steps/CaptionsStep";
import { MusicStep } from "./steps/MusicStep";
import { VisionStep } from "./steps/VisionStep";

export const STEPS: Record<SetupStep, { title: string; Body: ComponentType }> = {
  captions: { title: "Model pro titulky", Body: CaptionsStep },
  vision: { title: "Modely obličeje a postavy", Body: VisionStep },
  music: { title: "Hudba z YouTube", Body: MusicStep },
  ai: { title: "Připojení AI", Body: AiStep },
};
