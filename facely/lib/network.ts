// lib/network.ts
// Network connectivity hook using expo-network.

import * as Network from "expo-network";
import { useEffect, useState } from "react";

export type NetworkState = {
  isConnected: boolean;
  isInternetReachable: boolean | null;
};

export function useNetworkState(): NetworkState {
  const [state, setState] = useState<NetworkState>({
    isConnected: true,
    isInternetReachable: null,
  });

  useEffect(() => {
    // Initial check
    Network.getNetworkStateAsync().then((s) => {
      setState({
        isConnected: s.isConnected ?? true,
        isInternetReachable: s.isInternetReachable ?? null,
      });
    }).catch(() => {});

    // Subscribe to connectivity changes
    const subscription = Network.addNetworkStateListener((s) => {
      setState({
        isConnected: s.isConnected ?? true,
        isInternetReachable: s.isInternetReachable ?? null,
      });
    });

    return () => subscription.remove();
  }, []);

  return state;
}

// Returns true only when we're confident the device is offline.
// null isInternetReachable → returns false to avoid false positives on startup.
export function isOffline(state: NetworkState): boolean {
  if (!state.isConnected) return true;
  if (state.isInternetReachable === false) return true;
  return false;
}
