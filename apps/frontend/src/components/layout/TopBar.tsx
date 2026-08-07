import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

import { fetchPlaceSuggestions, type PlaceSuggestion, FAMOUS_LANDMARKS } from "@/api/client";
import { cn } from "@/lib/utils";
import { peakSeverity } from "@/lib/severity";
import { useCognition } from "@/store/cognition";
import { useDiscoveryStore } from "@/store/discoveryStore";

import { useVoiceIntelligence } from "@/hooks/useVoiceIntelligence";

interface TopBarProps {
  onDiscover: (
    orgName: string,
    center?: { lat: number; lng: number },
    boundingBox?: { south: number; west: number; north: number; east: number },
  ) => void;
}

export function TopBar({ onDiscover }: TopBarProps) {
  const isRunning = useCognition((s) => s.isRunning);
  const cycleCount = useCognition((s) => s.cycleCount);
  const trace = useCognition((s) => s.trace);
  const severity = peakSeverity(trace.risks);

  const { isListening, isSpeaking, startListening, stopListening, stopSpeaking, isSupported } =
    useVoiceIntelligence((location) => onDiscover(location));

  return (
    <header className="flex shrink-0 items-center justify-between gap-3 px-4 py-3 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:px-7 lg:py-4">
      {/* ── Left: identity ─────────────────────────────────────────────────── */}
      <div className="flex min-w-0 items-baseline gap-3">
        <h1 className="shrink-0 text-[12px] font-medium tracking-[-0.01em] text-ink sm:text-[13px]">
          Environment Intelligence
        </h1>
        <span className="hidden min-w-0 truncate font-mono text-[10px] text-ink-ghost sm:inline">
          {trace.worldState.scope}
        </span>
      </div>

      {/* ── Centre: discovery input + Voice Controls ────────────────────────── */}
      <div className="hidden justify-center items-center gap-3 lg:flex">
        <DiscoveryInput onDiscover={onDiscover} />

        {/* Voice Control Button */}
        {isSupported && (
          <button
            type="button"
            onClick={() => {
              if (isSpeaking) {
                stopSpeaking();
              } else if (isListening) {
                stopListening();
              } else {
                startListening();
              }
            }}
            className={cn(
              "relative flex items-center justify-center h-7 w-7 rounded-full border transition-all duration-300",
              isListening
                ? "border-amber-400 bg-amber-500/20 text-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.5)]"
                : isSpeaking
                  ? "border-emerald-400 bg-emerald-500/20 text-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.5)]"
                  : "border-white/20 bg-surface/80 text-ink-muted hover:border-cognition/60 hover:text-cognition",
            )}
            title={
              isSpeaking
                ? "Stop Briefing (Mute)"
                : isListening
                  ? "Listening... Click to cancel"
                  : "Start Voice Control (Speak location or 'Explain')"
            }
          >
            {isListening && (
              <span className="absolute inset-0 rounded-full bg-amber-400/30 animate-ping" />
            )}
            {isSpeaking && (
              <span className="absolute inset-0 rounded-full bg-emerald-400/30 animate-ping" />
            )}

            {isSpeaking ? (
              <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth={2}>
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth={2}>
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="22" />
              </svg>
            )}
          </button>
        )}
      </div>

      {/* ── Right: system status ────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center justify-end gap-3 lg:gap-5">
        <div className="flex items-center gap-2">
          <motion.span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              isRunning ? "bg-cognition" : severity ? "bg-severity-medium" : "bg-severity-low",
            )}
            animate={isRunning ? { opacity: [1, 0.25, 1] } : { opacity: 1 }}
            transition={{ duration: 1.4, repeat: isRunning ? Infinity : 0, ease: "easeInOut" }}
          />
          <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            {isRunning ? "Reasoning" : "Observing"}
          </span>
        </div>

        <div className="h-3 w-px bg-line" />

        <span className="numeric text-[10px] text-ink-ghost">
          cycle {String(cycleCount).padStart(3, "0")}
        </span>
      </div>
    </header>
  );
}

/**
 * Minimal discovery input. No border box — just an underline that appears on
 * focus, and an arrow button that appears when there is text to submit.
 *
 * Disabled while discovery is already running so the user cannot queue a
 * second discovery before the first completes.
 */
function DiscoveryInput({
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
  const discoveryPhase = useDiscoveryStore((s) => s.phase);
  const isDiscovering = discoveryPhase !== "idle";

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
    if (trimmed && !isDiscovering) {
      onDiscover(trimmed);
      setValue("");
      setIsOpen(false);
    }
  };

  const handleSelect = (item: PlaceSuggestion) => {
    onDiscover(item.displayName, { lat: item.lat, lng: item.lng }, item.boundingBox);
    setValue("");
    setIsOpen(false);
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 relative">
      <div className="relative">
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
          placeholder="Discover organization…"
          disabled={isDiscovering}
          aria-label="Organization name to discover"
          className={cn(
            "w-52 bg-transparent py-0.5 text-[11px] text-ink-muted outline-none",
            "placeholder:text-ink-ghost",
            "disabled:cursor-not-allowed disabled:opacity-40",
          )}
        />
        {/* Underline — appears on focus */}
        <motion.div
          className="absolute bottom-0 left-0 h-px w-full origin-left bg-line-strong"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: focused ? 1 : 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>

      <AnimatePresence>
        {value.trim() && !isDiscovering && (
          <motion.button
            type="submit"
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -6 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            aria-label="Start discovery"
            className="text-[13px] text-ink-ghost transition-colors duration-200 hover:text-cognition"
          >
            →
          </motion.button>
        )}
      </AnimatePresence>

      {/* Autocomplete suggestions dropdown */}
      <AnimatePresence>
        {isOpen && suggestions.length > 0 && (
          <motion.ul
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-0 top-full mt-2 w-[340px] max-h-[240px] overflow-y-auto rounded-lg border border-white/15 bg-[#0a0b0e] shadow-[0_8px_32px_rgba(0,0,0,0.9)] z-50 py-1 text-left"
          >
              {value.trim().length < 3 && (
                <li className="px-3.5 py-2 text-[11px] font-mono uppercase tracking-widest text-slate-300 border-b border-white/10 bg-[#14161f] select-none">
                  Famous Global & Indian Locations
                </li>
              )}
            {suggestions.map((item, idx) => (
              <li
                key={idx}
                onMouseDown={() => handleSelect(item)}
                className="px-3.5 py-2.5 text-[11px] text-slate-200 leading-normal hover:bg-[#181a24] hover:text-white cursor-pointer border-b border-white/5 last:border-b-0 transition-colors duration-150 truncate font-normal"
                title={item.displayName}
              >
                {item.displayName}
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </form>
  );
}
