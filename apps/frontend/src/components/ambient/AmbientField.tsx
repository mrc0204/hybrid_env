import { motion } from "framer-motion";

import { SEVERITY_HEX, type Severity } from "@/lib/severity";
import { AmbientCanvas } from "./AmbientCanvas";

interface AmbientFieldProps {
  severity: Severity | null;
  isThinking: boolean;
  onRevealReady?: () => void;
}

/**
 * The room's mood & living WebGL intelligence canvas.
 *
 * Blends Three.js dynamic particle & neural network intelligence canvas
 * with soft ambient peripheral lighting and noise grain texture.
 */
export function AmbientField({ severity, isThinking, onRevealReady }: AmbientFieldProps) {
  const hue = severity ? SEVERITY_HEX[severity] : "#7B8DFF";
  const intensity = severity === "critical" ? 0.3 : severity === "high" ? 0.22 : 0.15;

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
      {/* Three.js WebGL Living Intelligence Particle & Neural Network Canvas */}
      <AmbientCanvas
        isThinking={isThinking}
        severityColor={hue}
        onRevealReady={onRevealReady}
      />

      {/* Primary bloom — anchors the composition's optical centre. */}
      <motion.div
        className="absolute -left-[10%] top-[-20%] h-[70vh] w-[70vw] rounded-full blur-[130px]"
        animate={{
          backgroundColor: hue,
          opacity: isThinking ? intensity : intensity * 0.62,
          scale: isThinking ? [1, 1.07, 1] : 1,
        }}
        transition={{
          backgroundColor: { duration: 2.4, ease: "easeInOut" },
          opacity: { duration: 1.8 },
          scale: { duration: 12, repeat: Infinity, ease: "easeInOut" },
        }}
      />

      {/* Counterweight bloom */}
      <motion.div
        className="absolute bottom-[-25%] right-[-5%] h-[60vh] w-[55vw] rounded-full blur-[140px]"
        animate={{
          backgroundColor: hue,
          opacity: isThinking ? intensity * 0.7 : intensity * 0.4,
          scale: isThinking ? [1.05, 1, 1.05] : 1,
        }}
        transition={{
          backgroundColor: { duration: 2.4, ease: "easeInOut" },
          opacity: { duration: 1.8 },
          scale: { duration: 16, repeat: Infinity, ease: "easeInOut" },
        }}
      />

      {/* Noise Grain texture */}
      <div
        className="absolute inset-0 opacity-[0.16] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")",
        }}
      />

      {/* Vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(5,6,8,0.85)_100%)]" />
    </div>
  );
}
