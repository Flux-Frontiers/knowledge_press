import { create } from "zustand";
import type { TimeOfDay } from "./daylight";
import { effectiveTime, moonPhaseName, nextSunEvent, skyState, timeZonePlace, type Place, type SkyState, type TimeMode } from "./sky";
import type { SeasonName } from "./seasons";
import { readPreferences, type Preferences } from "./preferences";
import { resetInput } from "./input";

const SAVE_KEY = "kpf-library-v1";
const SAVE_VERSION = 1;

type SaveBlob = {
  version: number;
  library: string[];
  grovesVisited: string[];
  season: SeasonName;
  timeMode: TimeMode;
  /** The browser's location, rounded to 0.1 degree, once it has been given. */
  place: Place | null;
  preferences: Preferences;
};

const TIME_CYCLE: Record<TimeMode, TimeMode> = { live: "dawn", dawn: "day", day: "dusk", dusk: "night", night: "live" };

function loadSave(): SaveBlob {
  const defaults: SaveBlob = {
    version: SAVE_VERSION,
    library: [],
    grovesVisited: [],
    season: "summer",
    timeMode: "live",
    place: null,
    preferences: readPreferences(),
  };
  if (typeof window === "undefined") return defaults;
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<SaveBlob> & { timeOfDay?: TimeOfDay };
    return {
      ...defaults,
      ...parsed,
      version: SAVE_VERSION,
      library: Array.isArray(parsed.library) ? parsed.library : [],
      grovesVisited: Array.isArray(parsed.grovesVisited) ? parsed.grovesVisited : [],
      season:
        parsed.season === "spring" ||
        parsed.season === "summer" ||
        parsed.season === "autumn" ||
        parsed.season === "winter"
          ? parsed.season
          : "summer",
      // Saves from before the clock kept only a day/night flag; night stays night.
      timeMode: typeof parsed.timeMode === "string" && Object.hasOwn(TIME_CYCLE, parsed.timeMode)
        ? parsed.timeMode as TimeMode
        : parsed.timeOfDay === "night" ? "night" : "live",
      place: parsed.place && Number.isFinite(parsed.place.lat) && Number.isFinite(parsed.place.lon) ? parsed.place : null,
      preferences: readPreferences(parsed.preferences),
    };
  } catch {
    return defaults;
  }
}

function persist(s: {
  library: string[];
  grovesVisited: string[];
  season: SeasonName;
  timeMode: TimeMode;
  place: Place | null;
  preferences: Preferences;
}) {
  try {
    const blob: SaveBlob = {
      version: SAVE_VERSION,
      library: s.library,
      grovesVisited: s.grovesVisited,
      season: s.season,
      timeMode: s.timeMode,
      place: s.place,
      preferences: s.preferences,
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(blob));
  } catch {
    /* private mode / quota */
  }
}

export type TravelMode = "free" | "circuit";

export type JumpPose = {
  x: number;
  z: number;
  yaw: number;
};

export type PlaqueText = { title: string; byline: string; body: string };

