'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * AudioPlayer
 *
 * A compact, styled audio player for pre-signed S3 audio URLs.
 * Shows a progress bar, current time, duration, and play/pause/seek controls.
 *
 * Props:
 *   presignedUrl  — S3 presigned URL for the audio file
 *   label         — display label, e.g. "Turn 3" or "You said:"
 *   compact       — if true, renders in a single-line compact layout
 */
export default function AudioPlayer({ presignedUrl, label, compact = false }) {
  const audioRef = useRef(null);
  const progressRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Reset when URL changes
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setIsLoading(true);
    setHasError(false);
  }, [presignedUrl]);

  const handleLoadedMetadata = useCallback(() => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
      setIsLoading(false);
    }
  }, []);

  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  }, []);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (audioRef.current) audioRef.current.currentTime = 0;
  }, []);

  const handleError = useCallback(() => {
    setHasError(true);
    setIsLoading(false);
  }, []);

  const togglePlay = useCallback(async () => {
    if (!audioRef.current || hasError) return;
    try {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        await audioRef.current.play();
        setIsPlaying(true);
      }
    } catch {
      setHasError(true);
    }
  }, [isPlaying, hasError]);

  const handleProgressClick = useCallback((e) => {
    if (!audioRef.current || duration === 0) return;
    const rect = progressRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audioRef.current.currentTime = ratio * duration;
    setCurrentTime(ratio * duration);
  }, [duration]);

  const formatTime = (seconds) => {
    if (!isFinite(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (!presignedUrl) {
    return (
      <div style={styles.unavailable}>
        <span>🎙️ Recording unavailable</span>
      </div>
    );
  }

  return (
    <div style={compact ? styles.containerCompact : styles.container}>
      {/* Hidden native audio element */}
      <audio
        ref={audioRef}
        src={presignedUrl}
        preload="metadata"
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onError={handleError}
        crossOrigin="anonymous"
      />

      {/* Label */}
      {label && <span style={styles.label}>{label}</span>}

      {/* Play/Pause button */}
      <button
        onClick={togglePlay}
        disabled={isLoading || hasError}
        style={{
          ...styles.playBtn,
          opacity: isLoading || hasError ? 0.5 : 1,
          cursor: isLoading || hasError ? 'not-allowed' : 'pointer',
        }}
        title={isPlaying ? 'Pause' : 'Play'}
        aria-label={isPlaying ? 'Pause recording' : 'Play recording'}
      >
        {isLoading ? '⏳' : hasError ? '❌' : isPlaying ? '⏸' : '▶'}
      </button>

      {/* Progress bar */}
      <div
        ref={progressRef}
        onClick={handleProgressClick}
        style={styles.progressTrack}
        role="slider"
        aria-label="Audio progress"
        aria-valuenow={Math.round(progressPercent)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          style={{
            ...styles.progressFill,
            width: `${progressPercent}%`,
            ...(isPlaying ? styles.progressAnimating : {}),
          }}
        />
        <div
          style={{
            ...styles.progressThumb,
            left: `${progressPercent}%`,
          }}
        />
      </div>

      {/* Time display */}
      <span style={styles.time}>
        {formatTime(currentTime)} / {formatTime(duration)}
      </span>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 14px',
    background: 'rgba(255, 255, 255, 0.06)',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(8px)',
    width: '100%',
    boxSizing: 'border-box',
  },
  containerCompact: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 10px',
    background: 'rgba(255, 255, 255, 0.04)',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    width: '100%',
    boxSizing: 'border-box',
  },
  label: {
    fontSize: '12px',
    fontWeight: 600,
    color: 'rgba(255, 255, 255, 0.5)',
    whiteSpace: 'nowrap',
    minWidth: '48px',
  },
  playBtn: {
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    border: 'none',
    borderRadius: '50%',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '13px',
    color: 'white',
    flexShrink: 0,
    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
    boxShadow: '0 2px 8px rgba(99, 102, 241, 0.4)',
  },
  progressTrack: {
    flex: 1,
    height: '6px',
    background: 'rgba(255, 255, 255, 0.12)',
    borderRadius: '99px',
    cursor: 'pointer',
    position: 'relative',
    overflow: 'visible',
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #6366f1, #a78bfa)',
    borderRadius: '99px',
    transition: 'width 0.1s linear',
    pointerEvents: 'none',
  },
  progressAnimating: {
    transition: 'width 0.25s linear',
  },
  progressThumb: {
    position: 'absolute',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    width: '12px',
    height: '12px',
    background: 'white',
    borderRadius: '50%',
    boxShadow: '0 0 0 2px rgba(99,102,241,0.6)',
    pointerEvents: 'none',
    transition: 'left 0.1s linear',
  },
  time: {
    fontSize: '11px',
    color: 'rgba(255,255,255,0.45)',
    whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
    minWidth: '68px',
    textAlign: 'right',
  },
  unavailable: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 12px',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: '8px',
    border: '1px dashed rgba(255,255,255,0.1)',
    color: 'rgba(255,255,255,0.3)',
    fontSize: '12px',
  },
};
