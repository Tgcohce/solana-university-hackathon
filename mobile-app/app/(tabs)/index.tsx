import { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
  TextInput,
  Modal,
  ScrollView,
  Pressable,
  Clipboard,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { createPasskey, storeCredential, getStoredCredential, signWithPasskey, StoredCredential } from '@/lib/passkey';
import { getConnection, formatAddress, formatSOL, getBalance, requestAirdrop, getIdentityPDA, getVaultPDA, PROGRAM_ID } from '@/lib/solana';
import { PublicKey, Keypair } from '@solana/web3.js';
import { KeystoreClient } from '@/lib/keystore';

type WalletState = 'none' | 'creating' | 'ready';

export default function WalletScreen() {
  const [walletState, setWalletState] = useState<WalletState>('none');
  const [isLoading, setIsLoading] = useState(false);
  const [balance, setBalance] = useState<number>(0);
  const [vaultAddress, setVaultAddress] = useState<string>('');
  const [identityAddress, setIdentityAddress] = useState<string>('');
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendAmount, setSendAmount] = useState('');
  const [sendTo, setSendTo] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [credential, setCredential] = useState<StoredCredential | null>(null);

  const connection = getConnection('devnet');

  useEffect(() => {
    checkExistingWallet();
  }, []);

  useEffect(() => {
    if (walletState === 'ready' && vaultAddress) {
      const interval = setInterval(fetchBalance, 5000);
      fetchBalance();
      return () => clearInterval(interval);
    }
  }, [walletState, vaultAddress]);

  async function checkExistingWallet() {
    const stored = getStoredCredential();
    if (stored) {
      setCredential(stored);
      // Derive addresses
      const tempKeypair = Keypair.generate();
      const [identity] = getIdentityPDA(tempKeypair.publicKey);
      const [vault] = getVaultPDA(identity);
      setIdentityAddress(identity.toBase58());
      setVaultAddress(vault.toBase58());
      setWalletState('ready');
    }
  }

  async function fetchBalance() {
    if (!vaultAddress) return;
    try {
      const bal = await getBalance(connection, new PublicKey(vaultAddress));
      setBalance(bal);
    } catch (error) {
      console.error('Failed to fetch balance:', error);
    }
  }

  async function handleCreateWallet() {
    setIsLoading(true);
    try {
      // Create passkey
      const username = 'wallet@keystore';
      const passkeyCredential = await createPasskey(username);

      // Store credential
      storeCredential({
        credentialId: Array.from(passkeyCredential.credentialId),
        publicKey: Array.from(passkeyCredential.publicKey),
        owner: username,
      });

      setCredential({
        credentialId: Array.from(passkeyCredential.credentialId),
        publicKey: Array.from(passkeyCredential.publicKey),
        owner: username,
      });

      // For demo: derive identity and vault addresses
      // In production, you'd create the on-chain account here
      const tempKeypair = Keypair.generate();
      const [identity] = getIdentityPDA(tempKeypair.publicKey);
      const [vault] = getVaultPDA(identity);
      
      setIdentityAddress(identity.toBase58());
      setVaultAddress(vault.toBase58());
      setWalletState('ready');

      Alert.alert(
        '🎉 Wallet Created!',
        'Your biometric wallet is ready. Use Face ID or fingerprint to sign transactions.',
        [{ text: 'Got it!' }]
      );
    } catch (error: any) {
      console.error('Wallet creation failed:', error);
      Alert.alert('Error', error.message || 'Failed to create wallet');
    }
    setIsLoading(false);
  }

  async function handleAirdrop() {
    if (!vaultAddress) return;
    setIsLoading(true);
    try {
      await requestAirdrop(connection, new PublicKey(vaultAddress), 1);
      Alert.alert('Success', 'Airdropped 1 SOL to your wallet!');
      fetchBalance();
    } catch (error: any) {
      console.error('Airdrop failed:', error);
      Alert.alert('Error', 'Airdrop failed. Rate limit may have been exceeded.');
    }
    setIsLoading(false);
  }

  async function handleSendTransaction() {
    if (!credential || !vaultAddress || !identityAddress) return;
    setIsSending(true);
    try {
      const lamports = Math.floor(parseFloat(sendAmount) * 1e9);
      const to = new PublicKey(sendTo);
      
      // This would require a relayer for fee payment
      // For demo, we'll show the signature flow
      Alert.alert(
        '🎉 Demo Mode',
        `Transaction prepared!\n\nAmount: ${sendAmount} SOL\nTo: ${formatAddress(sendTo, 6)}\n\nIn production, this would be sent to a relayer or require fee payment.`,
        [{ text: 'OK' }]
      );

      setShowSendModal(false);
      setSendAmount('');
      setSendTo('');
    } catch (error: any) {
      console.error('Send failed:', error);
      Alert.alert('Error', error.message || 'Transaction failed');
    }
    setIsSending(false);
  }

  function handleCopyAddress() {
    if (!vaultAddress) return;
    if (Platform.OS === 'web') {
      navigator.clipboard.writeText(vaultAddress);
    } else {
      Clipboard.setString(vaultAddress);
    }
    Alert.alert('Copied!', 'Wallet address copied to clipboard');
  }

  if (walletState === 'none') {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#667eea', '#764ba2', '#f093fb']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}>
          <View style={styles.centerContent}>
            <View style={styles.iconContainer}>
              <IconSymbol size={80} name="lock.shield.fill" color="#fff" />
            </View>
            
            <ThemedText style={styles.title}>Keystore Wallet</ThemedText>
            <ThemedText style={styles.subtitle}>
              Biometric Solana Wallet
            </ThemedText>
            <ThemedText style={styles.description}>
              Create a secure wallet protected by Face ID or fingerprint. Your keys stay on your device.
            </ThemedText>

            <TouchableOpacity
              style={styles.createButton}
              onPress={handleCreateWallet}
              disabled={isLoading}>
              {isLoading ? (
                <ActivityIndicator size="small" color="#667eea" />
              ) : (
                <>
                  <IconSymbol size={24} name="plus.circle.fill" color="#667eea" />
                  <ThemedText style={styles.createButtonText}>
                    Create Wallet
                  </ThemedText>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.featureList}>
              <View style={styles.featureItem}>
                <IconSymbol size={20} name="checkmark.circle.fill" color="#fff" />
                <ThemedText style={styles.featureText}>
                  No seed phrases to remember
                </ThemedText>
              </View>
              <View style={styles.featureItem}>
                <IconSymbol size={20} name="checkmark.circle.fill" color="#fff" />
                <ThemedText style={styles.featureText}>
                  Biometric authentication
                </ThemedText>
              </View>
              <View style={styles.featureItem}>
                <IconSymbol size={20} name="checkmark.circle.fill" color="#fff" />
                <ThemedText style={styles.featureText}>
                  Secure hardware encryption
                </ThemedText>
              </View>
            </View>
          </View>
        </LinearGradient>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerTop}>
            <ThemedText style={styles.headerTitle}>My Wallet</ThemedText>
            <IconSymbol size={28} name="lock.shield.fill" color="#fff" />
          </View>
          
          <View style={styles.balanceCard}>
            <ThemedText style={styles.balanceLabel}>Total Balance</ThemedText>
            <ThemedText style={styles.balanceAmount}>
              {formatSOL(balance)} SOL
            </ThemedText>
            <ThemedText style={styles.balanceUSD}>
              ≈ ${(parseFloat(formatSOL(balance)) * 150).toFixed(2)} USD
            </ThemedText>
          </View>

          <TouchableOpacity
            style={styles.addressContainer}
            onPress={handleCopyAddress}>
            <ThemedText style={styles.addressText}>
              {formatAddress(vaultAddress, 8)}
            </ThemedText>
            <IconSymbol size={18} name="doc.on.doc" color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => setShowSendModal(true)}>
          <View style={[styles.actionIconContainer, styles.sendButton]}>
            <IconSymbol size={28} name="arrow.up.circle.fill" color="#fff" />
          </View>
          <ThemedText style={styles.actionLabel}>Send</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleCopyAddress}>
          <View style={[styles.actionIconContainer, styles.receiveButton]}>
            <IconSymbol size={28} name="arrow.down.circle.fill" color="#fff" />
          </View>
          <ThemedText style={styles.actionLabel}>Receive</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleAirdrop}
          disabled={isLoading}>
          <View style={[styles.actionIconContainer, styles.airdropButton]}>
            {isLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <IconSymbol size={28} name="gift.fill" color="#fff" />
            )}
          </View>
          <ThemedText style={styles.actionLabel}>Airdrop</ThemedText>
        </TouchableOpacity>
      </View>

      <View style={styles.infoSection}>
        <View style={styles.infoCard}>
          <IconSymbol size={24} name="info.circle.fill" color="#667eea" />
          <View style={styles.infoContent}>
            <ThemedText style={styles.infoTitle}>Biometric Security</ThemedText>
            <ThemedText style={styles.infoText}>
              All transactions require Face ID or fingerprint authentication
            </ThemedText>
          </View>
        </View>

        <View style={styles.infoCard}>
          <IconSymbol size={24} name="network" color="#10B981" />
          <View style={styles.infoContent}>
            <ThemedText style={styles.infoTitle}>Network</ThemedText>
            <ThemedText style={styles.infoText}>Solana Devnet</ThemedText>
          </View>
        </View>
      </View>

      {/* Send Modal */}
      <Modal
        visible={showSendModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSendModal(false)}>
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowSendModal(false)}>
          <Pressable style={styles.modalContent} onPress={e => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Send SOL</ThemedText>
              <TouchableOpacity onPress={() => setShowSendModal(false)}>
                <IconSymbol size={24} name="xmark.circle.fill" color="#999" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <ThemedText style={styles.inputLabel}>Amount (SOL)</ThemedText>
                <TextInput
                  style={styles.input}
                  placeholder="0.00"
                  placeholderTextColor="#999"
                  keyboardType="decimal-pad"
                  value={sendAmount}
                  onChangeText={setSendAmount}
                />
              </View>

              <View style={styles.inputGroup}>
                <ThemedText style={styles.inputLabel}>Recipient Address</ThemedText>
                <TextInput
                  style={styles.input}
                  placeholder="Solana address"
                  placeholderTextColor="#999"
                  value={sendTo}
                  onChangeText={setSendTo}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <TouchableOpacity
                style={styles.sendModalButton}
                onPress={handleSendTransaction}
                disabled={isSending || !sendAmount || !sendTo}>
                {isSending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <IconSymbol size={24} name="faceid" color="#fff" />
                    <ThemedText style={styles.sendModalButtonText}>
                      Authenticate & Send
                    </ThemedText>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  gradient: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 24,
  },
  centerContent: {
    alignItems: 'center',
    paddingTop: 40,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    opacity: 0.9,
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.85,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 30,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    marginBottom: 48,
  },
  createButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#667eea',
  },
  featureList: {
    gap: 16,
    width: '100%',
    paddingHorizontal: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.9,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 32,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  headerContent: {
    gap: 16,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
  },
  balanceCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    padding: 24,
    borderRadius: 20,
    alignItems: 'center',
    marginTop: 16,
  },
  balanceLabel: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.8,
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 48,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
  },
  balanceUSD: {
    fontSize: 18,
    color: '#fff',
    opacity: 0.7,
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  addressText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 24,
    paddingVertical: 32,
    gap: 16,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    gap: 12,
  },
  actionIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  sendButton: {
    backgroundColor: '#667eea',
  },
  receiveButton: {
    backgroundColor: '#10B981',
  },
  airdropButton: {
    backgroundColor: '#F59E0B',
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  infoSection: {
    paddingHorizontal: 24,
    gap: 16,
    paddingBottom: 32,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  infoContent: {
    flex: 1,
    gap: 4,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 24,
    paddingBottom: 40,
    paddingHorizontal: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#333',
  },
  modalBody: {
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#333',
  },
  sendModalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#667eea',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 12,
    marginTop: 8,
  },
  sendModalButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
