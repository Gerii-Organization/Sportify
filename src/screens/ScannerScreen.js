import React, { useState, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Dimensions } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { BlurView } from 'expo-blur';
import { X, Zap, Image as ImageIcon, RefreshCcw, Scan, ClipboardList, ChefHat, User, Plus } from 'lucide-react-native';

const { width } = Dimensions.get('window');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

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
        const photo = await cameraRef.current.takePictureAsync({ quality: 0.3, base64: true });

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
                content: "Return only a strict JSON object with these exact keys: name (string), calories (number), protein (number), fats (number), emoji (string, single emoji), match (number, 1-100). Do not use markdown blocks."
              },
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "Analyze this food and provide the nutritional breakdown."
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: `data:image/jpeg;base64,${photo.base64}`
                    }
                  }
                ]
              }
            ],
            max_tokens: 300
          })
        });

        const data = await response.json();

        if (!response.ok) {
          console.error("DETALII EROARE OPENAI:", data);
          alert(`Eroare de la OpenAI: ${data.error?.message || 'Eroare necunoscută'}`);
          setIsScanning(false);
          return;
        }

        const aiMessage = data.choices[0].message.content;
        const cleanJsonString = aiMessage.replace(/```json/g, '').replace(/```/g, '').trim();
        const foodData = JSON.parse(cleanJsonString);

        setScannedFood({
          id: Date.now(),
          name: foodData.name,
          calories: foodData.calories,
          protein: foodData.protein,
          fats: foodData.fats,
          emoji: foodData.emoji,
          match: foodData.match
        });
      } catch (error) {
        console.error("EROARE:", error);
      } finally {
        setIsScanning(false);
      }
    }
  };

  const addFoodToList = () => {
    if (scannedFood) {
      setFoodList([...foodList, scannedFood]);
      setScannedFood(null);
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
                     <Scan color="#3B82F6" size={24} />
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
              <Plus color="#fff" size={24} />
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
            <Scan color="#3B82F6" size={24} />
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
  btn: { backgroundColor: '#3B82F6', padding: 15, borderRadius: 10 },
  btnText: { color: '#fff', fontWeight: 'bold' },
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
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3B82F6',
    marginRight: 8,
  },
  liveText: { color: '#fff', fontSize: 12, fontWeight: 'bold', letterSpacing: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  unfocusedContainer: { flex: 1 },
  focusedRow: { flexDirection: 'row', height: width * 0.8 },
  targetBox: { width: width * 0.8, position: 'relative' },
  corner: { position: 'absolute', width: 40, height: 40, borderColor: '#3B82F6', borderWidth: 4 },
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
    borderColor: 'rgba(255,255,255,0.1)',
  },
  scanningText: { color: '#fff', marginTop: 10, marginBottom: 15, fontWeight: '500' },
  progressBar: { width: 80, height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2 },
  progressFill: { width: 40, height: '100%', backgroundColor: '#3B82F6', borderRadius: 2 },
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
    borderColor: 'rgba(255,255,255,0.2)',
  },
  foodEmojiContainer: {
    width: 60,
    height: 60,
    backgroundColor: '#fff',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  foodEmoji: { fontSize: 30 },
  foodInfo: { flex: 1 },
  foodHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  foodTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginRight: 10 },
  matchBadge: { backgroundColor: 'rgba(59,130,246,0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  matchText: { color: '#3B82F6', fontSize: 10, fontWeight: 'bold' },
  macrosRow: { flexDirection: 'row', justifyContent: 'space-between', paddingRight: 10 },
  macroItem: { alignItems: 'flex-start' },
  macroLabel: { color: '#aaa', fontSize: 10, marginBottom: 4 },
  macroValue: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
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
    borderWidth: 4,
    borderColor: '#fff',
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
    backgroundColor: '#3B82F6',
    transform: [{ scale: 0.8 }],
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
  navTextActive: { color: '#3B82F6' },
});