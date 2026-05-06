import React, { useState, useEffect } from 'react';
import {
  View, Text, Image, StyleSheet, TouchableOpacity,
  ActivityIndicator, Platform, SectionList,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import FilterDropdownComponent from './FilterDropdownComponent';
import { API } from '../config/apiConfig';

const COLORS = {
  cream: '#F2EDE2',
  creamDark: '#E6DFD0',
  green: '#4A7C4E',
  greenLight: '#EAF2EB',
  greenMid: '#B8D9BB',
  red: '#C94A3A',
  redLight: '#FDECEA',
  redMid: '#EDADA6',
  yellow: '#B88B0A',
  yellowLight: '#FDF4DC',
  yellowMid: '#E0C46A',
  text: '#1C1C1A',
  textMuted: '#7A7570',
  textLight: '#ADA89F',
  white: '#FFFFFF',
};

const ALLERGEN_LABEL: Record<string, string> = {
  dairy: 'Dairy', egg: 'Eggs', peanut: 'Peanuts',
  tree_nut: 'Tree Nuts', soy: 'Soy', sesame: 'Sesame',
  wheat: 'Wheat', fish: 'Fish', shellfish: 'Shellfish', mustard: 'Mustard',
};

const ALLERGEN_EMOJI: Record<string, string> = {
  dairy: '🥛', egg: '🥚', peanut: '🥜', tree_nut: '🥜',
  soy: '🫘', sesame: '🌿', wheat: '🌾', fish: '🐟',
  shellfish: '🦐', mustard: '🌼',
};

const DIET_LABEL: Record<string, string> = {
  vegetarian: 'Vegetarian', vegan: 'Vegan', gluten_free: 'Gluten-free',
  halal: 'Halal', kosher: 'Kosher', nut_free: 'Nut-free',
  dairy_free: 'Dairy-free', egg_free: 'Egg-free',
};

type Classification = 'safe' | 'caution' | 'unsafe';
type TabKey = 'all' | 'safe' | 'caution' | 'unsafe';

interface ScoredDish {
  name: string;
  price?: string;
  category?: string;
  ingredients?: string[] | string;
  allergens?: Record<string, number> | string[];
  diet_restrictions?: Record<string, number> | string[];
  classification?: Classification;
  imageUrl?: string;
  _class: Classification;
}

interface SafetyScore {
  score_pct: number;
  safe_count: number;
  caution_count: number;
  unsafe_count: number;
  total_dishes: number;
}

export interface DetailRestaurant {
  restaurantId: string;
  name: string;
  address: string;
  heroImage: string;
  images?: string[];
  safety_score?: SafetyScore;
}

interface Props {
  restaurant: DetailRestaurant;
  userId?: string | null;
  selectedAllergens: string[];
  selectedDiets: string[];
  onClose: () => void;
  onFiltersChange?: (allergens: string[], dietaryRestrictions: string[]) => void;
  isSaved?: boolean;
  onToggleSave?: () => void;
}

const GET_MENU_ITEMS = API.getMenuItems;

function getMaxConf(data: Record<string, number> | string[] | undefined | null, keys: string[]): number {
  if (!data || keys.length === 0) return 0;
  if (Array.isArray(data)) return keys.some(k => data.includes(k)) ? 1 : 0;
  const map = data as Record<string, number>;
  return Math.max(0, ...keys.map(k => map[k] ?? 0));
}

function classifyDish(dish: any, allergens: string[], diets: string[]): Classification {
  const ac = getMaxConf(dish.allergens, allergens);
  const dc = getMaxConf(dish.diet_restrictions, diets);
  if (ac >= 0.7 || dc >= 0.7) return 'unsafe';
  if (ac >= 0.5 || dc >= 0.5) return 'caution';
  return 'safe';
}

export default function MenuDetailScreen({ restaurant, userId, selectedAllergens, selectedDiets, onClose, onFiltersChange, isSaved = false, onToggleSave }: Props) {
  const [dishes, setDishes] = useState<ScoredDish[]>([]);
  const [safetyScore, setSafetyScore] = useState<SafetyScore | undefined>(restaurant.safety_score);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('safe');

  // Local copies of filters — updated when the user saves from the sheet on this screen
  const [localAllergens, setLocalAllergens] = useState<string[]>(selectedAllergens);
  const [localDiets,     setLocalDiets]     = useState<string[]>(selectedDiets);

  const handleFiltersChange = (prefs: { allergens: string[]; dietaryRestrictions: string[] }) => {
    setLocalAllergens(prefs.allergens);
    setLocalDiets(prefs.dietaryRestrictions);

    // Re-classify against the current dishes snapshot (handleFiltersChange is recreated
    // each render so `dishes` here is always the latest value, not a stale closure).
    const reclassified = dishes.map(d => ({
      ...d,
      _class: classifyDish(d, prefs.allergens, prefs.dietaryRestrictions),
    }));
    setDishes(reclassified);

    const safeCount    = reclassified.filter(d => d._class === 'safe').length;
    const cautionCount = reclassified.filter(d => d._class === 'caution').length;
    const unsafeCount  = reclassified.filter(d => d._class === 'unsafe').length;
    const total        = reclassified.length;
    setSafetyScore({
      score_pct:     total > 0 ? Math.round(safeCount / total * 100) : 0,
      safe_count:    safeCount,
      caution_count: cautionCount,
      unsafe_count:  unsafeCount,
      total_dishes:  total,
    });

    // Propagate up so HomeScreenV2 keeps its filter state in sync
    onFiltersChange?.(prefs.allergens, prefs.dietaryRestrictions);
  };

  useEffect(() => {
    (async () => {
      try {
        const body: any = { placeId: restaurant.restaurantId };
        if (userId) body.userId = userId;
        const res = await axios.post(GET_MENU_ITEMS, body);
        const raw = res.data?.dishes ?? res.data;
        const scored: ScoredDish[] = (Array.isArray(raw) ? raw : []).map((d: any) => ({
          ...d,
          _class: classifyDish(d, selectedAllergens, selectedDiets),
        }));
        setDishes(scored);
        if (res.data?.safety_score) setSafetyScore(res.data.safety_score);
      } catch (e) {
        console.error('[MenuDetail] fetch failed:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const byImage = (a: ScoredDish, b: ScoredDish) => (b.imageUrl ? 1 : 0) - (a.imageUrl ? 1 : 0);

  const safe    = dishes.filter(d => d._class === 'safe').sort(byImage);
  const caution = dishes.filter(d => d._class === 'caution').sort(byImage);
  const unsafe  = dishes.filter(d => d._class === 'unsafe').sort(byImage);

  const safeN    = safetyScore?.safe_count    ?? safe.length;
  const cautionN = safetyScore?.caution_count ?? caution.length;
  const unsafeN  = safetyScore?.unsafe_count  ?? unsafe.length;
  const totalN   = safetyScore?.total_dishes  ?? dishes.length;

  const scorePct = safetyScore?.score_pct ?? (dishes.length > 0 ? Math.round(safe.length / dishes.length * 100) : null);
  const scoreLabel = scorePct !== null ? (scorePct >= 80 ? 'safe' : scorePct >= 50 ? 'caution' : 'unsafe') : null;
  const scoreDotColor = scoreLabel === 'safe' ? COLORS.green : scoreLabel === 'caution' ? COLORS.yellow : COLORS.red;

  const tabConfig = [
    { key: 'all' as TabKey,     label: 'All',     count: dishes.length, color: COLORS.text,   bg: COLORS.creamDark  },
    { key: 'safe' as TabKey,    label: 'Safe',    count: safeN,         color: COLORS.green,  bg: COLORS.greenLight },
    { key: 'caution' as TabKey, label: 'Caution', count: cautionN,      color: COLORS.yellow, bg: COLORS.yellowLight },
    { key: 'unsafe' as TabKey,  label: 'Unsafe',  count: unsafeN,       color: COLORS.red,    bg: COLORS.redLight   },
  ];

  const sections = (() => {
    if (activeTab === 'all') {
      const all = [...dishes].sort(byImage);
      return [{ title: `${all.length} dishes`, data: all, type: 'all' as const }];
    }
    const list = activeTab === 'safe' ? safe : activeTab === 'caution' ? caution : unsafe;
    return [{ title: `${list.length} ${activeTab} dishes`, data: list, type: activeTab }];
  })();

  return (
    <View style={styles.screen}>
      {/* ── Hero ── */}
      <View style={styles.hero}>
        {restaurant.heroImage ? (
          <View style={styles.heroImage}>
            <Image
              source={{ uri: restaurant.heroImage }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.55)']}
              style={StyleSheet.absoluteFill}
            />
          </View>
          // <ImageBackground 
          //   source={{ uri: restaurant.heroImage }} 
          //   style={styles.heroImage} 
          //   // imageStyle={styles.imageStyle}
          //   >
          //   <LinearGradient
          //     colors={['transparent', 'rgba(0,0,0,0.5)']}
          //     style={StyleSheet.absoluteFill}
          //   />
          // </ImageBackground>
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.heroFallback]} />
        )}

        <TouchableOpacity style={styles.backBtn} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.backBtnIcon}>‹</Text>
        </TouchableOpacity>

        {onToggleSave && (
          <TouchableOpacity style={styles.bookmarkBtn} onPress={onToggleSave} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <MaterialIcons
              name={isSaved ? 'bookmark' : 'bookmark-border'}
              size={26}
              color={COLORS.white}
            />
          </TouchableOpacity>
        )}

        <View style={styles.heroContent}>
          <Text style={styles.heroName} numberOfLines={1}>{restaurant.name}</Text>
          <Text style={styles.heroAddress} numberOfLines={1}>{restaurant.address}</Text>

          {scorePct !== null && (
            <View style={styles.scoreBlock}>
              <View style={styles.scoreRingWrap}>
                <Text style={styles.scoreRingNumber}>{scorePct}%</Text>
              </View>
              <View style={styles.scoreTextWrap}>
                <Text style={styles.scoreHeadline}>
                  {scoreLabel === 'safe'
                    ? 'Safe for your profile'
                    : scoreLabel === 'caution'
                    ? 'Use caution'
                    : 'Unsafe for your profile'}
                </Text>
                <Text style={styles.scoreSub}>
                  {safeN} safe · {cautionN} caution · {unsafeN} unsafe
                </Text>
              </View>
            </View>
          )}
        </View>
      </View>

      {/* ── Profile strip ── */}
      <View style={styles.profileStrip}>
        <FilterDropdownComponent
          userPreferences={{ allergens: localAllergens, dietaryRestrictions: localDiets }}
          onFiltersChange={handleFiltersChange}
        />
      </View>

      {/* ── Filter tabs ── */}
      <View style={styles.filterTabs}>
        {tabConfig.map(tab => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.ftab, isActive && { borderBottomColor: tab.color }]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[styles.ftabText, { color: isActive ? tab.color : COLORS.textLight }]}>
                {tab.label}
                <Text style={styles.ftabCount}> {tab.count}</Text>
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Dish list ── */}
      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={COLORS.green} />
          <Text style={styles.loaderText}>Loading menu…</Text>
        </View>
      ) : dishes.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No menu items available.</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item, idx) => `${item.name}-${idx}`}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <Text style={[
              styles.sectionHeader,
              section.type === 'caution' && { color: COLORS.yellow },
              section.type === 'unsafe'  && { color: COLORS.red, opacity: 0.85 },
            ]}>
              {section.title}
            </Text>
          )}
          SectionSeparatorComponent={() => <View style={styles.groupSpacer} />}
          renderItem={({ item }) => (
            <DishCard dish={item} userAllergens={localAllergens} />
          )}
        />
      )}
    </View>
  );
}

