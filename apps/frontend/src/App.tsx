import { AmbientField } from "@/components/ambient/AmbientField";
import { EnvironmentMap, MapLegend } from "@/components/environment/EnvironmentMap";
import { TopBar } from "@/components/layout/TopBar";
import { RecommendationPanel } from "@/components/recommendation/RecommendationPanel";
import { ReasoningSpine } from "@/components/spine/ReasoningSpine";
import { StageDetail } from "@/components/spine/StageDetail";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { useCognitiveCycle } from "@/hooks/useCognitiveCycle";
import { peakSeverity } from "@/lib/severity";
import { useCognition } from "@/store/cognition";

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
 */
export default function App() {
  useCognitiveCycle(true);

  const trace = useCognition((s) => s.trace);
  const isRunning = useCognition((s) => s.isRunning);
  const severity = peakSeverity(trace.risks);

  return (
    <div className="relative flex h-full flex-col">
      <AmbientField severity={severity} isThinking={isRunning} />

      <div className="relative z-10 flex h-full flex-col">
        <TopBar />

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
    </div>
  );
}
