import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
// import { useSearchParams, router } from 'expo-router';
import MenuItemsScreen from "@/components/MenuItemsScreen";
import { router } from "expo-router";// HelpScreen.tsx
// import React, { useState } from 'react';


export default function MenuItems() {
  return (
    <MenuItemsScreen placeId={''} />
  );
}
