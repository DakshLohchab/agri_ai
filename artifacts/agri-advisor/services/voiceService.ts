// services/voiceService.ts
//
// Handles microphone permission, audio recording (expo-av),
// and Whisper-large-v3 transcription via Hugging Face Inference API.

import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import { Platform } from "react-native";

const HF_TOKEN = process.env.EXPO_PUBLIC_HF_TOKEN;
const HF_WHISPER_URL = "https://api-inference.huggingface.co/models/openai/whisper-large-v3";

// ─── Internal state ────────────────────────────────────────────────────────────

let _recording: Audio.Recording | null = null;
let _speechSound: Audio.Sound | null = null;
let _stopSpeechPlayback = false;
let _webRecognition: any = null;
let _webTranscript = "";
let _voicesReadyPromise: Promise<SpeechSynthesisVoice[]> | null = null;
let _webTranscriptListener: ((transcript: string) => void) | null = null;

function getBrowserRecognitionCtor(): any {
  if (typeof window === "undefined") return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

const WEB_SPEECH_LANGUAGE_MAP: Record<string, string> = {
  en: "en-US",
  hi: "hi-IN",
  bn: "bn-IN",
  te: "te-IN",
  mr: "mr-IN",
  ta: "ta-IN",
  gu: "gu-IN",
  kn: "kn-IN",
  ml: "ml-IN",
  pa: "pa-IN",
  or: "or-IN",
  ur: "ur-PK",
};

const REMOTE_TTS_LANGUAGE_MAP: Record<string, string> = {
  en: "en",
  hi: "hi",
  bn: "bn",
  te: "te",
  mr: "mr",
  ta: "ta",
  gu: "gu",
  kn: "kn",
  ml: "ml",
  pa: "pa",
  or: "or",
  ur: "ur",
};

function normalizeSpeechText(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_>#-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitSpeechText(text: string, maxLength = 180): string[] {
  const normalized = normalizeSpeechText(text);
  if (!normalized) return [];

  const sentences = normalized.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if (!sentence) continue;

    if (!current) {
      current = sentence;
      continue;
    }

    if (`${current} ${sentence}`.length <= maxLength) {
      current = `${current} ${sentence}`;
      continue;
    }

    chunks.push(current);
    current = sentence;
  }

  if (current) chunks.push(current);

  return chunks.flatMap((chunk) => {
    if (chunk.length <= maxLength) return [chunk];
    const words = chunk.split(/\s+/);
    const wordChunks: string[] = [];
    let wordBuffer = "";

    for (const word of words) {
      if (!wordBuffer) {
        wordBuffer = word;
        continue;
      }

      if (`${wordBuffer} ${word}`.length <= maxLength) {
        wordBuffer = `${wordBuffer} ${word}`;
      } else {
        wordChunks.push(wordBuffer);
        wordBuffer = word;
      }
    }

    if (wordBuffer) wordChunks.push(wordBuffer);
    return wordChunks;
  });
}

function getSpeechLanguageCode(languageCode: string): string {
  return WEB_SPEECH_LANGUAGE_MAP[languageCode] ?? "en-US";
}

function buildRemoteTtsUrl(text: string, languageCode: string): string {
  const targetLanguage = REMOTE_TTS_LANGUAGE_MAP[languageCode] ?? "en";
  return (
    "https://translate.google.com/translate_tts" +
    `?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(targetLanguage)}` +
    `&q=${encodeURIComponent(text)}`
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readAudioAsArrayBuffer(uri: string): Promise<ArrayBuffer> {
  const fileResponse = await fetch(uri);
  return await fileResponse.arrayBuffer();
}

async function playRemoteAudioChunk(uri: string): Promise<void> {
  if (_speechSound) {
    await _speechSound.unloadAsync().catch(() => {});
    _speechSound = null;
  }

  const { sound } = await Audio.Sound.createAsync(
    { uri },
    { shouldPlay: true }
  );

  _speechSound = sound;

  await new Promise<void>((resolve, reject) => {
    sound.setOnPlaybackStatusUpdate((status) => {
      if (!status.isLoaded) {
        if ((status as any).error) {
          reject(new Error((status as any).error || "Unable to load speech audio."));
        }
        return;
      }

      if (status.didJustFinish) {
        resolve();
      }
    });
  }).finally(async () => {
    sound.setOnPlaybackStatusUpdate(null);
    await sound.unloadAsync().catch(() => {});
    if (_speechSound === sound) {
      _speechSound = null;
    }
  });
}

async function waitForSpeechVoices(): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
  const synth = window.speechSynthesis;
  const existing = synth.getVoices();
  if (existing.length > 0) return existing;

  if (_voicesReadyPromise) return _voicesReadyPromise;

  _voicesReadyPromise = new Promise<SpeechSynthesisVoice[]>((resolve) => {
    const timeout = setTimeout(() => {
      synth.onvoiceschanged = null;
      _voicesReadyPromise = null;
      resolve(synth.getVoices());
    }, 1500);

    synth.onvoiceschanged = () => {
      clearTimeout(timeout);
      const nextVoices = synth.getVoices();
      synth.onvoiceschanged = null;
      _voicesReadyPromise = null;
      resolve(nextVoices);
    };
  });

  return _voicesReadyPromise;
}

function getMatchingVoice(
  voices: SpeechSynthesisVoice[],
  languageCode: string
): SpeechSynthesisVoice | null {
  const preferredLang = getSpeechLanguageCode(languageCode).toLowerCase();
  const prefix = preferredLang.split("-")[0];

  return (
    voices.find((voice) => voice.lang?.toLowerCase() === preferredLang) ??
    voices.find((voice) => voice.lang?.toLowerCase().startsWith(`${prefix}-`)) ??
    voices.find((voice) => voice.lang?.toLowerCase() === prefix) ??
    null
  );
}

async function speakOnWeb(text: string, languageCode: string): Promise<void> {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    throw new Error("Speech playback is not available on this device.");
  }

  const chunks = splitSpeechText(text, 220);
  if (!chunks.length) {
    throw new Error("Nothing to read aloud.");
  }

  const synth = window.speechSynthesis;
  const voices = await waitForSpeechVoices();
  const matchedVoice = getMatchingVoice(voices, languageCode);
  synth.cancel();
  _stopSpeechPlayback = false;

  for (const chunk of chunks) {
    if (_stopSpeechPlayback) break;

    await new Promise<void>((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(chunk);
      utterance.lang = getSpeechLanguageCode(languageCode);
      if (matchedVoice) utterance.voice = matchedVoice;
      utterance.rate = 1;
      utterance.onend = () => resolve();
      utterance.onerror = () => reject(new Error("Speech playback failed."));
      synth.speak(utterance);
    });
  }
}

