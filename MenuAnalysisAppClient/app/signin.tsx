import React, { useContext, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Image, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { AuthContext } from '../context/AuthContext';
import { useRouter } from 'expo-router';

const C = {
  bg:        '#2A1F14',
  bgCard:    '#242420',
  cream:     '#F2EDE2',
  brownLight: '#9E8E7E',
  creamDim:  '#C8C0B0',
  creamMute: '#7A7570',
  green:     '#4A7C4E',
  greenDark: '#3A6340',
  greenGlow: 'rgba(74,124,78,0.22)',
  divider:   '#2E2E2A',
};

const FEATURES = [
  { emoji: '🌾', label: 'Scan any menu for your allergens or dietary preferences' },
  { emoji: '✓',  label: 'Know instantly what\'s safe to eat' },
  { emoji: '🍽',  label: 'Discover restaurants tailored to you' },
];

export default function SignInScreen() {
  const { signIn } = useContext(AuthContext);
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    setLoading(true);
    try {
      await signIn();
      router.replace('/home');
    } catch (e: any) {
      console.error('Sign in failed:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      {/* <LinearGradient
        colors={['#2A2820', '#1A1A16', '#111110']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      /> */}

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>

        {/* ── Top: logo + wordmark ── */}
        <View style={styles.brandSection}>
          <View style={styles.logoRing}>
            <Image
              source={require('../assets/images/anomo-logo-2.png')}
              style={styles.logoImg}
              resizeMode="stretch"
            />
          </View>
          <Text style={styles.wordmark}>anomo</Text>
          <Text style={styles.tagline}>Eat safely, with confidence.{'\n'}Know what's in your food.</Text>
        </View>

        {/* ── Middle: feature highlights ── */}
        <View style={styles.featuresCard}>
          {FEATURES.map((f, i) => (
            <React.Fragment key={f.label}>
              <View style={styles.featureRow}>
                <View style={styles.featureIconWrap}>
                  <Text style={styles.featureIcon}>{f.emoji}</Text>
                </View>
                <Text style={styles.featureText}>{f.label}</Text>
              </View>
              {i < FEATURES.length - 1 && <View style={styles.featureDivider} />}
            </React.Fragment>
          ))}
        </View>

        {/* ── Bottom: CTA ── */}
        <View style={styles.ctaSection}>
          <TouchableOpacity
            style={[styles.ctaBtn, loading && styles.ctaBtnLoading]}
            onPress={handleSignIn}
            activeOpacity={0.85}
            disabled={loading}
          >
            <LinearGradient
              colors={[C.green, C.greenDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.ctaGradient}
            >
              {loading ? (
                <ActivityIndicator color={C.cream} size="small" />
              ) : (
                <Text style={styles.ctaLabel}>Continue</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <Text style={styles.footerNote}>
            New here? Your account is created on first sign in.
          </Text>
        </View>

      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.cream,
  },
  safe: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'space-between',
    paddingTop: 24,
    paddingBottom: 16,
  },

  // Brand
  brandSection: {
    alignItems: 'center',
    paddingTop: 20,
  },
  logoRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: C.bgCard,
    borderWidth: 1.5,
    borderColor: '#3A3A34',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: C.green,
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 20,
    elevation: 6,
  },
  logoImg: {
    borderRadius: 0.5,
    width: 52,
    height: 52,
  },
  wordmark: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 75,
    color: C.bg,
    letterSpacing: -0.02,
    marginBottom: 14,
  },
  tagline: {
    fontFamily: 'Inter_400Regular',
    fontSize: 17,
    color: C.brownLight,
    textAlign: 'center',
    lineHeight: 26,
  },

  // Features card
  featuresCard: {
    backgroundColor: C.bgCard,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2E2E2A',
    paddingVertical: 6,
    paddingHorizontal: 20,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 14,
  },
  featureIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: C.greenGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureIcon: {
    fontSize: 16,
  },
  featureText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: C.creamDim,
    flex: 1,
    lineHeight: 20,
  },
  featureDivider: {
    height: 1,
    backgroundColor: C.divider,
  },

  // CTA
  ctaSection: {
    alignItems: 'center',
    gap: 14,
  },
  ctaBtn: {
    width: '100%',
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: C.green,
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 18,
    elevation: 6,
  },
  ctaBtnLoading: {
    opacity: 0.7,
  },
  ctaGradient: {
    paddingVertical: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    color: C.cream,
    letterSpacing: 0.4,
  },
  footerNote: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: C.creamMute,
    textAlign: 'center',
  },
});
