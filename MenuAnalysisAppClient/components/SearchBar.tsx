import React, { useState } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  Text,
  TouchableOpacity,
  FlatList,
  Keyboard,
  Platform
} from 'react-native';
import axios from 'axios';
import { API } from '../config/apiConfig';


type SearchResult = { 
  name: string, 
  formatted_address: string, 
  website?: string,
  place_id: string 
};

interface SearchBarProps {
  onSelect: (selected: any) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ onSelect }) => {

  const [query, setQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState<SearchResult[]>();
  const [showSearchError, setShowSearchError] = useState(false);
  const [showEmptyResultError, setShowEmptyResultError] = useState(false);

  const handleSearch = async () => {
    setShowSearchError(false); // Reset error state before new search
    setShowEmptyResultError(false); // Show error message above search bar

    const apiEndpoint = API.searchPlaceId;
    const params = {
      searchQuery: query
    }
    
    try {
      const searchResults = await axios.post(apiEndpoint, params);

      console.log(searchResults); // Handle response
      const data = await searchResults.data;

      if (!data || !Array.isArray(data) || data.length === 0) {
        console.warn("No results found for the query:", query);
        setResults([]);
        setShowResults(false);
        setShowEmptyResultError(true); // Show error message above search bar
        return;
      }

      setResults(data)
      setShowResults(true);
      Keyboard.dismiss();
    } catch (error) {
      console.error("Error retrieving search results: " + error);
      // Show error message above search bar
      setShowSearchError(true); // maybe implement a timer for the error to fade away
    }
  };

  const handleSelectResult = async (result: SearchResult) => {

    const apiEndpoint = API.searchPlaceDetails;

    var placeDetails;
    try {
      placeDetails = await axios.get(apiEndpoint, {
        params: {
          placeId: result.place_id
        }
      });

      const data = await placeDetails.data;

      if (!data) {
        console.warn("Error processing place");
        setResults([]);
        setShowResults(false);
        setShowEmptyResultError(true); // Show error message above search bar
        return;
      }

      result.website = data.website;

      onSelect(result);
      setQuery(result.name); // You can set the selected result to the search bar if desired
      setShowResults(false); // Collapse the result view after selection

    } catch (error) {
      console.error("Error retrieving search results: " + error);
      // Show error message above search bar
      setShowSearchError(true); // maybe implement a timer for the error to fade away
    }
  };

  return (
    <View style={styles.container}>
      {showSearchError && (
        <Text style={styles.searchError}>
          Error retrieving search results. Please try again.
        </Text>
      )}
      {showEmptyResultError && (
        <Text style={styles.searchError}>
          No results found. Please try again.
        </Text>
      )}
      <TextInput
        style={styles.searchBar}
        placeholder="The Maharaja Boston..."
        placeholderTextColor="#808080"
        value={query}
        onChangeText={setQuery}
        onSubmitEditing={handleSearch}
        returnKeyType="search"
      />
      {showResults && (
        <View style={styles.resultsContainer}>
          <FlatList
            data={results}
            keyExtractor={(item) => item.name}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.resultItem}
                onPress={() => handleSelectResult(item)}
              >
                <Text style={styles.resultText}>{item.name}</Text>
                <Text style={styles.resultText}>{item.formatted_address}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    // marginTop: Platform.OS === 'ios' ? 50 : 20,
    paddingHorizontal: 10,
    alignItems: 'stretch',
  },
  searchBar: {
    height: 50,
    borderRadius: 25,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#DDD',
  },
  resultsContainer: {
    marginTop: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    maxHeight: 200, // Limits how tall the result list can expand
    borderWidth: 1,
    borderColor: '#DDD',
  },
  resultItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  resultText: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
  },
  searchError: {
    color: 'red', 
    marginBottom: 10
  }
});

export default SearchBar;