async function speakOnNative(text: string, languageCode: string): Promise<void> {
  const chunks = splitSpeechText(text);
  if (!chunks.length) {
    throw new Error("Nothing to read aloud.");
  }

  _stopSpeechPlayback = false;
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
  });

  for (const chunk of chunks) {
    if (_stopSpeechPlayback) break;
    await playRemoteAudioChunk(buildRemoteTtsUrl(chunk, languageCode));
  }
}

// ─── Permission ───────────────────────────────────────────────────────────────

/**
 * Requests microphone permission from the OS.
 * Returns true if granted, false otherwise.
 */
export async function requestMicrophonePermission(): Promise<boolean> {
  if (Platform.OS === "web") {
    try {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        return false;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      return true;
    } catch {
      return false;
    }
  }

  const { status } = await Audio.requestPermissionsAsync();
  return status === "granted";
}

// ─── Recording ────────────────────────────────────────────────────────────────

/**
 * Starts a new audio recording session.
 * Uses HIGH_QUALITY preset which records as m4a/AAC — supported by Whisper.
 * Throws if a recording is already in progress or if permission is missing.
 */
export async function startRecording(): Promise<void> {
  if (Platform.OS === "web") {
    throw new Error("Use browser speech recognition on web.");
  }

  if (_recording) {
    throw new Error("A recording is already in progress.");
  }

  // Required on iOS: configure the audio session before recording
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
  });

  const { recording } = await Audio.Recording.createAsync(
    Audio.RecordingOptionsPresets.HIGH_QUALITY
  );

  _recording = recording;
}

// ─── Stop + Transcribe ────────────────────────────────────────────────────────

/**
 * Stops the active recording, sends the audio to Hugging Face Whisper,
 * and returns the transcribed text.
 *
 * @param languageCode  - Whisper language code (e.g. "hi", "pa"). Pass "en" or
 *                        omit the param to let Whisper auto-detect.
 * @param hfToken       - Optional HF Bearer token. Without it requests are
 *                        rate-limited but still work for low-volume usage.
 */
export async function stopRecordingAndTranscribe(
  languageCode: string,
  hfToken?: string
): Promise<string> {
  if (Platform.OS === "web") {
    throw new Error("Use browser speech recognition on web.");
  }

  if (!_recording) {
    throw new Error("No active recording to stop.");
  }

  // 1. Stop the recording and get the local URI
  await _recording.stopAndUnloadAsync();
  const uri = _recording.getURI();
  _recording = null;

  // Reset audio mode so playback works normally afterwards
  await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

  if (!uri) {
    throw new Error("Recording URI is unavailable.");
  }

  try {
    const audioBuffer = await readAudioAsArrayBuffer(uri);

    // 3. Build HF Whisper endpoint URL
    //    Only append ?language= for non-English codes so Whisper doesn't get
    //    confused when the user speaks in a language it should auto-detect.
    const url =
      languageCode && languageCode !== "en"
        ? `${HF_WHISPER_URL}?language=${encodeURIComponent(languageCode)}`
        : HF_WHISPER_URL;

    // 4. POST raw binary to HF Inference API
    const headers: Record<string, string> = {
      "Content-Type": "application/octet-stream",
    };
    const token = hfToken ?? HF_TOKEN;
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    let lastError = "Voice transcription failed.";

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: audioBuffer.slice(0),
      });

      if (response.ok) {
        const result = await response.json();
        const transcribedText: string = result?.text ?? "";
        const finalText = transcribedText.trim();
        if (!finalText) {
          throw new Error("No speech was detected. Try speaking closer to the microphone.");
        }
        return finalText;
      }

      const errText = await response.text().catch(() => response.statusText);
      lastError = `Whisper API error ${response.status}: ${errText}`;

      if (response.status === 503 || response.status === 429 || response.status >= 500) {
        await sleep(1200 * (attempt + 1));
        continue;
      }

      if (response.status === 401 || response.status === 403) {
        throw new Error(
          token
            ? "Voice transcription authorization failed. Check the configured Hugging Face token."
            : "Voice transcription needs a configured Hugging Face token for this build."
        );
      }

      throw new Error(lastError);
    }

    throw new Error(
      token
        ? lastError
        : "Voice transcription is unavailable right now. Configure EXPO_PUBLIC_HF_TOKEN or try again later."
    );
  } finally {
    // 5. Always clean up the temp audio file to avoid accumulating storage
    FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
  }
}

