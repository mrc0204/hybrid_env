import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

import { fetchPlaceSuggestions, type PlaceSuggestion, FAMOUS_LANDMARKS } from "@/api/client";
import { cn } from "@/lib/utils";
import { peakSeverity } from "@/lib/severity";
import { useCognition } from "@/store/cognition";
import { useDiscoveryStore } from "@/store/discoveryStore";

interface TopBarProps {
  onDiscover: (
    orgName: string,
    center?: { lat: number; lng: number },
    boundingBox?: { south: number; west: number; north: number; east: number },
  ) => void;
}

/**
 * System identity, liveness, and the discovery entry point.
 *
 * The input is minimal by design — a single underline field that recedes when
 * empty and only shows the submit arrow when there is something to submit.
 * Discovering an organization is an intentional act, not an ambient control.
 */
export function TopBar({ onDiscover }: TopBarProps) {
  const isRunning = useCognition((s) => s.isRunning);
  const cycleCount = useCognition((s) => s.cycleCount);
  const trace = useCognition((s) => s.trace);
  const severity = peakSeverity(trace.risks);

  return (
    <header className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center px-7 py-4">
      {/* ── Left: identity ─────────────────────────────────────────────────── */}
      <div className="flex items-baseline gap-3">
        <h1 className="text-[13px] font-medium tracking-[-0.01em] text-ink">
          Environment Intelligence
        </h1>
        <span className="font-mono text-[10px] text-ink-ghost">{trace.worldState.scope}</span>
      </div>

      {/* ── Centre: discovery input ─────────────────────────────────────────── */}
      <DiscoveryInput onDiscover={onDiscover} />

      {/* ── Right: system status ────────────────────────────────────────────── */}
      <div className="flex items-center justify-end gap-5">
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
