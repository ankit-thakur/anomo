import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

const COLORS = {
  cream: '#F2EDE2',
  creamDark: '#E6DFD0',
  green: '#4A7C4E',
  greenLight: '#EAF2EB',
  greenMid: '#B8D9BB',
  red: '#C94A3A',
  redLight: '#FDECEA',
  redMid: '#EDADA6',
  yellow: '#C8960C',
  yellowLight: '#FDF4DC',
  yellowMid: '#EDD594',
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

const ALLERGEN_KEYWORDS: Record<string, string[]> = {
  dairy:     ['milk', 'butter', 'cream', 'cheese', 'yogurt', 'ghee', 'whey', 'casein', 'lactose', 'dairy'],
  egg:       ['egg', 'eggs', 'albumin', 'mayo', 'mayonnaise'],
  peanut:    ['peanut', 'peanuts', 'groundnut'],
  tree_nut:  ['almond', 'cashew', 'walnut', 'pecan', 'pistachio', 'hazelnut', 'macadamia', 'pine nut'],
  soy:       ['soy', 'soya', 'tofu', 'edamame', 'miso', 'tempeh'],
  sesame:    ['sesame', 'tahini'],
  wheat:     ['wheat', 'flour', 'gluten', 'semolina', 'barley', 'rye'],
  fish:      ['fish', 'cod', 'salmon', 'tuna', 'anchovy', 'sardine', 'tilapia', 'halibut'],
  shellfish: ['shrimp', 'prawn', 'crab', 'lobster', 'clam', 'oyster', 'scallop'],
  mustard:   ['mustard'],
};

const DIET_LABEL: Record<string, string> = {
  vegan: 'Vegan', vegetarian: 'Vegetarian', gluten_free: 'Gluten-free',
  dairy_free: 'Dairy-free', nut_free: 'Nut-free', halal: 'Halal', kosher: 'Kosher',
};

type Classification = 'safe' | 'caution' | 'unsafe';

type ItemProps = {
  name: string;
  price: string;
  ing_list: string[];
  itemAllergens: string[] | Record<string, number>;
  itemDietRestrictions: string[] | Record<string, number>;
  selectedAllergens?: string[];
  selectedDiets?: string[];
  imageUrl?: string;
  classification?: Classification;
};

export default function MenuItemCard(props: ItemProps) {
  const {
    name, price, ing_list, itemAllergens, itemDietRestrictions,
    selectedAllergens = [], selectedDiets = [], imageUrl, classification = 'safe',
  } = props;

  const cls = classification;
  const accentColor = cls === 'safe' ? COLORS.green : cls === 'caution' ? COLORS.yellow : COLORS.red;
  const badgeBg     = cls === 'safe'    ? 'rgba(234,242,235,0.92)'
                    : cls === 'caution' ? 'rgba(253,244,220,0.92)'
                                        : 'rgba(253,236,234,0.92)';
  const pillLabel   = cls === 'safe' ? 'Safe' : cls === 'caution' ? 'Caution' : 'Unsafe';
  const noImgBg     = cls === 'safe' ? '#4A7C4E' : cls === 'caution' ? '#9A7B18' : '#9B3E18';

  // ── Allergen badges (caution / unsafe) ─────────────────────────────────────
  const allergenBadges: { key: string; confidence: number }[] = [];
  if (selectedAllergens.length > 0 && itemAllergens) {
    if (Array.isArray(itemAllergens)) {
      selectedAllergens.forEach(k => {
        if ((itemAllergens as string[]).includes(k))
          allergenBadges.push({ key: k, confidence: 1 });
      });
    } else {
      selectedAllergens.forEach(k => {
        const conf = (itemAllergens as Record<string, number>)[k] ?? 0;
        if (conf >= 0.5) allergenBadges.push({ key: k, confidence: conf });
      });
    }
  }

  // ── Diet badges (safe) ──────────────────────────────────────────────────────
  const dietBadges: { key: string; confidence: number }[] = [];
  if (cls === 'safe' && selectedDiets.length > 0 && itemDietRestrictions) {
    if (Array.isArray(itemDietRestrictions)) {
      selectedDiets.forEach(k => {
        if ((itemDietRestrictions as string[]).includes(k))
          dietBadges.push({ key: k, confidence: 1 });
      });
    } else {
      selectedDiets.forEach(k => {
        const conf = (itemDietRestrictions as Record<string, number>)[k] ?? 0;
        if (conf >= 0.5) dietBadges.push({ key: k, confidence: conf });
      });
    }
  }

  // ── Confidence ──────────────────────────────────────────────────────────────
  const maxConf        = allergenBadges.length > 0 ? Math.max(...allergenBadges.map(b => b.confidence)) : 0;
  const filledPips     = maxConf > 0 ? Math.max(1, Math.round(maxConf * 5)) : 0;
  const pipColor       = maxConf >= 0.7 ? COLORS.red : COLORS.yellow;
  const maxDietConf    = dietBadges.length > 0 ? Math.max(...dietBadges.map(b => b.confidence)) : 0;
  const filledDietPips = maxDietConf > 0 && maxDietConf < 1 ? Math.max(1, Math.round(maxDietConf * 5)) : 0;

  // ── Ingredient highlighting ─────────────────────────────────────────────────
  // Build a map of which flagged allergens are unsafe vs caution
  const allergenFlagMap: Record<string, 'unsafe' | 'caution'> = {};
  allergenBadges.forEach(b => {
    allergenFlagMap[b.key] = b.confidence >= 0.7 ? 'unsafe' : 'caution';
  });

  const getIngFlag = (ing: string): 'unsafe' | 'caution' | null => {
    const ingLower = ing.toLowerCase();
    for (const [key, level] of Object.entries(allergenFlagMap)) {
      if ((ALLERGEN_KEYWORDS[key] ?? []).some(kw => ingLower.includes(kw))) return level;
    }
    return null;
  };

  const hasIngredients = Array.isArray(ing_list) && ing_list.length > 0;

  return (
    <View style={styles.cardShadow}>
    <View style={styles.card}>

      {/* ── Image / fallback header ──────────────────────────────────────────── */}
      {imageUrl ? (
        <View style={styles.imgContainer}>
          <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          <View style={styles.imgOverlay} />
          <View style={[styles.classBadge, { backgroundColor: badgeBg }]}>
            <View style={[styles.classDot, { backgroundColor: accentColor }]} />
            <Text style={[styles.classBadgeText, { color: accentColor }]}>{pillLabel}</Text>
          </View>
          <View style={styles.imgBottom}>
            <Text style={styles.imgName} numberOfLines={2}>{name}</Text>
            {price ? <Text style={styles.imgPrice}>{price}</Text> : null}
          </View>
        </View>
      ) : (
        <View style={[styles.noImgContainer, { backgroundColor: noImgBg }]}>
          <View style={[styles.classBadge, { backgroundColor: badgeBg }]}>
            <View style={[styles.classDot, { backgroundColor: accentColor }]} />
            <Text style={[styles.classBadgeText, { color: accentColor }]}>{pillLabel}</Text>
          </View>
          <View style={styles.imgBottom}>
            <Text style={styles.imgName} numberOfLines={2}>{name}</Text>
            {price ? <Text style={styles.imgPrice}>{price}</Text> : null}
          </View>
        </View>
      )}

      {/* ── White info panel ─────────────────────────────────────────────────── */}
      <View style={styles.panel}>

        {hasIngredients && (
          <>
            <Text style={styles.ingLabel}>INGREDIENTS</Text>
            <Text style={styles.ingText} numberOfLines={3}>
              {ing_list.map((ing, i) => {
                const flag = getIngFlag(ing);
                return (
                  <Text key={i}>
                    {i > 0 ? ', ' : ''}
                    {flag ? (
                      <Text style={flag === 'unsafe' ? styles.flaggedUnsafe : styles.flaggedCaution}>
                        {ing}
                      </Text>
                    ) : ing}
                  </Text>
                );
              })}
            </Text>
            <View style={styles.divider} />
          </>
        )}

        {/* ── Footer ─────────────────────────────────────────────────────────── */}
        <View style={styles.footer}>

          {/* Left: safety/allergen/diet badges */}
          <View style={styles.badgeRow}>
            {cls === 'safe' ? (
              dietBadges.length > 0
                ? dietBadges.map(b => (
                    <View key={b.key} style={[styles.badge, styles.badgeSafe]}>
                      <Text style={[styles.badgeText, { color: COLORS.green }]}>
                        {'✓ '}{DIET_LABEL[b.key] ?? b.key}
                      </Text>
                    </View>
                  ))
                : (
                  <View style={[styles.badge, styles.badgeSafe]}>
                    <Text style={[styles.badgeText, { color: COLORS.green }]}>No allergens</Text>
                  </View>
                )
            ) : (
              allergenBadges.map(b => (
                <View
                  key={b.key}
                  style={[styles.badge, b.confidence >= 0.7 ? styles.badgeUnsafe : styles.badgeCaution]}
                >
                  <Text style={styles.badgeEmoji}>{ALLERGEN_EMOJI[b.key] ?? '⚠'}</Text>
                  <Text style={[styles.badgeText, { color: b.confidence >= 0.7 ? COLORS.red : COLORS.yellow }]}>
                    {ALLERGEN_LABEL[b.key] ?? b.key}
                    {b.confidence < 1 ? ` · ${Math.round(b.confidence * 100)}%` : ''}
                  </Text>
                </View>
              ))
            )}
          </View>

          {/* Right: confidence pips (allergen) */}
          {maxConf > 0 && (
            <View style={styles.confCol}>
              <Text style={styles.confLabel}>Confidence</Text>
              <View style={styles.pips}>
                {[1, 2, 3, 4, 5].map(i => (
                  <View
                    key={i}
                    style={[styles.pip, i <= filledPips ? { backgroundColor: pipColor } : null]}
                  />
                ))}
              </View>
              <Text style={styles.confLabel}>{Math.round(maxConf * 100)}%</Text>
            </View>
          )}

          {/* Right: confidence pips (diet, only when partial confidence) */}
          {maxConf === 0 && filledDietPips > 0 && (
            <View style={styles.confCol}>
              <Text style={styles.confLabel}>Confidence</Text>
              <View style={styles.pips}>
                {[1, 2, 3, 4, 5].map(i => (
                  <View
                    key={i}
                    style={[styles.pip, i <= filledDietPips ? { backgroundColor: COLORS.green } : null]}
                  />
                ))}
              </View>
              <Text style={styles.confLabel}>{Math.round(maxDietConf * 100)}%</Text>
            </View>
          )}

        </View>
      </View>

    </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardShadow: {
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
  card: {
    borderRadius: 20,
    overflow: 'hidden',
  },

  // Image header
  imgContainer: {
    height: 200,
    position: 'relative',
    backgroundColor: '#1a1814',
  },
  imgOverlay: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: '70%',
    backgroundColor: 'rgba(0,0,0,0.58)',
  },

  // No-image fallback header
  noImgContainer: {
    height: 120,
    position: 'relative',
    justifyContent: 'flex-end',
  },

  // Classification badge — top-right, same for both header states
  classBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 20,
    paddingVertical: 5,
    paddingLeft: 8,
    paddingRight: 12,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 10,
    elevation: 4,
  },
  classDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  classBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },

  // Name / price overlaid at bottom of image area
  imgBottom: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    padding: 14,
  },
  imgName: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.white,
    lineHeight: 24,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  imgPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },

  // White info panel
  panel: {
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
  flaggedUnsafe: {
    color: COLORS.red,
    fontWeight: '600',
    backgroundColor: COLORS.redLight,
  },
  flaggedCaution: {
    color: COLORS.yellow,
    fontWeight: '600',
    backgroundColor: COLORS.yellowLight,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.creamDark,
    marginVertical: 10,
  },

  // Footer
  footer: {
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
  badgeSafe: {
    backgroundColor: COLORS.greenLight,
    borderWidth: 1,
    borderColor: COLORS.greenMid,
  },
  badgeUnsafe: {
    backgroundColor: COLORS.redLight,
    borderWidth: 1,
    borderColor: COLORS.redMid,
  },
  badgeCaution: {
    backgroundColor: COLORS.yellowLight,
    borderWidth: 1,
    borderColor: COLORS.yellowMid,
  },
  badgeEmoji: {
    fontSize: 11,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  confCol: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 2,
    flexShrink: 0,
  },
  confLabel: {
    fontSize: 9,
    color: COLORS.textLight,
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
