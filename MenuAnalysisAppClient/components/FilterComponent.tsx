import React, { useState, useRef, useEffect } from "react";
import {
  Animated,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Modal,
  Pressable,
  Easing,
} from "react-native";
import { CheckBox } from "react-native-elements";
import Icon from "react-native-vector-icons/MaterialIcons";


interface CheckboxListProps {
  name: string,
  checkboxItems: any[]; // List of checkbox items passed from parent
  onSelect: (selected: any[]) => void;
}

const FilterComponent: React.FC<CheckboxListProps> = ({ name, checkboxItems, onSelect }) => {
// const FilterComponent = (props: any) => {

  const [panelVisible, setPanelVisible] = useState(false);
  const [buttonActive, setbuttonActive] = useState(false); // controls button color
  const [items, setItems] = useState(checkboxItems);

  const slideAnim = useRef(new Animated.Value(0)).current; // Initialize slide animation value

  const toggleItem = (id: any) => {
    const updatedItems = items.map(item => 
      item.id === id ? { ...item, checked: !item.checked } : item
    );
    setItems(updatedItems);
    onSelect(updatedItems);
  };


  // useEffect(() => {
  //     // const menu = [{'name': 'Late Summer Salad', 'description': 'Mixed greens, roasted beets, goat cheese, candied walnuts, balsamic vinaigrette', 'listed_ingredients': ['mixed greens', 'roasted beets', 'goat cheese', 'candied walnuts', 'balsamic vinaigrette'], 'typical_ingredients': ['mixed greens', 'beets', 'goat cheese', 'walnuts', 'balsamic vinegar', 'olive oil'], 'allergens': ['walnuts'], 'price': '$12'}, {'name': 'Grilled Chicken Sandwich', 'description': 'Grilled chicken, lettuce, tomato, mayo, on a brioche bun', 'listed_ingredients': ['grilled chicken', 'lettuce', 'tomato', 'mayo', 'brioche bun'], 'typical_ingredients': ['chicken', 'lettuce', 'tomato', 'mayonnaise', 'brioche bun'], 'allergens': [], 'price': '$14'}, {'name': 'Penne alla Vodka', 'description': 'Penne pasta in a creamy tomato-vodka sauce, with parmesan', 'listed_ingredients': ['penne pasta', 'tomato-vodka sauce', 'parmesan'], 'typical_ingredients': ['penne pasta', 'tomatoes', 'vodka', 'cream', 'parmesan cheese'], 'allergens': [], 'price': '$16'}, {'name': 'Farinata Bruschetta', 'description': 'Whipped Ricotta, Pesto, Figs, Tomato Balsamic, Trapanese', 'listed_ingredients': ['Whipped Ricotta', 'Pesto', 'Figs', 'Tomato Balsamic', 'Trapanese'], 'typical_ingredients': ['Chickpea flour', 'Olive oil', 'Garlic', 'Rosemary', 'Ricotta', 'Basil pesto', 'Figs', 'Tomatoes', 'Balsamic vinegar'], 'allergens': ['nuts'], 'price': '$22'}, {'name': 'Accanto Salad', 'description': 'Avocado, Tomatillo, Cashews', 'listed_ingredients': ['Avocado', 'Tomatillo', 'Cashews'], 'typical_ingredients': ['Avocado', 'Tomatillo', 'Cashews'], 'allergens': ['nuts'], 'price': '$19'}, {'name': 'Tuscan Melon Salad', 'description': 'Flavor Bomb Tomatoes', 'listed_ingredients': ['Flavor Bomb Tomatoes'], 'typical_ingredients': ['Cantaloupe', 'Honeydew', 'Tomatoes'], 'allergens': [], 'price': '$22'}, {'name': 'Wild Salmon Crudi', 'description': 'Blood Orange', 'listed_ingredients': ['Blood Orange'], 'typical_ingredients': ['Wild salmon', 'Blood orange'], 'allergens': [], 'price': '$22'}, {'name': 'Prosciutto & Melon', 'description': 'Aged Parmesan', 'listed_ingredients': ['Aged Parmesan'], 'typical_ingredients': ['Prosciutto', 'Melon', 'Parmesan'], 'allergens': [], 'price': '$19'}, {'name': 'Artichokes Alla Giudia', 'description': 'Lemon Garlic Aioli', 'listed_ingredients': ['Lemon Garlic Aioli'], 'typical_ingredients': ['Artichokes', 'Lemon', 'Garlic', 'Mayonnaise'], 'allergens': [], 'price': '$24'}, {'name': 'Late Summer Corn', 'description': 'Chanterelles', 'listed_ingredients': ['Chanterelles'], 'typical_ingredients': ['Corn', 'Chanterelle mushrooms'], 'allergens': [], 'price': '$19'}, {'name': 'Broccolini', 'description': 'Mostarda', 'listed_ingredients': ['Mostarda'], 'typical_ingredients': ['Broccolini', 'Mustard', 'Vinegar', 'Sugar'], 'allergens': [], 'price': '$18'}, {'name': 'Frittata in Crosta', 'description': 'Aged Parmesan', 'listed_ingredients': ['Aged Parmesan'], 'typical_ingredients': ['Eggs', 'Parmesan'], 'allergens': [], 'price': '$20'}, {'name': 'Savory Pistachio Torta', 'description': 'Fior di Latte', 'listed_ingredients': ['Fior di Latte'], 'typical_ingredients': ['Pistachios', 'Cheese'], 'allergens': ['nuts'], 'price': '$22'}, {'name': 'Cacio E Pepe', 'description': 'Spaghettoni', 'listed_ingredients': ['Spaghettoni'], 'typical_ingredients': ['Spaghetti', 'Pecorino Romano', 'Black pepper'], 'allergens': [], 'price': '$24'}, {'name': 'Rigatoni', 'description': '', 'listed_ingredients': [], 'typical_ingredients': ['Rigatoni pasta'], 'allergens': [], 'price': '$23'}, {'name': 'Grilled Shrimp', 'description': 'Trapenese Pesto', 'listed_ingredients': ['Trapenese Pesto'], 'typical_ingredients': ['Shrimp', 'Basil pesto'], 'allergens': ['nuts'], 'price': ''}, {'name': 'Chicken Alla Limone', 'listed_ingredients': ['Capers'], 'typical_ingredients': ['Chicken', 'Lemon', 'Olive Oil', 'Garlic', 'Parsley'], 'allergens': ['Capers'], 'price': '$32'}, {'name': 'Leonti Meatball', 'listed_ingredients': ['Ricotta'], 'typical_ingredients': ['Ground Beef', 'Breadcrumbs', 'Parmesan', 'Parsley', 'Egg'], 'allergens': [], 'price': '$22'}, {'name': 'Margherita', 'listed_ingredients': [], 'typical_ingredients': ['Tomato Sauce', 'Mozzarella', 'Basil'], 'allergens': [], 'price': '$28'}, {'name': 'Squash Blossoms', 'listed_ingredients': [], 'typical_ingredients': ['Squash Blossoms', 'Ricotta', 'Parmesan', 'Lemon Zest'], 'allergens': [], 'price': '$34'}, {'name': 'Sausage', 'listed_ingredients': [], 'typical_ingredients': ['Italian Sausage', 'Tomato Sauce', 'Mozzarella'], 'allergens': [], 'price': '$30'}, {'name': 'Focaccia della Casa', 'listed_ingredients': ['whipped ricotta'], 'typical_ingredients': ['Flour', 'Yeast', 'Olive Oil', 'Salt', 'Rosemary'], 'allergens': [], 'price': '$14'}, {'name': 'Raviolo Fornografia', 'listed_ingredients': ['balsamico'], 'typical_ingredients': ['Pasta Dough', 'Ricotta', 'Parmesan', 'Egg', 'Balsamic Vinegar'], 'allergens': [], 'price': '$24'}, {'name': 'Zucchini Flowers', 'listed_ingredients': ['lemon-potato mousse'], 'typical_ingredients': ['Zucchini Blossoms', 'Lemon', 'Potato', 'Ricotta'], 'allergens': [], 'price': '$28'}, {'name': 'Eggplant Parmigiana', 'listed_ingredients': ['ricotta'], 'typical_ingredients': ['Eggplant', 'Tomato Sauce', 'Mozzarella', 'Parmesan', 'Breadcrumbs'], 'allergens': [], 'price': '$24'}, {'name': 'Charred Octopus', 'listed_ingredients': ['fennel'], 'typical_ingredients': ['Octopus', 'Olive Oil', 'Lemon', 'Parsley'], 'allergens': [], 'price': '$28'}, {'name': 'Summer Shrimp', 'listed_ingredients': ['corn', 'peppers'], 'typical_ingredients': ['Shrimp', 'Corn', 'Bell Peppers', 'Olive Oil', 'Garlic', 'Parsley'], 'allergens': [], 'price': '$28'}]
  
  //     results.forEach(item => {
  //       item.allergens.length != 0 ? setUnsafeResults((prevItems) => [...prevItems, item]) : setSafeResults((prevItems) => [...prevItems, item]);
  //     })
  //     console.log("*********")
  //     console.log(safeResults)
  //     console.log("*********")
  //     console.log(unsafeResults)
      
  //   }, [items]);

  const selectedCount = items.filter((item: any) => item.checked).length;

  const openPanel = () => {
    setbuttonActive(true);
    setPanelVisible(true);
    Animated.timing(slideAnim, {
      toValue: 1,
      duration: 300,
      easing: Easing.out(Easing.exp),
      useNativeDriver: true,
    }).start();
  };

  const closePanel = () => {
    setbuttonActive(false);
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      easing: Easing.in(Easing.exp),
      useNativeDriver: true,
    }).start(() => setPanelVisible(false));
  };

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [500, 0], // Slide up from 500px to 0px (fully visible)
  });

  const panelDescription = name === "Allergens" ? "Select what you are allergic to:" : "Select what dietary resrictions you have:"

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[
          styles.button,
          {
            backgroundColor:
              buttonActive || selectedCount > 0 ? "#4d7f38" : "#fff",
          },
        ]}
        onPress={openPanel}
      >
        <Text
          style={[
            styles.buttonText,
            { color: buttonActive || selectedCount > 0 ? "#fff" : "#000000" }, // Toggle button color
          ]}
        >
          {selectedCount > 0
            ? `${name} (${selectedCount})`
            : `${name}`}
        </Text>
        <Icon
          style={[
            styles.arrow,
            { color: buttonActive || selectedCount > 0 ? "#fff" : "#000000" },
          ]}
          name={panelVisible ? "keyboard-arrow-up" : "keyboard-arrow-down"}
          size={18}
        />
      </TouchableOpacity>

      <Modal
        transparent={true}
        visible={panelVisible}
        animationType="fade"
        testID="filter-panel-modal"
      >
        <Pressable style={styles.overlay} onPress={closePanel} />
        <Animated.View
          style={[
            styles.panel,
            { transform: [{ translateY }] }, // Apply sliding animation
          ]}
        >
          <Text style={styles.panelHeader}>{panelDescription}</Text>
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <CheckBox
                title={item.label}
                checked={item.checked}
                onPress={() => toggleItem(item.id)}
                containerStyle={styles.checkboxContainer}
                textStyle={styles.checkboxText}
              />
            )}
          />
        </Animated.View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginRight: 10,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: "#DDD",
  },
  buttonText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  panel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 450,
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    elevation: 10,
  },
  panelHeader: {
    fontFamily: "Inter_400Regular",
    fontSize: 18,
    marginBottom: 10,
    textAlign: "center",
  },
  checkboxContainer: {
    backgroundColor: "transparent",
    borderWidth: 0,
  },
  checkboxText: {
    fontFamily: "Inter_400Regular",
    fontSize: 16,
  },
  arrow: {
    marginLeft: 5,
  },
});

export default FilterComponent;
