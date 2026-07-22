'use client';

import { useState, useRef, useCallback } from 'react';

/**
 * Custom hook for high-clarity voice recording via MediaRecorder API.
 * Employs hardware Auto Gain Control (AGC), noise suppression, and high-bitrate Opus encoding
 * so distant speech is captured clearly while blocking background hums/noise.
 */
export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState(null);
  const mediaRecorder = useRef(null);
  const audioChunks = useRef([]);
  const stream = useRef(null);

  const startRecording = useCallback(async () => {
    setError(null);
    audioChunks.current = [];

    try {
      stream.current = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: { ideal: true },
          noiseSuppression: { ideal: true },
          autoGainControl: { ideal: true }, // Automatic Gain Control boosts distant/quiet speech
          channelCount: 1,
          sampleRate: { ideal: 48000, min: 16000 },
          sampleSize: { ideal: 16 },
          // Advanced WebRTC noise isolation & voice enhancement flags
          googEchoCancellation: { ideal: true },
          googAutoGainControl: { ideal: true },
          googNoiseSuppression: { ideal: true },
          googHighpassFilter: { ideal: true },
        },
      });

      mediaRecorder.current = new MediaRecorder(stream.current, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
        audioBitsPerSecond: 128000, // 128kbps high quality audio bitrate
      });

      mediaRecorder.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.current.push(e.data);
      };

      mediaRecorder.current.start(250); // collect chunks every 250ms
      setIsRecording(true);
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setError('Microphone access denied. Please allow microphone access in your browser settings.');
      } else if (err.name === 'NotFoundError') {
        setError('No microphone found. Please connect a microphone.');
      } else {
        setError(`Microphone error: ${err.message}`);
      }
    }
  }, []);

  const stopRecording = useCallback(() => {
    return new Promise((resolve) => {
      if (!mediaRecorder.current || mediaRecorder.current.state === 'inactive') {
        resolve(null);
        return;
      }

      mediaRecorder.current.onstop = async () => {
        const blob = new Blob(audioChunks.current, { type: 'audio/webm' });
        setIsRecording(false);

        // Stop all tracks
        if (stream.current) {
          stream.current.getTracks().forEach((t) => t.stop());
        }

        // Convert to base64
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result.split(',')[1];
          resolve(base64);
        };
        reader.readAsDataURL(blob);
      };

      mediaRecorder.current.stop();
    });
  }, []);

  const cancelRecording = useCallback(() => {
    if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.stop();
    }
    if (stream.current) {
      stream.current.getTracks().forEach((t) => t.stop());
    }
    setIsRecording(false);
    audioChunks.current = [];
  }, []);

  return { isRecording, error, startRecording, stopRecording, cancelRecording };
}
