import React, { useState, useEffect, useContext } from 'react';
import {
  View, StyleSheet, FlatList, Text,
  TouchableOpacity, ActivityIndicator, Platform,
} from 'react-native';
import SearchBar from './SearchBar';
import FilterDropdownComponent from './FilterDropdownComponent';
import MenuInputComponent from './MenuInputComponent'; // kept as fallback
import MenuDiscoverySheet, { DiscoveryParams } from './MenuDiscoverySheet';
import ResultsSection from './ResultsSection';
import RestaurantTile from './RestaurantTile';
import MenuDetailScreen, { DetailRestaurant } from './MenuDetailScreen';
import HelpScreen from './HelpScreen';
import { getUserPreferences, updateSavedRestaurants } from './UserPreferences';
import 'react-native-get-random-values';
import axios from 'axios';
import { router } from 'expo-router';
import { AuthContext } from '../context/AuthContext';
import { API } from '../config/apiConfig';

const COLORS = {
  cream: '#F2EDE2',
  creamDark: '#E8E0D0',
  green: '#4A7C4E',
  greenDark: '#3A6340',
  greenLight: '#EAF2EB',
  orange: '#E07B39',
  red: '#C94A3A',
  yellow: '#D4A017',
  text: '#1C1C1A',
  textMuted: '#7A7570',
  textLight: '#ADA89F',
  white: '#FFFFFF',
};

interface SafetyScore {
  score_pct: number;
  safe_count: number;
  caution_count: number;
  unsafe_count: number;
  total_dishes: number;
}

interface Restaurant {
  restaurantId: string;
  address: string;
  heroImage: string;
  images: string[];
  menuUrl: string;
  name: string;
  verified?: boolean;
  safety_score?: SafetyScore;
}

function decodeJwtClaim(token: string, claim: string): string | null {
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return decoded[claim] ?? null;
  } catch {
    return null;
  }
}

type Tab = 'recommended' | 'saved';

type Props = {
  placeId?: string;
};

