import axios from 'axios';
import { API } from '../config/apiConfig';
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Button, ScrollView, FlatList, Text, StatusBar, TouchableOpacity, ActivityIndicator } from 'react-native';

type Props = {
    placeId: string;
}

export default function MenuItemScreen({ placeId }: Props) {

    const [menuItems, setMenuItems] = useState<any[]>([]); 

    const fetchMenuItems = async (placeId: string) => {
        console.log("MenuItemsScreen placeId: ", placeId);

        const queryRestaurantsApiEndpoint = API.getMenuItems;

        try {
            const response1 = await axios.post(queryRestaurantsApiEndpoint,  {
                placeId: placeId
            });

            setMenuItems(response1.data.menuItems);
            console.log("Fetched menu items: ", response1.data.menuItems);
        } catch (error) {
            console.error("Error fetching restaurant data: ", error);
        }
    }

    useEffect(() => {
        
        fetchMenuItems(placeId);

      }, [placeId]);

    return (
        <Text>Menu Items Screen</Text>
    )
}
