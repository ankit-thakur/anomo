
import React, { useContext, useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, TouchableOpacity } from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { useRouter } from 'expo-router';

export default function SignUpScreen() {
  const { signUp, confirmSignUp, signIn } = useContext(AuthContext);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'signup'|'confirm'>('signup');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const onSignUp = async () => {
    if (!name) {
      setError('Name is required');
      return;
    }
    try {
      await signUp(email, password, { given_name: name });
      setStage('confirm');
    } catch (e: any) {
      setError(e?.message || 'Sign up failed');
    }
  };

  const onConfirm = async () => {
    try {
      await confirmSignUp(email, code);
      // Auto sign in after confirmation
      await signIn(email, password);
      router.replace('/home');
    } catch (e: any) {
      setError(e?.message || 'Confirmation failed');
    }
  };

  const goToSignIn = () => {
    router.replace('/signin');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign Up</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {stage === 'signup' ? (
        <>
          <TextInput placeholder="Name" value={name} onChangeText={setName} style={styles.input} />
          <TextInput placeholder="Email" value={email} onChangeText={setEmail} style={styles.input} />
          <TextInput placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry style={styles.input} />
          <Button title="Create Account" onPress={onSignUp} />
          <View style={styles.footer}>
            <Text>Already have an account? </Text>
            <TouchableOpacity onPress={goToSignIn}>
              <Text style={styles.link}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <>
          <TextInput placeholder="Confirmation Code" value={code} onChangeText={setCode} style={styles.input} />
          <Button title="Confirm" onPress={onConfirm} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, justifyContent: 'center' },
  input: { borderWidth: 1, padding: 8, marginVertical: 8 },
  title: { fontSize: 24, marginBottom: 16 },
  error: { color: 'red', marginBottom: 8 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  link: {
    color: '#007AFF',
  },
});
