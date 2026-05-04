import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, Dimensions, Platform, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { updateDietaryPreferences } from './UserPreferences';

// Bump this number to re-trigger onboarding for all users on major updates.
export const ONBOARDING_VERSION = 1;
export const ONBOARDING_VERSION_KEY = 'onboarding_version';

const { width: SCREEN_W } = Dimensions.get('window');
const TILE_W = (SCREEN_W - 40 - 21) / 4;

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

const ALLERGENS = [
  { key: 'dairy',     label: 'Dairy / Milk', emoji: '🥛' },
  { key: 'egg',       label: 'Eggs',         emoji: '🥚' },
  { key: 'peanut',    label: 'Peanuts',      emoji: '🥜' },
  { key: 'tree_nut',  label: 'Tree Nuts',    emoji: '🌰' },
  { key: 'soy',       label: 'Soy',          emoji: '🫘' },
  { key: 'sesame',    label: 'Sesame',       emoji: '🌻' },
  { key: 'wheat',     label: 'Wheat',        emoji: '🌾' },
  { key: 'fish',      label: 'Fish',         emoji: '🐟' },
  { key: 'shellfish', label: 'Shellfish',    emoji: '🦐' },
  { key: 'mustard',   label: 'Mustard',      emoji: '🌱' },
];

const DIETS = [
  { key: 'vegetarian', label: 'Vegetarian', emoji: '🥦' },
  { key: 'vegan',      label: 'Vegan',      emoji: '🌿' },
  { key: 'gluten_free',label: 'Gluten-free',emoji: '🫓' },
  { key: 'dairy_free', label: 'Dairy-free', emoji: '🥛' },
];

const DISCLAIMER_SECTIONS = [
  {
    heading: 'Informational Use Only',
    body: 'The information provided in this app, including allergen details, dietary suggestions, and ingredient recommendations, is for informational purposes only and is not intended as medical advice, diagnosis, or treatment.',
  },
  {
    heading: 'No Guarantee of Accuracy',
    body: 'While we make reasonable efforts to provide accurate and up-to-date information, we cannot guarantee that all allergen, ingredient, or dietary information is complete, reliable, or error-free. Food products and restaurant offerings may change at any time without notice.',
  },
  {
    heading: 'Consult a Professional',
    body: 'Always consult a qualified healthcare professional for personalized advice regarding your specific health or dietary needs. Do not rely solely on this app to make health-related decisions.',
  },
  {
    heading: 'Your Agreement',
    body: "By continuing, you acknowledge that you assume full responsibility for any decisions made based on this app's information. ANOMO and its affiliates are not liable for errors, omissions, or consequences resulting from your use of this app.",
  },
  {
    heading: 'Medical Emergencies',
    body: 'If you have or suspect a medical condition, seek immediate professional advice. Never delay seeking medical help because of something you read in this app.',
  },
];

const TOTAL_STEPS = 4;

