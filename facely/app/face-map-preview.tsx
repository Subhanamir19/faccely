import React from "react";
import { useRouter } from "expo-router";
import { FaceMapPreview } from "@/components/dashboard/face-map-preview";

export default function FaceMapPreviewRoute() {
  const router = useRouter();
  return <FaceMapPreview onBack={() => router.canGoBack() ? router.back() : router.replace("/(tabs)/dashboard")} />;
}