// ─── Cancel ───────────────────────────────────────────────────────────────────

/**
 * Cancels an in-progress recording without transcribing.
 * Safe to call even if no recording is active.
 */
export async function cancelRecording(): Promise<void> {
  if (Platform.OS === "web") {
    if (_webRecognition) {
      _webRecognition.abort();
      _webRecognition = null;
    }
    _webTranscript = "";
    _webTranscriptListener = null;
    return;
  }

  if (!_recording) return;

  try {
    const uri = _recording.getURI();
    await _recording.stopAndUnloadAsync();
    _recording = null;
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
    if (uri) {
      FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
    }
  } catch {
    _recording = null;
  }
}

export async function speakText(text: string, languageCode: string): Promise<void> {
  await stopSpeaking();

  if (Platform.OS === "web") {
    await speakOnWeb(text, languageCode);
    return;
  }

  await speakOnNative(text, languageCode);
}

export function isSpeechRecognitionAvailable(): boolean {
  if (Platform.OS === "web") {
    return !!getBrowserRecognitionCtor();
  }

  return true;
}

export async function startWebSpeechRecognition(
  languageCode: string,
  onTranscript?: (transcript: string) => void
): Promise<void> {
  if (Platform.OS !== "web") {
    throw new Error("Browser speech recognition is only available on web.");
  }

  const RecognitionCtor = getBrowserRecognitionCtor();
  if (!RecognitionCtor) {
    throw new Error("Speech recognition is not supported in this browser.");
  }

  if (_webRecognition) {
    throw new Error("Speech recognition is already in progress.");
  }

  const recognition = new RecognitionCtor();
  recognition.lang = getSpeechLanguageCode(languageCode);
  recognition.continuous = true;
  recognition.interimResults = true;
  _webTranscript = "";
  _webTranscriptListener = onTranscript ?? null;
  recognition.onresult = (event: any) => {
    let nextTranscript = "";
    for (let index = 0; index < event.results.length; index += 1) {
      nextTranscript += `${event.results[index][0]?.transcript ?? ""} `;
    }
    _webTranscript = nextTranscript.trim();
    _webTranscriptListener?.(_webTranscript);
  };
  _webRecognition = recognition;

  await new Promise<void>((resolve, reject) => {
    recognition.onstart = () => resolve();
    recognition.onerror = (event: any) => {
      _webRecognition = null;
      _webTranscriptListener = null;
      reject(new Error(event?.error ? `Speech recognition error: ${event.error}` : "Speech recognition failed."));
    };
    recognition.start();
  });
}

export async function stopWebSpeechRecognitionAndTranscribe(): Promise<string> {
  if (Platform.OS !== "web") {
    throw new Error("Browser speech recognition is only available on web.");
  }

  if (!_webRecognition) {
    throw new Error("No active speech recognition session.");
  }

  const recognition = _webRecognition;

  return await new Promise<string>((resolve, reject) => {
    recognition.onerror = (event: any) => {
      _webRecognition = null;
      _webTranscriptListener = null;
      reject(new Error(event?.error ? `Speech recognition error: ${event.error}` : "Speech recognition failed."));
    };

    recognition.onend = () => {
      _webRecognition = null;
      const finalTranscript = _webTranscript.trim();
      _webTranscript = "";
      _webTranscriptListener = null;
      resolve(finalTranscript);
    };

    recognition.stop();
  });
}

export async function stopSpeaking(): Promise<void> {
  _stopSpeechPlayback = true;

  if (Platform.OS === "web" && typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }

  if (_speechSound) {
    await _speechSound.stopAsync().catch(() => {});
    await _speechSound.unloadAsync().catch(() => {});
    _speechSound = null;
  }
}

export function isSpeechPlaybackAvailable(): boolean {
  if (Platform.OS === "web") {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  }

  return true;
}
