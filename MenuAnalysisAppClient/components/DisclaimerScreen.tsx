import { router } from "expo-router";
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, Linking, Platform, ScrollView } from 'react-native';
import Icon from "react-native-vector-icons/MaterialIcons";


export default function DisclaimerScreen() {
    return (
        <View style={styles.container}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                <Icon
                    style={{ color: "#000" }}
                    name={"keyboard-arrow-left"}
                    size={18}
                />
                <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>

            <ScrollView>
                <Text style={styles.disclaimerText}>
                    The information provided in this app, including but not limited to allergen details, dietary suggestions, and 
                    ingredient recommendations, is for informational purposes only and is not intended as medical advice, diagnosis, 
                    or treatment.{'\n'}{'\n'}
                    While we make reasonable efforts to provide accurate and up-to-date information, we cannot guarantee 
                    that all allergen, ingredient, or dietary information is complete, reliable, or error-free. Food products and 
                    restaurant offerings may change at any time without notice.{'\n'}{'\n'}
                    Users should not rely solely on this app to make decisions regarding allergies, intolerances, or other medical 
                    conditions. Always consult a qualified healthcare professional for personalized medical advice and guidance 
                    regarding your specific health or dietary needs.{'\n'}{'\n'}
                    By using this app, you acknowledge and agree that:{'\n'}
                    {'\t'}1. You assume full responsibility for any decisions or actions taken based on the information provided.{'\n'}
                    {'\t'}2. ANOMO and its affiliates, partners, and contributors are not liable for any errors, omissions, misinterpretations, 
                    or consequences resulting from the use of this app.{'\n'}
                    {'\t'}3. You release and hold harmless ANOMO from any and all claims, damages, or liability, whether direct or indirect, 
                    arising from your reliance on the app or the information contained within it.{'\n'}{'\n'}
                    If you have or suspect you may have a medical condition, seek immediate advice from a licensed healthcare professional. Never delay, disregard, or avoid seeking medical advice because of something you read in this app.
                </Text>
            </ScrollView>
        </View>
    )
}

const styles = StyleSheet.create({
    container: { 
        flex: 1, 
        padding: 20, 
        backgroundColor: '#fff8e5',
    },
    backButton: {
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 8,
        paddingHorizontal: 15,
        borderRadius: 25,
        borderWidth: 1,
        borderColor: "#DDD",
        backgroundColor: "#fff",
        marginTop: Platform.OS === 'ios' ? 40 : 20,
        marginBottom: 16,
    },
    backButtonText: { 
        color: "#000", 
        fontSize: 16 
    },
    disclaimerText: {
        fontSize: 16,
        lineHeight: 24,
    }
});