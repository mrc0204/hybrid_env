import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

import { fetchPlaceSuggestions, type PlaceSuggestion, FAMOUS_LANDMARKS } from "@/api/client";

import { AmbientField } from "@/components/ambient/AmbientField";
import { DiscoveryOverlay } from "@/components/discovery/DiscoveryOverlay";
import { EnvironmentMap, MapLegend } from "@/components/environment/EnvironmentMap";
import { TopBar } from "@/components/layout/TopBar";
import { RecommendationPanel } from "@/components/recommendation/RecommendationPanel";
import { ReasoningSpine } from "@/components/spine/ReasoningSpine";
import { StageDetail } from "@/components/spine/StageDetail";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { useCognitiveCycle } from "@/hooks/useCognitiveCycle";
import { useDiscovery } from "@/hooks/useDiscovery";
import { peakSeverity } from "@/lib/severity";
import { cn } from "@/lib/utils";
import { useCognition } from "@/store/cognition";
import { useDiscoveryStore } from "@/store/discoveryStore";

/**
 * The composition.
 *
 * Three columns, but not a dashboard grid — they are the three questions in
 * order, left to right: what is happening, what it means, what to do. Column
 * widths encode importance: the reasoning trace gets the most space because
 * it is the argument, and the recommendation gets a full column because it is
 * the conclusion.
 *
 * The page never scrolls. Each panel owns its overflow, so the composition
 * stays fixed and the eye always finds the same things in the same places.
 *
 * The discovery hook is instantiated here — once — so timers and the abort
 * controller outlive individual sub-components and can be passed down cleanly.
 */