export type GameStore = {
  playing: boolean;
  preferences: Preferences;
  setPreferences: (patch: Partial<Preferences>) => void;
  paused: boolean;
  season: SeasonName;
  /** Night or day as the sky now looks, derived from `sky`: what the lamps and glows switch on. */
  timeOfDay: TimeOfDay;
  timeMode: TimeMode;
  place: Place | null;
  sky: SkyState;
  /** In live mode, the next sunrise or sunset. */
  sunEvent: { kind: "sunrise" | "sunset"; at: Date } | null;
  moonName: string;
  query: string;
  searchPick: string | null;
  library: string[];
  grovesVisited: string[];
  nearbySlug: string | null;
  nearbyDist: number;
  nearbyDismissed: string | null;
  questHintHidden: string | null;
  speed: number;
  x: number;
  z: number;
  yaw: number;
  toast: string | null;
  /** Last sampled render stats, when preferences.stats is on. */
  stats: { tris: number; calls: number; fps: number } | null;
  setStats: (stats: { tris: number; calls: number; fps: number } | null) => void;
  libraryOpen: boolean;
  helpOpen: boolean;
  lastReadSlug: string | null;
  selectedGrove: string | null;
  atlasOpen: boolean;
  /** The corpus catalog: every book, to jump to its tree. */
  catalogOpen: boolean;
  /** The genre the book list is narrowed to, when opened from a grove's marker. */
  catalogGenre: string | null;
  /** An exhibit plaque shown full size to read, after clicking it in the forest. */
  plaque: PlaqueText | null;
  /** Hide the HUD's buttons, cards and search, leaving the map and the driving controls. */
  cleanView: boolean;
  toggleCleanView: () => void;
  travelMode: TravelMode;
  jump: JumpPose | null;
  play: () => void;
  pause: (v?: boolean) => void;
  setSeason: (s: SeasonName) => void;
  /** Cycle the clock: live, then fixed day, then fixed night. */
  toggleTimeOfDay: () => void;
  /** Recompute the sky for the current moment; called every few seconds. */
  tickSky: () => void;
  setPlace: (place: Place) => void;
  setQuery: (q: string) => void;
  pickSearch: (slug: string | null) => void;
  collect: (slug: string, title: string) => void;
  markGrove: (genre: string) => void;
  setNearby: (slug: string | null, dist: number) => void;
  dismissNearby: () => void;
  dismissQuestHint: (id: string) => void;
  setPose: (x: number, z: number, yaw: number, speed: number) => void;
  setToast: (msg: string | null) => void;
  toggleLibrary: () => void;
  toggleHelp: () => void;
  setLastRead: (slug: string | null) => void;
  selectGrove: (genre: string | null) => void;
  toggleAtlas: () => void;
  setAtlasOpen: (v: boolean) => void;
  toggleCatalog: () => void;
  setCatalogOpen: (v: boolean) => void;
  openCatalog: (genre: string | null) => void;
  openPlaque: (plaque: PlaqueText | null) => void;
  setTravelMode: (m: TravelMode) => void;
  toggleCircuit: () => void;
  requestJump: (pose: JumpPose, toast?: string) => void;
  clearJump: () => void;
};

const initial = loadSave();

/** What the sky shows: the moment the mode picks, the sun and moon there, and what the HUD says of them. */
function readSky(mode: TimeMode, place: Place | null, now = new Date()) {
  const where = place ?? timeZonePlace(now);
  const sky = skyState(effectiveTime(mode, now, where), where);
  return {
    sky,
    timeOfDay: (sky.daylight < 0.3 ? "night" : "day") as TimeOfDay,
    sunEvent: mode === "live" ? nextSunEvent(now, where) : null,
    moonName: moonPhaseName(sky.moonPhase),
  };
}

