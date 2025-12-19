import { Image } from 'expo-image';
import { Platform, StyleSheet, View, TouchableOpacity, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Collapsible } from '@/components/ui/collapsible';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function ExploreScreen() {
  return (
    <ScrollView style={styles.container}>
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}>
        <View style={styles.headerContent}>
          <IconSymbol size={60} name="sparkles" color="#fff" />
          <ThemedText style={styles.headerTitle}>Keystore Protocol</ThemedText>
          <ThemedText style={styles.headerSubtitle}>
            Biometric Key Infrastructure for Solana
          </ThemedText>
        </View>
      </LinearGradient>

      <View style={styles.content}>
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>🔐 What is Keystore?</ThemedText>
          <ThemedText style={styles.sectionText}>
            Keystore is a biometric key infrastructure service that enables developers to create secure, 
            passwordless authentication for Solana applications using Face ID, Touch ID, or Windows Hello.
          </ThemedText>
        </View>

        <View style={styles.featureGrid}>
          <View style={styles.featureCard}>
            <View style={[styles.featureIcon, { backgroundColor: '#667eea' }]}>
              <IconSymbol size={32} name="faceid" color="#fff" />
            </View>
            <ThemedText style={styles.featureTitle}>Biometric Auth</ThemedText>
            <ThemedText style={styles.featureDescription}>
              Use Face ID or fingerprint to sign transactions
            </ThemedText>
          </View>

          <View style={styles.featureCard}>
            <View style={[styles.featureIcon, { backgroundColor: '#10B981' }]}>
              <IconSymbol size={32} name="lock.shield.fill" color="#fff" />
            </View>
            <ThemedText style={styles.featureTitle}>Hardware Security</ThemedText>
            <ThemedText style={styles.featureDescription}>
              Keys stored in secure enclave, never exposed
            </ThemedText>
          </View>

          <View style={styles.featureCard}>
            <View style={[styles.featureIcon, { backgroundColor: '#F59E0B' }]}>
              <IconSymbol size={32} name="bolt.fill" color="#fff" />
            </View>
            <ThemedText style={styles.featureTitle}>secp256r1</ThemedText>
            <ThemedText style={styles.featureDescription}>
              Native Solana precompile for verification
            </ThemedText>
          </View>

          <View style={styles.featureCard}>
            <View style={[styles.featureIcon, { backgroundColor: '#EF4444' }]}>
              <IconSymbol size={32} name="key.fill" color="#fff" />
            </View>
            <ThemedText style={styles.featureTitle}>No Seed Phrases</ThemedText>
            <ThemedText style={styles.featureDescription}>
              Eliminate the risk of lost or stolen keys
            </ThemedText>
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>💡 How It Works</ThemedText>
          
          <View style={styles.stepCard}>
            <View style={styles.stepNumber}>
              <ThemedText style={styles.stepNumberText}>1</ThemedText>
            </View>
            <View style={styles.stepContent}>
              <ThemedText style={styles.stepTitle}>Create Passkey</ThemedText>
              <ThemedText style={styles.stepDescription}>
                User creates a passkey using WebAuthn. The private key is generated and stored in the device's secure enclave.
              </ThemedText>
            </View>
          </View>

          <View style={styles.stepCard}>
            <View style={styles.stepNumber}>
              <ThemedText style={styles.stepNumberText}>2</ThemedText>
            </View>
            <View style={styles.stepContent}>
              <ThemedText style={styles.stepTitle}>Initialize Identity</ThemedText>
              <ThemedText style={styles.stepDescription}>
                Public key is registered on-chain in an Identity account, creating a vault PDA for holding funds.
              </ThemedText>
            </View>
          </View>

          <View style={styles.stepCard}>
            <View style={styles.stepNumber}>
              <ThemedText style={styles.stepNumberText}>3</ThemedText>
            </View>
            <View style={styles.stepContent}>
              <ThemedText style={styles.stepTitle}>Sign Transactions</ThemedText>
              <ThemedText style={styles.stepDescription}>
                User authenticates with biometrics. Signature is verified on-chain using Solana's secp256r1 precompile.
              </ThemedText>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>🚀 Use Cases</ThemedText>
          
          <View style={styles.useCaseCard}>
            <IconSymbol size={24} name="wallet.pass.fill" color="#667eea" />
            <View style={styles.useCaseContent}>
              <ThemedText style={styles.useCaseTitle}>Consumer Wallets</ThemedText>
              <ThemedText style={styles.useCaseText}>
                Onboard users without seed phrases. Just Face ID to transact.
              </ThemedText>
            </View>
          </View>

          <View style={styles.useCaseCard}>
            <IconSymbol size={24} name="building.2.fill" color="#10B981" />
            <View style={styles.useCaseContent}>
              <ThemedText style={styles.useCaseTitle}>Enterprise Auth</ThemedText>
              <ThemedText style={styles.useCaseText}>
                Secure employee access to corporate treasuries with multi-sig.
              </ThemedText>
            </View>
          </View>

          <View style={styles.useCaseCard}>
            <IconSymbol size={24} name="gamecontroller.fill" color="#F59E0B" />
            <View style={styles.useCaseContent}>
              <ThemedText style={styles.useCaseTitle}>Gaming</ThemedText>
              <ThemedText style={styles.useCaseText}>
                Seamless in-game transactions without disrupting gameplay.
              </ThemedText>
            </View>
          </View>

          <View style={styles.useCaseCard}>
            <IconSymbol size={24} name="cart.fill" color="#EF4444" />
            <View style={styles.useCaseContent}>
              <ThemedText style={styles.useCaseTitle}>E-Commerce</ThemedText>
              <ThemedText style={styles.useCaseText}>
                One-tap checkout with biometric confirmation.
              </ThemedText>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>💰 Pricing Model</ThemedText>
          <ThemedText style={styles.sectionText}>
            Keystore operates as a micro-fee infrastructure service:
          </ThemedText>
          
          <View style={styles.pricingCard}>
            <View style={styles.pricingRow}>
              <ThemedText style={styles.pricingLabel}>Identity Creation</ThemedText>
              <ThemedText style={styles.pricingValue}>0.001 SOL</ThemedText>
            </View>
            <View style={styles.pricingRow}>
              <ThemedText style={styles.pricingLabel}>Transaction Relay</ThemedText>
              <ThemedText style={styles.pricingValue}>0.0001 SOL</ThemedText>
            </View>
            <View style={styles.pricingRow}>
              <ThemedText style={styles.pricingLabel}>Add Key</ThemedText>
              <ThemedText style={styles.pricingValue}>Free</ThemedText>
            </View>
          </View>
        </View>

        <View style={styles.techSection}>
          <ThemedText style={styles.sectionTitle}>🛠️ Tech Stack</ThemedText>
          
          <View style={styles.techCard}>
            <ThemedText style={styles.techCategory}>On-Chain</ThemedText>
            <View style={styles.techTags}>
              <View style={styles.techTag}>
                <ThemedText style={styles.techTagText}>Anchor 0.30</ThemedText>
              </View>
              <View style={styles.techTag}>
                <ThemedText style={styles.techTagText}>Solana 1.18</ThemedText>
              </View>
              <View style={styles.techTag}>
                <ThemedText style={styles.techTagText}>secp256r1</ThemedText>
              </View>
            </View>
          </View>

          <View style={styles.techCard}>
            <ThemedText style={styles.techCategory}>Frontend</ThemedText>
            <View style={styles.techTags}>
              <View style={styles.techTag}>
                <ThemedText style={styles.techTagText}>React Native</ThemedText>
              </View>
              <View style={styles.techTag}>
                <ThemedText style={styles.techTagText}>Expo</ThemedText>
              </View>
              <View style={styles.techTag}>
                <ThemedText style={styles.techTagText}>WebAuthn</ThemedText>
              </View>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  headerContent: {
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.9,
    textAlign: 'center',
  },
  content: {
    padding: 24,
    gap: 32,
  },
  section: {
    gap: 16,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#333',
  },
  sectionText: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
  },
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  featureCard: {
    flex: 1,
    minWidth: 150,
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  featureIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  featureDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  stepCard: {
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
  stepNumber: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#667eea',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
  },
  stepContent: {
    flex: 1,
    gap: 8,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  stepDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  useCaseCard: {
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
  useCaseContent: {
    flex: 1,
    gap: 4,
  },
  useCaseTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  useCaseText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  pricingCard: {
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
  pricingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  pricingLabel: {
    fontSize: 16,
    color: '#666',
  },
  pricingValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#667eea',
  },
  techSection: {
    gap: 16,
  },
  techCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  techCategory: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  techTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  techTag: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  techTagText: {
    fontSize: 14,
    color: '#667eea',
    fontWeight: '600',
  },
});
