import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Dimensions } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { BlurView } from 'expo-blur';
import { X, Zap } from 'lucide-react-native';

const { width } = Dimensions.get('window');

export default function ScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();

  if (!permission) return <View />;

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={{ textAlign: 'center', marginBottom: 10 }}>Avem nevoie de permisiunea ta pentru cameră</Text>
        <TouchableOpacity style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>Permite Accesul</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} facing="back">
        
        <View style={styles.overlay}>
          <View style={styles.unfocusedContainer}></View>
          <View style={styles.focusedRow}>
            <View style={styles.unfocusedContainer}></View>
            <View style={styles.targetBox}>
               <View style={[styles.corner, styles.topLeft]} />
               <View style={[styles.corner, styles.topRight]} />
               <View style={[styles.corner, styles.bottomLeft]} />
               <View style={[styles.corner, styles.bottomRight]} />
            </View>
            <View style={styles.unfocusedContainer}></View>
          </View>
          <View style={styles.unfocusedContainer}></View>
        </View>

        <BlurView intensity={90} tint="dark" style={styles.bottomInfo}>
          <View style={styles.infoHandle} />
          <Text style={styles.infoTitle}>Scanează Mâncarea</Text>
          <Text style={styles.infoSub}>Încadrează farfuria pentru a identifica nutrienții folosind AI.</Text>
          
          <TouchableOpacity style={styles.scanBtn}>
            <Zap color="#000" size={20} fill="#000" />
            <Text style={styles.scanBtnText}> ANALIZEAZĂ </Text>
          </TouchableOpacity>
        </BlurView>

      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  unfocusedContainer: { flex: 1 },
  focusedRow: { flexDirection: 'row', height: width * 0.7 },
  targetBox: { width: width * 0.7, borderRadius: 20, position: 'relative' },
  corner: { position: 'absolute', width: 40, height: 40, borderColor: '#007AFF', borderWidth: 4 },
  topLeft: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 20 },
  topRight: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 20 },
  bottomLeft: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 20 },
  bottomRight: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 20 },
  bottomInfo: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    padding: 30,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    alignItems: 'center',
    paddingBottom: 100
  },
  infoHandle: { width: 40, height: 5, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 10, marginBottom: 15 },
  infoTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  infoSub: { color: '#ccc', textAlign: 'center', marginTop: 5, marginBottom: 20 },
  scanBtn: { 
    backgroundColor: '#fff', 
    flexDirection: 'row', 
    paddingVertical: 15, 
    paddingHorizontal: 40, 
    borderRadius: 30,
    alignItems: 'center'
  },
  scanBtnText: { fontWeight: 'bold', fontSize: 16 },
  btn: { backgroundColor: '#007AFF', padding: 15, borderRadius: 10 },
  btnText: { color: '#fff', fontWeight: 'bold' }
});