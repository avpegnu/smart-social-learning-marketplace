'use client';

import { useRef, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useUpdateProgress } from '@shared/hooks';

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
  const segmentStartRef = useRef<number>(lastPosition);
  const updateProgress = useUpdateProgress();
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Resume from last position
  useEffect(() => {
    if (videoRef.current && lastPosition > 0) {
      videoRef.current.currentTime = lastPosition;
    }
  }, [lastPosition]);

  // Flush progress to server every 10 seconds
  useEffect(() => {
    flushTimerRef.current = setInterval(() => {
      flushProgress();
    }, 10000);
    return () => {
      if (flushTimerRef.current) clearInterval(flushTimerRef.current);
      flushProgress(); // Final flush on unmount
    };
  }, [lessonId]); // Only re-setup timer when lesson changes

  const flushProgress = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.paused) return;

    const currentTime = Math.floor(video.currentTime);
    const start = segmentStartRef.current;

    if (currentTime > start) {
      segmentsRef.current = mergeSegments([...segmentsRef.current, [start, currentTime]]);
      segmentStartRef.current = currentTime;
    }

    updateProgress.mutate({
      lessonId,
      data: {
        lastPosition: currentTime,
        watchedSegments: segmentsRef.current,
      },
    });
  }, [lessonId, updateProgress]);

  const handlePlay = () => {
    if (videoRef.current) {
      segmentStartRef.current = Math.floor(videoRef.current.currentTime);
    }
  };

  const handlePause = () => {
    flushProgress();
  };

  const handleSeeking = () => {
    // Flush current segment before seek (so watched time isn't lost)
    const video = videoRef.current;
    if (!video) return;
    const currentTime = Math.floor(video.currentTime);
    const start = segmentStartRef.current;
    if (currentTime > start) {
      segmentsRef.current = mergeSegments([...segmentsRef.current, [start, currentTime]]);
    }
  };

  const handleSeeked = () => {
    // Start new segment from seek position
    if (videoRef.current) {
      segmentStartRef.current = Math.floor(videoRef.current.currentTime);
    }
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
