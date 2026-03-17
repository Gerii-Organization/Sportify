import React, { useState, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Dimensions, Alert, Modal, FlatList, TextInput, ScrollView } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { BlurView } from 'expo-blur';
import { X, Zap, Image as ImageIcon, RefreshCcw, Scan, Clock, Plus } from 'lucide-react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';

const { width } = Dimensions.get('window');

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
const NEON_GREEN = '#00FF66';

export default function ScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState('back');
  const [isScanning, setIsScanning] = useState(false);
  const [mode, setMode] = useState('scan');

  const [scannedFood, setScannedFood] = useState(null);
  const [generatedMeals, setGeneratedMeals] = useState([]);
  const [extraIngredients, setExtraIngredients] = useState([]);

  const [isHistoryVisible, setIsHistoryVisible] = useState(false);
  const [historyList, setHistoryList] = useState([]);

  const [isManualModalVisible, setIsManualModalVisible] = useState(false);
  const [manualInput, setManualInput] = useState('');

  const [expandedItem, setExpandedItem] = useState(null);

  const cameraRef = useRef(null);

  if (!permission) return <View />;

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>We need your permission to use the camera.</Text>
        <TouchableOpacity style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>Allow Access</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const toggleCameraFacing = () => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setScannedFood(null);
    setGeneratedMeals([]);
    setExtraIngredients([]);
    setIsScanning(false);
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
      Alert.alert("Error", "Could not load scan history.");
    }
  };

  const openHistory = () => {
    setIsHistoryVisible(true);
    fetchHistory();
  };

  const processImage = async (imageUri) => {
    try {
      if (!OPENAI_API_KEY) {
        throw new Error("Missing OpenAI API key.");
      }

      const manipulatedImage = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: { width: 600 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );

      const cleanBase64 = manipulatedImage.base64.replace(/[\r\n\t\s]+/gm, "");

      const systemContent = mode === 'scan'
        ? "Return strictly a JSON object with keys: name (string), calories (number), protein (number), fats (number), emoji (string), match (number), ingredients (array of strings)."
        : "Return strictly a JSON object with a 'meals' array containing exactly 3 objects. Keys for each object: name (string), calories (number), protein (number), fats (number), emoji (string), match (number), ingredients (array of strings).";

      const userContent = mode === 'scan'
        ? "Identify this food, give nutrition info and list its main ingredients."
        : `Analyze the fridge image and extra ingredients: ${extraIngredients.join(', ')}. Create 3 healthy meals and list their ingredients.`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: "gpt-4o",
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemContent },
            {
              role: "user",
              content: [
                { type: "text", text: userContent },
                { type: "image_url", image_url: { url: `data:image/jpeg;base64,${cleanBase64}` } }
              ]
            }
          ],
          max_tokens: 800
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || "Error from OpenAI server.");
      }

      const aiMessage = data.choices[0].message.content;
      const parsedData = JSON.parse(aiMessage);

      if (mode === 'scan') {
        setScannedFood({ id: Date.now(), ...parsedData });
      } else {
        if (parsedData.meals && Array.isArray(parsedData.meals)) {
          setGeneratedMeals(parsedData.meals.map((m, i) => ({ id: Date.now() + i, ...m })));
        } else {
          throw new Error("Returned meal format is invalid.");
        }
      }

    } catch (error) {
      Alert.alert("Analysis Error", error.message || "There was a problem processing the image.");
    } finally {
      setIsScanning(false);
    }
  };

  const takePictureAndAnalyze = async () => {
    if (!cameraRef.current || isScanning) return;

    setIsScanning(true);
    setScannedFood(null);
    setGeneratedMeals([]);

    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.5 });
      await processImage(photo.uri);
    } catch (error) {
      Alert.alert("Camera Error", "Could not capture the image.");
      setIsScanning(false);
    }
  };

  const pickImageAndAnalyze = async () => {
    if (isScanning) return;

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'We need access to your gallery to analyze photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.5,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setIsScanning(true);
        setScannedFood(null);
        setGeneratedMeals([]);
        await processImage(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert("Gallery Error", "Could not open the gallery.");
      setIsScanning(false);
    }
  };

  const saveToDatabase = async (item) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { error } = await supabase.from('scanned_foods').insert({
          user_id: user.id,
          food_name: item.name,
          calories: item.calories,
          protein: item.protein,
          fats: item.fats
        });

        if (error) throw error;
      }

      Alert.alert("Success", `${item.name} has been saved to your history.`);

      if (mode === 'scan') {
        setScannedFood(null);
      } else {
        setGeneratedMeals(current => current.filter(m => m.id !== item.id));
      }
      setExpandedItem(null);
    } catch (error) {
      Alert.alert("Error", "Could not save this food to the database.");
    }
  };

  const handleAddManualIngredient = () => {
    if (manualInput.trim()) {
      setExtraIngredients([...extraIngredients, manualInput.trim()]);
      setManualInput('');
      setIsManualModalVisible(false);
    }
  };

  const renderFoodItem = (item) => (
    <BlurView intensity={70} tint="dark" style={mode === 'scan' ? styles.foodCard : styles.mealCard}>
      <TouchableOpacity
        style={styles.cardContentTouchable}
        onPress={() => setExpandedItem(item)}
        activeOpacity={0.7}
      >
        <View style={styles.foodEmojiContainer}>
          <Text style={styles.foodEmoji}>{item.emoji}</Text>
        </View>

        <View style={styles.foodInfo}>
          <View style={styles.foodHeaderRow}>
            <Text style={styles.foodTitle} numberOfLines={1}>{item.name}</Text>
            <View style={styles.matchBadge}>
              <Text style={styles.matchText}>{item.match}%</Text>
            </View>
          </View>

          <View style={styles.macrosRow}>
            <View style={styles.macroItem}>
              <Text style={styles.macroLabel}>CALORIES</Text>
              <Text style={styles.macroValue}>{item.calories}</Text>
            </View>
            <View style={styles.macroItem}>
              <Text style={styles.macroLabel}>PROTEIN</Text>
              <Text style={styles.macroValue}>{item.protein}g</Text>
            </View>
            <View style={styles.macroItem}>
              <Text style={styles.macroLabel}>FATS</Text>
              <Text style={styles.macroValue}>{item.fats}g</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.addButton} onPress={() => saveToDatabase(item)}>
        <Plus color="#000" size={24} />
      </TouchableOpacity>
    </BlurView>
  );

  return (
    <View style={styles.container}>
      <CameraView style={StyleSheet.absoluteFillObject} facing={facing} ref={cameraRef} />

      <View style={StyleSheet.absoluteFillObject}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconButton} onPress={openHistory}>
            <Clock color={NEON_GREEN} size={22} />
          </TouchableOpacity>

          <BlurView intensity={40} tint="dark" style={styles.modeSelector}>
            <TouchableOpacity onPress={() => switchMode('scan')} style={[styles.modeBtn, mode === 'scan' && styles.modeBtnActive]}>
              <Text style={[styles.modeText, mode === 'scan' && styles.modeTextActive]}>SCAN FOOD</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => switchMode('create')} style={[styles.modeBtn, mode === 'create' && styles.modeBtnActive]}>
              <Text style={[styles.modeText, mode === 'create' && styles.modeTextActive]}>CREATE MEAL</Text>
            </TouchableOpacity>
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
                     <Text style={styles.scanningText}>Analyzing image...</Text>
                     <View style={styles.progressBar}>
                       <View style={styles.progressFill} />
                     </View>
                   </BlurView>
                 </View>
               )}
            </View>
            <View style={styles.unfocusedContainer} />
          </View>
          <View style={styles.unfocusedContainer}>
            {mode === 'create' && extraIngredients.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.ingredientsScroll} contentContainerStyle={styles.ingredientsContainer}>
                {extraIngredients.map((ing, idx) => (
                  <View key={idx} style={styles.ingredientChip}>
                    <Text style={styles.ingredientText}>{ing}</Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>

        {mode === 'scan' && scannedFood && !isScanning && renderFoodItem(scannedFood)}

        {mode === 'create' && generatedMeals.length > 0 && !isScanning && (
          <View style={styles.mealsListWrapper}>
            <FlatList
              data={generatedMeals}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={item => item.id.toString()}
              renderItem={({ item }) => renderFoodItem(item)}
              contentContainerStyle={styles.mealsListContent}
            />
          </View>
        )}

        <View style={styles.cameraControls}>
          <TouchableOpacity style={styles.controlBtn} onPress={pickImageAndAnalyze}>
            <ImageIcon color={NEON_GREEN} size={26} />
            <Text style={styles.controlText}>Gallery</Text>
          </TouchableOpacity>

          {mode === 'create' && (
            <TouchableOpacity style={styles.controlBtn} onPress={() => setIsManualModalVisible(true)}>
              <Plus color={NEON_GREEN} size={26} />
              <Text style={styles.controlText}>Manual</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.shutterBtn} onPress={takePictureAndAnalyze}>
            <View style={[styles.shutterInner, isScanning && styles.shutterScanning]} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.controlBtn} onPress={toggleCameraFacing}>
            <RefreshCcw color={NEON_GREEN} size={26} />
            <Text style={styles.controlText}>Flip</Text>
          </TouchableOpacity>
        </View>

        <Modal visible={!!expandedItem} transparent animationType="fade">
          <View style={styles.modalOverlayCenter}>
            <View style={styles.expandedModalContent}>
              <TouchableOpacity style={styles.closeExpandedBtn} onPress={() => setExpandedItem(null)}>
                <X color={NEON_GREEN} size={28} />
              </TouchableOpacity>

              <View style={styles.expandedEmojiContainer}>
                <Text style={styles.expandedEmoji}>{expandedItem?.emoji}</Text>
              </View>

              <Text style={styles.expandedTitle}>{expandedItem?.name}</Text>

              <View style={styles.expandedMacros}>
                <View style={styles.expandedMacroItem}>
                  <Text style={styles.macroLabel}>CALORIES</Text>
                  <Text style={styles.macroValue}>{expandedItem?.calories}</Text>
                </View>
                <View style={styles.expandedMacroItem}>
                  <Text style={styles.macroLabel}>PROTEIN</Text>
                  <Text style={styles.macroValue}>{expandedItem?.protein}g</Text>
                </View>
                <View style={styles.expandedMacroItem}>
                  <Text style={styles.macroLabel}>FATS</Text>
                  <Text style={styles.macroValue}>{expandedItem?.fats}g</Text>
                </View>
              </View>

              {expandedItem?.ingredients && expandedItem.ingredients.length > 0 && (
                <View style={styles.expandedIngredientsContainer}>
                  <Text style={styles.expandedIngredientsTitle}>Ingredients:</Text>
                  <ScrollView style={{ maxHeight: 150 }} showsVerticalScrollIndicator={false}>
                    {expandedItem.ingredients.map((ing, idx) => (
                      <View key={idx} style={styles.ingredientRow}>
                        <View style={styles.ingredientDot} />
                        <Text style={styles.ingredientTextExpanded}>{ing}</Text>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              )}

              <TouchableOpacity style={styles.expandedAddBtn} onPress={() => saveToDatabase(expandedItem)}>
                <Text style={styles.expandedAddBtnText}>Add to history</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal visible={isManualModalVisible} transparent animationType="fade">
          <View style={styles.modalOverlayCenter}>
            <View style={styles.manualModal}>
              <Text style={styles.manualTitle}>Add ingredient</Text>
              <TextInput
                style={styles.manualInput}
                placeholder="E.g. Tomatoes, Chicken, Eggs..."
                placeholderTextColor="#666"
                value={manualInput}
                onChangeText={setManualInput}
                autoFocus
              />
              <View style={styles.manualBtns}>
                <TouchableOpacity onPress={() => setIsManualModalVisible(false)} style={styles.manualBtnClose}>
                  <Text style={styles.manualBtnTextClose}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleAddManualIngredient} style={styles.manualBtnAdd}>
                  <Text style={styles.manualBtnTextAdd}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal visible={isHistoryVisible} animationType="slide" transparent>
          <View style={styles.modalOverlayFull}>
            <View style={styles.historyContainer}>
              <View style={styles.historyHeader}>
                <Text style={styles.historyTitle}>Scan History</Text>
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
                ListEmptyComponent={<Text style={styles.emptyText}>You don't have any scans yet.</Text>}
                showsVerticalScrollIndicator={false}
              />
            </View>
          </View>
        </Modal>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  permissionContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  permissionText: { color: '#fff', marginBottom: 20 },
  btn: { backgroundColor: NEON_GREEN, padding: 15, borderRadius: 10 },
  btnText: { color: '#000', fontWeight: 'bold' },
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
  modeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    overflow: 'hidden',
    borderColor: 'rgba(0, 255, 102, 0.3)',
    borderWidth: 1,
  },
  modeBtn: {
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  modeBtnActive: {
    backgroundColor: 'rgba(0, 255, 102, 0.2)',
  },
  modeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  modeTextActive: {
    color: NEON_GREEN,
  },
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
  ingredientsScroll: {
    position: 'absolute',
    top: 20,
    width: '100%'
  },
  ingredientsContainer: {
    paddingHorizontal: 20,
    alignItems: 'center'
  },
  ingredientChip: {
    backgroundColor: 'rgba(0, 255, 102, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 102, 0.4)'
  },
  ingredientText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold'
  },
  foodCard: {
    position: 'absolute',
    bottom: 190, // 🔴 Modificat aici (ridicat)
    left: 20,
    right: 20,
    borderRadius: 24,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 102, 0.4)',
  },
  mealsListWrapper: {
    position: 'absolute',
    bottom: 190, // 🔴 Modificat aici (ridicat)
    width: '100%',
  },
  mealsListContent: {
    paddingHorizontal: 20,
  },
  mealCard: {
    width: width * 0.85,
    marginRight: 15,
    borderRadius: 24,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 102, 0.4)',
  },
  cardContentTouchable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  foodEmojiContainer: {
    width: 50,
    height: 50,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  foodEmoji: { fontSize: 26 },
  foodInfo: { flex: 1, paddingRight: 10 },
  foodHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, paddingRight: 10 },
  foodTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginRight: 10, flexShrink: 1 },
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
  macroValue: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
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
    bottom: 100, // 🔴 Modificat aici (ridicat peste footer)
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  controlBtn: { alignItems: 'center', width: 60 },
  controlText: { color: NEON_GREEN, fontSize: 12, marginTop: 8, fontWeight: '600', textAlign: 'center' },
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
  modalOverlayCenter: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  manualModal: {
    backgroundColor: '#121212',
    width: '100%',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 102, 0.3)'
  },
  manualTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15
  },
  manualInput: {
    backgroundColor: '#1c1c1e',
    color: '#fff',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 20
  },
  manualBtns: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  manualBtnClose: {
    flex: 1,
    padding: 15,
    borderRadius: 10,
    backgroundColor: '#1c1c1e',
    marginRight: 10,
    alignItems: 'center'
  },
  manualBtnAdd: {
    flex: 1,
    padding: 15,
    borderRadius: 10,
    backgroundColor: NEON_GREEN,
    marginLeft: 10,
    alignItems: 'center'
  },
  manualBtnTextClose: { color: '#fff', fontWeight: 'bold' },
  manualBtnTextAdd: { color: '#000', fontWeight: 'bold' },

  expandedModalContent: {
    backgroundColor: '#121212',
    width: '90%',
    maxHeight: '80%',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 102, 0.3)',
    alignItems: 'center'
  },
  closeExpandedBtn: {
    position: 'absolute',
    top: 15,
    right: 15,
    zIndex: 10
  },
  expandedEmojiContainer: {
    width: 80,
    height: 80,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  expandedEmoji: {
    fontSize: 40
  },
  expandedTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20
  },
  expandedMacros: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    backgroundColor: '#1c1c1e',
    padding: 15,
    borderRadius: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#333'
  },
  expandedMacroItem: {
    alignItems: 'center'
  },
  expandedIngredientsContainer: {
    width: '100%',
    marginBottom: 20
  },
  expandedIngredientsTitle: {
    color: NEON_GREEN,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8
  },
  ingredientDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: NEON_GREEN,
    marginRight: 10
  },
  ingredientTextExpanded: {
    color: '#ddd',
    fontSize: 14
  },
  expandedAddBtn: {
    backgroundColor: NEON_GREEN,
    width: '100%',
    padding: 15,
    borderRadius: 15,
    alignItems: 'center'
  },
  expandedAddBtnText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 16
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