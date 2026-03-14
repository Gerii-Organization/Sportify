import React, { useState, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator, Modal, Platform, Alert } from 'react-native';
import { BlurView } from 'expo-blur';
import { useFocusEffect } from '@react-navigation/native';
import { ShoppingBag, Zap, Circle, User, Shield, Check, Flame, Crown, Swords, Ghost, Hexagon, Triangle, ZapOff, BatteryCharging, Trophy } from 'lucide-react-native';
import { supabase } from '../lib/supabase';

const NEON_GREEN = '#00FF66';

const CATALOG_RINGS = [
  { id: 'r1', name: 'Standard Flow', price: 0, type: 'standard', color: '#00FF66' },
  { id: 'r2', name: 'Hellfire Ring', price: 800, type: 'inferno', color: '#FF3300' },
  { id: 'r3', name: 'Cyber Hex', price: 1200, type: 'cyber', color: '#00EAFF' },
  { id: 'r4', name: 'Toxic Triangle', price: 1500, type: 'toxic', color: '#39FF14' },
];

const CATALOG_AVATARS = [
  { id: 'a1', name: 'Clean Cut', price: 0, type: 'standard', color: '#1A1A1A' },
  { id: 'a2', name: 'Golden King', price: 1500, type: 'royal', color: '#FFD700' },
  { id: 'a3', name: 'Demon Aura', price: 2000, type: 'demon', color: '#9900FF' },
  { id: 'a4', name: 'Electric Glitch', price: 2500, type: 'glitch', color: '#FF00FF' },
];

const CATALOG_BADGES = [
  { id: 'b1', name: 'Rookie', price: 0, icon: 'Shield', color: '#888' },
  { id: 'b2', name: 'Spartan', price: 1000, icon: 'Swords', color: '#FF4444' },
  { id: 'b3', name: 'Phantom', price: 3000, icon: 'Ghost', color: '#00EAFF' },
  { id: 'b4', name: 'Overlord', price: 5000, icon: 'Crown', color: '#FFD700' },
];

const CATALOG_POWERUPS = [
  { id: 'p1', name: 'XP Boost', desc: 'Double ⚡ for 24h', price: 600, icon: 'Trophy', color: '#FFD700' },
];

