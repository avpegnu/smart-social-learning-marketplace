'use client';

import { useRef, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useUpdateProgress } from '@shared/hooks';

// Max gap (in media seconds, scaled by playback rate) between two `timeupdate`
// ticks that still counts as continuous viewing. It only tolerates jittery tick
// spacing — it is NOT how seeks are excluded. Seeks of ANY size are excluded by
// the `seekingRef` flag below, since a mouse-drag scrub can produce arbitrarily
// small jumps that this threshold alone would miss.
const MAX_CONTINUOUS_GAP_SECONDS = 2;
const PROGRESS_FLUSH_INTERVAL_MS = 10_000;

interface VideoPlayerProps {
  lessonId: string;
  videoUrl: string;
  lastPosition: number;
  watchedSegments: [number, number][];
}

export function VideoPlayer({
  lessonId,
  videoUrl,
  lastPosition,
  watchedSegments: initialSegments,
}: VideoPlayerProps) {
  const t = useTranslations('learning');
  const videoRef = useRef<HTMLVideoElement>(null);
  const segmentsRef = useRef<[number, number][]>(initialSegments);
  // Media time of the previous `timeupdate`. Reset to null on seek/pause so the
  // jump itself can never be recorded as watched time.
  const prevTickRef = useRef<number | null>(null);
  // True between `seeking` and `seeked`, so ticks emitted mid-seek are ignored
  // regardless of seek distance or event ordering.
  const seekingRef = useRef(false);
  const updateProgress = useUpdateProgress();

  const flushProgress = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    updateProgress.mutate({
      lessonId,
      data: {
        lastPosition: Math.floor(video.currentTime),
        watchedSegments: segmentsRef.current,
      },
    });
  }, [lessonId, updateProgress]);

  // Keep the latest flush in a ref so the interval/cleanup never goes stale
  // without having to re-subscribe the timer on every render.
  const flushRef = useRef(flushProgress);
  flushRef.current = flushProgress;

  // Resume from last saved position
  useEffect(() => {
    if (videoRef.current && lastPosition > 0) {
      videoRef.current.currentTime = lastPosition;
    }
  }, [lastPosition]);

  // Periodic flush during playback + final flush on unmount
  useEffect(() => {
    const timer = setInterval(() => {
      const video = videoRef.current;
      if (video && !video.paused) flushRef.current();
    }, PROGRESS_FLUSH_INTERVAL_MS);
    return () => {
      clearInterval(timer);
      flushRef.current();
    };
  }, []);

  // Flush when the tab is hidden so progress isn't lost if it is closed before
  // the next interval tick (the unmount cleanup may not run on a hard close).
  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === 'hidden') flushRef.current();
    };
    document.addEventListener('visibilitychange', onHidden);
    return () => document.removeEventListener('visibilitychange', onHidden);
  }, []);

  // Record ONLY continuous playback. A jump in currentTime between two ticks
  // (forward seek) or a negative delta (rewind) breaks the segment, so the
  // skipped region is never credited as watched.
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video || video.paused || seekingRef.current) return;

    const current = video.currentTime;
    const prev = prevTickRef.current;
    prevTickRef.current = current;
    if (prev === null) return;

    const delta = current - prev;
    const maxGap = MAX_CONTINUOUS_GAP_SECONDS * (video.playbackRate || 1);
    if (delta <= 0 || delta > maxGap) return; // seek or rewind → ignore the gap

    const start = Math.floor(prev);
    const end = Math.floor(current);
    if (end > start) {
      segmentsRef.current = mergeSegments([...segmentsRef.current, [start, end]]);
    }
  };

  const handlePlay = () => {
    prevTickRef.current = videoRef.current?.currentTime ?? null;
  };

  const handlePause = () => {
    prevTickRef.current = null;
    flushProgress();
  };

  // Seeking breaks the continuity anchor so the jumped-over span is not counted.
  const handleSeeking = () => {
    prevTickRef.current = null;
    seekingRef.current = true;
  };

  const handleSeeked = () => {
    prevTickRef.current = null;
    seekingRef.current = false;
  };

  return (
    <div className="relative w-full bg-black">
      <video
        ref={videoRef}
        src={videoUrl}
        controls
        className="mx-auto max-h-[70vh] w-full"
        onPlay={handlePlay}
        onPause={handlePause}
        onSeeking={handleSeeking}
        onSeeked={handleSeeked}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handlePause}
      >
        {t('videoNotSupported')}
      </video>
    </div>
  );
}

// Merge overlapping segments: [[0,30],[20,50]] → [[0,50]]
function mergeSegments(segments: [number, number][]): [number, number][] {
  if (segments.length <= 1) return segments;
  const sorted = [...segments].sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    if (sorted[i][0] <= last[1]) {
      last[1] = Math.max(last[1], sorted[i][1]);
    } else {
      merged.push(sorted[i]);
    }
  }
  return merged;
}