const ALLERGEN_KEYWORDS: Record<string, string[]> = {
  dairy:     ['milk', 'butter', 'cream', 'cheese', 'yogurt', 'ghee', 'lactose', 'whey', 'paneer'],
  egg:       ['egg', 'eggs', 'albumin', 'mayonnaise'],
  peanut:    ['peanut', 'peanuts', 'groundnut'],
  tree_nut:  ['almond', 'walnut', 'cashew', 'hazelnut', 'pecan', 'pistachio', 'macadamia'],
  soy:       ['soy', 'soya', 'tofu', 'edamame', 'miso'],
  sesame:    ['sesame', 'tahini'],
  wheat:     ['wheat', 'flour', 'gluten', 'barley', 'rye'],
  fish:      ['fish', 'salmon', 'tuna', 'cod', 'anchovies', 'anchovy'],
  shellfish: ['shrimp', 'prawn', 'crab', 'lobster', 'scallop', 'oyster', 'clam'],
  mustard:   ['mustard'],
};

function IngredientText({ text, allergenKeys }: { text: string; allergenKeys: string[] }) {
  const keywords = allergenKeys.flatMap(k => ALLERGEN_KEYWORDS[k] ?? []);
  if (keywords.length === 0) return <Text style={styles.ingText}>{text}</Text>;
  const escaped  = keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const checkPat = new RegExp(`\\b(${escaped.join('|')})\\b`, 'i');
  const chunks   = text.split(/,\s*/);
  return (
    <Text style={styles.ingText}>
      {chunks.map((chunk, i) => (
        <Text key={i}>
          {checkPat.test(chunk) ? <Text style={styles.ingHighlight}>{chunk}</Text> : chunk}
          {i < chunks.length - 1 ? ', ' : ''}
        </Text>
      ))}
    </Text>
  );
}


