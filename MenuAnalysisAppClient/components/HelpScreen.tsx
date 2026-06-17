import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet,
  Linking, Platform, ScrollView, KeyboardAvoidingView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { API } from '../config/apiConfig';

const COLORS = {
  cream: '#F2EDE2',
  creamDark: '#E8E0D0',
  green: '#4A7C4E',
  greenLight: '#EAF2EB',
  orange: '#E07B39',
  text: '#1C1C1A',
  textMuted: '#7A7570',
  textLight: '#ADA89F',
  white: '#FFFFFF',
};

type Mode = 'menu' | 'issue' | 'feedback' | 'disclaimers' | 'success';

interface Props {
  onClose?: () => void;
  userEmail?: string | null;
  onSignOut?: () => void;
}

const DISCLAIMER_TEXT = `The information provided in this app, including but not limited to allergen details, dietary suggestions, and ingredient recommendations, is for informational purposes only and is not intended as medical advice, diagnosis, or treatment.

While we make reasonable efforts to provide accurate and up-to-date information, we cannot guarantee that all allergen, ingredient, or dietary information is complete, reliable, or error-free. Food products and restaurant offerings may change at any time without notice.

Users should not rely solely on this app to make decisions regarding allergies, intolerances, or other medical conditions. Always consult a qualified healthcare professional for personalized medical advice and guidance regarding your specific health or dietary needs.

By using this app, you acknowledge and agree that:

  1. You assume full responsibility for any decisions or actions taken based on the information provided.

  2. ANOMO and its affiliates, partners, and contributors are not liable for any errors, omissions, misinterpretations, or consequences resulting from the use of this app.

  3. You release and hold harmless ANOMO from any and all claims, damages, or liability, whether direct or indirect, arising from your reliance on the app or the information contained within it.

If you have or suspect you may have a medical condition, seek immediate advice from a licensed healthcare professional. Never delay, disregard, or avoid seeking medical advice because of something you read in this app.`;