export default function ShopScreen() {
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(0);
  const [rings, setRings] = useState([]);
  const [avatars, setAvatars] = useState([]);
  const [badges, setBadges] = useState([]);
  const [powerups, setPowerups] = useState(CATALOG_POWERUPS);

  const [purchaseModalVisible, setPurchaseModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  useFocusEffect(
    useCallback(() => {
      fetchShopData();
    }, [])
  );

  const fetchShopData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('energy_points, equipped_ring, equipped_avatar, equipped_badge')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!profile) {
        setBalance(0);
        setRings(CATALOG_RINGS.map(item => ({ ...item, owned: false, equipped: false })));
        setAvatars(CATALOG_AVATARS.map(item => ({ ...item, owned: false, equipped: false })));
        setBadges(CATALOG_BADGES.map(item => ({ ...item, owned: false, equipped: false })));
        return;
      }

      const { data: inventory, error: invError } = await supabase
        .from('user_inventory')
        .select('item_id')
        .eq('user_id', user.id);

      if (invError) throw invError;

      const ownedItemIds = new Set(inventory.map(item => item.item_id));

      setBalance(profile.energy_points || 0);

      setRings(CATALOG_RINGS.map(item => ({
        ...item,
        owned: item.price === 0 || ownedItemIds.has(item.id),
        equipped: profile.equipped_ring === item.id
      })));

      setAvatars(CATALOG_AVATARS.map(item => ({
        ...item,
        owned: item.price === 0 || ownedItemIds.has(item.id),
        equipped: profile.equipped_avatar === item.id
      })));

      setBadges(CATALOG_BADGES.map(item => ({
        ...item,
        owned: item.price === 0 || ownedItemIds.has(item.id),
        equipped: profile.equipped_badge === item.id
      })));

    } catch (error) {
      if (Platform.OS === 'web') {
        window.alert(error.message);
      } else {
        Alert.alert("Error", error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (item, categoryType) => {
    if (categoryType !== 'powerup' && item.equipped) return;

    if (item.owned && categoryType !== 'powerup') {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let updateField = '';
      if (categoryType === 'ring') updateField = 'equipped_ring';
      if (categoryType === 'avatar') updateField = 'equipped_avatar';
      if (categoryType === 'badge') updateField = 'equipped_badge';

      const { error } = await supabase.from('profiles').update({ [updateField]: item.id }).eq('id', user.id);

      if (!error) fetchShopData();
    } else {
      if (balance >= item.price) {
        setSelectedItem({ item, categoryType });
        setPurchaseModalVisible(true);
      }
    }
  };

  const confirmPurchase = async () => {
    if (!selectedItem) return;
    const { item, categoryType } = selectedItem;
    setPurchaseModalVisible(false);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const newBalance = balance - item.price;

      const { error: profileErr } = await supabase
        .from('profiles')
        .update({ energy_points: newBalance })
        .eq('id', user.id);

      if (profileErr) throw profileErr;

      if (categoryType !== 'powerup') {
        const { error: invErr } = await supabase
          .from('user_inventory')
          .upsert(
            {
              user_id: user.id,
              item_id: item.id,
              item_type: categoryType,
              purchased_at: new Date().toISOString()
            },
            { onConflict: 'user_id,item_id' }
          );

        if (invErr) throw invErr;
      }

      if (item.id === 'p3') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const { error: foodErr } = await supabase.from('scanned_foods')
          .delete()
          .eq('user_id', user.id)
          .gte('scanned_at', today.toISOString());

        if (foodErr) throw foodErr;
      }

      if (item.id === 'p1') {
        const todayStr = new Date().toISOString().split('T')[0];

        const { data: currentSteps, error: selectErr } = await supabase
          .from('daily_steps')
          .select('step_count, id')
          .eq('user_id', user.id)
          .eq('record_date', todayStr)
          .maybeSingle();

        if (selectErr) throw selectErr;

        if (currentSteps) {
          const { error: updateErr } = await supabase.from('daily_steps').update(
            { step_count: currentSteps.step_count + 5000 }
          ).eq('id', currentSteps.id);

          if (updateErr) throw updateErr;
        } else {
          const { error: insertErr } = await supabase.from('daily_steps').insert([
            { user_id: user.id, record_date: todayStr, step_count: 5000 }
          ]);

          if (insertErr) throw insertErr;
        }
      }

      fetchShopData();
    } catch (err) {
      if (Platform.OS === 'web') {
        window.alert(err.message);
      } else {
        Alert.alert("Purchase Error", err.message);
      }
    }
  };

  const renderVisualPreview = (item, categoryType) => {
    if (categoryType === 'ring') {
      if (item.type === 'inferno') {
        return (
          <View style={styles.previewContainer}>
            <Circle color={item.color} size={40} strokeWidth={3} />
            <Flame color="#FF8800" size={20} style={styles.absoluteTop} />
            <Flame color="#FF8800" size={20} style={styles.absoluteBottom} />
          </View>
        );
      }
      if (item.type === 'cyber') {
        return (
          <View style={styles.previewContainer}>
            <Hexagon color={item.color} size={44} strokeWidth={2} />
            <Hexagon color="#FF00FF" size={34} strokeWidth={1} style={styles.absoluteCenter} />
          </View>
        );
      }
      if (item.type === 'toxic') {
        return (
          <View style={styles.previewContainer}>
            <Triangle color={item.color} size={46} strokeWidth={3} />
            <Circle color="#000" size={10} style={styles.absoluteCenter} fill={item.color} />
          </View>
        );
      }
      return <Circle color={item.color} size={36} strokeWidth={4} />;
    }

    if (categoryType === 'avatar') {
      if (item.type === 'royal') {
        return (
          <View style={[styles.avatarFrame, { borderColor: item.color, borderWidth: 3 }]}>
            <User color="#fff" size={24} />
            <Crown color={item.color} size={22} style={styles.absoluteTopOffset} fill="rgba(255, 215, 0, 0.3)" />
          </View>
        );
      }
      if (item.type === 'demon') {
        return (
          <View style={[styles.avatarFrame, { borderColor: item.color, borderWidth: 2, borderStyle: 'dashed' }]}>
            <User color="#fff" size={24} />
            <Flame color={item.color} size={30} style={styles.absoluteBackground} />
          </View>
        );
      }
      if (item.type === 'glitch') {
        return (
          <View style={[styles.avatarFrame, { borderColor: item.color, borderWidth: 2, borderRadius: 10 }]}>
            <User color="#00EAFF" size={26} style={{ marginLeft: -2 }} />
            <User color="#FF00FF" size={26} style={styles.absoluteCenterOffset} />
          </View>
        );
      }
      return (
        <View style={[styles.avatarFrame, { borderColor: '#444' }]}>
          <User color="#fff" size={24} />
        </View>
      );
    }

    if (categoryType === 'badge') {
      let IconObj = Shield;
      if (item.icon === 'Swords') IconObj = Swords;
      if (item.icon === 'Ghost') IconObj = Ghost;
      if (item.icon === 'Crown') IconObj = Crown;

      return (
        <View style={[styles.previewContainer, { backgroundColor: `${item.color}22`, borderRadius: 25 }]}>
          <IconObj color={item.color} size={32} />
        </View>
      );
    }

    if (categoryType === 'powerup') {
      let IconObj = BatteryCharging;
      if (item.icon === 'ZapOff') IconObj = ZapOff;
      if (item.icon === 'Trophy') IconObj = Trophy;

      return (
        <View style={[styles.previewContainer, { backgroundColor: `${item.color}15`, borderRadius: 15, padding: 10 }]}>
          <IconObj color={item.color} size={38} />
        </View>
      );
    }
  };

  const renderItemCard = (item, categoryType) => {
    const isPowerup = categoryType === 'powerup';
    const isLocked = !isPowerup && !item.owned;
    const isEquipped = !isPowerup && item.equipped;

    return (
      <TouchableOpacity
        key={item.id}
        style={[styles.itemCard, isEquipped && styles.itemCardEquipped]}
        onPress={() => handleAction(item, categoryType)}
      >
        <View style={styles.itemPreviewBox}>
          {renderVisualPreview(item, categoryType)}
        </View>
        <View style={styles.itemInfo}>
          <Text style={styles.itemName}>{item.name}</Text>
          {isPowerup && <Text style={styles.itemDesc}>{item.desc}</Text>}
          {isEquipped ? (
            <View style={styles.statusBadge}>
              <Check color={NEON_GREEN} size={14} />
              <Text style={styles.statusTextEquipped}>Equipped</Text>
            </View>
          ) : isLocked || isPowerup ? (
            <View style={styles.priceContainer}>
              <Zap color="#FFD700" size={14} />
              <Text style={styles.priceText}>{item.price}</Text>
            </View>
          ) : (
            <View style={styles.statusBadgeOwned}>
              <Text style={styles.statusTextOwned}>Equip</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={NEON_GREEN} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Shop</Text>
        <BlurView intensity={30} tint="dark" style={styles.balanceContainer}>
          <Zap color="#FFD700" size={20} fill="#FFD700" />
          <Text style={styles.balanceText}>{balance}</Text>
        </BlurView>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        <Text style={styles.sectionTitle}>Power-Ups</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
          {powerups.map(powerup => renderItemCard(powerup, 'powerup'))}
        </ScrollView>

        <Text style={styles.sectionTitle}>Progress Bar Themes</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
          {rings.map(ring => renderItemCard(ring, 'ring'))}
        </ScrollView>

        <Text style={styles.sectionTitle}>Avatar Border Themes</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
          {avatars.map(avatar => renderItemCard(avatar, 'avatar'))}
        </ScrollView>

      </ScrollView>

      <Modal transparent visible={purchaseModalVisible} animationType="fade">
        <View style={styles.modalOverlayFull}>
          <View style={styles.modalContent}>
            <ShoppingBag size={48} color={NEON_GREEN} style={{ marginBottom: 20 }} />
            <Text style={styles.modalTitle}>Confirm Purchase</Text>
            <Text style={styles.modalText}>
              Do you want to buy {selectedItem?.item.name} for <Text style={{color: '#FFD700', fontWeight: 'bold'}}>{selectedItem?.item.price} ⚡</Text>?
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setPurchaseModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBuyBtn} onPress={confirmPurchase}>
                <Text style={styles.modalBuyText}>Buy</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  loadingContainer: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 40 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#fff' },
  balanceContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255, 215, 0, 0.2)' },
  balanceText: { color: '#FFD700', fontSize: 18, fontWeight: 'bold', marginLeft: 8 },
  scrollContent: { paddingBottom: 120 },
  sectionTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginLeft: 20, marginTop: 20, marginBottom: 15 },
  horizontalScroll: { paddingHorizontal: 15, paddingRight: 30 },
  itemCard: { backgroundColor: '#0a0a0a', width: 140, borderRadius: 20, padding: 15, marginRight: 15, borderWidth: 1, borderColor: '#1A1A1A', alignItems: 'center' },
  itemCardEquipped: { borderColor: NEON_GREEN, backgroundColor: 'rgba(0, 255, 102, 0.05)', shadowColor: NEON_GREEN, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  itemPreviewBox: { width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(255,255,255,0.02)', justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  previewContainer: { width: 50, height: 50, justifyContent: 'center', alignItems: 'center' },
  absoluteTop: { position: 'absolute', top: -10 },
  absoluteBottom: { position: 'absolute', bottom: -10, transform: [{ rotate: '180deg' }] },
  absoluteCenter: { position: 'absolute' },
  avatarFrame: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1A1A1A', borderWidth: 2 },
  absoluteTopOffset: { position: 'absolute', top: -18 },
  absoluteBackground: { position: 'absolute', opacity: 0.4, zIndex: -1 },
  absoluteCenterOffset: { position: 'absolute', opacity: 0.7, marginLeft: 2 },
  itemInfo: { alignItems: 'center', width: '100%' },
  itemName: { color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 8, textAlign: 'center' },
  itemDesc: { color: '#888', fontSize: 10, marginBottom: 8, textAlign: 'center' },
  priceContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 215, 0, 0.1)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  priceText: { color: '#FFD700', fontWeight: 'bold', marginLeft: 4, fontSize: 12 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0, 255, 102, 0.15)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  statusTextEquipped: { color: NEON_GREEN, fontWeight: 'bold', fontSize: 12, marginLeft: 4 },
  statusBadgeOwned: { backgroundColor: 'rgba(255, 255, 255, 0.08)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  statusTextOwned: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  modalOverlayFull: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#0a0a0a', borderRadius: 25, padding: 25, width: '85%', alignItems: 'center', borderWidth: 1, borderColor: '#1A1A1A' },
  modalTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 10 },
  modalText: { color: '#aaa', fontSize: 16, textAlign: 'center', marginBottom: 25 },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  modalCancelBtn: { flex: 1, padding: 15, backgroundColor: '#1A1A1A', borderRadius: 15, marginRight: 10, alignItems: 'center' },
  modalCancelText: { color: '#fff', fontWeight: 'bold' },
  modalBuyBtn: { flex: 1, padding: 15, backgroundColor: NEON_GREEN, borderRadius: 15, marginLeft: 10, alignItems: 'center', shadowColor: NEON_GREEN, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 4 },
  modalBuyText: { color: '#000', fontWeight: 'bold' }
});
