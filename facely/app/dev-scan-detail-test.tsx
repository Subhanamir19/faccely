// Dev-only manual hook to inspect a scan detail payload.
import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { fetchScanDetail } from "@/lib/api/history";

const TEST_SCAN_ID = "REPLACE_WITH_SCAN_ID";

export default function DevScanDetailTest() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!__DEV__) return;
    (async () => {
      try {
        const detail = await fetchScanDetail(TEST_SCAN_ID);
        console.log("SCAN_DETAIL", detail);
      } catch (err: any) {
        const msg = err?.message || String(err);
        setError(msg);
        console.log("SCAN_DETAIL_ERROR", msg);
      }
    })();
  }, []);

  if (!__DEV__) {
    return (
      <View>
        <Text>Dev-only screen.</Text>
      </View>
    );
  }

  return (
    <View>
      <Text>{error ? `Error: ${error}` : "OK"}</Text>
    </View>
  );
}
