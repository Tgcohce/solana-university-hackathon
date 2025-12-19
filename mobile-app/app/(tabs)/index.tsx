/**
 * Keystore Wallet - Main Screen
 * Matches the web app UI and functionality using the hosted API
 */

import { useState, useEffect, useCallback } from "react";
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
  Linking,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { LinearGradient } from "expo-linear-gradient";
import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { PublicKey } from "@solana/web3.js";

// Local imports
import {
  createPasskey,
  signWithPasskey,
  storeCredential,
  getStoredCredential,
  getDeviceName,
  StoredCredential,
} from "@/lib/passkey";
import {
  getConnection,
  formatAddress,
  lamportsToSOL,
  requestAirdrop,
} from "@/lib/solana";
import { getIdentityPDA, getVaultPDA } from "@/lib/keystore";
import {
  createIdentity,
  parseCreateIdentityResponse,
  executeTransaction,
  getIdentityInfo,
} from "@/lib/api";
import { buildMessage } from "@/lib/message";

type WalletStatus = "disconnected" | "creating" | "connected";

interface KeyInfo {
  name: string;
  pubkey: string;
}

export default function WalletScreen() {
  // Wallet state
  const [status, setStatus] = useState<WalletStatus>("disconnected");
  const [identity, setIdentity] = useState<PublicKey | null>(null);
  const [vault, setVault] = useState<PublicKey | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [keys, setKeys] = useState<KeyInfo[]>([]);
  const [threshold, setThreshold] = useState<number>(1);
  const [credential, setCredential] = useState<StoredCredential | null>(null);

  // UI state
  const [sending, setSending] = useState(false);
  const [sendAmount, setSendAmount] = useState("");
  const [sendTo, setSendTo] = useState("");
  const [showSend, setShowSend] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const connection = getConnection("devnet");

  // Check for existing wallet on mount
  useEffect(() => {
    checkExistingWallet();
  }, []);

  // Fetch balance periodically when connected
  useEffect(() => {
    if (vault) {
      const interval = setInterval(fetchBalance, 5000);
      fetchBalance();
      return () => clearInterval(interval);
    }
  }, [vault]);

  /**
   * Check for existing wallet credential
   */
  async function checkExistingWallet() {
    try {
      const stored = await getStoredCredential();
      if (stored) {
        console.log("Found stored credential:", stored.owner);
        setCredential(stored);

        const identityPDA = new PublicKey(stored.owner);
        const vaultPDA = getVaultPDA(identityPDA);

        setIdentity(identityPDA);
        setVault(vaultPDA);
        setStatus("connected");

        // Fetch account data via API
        try {
          const identityInfo = await getIdentityInfo(stored.owner);
          setThreshold(identityInfo.threshold);
          setKeys([
            {
              name: "This Device",
              pubkey:
                Buffer.from(stored.publicKey).toString("hex").slice(0, 16) +
                "...",
            },
          ]);
        } catch (e) {
          console.error("Failed to fetch identity info:", e);
          // Still show connected with default values
          setKeys([
            {
              name: "This Device",
              pubkey:
                Buffer.from(stored.publicKey).toString("hex").slice(0, 16) +
                "...",
            },
          ]);
        }
      }
    } catch (e) {
      console.error("Failed to check existing wallet:", e);
    }
  }

  /**
   * Fetch vault balance
   */
  async function fetchBalance() {
    if (!vault) return;
    try {
      const bal = await connection.getBalance(vault);
      setBalance(bal);
    } catch (e) {
      console.error("Failed to fetch balance:", e);
    }
  }

  /**
   * Create a new wallet with passkey
   */
  async function handleCreate() {
    setStatus("creating");
    setError(null);
    try {
      const deviceName = getDeviceName();
      console.log("Creating passkey...");

      // Create passkey
      const passkeyCredential = await createPasskey("keystore-user");
      console.log("Passkey created:", {
        publicKeyLength: passkeyCredential.publicKey.length,
        credentialIdLength: passkeyCredential.credentialId.length,
      });

      // Validate public key is 33 bytes
      if (passkeyCredential.publicKey.length !== 33) {
        throw new Error(
          `Invalid public key length: expected 33 bytes, got ${passkeyCredential.publicKey.length}`
        );
      }

      // Create identity on-chain via API
      console.log("Creating identity on-chain via API...");
      const response = await createIdentity(
        passkeyCredential.publicKey,
        deviceName
      );
      console.log("Identity created:", response);

      const { identity: newIdentity, vault: newVault, signature } =
        parseCreateIdentityResponse(response);

      console.log("Identity created:", {
        tx: signature,
        identity: newIdentity.toBase58(),
        vault: newVault.toBase58(),
      });

      // Store credential locally
      const storedCred: StoredCredential = {
        credentialId: Array.from(passkeyCredential.credentialId),
        publicKey: Array.from(passkeyCredential.publicKey),
        owner: newIdentity.toBase58(),
      };
      await storeCredential(storedCred);
      setCredential(storedCred);

      setIdentity(newIdentity);
      setVault(newVault);
      setKeys([
        {
          name: deviceName,
          pubkey:
            Buffer.from(passkeyCredential.publicKey)
              .toString("hex")
              .slice(0, 16) + "...",
        },
      ]);
      setStatus("connected");
      setSuccess("Wallet created successfully!");
      setTimeout(() => setSuccess(null), 5000);
    } catch (e: any) {
      console.error("Failed to create wallet:", e);
      setError(e.message || "Failed to create wallet. Please try again.");
      setStatus("disconnected");
    }
  }

  /**
   * Send SOL transaction
   */
  async function handleSend() {
    console.log("Initiating send...");
    if (!identity || !vault || !credential) return;

    setSending(true);
    setError(null);
    try {
      const lamports = Math.floor(parseFloat(sendAmount) * 1e9);
      const to = new PublicKey(sendTo);

      // Get current nonce from the identity account via API
      console.log("Fetching identity account for nonce...");
      const identityInfo = await getIdentityInfo(identity);
      const nonce = identityInfo.nonce || 0;
      console.log("Current nonce:", nonce);

      // Build message to sign (action + nonce)
      console.log("Building message...");
      const message = buildMessage({ type: "send", to, lamports }, nonce);
      console.log("Message to sign:", message);

      // Sign with passkey - returns signature + WebAuthn data
      console.log("Signing with passkey...");
      const { signature, authenticatorData, clientDataJSON } =
        await signWithPasskey(new Uint8Array(credential.credentialId), message);
      console.log("Message signed");

      // Execute via API with WebAuthn data
      console.log("Sending execute request to API...");
      const response = await executeTransaction(
        identity,
        { type: "send", to, lamports },
        new Uint8Array(credential.publicKey),
        [{ keyIndex: 0, signature, recoveryId: 0 }],
        authenticatorData,
        clientDataJSON
      );

      console.log("Transaction executed:", response.signature);

      setShowSend(false);
      setSendAmount("");
      setSendTo("");
      setSuccess(`Sent ${sendAmount} SOL successfully!`);
      setTimeout(() => setSuccess(null), 5000);
      fetchBalance();
    } catch (e: any) {
      console.error("Failed to send:", e);
      setError(e.message || "Failed to send SOL. Please try again.");
    }
    setSending(false);
  }

  /**
   * Request airdrop
   */
  async function handleAirdrop() {
    if (!vault) return;
    setIsLoading(true);
    try {
      await requestAirdrop(connection, vault, 1);
      setSuccess("Airdropped 1 SOL!");
      setTimeout(() => setSuccess(null), 5000);
      fetchBalance();
    } catch (e: any) {
      console.error("Airdrop failed:", e);
      setError("Airdrop failed. Rate limit may have been exceeded.");
      setTimeout(() => setError(null), 5000);
    }
    setIsLoading(false);
  }

  /**
   * Copy address to clipboard
   */
  async function handleCopyAddress() {
    if (!vault) return;
    await Clipboard.setStringAsync(vault.toBase58());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  /**
   * Open in Solana Explorer
   */
  function handleExplorer() {
    if (!vault) return;
    const url = `https://explorer.solana.com/address/${vault.toBase58()}?cluster=devnet`;
    Linking.openURL(url);
  }

  // Disconnected state - show create wallet screen
  if (status === "disconnected") {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={["#1a1025", "#0f0f23", "#1a1025"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fullGradient}
        >
          <View style={styles.centerContent}>
            {/* Logo */}
            <View style={styles.logoContainer}>
              <LinearGradient
                colors={["#a855f7", "#3b82f6"]}
                style={styles.logoGradient}
              >
                <IconSymbol size={48} name="touchid" color="#fff" />
              </LinearGradient>
            </View>

            {/* Title */}
            <ThemedText style={styles.title}>Keystore</ThemedText>
            <ThemedText style={styles.subtitle}>
              Solana wallet. No seed phrase.
            </ThemedText>

            {/* Create Button */}
            <TouchableOpacity
              style={styles.createButton}
              onPress={handleCreate}
              activeOpacity={0.8}
            >
              <IconSymbol size={24} name="touchid" color="#000" />
              <ThemedText style={styles.createButtonText}>
                Create with Face ID
              </ThemedText>
            </TouchableOpacity>

            {/* Error Message */}
            {error && (
              <View style={styles.errorContainer}>
                <ThemedText style={styles.errorText}>{error}</ThemedText>
              </View>
            )}

            {/* Info Text */}
            <ThemedText style={styles.infoText}>
              Your keys are stored in your device's secure enclave.
              {"\n"}No seed phrase to lose. No extension to install.
            </ThemedText>

            {/* Feature Cards */}
            <View style={styles.featureRow}>
              <View style={styles.featureCard}>
                <View style={styles.featureIconBg}>
                  <IconSymbol size={24} name="lock.shield" color="#a855f7" />
                </View>
                <ThemedText style={styles.featureText}>
                  Secure Enclave
                </ThemedText>
              </View>
              <View style={styles.featureCard}>
                <View style={styles.featureIconBg}>
                  <IconSymbol size={24} name="touchid" color="#3b82f6" />
                </View>
                <ThemedText style={styles.featureText}>Biometric Auth</ThemedText>
              </View>
              <View style={styles.featureCard}>
                <View style={styles.featureIconBg}>
                  <IconSymbol size={24} name="plus" color="#22c55e" />
                </View>
                <ThemedText style={styles.featureText}>Multi-Device</ThemedText>
              </View>
            </View>
          </View>
        </LinearGradient>
      </View>
    );
  }

  // Creating state - show loading
  if (status === "creating") {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={["#1a1025", "#0f0f23", "#1a1025"]}
          style={styles.fullGradient}
        >
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color="#a855f7" />
            <ThemedText style={styles.loadingTitle}>
              Creating your wallet...
            </ThemedText>
            <ThemedText style={styles.loadingSubtitle}>
              Please authenticate with your device
            </ThemedText>
          </View>
        </LinearGradient>
      </View>
    );
  }

  // Connected state - show wallet
  return (
    <ScrollView style={styles.container}>
      <View style={styles.walletContainer}>
        {/* Header */}
        <View style={styles.header}>
          <ThemedText style={styles.headerTitle}>Keystore</ThemedText>
          <View style={styles.networkBadge}>
            <View style={styles.networkDot} />
            <ThemedText style={styles.networkText}>Devnet</ThemedText>
          </View>
        </View>

        {/* Success/Error Messages */}
        {success && (
          <View style={styles.successContainer}>
            <IconSymbol size={20} name="checkmark.circle.fill" color="#22c55e" />
            <ThemedText style={styles.successText}>{success}</ThemedText>
          </View>
        )}
        {error && (
          <View style={styles.errorContainer}>
            <ThemedText style={styles.errorText}>{error}</ThemedText>
          </View>
        )}

        {/* Balance Card */}
        <LinearGradient
          colors={["#9333ea", "#3b82f6"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.balanceCard}
        >
          <ThemedText style={styles.balanceLabel}>Total Balance</ThemedText>
          <ThemedText style={styles.balanceAmount}>
            {lamportsToSOL(balance).toFixed(4)} SOL
          </ThemedText>

          {/* Address Row */}
          <View style={styles.addressRow}>
            <ThemedText style={styles.addressText}>
              {vault?.toBase58()}
            </ThemedText>
            <TouchableOpacity
              onPress={handleCopyAddress}
              style={styles.iconButton}
            >
              <IconSymbol
                size={16}
                name={copied ? "checkmark" : "doc.on.doc"}
                color="#fff"
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleExplorer} style={styles.iconButton}>
              <IconSymbol size={16} name="arrow.up.right" color="#fff" />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Actions */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => setShowSend(true)}
          >
            <View style={[styles.actionIcon, { backgroundColor: "#a855f720" }]}>
              <IconSymbol size={24} name="arrow.up" color="#a855f7" />
            </View>
            <ThemedText style={styles.actionText}>Send</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={handleAirdrop}
            disabled={isLoading}
          >
            <View style={[styles.actionIcon, { backgroundColor: "#3b82f620" }]}>
              {isLoading ? (
                <ActivityIndicator size="small" color="#3b82f6" />
              ) : (
                <IconSymbol size={24} name="plus" color="#3b82f6" />
              )}
            </View>
            <ThemedText style={styles.actionText}>Airdrop</ThemedText>
          </TouchableOpacity>
        </View>

        {/* Security Section */}
        <View style={styles.securityCard}>
          <View style={styles.securityHeader}>
            <IconSymbol size={20} name="lock.shield.fill" color="#22c55e" />
            <ThemedText style={styles.securityTitle}>Security</ThemedText>
          </View>

          <View style={styles.securityRow}>
            <ThemedText style={styles.securityLabel}>
              Signature Threshold
            </ThemedText>
            <ThemedText style={styles.securityValue}>
              {threshold} of {keys.length} keys
            </ThemedText>
          </View>

          {keys.map((k, i) => (
            <View key={i} style={styles.keyRow}>
              <ThemedText style={styles.keyName}>{k.name}</ThemedText>
              <ThemedText style={styles.keyPubkey}>{k.pubkey}</ThemedText>
            </View>
          ))}

          <TouchableOpacity
            style={styles.addDeviceButton}
            onPress={() => Alert.alert("Coming Soon", "Add device functionality coming soon!")}
          >
            <ThemedText style={styles.addDeviceText}>+ Add Another Device</ThemedText>
          </TouchableOpacity>
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <ThemedText style={styles.infoCardTitle}>🎉 Hackathon Demo</ThemedText>
          <ThemedText style={styles.infoCardText}>
            This wallet uses the new secp256r1 precompile (SIMD-0075) to verify
            passkey signatures on-chain. No seed phrases, no extensions—just
            your biometrics.
          </ThemedText>
        </View>
      </View>

      {/* Send Modal */}
      <Modal
        visible={showSend}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSend(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowSend(false)}
        >
          <Pressable
            style={styles.modalContent}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Send SOL</ThemedText>
              <TouchableOpacity onPress={() => setShowSend(false)}>
                <ThemedText style={styles.modalClose}>✕</ThemedText>
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              {/* Recipient Input */}
              <View style={styles.inputGroup}>
                <ThemedText style={styles.inputLabel}>
                  Recipient Address
                </ThemedText>
                <TextInput
                  style={styles.input}
                  placeholder="Enter Solana address"
                  placeholderTextColor="#6b7280"
                  value={sendTo}
                  onChangeText={setSendTo}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              {/* Amount Input */}
              <View style={styles.inputGroup}>
                <ThemedText style={styles.inputLabel}>Amount (SOL)</ThemedText>
                <TextInput
                  style={styles.amountInput}
                  placeholder="0.00"
                  placeholderTextColor="#6b7280"
                  keyboardType="decimal-pad"
                  value={sendAmount}
                  onChangeText={setSendAmount}
                />
              </View>

              {/* Info */}
              <View style={styles.modalInfo}>
                <ThemedText style={styles.modalInfoText}>
                  You'll be asked to authenticate with Face ID / Touch ID to
                  sign this transaction.
                </ThemedText>
              </View>
            </View>

            {/* Buttons */}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowSend(false)}
                disabled={sending}
              >
                <ThemedText style={styles.cancelButtonText}>Cancel</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.confirmButton,
                  (!sendTo || !sendAmount) && styles.confirmButtonDisabled,
                ]}
                onPress={handleSend}
                disabled={sending || !sendTo || !sendAmount}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <IconSymbol size={20} name="touchid" color="#fff" />
                    <ThemedText style={styles.confirmButtonText}>
                      Confirm with Face ID
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
    backgroundColor: "#0f0f23",
  },
  fullGradient: {
    flex: 1,
    paddingTop: 80,
    paddingHorizontal: 24,
  },
  centerContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 80,
  },
  logoContainer: {
    marginBottom: 24,
    transform: [{ rotate: "12deg" }],
  },
  logoGradient: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 48,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 20,
    color: "#9ca3af",
    marginBottom: 32,
  },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    gap: 12,
    marginBottom: 24,
  },
  createButtonText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
  },
  errorContainer: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.5)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    width: "100%",
  },
  errorText: {
    color: "#f87171",
    fontSize: 14,
    textAlign: "center",
  },
  successContainer: {
    backgroundColor: "rgba(34, 197, 94, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.5)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  successText: {
    color: "#22c55e",
    fontSize: 14,
    flex: 1,
  },
  infoText: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
  },
  featureRow: {
    flexDirection: "row",
    gap: 16,
  },
  featureCard: {
    alignItems: "center",
    gap: 8,
  },
  featureIconBg: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  featureText: {
    fontSize: 12,
    color: "#6b7280",
  },
  loadingTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#fff",
    marginTop: 24,
  },
  loadingSubtitle: {
    fontSize: 14,
    color: "#9ca3af",
    marginTop: 8,
  },

  // Wallet screen styles
  walletContainer: {
    padding: 16,
    paddingTop: 60,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#fff",
  },
  networkBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  networkDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#22c55e",
  },
  networkText: {
    fontSize: 14,
    color: "#9ca3af",
  },
  balanceCard: {
    borderRadius: 24,
    padding: 32,
    marginBottom: 24,
  },
  balanceLabel: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.7)",
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 40,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 24,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  addressText: {
    flex: 1,
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.9)",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  iconButton: {
    padding: 8,
    borderRadius: 8,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 24,
  },
  actionCard: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    gap: 12,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
  securityCard: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
  },
  securityHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  securityTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
  },
  securityRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  securityLabel: {
    fontSize: 14,
    color: "#9ca3af",
  },
  securityValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
  keyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  keyName: {
    fontSize: 14,
    fontWeight: "500",
    color: "#fff",
  },
  keyPubkey: {
    fontSize: 12,
    color: "#6b7280",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  addDeviceButton: {
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  addDeviceText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#fff",
  },
  infoCard: {
    backgroundColor: "rgba(168, 85, 247, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.3)",
    borderRadius: 16,
    padding: 24,
    marginBottom: 32,
  },
  infoCardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#c084fc",
    marginBottom: 8,
  },
  infoCardText: {
    fontSize: 14,
    color: "#9ca3af",
    lineHeight: 22,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#1f2937",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#fff",
  },
  modalClose: {
    fontSize: 20,
    color: "#9ca3af",
    padding: 8,
  },
  modalBody: {
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
    color: "#9ca3af",
  },
  input: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 12,
    padding: 16,
    fontSize: 14,
    color: "#fff",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  amountInput: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 12,
    padding: 16,
    fontSize: 24,
    fontWeight: "600",
    color: "#fff",
  },
  modalInfo: {
    backgroundColor: "rgba(168, 85, 247, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.3)",
    borderRadius: 12,
    padding: 16,
  },
  modalInfoText: {
    fontSize: 14,
    color: "#9ca3af",
    lineHeight: 20,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 16,
    marginTop: 24,
  },
  cancelButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  confirmButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    padding: 16,
    backgroundColor: "#9333ea",
  },
  confirmButtonDisabled: {
    opacity: 0.5,
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
});
