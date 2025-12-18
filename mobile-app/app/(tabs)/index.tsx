import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, Alert, Platform, StyleSheet, TouchableOpacity } from 'react-native';

import { HelloWave } from '@/components/hello-wave';
import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { createPasskey, storeCredential } from '@/lib/passkey';
import { Link, useRouter } from 'expo-router';

export default function HomeScreen() {
  const router = useRouter();
  const [status, setStatus] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastError, setLastError] = useState<string>('');
  const [lastSuccess, setLastSuccess] = useState<string>('');
  const [debugInfo, setDebugInfo] = useState<string>('');

  async function handleCreatePasskey() {
    setIsLoading(true);
    setLastError('');
    setLastSuccess('');
    setDebugInfo('');
    setStatus('Starting passkey creation...');
    try {
      setStatus(`Platform: ${Platform.OS}`);
      
      // Create passkey for the user
      const username = 'mariotaning@gmail.com';
      setStatus(`Creating passkey for ${username}...`);
      
      const credential = await createPasskey(username);
      
      // Display debug info
      if (credential.debug) {
        setDebugInfo(
          `Debug Info:\n` +
          `Challenge: ${credential.debug.challenge.substring(0, 40)}...\n` +
          `Challenge Length: ${credential.debug.challengeLength}\n` +
          `UserId: ${credential.debug.userId.substring(0, 40)}...\n` +
          `UserId Length: ${credential.debug.userIdLength}`
        );
      }
      
      setStatus('Passkey created! Storing credential...');
      
      // Store the credential
      storeCredential({
        credentialId: Array.from(credential.credentialId),
        publicKey: Array.from(credential.publicKey),
        owner: username,
      });
      
      const successMsg = `✅ Success!\nCredential ID: ${credential.credentialId.length} bytes\nPublic Key: ${credential.publicKey.length} bytes`;
      setStatus('✅ Passkey created and stored successfully!');
      setLastSuccess(successMsg);
      setIsLoading(false);
      
      Alert.alert(
        'Success!',
        'Passkey created and stored successfully',
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      console.error('Passkey creation failed:', error);
      
      const errorMsg = error.message || error.toString() || 'Failed to create passkey';
      //setStatus(`❌ Error: ${errorMsg}`);
      setLastError(errorMsg);
      setIsLoading(false);
      
      Alert.alert(
        'Error',
        errorMsg,
        [{ text: 'OK' }]
      );
    }
  }

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#A1CEDC', dark: '#1D3D47' }}
      headerImage={
        <Image
          source={require('@/assets/images/partial-react-logo.png')}
          style={styles.reactLogo}
        />
      }>
      {/*Create Passkey Interaction*/}
      <ThemedView style={{ marginBottom: 16 }}>
        <TouchableOpacity 
          style={[styles.secureButton, styles.passkeyButton]}
          onPress={handleCreatePasskey}
          disabled={isLoading}>
          {isLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <IconSymbol size={32} name="key.fill" color="#fff" />
          )}
          <ThemedView style={styles.secureButtonTextContainer}>
            <ThemedText style={styles.secureButtonTitle}>Create Passkey MFers</ThemedText>
            <ThemedText style={styles.secureButtonSubtitle}>Generate WebAuthn credential</ThemedText>
          </ThemedView>
          {!isLoading && <IconSymbol size={24} name="plus.circle.fill" color="#fff" />}
        </TouchableOpacity>
      </ThemedView>
      {status !== '' && (
        <ThemedView style={styles.statusBox}>
          <ThemedText type="subtitle" style={styles.statusBoxTitle}>Status</ThemedText>
          <ThemedText style={styles.statusBoxText}>{status}</ThemedText>
          {isLoading && (
            <ThemedView style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <ThemedText style={styles.loadingText}>Processing...</ThemedText>
            </ThemedView>
          )}
        </ThemedView>
      )}
      
      {lastSuccess !== '' && (
        <ThemedView style={styles.successBox}>
          <IconSymbol size={24} name="checkmark.circle.fill" color="#10B981" />
          <ThemedText style={styles.successText}>{lastSuccess}</ThemedText>
        </ThemedView>
      )}
      
      {lastError !== '' && (
        <ThemedView style={styles.errorBox}>
          <IconSymbol size={24} name="xmark.circle.fill" color="#EF4444" />
          <ThemedText style={styles.errorText}>{lastError}</ThemedText>
        </ThemedView>
      )}
      
      {debugInfo !== '' && (
        <ThemedView style={styles.debugBox}>
          <ThemedText type="subtitle" style={styles.debugTitle}>Debug Values</ThemedText>
          <ThemedText style={styles.debugText}>{debugInfo}</ThemedText>
        </ThemedView>
      )}

      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">Welcome!</ThemedText>
        <HelloWave />
      </ThemedView>
      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">Step 1: Try it</ThemedText>
        <ThemedText>
          Edit <ThemedText type="defaultSemiBold">app/(tabs)/index.tsx</ThemedText> to see changes.
          Press{' '}
          <ThemedText type="defaultSemiBold">
            {Platform.select({
              ios: 'cmd + d',
              android: 'cmd + m',
              web: 'F12',
            })}
          </ThemedText>{' '}
          to open developer tools.
        </ThemedText>
      </ThemedView>
      <ThemedView style={styles.stepContainer}>
        <Link href="/modal">
          <Link.Trigger>
            <ThemedText type="subtitle">Step 2: Explore</ThemedText>
          </Link.Trigger>
          <Link.Preview />
          <Link.Menu>
            <Link.MenuAction title="Action" icon="cube" onPress={() => alert('Action pressed')} />
            <Link.MenuAction
              title="Share"
              icon="square.and.arrow.up"
              onPress={() => alert('Share pressed')}
            />
            <Link.Menu title="More" icon="ellipsis">
              <Link.MenuAction
                title="Delete"
                icon="trash"
                destructive
                onPress={() => alert('Delete pressed')}
              />
            </Link.Menu>
          </Link.Menu>
        </Link>

        <ThemedText>
          {`Tap the Explore tab to learn more about what's included in this starter app.`}
        </ThemedText>
      </ThemedView>
      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">Step 3: Get a fresh start</ThemedText>
        <ThemedText>
          {`When you're ready, run `}
          <ThemedText type="defaultSemiBold">npm run reset-project</ThemedText> to get a fresh{' '}
          <ThemedText type="defaultSemiBold">app</ThemedText> directory. This will move the current{' '}
          <ThemedText type="defaultSemiBold">app</ThemedText> to{' '}
          <ThemedText type="defaultSemiBold">app-example</ThemedText>.
        </ThemedText>
      </ThemedView>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepContainer: {
    gap: 8,
    marginBottom: 8,
  },
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: 'absolute',
  },
  secureButtonContainer: {
    marginVertical: 20,
    gap: 16,
  },
  secureButton: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  secureButtonTextContainer: {
    flex: 1,
    backgroundColor: 'transparent',
    gap: 4,
  },
  secureButtonTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  secureButtonSubtitle: {
    color: '#fff',
    fontSize: 14,
    opacity: 0.85,
  },
  passkeyButton: {
    backgroundColor: '#10B981',
  },
  statusContainer: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    marginBottom: 12,
  },
  statusTitle: {
    marginBottom: 4,
  },
  statusText: {
    fontSize: 14,
    opacity: 0.8,
  },
  statusBox: {
    backgroundColor: 'rgba(249, 115, 22, 0.1)',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    marginTop: 16,
  },
  statusBoxTitle: {
    color: '#F97316',
  },
  statusBoxText: {
    fontSize: 14,
    lineHeight: 20,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '600',
  },
  successBox: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: 16,
  },
  successText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: '#10B981',
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: 16,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: '#EF4444',
  },
  debugBox: {
    backgroundColor: 'rgba(147, 51, 234, 0.1)',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    marginTop: 16,
  },
  debugTitle: {
    color: '#9333EA',
  },
  debugText: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'monospace',
    color: '#9333EA',
  },
});
