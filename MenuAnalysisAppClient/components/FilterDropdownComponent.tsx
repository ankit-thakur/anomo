import React, { useState, useRef, useEffect } from "react";
import {
  Animated, View, Text, TouchableOpacity, StyleSheet,
  Modal, Pressable, Easing, ScrollView, Platform, Dimensions,
} from "react-native";
import { updateDietaryPreferences } from "./UserPreferences";

// ── Data ──────────────────────────────────────────────────────────────────────

interface AllergenOption { key: string; label: string; shortLabel: string; emoji: string; }
interface DietOption     { key: string; label: string; emoji: string; }

const ALLERGENS: AllergenOption[] = [
  { key: 'dairy',     label: 'Dairy / Milk', shortLabel: 'Milk',      emoji: '🥛' },
  { key: 'egg',       label: 'Eggs',         shortLabel: 'Eggs',      emoji: '🥚' },
  { key: 'peanut',    label: 'Peanuts',      shortLabel: 'Peanuts',   emoji: '🥜' },
  { key: 'tree_nut',  label: 'Tree Nuts',    shortLabel: 'Tree Nuts', emoji: '🌰' },
  { key: 'soy',       label: 'Soy',          shortLabel: 'Soy',       emoji: '🫘' },
  { key: 'sesame',    label: 'Sesame',       shortLabel: 'Sesame',    emoji: '🌻' },
  { key: 'wheat',     label: 'Wheat',        shortLabel: 'Wheat',     emoji: '🌾' },
  { key: 'fish',      label: 'Fish',         shortLabel: 'Fish',      emoji: '🐟' },
  { key: 'shellfish', label: 'Shellfish',    shortLabel: 'Shellfish', emoji: '🦐' },
  { key: 'mustard',   label: 'Mustard',      shortLabel: 'Mustard',   emoji: '🌱' },
];

const DIETS: DietOption[] = [
  { key: 'vegetarian', label: 'Vegetarian', emoji: '🥦' },
  { key: 'vegan',      label: 'Vegan',      emoji: '🌿' },
  { key: 'gluten_free',label: 'Gluten-free',emoji: '🫓' },
  { key: 'dairy_free', label: 'Dairy-free', emoji: '🥛' },
];

// ── Design tokens ─────────────────────────────────────────────────────────────

const C = {
  cream:      '#F2EDE2',
  creamDark:  '#E6DFD0',
  creamDeep:  '#D5CABB',
  green:      '#4A7C4E',
  greenLight: '#EAF2EB',
  greenMid:   '#B8D9BB',
  red:        '#C94A3A',
  redLight:   '#FDECEA',
  redMid:     '#EDADA6',
  text:       '#1C1C1A',
  textMuted:  '#7A7570',
  textLight:  '#ADA89F',
  white:      '#FFFFFF',
};

// Tile width: 4 cols, 7px gaps, 20px sheet padding each side
const TILE_W = (Dimensions.get('window').width - 40 - 21) / 4;

// ── Prop types ────────────────────────────────────────────────────────────────

interface UserPreferences {
  allergens: string[];
  dietaryRestrictions: string[];
}

