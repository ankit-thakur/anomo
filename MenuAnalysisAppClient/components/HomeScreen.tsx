import React, { useState, useEffect, useContext } from 'react';
import { View, StyleSheet, Button, ScrollView, FlatList, Text, StatusBar, TouchableOpacity, ActivityIndicator } from 'react-native';
import SearchBar from './SearchBar';
import FilterDropdownComponent from './FilterDropdownComponent';
import MenuInputComponent from './MenuInputComponent';
import ResultsSection from './ResultsSection';
import QRScanner from './QRScanner';
import RestaurantTile from './RestaurantTile';
import { getUserPreferences, updateDietaryPreferences, DietaryPreferences } from './UserPreferences';
import 'react-native-get-random-values'
import axios from 'axios';
import { Link, router } from "expo-router";
import { AuthContext } from '../context/AuthContext';
import { API } from '../config/apiConfig';


interface Restaurant {
  restaurantId: string;
  address: string;
  images: string[];
  menuUrl: string;
  name: string;
  verified?: boolean;
}

interface SearchPlaceResult {
  place_id: string;
  name: string;
  address: string;
  website: string;
  menu_url: string;
};

type Props = {
  placeId?: string;
};


function HomeScreen({ placeId }: Props) {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [restaurantStats, setRestaurantStats] = useState<{[key: string]: { safeAllergens: number, safeDiets: number }}>({});
  const [selectedAllergens, setSelectedAllergens] = useState<string[]>([]);
  const [selectedDiets, setSelectedDiets] = useState<string[]>([]);
  const [alertVisible, setAlertVisible] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [safeResults, setSafeResults] = useState<any[]>([]);
  const [unsafeResults, setUnsafeResults] = useState<any[]>([]);
  const [showMenuInput, setShowMenuInput] = useState<boolean>(false);
  const [searchPlaceResult, setSearchPlaceResult] = useState<SearchPlaceResult>();
  const [menuUrl, setMenuUrl] = useState<string>('');
  const [menuAnalysisParams, setMenuAnalysisParams] = useState<any>(undefined);
  const [loadingText, setLoadingText] = useState<string>('');
  const [showRestaurants, setShowRestaurants] = useState<boolean>(true);
  const { signOut, user } = useContext(AuthContext);

  const fetchRestaurants = async () => {

    const queryRestaurantsApiEndpoint = API.getRestaurant;

    // const params = {
    //   placeId: 'ChIJuwgQBM9ZwokR_tL0uQ1wTTU'
    // };

    try {
      const response1 = await axios.post(queryRestaurantsApiEndpoint,  {
        placeId: 'ChIJuwgQBM9ZwokR_tL0uQ1wTTU'
      });      
      const response2 = await axios.post(queryRestaurantsApiEndpoint,  {
        placeId: 'ChIJJzU5p1ZYwokRnjwqzlLub0E'
      }); 
      const response3 = await axios.post(queryRestaurantsApiEndpoint,  {
        placeId: 'ChIJw2RCuSZZwokRVt7nWZNROm0'

      }); 
      
      setRestaurants([response1.data, response2.data, response3.data]);
      
      // Calculate stats for each restaurant
      const stats = {};
      // response.data.forEach(restaurant => {
        // You'll need to implement the actual logic to calculate safe allergens and diets
        // stats[restaurant.restaurantId.S] = {
        //   safeAllergens: 5, // Replace with actual calculation
        //   safeDiets: 3     // Replace with actual calculation
        // };
      // });
      // setRestaurantStats(stats);
    } catch (error) {
      console.error('Error fetching restaurants:', error);
    }
  };
  // Fetch user allergens and dietary restrictions from backend (placeholder)

  const fetchUserPreferences = async () => {
    // if (!user) return;
    console.log('Fetching user preferences for:', user);

    try {
      const prefs = await getUserPreferences();
      console.log('Fetched user preferences:', prefs);
      
      setSelectedAllergens(prefs.allergens || []);
      setSelectedDiets(prefs.dietaryRestrictions || []);

    } catch (error) {
      console.error('Error fetching user preferences:', error);
    }
  };
  // Fetch user preferences on mount if authenticated
  useEffect(() => {
    // if (user) {
    //   fetchUserPreferences();
    // }
    fetchUserPreferences();
  }, [user]);

  const handleLogout = async () => {
    if (menuAnalysisParams?.email) {
      await signOut();
    }
    router.replace('/signin');
  };

  // Add Logout button to the view instead of header
  const LogoutButton = () => (
    <TouchableOpacity 
      onPress={handleLogout} 
      style={[styles.helpButton, { right: 80 }]}>
      <Text style={styles.helpText}>↪</Text>
    </TouchableOpacity>
  );

  useEffect(() => {
    if (placeId) {
      queryRestaurants({ place_id: placeId });
    }
    fetchRestaurants();
  }, [placeId]);

 
  // filter results on selected allergen and diet filters
  useEffect(() => {

    console.log("Filtering results with selectedAllergens: ", selectedAllergens, " selectedDiets: ", selectedDiets);

    const selectedAllergenFilterSet = new Set(selectedAllergens.map(a => a.toLowerCase()));
    const selectedDietFilterSet = new Set(selectedDiets.map(d => d.toLowerCase()));

    let safe: React.SetStateAction<any[]> = [];
    let unsafe: React.SetStateAction<any[]> = [];

    results.forEach((item: any) => {
      const allergyIntersection = item.allergens?.filter((allergy: string) => selectedAllergenFilterSet.has(allergy.toLowerCase())) ?? [];
      const dietIntersection = item.diet_restrictions?.filter((diet: string) => selectedDietFilterSet.has(diet.toLowerCase())) ?? [];
      if (allergyIntersection?.length || dietIntersection?.length) {
        unsafe.push(item);
      } else {
        safe.push(item);
      }
    });

    setSafeResults(safe);
    setUnsafeResults(unsafe);
  }, [results, selectedAllergens, selectedDiets]);

  // No filter logic here; all handled in FilterDropdownComponent

  const queryRestaurants = async (searchResult: any) => {
    console.log("* query restaurants input: ", searchResult);

    const queryRestaurantsApiEndpoint = API.queryRestaurants;

    const params = {
      placeId: searchResult.place_id,
    };

    var url = "";
    try {
      const response = await axios.post(queryRestaurantsApiEndpoint, params);

      if (response.data && response.data.length > 0) {

        // redirect to Results screen
        // router.push({
        //   pathname: '/results',
        //   params: { restaurantId: response.data[0].restaurantId.S }
        // });

        setResults(response.data);
        return;
        // setShowMenuInput(false);
      } else {
        setLoadingText("Looking for menu"); // ✅ start loader

        console.log("No results found for the given placeId.");

        // ✅ call getMenu only when no results are found
        url = await getMenu(searchResult);

        console.log("menu url: ", url);
      }
    } catch (error) {
      console.error("Error querying restaurants:", error);
    } finally {
      setLoadingText(''); // ✅ stop loader no matter what
    }

    // ✅ update params with the menuUrl we discovered
    const updatedParams = {
      place_id: searchResult.place_id,
      name: searchResult.name,
      address: searchResult.formatted_address,
      website: searchResult.website ?? "",
      menu_url: url ?? "",
    };

    setMenuAnalysisParams(updatedParams);

    //   // ✅ only show menu input if there was NO initial placeId prop (i.e. user interaction)
    // if (!placeId) {
    //   setShowMenuInput(true);
    // }
  };


  const getMenu = async (searchResult: any) => {
    console.log("* getMenu called: ", searchResult);

    const getMenuApiEndpoint = API.getMenu;

    const params = {
      place_id: searchResult.place_id,
      name: searchResult.name,
      address: searchResult.formatted_address,
      website: searchResult.website ?? "",
    };

    const response = await axios.post(getMenuApiEndpoint, params);
    const data = response.data;

    console.log("getMenu response data:", data);

    if (data && data.is_menu) {
      // setMenuUrl(data.link); // ✅ only set if valid menu
      return data.link; // ✅ return instead of setting state
      // return "https://qanoonnyc.com/menu/";
    } else {
      console.warn("No menu found in response:", data);
    }
    return null;
  };

  // const onShowMenuInput = (showInput: boolean) => {
  //   setShowMenuInput(showInput);
  // };

  return (
    <View style={styles.container}>

      {loadingText != '' && (
        <View style={styles.loaderOverlay}>
          <ActivityIndicator size="large" color="#4d7f38" />
          <Text style={{color: 'white', marginTop: 10}}>{loadingText}</Text>
        </View>
      )}

      <View style={styles.filtersContainer} testID='filtersContainer'>
        <FilterDropdownComponent
          userPreferences={{
            allergens: selectedAllergens,
            dietaryRestrictions: selectedDiets
          }}
          onFiltersChange={(filters: { allergens: string[]; dietaryRestrictions: string[] }) => {
            setSelectedAllergens(filters.allergens);
            setSelectedDiets(filters.dietaryRestrictions);
          }}
        />
      </View>

      <SearchBar onSelect={ (selectedSearchResult) => queryRestaurants(selectedSearchResult) }/>

      {
        (safeResults.length === 0 && unsafeResults.length === 0) ? (
          <>
            <Text style={{fontSize: 18, fontWeight: 'bold', marginLeft: 16, paddingTop: 20}}>We think you'll love:</Text>
            <FlatList
              style={styles.restaurantList}
              data={restaurants}
              renderItem={({ item }) => (
                <TouchableOpacity onPress={() => {
                  queryRestaurants({ 
                    place_id: item.restaurantId,
                    name: item.name,
                    formatted_address: item.address,
                    website: item.menuUrl
                  });
                }}>
                  <RestaurantTile 
                    restaurantId={item.restaurantId}
                    address={item.address}
                    images={item.images}
                    menuUrl={item.menuUrl}
                    name={item.name}
                    verified={item.verified ?? false}
                  />
                </TouchableOpacity>
              )}
              keyExtractor={item => item.restaurantId}
            />
          </>
        ) : (
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => {
              setResults([]);
              setSafeResults([]);
              setUnsafeResults([]);
            }}
          >
            <Text style={styles.backButtonText}>← Back to Restaurants</Text>
          </TouchableOpacity>
        )
      }
      
      {
        menuAnalysisParams ? (
          <MenuInputComponent
            params={menuAnalysisParams}
            onClose={() => setMenuAnalysisParams(undefined)}
          />        
        ) : null
      }

      {/* <MenuInputComponent params={ menuAnalysisParams }/>          */}

      {/* Help button */}
      <TouchableOpacity
        style={styles.helpButton}
        onPress={() => router.push('/help')}
      >
        <Text style={styles.helpText}>?</Text>
      </TouchableOpacity>

      {/* Logout button */}
      <LogoutButton />

      {/* Results section */}
      {
        safeResults.length > 0 || unsafeResults.length > 0 ? 
          <ResultsSection safeResults={safeResults} unsafeResults={unsafeResults} selectedAllergens={selectedAllergens} selectedDiets={selectedDiets}/>
        : null
      }

    </View>
  );
};


const styles = StyleSheet.create({
  backButton: {
    backgroundColor: '#4d7f38',
    padding: 10,
    borderRadius: 8,
    marginHorizontal: 16,
    marginVertical: 10,
    alignItems: 'center',
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  addFilterButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#4d7f38',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    borderWidth: 1,
    borderColor: '#DDD',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 2,
  },
  addFilterButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    lineHeight: 28,
    textAlign: 'center',
  },
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  container: {
    flex: 1,
    padding: 4,
    backgroundColor: '#fff8e5',
  },
  filtersContainer: {
    flexDirection: 'row',
    marginTop: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignItems: 'center',
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginLeft: 10,
  },
  menuInputBox: {
    height: 100,
    margin: 12,
    borderWidth: 1,
    padding: 10,
    flexWrap: 'wrap',
  },
  inputButtonContainer: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  helpButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#F29D4B',
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 3,
    zIndex: 3, // works on ios
    elevation: 3, // works on android
  },
  helpText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  restaurantList: {
    paddingTop: 10,
    flex: 1,
    width: '100%',
  },
});

export default HomeScreen;
