import axios from 'axios';
import { API } from '../config/apiConfig';

interface DietaryPreferences {
  allergens: string[];
  dietaryRestrictions: string[];
}

interface SavedRestaurants {
  savedRestaurants: string[];
}

interface UserPreferences extends DietaryPreferences {
  savedRestaurants: string[];
}

const API_BASE_URL = API.userPreferences;

// Normalize legacy label strings → backend snake_case keys.
// Handles old Title Case values stored before the key migration.
const ALLERGEN_LABEL_TO_KEY: Record<string, string> = {
  'milk': 'dairy', 'dairy': 'dairy', 'dairy / milk': 'dairy',
  'eggs': 'egg', 'egg': 'egg',
  'peanuts': 'peanut', 'peanut': 'peanut',
  'tree nuts': 'tree_nut', 'tree_nut': 'tree_nut', 'cashews': 'tree_nut',
  'soy': 'soy',
  'sesame': 'sesame',
  'wheat': 'wheat',
  'fish': 'fish',
  'shellfish': 'shellfish',
  'mustard': 'mustard',
};
const DIET_LABEL_TO_KEY: Record<string, string> = {
  'vegetarian': 'vegetarian',
  'vegan': 'vegan',
  'gluten-free': 'gluten_free', 'gluten_free': 'gluten_free',
  'dairy-free': 'dairy_free', 'dairy_free': 'dairy_free',
};

function normalizeAllergens(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const v of values) {
    const key = ALLERGEN_LABEL_TO_KEY[v.toLowerCase()] ?? v.toLowerCase();
    if (!seen.has(key)) { seen.add(key); result.push(key); }
  }
  return result;
}
function normalizeDiets(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const v of values) {
    const key = DIET_LABEL_TO_KEY[v.toLowerCase()] ?? v.toLowerCase();
    if (!seen.has(key)) { seen.add(key); result.push(key); }
  }
  return result;
}

import AsyncStorage from '@react-native-async-storage/async-storage';

// Retrieve auth token from AsyncStorage and return as Authorization header
const getAuthHeader = async () => {
  try {
    const token = await AsyncStorage.getItem('idToken');
    if (token && token.startsWith('eyJ')) {
      return { Authorization: `Bearer ${token}` };
    }
    if (token) {
      console.warn('[Auth] idToken looks invalid (not a JWT), clearing it');
      await AsyncStorage.removeItem('idToken');
    }

    // Fallback: try to read a stored cognito session and extract token if present
    const sessionStr = await AsyncStorage.getItem('cognitoSession');
    if (sessionStr) {
      try {
        const session = JSON.parse(sessionStr);
        // Common serialized shapes may include idToken.jwtToken or idToken.token
        const idToken = session?.idToken ?? session?.IdToken ?? session?.id_token;
        const jwt = idToken?.jwtToken ?? idToken?.token ?? idToken?.tokenString ?? null;
        if (jwt) return { Authorization: `Bearer ${jwt}` };
      } catch (e) {
        // JSON parse failed or unexpected shape - ignore and continue
      }
    }

    return {};
  } catch (e) {
    console.warn('Could not retrieve auth token:', e);
    return {};
  }
};

// Get all user preferences
export const getUserPreferences = async (): Promise<UserPreferences> => {
  try {
    const headers = await getAuthHeader();
    const response = await axios.get<UserPreferences>(
      `${API_BASE_URL}preferences`,
      { headers: { Accept: 'application/json', ...headers } }
    );
    const data = response.data;
    return {
      ...data,
      allergens: normalizeAllergens(data.allergens ?? []),
      dietaryRestrictions: normalizeDiets(data.dietaryRestrictions ?? []),
    };
  } catch (error) {
    if (axios.isAxiosError(error) && (error.response?.status === 404 || error.response?.status === 401)) {
      return { allergens: [], dietaryRestrictions: [], savedRestaurants: [] };
    }
    throw error;
  }
};

// Update only dietary preferences
export const updateDietaryPreferences = async (preferences: DietaryPreferences): Promise<UserPreferences> => {
  const headers = await getAuthHeader();
  const response = await axios.put<UserPreferences>(
    `${API_BASE_URL}preferences/dietary`,
    preferences,
    { headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...headers } }
  );
  return response.data;
};

// Update only saved restaurants
export const updateSavedRestaurants = async (restaurants: SavedRestaurants): Promise<UserPreferences> => {
  const headers = await getAuthHeader();
  const response = await axios.put<UserPreferences>(
    `${API_BASE_URL}preferences/restaurants`,
    restaurants,
    { headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...headers } }
  );
  return response.data;
};

// Delete dietary preferences
export const deleteDietaryPreferences = async (): Promise<void> => {
  const headers = await getAuthHeader();
  await axios.delete(
    `${API_BASE_URL}preferences/dietary`,
    { headers: { Accept: 'application/json', ...headers } }
  );
};

// Delete saved restaurants
export const deleteSavedRestaurants = async (): Promise<void> => {
  const headers = await getAuthHeader();
  await axios.delete(
    `${API_BASE_URL}preferences/restaurants`,
    { headers: { Accept: 'application/json', ...headers } }
  );
};


// Export types for use in other components
export type { UserPreferences, DietaryPreferences, SavedRestaurants };