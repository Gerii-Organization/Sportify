import React, { useState, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Dimensions, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { BlurView } from 'expo-blur';
import { X, Zap, Image as ImageIcon, RefreshCcw, Scan, ClipboardList, ChefHat, User, Plus } from 'lucide-react-native';
import * as ImageManipulator from 'expo-image-manipulator';

const { width } = Dimensions.get('window');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const NEON_GREEN = '#00FF66';

export default function ScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState('back');
  const [isScanning, setIsScanning] = useState(false);
  const [scannedFood, setScannedFood] = useState(null);
  const [foodList, setFoodList] = useState([]);
  const cameraRef = useRef(null);

  if (!permission) return <View />;

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>Avem nevoie de permisiunea ta pentru cameră</Text>
        <TouchableOpacity style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>Permite Accesul</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const toggleCameraFacing = () => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  const takePictureAndAnalyze = async () => {
    if (cameraRef.current && !isScanning) {
      setIsScanning(true);
      setScannedFood(null);

      try {
        console.log("START SCANARE");

        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.5
        });

        console.log("POZA CAPTURATA");

        const manipulatedImage = await ImageManipulator.manipulateAsync(
          photo.uri,
          [{ resize: { width: 600 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );

        console.log("POZA REDIMENSIONATA");

        const cleanBase64 = manipulatedImage.base64.replace(/[\r\n\t\s]+/gm, "");

        console.log("BASE64 CURATAT, LUNGIME:", cleanBase64.length);

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: "gpt-4o",
            messages: [
              {
                role: "system",
                content: "Return only a strict JSON object. No prose, no markdown formatting. Keys: name (string), calories (number), protein (number), fats (number), emoji (string, single emoji), match (number, 1-100)."
              },
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "Identify this food and give nutrition info in JSON format."
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: `data:image/jpeg;base64,${cleanBase64}`
                    }
                  }
                ]
              }
            ],
            max_tokens: 500
          })
        });

        console.log("RASPUNS PRIMIT, STATUS:", response.status);

        const data = await response.json();

        if (!response.ok) {
          console.log("EROARE OPENAI:", JSON.stringify(data));
          Alert.alert("Eroare OpenAI", data.error?.message || "Eroare necunoscută");
          setIsScanning(false);
          return;
        }

        const aiMessage = data.choices[0].message.content;
        console.log("MESAJ AI:", aiMessage);

        const jsonMatch = aiMessage.match(/\{[\s\S]*\}/);

        if (jsonMatch) {
          const foodData = JSON.parse(jsonMatch[0]);
          console.log("DATE PARSATE CU SUCCES:", foodData);
          setScannedFood({
            id: Date.now(),
            ...foodData
          });
        } else {
          console.log("NU S-A GASIT JSON IN MESAJ");
          throw new Error("AI-ul nu a returnat un format JSON valid.");
        }

      } catch (error) {
        console.error("EROARE IN CATCH:", error);
        Alert.alert("Eroare", "Nu s-a putut analiza imaginea: " + error.message);
      } finally {
        setIsScanning(false);
        console.log("SCANARE FINALIZATA");
      }
    }
  };

  const addFoodToList = () => {
    if (scannedFood) {
      setFoodList([...foodList, scannedFood]);
      setScannedFood(null);
      Alert.alert("Succes", `${scannedFood.name} a fost adăugat în listă!`);
    }
  };

  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} facing={facing} ref={cameraRef}>

        <View style={styles.header}>
          <TouchableOpacity style={styles.iconButton}>
            <X color="#fff" size={24} />
          </TouchableOpacity>

          <BlurView intensity={40} tint="dark" style={styles.liveAnalysis}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>SCANATE: {foodList.length}</Text>
          </BlurView>

          <TouchableOpacity style={styles.iconButton}>
            <Zap color="#fff" size={24} />
          </TouchableOpacity>
        </View>

        <View style={styles.overlay}>
          <View style={styles.unfocusedContainer} />
          <View style={styles.focusedRow}>
            <View style={styles.unfocusedContainer} />
            <View style={styles.targetBox}>
               <View style={[styles.corner, styles.topLeft]} />
               <View style={[styles.corner, styles.topRight]} />
               <View style={[styles.corner, styles.bottomLeft]} />
               <View style={[styles.corner, styles.bottomRight]} />

               {isScanning && (
                 <View style={styles.scanningCenter}>
                   <BlurView intensity={50} tint="dark" style={styles.scanningPill}>
                     <Scan color={NEON_GREEN} size={24} />
                     <Text style={styles.scanningText}>Analizăm imaginea...</Text>
                     <View style={styles.progressBar}>
                       <View style={styles.progressFill} />
                     </View>
                   </BlurView>
                 </View>
               )}
            </View>
            <View style={styles.unfocusedContainer} />
          </View>
          <View style={styles.unfocusedContainer} />
        </View>

        {scannedFood && !isScanning && (
          <BlurView intensity={70} tint="dark" style={styles.foodCard}>
            <View style={styles.foodEmojiContainer}>
              <Text style={styles.foodEmoji}>{scannedFood.emoji}</Text>
            </View>

            <View style={styles.foodInfo}>
              <View style={styles.foodHeaderRow}>
                <Text style={styles.foodTitle}>{scannedFood.name}</Text>
                <View style={styles.matchBadge}>
                  <Text style={styles.matchText}>{scannedFood.match}% Match</Text>
                </View>
              </View>

              <View style={styles.macrosRow}>
                <View style={styles.macroItem}>
                  <Text style={styles.macroLabel}>CALORIES</Text>
                  <Text style={styles.macroValue}>{scannedFood.calories} kcal</Text>
                </View>
                <View style={styles.macroItem}>
                  <Text style={styles.macroLabel}>PROTEIN</Text>
                  <Text style={styles.macroValue}>{scannedFood.protein}g</Text>
                </View>
                <View style={styles.macroItem}>
                  <Text style={styles.macroLabel}>FATS</Text>
                  <Text style={styles.macroValue}>{scannedFood.fats}g</Text>
                </View>
              </View>
            </View>

            <TouchableOpacity style={styles.addButton} onPress={addFoodToList}>
              <Plus color="#000" size={24} />
            </TouchableOpacity>
          </BlurView>
        )}

        <View style={styles.cameraControls}>
          <TouchableOpacity style={styles.controlBtn}>
            <ImageIcon color="#fff" size={24} />
            <Text style={styles.controlText}>Gallery</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.shutterBtn} onPress={takePictureAndAnalyze}>
            <View style={[styles.shutterInner, isScanning && styles.shutterScanning]} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.controlBtn} onPress={toggleCameraFacing}>
            <RefreshCcw color="#fff" size={24} />
            <Text style={styles.controlText}>Flip</Text>
          </TouchableOpacity>
        </View>

        <BlurView intensity={80} tint="dark" style={styles.footer}>
          <TouchableOpacity style={styles.navItem}>
            <Scan color={NEON_GREEN} size={24} style={styles.iconGlow} />
            <Text style={[styles.navText, styles.navTextActive]}>Scan</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem}>
            <ClipboardList color="#aaa" size={24} />
            <Text style={styles.navText}>Log</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem}>
            <ChefHat color="#aaa" size={24} />
            <Text style={styles.navText}>Recipes</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem}>
            <User color="#aaa" size={24} />
            <Text style={styles.navText}>Profile</Text>
          </TouchableOpacity>
        </BlurView>

      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  permissionContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  permissionText: { color: '#fff', marginBottom: 20 },
  btn: { backgroundColor: NEON_GREEN, padding: 15, borderRadius: 10 },
  btnText: { color: '#000', fontWeight: 'bold' },
  camera: { flex: 1 },
  header: {
    position: 'absolute',
    top: 50,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 10,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  liveAnalysis: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    overflow: 'hidden',
    borderColor: 'rgba(0, 255, 102, 0.3)',
    borderWidth: 1,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: NEON_GREEN,
    marginRight: 8,
    shadowColor: NEON_GREEN,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 5,
    elevation: 3,
  },
  liveText: { color: NEON_GREEN, fontSize: 12, fontWeight: 'bold', letterSpacing: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  unfocusedContainer: { flex: 1 },
  focusedRow: { flexDirection: 'row', height: width * 0.8 },
  targetBox: { width: width * 0.8, position: 'relative' },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: NEON_GREEN,
    borderWidth: 3,
    shadowColor: NEON_GREEN,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 5,
  },
  topLeft: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 30 },
  topRight: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 30 },
  bottomLeft: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 30 },
  bottomRight: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 30 },
  scanningCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scanningPill: {
    alignItems: 'center',
    padding: 20,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 102, 0.3)',
  },
  scanningText: { color: NEON_GREEN, marginTop: 10, marginBottom: 15, fontWeight: '500' },
  progressBar: {
    width: 80,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2
  },
  progressFill: {
    width: 40,
    height: '100%',
    backgroundColor: NEON_GREEN,
    borderRadius: 2,
    shadowColor: NEON_GREEN,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  foodCard: {
    position: 'absolute',
    bottom: 220,
    left: 20,
    right: 20,
    borderRadius: 24,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 102, 0.4)',
    shadowColor: NEON_GREEN,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
  },
  foodEmojiContainer: {
    width: 60,
    height: 60,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  foodEmoji: { fontSize: 30 },
  foodInfo: { flex: 1 },
  foodHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  foodTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginRight: 10 },
  matchBadge: {
    backgroundColor: 'rgba(0, 255, 102, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 102, 0.3)',
  },
  matchText: { color: NEON_GREEN, fontSize: 10, fontWeight: 'bold' },
  macrosRow: { flexDirection: 'row', justifyContent: 'space-between', paddingRight: 10 },
  macroItem: { alignItems: 'flex-start' },
  macroLabel: { color: '#aaa', fontSize: 10, marginBottom: 4 },
  macroValue: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: NEON_GREEN,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: NEON_GREEN,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 4,
  },
  cameraControls: {
    position: 'absolute',
    bottom: 110,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  controlBtn: { alignItems: 'center' },
  controlText: { color: '#fff', fontSize: 12, marginTop: 8 },
  shutterBtn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 3,
    borderColor: 'rgba(0, 255, 102, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#fff',
  },
  shutterScanning: {
    backgroundColor: NEON_GREEN,
    transform: [{ scale: 0.8 }],
    shadowColor: NEON_GREEN,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 15,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingBottom: 30,
    paddingTop: 15,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  navItem: { alignItems: 'center' },
  navText: { color: '#aaa', fontSize: 10, marginTop: 5 },
  navTextActive: {
    color: NEON_GREEN,
    textShadowColor: 'rgba(0, 255, 102, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  iconGlow: {
    shadowColor: NEON_GREEN,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
  }
});