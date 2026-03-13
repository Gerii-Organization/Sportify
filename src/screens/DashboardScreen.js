import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, SafeAreaView, Dimensions, Platform, TouchableOpacity, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, G } from 'react-native-svg';
import { Flame, Clock, Moon, CheckCircle2, Circle as CircleIcon, Footprints, Droplets } from 'lucide-react-native';

const NEON_GREEN = '#1ED760';
const WATER_BLUE = '#3b82f6';
const SLEEP_PURPLE = '#a29bfe';
const CARD_BG = '#121212';

export default function DashboardScreen() {
  const [waterAmount, setWaterAmount] = useState(2150); 
  const [isModalVisible, setModalVisible] = useState(false);
  const WATER_GOAL = 3000; 

  const addWater = (amount) => {
    // Am eliminat Math.min pentru a permite creșterea peste pragul de 3000ml
    setWaterAmount(prev => prev + amount); 
    setModalVisible(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#000000', '#05180B']} style={styles.gradientBg}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoRow}>
              <View style={styles.logoAndName}>
                <View style={styles.logoMark}><Flame size={18} color="black" fill="black" /></View>
                <Text style={styles.appName}>Sportify</Text>
              </View>
              <View style={styles.avatarPlaceholder} />
            </View>
            <Text style={styles.dateText}>Monday, Oct 24</Text>
            <Text style={styles.welcomeText}>Hello, Alex</Text>
          </View>

          {/* Progress Ring */}
          <View style={styles.progressContainer}>
            <View style={styles.ringShadowWrapper}>
              <Svg height={200} width={200} viewBox="0 0 100 100">
                <G rotation="-90" origin="50, 50">
                  <Circle cx="50" cy="50" r="45" stroke="#1A1A1A" strokeWidth="6" fill="transparent" />
                  <Circle 
                    cx="50" cy="50" r="45" stroke={NEON_GREEN} strokeWidth="6" fill="transparent" 
                    strokeDasharray="283" strokeDashoffset={70} strokeLinecap="round"
                  />
                </G>
              </Svg>
            </View>
            <View style={styles.stepsInfoContainer}>
              <Footprints size={24} color={NEON_GREEN} />
              <Text style={styles.stepCount}>8,420</Text>
              <Text style={styles.stepGoal}>of 10,000 steps</Text>
            </View>
          </View>

          {/* Today's Focus */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Today's Focus</Text>
            <Text style={styles.seeAllText}>See All</Text>
          </View>
          
          <View style={[styles.taskCard, styles.neonBorder]}>
            <CheckCircle2 size={24} color={NEON_GREEN} />
            <View style={styles.taskTextContainer}>
              <Text style={styles.taskTitle}>Morning 5k Run</Text>
              <Text style={styles.taskDescription}>Completed at 7:30 AM</Text>
            </View>
          </View>

          {/* Card Apă - Actualizat să crească infinit */}
          <View style={[styles.taskCard, waterAmount >= WATER_GOAL && styles.neonBorder]}>
            {waterAmount >= WATER_GOAL ? (
              <CheckCircle2 size={24} color={NEON_GREEN} />
            ) : (
              <CircleIcon size={24} color="#333" />
            )}
            <View style={styles.taskTextContainer}>
              <Text style={styles.taskTitle}>Drink 3L Water</Text>
              <Text style={styles.taskDescription}>
                Progress: {(waterAmount / 1000).toFixed(2)}L / {(WATER_GOAL / 1000).toFixed(1)}L
              </Text>
            </View>
          </View>

          {/* Daily Summary */}
          <Text style={[styles.sectionTitle, { marginLeft: 20, marginTop: 25 }]}>Daily Summary</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCardWrapper}>
              <StatCard icon={<Flame size={16} color={NEON_GREEN}/>} label="CALORIES" value="1,240" unit="kcal" color={NEON_GREEN} />
            </View>
            <View style={styles.statCardWrapper}>
              <StatCard icon={<Clock size={16} color="#4D79FF"/>} label="ACTIVITY" value="42" unit="mins" color="#4D79FF" />
            </View>
            <View style={styles.statCardWrapper}>
              <StatCard icon={<Moon size={16} color={SLEEP_PURPLE}/>} label="SLEEP" value="7.5" unit="hrs" color={SLEEP_PURPLE} />
            </View>
            <TouchableOpacity style={styles.statCardWrapper} onPress={() => setModalVisible(true)}>
              <StatCard icon={<Droplets size={16} color={WATER_BLUE}/>} label="WATER" value={(waterAmount / 1000).toFixed(2)} unit="L" color={WATER_BLUE} />
            </TouchableOpacity>
          </View>

        </ScrollView>
      </LinearGradient>

      {/* Modal Apă */}
      <Modal transparent visible={isModalVisible} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Droplets size={48} color={WATER_BLUE} style={{ marginBottom: 25 }} />
            <Text style={styles.modalTitle}>Câtă apă ai băut?</Text>
            
            <View style={styles.selectionGrid}>
              {[250, 350, 500, 750].map((amount) => (
                <TouchableOpacity 
                  key={amount} 
                  style={styles.amountButton} 
                  onPress={() => addWater(amount)}
                >
                  <Text style={styles.amountButtonText}>+{amount}ml</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>Anulează</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function StatCard({ icon, label, value, unit, color }) {
  return (
    <View style={styles.statCardInner}>
      <View style={styles.statHeader}>{icon}<Text style={[styles.statLabel, { color }]}>{label}</Text></View>
      <View style={styles.statValueContainer}><Text style={styles.statValue}>{value}</Text><Text style={styles.statUnit}>{unit}</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  gradientBg: { flex: 1 },
  scrollContent: { paddingBottom: 100 },
  header: { padding: 20 },
  logoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logoAndName: { flexDirection: 'row', alignItems: 'center' },
  logoMark: { width: 32, height: 32, backgroundColor: NEON_GREEN, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  appName: { color: '#FFF', fontSize: 22, fontWeight: 'bold', marginLeft: 10 },
  avatarPlaceholder: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#333' },
  dateText: { color: '#666', marginTop: 20, fontSize: 14 },
  welcomeText: { color: '#FFF', fontSize: 32, fontWeight: 'bold' },
  progressContainer: { alignItems: 'center', marginVertical: 20, justifyContent: 'center' },
  ringShadowWrapper: { ...Platform.select({ web: { filter: 'drop-shadow(0px 0px 15px rgba(30, 215, 96, 0.4))' }, ios: { shadowColor: NEON_GREEN, shadowRadius: 15, shadowOpacity: 0.5 } }) },
  stepsInfoContainer: { position: 'absolute', alignItems: 'center' },
  stepCount: { color: '#FFF', fontSize: 42, fontWeight: 'bold' },
  stepGoal: { color: '#666', fontSize: 14 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, alignItems: 'center', marginBottom: 15 },
  sectionTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  seeAllText: { color: NEON_GREEN, fontWeight: 'bold' },
  taskCard: { backgroundColor: CARD_BG, marginHorizontal: 20, borderRadius: 20, padding: 20, flexDirection: 'row', alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#222' },
  neonBorder: { borderColor: NEON_GREEN + '66', ...Platform.select({ web: { boxShadow: '0px 0px 15px rgba(30, 215, 96, 0.15)' } }) },
  taskTextContainer: { marginLeft: 15 },
  taskTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  taskDescription: { color: '#666', fontSize: 12 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, justifyContent: 'space-between', marginTop: 15 },
  statCardWrapper: { width: '48%', marginBottom: 12 },
  statCardInner: { backgroundColor: CARD_BG, borderRadius: 22, padding: 16, height: 115, justifyContent: 'space-between', borderWidth: 1, borderColor: '#222' },
  statHeader: { flexDirection: 'row', alignItems: 'center' },
  statLabel: { fontSize: 10, fontWeight: 'bold', marginLeft: 8 },
  statValueContainer: { flexDirection: 'row', alignItems: 'baseline' },
  statValue: { color: '#FFF', fontSize: 24, fontWeight: 'bold' },
  statUnit: { color: '#666', fontSize: 11, marginLeft: 5 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#121212', borderRadius: 32, padding: 30, width: '85%', alignItems: 'center', borderWidth: 1, borderColor: '#222' },
  modalTitle: { color: '#FFF', fontSize: 24, fontWeight: 'bold', marginBottom: 30, textAlign: 'center' },
  selectionGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', width: '100%' },
  amountButton: { backgroundColor: '#1c2533', paddingVertical: 20, borderRadius: 16, marginBottom: 15, width: '47%', alignItems: 'center' },
  amountButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  closeBtn: { marginTop: 25 },
  closeBtnText: { color: '#666', fontSize: 16, fontWeight: '500' }
});