function DishCard({ dish, userAllergens }: { dish: ScoredDish; userAllergens: string[] }) {
  const cls         = dish._class;
  const accentColor = cls === 'safe' ? COLORS.green : cls === 'caution' ? COLORS.yellow : COLORS.red;
  const secondaryColor = cls === 'safe' ? COLORS.greenLight : cls === 'caution' ? COLORS.yellowLight : COLORS.redLight;
  const pillLabel   = cls === 'safe' ? 'Safe' : cls === 'caution' ? 'Caution' : 'Unsafe';
  const labelColor   = cls === 'safe' ? COLORS.green : cls === 'caution' ? COLORS.yellow : COLORS.red;
  const noImgBg     = cls === 'safe' ? '#2D5A32' : cls === 'caution' ? '#7A5C00' : '#6B2418';

  const badges: { key: string; confidence: number }[] = [];
  if (dish.allergens) {
    if (Array.isArray(dish.allergens)) {
      userAllergens.forEach(k => {
        if ((dish.allergens as string[]).includes(k)) badges.push({ key: k, confidence: 1 });
      });
    } else {
      userAllergens.forEach(k => {
        const conf = (dish.allergens as Record<string, number>)[k] ?? 0;
        if (conf >= 0.5) badges.push({ key: k, confidence: conf });
      });
    }
  }

  const maxConf    = badges.length > 0 ? Math.max(...badges.map(b => b.confidence)) : 0;
  const filledPips = maxConf > 0 ? Math.max(1, Math.round(maxConf * 5)) : 0;
  const pipColor   = maxConf >= 0.7 ? COLORS.red : COLORS.yellow;

  const ingText =
    Array.isArray(dish.ingredients)
      ? dish.ingredients.join(', ')
      : typeof dish.ingredients === 'string'
      ? dish.ingredients
      : null;

  const formattedPrice = new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency: 'USD' 
  }).format(Number(dish.price) || 0);
  const subtitle = [formattedPrice, dish.category].filter(Boolean).join('   ·   ');

  return (
    <View style={styles.dishCardShadow}>
    <View style={styles.dishCard}>

      {/* ── Full-bleed image / colour header ── */}
      <View style={[styles.dishImgContainer, !dish.imageUrl && { backgroundColor: noImgBg }]}>
        {dish.imageUrl && (
          <Image source={{ uri: dish.imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        )}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.5)']}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.dishClassBadge, { backgroundColor: secondaryColor }]}>
          <View style={[styles.dishClassDot, { backgroundColor: accentColor }]} />
          <Text style={[styles.dishClassText, { color: labelColor }]}>{pillLabel}</Text>
        </View>
        <View style={styles.dishImgBottom}>
          <Text style={styles.dishImgName} numberOfLines={2}>{dish.name}</Text>
          {subtitle ? <Text style={styles.dishImgSub} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
      </View>

      {/* ── Info panel ── */}
      <View style={styles.dishPanel}>
        {ingText ? (
          <>
            <Text style={styles.ingLabel}>INGREDIENTS</Text>
            <IngredientText text={ingText} allergenKeys={badges.map(b => b.key)} />
          </>
        ) : null}

        {ingText && badges.length > 0 ? <View style={styles.dishDivider} /> : null}

        {badges.length > 0 ? (
          <View style={styles.dishFooter}>
            <View style={styles.badgeRow}>
              {badges.map(b => (
                <View key={b.key} style={[styles.badge, b.confidence >= 0.7 ? styles.badgeDetected : styles.badgeCaution]}>
                  <View style={[styles.badgeDot, { backgroundColor: b.confidence >= 0.7 ? COLORS.red : COLORS.yellow }]} />
                  <Text style={[styles.badgeText, { color: b.confidence >= 0.7 ? COLORS.red : COLORS.yellow }]}>
                    {ALLERGEN_LABEL[b.key] ?? b.key}{b.confidence < 1 ? ` · ${Math.round(b.confidence * 100)}%` : ''}
                  </Text>
                </View>
              ))}
            </View>
            {maxConf > 0 ? (
              <View style={styles.confCol}>
                <Text style={styles.confLabel}>Confidence</Text>
                <View style={styles.pips}>
                  {[1, 2, 3, 4, 5].map(i => (
                    <View key={i} style={[styles.pip, i <= filledPips && { backgroundColor: pipColor }]} />
                  ))}
                </View>
                <Text style={styles.confPct}>{Math.round(maxConf * 100)}%</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>

    </View>
    </View>
  );
}

const HERO_HEIGHT = Platform.OS === 'ios' ? 220 : 200;
const BACK_BTN_TOP = Platform.OS === 'ios' ? 54 : 32;

const styles = StyleSheet.create({
  screen: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.cream,
    zIndex: 100,
  },

  // Hero
  hero: {
    height: HERO_HEIGHT,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: COLORS.green,
  },
  heroFallback: {
    backgroundColor: '#3A6340',
  },
  heroImage: {
    // width: '100%',
    // height: '100%',
    justifyContent: 'flex-end',
    padding: 12,
    flex: 1
  },
  backBtn: {
    position: 'absolute',
    top: BACK_BTN_TOP,
    left: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  backBtnIcon: {
    color: COLORS.white,
    fontSize: 28,
    fontWeight: '600',
    lineHeight: 32,
    includeFontPadding: false,
  },
  bookmarkBtn: {
    position: 'absolute',
    top: BACK_BTN_TOP,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  heroContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 18,
    zIndex: 5,
  },
  heroName: {
    fontSize: 26,
    fontFamily: 'Fraunces_700Bold',
    // fontWeight: '700',
    color: COLORS.white,
    marginBottom: 3,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  heroAddress: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.72)',
    marginBottom: 10,
  },
  // Score block in hero
  scoreBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  scoreRingWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  scoreRingNumber: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '700',
  },
  scoreTextWrap: {
    flex: 1,
  },
  scoreHeadline: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.white,
    lineHeight: 18,
    marginBottom: 3,
  },
  scoreSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.65)',
  },

  // Profile strip
  profileStrip: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.creamDark,
  },

  // Filter tabs
  filterTabs: {
    backgroundColor: COLORS.white,
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.creamDark,
  },
  ftab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderBottomWidth: 2.5,
    borderBottomColor: 'transparent',
  },
  ftabText: {
    fontSize: 12,
    fontWeight: '600',
  },
  ftabCount: {
    fontSize: 10,
    fontWeight: '500',
    opacity: 0.6,
  },

  // States
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loaderText: {
    color: COLORS.textMuted,
    fontSize: 14,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: 14,
  },

  // List
  listContent: {
    paddingBottom: 40,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: COLORS.textMuted,
    backgroundColor: COLORS.cream,
  },
  groupSpacer: {
    height: 4,
    backgroundColor: COLORS.creamDark,
    marginVertical: 4,
  },

  // Dish card — Variation C
  dishCardShadow: {
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 3,
  },
  dishCard: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  // Image header — used for both with-image and colour-fallback variants
  dishImgContainer: {
    height: 200,
    position: 'relative',
    backgroundColor: '#1a1814',
    overflow: 'hidden',
  },
  // // Classification badge — top-right dark pill
  dishClassBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 4,
  },
  dishClassDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dishClassText: {
    fontSize: 12,
    fontWeight: '700',
  },
  dishImgBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 14,
  },
  dishImgName: {
    fontSize: 22,
    // fontWeight: '700',
    fontFamily: 'Fraunces_700Bold',
    color: COLORS.white,
    lineHeight: 26,
  },
  dishImgSub: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.70)',
    marginTop: 3,
  },

  // White info panel
  dishPanel: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    paddingTop: 13,
    paddingBottom: 14,
  },
  ingLabel: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: COLORS.textLight,
    marginBottom: 4,
  },
  ingText: {
    fontSize: 12,
    color: COLORS.textMuted,
    lineHeight: 18,
  },
  ingHighlight: {
    color: '#C87000',
    fontWeight: '700',
  },
  dishDivider: {
    height: 1,
    backgroundColor: COLORS.creamDark,
    marginVertical: 10,
  },
  dishFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  badgeRow: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 8,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  badgeDetected: {
    backgroundColor: COLORS.redLight,
    borderWidth: 1,
    borderColor: COLORS.redMid,
  },
  badgeCaution: {
    backgroundColor: COLORS.yellowLight,
    borderWidth: 1,
    borderColor: COLORS.yellowMid,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  confCol: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 3,
    flexShrink: 0,
  },
  confLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: COLORS.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  confPct: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    textAlign: 'right',
  },
  pips: {
    flexDirection: 'row',
    gap: 2,
  },
  pip: {
    width: 13,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.creamDark,
  },
});
