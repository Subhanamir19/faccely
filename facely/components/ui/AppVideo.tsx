import React, { useEffect, useRef } from "react";
import { useEventListener } from "expo";
import {
  VideoView,
  useVideoPlayer,
  type PlayingChangeEventPayload,
  type SourceLoadEventPayload,
  type StatusChangeEventPayload,
  type TimeUpdateEventPayload,
  type VideoPlayer,
  type VideoSource,
  type VideoViewProps,
} from "expo-video";

type AppVideoProps = Omit<VideoViewProps, "player"> & {
  source: VideoSource;
  shouldPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  timeUpdateEventInterval?: number;
  onPlayerChange?: (player: VideoPlayer | null) => void;
  onPlayingChange?: (event: PlayingChangeEventPayload) => void;
  onSourceLoad?: (event: SourceLoadEventPayload) => void;
  onStatusChange?: (event: StatusChangeEventPayload) => void;
  onTimeUpdate?: (event: TimeUpdateEventPayload) => void;
  onPlayToEnd?: () => void;
};

/**
 * Declarative adapter around expo-video. It keeps prop-driven playback while
 * exposing the player only to screens that need imperative controls.
 */
export default function AppVideo({
  source,
  shouldPlay = false,
  loop = false,
  muted = false,
  nativeControls = false,
  timeUpdateEventInterval = 0,
  onPlayerChange,
  onPlayingChange,
  onSourceLoad,
  onStatusChange,
  onTimeUpdate,
  onPlayToEnd,
  ...viewProps
}: AppVideoProps) {
  const player = useVideoPlayer(source, (createdPlayer) => {
    createdPlayer.loop = loop;
    createdPlayer.muted = muted;
    createdPlayer.timeUpdateEventInterval = timeUpdateEventInterval;
  });
  const onPlayerChangeRef = useRef(onPlayerChange);
  onPlayerChangeRef.current = onPlayerChange;

  useEffect(() => {
    player.loop = loop;
    player.muted = muted;
    player.timeUpdateEventInterval = timeUpdateEventInterval;
  }, [loop, muted, player, timeUpdateEventInterval]);

  useEffect(() => {
    if (shouldPlay) {
      player.play();
    } else {
      player.pause();
    }
  }, [player, shouldPlay]);

  useEffect(() => {
    onPlayerChangeRef.current?.(player);
    return () => onPlayerChangeRef.current?.(null);
  }, [player]);

  useEventListener(player, "playingChange", (event) => onPlayingChange?.(event));
  useEventListener(player, "sourceLoad", (event) => onSourceLoad?.(event));
  useEventListener(player, "statusChange", (event) => onStatusChange?.(event));
  useEventListener(player, "timeUpdate", (event) => onTimeUpdate?.(event));
  useEventListener(player, "playToEnd", () => onPlayToEnd?.());

  return <VideoView {...viewProps} player={player} nativeControls={nativeControls} />;
}
