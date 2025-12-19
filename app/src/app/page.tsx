"use client";

import { useState, useEffect } from "react";
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { Fingerprint, Plus, Send, Shield, Loader2, Copy, ExternalLink, CheckCircle2 } from "lucide-react";
import { createPasskey, signWithPasskey, getStoredCredential, storeCredential } from "@/lib/passkey";
import { getIdentityPDA, getVaultPDA } from "@/lib/keystore";
import { createIdentity, parseCreateIdentityResponse, executeTransaction, getIdentityInfo } from "@/lib/api";
import { formatAddress, lamportsToSOL } from "@/lib/solana";
import { buildMessage } from "@/lib/message";
import { KeystoreClient } from "@/lib/keystore-client";

const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
const keystoreClient = new KeystoreClient(connection);

export default function Home() {
  const [status, setStatus] = useState<"disconnected" | "creating" | "connected">("disconnected");
  const [identity, setIdentity] = useState<PublicKey | null>(null);
  const [vault, setVault] = useState<PublicKey | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [keys, setKeys] = useState<{ name: string; pubkey: string }[]>([]);
  const [threshold, setThreshold] = useState<number>(1);
  const [sending, setSending] = useState(false);
  const [sendAmount, setSendAmount] = useState("");
  const [sendTo, setSendTo] = useState("");
  const [showSend, setShowSend] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    checkExistingWallet();
  }, []);

  useEffect(() => {
    if (vault) {
      const interval = setInterval(fetchBalance, 5000);
      fetchBalance();
      return () => clearInterval(interval);
    }
  }, [vault]);

  async function checkExistingWallet() {
    const stored = getStoredCredential();
    if (stored) {
      console.log("Identity:", stored.owner);
      console.log("Public Key:", stored.publicKey);
      console.log("Credential ID:", stored.credentialId);
      const identityPDA = new PublicKey(stored.owner);
      const vaultPDA = keystoreClient.getVaultPDA(identityPDA);
      setIdentity(identityPDA);
      setVault(vaultPDA);
      setStatus("connected");
      
      // Fetch account data via API
      try {
        const identityInfo = await getIdentityInfo(stored.owner);
        setThreshold(identityInfo.threshold);
        // For demo, just show the stored credential
        setKeys([{ 
          name: "This Device", 
          pubkey: Buffer.from(stored.publicKey).toString("hex").slice(0, 16) + "..." 
        }]);
      } catch (e) {
        console.error("Failed to fetch identity info:", e);
        // Still show connected with default values
        setKeys([{ 
          name: "This Device", 
          pubkey: Buffer.from(stored.publicKey).toString("hex").slice(0, 16) + "..." 
        }]);
      }
    }
  }

  async function fetchBalance() {
    if (!vault) return;
    try {
      const bal = await connection.getBalance(vault);
      setBalance(bal);
    } catch (e) {
      console.error("Failed to fetch balance:", e);
    }
  }

  async function handleCreate() {
    setStatus("creating");
    setError(null);
    try {
      // Check if passkeys are supported
      if (!window.PublicKeyCredential) {
        throw new Error("Passkeys are not supported in this browser. Please use a modern browser with WebAuthn support.");
      }

      const deviceName = getDeviceName();
      console.log("Creating passkey...");
      const credential = await createPasskey("keystore-user");
      console.log("Passkey created:", {
        publicKeyLength: credential.publicKey.length,
        credentialIdLength: credential.credentialId.length,
      });
      
      // Create identity on-chain via API
      console.log("Creating identity on-chain via API...");
      console.log("Public key length:", credential.publicKey.length);
      
      // Validate public key is 33 bytes
      if (credential.publicKey.length !== 33) {
        throw new Error(`Invalid public key length: expected 33 bytes, got ${credential.publicKey.length}`);
      }

      try {
        const response = await createIdentity(credential.publicKey, deviceName);
        console.log("Identity created on-chain:", response);
        const { identity: newIdentity, vault: newVault, signature } = parseCreateIdentityResponse(response);
        
        console.log("Identity created:", {
          tx: signature,
          identity: newIdentity.toBase58(),
          vault: newVault.toBase58(),
        });
        
        // Store credential locally
        storeCredential({
          credentialId: Array.from(credential.credentialId),
          publicKey: Array.from(credential.publicKey),
          owner: newIdentity.toBase58(),
        });
        
        setIdentity(newIdentity);
        setVault(newVault);
        setKeys([{ name: deviceName, pubkey: Buffer.from(credential.publicKey).toString("hex").slice(0, 16) + "..." }]);
        setStatus("connected");
        setSuccess("Wallet created successfully!");
        setTimeout(() => setSuccess(null), 5000);
      } catch (apiError: any) {
        console.error("API error:", apiError);
        
        // Check if it's a funding issue
        if (apiError.message?.includes("debit") || apiError.message?.includes("credit") || apiError.message?.includes("airdrop")) {
          throw new Error(
            "⚠️ Devnet Setup Required\n\n" +
            "The Solana program needs to be deployed and funded on devnet.\n\n" +
            "Steps:\n" +
            "1. Deploy the program: anchor deploy\n" +
            "2. Fund your wallet with devnet SOL\n" +
            "3. Try again\n\n" +
            "See DEPLOYMENT_GUIDE.md for details.\n\n" +
            "Your passkey was created successfully and can be used once the program is deployed!"
          );
        }
        
        throw apiError;
      }
    } catch (e: any) {
      console.error("Failed to create wallet:", e);
      setError(e.message || "Failed to create wallet. Please try again.");
      setStatus("disconnected");
    }
  }

  async function handleSend() {
    console.log("Initiating send...");
    if (!identity || !vault) return; 
    setSending(true);
    setError(null);
    try {
      console.log("Retrieving stored credential...");
      const stored = getStoredCredential();
      if (!stored) throw new Error("No credential found");
      
      const lamports = Math.floor(parseFloat(sendAmount) * 1e9);
      const to = new PublicKey(sendTo);
      
      // Get current nonce from the identity account via API
      console.log("Fetching identity account for nonce...");
      const identityInfo = await getIdentityInfo(identity);
      const nonce = identityInfo.nonce || 0;
      console.log("Current nonce:", nonce);
      
      // Build message to sign (action + nonce)
      console.log("Building Message");
      const message = buildMessage({ type: "send", to, lamports }, nonce);
      console.log("Message to sign:", message);
      
      // Sign with passkey - now returns signature + WebAuthn data
      const { signature, authenticatorData, clientDataJSON } = await signWithPasskey(
        new Uint8Array(stored.credentialId),
        message
      );
      console.log("Message signed");
      console.log("Signature obtained:", signature);
      
      // Execute via API with WebAuthn data
      console.log("Sending Execute request to API...");
      const response = await executeTransaction(
        identity,
        { type: "send", to, lamports },
        new Uint8Array(stored.publicKey),
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

  async function handleAirdrop() {
    if (!vault) return;
    try {
      const signature = await connection.requestAirdrop(vault, 1000000000); // 1 SOL
      await connection.confirmTransaction(signature);
      setSuccess("Airdropped 1 SOL!");
      setTimeout(() => setSuccess(null), 5000);
      fetchBalance();
    } catch (e: any) {
      console.error("Airdrop failed:", e);
      setError("Airdrop failed. Rate limit may have been exceeded.");
      setTimeout(() => setError(null), 5000);
    }
  }

  function handleCopyAddress() {
    if (!vault) return;
    navigator.clipboard.writeText(vault.toBase58());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleExplorer() {
    if (!vault) return;
    window.open(`https://explorer.solana.com/address/${vault.toBase58()}?cluster=devnet`, "_blank");
  }

  if (status === "disconnected") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-8 relative">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-black to-blue-900/20" />
        
        <div className="max-w-md w-full space-y-8 text-center relative z-10">
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-blue-500 rounded-3xl flex items-center justify-center rotate-12 hover:rotate-0 transition-transform duration-300">
                <Fingerprint className="w-12 h-12" />
              </div>
            </div>
            <h1 className="text-6xl font-bold tracking-tight bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
              Keystore
            </h1>
            <p className="text-2xl text-gray-400">Solana wallet. No seed phrase.</p>
          </div>
          
          <div className="space-y-4">
            <button
              onClick={handleCreate}
              className="w-full bg-white text-black py-4 px-6 rounded-2xl font-semibold text-lg flex items-center justify-center gap-3 hover:bg-gray-100 transition-all hover:scale-105 transform"
            >
              <Fingerprint className="w-6 h-6" />
              Create with Face ID
            </button>
            
            {error && (
              <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-4 text-red-400 text-sm">
                {error}
              </div>
            )}
          </div>
          
          <div className="space-y-4 text-sm text-gray-500">
            <p>
              Your keys are stored in your device's secure enclave.
              <br />No seed phrase to lose. No extension to install.
            </p>
            
            <div className="grid grid-cols-3 gap-4 pt-4">
              <div className="space-y-2">
                <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center mx-auto">
                  <Shield className="w-6 h-6 text-purple-400" />
                </div>
                <p className="text-xs">Secure Enclave</p>
              </div>
              <div className="space-y-2">
                <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center mx-auto">
                  <Fingerprint className="w-6 h-6 text-blue-400" />
                </div>
                <p className="text-xs">Biometric Auth</p>
              </div>
              <div className="space-y-2">
                <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center mx-auto">
                  <Plus className="w-6 h-6 text-green-400" />
                </div>
                <p className="text-xs">Multi-Device</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (status === "creating") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-8">
        <div className="space-y-6 text-center">
          <Loader2 className="w-16 h-16 animate-spin text-purple-400 mx-auto" />
          <div className="space-y-2">
            <p className="text-xl font-semibold">Creating your wallet...</p>
            <p className="text-gray-400">Please authenticate with your device</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4 sm:p-8">
      <div className="max-w-lg mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
            Keystore
          </h1>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Devnet
          </div>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div className="bg-green-500/10 border border-green-500/50 rounded-xl p-4 flex items-center gap-3 text-green-400">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{success}</span>
          </div>
        )}
        {error && (
          <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-4 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Balance Card */}
        <div className="bg-gradient-to-br from-purple-600 to-blue-600 rounded-3xl p-8 shadow-2xl">
          <p className="text-sm text-white/70 mb-2">Total Balance</p>
          <p className="text-5xl font-bold mb-6">{lamportsToSOL(balance).toFixed(4)} SOL</p>
          <div className="flex items-center gap-2 bg-white/10 rounded-xl p-3 backdrop-blur-sm">
            <p className="text-sm text-white/90 font-mono flex-1 truncate">
              {vault?.toBase58()}
            </p>
            <button
              onClick={handleCopyAddress}
              className="flex-shrink-0 hover:bg-white/20 p-2 rounded-lg transition"
              title="Copy address"
            >
              {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              onClick={handleExplorer}
              className="flex-shrink-0 hover:bg-white/20 p-2 rounded-lg transition"
              title="View in explorer"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => setShowSend(true)}
            className="bg-white/10 hover:bg-white/20 rounded-2xl p-6 flex flex-col items-center gap-3 transition-all hover:scale-105 transform"
          >
            <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
              <Send className="w-6 h-6" />
            </div>
            <span className="font-medium">Send</span>
          </button>
          <button
            onClick={handleAirdrop}
            className="bg-white/10 hover:bg-white/20 rounded-2xl p-6 flex flex-col items-center gap-3 transition-all hover:scale-105 transform"
          >
            <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
              <Plus className="w-6 h-6" />
            </div>
            <span className="font-medium">Airdrop</span>
          </button>
        </div>

        {/* Security Section */}
        <div className="bg-white/5 rounded-2xl p-6 space-y-4 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-green-400" />
            <span className="font-medium text-lg">Security</span>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Signature Threshold</span>
              <span className="font-semibold">{threshold} of {keys.length} keys</span>
            </div>
            <div className="space-y-2">
              {keys.map((k, i) => (
                <div key={i} className="flex justify-between text-sm bg-white/5 rounded-xl p-4 hover:bg-white/10 transition">
                  <span className="font-medium">{k.name}</span>
                  <span className="text-gray-500 font-mono text-xs">{k.pubkey}</span>
                </div>
              ))}
            </div>
          </div>

          <button
            className="w-full py-3 rounded-xl border border-white/20 hover:bg-white/5 transition text-sm font-medium"
            onClick={() => alert("Add device functionality coming soon!")}
          >
            + Add Another Device
          </button>
        </div>

        {/* Info Card */}
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-2xl p-6 space-y-2">
          <h3 className="font-semibold text-purple-300">🎉 Hackathon Demo</h3>
          <p className="text-sm text-gray-400">
            This wallet uses the new secp256r1 precompile (SIMD-0075) to verify passkey signatures on-chain.
            No seed phrases, no extensions—just your biometrics.
          </p>
        </div>
      </div>

      {/* Send Modal */}
      {showSend && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-gray-900 rounded-3xl p-6 w-full max-w-lg space-y-6 animate-in slide-in-from-bottom duration-300 sm:slide-in-from-bottom-0">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Send SOL</h2>
              <button
                onClick={() => setShowSend(false)}
                className="text-gray-400 hover:text-white transition"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Recipient Address</label>
                <input
                  type="text"
                  placeholder="Enter Solana address"
                  value={sendTo}
                  onChange={(e) => setSendTo(e.target.value)}
                  className="w-full bg-white/10 rounded-xl p-4 outline-none focus:ring-2 focus:ring-purple-500 transition font-mono text-sm"
                />
              </div>
              
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Amount (SOL)</label>
                <input
                  type="number"
                  placeholder="0.00"
                  step="0.001"
                  value={sendAmount}
                  onChange={(e) => setSendAmount(e.target.value)}
                  className="w-full bg-white/10 rounded-xl p-4 outline-none focus:ring-2 focus:ring-purple-500 transition text-2xl font-semibold"
                />
              </div>

              <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4 text-sm text-gray-400">
                <p>You'll be asked to authenticate with Face ID / Touch ID to sign this transaction.</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setShowSend(false)}
                disabled={sending}
                className="py-4 rounded-xl border border-white/20 hover:bg-white/5 transition font-semibold disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={sending || !sendTo || !sendAmount}
                className="py-4 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold flex items-center justify-center gap-2 hover:from-purple-500 hover:to-blue-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Fingerprint className="w-5 h-5" />
                    Confirm with Face ID
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function getDeviceName(): string {
  const ua = navigator.userAgent;
  if (ua.includes("iPhone")) return "iPhone";
  if (ua.includes("iPad")) return "iPad";
  if (ua.includes("Mac")) return "MacBook";
  if (ua.includes("Windows")) return "Windows PC";
  if (ua.includes("Android")) return "Android";
  return "Device";
}

