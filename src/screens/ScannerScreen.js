import React, { useState, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Dimensions, Alert, Modal, FlatList } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { BlurView } from 'expo-blur';
import { X, Zap, Image as ImageIcon, RefreshCcw, Scan, ClipboardList, ChefHat, User, Plus, Clock } from 'lucide-react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';

const { width } = Dimensions.get('window');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const NEON_GREEN = '#00FF66';

export default function ScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState('back');
  const [isScanning, setIsScanning] = useState(false);
  const [scannedFood, setScannedFood] = useState(null);
  const [foodList, setFoodList] = useState([]);

  const [isHistoryVisible, setIsHistoryVisible] = useState(false);
  const [historyList, setHistoryList] = useState([]);

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

  const fetchHistory = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from('scanned_foods')
          .select('*')
          .eq('user_id', user.id)
          .order('scanned_at', { ascending: false });

        if (error) throw error;
        setHistoryList(data || []);
      }
    } catch (error) {
      Alert.alert("Eroare", "Nu s-a putut încărca istoricul.");
    }
  };

  const openHistory = () => {
    setIsHistoryVisible(true);
    fetchHistory();
  };

  const processImage = async (imageUri) => {
    try {
      const manipulatedImage = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: { width: 600 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );

      const cleanBase64 = manipulatedImage.base64.replace(/[\r\n\t\s]+/gm, "");

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
              content: "Return only a strict JSON object. No prose, no markdown formatting. Estimate the weight of the food from the image and send the exact calories for that weight. Keys: name (string), calories (number), protein (number), fats (number), emoji (string, single emoji), match (number, 1-100)."
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

      const data = await response.json();

      if (!response.ok) {
        Alert.alert("Eroare OpenAI", data.error?.message || "Eroare necunoscută");
        return;
      }

      const aiMessage = data.choices[0].message.content;
      const jsonMatch = aiMessage.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const foodData = JSON.parse(jsonMatch[0]);
        setScannedFood({
          id: Date.now(),
          ...foodData
        });
      } else {
        throw new Error("AI-ul nu a returnat un format JSON valid.");
      }

    } catch (error) {
      Alert.alert("Eroare", "Nu s-a putut analiza imaginea: " + error.message);
    }
  };

  const takePictureAndAnalyze = async () => {
    if (cameraRef.current && !isScanning) {
      setIsScanning(true);
      setScannedFood(null);

      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.5
        });
        await processImage(photo.uri);
      } catch (error) {
        Alert.alert("Eroare", "Nu am putut capta imaginea.");
      } finally {
        setIsScanning(false);
      }
    }
  };

  const pickImageAndAnalyze = async () => {
    if (isScanning) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.5,
      });

      if (!result.canceled) {
        setIsScanning(true);
        setScannedFood(null);
        await processImage(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert("Eroare", "Nu am putut deschide galeria.");
    } finally {
      setIsScanning(false);
    }
  };

  const addFoodToList = async () => {
    if (scannedFood) {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          const { error } = await supabase.from('scanned_foods').insert({
            user_id: user.id,
            food_name: scannedFood.name,
            calories: scannedFood.calories,
            protein: scannedFood.protein,
            fats: scannedFood.fats
          });

          if (error) {
            throw error;
          }
        }

        setFoodList([...foodList, scannedFood]);
        setScannedFood(null);
        Alert.alert("Succes", `${scannedFood.name} a fost salvat în baza de date!`);
      } catch (error) {
        Alert.alert("Eroare", "Nu s-a putut salva alimentul în baza de date.");
      }
    }
  };

  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} facing={facing} ref={cameraRef}>

        <View style={styles.header}>
          <TouchableOpacity style={styles.iconButton} onPress={openHistory}>
            <Clock color={NEON_GREEN} size={22} />
          </TouchableOpacity>

          <BlurView intensity={40} tint="dark" style={styles.liveAnalysis}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>FOOD SCANNER</Text>
          </BlurView>

          <TouchableOpacity style={styles.iconButton}>
            <Zap color={NEON_GREEN} size={22} />
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
          <TouchableOpacity style={styles.controlBtn} onPress={pickImageAndAnalyze}>
            <ImageIcon color={NEON_GREEN} size={26} />
            <Text style={styles.controlText}>Gallery</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.shutterBtn} onPress={takePictureAndAnalyze}>
            <View style={[styles.shutterInner, isScanning && styles.shutterScanning]} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.controlBtn} onPress={toggleCameraFacing}>
            <RefreshCcw color={NEON_GREEN} size={26} />
            <Text style={styles.controlText}>Flip</Text>
          </TouchableOpacity>
        </View>

        <Modal visible={isHistoryVisible} animationType="slide" transparent>
          <View style={styles.modalOverlayFull}>
            <View style={styles.historyContainer}>
              <View style={styles.historyHeader}>
                <Text style={styles.historyTitle}>Istoric Scanări</Text>
                <TouchableOpacity onPress={() => setIsHistoryVisible(false)}>
                  <X color={NEON_GREEN} size={28} />
                </TouchableOpacity>
              </View>
              <FlatList
                data={historyList}
                keyExtractor={item => item.id.toString()}
                renderItem={({item}) => (
                  <View style={styles.historyItem}>
                    <View style={styles.historyItemLeft}>
                      <Text style={styles.historyEmoji}>🍽️</Text>
                      <View>
                        <Text style={styles.historyItemName}>{item.food_name}</Text>
                        <Text style={styles.historyItemDate}>{new Date(item.scanned_at).toLocaleString()}</Text>
                      </View>
                    </View>
                    <Text style={styles.historyItemCals}>{item.calories} kcal</Text>
                  </View>
                )}
                ListEmptyComponent={<Text style={styles.emptyText}>Nu ai nicio scanare încă.</Text>}
                showsVerticalScrollIndicator={false}
              />
            </View>
          </View>
        </Modal>

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
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 102, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: NEON_GREEN,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
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
  controlText: { color: NEON_GREEN, fontSize: 12, marginTop: 8, fontWeight: '600' },
  shutterBtn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 3,
    borderColor: NEON_GREEN,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  shutterInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#121212',
    borderWidth: 2,
    borderColor: NEON_GREEN,
  },
  shutterScanning: {
    backgroundColor: NEON_GREEN,
    transform: [{ scale: 0.8 }],
    shadowColor: NEON_GREEN,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 15,
  },
  modalOverlayFull: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end'
  },
  historyContainer: {
    backgroundColor: '#121212',
    height: '80%',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 25,
    borderWidth: 1,
    borderColor: '#222'
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20
  },
  historyTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold'
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1c1c1e',
    padding: 15,
    borderRadius: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 102, 0.2)'
  },
  historyItemLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  historyEmoji: {
    fontSize: 24,
    marginRight: 15
  },
  historyItemName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold'
  },
  historyItemDate: {
    color: '#888',
    fontSize: 12,
    marginTop: 4
  },
  historyItemCals: {
    color: NEON_GREEN,
    fontSize: 16,
    fontWeight: 'bold'
  },
  emptyText: {
    color: '#666',
    textAlign: 'center',
    marginTop: 30,
    fontSize: 16
  }
});
