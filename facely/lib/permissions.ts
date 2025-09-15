import * as ImagePicker from "expo-image-picker";
import {useCameraPermissions} from "expo-camera";

export async function ensureMediaLibrary():Promise<boolean>{
  const {status,granted,canAskAgain}=await ImagePicker.getMediaLibraryPermissionsAsync();
  if(granted) return true;
  if(!canAskAgain) return false;
  const req=await ImagePicker.requestMediaLibraryPermissionsAsync();
  return req.granted;
}

// Hook wrapper so component code is clean
export function useCameraPerm(){
  const [perm, request] = useCameraPermissions();
  const ok = !!perm?.granted;
  return {ok, request};
}
