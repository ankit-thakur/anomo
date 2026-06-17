import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';

const COLORS = {
  cream: '#F2EDE2',
  creamDark: '#E8E0D0',
  green: '#4A7C4E',
  greenLight: '#EAF2EB',
  orange: '#E07B39',
  red: '#C94A3A',
  redLight: '#FDECEA',
  yellow: '#D4A017',
  yellowLight: '#FDF6E3',
  text: '#1C1C1A',
  textMuted: '#7A7570',
  textLight: '#ADA89F',
  white: '#FFFFFF',
};

const IMAGE_HEIGHT = 160;

interface RestaurantTileProps {
  restaurantId: string;
  address: string;
  heroImage: string;
  images: string[];
  menuUrl: string;
  name: string;
  verified?: boolean;
  score?: number;
  safeDishes?: number;
  cautionDishes?: number;
  unsafeDishes?: number;
  reviewSnippet?: string;
  reviewSource?: string;
  isSaved?: boolean;
  onToggleSave?: () => void;
}

function getScoreStyle(score: number) {
  if (score >= 80) return { dot: COLORS.green, text: COLORS.green, label: 'safe' };
  if (score >= 50) return { dot: COLORS.yellow, text: COLORS.yellow, label: 'caution' };
  return { dot: COLORS.red, text: COLORS.red, label: 'unsafe' };
}

const RestaurantTile = (props: RestaurantTileProps) => {
  const {
    name, address, heroImage,
    score, safeDishes, cautionDishes, unsafeDishes,
    reviewSnippet, reviewSource,
    isSaved = false, onToggleSave,
  } = props;

  const hasScore      = score !== undefined && score !== null;
  const scoreStyle    = hasScore ? getScoreStyle(score!) : null;
  const hasDishCounts = safeDishes !== undefined || cautionDishes !== undefined || unsafeDishes !== undefined;
  const safe          = safeDishes ?? 0;
  const caution       = cautionDishes ?? 0;
  const unsafe        = unsafeDishes ?? 0;
  const safeColor     = hasScore && score! < 80 ? COLORS.yellow : COLORS.green;

  return (
    <View style={styles.cardShadow}>
      <View style={styles.card}>

        {/* ── Image / placeholder header ── */}
        <View style={styles.imageArea}>
          {heroImage ? (
            <View style={styles.image}>
              <Image
                source={{ uri: heroImage }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
              />
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.55)']}
                style={StyleSheet.absoluteFill}
              />
              <Text style={styles.imageName}>{name}</Text>
            </View>
          ) : (
            <View style={[styles.image, styles.imagePlaceholder]}>
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.55)']}
                style={StyleSheet.absoluteFill}
              />
              <Text style={styles.imageName}>{name}</Text>
            </View>
          )}

          {/* Safety score badge — top right */}
          {hasScore && (
            <View style={styles.scoreBadge}>
              <View style={[styles.scoreDot, { backgroundColor: scoreStyle!.dot }]} />
              <Text style={[styles.scoreText, { color: scoreStyle!.text }]}>
                {score}% {scoreStyle!.label}
              </Text>
            </View>
          )}

          {/* Bookmark — bottom right */}
          {onToggleSave && (
            <TouchableOpacity style={styles.bookmarkBtn} onPress={onToggleSave} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <MaterialIcons
                name={isSaved ? 'bookmark' : 'bookmark-border'}
                size={22}
                color={COLORS.white}
              />
            </TouchableOpacity>
          )}
        </View>

        {/* ── Card body ── */}
        <View style={styles.cardBody}>

          <Text style={styles.address}>{address}</Text>

          {hasDishCounts && (
            <View style={styles.dishRow}>
              <Text style={[styles.dishCount, { color: safeColor }]}>{safe} dishes</Text>
              <Text style={styles.dishLabel}>
                {' '}safe for you
                {caution > 0 ? ` · ${caution} with caution` : ''}
                {unsafe > 0 ? ` · ${unsafe} unsafe` : ''}
              </Text>
            </View>
          )}

          {/* Reviews — hidden when no snippet */}
          {reviewSnippet ? (
            <>
              <View style={styles.reviewDivider} />
              <Text style={styles.reviewSnippet}>"{reviewSnippet}"</Text>
              {reviewSource ? (
                <Text style={styles.reviewSource}>{reviewSource}</Text>
              ) : null}
            </>
          ) : null}

        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // Outer view holds shadow; inner holds overflow clip
  cardShadow: {
    marginHorizontal: 14,
    marginBottom: 12,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 12,
    elevation: 3,
  },
  card: {
    borderRadius: 20,
    overflow: 'hidden',
  },

  // Image header
  imageArea: {
    height: IMAGE_HEIGHT,
    overflow: 'hidden',
  },
  image: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 12,
  },
  imagePlaceholder: {
    backgroundColor: '#A8C0A8',
  },
  imageName: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 20,
    color: COLORS.white,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  // Safety score badge
  scoreBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    paddingVertical: 5,
    paddingLeft: 7,
    paddingRight: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 4,
  },
  scoreDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  scoreText: {
    fontSize: 12,
    fontWeight: '700',
  },

  // Bookmark
  bookmarkBtn: {
    position: 'absolute',
    bottom: 10,
    right: 10,
  },

  // Body
  cardBody: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
  },
  address: {
    fontSize: 11,
    color: COLORS.textMuted,
    lineHeight: 16,
    marginBottom: 6,
  },
  dishRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  dishCount: {
    fontSize: 12,
    fontWeight: '600',
  },
  dishLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
  },

  // Reviews
  reviewDivider: {
    height: 1,
    backgroundColor: COLORS.creamDark,
    marginVertical: 8,
  },
  reviewSnippet: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontStyle: 'italic',
    lineHeight: 17,
  },
  reviewSource: {
    fontSize: 10,
    color: COLORS.textLight,
    marginTop: 3,
  },
});

export default RestaurantTile;
