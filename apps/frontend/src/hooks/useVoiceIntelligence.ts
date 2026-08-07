import { useCallback, useEffect, useRef, useState } from "react";
import { useCognition } from "@/store/cognition";
import { peakSeverity } from "@/lib/severity";
import { VoiceService } from "@/services/voiceService";

// Declare Web Speech API types for TypeScript
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

export function useVoiceIntelligence(onDiscover?: (location: string) => void) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoadingModel, setIsLoadingModel] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const trace = useCognition((s) => s.trace);
  const assessedOrganization = useCognition((s) => s.assessedOrganization);

  const voiceService = VoiceService.getInstance();

  // Initialize SpeechRecognition instance
  useEffect(() => {
    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      setIsSupported(false);
      return;
    }

    try {
      const instance = new SpeechRecognitionClass();
      instance.continuous = false;
      instance.interimResults = true;
      instance.lang = "en-US";
      recognitionRef.current = instance;
    } catch (err) {
      console.warn("SpeechRecognition init failed", err);
      setIsSupported(false);
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    voiceService.stop();
    setIsSpeaking(false);
    setIsLoadingModel(false);
  }, [voiceService]);

  // Executive Briefing Speech Synthesis (Kokoro Primary -> Web Speech Fallback)
  const speakBriefing = useCallback(() => {
    const rec = trace?.recommendation;
    if (!rec) return;

    const orgName = assessedOrganization || trace.worldState.scope || "target location";
    const shortName = orgName.split(",")[0] || orgName;
    const riskCount = trace.risks.length;
    const peakSev = peakSeverity(trace.risks) || "low";
    const confidencePct = Math.round(rec.confidence * 100);
    const govStatus = trace.decision?.governanceNotes?.includes("[CHALLENGED]")
      ? "challenged"
      : "approved";

    const speechText = `Analysis complete for ${shortName}. ${
      riskCount > 0 ? `${riskCount} active operational risks identified, with ${peakSev} peak severity.` : "No critical risks detected."
    } Recommended action: ${rec.action}. Confidence score is ${confidencePct} percent. The governance review ${govStatus} this recommendation.`;

    setIsLoadingModel(voiceService.isLoading());

    voiceService.speak(speechText, {
      onStart: () => {
        setIsLoadingModel(false);
        setIsSpeaking(true);
      },
      onEnd: () => {
        setIsLoadingModel(false);
        setIsSpeaking(false);
      },
      onError: () => {
        setIsLoadingModel(false);
        setIsSpeaking(false);
      },
    });
  }, [trace, assessedOrganization, voiceService]);

  // Voice Explainability ("Why?", "What evidence?")
  const explainTrace = useCallback(() => {
    const rec = trace?.recommendation;
    if (!rec) return;

    const shortName = (assessedOrganization || trace.worldState.scope || "location").split(",")[0];
    const explanationText = `Reasoning breakdown for ${shortName}: ${rec.reasoning}. This decision is backed by ${rec.evidence.length} evidence factors and multi-agent specialist consensus.`;

    setIsLoadingModel(voiceService.isLoading());

    voiceService.speak(explanationText, {
      onStart: () => {
        setIsLoadingModel(false);
        setIsSpeaking(true);
      },
      onEnd: () => {
        setIsLoadingModel(false);
        setIsSpeaking(false);
      },
      onError: () => {
        setIsLoadingModel(false);
        setIsSpeaking(false);
      },
    });
  }, [trace, assessedOrganization, voiceService]);

  // Voice Command Parser
  const parseCommand = useCallback(
    (text: string) => {
      const lower = text.toLowerCase().trim();

      if (lower.includes("stop") || lower.includes("mute") || lower.includes("quiet")) {
        stopSpeaking();
        return;
      }

      if (lower.includes("why") || lower.includes("explain") || lower.includes("evidence") || lower.includes("reason")) {
        explainTrace();
        return;
      }

      if (lower.includes("repeat") || lower.includes("briefing")) {
        speakBriefing();
        return;
      }

      // Match "Analyze [location]" or "Search [location]" or "Find [location]" or "Evaluate [location]"
      const match = lower.match(/(?:analyze|search|find|evaluate|assess|check)\s+(.+)/);
      if (match && match[1] && onDiscover) {
        const query = match[1].trim();
        if (query) {
          onDiscover(query);
          return;
        }
      }

      // If user spoke a raw place name like "Eiffel Tower" or "Times Square"
      if (lower.length >= 3 && onDiscover && !lower.includes("hello")) {
        onDiscover(text.trim());
      }
    },
    [onDiscover, explainTrace, speakBriefing, stopSpeaking],
  );

  const startListening = useCallback(() => {
    if (!recognitionRef.current || isListening) return;
    stopSpeaking();
    setError(null);

    const instance = recognitionRef.current;

    instance.onresult = (e: SpeechRecognitionEvent) => {
      const currentResult = e.results[e.results.length - 1];
      if (currentResult) {
        const text = currentResult[0]!.transcript;
        setTranscript(text);
        if (currentResult.isFinal) {
          setIsListening(false);
          parseCommand(text);
        }
      }
    };

    instance.onerror = (e: SpeechRecognitionErrorEvent) => {
      console.warn("Speech recognition error", e.error);
      setIsListening(false);
      if (e.error !== "no-speech") {
        setError(`Voice error: ${e.error}`);
      }
    };

    instance.onend = () => {
      setIsListening(false);
    };

    try {
      instance.start();
      setIsListening(true);
    } catch (err) {
      console.warn("Failed to start speech recognition", err);
      setIsListening(false);
    }
  }, [isListening, parseCommand, stopSpeaking]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        console.warn("Stop speech failed", err);
      }
      setIsListening(false);
    }
  }, [isListening]);

  return {
    isListening,
    isSpeaking,
    isLoadingModel,
    transcript,
    error,
    isSupported,
    startListening,
    stopListening,
    speakBriefing,
    explainTrace,
    stopSpeaking,
  };
}