function HomeScreenV2({ placeId }: Props) {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedAllergens, setSelectedAllergens] = useState<string[]>([]);
  const [selectedDiets, setSelectedDiets] = useState<string[]>([]);
  const [savedRestaurantIds, setSavedRestaurantIds] = useState<string[]>([]);
  const [showHelp, setShowHelp] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [safeResults, setSafeResults] = useState<any[]>([]);
  const [unsafeResults, setUnsafeResults] = useState<any[]>([]);
  const [menuAnalysisParams, setMenuAnalysisParams] = useState<any>(undefined); // legacy fallback
  const [discoveryParams,    setDiscoveryParams]    = useState<DiscoveryParams | undefined>(undefined);
  const [selectedRestaurant, setSelectedRestaurant] = useState<DetailRestaurant | null>(null);
  const [loadingText, setLoadingText] = useState<string>('');
  const [activeTab, setActiveTab] = useState<Tab>('recommended');
  const { signOut, user } = useContext(AuthContext);
  const userId    = user?.idToken ? decodeJwtClaim(user.idToken, 'sub')   : null;
  const userEmail = user?.idToken ? decodeJwtClaim(user.idToken, 'email') : null;

  const fetchRestaurants = async () => {
    const endpoint = API.getRecommendations;
    try {
      const res = await axios.post(endpoint, {
        ...(userId ? { userId } : {}),
        // Send current client-side prefs inline so scoring reflects any
        // unsaved-to-server changes (avoids race with FilterDropdownComponent save).
        allergens:            selectedAllergens,
        dietaryRestrictions:  selectedDiets,
        limit: 10,
      });
      setRestaurants(res.data ?? []);
    } catch (error) {
      console.error('Error fetching recommendations:', error);
    }
  };

  const fetchUserPreferences = async () => {
    try {
      const prefs = await getUserPreferences();
      setSelectedAllergens(prefs.allergens || []);
      setSelectedDiets(prefs.dietaryRestrictions || []);
      setSavedRestaurantIds(prefs.savedRestaurants || []);
    } catch (error) {
      console.error('Error fetching user preferences:', error);
    }
  };

  useEffect(() => { fetchUserPreferences(); }, []);

  const toggleSaveRestaurant = async (restaurantId: string) => {
    const isCurrentlySaved = savedRestaurantIds.includes(restaurantId);
    const updated = isCurrentlySaved
      ? savedRestaurantIds.filter(id => id !== restaurantId)
      : [...savedRestaurantIds, restaurantId];
    setSavedRestaurantIds(updated);
    try {
      await updateSavedRestaurants({ savedRestaurants: updated });
    } catch (e) {
      setSavedRestaurantIds(savedRestaurantIds);
      console.error('Failed to update saved restaurants:', e);
    }
  };

  useEffect(() => {
    if (placeId) queryRestaurants({ place_id: placeId });
  }, [placeId]);

  // Re-fetch whenever userId resolves OR preferences change so scores reflect current filters.
  useEffect(() => {
    fetchRestaurants();
  }, [userId, selectedAllergens, selectedDiets]);

  useEffect(() => {
    const allergenSet = new Set(selectedAllergens);
    const dietSet = new Set(selectedDiets);
    const safe: any[] = [];
    const unsafe: any[] = [];
    results.forEach((item: any) => {
      // allergens/diet_restrictions may be a map {key: confidence} or a legacy list
      const allergenKeys = Array.isArray(item.allergens)
        ? item.allergens
        : Object.keys(item.allergens ?? {});
      const dietKeys = Array.isArray(item.diet_restrictions)
        ? item.diet_restrictions
        : Object.keys(item.diet_restrictions ?? {});
      const allergenHit = allergenKeys.filter((a: string) => allergenSet.has(a));
      const dietHit = dietKeys.filter((d: string) => dietSet.has(d));
      if (allergenHit.length || dietHit.length) unsafe.push(item);
      else safe.push(item);
    });
    setSafeResults(safe);
    setUnsafeResults(unsafe);
  }, [results, selectedAllergens, selectedDiets]);

  const queryRestaurants = async (searchResult: any) => {
    const endpoint = API.queryRestaurants;
    try {
      const response = await axios.post(endpoint, { placeId: searchResult.place_id });
      if (response.data?.length > 0) {
        setSelectedRestaurant({
          restaurantId: searchResult.place_id,
          name: searchResult.name ?? '',
          address: searchResult.formatted_address ?? '',
          heroImage: response.data[0].heroImage ?? '',
          images: [],
        });
        return;
      }
      // No existing analysis — open the discovery sheet, which handles menu URL
      // detection and analysis submission internally.
      setDiscoveryParams({
        restaurantId: searchResult.place_id,
        name:         searchResult.name ?? '',
        address:      searchResult.formatted_address ?? '',
        website:      searchResult.website ?? '',
        userId:       userId ?? '',
      });
    } catch (error) {
      console.error('Error querying restaurants:', error);
    }
  };

  // Legacy getMenu — kept for reference; no longer called by queryRestaurants.
  const getMenu = async (searchResult: any) => {
    const response = await axios.post(
      API.getMenu,
      {
        place_id: searchResult.place_id,
        name:     searchResult.name,
        address:  searchResult.formatted_address,
        website:  searchResult.website ?? '',
      }
    );
    return response.data?.is_menu ? response.data.link : null;
  };

  const preferenceChips = [...selectedAllergens, ...selectedDiets];
  const savedRestaurants = restaurants.filter(r => savedRestaurantIds.includes(r.restaurantId));
  const displayRestaurants = activeTab === 'saved' ? savedRestaurants : restaurants;
  const showingResults = safeResults.length > 0 || unsafeResults.length > 0;

  return (
    <View style={styles.container}>
      {loadingText !== '' && (
        <View style={styles.loaderOverlay}>
          <ActivityIndicator size="large" color={COLORS.green} />
          <Text style={styles.loaderText}>{loadingText}</Text>
        </View>
      )}

      {/* Header: filter + search */}
      <View style={styles.header}>
        <FilterDropdownComponent
          userPreferences={{ allergens: selectedAllergens, dietaryRestrictions: selectedDiets }}
          onFiltersChange={(filters) => {
            setSelectedAllergens(filters.allergens);
            setSelectedDiets(filters.dietaryRestrictions);
          }}
        />
        <SearchBar onSelect={(result) => queryRestaurants(result)} />
      </View>

      {/* Tabs — hidden while showing analysis results */}
      {!showingResults && (
        <View style={styles.tabRow}>
          {(['recommended', 'saved'] as Tab[]).map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Back button when showing analysis results */}
      {showingResults && (
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => { setResults([]); setSafeResults([]); setUnsafeResults([]); }}
        >
          <Text style={styles.backButtonText}>← Back to Restaurants</Text>
        </TouchableOpacity>
      )}

      {/* Restaurant list */}
      {!showingResults && (
        <>
          {displayRestaurants.length === 0 && activeTab === 'saved' ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No saved restaurants yet.</Text>
            </View>
          ) : (
            <FlatList
              data={displayRestaurants}
              keyExtractor={item => item.restaurantId}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => setSelectedRestaurant({
                    restaurantId: item.restaurantId,
                    name: item.name,
                    address: item.address,
                    heroImage: item.heroImage,
                    images: item.images,
                    safety_score: item.safety_score,
                  })}
                >
                  <RestaurantTile
                    restaurantId={item.restaurantId}
                    address={item.address}
                    heroImage={item.heroImage}
                    images={item.images}
                    menuUrl={item.menuUrl}
                    name={item.name}
                    verified={item.verified ?? false}
                    score={item.safety_score?.score_pct}
                    safeDishes={item.safety_score?.safe_count}
                    cautionDishes={item.safety_score?.caution_count}
                    unsafeDishes={item.safety_score?.unsafe_count}
                    isSaved={savedRestaurantIds.includes(item.restaurantId)}
                    onToggleSave={() => toggleSaveRestaurant(item.restaurantId)}
                  />
                </TouchableOpacity>
              )}
            />
          )}
        </>
      )}

      {/* Menu discovery sheet (new) */}
      {discoveryParams && (
        <MenuDiscoverySheet
          params={discoveryParams}
          onClose={() => setDiscoveryParams(undefined)}
        />
      )}

      {/* Legacy menu input — rendered only when menuAnalysisParams is set directly */}
      {menuAnalysisParams && (
        <MenuInputComponent
          params={menuAnalysisParams}
          onClose={() => setMenuAnalysisParams(undefined)}
        />
      )}

      {/* Analysis results */}
      {showingResults && (
        <ResultsSection
          safeResults={safeResults}
          unsafeResults={unsafeResults}
          selectedAllergens={selectedAllergens}
          selectedDiets={selectedDiets}
        />
      )}

      {/* Restaurant detail overlay */}
      {selectedRestaurant && (
        <MenuDetailScreen
          restaurant={selectedRestaurant}
          userId={userId}
          selectedAllergens={selectedAllergens}
          selectedDiets={selectedDiets}
          onClose={() => setSelectedRestaurant(null)}
          onFiltersChange={(allergens, diets) => {
            setSelectedAllergens(allergens);
            setSelectedDiets(diets);
          }}
          isSaved={savedRestaurantIds.includes(selectedRestaurant.restaurantId)}
          onToggleSave={() => toggleSaveRestaurant(selectedRestaurant.restaurantId)}
        />
      )}

      {/* Help FAB — above all overlays including MenuDetailScreen */}
      {!showHelp && (
        <View style={styles.fabGroup}>
          <TouchableOpacity style={styles.fab} onPress={() => setShowHelp(true)}>
            <Text style={styles.fabIcon}>?</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Help overlay — rendered last so it sits above MenuDetailScreen */}
      {showHelp && (
        <HelpScreen
          onClose={() => setShowHelp(false)}
          userEmail={userEmail}
          onSignOut={() => signOut().then(() => router.replace('/signin'))}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.cream,
  },
  header: {
    backgroundColor: COLORS.cream,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 54 : 16,
    paddingBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  filterBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.green,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  filterBtnText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
  chipsScroll: {
    flex: 1,
  },
  chip: {
    backgroundColor: COLORS.green,
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 12,
    marginRight: 6,
  },
  chipText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '600',
  },
  chipAdd: {
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: COLORS.textLight,
    marginRight: 6,
  },
  chipAddText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  tab: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: COLORS.creamDark,
  },
  tabActive: {
    borderBottomColor: COLORS.green,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  tabTextActive: {
    color: COLORS.green,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  listContent: {
    paddingBottom: 100,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyStateText: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  backButton: {
    backgroundColor: COLORS.green,
    padding: 10,
    borderRadius: 8,
    marginHorizontal: 16,
    marginVertical: 10,
    alignItems: 'center',
  },
  backButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loaderText: {
    color: COLORS.white,
    marginTop: 10,
  },
  fabGroup: {
    position: 'absolute',
    bottom: 28,
    right: 16,
    flexDirection: 'column',
    gap: 10,
    alignItems: 'center',
    zIndex: 200,
    elevation: 200,
  },
  fab: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.orange,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.orange,
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 14,
    elevation: 5,
  },
  fabIcon: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '700',
  },
});

export default HomeScreenV2;