export default function HelpScreen({ onClose, userEmail, onSignOut }: Props) {
  const [mode, setMode] = useState<Mode>('menu');
  const [text, setText] = useState('');
  const [email, setEmail] = useState(userEmail ?? '');
  const [emailError, setEmailError] = useState(false);
  const [submitError, setSubmitError] = useState(false);

  const submitToBackend = async () => {
    setSubmitError(false);
    try {
      await fetch(API.updateUsers, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, type: mode, content: text }),
      });
      setMode('success');
    } catch {
      setSubmitError(true);
    }
  };

  const openEmail = () => {
    Linking.openURL(
      `mailto:ankitthakur78701@gmail.com?subject=${encodeURIComponent('Inquiry for ANOMO team')}`
    );
  };

  const validateEmail = () => {
    if (!email || email.trim() === '') { setEmailError(false); return; }
    const ok = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email.toLowerCase());
    setEmailError(!ok);
  };

  const handleBack = () => {
    if (mode === 'menu' || mode === 'success') {
      onClose?.();
    } else {
      setMode('menu');
    }
  };

  const resetForm = () => {
    setText('');
    setEmail('');
    setEmailError(false);
    setSubmitError(false);
    setMode('menu');
  };

  const MENU_ITEMS = [
    { key: 'issue',       icon: 'bug-report',   label: 'Report an Issue',   accent: COLORS.orange },
    { key: 'feedback',    icon: 'rate-review',   label: 'Provide Feedback',  accent: COLORS.green  },
    { key: 'contact',     icon: 'email',         label: 'Contact the Team',  accent: COLORS.green  },
    { key: 'disclaimers', icon: 'info-outline',  label: 'Disclaimers',       accent: COLORS.textMuted },
    { key: 'signout',     icon: 'logout',        label: 'Sign Out',          accent: COLORS.red    },
  ] as const;

  const titleMap: Partial<Record<Mode, string>> = {
    menu:        'Help & Support',
    issue:       'Report an Issue',
    feedback:    'Provide Feedback',
    disclaimers: 'Disclaimers',
  };

  return (
    <View style={styles.overlay}>
      {/* Header */}
      {mode !== 'success' && (
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={handleBack} activeOpacity={0.7}>
            <Icon name="keyboard-arrow-left" size={20} color={COLORS.text} />
            <Text style={styles.backBtnText}>{mode === 'menu' ? 'Home' : 'Back'}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{titleMap[mode] ?? ''}</Text>
          {/* spacer to centre title */}
          <View style={{ width: 72 }} />
        </View>
      )}

      {/* ── Menu ── */}
      {mode === 'menu' && (
        <ScrollView contentContainerStyle={styles.menuContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionLabel}>How can we help you today?</Text>

          {MENU_ITEMS.map(item => (
            <TouchableOpacity
              key={item.key}
              style={styles.card}
              activeOpacity={0.75}
              onPress={() => {
                if (item.key === 'contact') openEmail();
                else if (item.key === 'signout') onSignOut?.();
                else setMode(item.key as Mode);
              }}
            >
              <View style={[styles.iconBadge, { backgroundColor: item.accent + '1A' }]}>
                <Icon name={item.icon} size={20} color={item.accent} />
              </View>
              <Text style={styles.cardLabel}>{item.label}</Text>
              <Icon
                name={item.key === 'contact' ? 'open-in-new' : 'chevron-right'}
                size={item.key === 'contact' ? 16 : 20}
                color={COLORS.textLight}
              />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* ── Issue / Feedback form ── */}
      {(mode === 'issue' || mode === 'feedback') && (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={styles.formContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.formHint}>
              {mode === 'issue' 
                ? 'Let us know what went wrong and we\'ll look into it.'
                : 'We\'d love to hear your thoughts or suggestions.'}
            </Text>

            <Text style={styles.fieldLabel}>
              Email <Text style={styles.optional}>(optional)</Text>
            </Text>
            {emailError && (
              <Text style={styles.errorText}>Please enter a valid email address.</Text>
            )}
            <TextInput
              style={styles.input}
              placeholder="your@email.com"
              placeholderTextColor={COLORS.textLight}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
              onBlur={validateEmail}
            />

            <Text style={styles.fieldLabel}>Message</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              placeholder={
                mode === 'issue'
                  ? 'Describe the issue you encountered…'
                  : 'Share your thoughts or suggestions…'
              }
              placeholderTextColor={COLORS.textLight}
              multiline
              value={text}
              onChangeText={setText}
              textAlignVertical="top"
            />

            {submitError && (
              <Text style={styles.errorText}>
                Something went wrong. Please try again.
              </Text>
            )}

            <TouchableOpacity
              style={[styles.submitBtn, !text.trim() && styles.submitBtnDisabled]}
              onPress={submitToBackend}
              disabled={!text.trim()}
              activeOpacity={0.8}
            >
              <Text style={styles.submitBtnText}>Submit</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      {/* ── Disclaimers ── */}
      {mode === 'disclaimers' && (
        <ScrollView
          contentContainerStyle={styles.disclaimerContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.disclaimerText}>{DISCLAIMER_TEXT}</Text>
        </ScrollView>
      )}

      {/* ── Success ── */}
      {mode === 'success' && (
        <View style={styles.successContainer}>
          <View style={styles.successIconBg}>
            <Icon name="check" size={38} color={COLORS.green} />
          </View>
          <Text style={styles.successTitle}>Thank you!</Text>
          <Text style={styles.successBody}>
            Your submission has been received. We'll look into it and follow up if needed.
          </Text>
          <TouchableOpacity style={styles.doneBtn} onPress={resetForm} activeOpacity={0.8}>
            <Text style={styles.doneBtnText}>Back to Help</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.dismissText}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.cream,
    zIndex: 200,
    paddingTop: Platform.OS === 'ios' ? 54 : 24,
  },

  // Header
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
    textAlign: 'center',
  },

  // Menu
  menuContent: {
    padding: 20,
    paddingTop: 24,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 16,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
    gap: 14,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 1,
  },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },

  // Form
  formContent: {
    padding: 20,
    paddingTop: 24,
  },
  formHint: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginBottom: 24,
    lineHeight: 20,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginBottom: 6,
  },
  optional: {
    fontWeight: '400',
    color: COLORS.textLight,
  },
  errorText: {
    fontSize: 12,
    color: '#C94A3A',
    marginBottom: 4,
  },
  input: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.creamDark,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.text,
    marginBottom: 18,
  },
  textarea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  submitBtn: {
    backgroundColor: COLORS.green,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  submitBtnDisabled: {
    opacity: 0.4,
  },
  submitBtnText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '700',
  },

  // Disclaimers
  disclaimerContent: {
    padding: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },
  disclaimerText: {
    fontSize: 14,
    lineHeight: 22,
    color: COLORS.textMuted,
  },

  // Success
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  successIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.greenLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
  },
  successBody: {
    fontSize: 15,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  doneBtn: {
    backgroundColor: COLORS.green,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: 'center',
    marginTop: 8,
    alignSelf: 'stretch',
  },
  doneBtnText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '700',
  },
  dismissText: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: 4,
  },
});
