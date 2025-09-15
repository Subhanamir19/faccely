// app/(tabs)/take-picture.tsx
import React,{useRef,useState} from "react";
import {View,Text,Image,Alert,Pressable,Modal,StatusBar} from "react-native";
import {CameraView,useCameraPermissions} from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import Button from "../../components/ui/Button";
import {useRouter} from "expo-router";
import { useScores } from "../../store/scores"; // use our scoring store

// Turn any weird Android path/content URI into a usable file:// URI
async function ensureFileUriAsync(raw?:string|null):Promise<string|null>{
  if(!raw) return null;
  if(raw.startsWith("file://")||raw.startsWith("http")) return raw;
  if(raw.startsWith("/")) return `file://${raw}`;
  if(raw.startsWith("content://")){
    try{
      const dest=`${FileSystem.cacheDirectory}capture_${Date.now()}.jpg`;
      await FileSystem.copyAsync({from:raw,to:dest});
      return dest;
    }catch{
      return raw;
    }
  }
  return raw;
}

export default function TakePicture(){
  const router=useRouter();
  const { analyze } = useScores(); // call backend and store scores+image

  const [perm,requestPerm]=useCameraPermissions();
  const [previewUri,setPreviewUri]=useState<string|null>(null);
  const [submitting,setSubmitting]=useState(false);

  const [cameraOpen,setCameraOpen]=useState(false);
  const cameraRef=useRef<CameraView>(null);

  // ----- Gallery -----
  const openGallery=async ()=>{
    if(submitting) return;
    const {granted,canAskAgain}=await ImagePicker.getMediaLibraryPermissionsAsync();
    if(!granted){
      if(!canAskAgain){Alert.alert("Permission needed","Enable Photos permission in Settings.");return;}
      const req=await ImagePicker.requestMediaLibraryPermissionsAsync();
      if(!req.granted) return;
    }
    const res=await ImagePicker.launchImageLibraryAsync({
      mediaTypes:ImagePicker.MediaTypeOptions.Images,
      quality:1
    });
    if(!res.canceled){
      const normalized=await ensureFileUriAsync(res.assets?.[0]?.uri||null);
      if(normalized){
        setPreviewUri(normalized);
      }
    }
  };

  // ----- Camera flow -----
  const startCamera=async ()=>{
    if(submitting) return;
    if(!perm?.granted){
      const r=await requestPerm();
      if(!r.granted){Alert.alert("Permission needed","Camera permission is required.");return;}
    }
    setPreviewUri(null);
    setCameraOpen(true);
  };

  const capture=async ()=>{
    try{
      // @ts-ignore support both APIs across SDK versions
      const photo=await cameraRef.current?.takePhotoAsync?.({quality:1,skipMetadata:false})
                || await cameraRef.current?.takePictureAsync?.({quality:1,skipProcessing:false});

      const raw=(photo?.uri as string)
             ?? (photo as any)?.path
             ?? (photo as any)?.assets?.[0]?.uri;

      const normalized=await ensureFileUriAsync(raw||null);
      if(normalized){
        setPreviewUri(normalized);
        setCameraOpen(false);
      }else{
        Alert.alert("Camera error","No usable URI returned from camera.");
      }
    }catch(e:any){
      Alert.alert("Camera error",String(e?.message||e));
    }
  };

  const useThis = async ()=>{
    if(!previewUri || submitting) return;
    try{
      setSubmitting(true);
      await analyze(previewUri);      // calls /analyze and saves scores + imageUri
      router.push("/(tabs)/score");   // then navigate to the score screen
    }finally{
      setSubmitting(false);
    }
  };

  const clearPreview=()=>{
    if(submitting) return;
    setPreviewUri(null);
  };

  const permissionDenied=perm?.granted===false;

  // ---- onPress wrappers (must be () => void) ----
  const noop = () => {};
  const onUseThis = () => { if(submitting) return; void useThis(); };
  const onRetake = () => { if(submitting) return; clearPreview(); };
  const onStartCamera = () => { if(submitting) return; void startCamera(); };
  const onOpenGallery = () => { if(submitting) return; void openGallery(); };

  return(
    <View className="flex-1 bg-[#F8F8F8]">
      <View style={{height:56}}/>
      <Text className="text-2xl px-16 mb-4">Capture</Text>

      {/* Base controls driven by preview presence */}
      <View className="px-4" style={{gap:12}}>
        {previewUri?(
          <View style={{flexDirection:"row",gap:12}}>
            <Button
              title={submitting ? "Analyzing…" : "Use This Photo"}
              onPress={previewUri ? onUseThis : noop}
              style={{flex:1, opacity: submitting ? 0.6 : 1}}
            />
            <Button
              title="Retake"
              onPress={onRetake}
              variant="ghost"
              style={{flex:1, opacity: submitting ? 0.6 : 1}}
            />
          </View>
        ):(
          <>
            <Button
              title="Take Photo"
              onPress={onStartCamera}
              style={{opacity: submitting ? 0.6 : 1}}
            />
            <Button
              title="Pick From Gallery"
              onPress={onOpenGallery}
              variant="ghost"
              style={{opacity: submitting ? 0.6 : 1}}
            />
          </>
        )}
      </View>

      {/* Preview under buttons */}
      <View style={{height:12}}/>
      <View
        style={{
          marginHorizontal:16,
          marginBottom:16,
          borderRadius:20,
          overflow:"hidden",
          backgroundColor:"#e9e9e9",
          width:"auto",
          alignSelf:"stretch"
        }}
      >
        {previewUri?(
          <Image
            source={{uri:previewUri}}
            style={{width:"100%",aspectRatio:3/4,backgroundColor:"#000"}}
            resizeMode="contain"
          />
        ):(
          <View style={{height:260}} className="items-center justify-center">
            <Text className="opacity-60">No image selected yet.</Text>
          </View>
        )}
      </View>

      {/* Sticky actions (so they never go off-screen) */}
      {previewUri&&(
        <View style={{position:"absolute",left:0,right:0,bottom:16,paddingHorizontal:16}}>
          <View style={{flexDirection:"row",gap:12}}>
            <Button
              title={submitting ? "Analyzing…" : "Use This Photo"}
              onPress={onUseThis}
              style={{flex:1, opacity: submitting ? 0.6 : 1}}
            />
            <Button
              title="Retake"
              onPress={onRetake}
              variant="ghost"
              style={{flex:1, opacity: submitting ? 0.6 : 1}}
            />
          </View>
        </View>
      )}

      {/* Full-screen camera */}
      <Modal visible={cameraOpen} animationType="fade" presentationStyle="fullScreen" onRequestClose={()=>setCameraOpen(false)}>
        <StatusBar hidden/>
        <View style={{flex:1,backgroundColor:"#000"}}>
          {permissionDenied?(
            <View style={{flex:1,alignItems:"center",justifyContent:"center"}}>
              <Text style={{color:"#fff",fontSize:16,marginBottom:12}}>Camera permission required.</Text>
              <Button title="Grant Permission" onPress={()=>{ void requestPerm(); }}/>
              <View style={{height:12}}/>
              <Button title="Close" variant="ghost" onPress={()=>setCameraOpen(false)}/>
            </View>
          ):(
            <>
              <CameraView ref={cameraRef} active={true} facing="front" mode="picture" style={{flex:1}}/>
              <View
                style={{
                  position:"absolute",left:0,right:0,bottom:0,
                  paddingHorizontal:24,paddingVertical:18,
                  backgroundColor:"rgba(0,0,0,0.35)",flexDirection:"row",
                  alignItems:"center",justifyContent:"space-between"
                }}
              >
                <Pressable
                  onPress={()=>setCameraOpen(false)}
                  style={{paddingVertical:12,paddingHorizontal:18,borderRadius:12,backgroundColor:"rgba(255,255,255,0.18)"}}
                >
                  <Text style={{color:"#fff",fontSize:16}}>Close</Text>
                </Pressable>

                <Pressable
                  onPress={()=>{ void capture(); }}
                  style={{
                    width:76,height:76,borderRadius:38,
                    backgroundColor:"#fff",alignItems:"center",justifyContent:"center",
                    borderWidth:4,borderColor:"rgba(255,255,255,0.6)"
                  }}
                >
                  <View style={{width:60,height:60,borderRadius:30,backgroundColor:"#fff"}}/>
                </Pressable>

                <View style={{width:88}}/>
              </View>
            </>
          )}
        </View>
      </Modal>
    </View>
  );
}
