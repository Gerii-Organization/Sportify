import { useState, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Dimensions, Alert, Modal, FlatList, TextInput, ScrollView } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { BlurView } from 'expo-blur';
import { X, Zap, ZapOff, Image as ImageIcon, RefreshCcw, Scan, Clock, Plus } from 'lucide-react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { colors } from '../theme';
import { useIsFocused } from '@react-navigation/native';
import EmptyState from '../components/EmptyState';
import { lookupBarcode } from '../lib/foodDatabase';

const { width } = Dimensions.get('window');

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

/** What the user is meant to do in each mode, shown inside the frame. */
const MODE_HINTS = {
  scan: 'Frame a meal, then press the shutter',
  barcode: 'Point at a barcode — it scans on its own',
  create: 'Frame your fridge, then press the shutter',
};

export default function ScannerScreen() {
  const isFocused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState('back');
  const [torch, setTorch] = useState(false);
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
  /** Last barcode handled, so one packet triggers one lookup, not one per frame. */
  const lastCodeRef = useRef(null);

  if (!permission) return <View />;

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>We need your permission to use the camera.</Text>
        <TouchableOpacity activeOpacity={0.7} style={styles.btn} onPress={requestPermission}>
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
    lastCodeRef.current = null;
  };

  /**
   * Barcode path.
   *
   * The camera fires this continuously while a code is in frame, so the same
   * barcode arrives many times a second. `lastCodeRef` keeps the lookup to one
   * request per physical packet — without it a single scan would hammer the
   * API and re-open the result card on every frame.
   */
  const handleBarcode = async ({ data: code }) => {
    if (mode !== 'barcode' || isScanning) return;
    if (code === lastCodeRef.current) return;

    lastCodeRef.current = code;
    setIsScanning(true);

    const result = await lookupBarcode(code);
    setIsScanning(false);

    if (!result.found) {
      const message =
        result.reason === 'not_in_database'
          ? 'That barcode is not in the food database yet. Try the photo scanner instead.'
          : 'Could not reach the food database. Check your connection.';
      Alert.alert('No match', message, [
        // Clearing the memo lets the user retry the same packet.
        { text: 'OK', onPress: () => { lastCodeRef.current = null; } },
      ]);
      return;
    }

    const p = result.product;
    setScannedFood({
      id: Date.now(),
      name: p.name,
      calories: p.calories,
      protein: p.protein,
      carbs: p.carbs,
      fats: p.fats,
      emoji: '📦',
      // A packet is an exact match; a photo guess is not. Showing 100 here is
      // honest rather than decorative.
      match: 100,
      ingredients: [
        p.isPer100g ? 'Values per 100 g' : `Per serving (${p.servingLabel})`,
        `Barcode ${p.barcode}`,
      ],
    });
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
        ? "Return strictly a JSON object with keys: name (string), calories (number), protein (number), carbs (number), fats (number), emoji (string), match (number), ingredients (array of strings)."
        : "Return strictly a JSON object with a 'meals' array containing exactly 3 objects. Keys for each object: name (string), calories (number), protein (number), carbs (number), fats (number), emoji (string), match (number), ingredients (array of strings).";

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
          carbs: item.carbs,
          fats: item.fats,
          emoji: item.emoji,
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
      <TouchableOpacity activeOpacity={0.7}
        style={styles.cardContentTouchable}
        onPress={() => setExpandedItem(item)}
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
              <Text style={styles.macroLabel}>Calories</Text>
              <Text style={styles.macroValue}>{item.calories}</Text>
            </View>
            <View style={styles.macroItem}>
              <Text style={styles.macroLabel}>Protein</Text>
              <Text style={styles.macroValue}>{item.protein}g</Text>
            </View>
            <View style={styles.macroItem}>
              <Text style={styles.macroLabel}>Fats</Text>
              <Text style={styles.macroValue}>{item.fats}g</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>

      <TouchableOpacity accessibilityLabel="Add" activeOpacity={0.7} style={styles.addButton} onPress={() => saveToDatabase(item)}>
        <Plus color={colors.onAccent} size={24} />
      </TouchableOpacity>
    </BlurView>
  );

  return (
    <View style={styles.container}>
      {/* Mounting CameraView unconditionally kept the camera powered — and its
          privacy indicator lit — while the user was on any other tab. */}
      {isFocused && (
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing={facing}
          enableTorch={torch}
          ref={cameraRef}
          // Only listen in barcode mode; leaving the recogniser running during
          // photo capture wastes frames on work nothing consumes.
          onBarcodeScanned={mode === 'barcode' ? handleBarcode : undefined}
          barcodeScannerSettings={{
            barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'],
          }}
        />
      )}

      <View style={StyleSheet.absoluteFillObject}>
        <View style={styles.header}>
          <TouchableOpacity activeOpacity={0.7} style={styles.iconButton} onPress={openHistory} accessibilityLabel="History">
            <Clock color={colors.accent} size={22} />
          </TouchableOpacity>

          <BlurView intensity={40} tint="dark" style={styles.modeSelector}>
            {[
              { id: 'scan', label: 'Photo' },
              { id: 'barcode', label: 'Barcode' },
              { id: 'create', label: 'Fridge' },
            ].map((m) => (
              <TouchableOpacity
                key={m.id}
                activeOpacity={0.7}
                onPress={() => switchMode(m.id)}
                style={[styles.modeBtn, mode === m.id && styles.modeBtnActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: mode === m.id }}
              >
                <Text style={[styles.modeText, mode === m.id && styles.modeTextActive]}>{m.label}</Text>
              </TouchableOpacity>
            ))}
          </BlurView>

          <TouchableOpacity activeOpacity={0.7}
            style={[styles.iconButton, torch && { backgroundColor: colors.accentSoft }]}
            onPress={() => setTorch((on) => !on)}
            accessibilityLabel={torch ? 'Turn flash off' : 'Turn flash on'}
          >
            {torch ? <Zap color={colors.accent} size={22} fill={colors.accent} /> : <ZapOff color={colors.textSecondary} size={22} />}
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

               {isScanning ? (
                 <View style={styles.scanningCenter}>
                   <BlurView intensity={50} tint="dark" style={styles.scanningPill}>
                     <Scan color={colors.accent} size={24} />
                     <Text style={styles.scanningText}>
                       {mode === 'barcode' ? 'Looking it up…' : 'Analysing image…'}
                     </Text>
                     <View style={styles.progressBar}>
                       <View style={styles.progressFill} />
                     </View>
                   </BlurView>
                 </View>
               ) : (
                 // Each mode needs a different action from the user, and the
                 // frame alone does not say which. Without this the barcode
                 // mode looks identical to the photo mode but ignores the
                 // shutter, which reads as broken.
                 !scannedFood && generatedMeals.length === 0 && (
                   <View style={styles.scanningCenter}>
                     <BlurView intensity={30} tint="dark" style={styles.hintPill}>
                       <Text style={styles.hintText}>{MODE_HINTS[mode]}</Text>
                     </BlurView>
                   </View>
                 )
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
          <TouchableOpacity activeOpacity={0.7} style={styles.controlBtn} onPress={pickImageAndAnalyze}>
            <ImageIcon color={colors.accent} size={26} />
            <Text style={styles.controlText}>Gallery</Text>
          </TouchableOpacity>

          {mode === 'create' && (
            <TouchableOpacity activeOpacity={0.7} style={styles.controlBtn} onPress={() => setIsManualModalVisible(true)}>
              <Plus color={colors.accent} size={26} />
              <Text style={styles.controlText}>Manual</Text>
            </TouchableOpacity>
          )}

          {mode !== 'barcode' && (
          <TouchableOpacity activeOpacity={0.7} style={styles.shutterBtn} onPress={takePictureAndAnalyze} accessibilityLabel="Take photo">
            <View style={[styles.shutterInner, isScanning && styles.shutterScanning]} />
          </TouchableOpacity>
          )}

          <TouchableOpacity activeOpacity={0.7} style={styles.controlBtn} onPress={toggleCameraFacing}>
            <RefreshCcw color={colors.accent} size={26} />
            <Text style={styles.controlText}>Flip</Text>
          </TouchableOpacity>
        </View>

        <Modal visible={!!expandedItem} transparent animationType="fade">
          <View style={styles.modalOverlayCenter}>
            <View style={styles.expandedModalContent}>
              <TouchableOpacity accessibilityLabel="Close" activeOpacity={0.7} style={styles.closeExpandedBtn} onPress={() => setExpandedItem(null)}>
                <X color={colors.accent} size={28} />
              </TouchableOpacity>

              <View style={styles.expandedEmojiContainer}>
                <Text style={styles.expandedEmoji}>{expandedItem?.emoji}</Text>
              </View>

              <Text style={styles.expandedTitle}>{expandedItem?.name}</Text>

              <View style={styles.expandedMacros}>
                <View style={styles.expandedMacroItem}>
                  <Text style={styles.macroLabel}>Calories</Text>
                  <Text style={styles.macroValue}>{expandedItem?.calories}</Text>
                </View>
                <View style={styles.expandedMacroItem}>
                  <Text style={styles.macroLabel}>Protein</Text>
                  <Text style={styles.macroValue}>{expandedItem?.protein}g</Text>
                </View>
                <View style={styles.expandedMacroItem}>
                  <Text style={styles.macroLabel}>Fats</Text>
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

              <TouchableOpacity activeOpacity={0.7} style={styles.expandedAddBtn} onPress={() => saveToDatabase(expandedItem)}>
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
                placeholderTextColor={colors.textMuted}
                value={manualInput}
                onChangeText={setManualInput}
                autoFocus
              />
              <View style={styles.manualBtns}>
                <TouchableOpacity activeOpacity={0.7} onPress={() => setIsManualModalVisible(false)} style={styles.manualBtnClose}>
                  <Text style={styles.manualBtnTextClose}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={0.7} onPress={handleAddManualIngredient} style={styles.manualBtnAdd}>
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
                <TouchableOpacity accessibilityLabel="Close" activeOpacity={0.7} onPress={() => setIsHistoryVisible(false)}>
                  <X color={colors.accent} size={28} />
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
                ListEmptyComponent={
                  <EmptyState
                    icon={<Clock color={colors.textFaint} size={44} />}
                    title="Nothing logged yet"
                    message="Point the camera at a meal and it will work out the calories and macros."
                  />
                }
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
  container: { flex: 1, backgroundColor: colors.background },
  permissionContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  permissionText: { color: colors.text, marginBottom: 20 },
  btn: { backgroundColor: colors.accent, padding: 16, borderRadius: 12 },
  btnText: { color: colors.onAccent, fontWeight: '600' },
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
    borderRadius: 26,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: 'rgba(46, 211, 198, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  modeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    overflow: 'hidden',
    borderColor: 'rgba(46, 211, 198, 0.3)',
    borderWidth: 1,
  },
  modeBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  modeBtnActive: {
    backgroundColor: 'rgba(46, 211, 198, 0.2)',
  },
  modeText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.7 },
  modeTextActive: {
    color: colors.accent,
  },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  unfocusedContainer: { flex: 1 },
  focusedRow: { flexDirection: 'row', height: width * 0.8 },
  targetBox: { width: width * 0.8, position: 'relative' },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: colors.accent,
    borderWidth: 3,
    shadowColor: colors.accent,
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
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(46, 211, 198, 0.3)',
  },
  hintPill: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    overflow: 'hidden',
  },
  hintText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  scanningText: { color: colors.accent, marginTop: 10, marginBottom: 16, fontWeight: '500' },
  progressBar: {
    width: 80,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2
  },
  progressFill: {
    width: 40,
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 2,
    shadowColor: colors.accent,
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
    backgroundColor: 'rgba(46, 211, 198, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 18,
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(46, 211, 198, 0.4)'
  },
  ingredientText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600'
  },
  foodCard: {
    position: 'absolute',
    bottom: 190, // clears the camera controls below
    left: 20,
    right: 20,
    borderRadius: 28,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(46, 211, 198, 0.4)',
  },
  mealsListWrapper: {
    position: 'absolute',
    bottom: 190, // clears the camera controls below
    width: '100%',
  },
  mealsListContent: {
    paddingHorizontal: 20,
  },
  mealCard: {
    width: width * 0.85,
    marginRight: 16,
    borderRadius: 28,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(46, 211, 198, 0.4)',
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
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  foodEmoji: { fontSize: 26 },
  foodInfo: { flex: 1, paddingRight: 10 },
  foodHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, paddingRight: 10 },
  foodTitle: { color: colors.text, fontSize: 15, fontWeight: '600', marginRight: 10, flexShrink: 1 },
  matchBadge: {
    backgroundColor: 'rgba(46, 211, 198, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(46, 211, 198, 0.3)',
  },
  matchText: { color: colors.accent, fontSize: 11, fontWeight: '600' },
  macrosRow: { flexDirection: 'row', justifyContent: 'space-between', paddingRight: 10 },
  macroItem: { alignItems: 'flex-start' },
  macroLabel: { color: colors.textSecondary, fontSize: 11, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.7 },
  macroValue: { color: colors.text, fontSize: 13, fontWeight: '600' },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 24,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 4,
  },
  cameraControls: {
    position: 'absolute',
    bottom: 100, // sits above the floating tab bar
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  controlBtn: { alignItems: 'center', width: 60 },
  controlText: { color: colors.accent, fontSize: 13, marginTop: 10, fontWeight: '600', textAlign: 'center' },
  shutterBtn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 3,
    borderColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  shutterInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.accent,
  },
  shutterScanning: {
    backgroundColor: colors.accent,
    transform: [{ scale: 0.8 }],
    shadowColor: colors.accent,
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
    backgroundColor: colors.card,
    width: '100%',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(46, 211, 198, 0.3)'
  },
  manualTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 16
  },
  manualInput: {
    backgroundColor: colors.surfaceRaised,
    color: colors.text,
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    marginBottom: 20
  },
  manualBtns: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  manualBtnClose: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.surfaceRaised,
    marginRight: 10,
    alignItems: 'center'
  },
  manualBtnAdd: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.accent,
    marginLeft: 10,
    alignItems: 'center'
  },
  manualBtnTextClose: { color: colors.text, fontWeight: '600' },
  manualBtnTextAdd: { color: colors.onAccent, fontWeight: '600' },

  expandedModalContent: {
    backgroundColor: colors.card,
    width: '90%',
    maxHeight: '80%',
    borderRadius: 28,
    padding: 26,
    borderWidth: 1,
    borderColor: 'rgba(46, 211, 198, 0.3)',
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
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  expandedEmoji: {
    fontSize: 40
  },
  expandedTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 20
  },
  expandedMacros: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    backgroundColor: colors.surfaceRaised,
    padding: 16,
    borderRadius: 18,
    marginBottom: 20 },
  expandedMacroItem: {
    alignItems: 'center'
  },
  expandedIngredientsContainer: {
    width: '100%',
    marginBottom: 20
  },
  expandedIngredientsTitle: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 10
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10
  },
  ingredientDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
    marginRight: 10
  },
  ingredientTextExpanded: {
    color: '#ddd',
    fontSize: 15
  },
  expandedAddBtn: {
    backgroundColor: colors.accent,
    width: '100%',
    padding: 16,
    borderRadius: 18,
    alignItems: 'center'
  },
  expandedAddBtnText: {
    color: colors.onAccent,
    fontWeight: '600',
    fontSize: 15
  },

  modalOverlayFull: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end'
  },
  historyContainer: {
    backgroundColor: colors.card,
    height: '80%',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 26 },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20
  },
  historyTitle: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800'
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    padding: 16,
    borderRadius: 18,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(46, 211, 198, 0.2)'
  },
  historyItemLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  historyEmoji: {
    fontSize: 26,
    marginRight: 16
  },
  historyItemName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600'
  },
  historyItemDate: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 6
  },
  historyItemCals: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '600'
  },
  emptyText: {
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 26,
    fontSize: 15
  }
});