interface FilterDropdownProps {
  userPreferences: UserPreferences;
  onFiltersChange: (filters: UserPreferences) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

const FilterDropdownComponent: React.FC<FilterDropdownProps> = ({
  userPreferences,
  onFiltersChange,
}) => {
  // Committed selections (reflect saved prefs)
  const [savedAllergens, setSavedAllergens] = useState<string[]>(userPreferences.allergens ?? []);
  const [savedDiets,     setSavedDiets]     = useState<string[]>(userPreferences.dietaryRestrictions ?? []);

  // Draft selections (local to sheet, discarded on overlay dismiss)
  const [draftAllergens, setDraftAllergens] = useState<string[]>([]);
  const [draftDiets,     setDraftDiets]     = useState<string[]>([]);

  const [sheetVisible, setSheetVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Sync saved state when parent prefs change (e.g. on initial load)
  useEffect(() => {
    setSavedAllergens(userPreferences.allergens ?? []);
    setSavedDiets(userPreferences.dietaryRestrictions ?? []);
  }, [userPreferences]);

  // ── Sheet open/close ───────────────────────────────────────────────────────

  const openSheet = () => {
    // Copy saved into draft so sheet starts from current saved state
    setDraftAllergens([...savedAllergens]);
    setDraftDiets([...savedDiets]);
    setSheetVisible(true);
    Animated.timing(slideAnim, {
      toValue: 1, duration: 310,
      easing: Easing.out(Easing.exp),
      useNativeDriver: true,
    }).start();
  };

  const closeSheet = (save: boolean) => {
    Animated.timing(slideAnim, {
      toValue: 0, duration: 270,
      easing: Easing.in(Easing.exp),
      useNativeDriver: true,
    }).start(async () => {
      setSheetVisible(false);
      if (!save) return;

      setSavedAllergens(draftAllergens);
      setSavedDiets(draftDiets);
      onFiltersChange({ allergens: draftAllergens, dietaryRestrictions: draftDiets });
      try {
        await updateDietaryPreferences({
          allergens: draftAllergens,
          dietaryRestrictions: draftDiets,
        });
      } catch (e) {
        console.error('[FilterDropdownComponent] save failed:', e);
      }
    });
  };

  // ── Draft toggles ──────────────────────────────────────────────────────────

  const toggleAllergen = (key: string) =>
    setDraftAllergens(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);

  const toggleDiet = (key: string) =>
    setDraftDiets(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const translateY = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [600, 0] });
  const totalSaved = savedAllergens.length + savedDiets.length;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={s.container}>

      {/* ── Top bar ── */}
      <View style={s.topBar}>

        {/* Single plus-circle button — dashed when empty, filled when active */}
        <TouchableOpacity
          style={[s.filterBtn, totalSaved > 0 && s.filterBtnActive]}
          onPress={openSheet}
          activeOpacity={0.75}
        >
          <Text style={[s.plusIcon, totalSaved > 0 && s.plusIconActive]}>+</Text>
        </TouchableOpacity>

        {/* Chips scroll — only shows active selections */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.chipsScroll}
          contentContainerStyle={s.chipsRow}
        >
          {savedAllergens.map(key => {
            const a = ALLERGENS.find(x => x.key === key);
            if (!a) return null;
            return (
              <View key={key} style={[s.chip, s.chipAvoid]}>
                <Text style={[s.chipText, s.chipTextRed]}>{a.emoji} {a.shortLabel}</Text>
              </View>
            );
          })}
          {savedDiets.map(key => {
            const d = DIETS.find(x => x.key === key);
            if (!d) return null;
            return (
              <View key={key} style={[s.chip, s.chipDiet]}>
                <Text style={[s.chipText, s.chipTextGreen]}>{d.emoji} {d.label}</Text>
              </View>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Sheet modal ── */}
      <Modal transparent visible={sheetVisible} animationType="fade">
        <Pressable style={s.overlay} onPress={() => closeSheet(false)} />
        <Animated.View style={[s.sheet, { transform: [{ translateY }] }]}>

          {/* Handle */}
          <View style={s.handle} />

          <ScrollView
            contentContainerStyle={s.sheetContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Header */}
            <Text style={s.sheetTitle}>Your dietary profile</Text>
            <Text style={s.sheetSub}>Tap tiles to select your allergens and dietary preferences</Text>

            {/* Allergens */}
            <Text style={s.sectionLabel}>Allergens</Text>
            <View style={s.tileGrid}>
              {ALLERGENS.map(item => {
                const sel = draftAllergens.includes(item.key);
                return (
                  <TouchableOpacity
                    key={item.key}
                    style={[s.tile, sel && s.tileSelAvoid]}
                    onPress={() => toggleAllergen(item.key)}
                    activeOpacity={0.7}
                  >
                    <Text style={s.tileEmoji}>{item.emoji}</Text>
                    <Text style={[s.tileLabel, sel && s.tileLabelAvoid]}>{item.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Diets */}
            <Text style={[s.sectionLabel, { marginTop: 14 }]}>Dietary preferences</Text>
            <View style={s.tileGrid}>
              {DIETS.map(item => {
                const sel = draftDiets.includes(item.key);
                return (
                  <TouchableOpacity
                    key={item.key}
                    style={[s.tile, sel && s.tileSelDiet]}
                    onPress={() => toggleDiet(item.key)}
                    activeOpacity={0.7}
                  >
                    <Text style={s.tileEmoji}>{item.emoji}</Text>
                    <Text style={[s.tileLabel, sel && s.tileLabelDiet]}>{item.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* CTA */}
            <TouchableOpacity
              style={s.cta}
              onPress={() => closeSheet(true)}
              activeOpacity={0.85}
            >
              <Text style={s.ctaText}>Save & update restaurants</Text>
            </TouchableOpacity>

          </ScrollView>
        </Animated.View>
      </Modal>
    </View>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: {},

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  filterBtn: {
    width: 34, height: 34, borderRadius: 17,
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.green,
    backgroundColor: 'transparent',
    justifyContent: 'center', alignItems: 'center',
    flexShrink: 0,
  },
  filterBtnActive: {
    backgroundColor: C.green,
    borderStyle: 'solid',
  },
  plusIcon: {
    fontSize: 20, lineHeight: 22,
    color: C.green, fontWeight: '300',
    includeFontPadding: false,
  },
  plusIconActive: { color: C.white },

  // Chips
  chipsScroll: { flex: 1 },
  chipsRow: { gap: 6, alignItems: 'center', paddingRight: 4 },
  chip: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 20, paddingVertical: 5, paddingHorizontal: 10,
    flexShrink: 0,
  },
  chipAvoid: {
    backgroundColor: C.redLight,
    borderWidth: 1.5, borderColor: C.redMid,
  },
  chipDiet: {
    backgroundColor: C.greenLight,
    borderWidth: 1.5, borderColor: C.greenMid,
  },
  chipText: { fontFamily: 'Inter_500Medium', fontSize: 11, fontWeight: '600' },
  chipTextRed:   { color: C.red },
  chipTextGreen: { color: C.green },

  // Sheet
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: C.white,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '88%',
    shadowColor: '#000', shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: -4 }, shadowRadius: 20,
    elevation: 10,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: C.creamDeep,
    alignSelf: 'center', marginTop: 10, marginBottom: 2,
  },
  sheetContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 44 : 28,
  },
  sheetTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 20, color: C.text, marginBottom: 3,
  },
  sheetSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12, color: C.textLight, marginBottom: 16, lineHeight: 17,
  },
  sectionLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 9, color: C.textLight,
    textTransform: 'uppercase', letterSpacing: 0.9,
    marginBottom: 8,
  },

  // Tile grid
  tileGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 7,
  },
  tile: {
    width: TILE_W,
    borderRadius: 14,
    borderWidth: 1.5, borderColor: C.creamDark,
    backgroundColor: C.white,
    paddingVertical: 10, paddingHorizontal: 4,
    alignItems: 'center', gap: 4,
  },
  tileSelAvoid: { borderColor: C.red,   backgroundColor: C.redLight },
  tileSelDiet:  { borderColor: C.green, backgroundColor: C.greenLight },
  tileEmoji: { fontSize: 22, lineHeight: 26 },
  tileLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 9, fontWeight: '600',
    color: C.textMuted, textAlign: 'center', lineHeight: 12,
  },
  tileLabelAvoid: { color: C.red },
  tileLabelDiet:  { color: C.green },

  // CTA
  cta: {
    marginTop: 22,
    backgroundColor: C.green,
    borderRadius: 28, paddingVertical: 15,
    alignItems: 'center',
    shadowColor: C.green, shadowOpacity: 0.28,
    shadowOffset: { width: 0, height: 4 }, shadowRadius: 14,
    elevation: 4,
  },
  ctaText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 15, color: C.white, letterSpacing: 0.2,
  },
});

export default FilterDropdownComponent;
