import React, { useState, useRef, useEffect } from 'react';
import {
  Animated, View, Text, TextInput, StyleSheet,
  Modal, Pressable, TouchableOpacity, Easing,
  Platform, ScrollView, ActivityIndicator, KeyboardAvoidingView,
} from 'react-native';
import axios from 'axios';
import { API } from '../config/apiConfig';

// ── Types ─────────────────────────────────────────────────────────────────────────────

type SheetState = 'scanning' | 'found' | 'not_found' | 'submitted';
type MenuType   = 'dinner' | 'brunch' | 'lunch' | 'drinks' | 'all-day' | 'menu';

interface MenuLink {
  type:       MenuType;
  url:        string;
  confidence: number;
}

export interface DiscoveryParams {
  restaurantId: string;
  name:         string;
  address:      string;
  website?:     string;
  userId?:      string;
}

interface Props {
  params:       DiscoveryParams;
  onClose:      () => void;
  onSubmitted?: () => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────────────

const C = {
  cream:     '#F2EDE2',
  white:     '#FFFFFF',
  green:     '#4A7C4E',
  greenLight:'#EAF2EB',
  orange:    '#E07B39',
  red:       '#C94A3A',
  text:      '#1C1C1A',
  textMuted: '#7A7570',
  textLight: '#ADA89F',
  border:    '#E0D8CC',
};

const GET_MENU_URL = API.getMenu;
const ANALYZE_URL  = API.analyzeMenu;

// ── Helpers ───────────────────────────────────────────────────────────────────────────

function inferMenuType(url: string): MenuType {
  const u = url.toLowerCase();
  if (u.includes('dinner'))    return 'dinner';
  if (u.includes('brunch'))    return 'brunch';
  if (u.includes('lunch'))     return 'lunch';
  if (u.includes('drink'))     return 'drinks';
  if (u.includes('breakfast')) return 'all-day';
  return 'menu';
}

function truncateUrl(url: string, max = 42): string {
  try {
    const { hostname, pathname } = new URL(url);
    const s = hostname + pathname;
    return s.length > max ? s.slice(0, max - 1) + '…' : s;
  } catch {
    return url.length > max ? url.slice(0, max - 1) + '…' : url;
  }
}

const cap         = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const menuTypeLabel = (type: string) => type === 'menu' ? 'Menu' : `${cap(type)} menu`;

// ── Component ───────────────────────────────────────────────────────────────────────────

const MenuDiscoverySheet: React.FC<Props> = ({ params, onClose, onSubmitted }) => {
  const [state,          setState]          = useState<SheetState>('scanning');
  const [links,          setLinks]          = useState<MenuLink[]>([]);
  const [selectedIdx,    setSelectedIdx]    = useState(0);
  const [manualVisible,  setManualVisible]  = useState(false);
  const [manualUrl,      setManualUrl]      = useState('');
  const [manualError,    setManualError]    = useState(false);

  const slideAnim = useRef(new Animated.Value(0)).current;

  // Open sheet + kick off discovery on mount
  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: 1, duration: 320,
      easing: Easing.out(Easing.exp),
      useNativeDriver: true,
    }).start();

    discoverMenu();
  }, []);

  const dismissSheet = () => {
    Animated.timing(slideAnim, {
      toValue: 0, duration: 260,
      easing: Easing.in(Easing.exp),
      useNativeDriver: true,
    }).start(() => onClose());
  };

  // ── Discovery call ──────────────────────────────────────────────────────────────

  const discoverMenu = async () => {
    try {
      const res = await axios.post(GET_MENU_URL, {
        place_id: params.restaurantId,
        name:     params.name,
        address:  params.address,
        website:  params.website ?? '',
      });
      const data = res.data;
      if (data?.is_menu) {
        const raw: { url: string; confidence: number }[] =
          Array.isArray(data.links) && data.links.length > 0
            ? data.links
            : [{ url: data.link, confidence: 1 }];
        setLinks(raw.map(l => ({ type: inferMenuType(l.url), url: l.url, confidence: l.confidence ?? 1 })));
        setSelectedIdx(0);
        setState('found');
      } else {
        setState('not_found');
      }
    } catch {
      setState('not_found');
    }
  };

  // ── Submit ─────────────────────────────────────────────────────────────────────────────

  const handleConfirm = async () => {
    const chosen = (state === 'not_found' || manualVisible)
      ? { type: 'menu' as MenuType, url: manualUrl }
      : links[selectedIdx];
    if (!chosen?.url) return;

    console.log('Submitting menu for analysis:', chosen.url);

    try {
      await axios.post(ANALYZE_URL, {
        place_id:  params.restaurantId,
        name:      params.name,
        address:   params.address,
        email:     '',
        addToList: false,
        menu_url:  chosen.url,
        userId:    params.userId ?? '',
      });
    } catch (e) {
      console.error('[MenuDiscoverySheet] submit error:', e);
    }

    setState('submitted');
    onSubmitted?.();
    setTimeout(dismissSheet, 1800);
  };

  const validateManualUrl = () => {
    try {
      const { protocol } = new URL(manualUrl);
      setManualError(protocol !== 'http:' && protocol !== 'https:');
    } catch {
      setManualError(true);
    }
  };

  // ── Derived ─────────────────────────────────────────────────────────────────────────────

  const translateY   = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [640, 0] });
  // not_found has no radio list — always validate the manual URL field directly
  const confirmReady = (state === 'not_found' || manualVisible)
    ? (!!manualUrl && !manualError)
    : links.length > 0;
  const ctaLabel     = () => {
    if (state === 'submitted') return '✓ Submitted';
    const type = manualVisible ? 'menu' : (links[selectedIdx]?.type ?? 'menu');
    return `Analyze ${menuTypeLabel(type).toLowerCase()} →`;
  };

  // ── Sub-renders ───────────────────────────────────────────────────────────────────────────

  const RestaurantRow = () => (
    <View style={s.restRow}>
      <View style={s.restIcon}><Text style={s.restEmoji}>🍽</Text></View>
      <View style={s.restInfo}>
        <Text style={s.restName}>{params.name}</Text>
        <Text style={s.restAddr} numberOfLines={1}>
          {state === 'scanning'
            ? params.address
            : links.length > 0
              ? `${links.length} menu${links.length !== 1 ? 's' : ''} found — pick one to analyze`
              : 'No menu found automatically'}
        </Text>
      </View>
    </View>
  );

  const ScanningView = () => (
    <View style={s.scanningWrap}>
      <ActivityIndicator size="large" color={C.green} />
      <Text style={s.statusText}>Finding menu…</Text>
    </View>
  );

  const FoundView = () => (
    <>
      <Text style={s.sectionLabel}>Found menus</Text>

      {links.map((link, i) => {
        const sel = !manualVisible && selectedIdx === i;
        return (
          <TouchableOpacity
            key={i}
            style={[s.linkRow, sel && s.linkRowSel]}
            onPress={() => { setSelectedIdx(i); setManualVisible(false); }}
            activeOpacity={0.75}
          >
            <View style={[s.radio, sel && s.radioSel]}>
              {sel && <View style={s.radioDot} />}
            </View>
            <View style={s.linkMeta}>
              <Text style={s.linkType}>{menuTypeLabel(link.type)}</Text>
              <Text style={s.linkUrl} numberOfLines={1}>{truncateUrl(link.url)}</Text>
            </View>
            {i === 0 && (
              <View style={s.badge}><Text style={s.badgeText}>Best match</Text></View>
            )}
          </TouchableOpacity>
        );
      })}

      <TouchableOpacity
        style={s.manualToggle}
        onPress={() => { setManualVisible(!manualVisible); if (!manualVisible) setSelectedIdx(-1); }}
      >
        <Text style={s.manualToggleText}>
          {manualVisible ? '← Back to found links' : '+ Paste a different link'}
        </Text>
      </TouchableOpacity>

      {manualVisible && <UrlInput />}
    </>
  );

  const NotFoundView = () => (
    <>
      <Text style={s.notFoundMsg}>
        We couldn't automatically find a menu link. Paste one below:
      </Text>
      <UrlInput />
    </>
  );

  const UrlInput = () => (
    <View>
      {manualError && <Text style={s.inputError}>Enter a valid http(s) URL</Text>}
      <TextInput
        style={s.urlInput}
        value={manualUrl}
        onChangeText={setManualUrl}
        onBlur={validateManualUrl}
        placeholder="https://restaurant.com/menu"
        placeholderTextColor={C.textLight}
        autoCapitalize="none"
        keyboardType="url"
      />
    </View>
  );

  const SubmittedView = () => (
    <View style={s.submittedWrap}>
      <Text style={s.submittedIcon}>✓</Text>
      <Text style={s.submittedMsg}>
        Analyzing menu — we'll let you know when done.
      </Text>
    </View>
  );

  // ── Render ─────────────────────────────────────────────────────────────────────────────

  return (
    <Modal transparent visible animationType="none">
      <KeyboardAvoidingView
        style={s.modalRoot}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={s.overlay} onPress={dismissSheet} />
        <Animated.View style={[s.sheet, { transform: [{ translateY }] }]}>
          <View style={s.handle} />
          <ScrollView
            contentContainerStyle={s.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <RestaurantRow />

            {state === 'scanning'  && <ScanningView />}
            {state === 'found'     && <FoundView />}
            {state === 'not_found' && <NotFoundView />}
            {state === 'submitted' && <SubmittedView />}

            {(state === 'found' || state === 'not_found') && (
              <TouchableOpacity
                style={[s.cta, !confirmReady && s.ctaDisabled]}
                onPress={handleConfirm}
                disabled={!confirmReady}
                activeOpacity={0.85}
              >
                <Text style={s.ctaText}>{ctaLabel()}</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ── Styles ─────────────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: C.cream,
    maxHeight: '84%',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: -4 },
    shadowRadius: 20,
    elevation: 10,
  },
  handle: {
    width: 40, height: 4,
    borderRadius: 2,
    backgroundColor: C.border,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 2,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 44 : 28,
  },
  restRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  restIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: C.greenLight,
    justifyContent: 'center', alignItems: 'center',
  },
  restEmoji: { fontSize: 22 },
  restInfo:  { flex: 1 },
  restName: {
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
    color: C.text,
    marginBottom: 2,
  },
  restAddr: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: C.textMuted,
  },
  scanningWrap: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 16,
  },
  statusText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: C.textMuted,
  },
  sectionLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    color: C.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    gap: 12,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  linkRowSel: {
    borderColor: C.green,
    backgroundColor: C.greenLight,
  },
  radio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2,
    borderColor: C.textLight,
    justifyContent: 'center', alignItems: 'center',
  },
  radioSel:  { borderColor: C.green },
  radioDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: C.green,
  },
  linkMeta: { flex: 1 },
  linkType: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    color: C.text,
    marginBottom: 2,
  },
  linkUrl: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: C.textMuted,
  },
  badge: {
    backgroundColor: C.orange,
    borderRadius: 28,
    paddingVertical: 3,
    paddingHorizontal: 9,
  },
  badgeText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    color: C.white,
  },
  manualToggle: {
    paddingVertical: 8,
    marginBottom: 8,
  },
  manualToggleText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: C.orange,
    textDecorationLine: 'underline',
  },
  urlInput: {
    backgroundColor: C.white,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 14,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: C.text,
    borderWidth: 1.5,
    borderColor: C.border,
  },
  inputError: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: C.red,
    marginBottom: 4,
  },
  notFoundMsg: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: C.textMuted,
    lineHeight: 21,
    marginBottom: 14,
  },
  submittedWrap: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 12,
  },
  submittedIcon: {
    fontSize: 40,
    color: C.green,
  },
  submittedMsg: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: C.textMuted,
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 260,
  },
  cta: {
    marginTop: 20,
    backgroundColor: C.green,
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaDisabled: { opacity: 0.4 },
  ctaText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    color: C.white,
    letterSpacing: 0.2,
  },
});

export default MenuDiscoverySheet;
