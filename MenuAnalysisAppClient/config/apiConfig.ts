// API endpoints — set these in MenuAnalysisAppClient/.env (see .env.example)
export const API = {
  // Restaurant data
  getRestaurant:     process.env.EXPO_PUBLIC_API_RESTAURANT_URL + '/getRestaurant',
  getRecommendations:process.env.EXPO_PUBLIC_API_RESTAURANT_URL + '/getRecommendations',
  getMenuItems:      process.env.EXPO_PUBLIC_API_RESTAURANT_URL + '/getMenuItems',
  queryRestaurants:  process.env.EXPO_PUBLIC_API_QUERY_URL + '/queryRestaurants',

  // Menu
  getMenu:           process.env.EXPO_PUBLIC_API_MENU_URL + '/getMenu',
  analyzeMenu:       process.env.EXPO_PUBLIC_API_ANALYZE_URL + '/invokeAnalyzeMenu',

  // Search
  searchPlaceId:     process.env.EXPO_PUBLIC_API_SEARCH_URL + '/searchPlaceId',
  searchPlaceDetails:process.env.EXPO_PUBLIC_API_SEARCH_URL + '/searchPlaceDetails',

  // User
  userPreferences:   process.env.EXPO_PUBLIC_API_PREFERENCES_URL,
  pushToken:         process.env.EXPO_PUBLIC_API_PREFERENCES_URL + '/push-token',
  updateUsers:       process.env.EXPO_PUBLIC_API_USERS_URL + '/updateUsers',
};
