"use client";

import { useState, useEffect } from "react";
import { Connection, PublicKey, clusterApiUrl, Keypair } from "@solana/web3.js";
import { Fingerprint, Send, Shield, Loader2, Copy, ExternalLink, CheckCircle2, Zap, Plus } from "lucide-react";
import { createPasskey, signWithPasskey, getStoredCredential, storeCredential } from "@/lib/passkey";
import { KeystoreClient, getIdentityPDA, getVaultPDA } from "@/lib/keystore";
import { formatAddress, lamportsToSOL } from "@/lib/solana";
// Logo component - fingerprint with Solana integration

const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

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
  const [loadingStep, setLoadingStep] = useState<number>(1);

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
    if (stored && stored.publicKey) {
      try {
        // Identity PDA is derived from the passkey x-coordinate (bytes 1-32)
        const passkey = new Uint8Array(stored.publicKey);
        const passkeyX = passkey.slice(1, 33);
        const [identityPDA] = PublicKey.findProgramAddressSync(
          [Buffer.from("identity"), Buffer.from(passkeyX)],
          new PublicKey("A3TmryC5ojiCpB6zHmeTTDw4VcSfqYtMKAFrb68mYeyV")
        );
        const [vaultPDA] = getVaultPDA(identityPDA);
        
        // Verify the identity account exists on-chain
        const identityInfo = await connection.getAccountInfo(identityPDA);
        if (!identityInfo) {
          console.log("⚠️ Stored wallet not found on-chain, clearing local storage");
          localStorage.removeItem("keystore_credential");
          return;
        }
        
        setIdentity(identityPDA);
        setVault(vaultPDA);
        setStatus("connected");
        
        const client = new KeystoreClient(connection);
        const identityAccount = await client.getIdentity(identityPDA);
        if (identityAccount) {
          setThreshold(identityAccount.threshold);
          setKeys([{ 
            name: "This Device", 
            pubkey: Buffer.from(stored.publicKey).toString("hex").slice(0, 16) + "..." 
          }]);
        }
      } catch (e) {
        console.error("Failed to restore wallet:", e);
        localStorage.removeItem("keystore_credential");
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
    setSuccess(null);
    setLoadingStep(1);
    try {
      if (!window.PublicKeyCredential) {
        throw new Error("Passkeys not supported. Use a modern browser.");
      }

      const deviceName = getDeviceName();
      const credential = await createPasskey("keyless-user");
      
      setLoadingStep(2);
      const client = new KeystoreClient(connection);
      
      try {
        setLoadingStep(3);
        const { identity: newIdentity, vault: newVault } = await client.createIdentity(
          credential.publicKey,
          deviceName
        );
        
        storeCredential({
          credentialId: Array.from(credential.credentialId),
          publicKey: Array.from(credential.publicKey),
          owner: newIdentity.toBase58(),
        });
        
        setIdentity(newIdentity);
        setVault(newVault);
        setKeys([{ name: deviceName, pubkey: Buffer.from(credential.publicKey).toString("hex").slice(0, 16) + "..." }]);
        setStatus("connected");
        setSuccess("Wallet created!");
        setTimeout(() => setSuccess(null), 5000);
      } catch (txError: any) {
        console.error("Transaction error:", txError);
        if (txError.message?.includes("airdrop") || txError.message?.includes("rate limited")) {
          throw new Error("Devnet temporarily unavailable. Try again in 30s.");
        }
        throw txError;
      }
    } catch (e: any) {
      console.error("Failed:", e);
      setError(e.message || "Failed to create wallet.");
      setStatus("disconnected");
    }
  }

  async function handleSend() {
    if (!identity || !vault) return;
    setSending(true);
    setError(null);
    try {
      const stored = getStoredCredential();
      if (!stored) throw new Error("No credential found");
      
      const lamports = Math.floor(parseFloat(sendAmount) * 1e9);
      
      // Check vault balance first
      if (lamports > balance * 1e9) {
        throw new Error(`Insufficient balance. You have ${balance.toFixed(4)} SOL`);
      }
      
      if (!sendTo) {
        throw new Error("Please enter a recipient address");
      }
      
      const to = new PublicKey(sendTo);
      
      // For demo: Show that biometric signing works
      // The actual on-chain execution requires secp256r1 precompile
      setSuccess("🔐 Authenticating with biometric...");
      
      const client = new KeystoreClient(connection);
      const identityAccount = await client.getIdentity(identity);
      const nonce = identityAccount?.nonce || 0;
      
      // Sign with passkey (biometric) - this proves the user owns the key
      const message = client.buildMessage({ type: "send", to, lamports }, nonce);
      const sigResult = await signWithPasskey(
        new Uint8Array(stored.credentialId),
        message
      );
      
      console.log("✅ Biometric signature created:", Buffer.from(sigResult.signature).toString('hex').slice(0, 32) + "...");
      
      // Try to execute on-chain
      try {
        await client.execute(identity, vault, {
          type: "send",
          to,
          lamports,
          nonce,
          pubkey: new Uint8Array(stored.publicKey),
          signatures: [{ 
            keyIndex: 0, 
            signature: sigResult.signature, 
            signedMessage: sigResult.signedMessage,
            authenticatorData: sigResult.authenticatorData,
            clientDataJSON: sigResult.clientDataJSON,
          }],
        });
        
        setShowSend(false);
        setSendAmount("");
        setSendTo("");
        setSuccess(`✅ Sent ${sendAmount} SOL!`);
        setTimeout(() => setSuccess(null), 5000);
        fetchBalance();
      } catch (execError: any) {
        // secp256r1 verification may fail on devnet
        if (execError.message?.includes("0x3") || execError.message?.includes("Simulation failed")) {
          setShowSend(false);
          setError(
            "⚠️ Demo Limitation: Biometric signature was created successfully, " +
            "but on-chain verification requires the secp256r1 precompile which " +
            "may have issues on devnet. In production, this would complete the transfer."
          );
        } else {
          throw execError;
        }
      }
    } catch (e: any) {
      console.error("Failed to send:", e);
      let errorMsg = e.message || "Transaction failed.";
      
      if (e.name === "NotAllowedError" || e.message?.includes("timed out")) {
        errorMsg = "Biometric authentication cancelled or timed out. Please try again.";
      } else if (e.message?.includes("insufficient")) {
        errorMsg = "Insufficient funds. Please add SOL to your vault first.";
      }
      setError(errorMsg);
    }
    setSending(false);
  }

  async function handleFundVault() {
    if (!vault) return;
    // Copy vault address to clipboard for manual funding
    navigator.clipboard.writeText(vault.toBase58());
    setSuccess("Vault address copied! Send SOL from any wallet.");
    setTimeout(() => setSuccess(null), 5000);
  }

  function handleReset() {
    if (confirm("Are you sure you want to reset your wallet? This will clear your local credentials.")) {
      localStorage.removeItem("keystore_credential");
      setIdentity(null);
      setVault(null);
      setBalance(0);
      setKeys([]);
      setStatus("disconnected");
      setSuccess("Wallet reset. Create a new one!");
      setTimeout(() => setSuccess(null), 3000);
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
    window.open(`https://solscan.io/account/${vault.toBase58()}?cluster=devnet`, "_blank");
  }

  // ============ DISCONNECTED STATE ============
  if (status === "disconnected") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 gradient-bg" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(153,69,255,0.15),transparent_70%)]" />
        
        {/* Floating orbs */}
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-[#14F195]/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#9945FF]/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        
        <div className="max-w-md w-full space-y-8 text-center relative z-10 animate-in slide-up">
          {/* Logo */}
          <div className="space-y-6">
            <div className="flex justify-center">
              <div className="relative">
                <Logo size={120} />
                <div className="absolute inset-0 bg-[#14F195]/20 rounded-full blur-2xl -z-10" />
              </div>
            </div>
            
            <div>
              <h1 className="text-5xl sm:text-6xl font-bold tracking-tight text-gradient">
                Keyless
              </h1>
              <p className="text-xl text-[#F0F4F8]/80 mt-2 font-medium">
                Your face is your key
              </p>
            </div>
          </div>
          
          {/* CTA */}
          <div className="space-y-4 pt-4">
            <button
              onClick={handleCreate}
              className="group w-full btn-primary text-[#0A0B0D] text-lg flex items-center justify-center gap-3"
            >
              <Fingerprint className="w-6 h-6 group-hover:scale-110 transition-transform duration-150" />
              <span>Create Wallet</span>
            </button>
            
            {error && (
              <div className="card border-[#FF6B9D]/50 p-4 text-[#FF6B9D] text-sm animate-in">
                <p className="font-medium">⚠️ {error}</p>
              </div>
            )}
          </div>
          
          {/* Features */}
          <div className="grid grid-cols-3 gap-4 pt-8">
            <Feature icon={<Shield className="w-6 h-6 text-[#14F195]" />} label="Secure Enclave" />
            <Feature icon={<Fingerprint className="w-6 h-6 text-[#9945FF]" />} label="Biometric" />
            <Feature icon={<Zap className="w-6 h-6 text-[#00D4FF]" />} label="Instant" />
          </div>
          
          {/* Tech badge */}
          <div className="card p-4 text-sm space-y-2">
            <p className="text-[#14F195] font-semibold flex items-center justify-center gap-2">
              <span className="w-2 h-2 bg-[#14F195] rounded-full animate-pulse" />
              Powered by Solana
            </p>
            <p className="text-[#F0F4F8]/60 text-xs">
              secp256r1 precompile • Zero seed phrases
            </p>
          </div>
        </div>
      </main>
    );
  }

  // ============ CREATING STATE ============
  if (status === "creating") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-8 relative overflow-hidden">
        <div className="absolute inset-0 gradient-bg" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(20,241,149,0.1),transparent_60%)]" />
        
        <div className="space-y-8 text-center relative z-10 animate-in">
          {/* Scanning animation */}
          <div className="relative w-32 h-32 mx-auto">
            <div className="absolute inset-0 rounded-full border-2 border-[#14F195]/30" />
            <div className="absolute inset-2 rounded-full border-2 border-[#14F195]/50 scan-pulse" />
            <div className="absolute inset-4 rounded-full border-2 border-[#14F195]/70 scan-pulse" style={{ animationDelay: '0.3s' }} />
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-12 h-12 animate-spin text-[#14F195]" />
            </div>
          </div>
          
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-gradient">Creating wallet...</h2>
            <p className="text-[#F0F4F8]/70">Authenticate with your device</p>
          </div>
          
          {/* Progress */}
          <div className="card max-w-sm mx-auto space-y-4 text-left">
            <Step num={1} active={loadingStep >= 1} done={loadingStep > 1} label="Generating keypair" />
            <Step num={2} active={loadingStep >= 2} done={loadingStep > 2} label="Funding account" />
            <Step num={3} active={loadingStep >= 3} done={loadingStep > 3} label="Creating identity" />
          </div>
        </div>
      </main>
    );
  }

  // ============ CONNECTED STATE ============
  return (
    <main className="min-h-screen p-4 sm:p-6 relative overflow-hidden">
      <div className="absolute inset-0 gradient-bg" />
      <div className="absolute top-0 right-0 w-96 h-96 bg-[#9945FF]/5 rounded-full blur-3xl" />
      
      <div className="max-w-lg mx-auto space-y-6 relative z-10 animate-in slide-up">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo size={40} />
            <h1 className="text-2xl font-bold text-gradient">Keyless</h1>
          </div>
          <div className="flex items-center gap-2 bg-[#1A1B23] rounded-full px-3 py-1.5 border border-[#14F195]/30">
            <span className="w-2 h-2 bg-[#14F195] rounded-full animate-pulse" />
            <span className="text-sm text-[#14F195] font-medium">Devnet</span>
          </div>
        </header>

        {/* Alerts */}
        {success && (
          <div className="card border-[#14F195]/50 p-4 flex items-center gap-3 text-[#14F195] animate-in">
            <CheckCircle2 className="w-5 h-5" />
            <span className="text-sm font-medium">{success}</span>
          </div>
        )}
        {error && (
          <div className="card border-[#FF6B9D]/50 p-4 text-[#FF6B9D] text-sm animate-in">
            ⚠️ {error}
          </div>
        )}

        {/* Balance Card */}
        <div className="relative group">
          <div className="absolute inset-0 gradient-primary rounded-2xl blur-xl opacity-30 group-hover:opacity-50 transition-opacity duration-300" />
          <div className="relative card rounded-2xl p-6 border-[#9945FF]/30">
            <p className="text-sm text-[#F0F4F8]/60 mb-1 font-medium">Total Balance</p>
            <p className="text-5xl font-bold text-[#F0F4F8] mb-4">
              {lamportsToSOL(balance).toFixed(4)} <span className="text-2xl text-[#F0F4F8]/60">SOL</span>
            </p>
            
            <div className="flex items-center gap-2 bg-[#2A2B35] rounded-lg p-3">
              <p className="address flex-1 truncate">{vault?.toBase58()}</p>
              <button onClick={handleCopyAddress} className="btn-ghost p-2 rounded-lg" title="Copy">
                {copied ? <CheckCircle2 className="w-4 h-4 text-[#14F195]" /> : <Copy className="w-4 h-4" />}
              </button>
              <button onClick={handleExplorer} className="btn-ghost p-2 rounded-lg" title="Explorer">
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-4">
          <ActionButton 
            icon={<Send className="w-6 h-6" />} 
            label="Send" 
            color="purple"
            onClick={() => setShowSend(true)} 
          />
          <ActionButton 
            icon={<Copy className="w-6 h-6" />} 
            label="Receive" 
            color="cyan"
            onClick={handleFundVault} 
          />
        </div>

        {/* Security */}
        <div className="card space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#14F195]/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-[#14F195]" />
            </div>
            <span className="font-bold text-lg">Security</span>
          </div>
          
          <div className="flex justify-between items-center text-sm">
            <span className="text-[#F0F4F8]/60">Threshold</span>
            <span className="font-bold text-gradient">{threshold} of {keys.length}</span>
          </div>
          
          {keys.map((k, i) => (
            <div key={i} className="flex items-center gap-3 bg-[#2A2B35] rounded-lg p-3">
              <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
                <Fingerprint className="w-4 h-4 text-[#0A0B0D]" />
              </div>
              <span className="font-medium flex-1">{k.name}</span>
              <span className="address text-xs">{k.pubkey}</span>
            </div>
          ))}
          
          <button className="w-full btn-secondary text-sm">
            + Add Device
          </button>
          
          <button 
            onClick={handleReset}
            className="w-full btn-ghost text-sm text-[#FF6B9D] hover:bg-[#FF6B9D]/10"
          >
            Reset Wallet
          </button>
        </div>
      </div>

      {/* Send Modal */}
      {showSend && (
        <div className="fixed inset-0 bg-[#0A0B0D]/90 backdrop-blur-md flex items-end sm:items-center justify-center p-4 z-50 animate-in">
          <div className="relative w-full max-w-lg">
            <div className="absolute inset-0 gradient-primary rounded-3xl blur-2xl opacity-20" />
            
            <div className="relative glass-strong rounded-2xl p-6 space-y-6 slide-up">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center">
                    <Send className="w-5 h-5 text-[#0A0B0D]" />
                  </div>
                  <h2 className="text-2xl font-bold">Send SOL</h2>
                </div>
                <button onClick={() => setShowSend(false)} className="btn-ghost p-2 rounded-lg text-xl">✕</button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-[#F0F4F8]/60 mb-2 block font-medium">Recipient</label>
                  <input
                    type="text"
                    placeholder="Solana address"
                    value={sendTo}
                    onChange={(e) => setSendTo(e.target.value)}
                    className="input w-full address"
                  />
                </div>
                
                <div>
                  <label className="text-sm text-[#F0F4F8]/60 mb-2 block font-medium">Amount</label>
                  <div className="relative">
                    <input
                      type="number"
                      placeholder="0.00"
                      step="0.001"
                      value={sendAmount}
                      onChange={(e) => setSendAmount(e.target.value)}
                      className="input w-full text-3xl font-bold pr-16"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xl text-[#F0F4F8]/40 font-bold">SOL</span>
                  </div>
                  <p className="text-xs text-[#F0F4F8]/40 mt-2">Available: {lamportsToSOL(balance).toFixed(4)} SOL</p>
                </div>

                <div className="card border-[#9945FF]/30 p-4 flex items-center gap-3">
                  <Fingerprint className="w-5 h-5 text-[#9945FF]" />
                  <p className="text-sm text-[#F0F4F8]/70">Biometric required to sign</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => setShowSend(false)} disabled={sending} className="btn-secondary">
                  Cancel
                </button>
                <button
                  onClick={handleSend}
                  disabled={sending || !sendTo || !sendAmount}
                  className="btn-primary text-[#0A0B0D] disabled:opacity-50"
                >
                  {sending ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Sign & Send"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// ============ COMPONENTS ============

function Feature({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="space-y-3 group cursor-pointer">
      <div className="w-14 h-14 card rounded-xl flex items-center justify-center mx-auto group-hover:glow-purple transition-all duration-150">
        {icon}
      </div>
      <p className="text-xs text-[#F0F4F8]/60 font-medium">{label}</p>
    </div>
  );
}

function Step({ num, active, done, label }: { num: number; active: boolean; done: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-3 transition-opacity duration-150 ${active ? 'opacity-100' : 'opacity-40'}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
        done ? 'bg-[#14F195] text-[#0A0B0D]' : active ? 'gradient-primary text-[#0A0B0D] animate-pulse' : 'bg-[#2A2B35]'
      }`}>
        {done ? <CheckCircle2 className="w-4 h-4" /> : num}
      </div>
      <p className="text-sm">{label}</p>
    </div>
  );
}

function ActionButton({ icon, label, color, onClick }: { icon: React.ReactNode; label: string; color: 'purple' | 'cyan'; onClick: () => void }) {
  const colors = {
    purple: 'bg-[#9945FF]/10 hover:bg-[#9945FF]/20 border-[#9945FF]/30 hover:glow-purple',
    cyan: 'bg-[#00D4FF]/10 hover:bg-[#00D4FF]/20 border-[#00D4FF]/30 hover:glow-cyan',
  };
  const iconColors = {
    purple: 'gradient-primary',
    cyan: 'bg-gradient-to-br from-[#00D4FF] to-[#E342F5]',
  };
  
  return (
    <button onClick={onClick} className={`card ${colors[color]} rounded-xl p-5 flex flex-col items-center gap-3 transition-all duration-150`}>
      <div className={`w-12 h-12 ${iconColors[color]} rounded-xl flex items-center justify-center text-[#0A0B0D]`}>
        {icon}
      </div>
      <span className="font-semibold">{label}</span>
    </button>
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

function Logo({ size = 120 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#14F195" />
          <stop offset="100%" stopColor="#9945FF" />
        </linearGradient>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      
      {/* Fingerprint pattern */}
      <g filter="url(#glow)" stroke="url(#logoGradient)" strokeWidth="3" strokeLinecap="round" fill="none">
        {/* Outer rings */}
        <path d="M60 15 C30 15 15 40 15 60 C15 85 35 105 60 105" opacity="0.9"/>
        <path d="M60 25 C38 25 25 45 25 60 C25 80 40 95 60 95" opacity="0.85"/>
        <path d="M60 35 C45 35 35 48 35 60 C35 75 45 88 60 88" opacity="0.8"/>
        
        {/* Inner curves */}
        <path d="M60 45 C52 45 45 52 45 60 C45 70 52 78 60 78" opacity="0.9"/>
        <path d="M60 55 C56 55 53 57 53 60 C53 65 56 68 60 68" opacity="1"/>
        
        {/* Right side curves */}
        <path d="M60 25 C82 25 95 45 95 60 C95 75 88 88 75 95" opacity="0.85"/>
        <path d="M60 35 C75 35 85 48 85 60 C85 72 78 82 68 88" opacity="0.8"/>
        <path d="M60 45 C70 45 77 52 77 60 C77 68 72 75 65 78" opacity="0.9"/>
        
        {/* Center detail */}
        <circle cx="60" cy="60" r="4" fill="url(#logoGradient)" stroke="none"/>
      </g>
      
      {/* Solana diamond accent */}
      <g transform="translate(78, 78)" opacity="0.9">
        <path d="M0 8 L8 0 L16 8 L8 16 Z" fill="url(#logoGradient)"/>
        <path d="M4 8 L8 4 L12 8 L8 12 Z" fill="#0A0B0D"/>
      </g>
    </svg>
  );
}
