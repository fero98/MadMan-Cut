import { create } from "zustand";

/** The guide is a viewer: opening it never creates or modifies a project. */
export const useGuide = create<{ open: boolean; section: "general" | "ai" }>(() => ({ open: false, section: "general" }));
