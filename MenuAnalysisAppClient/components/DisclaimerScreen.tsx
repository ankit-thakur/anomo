import { router } from 'expo-router';
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

const COLORS = {
  cream: '#F2EDE2',
  creamDark: '#E8E0D0',
  text: '#1C1C1A',
  textMuted: '#7A7570',
  textLight: '#ADA89F',
  white: '#FFFFFF',
};

const SECTIONS = [
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
    body: 'Users should not rely solely on this app to make decisions regarding allergies, intolerances, or other medical conditions. Always consult a qualified healthcare professional for personalized medical advice and guidance regarding your specific health or dietary needs.',
  },
  {
    heading: 'Your Agreement',
    body: 'By using this app, you acknowledge and agree that:\n\n1. You assume full responsibility for any decisions or actions taken based on the information provided.\n\n2. ANOMO and its affiliates, partners, and contributors are not liable for any errors, omissions, misinterpretations, or consequences resulting from the use of this app.\n\n3. You release and hold harmless ANOMO from any and all claims, damages, or liability, whether direct or indirect, arising from your reliance on the app or the information contained within it.',
  },
  {
    heading: 'Medical Emergencies',
    body: 'If you have or suspect you may have a medical condition, seek immediate advice from a licensed healthcare professional. Never delay, disregard, or avoid seeking medical advice because of something you read in this app.',
  },
];

export default function DisclaimerScreen() {
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Icon name="keyboard-arrow-left" size={20} color={COLORS.text} />
          <Text style={styles.backBtnText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Disclaimers</Text>
        <View style={{ width: 72 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>
          Please read the following carefully before using ANOMO.
        </Text>

        {SECTIONS.map((section, i) => (
          <View key={i} style={styles.section}>
            <Text style={styles.sectionHeading}>{section.heading}</Text>
            <Text style={styles.sectionBody}>{section.body}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.cream,
    paddingTop: Platform.OS === 'ios' ? 54 : 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.creamDark,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.creamDark,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 2,
  },
  backBtnText: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
  },
  content: {
    padding: 20,
    paddingTop: 24,
    paddingBottom: 48,
  },
  intro: {
    fontSize: 14,
    color: COLORS.textMuted,
    lineHeight: 20,
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  sectionBody: {
    fontSize: 14,
    color: COLORS.textMuted,
    lineHeight: 22,
  },
});