export default function OnboardingScreen() {
  const [step, setStep] = useState(0);
  const [disclaimerChecked, setDisclaimerChecked] = useState(false);
  const [allergens, setAllergens] = useState<string[]>([]);
  const [diets, setDiets] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const goToStep = (next: number) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 140, useNativeDriver: true }).start(() => {
      setStep(next);
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    });
  };

  const toggleAllergen = (key: string) =>
    setAllergens(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);

  const toggleDiet = (key: string) =>
    setDiets(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);

  const handleFinishProfile = async () => {
    setIsSaving(true);
    try {
      if (allergens.length > 0 || diets.length > 0) {
        await updateDietaryPreferences({ allergens, dietaryRestrictions: diets });
      }
    } catch (e) {
      console.warn('[Onboarding] Failed to save preferences:', e);
    } finally {
      setIsSaving(false);
    }
    await AsyncStorage.setItem(ONBOARDING_VERSION_KEY, String(ONBOARDING_VERSION));
    goToStep(3);
  };

  const handleComplete = async () => {
    await AsyncStorage.setItem(ONBOARDING_VERSION_KEY, String(ONBOARDING_VERSION));
    router.replace('/home');
  };

  const renderProgressDots = () => (
    <View style={s.dots}>
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <View key={i} style={[s.dot, i === step && s.dotActive]} />
      ))}
    </View>
  );

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <View style={s.stepContent}>
            <View style={s.welcomeHero}>
              <Text style={s.heroLogo}>anomo</Text>
              <Text style={s.heroTagline}>eat with confidence</Text>
            </View>
            <View style={s.textBlock}>
              <Text style={s.stepTitle}>Welcome to ANOMO</Text>
              <Text style={s.stepBody}>
                ANOMO helps you discover restaurants and navigate menus safely based on your allergens and dietary needs.
              </Text>
              <Text style={[s.stepBody, { marginTop: 12 }]}>
                Let's take a minute to set up your profile so every search is personalised to you.
              </Text>
            </View>
            <TouchableOpacity style={s.primaryBtn} onPress={() => goToStep(1)} activeOpacity={0.85}>
              <Text style={s.primaryBtnText}>Let's get started</Text>
            </TouchableOpacity>
          </View>
        );

      case 1:
        return (
          <View style={s.stepContent}>
            <Text style={s.stepTitle}>Important Disclaimers</Text>
            <Text style={s.stepBodySmall}>Please read the following before using ANOMO.</Text>
            <ScrollView style={s.scrollArea} showsVerticalScrollIndicator={false}>
              {DISCLAIMER_SECTIONS.map((sec, i) => (
                <View key={i} style={s.disclaimerSection}>
                  <Text style={s.disclaimerHeading}>{sec.heading}</Text>
                  <Text style={s.disclaimerBody}>{sec.body}</Text>
                </View>
              ))}
              <View style={{ height: 8 }} />
            </ScrollView>
            <TouchableOpacity
              style={s.checkRow}
              onPress={() => setDisclaimerChecked(v => !v)}
              activeOpacity={0.8}
            >
              <View style={[s.checkbox, disclaimerChecked && s.checkboxChecked]}>
                {disclaimerChecked && <Text style={s.checkmark}>✓</Text>}
              </View>
              <Text style={s.checkLabel}>I have read and acknowledge these disclaimers</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.primaryBtn, !disclaimerChecked && s.primaryBtnDisabled]}
              onPress={() => { if (disclaimerChecked) goToStep(2); }}
              activeOpacity={disclaimerChecked ? 0.85 : 1}
            >
              <Text style={s.primaryBtnText}>I Acknowledge</Text>
            </TouchableOpacity>
          </View>
        );

      case 2:
        return (
          <View style={s.stepContent}>
            <Text style={s.stepTitle}>Your Dietary Profile</Text>
            <Text style={s.stepBodySmall}>
              Select your allergens and dietary preferences. You can always update these later using the + button.
            </Text>
            <ScrollView style={s.scrollArea} showsVerticalScrollIndicator={false}>
              <Text style={s.sectionLabel}>Allergens to avoid</Text>
              <View style={s.tileGrid}>
                {ALLERGENS.map(item => {
                  const sel = allergens.includes(item.key);
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
              <Text style={[s.sectionLabel, { marginTop: 16 }]}>Dietary preferences</Text>
              <View style={s.tileGrid}>
                {DIETS.map(item => {
                  const sel = diets.includes(item.key);
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
              <View style={{ height: 8 }} />
            </ScrollView>
            <TouchableOpacity
              style={[s.primaryBtn, isSaving && s.primaryBtnDisabled]}
              onPress={() => { if (!isSaving) handleFinishProfile(); }}
              activeOpacity={0.85}
            >
              {isSaving
                ? <ActivityIndicator color={C.white} />
                : <Text style={s.primaryBtnText}>
                    {allergens.length + diets.length > 0 ? 'Save & continue' : 'Skip for now'}
                  </Text>
              }
            </TouchableOpacity>
          </View>
        );

      case 3: {
        const totalSelections = allergens.length + diets.length;
        return (
          <View style={[s.stepContent, s.centerContent]}>
            <View style={s.doneCircle}>
              <Text style={s.doneCheck}>✓</Text>
            </View>
            <Text style={[s.stepTitle, { textAlign: 'center', marginTop: 24 }]}>You're all set!</Text>
            <Text style={[s.stepBody, { textAlign: 'center', marginTop: 12 }]}>
              {totalSelections > 0
                ? `We've saved your profile with ${allergens.length} allergen${allergens.length !== 1 ? 's' : ''} and ${diets.length} dietary preference${diets.length !== 1 ? 's' : ''}. ANOMO will highlight safe options for you.`
                : "You can set up your dietary profile anytime using the + button at the top of the home screen."
              }
            </Text>
            <TouchableOpacity style={[s.primaryBtn, { marginTop: 36 }]} onPress={handleComplete} activeOpacity={0.85}>
              <Text style={s.primaryBtnText}>Start exploring</Text>
            </TouchableOpacity>
          </View>
        );
      }

      default:
        return null;
    }
  };

  return (
    <View style={s.container}>
      {renderProgressDots()}
      <Animated.View style={[s.content, { opacity: fadeAnim }]}>
        {renderStep()}
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.cream,
    paddingTop: Platform.OS === 'ios' ? 60 : 32,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  dot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: C.creamDeep,
  },
  dotActive: {
    backgroundColor: C.green,
    width: 24,
    borderRadius: 4,
  },
  content: {
    flex: 1,
  },

  // Step layout
  stepContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Welcome hero
  welcomeHero: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 36,
  },
  heroLogo: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 52,
    color: C.green,
    letterSpacing: -1,
  },
  heroTagline: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: C.textMuted,
    marginTop: 4,
    letterSpacing: 0.5,
  },

  // Text
  textBlock: {
    flex: 1,
  },
  stepTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 24,
    color: C.text,
    marginBottom: 12,
  },
  stepBody: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: C.textMuted,
    lineHeight: 23,
  },
  stepBodySmall: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: C.textLight,
    lineHeight: 19,
    marginBottom: 14,
  },

  // Scroll area (fills space between header and button)
  scrollArea: {
    flex: 1,
    marginBottom: 12,
  },

  // Disclaimer sections
  disclaimerSection: {
    marginBottom: 18,
  },
  disclaimerHeading: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    color: C.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 5,
  },
  disclaimerBody: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: C.textMuted,
    lineHeight: 20,
  },

  // Checkbox row
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    paddingVertical: 4,
  },
  checkbox: {
    width: 24, height: 24, borderRadius: 6,
    borderWidth: 2, borderColor: C.creamDeep,
    backgroundColor: C.white,
    justifyContent: 'center', alignItems: 'center',
    flexShrink: 0,
  },
  checkboxChecked: {
    backgroundColor: C.green,
    borderColor: C.green,
  },
  checkmark: {
    color: C.white,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 16,
  },
  checkLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: C.text,
    flex: 1,
    lineHeight: 19,
  },

  // Tile grid
  sectionLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    color: C.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    marginBottom: 10,
  },
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
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

  // Done screen
  doneCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: C.green,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: C.green, shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 6 }, shadowRadius: 20,
    elevation: 6,
  },
  doneCheck: {
    fontSize: 36,
    color: C.white,
    lineHeight: 42,
  },

  // CTA button
  primaryBtn: {
    backgroundColor: C.green,
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: C.green, shadowOpacity: 0.28,
    shadowOffset: { width: 0, height: 4 }, shadowRadius: 14,
    elevation: 4,
  },
  primaryBtnDisabled: {
    backgroundColor: C.creamDeep,
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryBtnText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
    color: C.white,
    letterSpacing: 0.2,
  },
});