export default function App() {
  useCognitiveCycle(true);

  const { discover, cancel } = useDiscovery();

  const trace = useCognition((s) => s.trace);
  const isRunning = useCognition((s) => s.isRunning);
  const assessedOrganization = useCognition((s) => s.assessedOrganization);
  const severity = peakSeverity(trace.risks);

  const discoveryPhase = useDiscoveryStore((s) => s.phase);
  const isDiscoveryVisible = discoveryPhase !== "idle";

  const handleDismiss = () => useDiscoveryStore.getState().reset();

  // ── Landing State ─────────────────────────────────────────────────────────
  // Prompt the user for the location/organization to assess first.
  if (!isDiscoveryVisible && assessedOrganization === null) {
    return (
      <div className="relative flex h-full flex-col items-center justify-center bg-void">
        <AmbientField severity={null} isThinking={false} />

        <div className="relative z-10 w-full max-w-[440px] px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center gap-6"
          >
            {/* Branding badge */}
            <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.25em] text-cognition">
              <span className="h-1 w-1 rounded-full bg-cognition animate-pulse" />
              Agentic Core
            </div>

            <div>
              <h1 className="text-[26px] font-extralight tracking-[-0.03em] text-ink leading-tight">
                Environment Intelligence
              </h1>
              <p className="mt-2 text-[12px] leading-relaxed text-ink-muted">
                Analyze a physical footprint to construct a live world model, map infrastructure risks, and deliberate personalized safety recommendations.
              </p>
            </div>

            {/* Input field and action button */}
            <LandingInput onDiscover={discover} />
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col">
      <AmbientField severity={severity} isThinking={isRunning} />

      <div className="relative z-10 flex h-full flex-col">
        <TopBar onDiscover={discover} />

        <main className="grid min-h-0 flex-1 grid-cols-[300px_minmax(0,1fr)_400px] gap-3 px-7 pb-7">
          {/* What is happening */}
          <div className="flex min-h-0 flex-col gap-3">
            <Panel className="shrink-0">
              <PanelHeader label="Cognitive cycle" />
              <div className="pb-3">
                <ReasoningSpine />
              </div>
            </Panel>

            <Panel className="min-h-0 flex-1">
              <PanelHeader label="Environment" />
              <div className="relative min-h-0 flex-1 px-3 pb-3">
                <EnvironmentMap />
                <MapLegend />
              </div>
            </Panel>
          </div>

          {/* What it means — the reasoning trace, given the most room. */}
          <Panel className="min-h-0">
            <PanelHeader
              label="Reasoning trace"
              detail={
                <span className="font-mono text-[10px] text-ink-ghost">{trace.worldState.id}</span>
              }
            />
            <StageDetail />
          </Panel>

          {/* What to do */}
          <Panel className="min-h-0">
            <PanelHeader label="Recommendation" />
            <RecommendationPanel />
          </Panel>
        </main>
      </div>

      {/* Discovery overlay — mounted above everything when active */}
      <AnimatePresence>
        {isDiscoveryVisible && (
          <DiscoveryOverlay key="discovery" onCancel={cancel} onDismiss={handleDismiss} />
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Centered startup input. Matches the overall visual system guidelines:
 * rich aesthetics, micro-animations, clear constraints.
 */
function LandingInput({
  onDiscover,
}: {
  onDiscover: (
    orgName: string,
    center?: { lat: number; lng: number },
    boundingBox?: { south: number; west: number; north: number; east: number },
  ) => void;
}) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const trimmed = value.trim();
    if (trimmed.length < 3) {
      if (focused) {
        setSuggestions(FAMOUS_LANDMARKS);
        setIsOpen(true);
      } else {
        setSuggestions([]);
        setIsOpen(false);
      }
      return;
    }

    const handler = setTimeout(() => {
      fetchPlaceSuggestions(trimmed).then((data) => {
        setSuggestions(data);
        setIsOpen(data.length > 0);
      });
    }, 450); // Debounce to respect Nominatim limits

    return () => clearTimeout(handler);
  }, [value, focused]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed) {
      onDiscover(trimmed);
      setIsOpen(false);
    }
  };

  const handleSelect = (item: PlaceSuggestion) => {
    onDiscover(item.displayName, { lat: item.lat, lng: item.lng }, item.boundingBox);
    setIsOpen(false);
  };

  return (
    <form onSubmit={handleSubmit} className="mt-2 w-full flex flex-col items-center gap-3 relative">
      <div className="relative w-full">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => {
            setFocused(true);
            setIsOpen(true);
            if (value.trim().length < 3) {
              setSuggestions(FAMOUS_LANDMARKS);
            }
          }}
          onBlur={() => {
            setFocused(false);
            // Allow click events to register before unmounting suggestions
            setTimeout(() => setIsOpen(false), 200);
          }}
          placeholder="Enter location or organization name..."
          className={cn(
            "w-full bg-surface border border-line rounded-lg px-4 py-2.5 text-[12px] text-ink outline-none transition-all duration-300",
            focused ? "border-cognition/40 bg-surface-raised shadow-[0_0_12px_rgba(139,156,255,0.06)]" : "hover:border-line-strong",
            "placeholder:text-ink-ghost",
          )}
        />

        {/* Autocomplete suggestions dropdown */}
        <AnimatePresence>
          {isOpen && suggestions.length > 0 && (
            <motion.ul
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="absolute left-0 right-0 top-full mt-2 max-h-[220px] overflow-y-auto rounded-lg border border-line bg-void/98 shadow-[0_4px_24px_rgba(0,0,0,0.75)] backdrop-blur-md z-50 py-1 text-left"
            >
              {value.trim().length < 3 && (
                <li className="px-3.5 py-1.5 text-[8.5px] font-mono uppercase tracking-widest text-cognition border-b border-line/10 bg-surface/30 select-none">
                  Famous Indian Landmarks
                </li>
              )}
              {suggestions.map((item, idx) => (
                <li
                  key={idx}
                  onMouseDown={() => handleSelect(item)}
                  className="px-3.5 py-2.5 text-[10px] text-ink-muted leading-normal hover:bg-surface hover:text-ink cursor-pointer border-b border-line/20 last:border-b-0 transition-colors duration-150 truncate"
                  title={item.displayName}
                >
                  {item.displayName}
                </li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>

      <button
        type="submit"
        disabled={!value.trim()}
        className={cn(
          "w-full rounded-lg bg-cognition py-2.5 font-mono text-[10px] uppercase tracking-wider text-void transition-all duration-300",
          value.trim()
            ? "cursor-pointer hover:bg-cognition-bright hover:shadow-[0_0_12px_rgba(139,156,255,0.3)]"
            : "cursor-not-allowed opacity-35",
        )}
      >
        Assess Footprint
      </button>

      <span className="font-mono text-[8.5px] text-ink-ghost tracking-wide">
        e.g., IIT Hyderabad, NIAT KKH Campus, or any OSM entity
      </span>
    </form>
  );
}