export const useGame = create<GameStore>((set, get) => ({
  playing: false,
  preferences: initial.preferences,
  setPreferences: (patch) => {
    const preferences = readPreferences({ ...get().preferences, ...patch });
    set({ preferences });
    persist(get());
  },
  paused: false,
  season: initial.season,
  timeMode: initial.timeMode,
  place: initial.place,
  ...readSky(initial.timeMode, initial.place),
  query: "",
  searchPick: null,
  library: initial.library,
  grovesVisited: initial.grovesVisited,
  nearbySlug: null,
  nearbyDist: 99,
  nearbyDismissed: null,
  questHintHidden: null,
  speed: 0,
  x: 0,
  z: 0,
  yaw: 0,
  toast: null,
  stats: null,
  setStats: (stats) => set({ stats }),
  libraryOpen: false,
  helpOpen: false,
  lastReadSlug: null,
  selectedGrove: null,
  atlasOpen: false,
  catalogOpen: false,
  catalogGenre: null,
  plaque: null,
  cleanView: false,
  toggleCleanView: () => set({ cleanView: !get().cleanView }),
  travelMode: "free",
  jump: null,
  play: () => set({ playing: true, paused: false }),
  pause: (v) => {
    resetInput();
    set({ paused: v ?? !get().paused });
  },
  setSeason: (season) => {
    set({ season });
    persist({ ...get(), season });
  },
  toggleTimeOfDay: () => {
    const timeMode = TIME_CYCLE[get().timeMode];
    set({ timeMode, ...readSky(timeMode, get().place) });
    persist(get());
  },
  tickSky: () => set(readSky(get().timeMode, get().place)),
  setPlace: (place) => {
    set({ place, ...readSky(get().timeMode, place) });
    persist(get());
  },
  setQuery: (query) => set({ query, searchPick: null }),
  pickSearch: (searchPick) => set({ searchPick }),
  collect: (slug, title) => {
    const lib = get().library;
    if (lib.includes(slug)) {
      set({ lastReadSlug: slug, toast: title });
      return;
    }
    const library = [...lib, slug];
    set({ library, lastReadSlug: slug, toast: `Pressed · ${title}` });
    persist({ ...get(), library });
  },
  markGrove: (genre) => {
    const grovesVisited = get().grovesVisited;
    if (grovesVisited.includes(genre)) return;
    const next = [...grovesVisited, genre];
    set({ grovesVisited: next });
    persist({ ...get(), grovesVisited: next });
  },
  setNearby: (nearbySlug, nearbyDist) => {
    const prev = get().nearbySlug;
    if (nearbySlug === prev) {
      set({ nearbyDist });
      return;
    }
    set({ nearbySlug, nearbyDist, nearbyDismissed: null });
  },
  dismissNearby: () => {
    const slug = get().nearbySlug;
    if (slug) set({ nearbyDismissed: slug });
  },
  dismissQuestHint: (id) => set({ questHintHidden: id }),
  setPose: (x, z, yaw, speed) => set({ x, z, yaw, speed }),
  setToast: (toast) => set({ toast }),
  toggleLibrary: () => set({ libraryOpen: !get().libraryOpen, atlasOpen: false, catalogOpen: false }),
  toggleHelp: () => set({ helpOpen: !get().helpOpen }),
  setLastRead: (lastReadSlug) => set({ lastReadSlug }),
  selectGrove: (selectedGrove) => set({ selectedGrove }),
  toggleAtlas: () => set({ atlasOpen: !get().atlasOpen, libraryOpen: false, catalogOpen: false }),
  setAtlasOpen: (atlasOpen) => set({ atlasOpen }),
  toggleCatalog: () => set({ catalogOpen: !get().catalogOpen, catalogGenre: null, atlasOpen: false, libraryOpen: false }),
  openCatalog: (catalogGenre) => set({ catalogOpen: true, catalogGenre, atlasOpen: false, libraryOpen: false }),
  setCatalogOpen: (catalogOpen) => set({ catalogOpen }),
  openPlaque: (plaque) => set(plaque ? { plaque, catalogOpen: false, atlasOpen: false, libraryOpen: false } : { plaque: null }),
  // Leaving the ring drops the grove it was pointing at, so the lantern trail goes with it.
  setTravelMode: (travelMode) =>
    set(travelMode === "free" && get().travelMode === "circuit" ? { travelMode, selectedGrove: null } : { travelMode }),
  toggleCircuit: () => {
    const next = get().travelMode === "circuit" ? "free" : "circuit";
    set({
      travelMode: next,
      ...(next === "free" ? { selectedGrove: null } : {}),
      toast: next === "circuit" ? "Riding the ring · steer to hop off" : "Free drive",
    });
  },
  requestJump: (jump, toast) => {
    resetInput();
    set({
      jump,
      travelMode: "free",
      atlasOpen: false,
      libraryOpen: false,
      catalogOpen: false,
      toast: toast ?? null,
    });
  },
  clearJump: () => set({ jump: null }),
}));
