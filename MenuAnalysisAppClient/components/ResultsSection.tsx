import * as React from 'react';
import { View, FlatList, Text, StyleSheet, Dimensions, ScrollView, StatusBar } from 'react-native';
import { TabView, SceneMap, TabBar } from 'react-native-tab-view';
import MenuItemCard from './MenuItemCard';


const FirstRoute = (safeResults: any[], selectedAllergens: string[], selectedDiets: string[]) => (
  <FlatList
    style={styles.resultsContainer}
    data={safeResults}
    renderItem={({ item }) => (
      <MenuItemCard
        name={item.name}
        price={item.price}
        ing_list={item.ingredients}
        itemAllergens={item.allergens}
        itemDietRestrictions={item.diet_restrictions}
        selectedAllergens={selectedAllergens}
        selectedDiets={selectedDiets}
        imageUrl={item.imageUrl}
        classification="safe"
      />
    )}
    keyExtractor={item => item.name}
  />
);

const SecondRoute = (unsafeResults: any[], selectedAllergens: string[], selectedDiets: string[]) => (
  <FlatList
    style={styles.resultsContainer}
    data={unsafeResults}
    renderItem={({ item }) => (
      <MenuItemCard
        name={item.name}
        price={item.price}
        ing_list={item.ingredients}
        itemAllergens={item.allergens}
        itemDietRestrictions={item.diet_restrictions}
        selectedAllergens={selectedAllergens}
        selectedDiets={selectedDiets}
        imageUrl={item.imageUrl}
        classification="unsafe"
      />
    )}
    keyExtractor={item => item.name}
  />
);


type ResultsSectionProps = {
    safeResults: any[];
    unsafeResults: any[];
    selectedAllergens: any[];
    selectedDiets: any[];
}

function ResultsSection(props: ResultsSectionProps) {

    console.log("Rendering ResultsSection: ", props.selectedAllergens, props.selectedDiets);

    const layout = Dimensions.get('window');

    const [index, setIndex] = React.useState(0);
    const [routes] = React.useState([
        { key: 'first', title: 'Safe' },
        { key: 'second', title: 'Unsafe' }
    ]);

    const renderScene = React.useMemo(() => SceneMap({
        first: () => FirstRoute(props.safeResults, props.selectedAllergens, props.selectedDiets),
        second: () => SecondRoute(props.unsafeResults, props.selectedAllergens, props.selectedDiets)
    }), [props.safeResults, props.unsafeResults, props.selectedAllergens, props.selectedDiets]);


    const renderTabBar = (props: any) => (
        <TabBar
            {...props}
            indicatorStyle={{ backgroundColor: '#ff914d', height: 3 }}
            style={{  backgroundColor:"#fff8e5"} }           
            activeColor="#ff914d"
            inactiveColor="#aaa"            
            renderLabel={({
                route,
                focused,
                color,
            }: {
                route: { key: string; title: string };
                focused: boolean;
                color: string;
            }) => (
                <Text
                    style={[
                        styles.tabLabel,
                        // focused ? styles.tabLabel : styles.tabLabel,
                    ]}
                >
                    {route.title}
                </Text>
            )}
        />
    );


    return (
        <View style={styles.results}>
            <TabView
                navigationState={{ index, routes }}
                renderScene={renderScene}
                onIndexChange={setIndex}
                initialLayout={{ width: layout.width }}
                renderTabBar={renderTabBar}
            />
        </View>
    );
}

const styles = StyleSheet.create({
  results: {
    flex: 1,
    marginTop: 2,
  },
  resultsContainer: {
    flex: 1,
    marginTop: StatusBar.currentHeight || 0,
  },
  itemHeaders: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    paddingVertical: 7,
    marginHorizontal: 16,
  },
  item: {
    // backgroundColor: '#dedede',
    backgroundColor: '#ffffffff',
    padding: 10,
    marginVertical: 8,
    marginHorizontal: 16,
    borderRadius: 6,
  },
  name: {
    fontFamily: 'Inter_500Medium',
    fontSize: 18,
    paddingBottom: 5,
  },
  price: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    paddingBottom: 5,
  },
  ing: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    paddingBottom: 5,
  },
  tabView: {
    backgroundColor: '#fff8e5',
  },
  tabLabel: {
    fontSize: 26,   
    fontFamily: 'Inter_400Regular',
  }
});

export default ResultsSection;