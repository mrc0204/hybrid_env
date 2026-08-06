import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

/**
 * The design system, expressed as tokens.
 *
 * Two rules govern every value here:
 *  - Color carries meaning. The severity ramp is the only saturated color in
 *    the system, so saturation itself reads as "something needs attention".
 *  - The surface ramp is built from low-alpha white over a near-black base
 *    rather than discrete greys, so elevation stays coherent when the ambient
 *    field shifts hue underneath it.
 */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Base canvas — a near-black with a cool cast. Pure #000 reads as
        // "unstyled"; this reads as deliberate.
        void: "#07080B",
        surface: {
          DEFAULT: "rgba(255,255,255,0.024)",
          raised: "rgba(255,255,255,0.040)",
          overlay: "rgba(255,255,255,0.060)",
        },
        line: {
          DEFAULT: "rgba(255,255,255,0.070)",
          strong: "rgba(255,255,255,0.120)",
          subtle: "rgba(255,255,255,0.045)",
        },
        ink: {
          DEFAULT: "#ECEDF2",
          muted: "#8A8FA3",
          faint: "#585D71",
          ghost: "#3A3E4E",
        },
        // The single accent. Periwinkle reads as "intelligent" without the
        // cyan-on-black cliché that every AI demo reaches for.
        cognition: {
          DEFAULT: "#8B9CFF",
          bright: "#A9B6FF",
          dim: "#5B68B8",
          glow: "rgba(139,156,255,0.18)",
        },
        severity: {
          low: "#5BBFA0",
          medium: "#E0A458",
          high: "#E07B54",
          critical: "#E05563",
        },
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      fontSize: {
        // Display sizes carry negative tracking; small sizes carry positive.
        // This is what keeps large type architectural and small type legible.
        display: ["3.25rem", { lineHeight: "1.04", letterSpacing: "-0.032em" }],
        headline: ["2rem", { lineHeight: "1.12", letterSpacing: "-0.024em" }],
        title: ["1.25rem", { lineHeight: "1.25", letterSpacing: "-0.014em" }],
        label: ["0.6875rem", { lineHeight: "1.3", letterSpacing: "0.09em" }],
        micro: ["0.625rem", { lineHeight: "1.3", letterSpacing: "0.12em" }],
      },
      transitionTimingFunction: {
        // Expo-out. Fast commitment then a long settle — motion that feels
        // decided rather than mechanical.
        thought: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
      keyframes: {
        breathe: {
          "0%, 100%": { opacity: "0.32" },
          "50%": { opacity: "0.85" },
        },
        travel: {
          "0%": { transform: "translateY(-100%)", opacity: "0" },
          "40%": { opacity: "1" },
          "100%": { transform: "translateY(400%)", opacity: "0" },
        },
        scan: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(220%)" },
        },
      },
      animation: {
        breathe: "breathe 3.2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        travel: "travel 1.6s cubic-bezier(0.16, 1, 0.3, 1) infinite",
        scan: "scan 2.4s cubic-bezier(0.4, 0, 0.2, 1) infinite",
      },
    },
  },
  plugins: [animate],
} satisfies Config;
