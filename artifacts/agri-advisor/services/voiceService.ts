// services/voiceService.ts
//
// Handles microphone permission, audio recording (expo-av),
// and Whisper-large-v3 transcription via Hugging Face Inference API.

import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";

// ─── Internal state ────────────────────────────────────────────────────────────

let _recording: Audio.Recording | null = null;

// ─── Permission ───────────────────────────────────────────────────────────────

/**
 * Requests microphone permission from the OS.
 * Returns true if granted, false otherwise.
 */
export async function requestMicrophonePermission(): Promise<boolean> {
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
    // 2. Read audio file as base64, then convert to binary Uint8Array
    const base64Audio = await FileSystem.readAsStringAsync(uri, {
      encoding: "base64",
    });

    const binaryString = atob(base64Audio);
    const audioBytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      audioBytes[i] = binaryString.charCodeAt(i);
    }

    // 3. Build HF Whisper endpoint URL
    //    Only append ?language= for non-English codes so Whisper doesn't get
    //    confused when the user speaks in a language it should auto-detect.
    const baseUrl =
      "https://api-inference.huggingface.co/models/openai/whisper-large-v3";
    const url =
      languageCode && languageCode !== "en"
        ? `${baseUrl}?language=${encodeURIComponent(languageCode)}`
        : baseUrl;

    // 4. POST raw binary to HF Inference API
    const headers: Record<string, string> = {
      "Content-Type": "application/octet-stream",
    };
    if (hfToken) {
      headers["Authorization"] = `Bearer ${hfToken}`;
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: audioBytes.buffer,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => response.statusText);
      throw new Error(`Whisper API error ${response.status}: ${errText}`);
    }

    const result = await response.json();

    // HF Whisper returns { text: "..." }
    const transcribedText: string = result?.text ?? "";
    return transcribedText.trim();
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
