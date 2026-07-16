'use client';

import { useRef, useCallback, useState } from 'react';

/**
 * Custom hook for playing TTS audio from the Deepgram Aura endpoint.
 *
 * Usage:
 *   const { isSpeaking, playTTS, stopSpeaking } = useAudioPlayer();
 *   await playTTS(aiReplyText);
 */
export function useAudioPlayer() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef(null);

  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  /**
   * Fetch MP3 from /speech/tts and play it via the HTML Audio API.
   * Silently skips if the endpoint returns 204 (Deepgram not configured).
   */
  const playTTS = useCallback(
    async (text, model = 'aura-asteria-en') => {
      if (!text || !text.trim()) return;

      // Stop any currently playing audio first
      stopSpeaking();

      try {
        const res = await fetch('/speech/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, model }),
        });

        // 204 means Deepgram is not configured — skip silently
        if (res.status === 204) return;

        if (!res.ok) {
          console.warn('TTS request failed:', res.status);
          return;
        }

        const audioBlob = await res.blob();
        const audioUrl = URL.createObjectURL(audioBlob);

        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        setIsSpeaking(true);

        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          setIsSpeaking(false);
          audioRef.current = null;
        };

        audio.onerror = () => {
          URL.revokeObjectURL(audioUrl);
          setIsSpeaking(false);
          audioRef.current = null;
          console.warn('Audio playback error');
        };

        await audio.play();
      } catch (err) {
        console.warn('TTS playback failed:', err);
        setIsSpeaking(false);
      }
    },
    [stopSpeaking]
  );

  return { isSpeaking, playTTS, stopSpeaking };
}
