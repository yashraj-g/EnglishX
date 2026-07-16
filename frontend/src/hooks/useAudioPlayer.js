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
        const url = `/speech/tts?text=${encodeURIComponent(text)}&model=${model}`;
        const audio = new Audio(url);
        audioRef.current = audio;
        setIsSpeaking(true);

        audio.onended = () => {
          setIsSpeaking(false);
          audioRef.current = null;
        };

        audio.onerror = () => {
          setIsSpeaking(false);
          audioRef.current = null;
          console.warn('Audio playback error or Deepgram not configured');
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
