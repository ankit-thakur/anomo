import { router } from "expo-router";// HelpScreen.tsx
import React, { useState } from 'react';
import { API } from '../config/apiConfig';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, Linking, Platform } from 'react-native';
import Icon from "react-native-vector-icons/MaterialIcons";

export default function HelpScreen() {
  const [mode, setMode] = useState<'none' | 'issue' | 'feedback'>('none');
  const [text, setText] = useState('');
  const [emailInputText, setEmailInputText] = useState('');
  const [showEmailInputError, setShowEmailInputError] = useState(false);

  const submitToBackend = async () => {
    try {
      await fetch(API.updateUsers, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInputText, type: mode, content: text }),
      });
      alert('Thanks for your submission!');
      setMode('none');
      setText('');
    } catch (err) {
      alert('Error sending feedback.');
    }
  };

  const openEmail = () => {
    const email = 'ankitthakur78701@gmail.com';
    const subject = 'Inquiry for ANOMO team';
    const body = '';
    Linking.openURL(`mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  };

  const handleEmailInputChange = (input: string) => {
    setEmailInputText(input);
  };
  
  const isValidEmail = () => {
    setShowEmailInputError(false);

    if (!emailInputText || emailInputText.trim() === '') {
      setShowEmailInputError(false);
      return;
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(emailInputText.toLowerCase())) {
      setShowEmailInputError(true);
    }
  }

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
        
      {mode === 'none' && (
        <>
          <TouchableOpacity style={styles.option} onPress={() => setMode('issue')}>
            <Text style={styles.optionText}>Report an Issue</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.option} onPress={() => setMode('feedback')}>
            <Text style={styles.optionText}>Provide Feedback</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.option} onPress={openEmail}>
            <Text style={styles.optionText}>Contact the Team</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.option} onPress={() => router.push('/disclaimers')}>
            <Text style={styles.optionText}>Disclaimers</Text>
          </TouchableOpacity>
        </>
      )}

      {(mode === 'issue' || mode === 'feedback') && (
        <View style={styles.form}>
          <View>
            {showEmailInputError && (
              <Text style={styles.inputError}>
                Email format is invalid. Please try again.
              </Text>
            )}
            <TextInput
                editable
                multiline
                style={[styles.input, {minHeight: 10}]}
                onChangeText={input => handleEmailInputChange(input)}
                onBlur={() => isValidEmail()}
                value={emailInputText}
                placeholder="Enter email (optional)"
                placeholderTextColor="#808080"
            />
          </View>
          <View>
            <TextInput
              style={styles.input}
              placeholder="Enter your message..."
              placeholderTextColor="#808080"
              multiline
              value={text}
              onChangeText={setText}
            />
            <TouchableOpacity style={styles.submit} onPress={submitToBackend}>
              <Text style={styles.submitText}>Submit</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setMode('none')}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
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
  option: {
    padding: 15,
    backgroundColor: '#4d7f38',
    borderRadius: 8,
    marginBottom: 10,
  },
  optionText: { color: 'white', fontSize: 16 },
  form: { flex: 1 },
  input: {
    borderWidth: 1,
    backgroundColor: '#ffffffff',
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  submit: {
    backgroundColor: '#4d7f38',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitText: { color: 'white', fontWeight: 'bold' },
  cancelText: { marginTop: 10, textAlign: 'center', color: '#4d7f38' },
  inputText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    padding: 6,
    height: 45,
    width: '100%', // ensures it expands inside parent
  },
  inputError: {
    color: 'red',
    fontSize: 12,
  },
});
