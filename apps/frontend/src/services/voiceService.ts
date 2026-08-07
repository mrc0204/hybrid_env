import { KokoroTTS } from "kokoro-js";

/**
 * VoiceService — Singleton manager for high-quality local Kokoro TTS with
 * resilient native SpeechSynthesis fallback.
 */
export class VoiceService {
  private static instance: VoiceService | null = null;

  private ttsModel: KokoroTTS | null = null;
  private isInitializing = false;
  private initFailed = false;
  private currentAudio: HTMLAudioElement | AudioBufferSourceNode | null = null;
  private audioCtx: AudioContext | null = null;

  private _isSpeaking = false;
  private _isLoading = false;

  private constructor() {}

  public static getInstance(): VoiceService {
    if (!VoiceService.instance) {
      VoiceService.instance = new VoiceService();
    }
    return VoiceService.instance;
  }

  public isSpeaking(): boolean {
    return this._isSpeaking || ("speechSynthesis" in window && window.speechSynthesis.speaking);
  }

  public isLoading(): boolean {
    return this._isLoading;
  }

  /**
   * Lazily initialize Kokoro TTS model (ONNX / WebAssembly).
   */
  private async initKokoro(): Promise<KokoroTTS | null> {
    if (this.ttsModel) return this.ttsModel;
    if (this.initFailed) return null;
    if (this.isInitializing) {
      let count = 0;
      while (this.isInitializing && count < 60) {
        await new Promise((r) => setTimeout(r, 100));
        count++;
      }
      return this.ttsModel;
    }

    this.isInitializing = true;
    this._isLoading = true;

    try {
      console.log("[VoiceService] Initializing local Kokoro TTS engine (onnx-community/Kokoro-82M-ONNX)...");
      const model = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-ONNX", {
        dtype: "q8",
        device: "wasm",
      });
      console.log("[VoiceService] Kokoro TTS engine initialized successfully!");
      this.ttsModel = model;
      this.isInitializing = false;
      this._isLoading = false;
      return model;
    } catch (err) {
      console.warn("[VoiceService] Kokoro TTS primary init error (trying secondary config...):", err);
      try {
        const model = await KokoroTTS.from_pretrained("kokoro-js/Kokoro-82M-v1.0-ONNX", {
          dtype: "fp32",
        });
        console.log("[VoiceService] Kokoro TTS engine initialized on secondary config!");
        this.ttsModel = model;
        this.isInitializing = false;
        this._isLoading = false;
        return model;
      } catch (err2) {
        console.warn("[VoiceService] Kokoro TTS init failed, using Web SpeechSynthesis fallback:", err2);
        this.initFailed = true;
        this.isInitializing = false;
        this._isLoading = false;
        return null;
      }
    }
  }

  /**
   * Speak text using Kokoro TTS (Primary) or Native SpeechSynthesis (Fallback).
   */
  public async speak(
    text: string,
    options?: { onStart?: () => void; onEnd?: () => void; onError?: () => void },
  ): Promise<void> {
    this.stop();

    options?.onStart?.();
    this._isSpeaking = true;

    // Fast path: if Kokoro TTS is already initialized, generate neural speech
    if (this.ttsModel) {
      try {
        const audioData = await this.ttsModel.generate(text, {
          voice: "af_sarah",
          speed: 1.05,
        });

        if (audioData) {
          await this.playAudioRaw(audioData, options);
          return;
        }
      } catch (err) {
        console.warn("[VoiceService] Kokoro TTS synthesis error, switching to SpeechSynthesis fallback", err);
      }
    }

    // Trigger background initialization so Kokoro is ready for subsequent briefings
    this.initKokoro().catch(() => {});

    // Instant speech output via native browser SpeechSynthesis (zero waiting/silence)
    this.speakNativeFallback(text, options);
  }

  private async playAudioRaw(
    audioData: any,
    options?: { onEnd?: () => void; onError?: () => void },
  ): Promise<void> {
    try {
      if (audioData && typeof audioData.toBlob === "function") {
        const blob = await audioData.toBlob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        this.currentAudio = audio;

        audio.onended = () => {
          this._isSpeaking = false;
          URL.revokeObjectURL(url);
          options?.onEnd?.();
        };
        audio.onerror = () => {
          this._isSpeaking = false;
          URL.revokeObjectURL(url);
          options?.onError?.();
        };

        await audio.play();
        return;
      }

      if (audioData && typeof audioData.toWav === "function") {
        const wavData = audioData.toWav();
        const blob = wavData instanceof Blob ? wavData : new Blob([wavData], { type: "audio/wav" });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        this.currentAudio = audio;

        audio.onended = () => {
          this._isSpeaking = false;
          URL.revokeObjectURL(url);
          options?.onEnd?.();
        };
        audio.onerror = () => {
          this._isSpeaking = false;
          URL.revokeObjectURL(url);
          options?.onError?.();
        };

        await audio.play();
        return;
      }

      // Direct Web Audio API buffer playback fallback
      if (!this.audioCtx) {
        this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (this.audioCtx.state === "suspended") {
        await this.audioCtx.resume();
      }

      const rawFloat32 = audioData.audio || (audioData instanceof Float32Array ? audioData : null);
      const sampleRate = audioData.sampling_rate || 24000;

      if (rawFloat32 && rawFloat32.length > 0) {
        const audioBuffer = this.audioCtx.createBuffer(1, rawFloat32.length, sampleRate);
        audioBuffer.getChannelData(0).set(rawFloat32);

        const source = this.audioCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.audioCtx.destination);

        source.onended = () => {
          this._isSpeaking = false;
          options?.onEnd?.();
        };

        this.currentAudio = source;
        source.start(0);
        return;
      }
    } catch (err) {
      console.warn("[VoiceService] Kokoro Web Audio playback error, switching to SpeechSynthesis fallback", err);
    }

    this.speakNativeFallback(typeof audioData === "string" ? audioData : "Executive briefing ready.", options);
  }

  private speakNativeFallback(
    text: string,
    options?: { onEnd?: () => void; onError?: () => void },
  ): void {
    if (!("speechSynthesis" in window)) {
      this._isSpeaking = false;
      options?.onEnd?.();
      return;
    }

    try {
      window.speechSynthesis.cancel();
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    } catch (e) {
      // Ignore cancellation error
    }

    const doSpeak = () => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        const enVoice =
          voices.find(
            (v) =>
              v.lang.startsWith("en") &&
              (v.name.includes("Natural") ||
                v.name.includes("Google") ||
                v.name.includes("Samantha") ||
                v.name.includes("Karen") ||
                v.name.includes("Daniel")),
          ) ||
          voices.find((v) => v.lang.startsWith("en")) ||
          voices[0];
        if (enVoice) utterance.voice = enVoice;
      }

      utterance.onstart = () => {
        this._isSpeaking = true;
      };

      utterance.onend = () => {
        this._isSpeaking = false;
        options?.onEnd?.();
      };

      utterance.onerror = (err) => {
        console.warn("[VoiceService] SpeechSynthesis error:", err);
        this._isSpeaking = false;
        options?.onError?.();
      };

      window.speechSynthesis.speak(utterance);
    };

    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) {
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.onvoiceschanged = null;
        doSpeak();
      };
      setTimeout(doSpeak, 200);
    } else {
      doSpeak();
    }
  }

  /**
   * Stop active speech synthesis immediately.
   */
  public stop(): void {
    if (this.currentAudio) {
      try {
        if ("stop" in this.currentAudio) {
          (this.currentAudio as AudioBufferSourceNode).stop();
        } else if ("pause" in this.currentAudio) {
          (this.currentAudio as HTMLAudioElement).pause();
        }
      } catch (err) {
        console.warn("[VoiceService] Stop audio error", err);
      }
      this.currentAudio = null;
    }

    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    this._isSpeaking = false;
  }
}
