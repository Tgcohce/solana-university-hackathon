'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Wallet, ArrowLeft, Loader2, Copy, Check } from 'lucide-react';

interface MintInfo {
  decimals: number;
  supply: string;
}

interface TokenMetadata {
  name: string;
  symbol: string;
  uri: string;
  image: string | null;
}

interface TokenBalance {
  mint: string;
  account: string;
  amount: string;
  decimals: number;
  uiAmount: number | null;
  uiAmountString: string;
  mintInfo: MintInfo | null;
  metadata: TokenMetadata | null;
}

interface WalletData {
  wallet: string;
  solBalance: {
    lamports: number;
    sol: number;
  };
  tokenBalances: TokenBalance[];
  totalTokens: number;
}

export default function WalletPortfolioPage() {
  const params = useParams();
  const router = useRouter();
  const address = params.address as string;
  
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedAddress, setCopiedAddress] = useState(false);

  useEffect(() => {
    if (!address) return;

    const fetchWalletData = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/api/token-balances?address=${address}`);
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch wallet data');
        }
        
        const data = await response.json();
        
        // Add SOL as a token at the beginning of the list
        const solToken: TokenBalance = {
          mint: 'So11111111111111111111111111111111111111112',
          account: address,
          amount: data.solBalance.lamports.toString(),
          decimals: 9,
          uiAmount: data.solBalance.sol,
          uiAmountString: data.solBalance.sol.toString(),
          mintInfo: {
            decimals: 9,
            supply: '0',
          },
          metadata: {
            name: 'Solana',
            symbol: 'SOL',
            uri: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
            image: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
          },
        };
        
        const updatedData = {
          ...data,
          tokenBalances: [solToken, ...data.tokenBalances],
          totalTokens: data.totalTokens + 1,
        };
        
        setWalletData(updatedData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchWalletData();
  }, [address]);

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
    } catch (err) {
      console.error('Failed to copy address:', err);
    }
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-6)}`;
  };

  if (loading) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-8 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-black to-blue-900/20" />
        <div className="space-y-6 text-center relative z-10">
          <Loader2 className="w-16 h-16 animate-spin text-purple-400 mx-auto" />
          <div className="space-y-2">
            <p className="text-xl font-semibold text-white">Loading wallet data...</p>
            <p className="text-gray-400">Fetching token balances</p>
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-8 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-black to-blue-900/20" />
        <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-6 max-w-md relative z-10">
          <h2 className="text-red-400 text-xl font-bold mb-2">Error</h2>
          <p className="text-red-300">{error}</p>
          <button
            onClick={() => router.back()}
            className="mt-4 w-full px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-xl transition-all hover:scale-105 transform"
          >
            Go Back
          </button>
        </div>
      </main>
    );
  }

  if (!walletData) {
    return null;
  }

  return (
    <main className="min-h-screen p-4 sm:p-8 relative">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-black to-blue-900/20" />
      
      <div className="max-w-4xl mx-auto space-y-6 relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back</span>
          </button>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Devnet
          </div>
        </div>

        {/* Wallet Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-2xl flex items-center justify-center">
              <Wallet className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                Wallet Portfolio
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-gray-400 font-mono text-sm">{formatAddress(address)}</p>
                <button
                  onClick={copyAddress}
                  className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                  title="Copy full address"
                >
                  {copiedAddress ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Token Holdings Section */}
        <div className="bg-white/5 rounded-2xl p-6 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white">Token Holdings</h2>
            <span className="px-4 py-2 bg-purple-500/20 text-purple-300 rounded-xl text-sm font-medium">
              {walletData.totalTokens} {walletData.totalTokens === 1 ? 'Token' : 'Tokens'}
            </span>
          </div>

          {walletData.tokenBalances.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Wallet className="w-8 h-8 text-gray-500" />
              </div>
              <p className="text-gray-400">No token balances found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {walletData.tokenBalances.map((token, index) => {
                const hasMetadata = token.metadata && token.metadata.name && token.metadata.symbol;
                const displayName = hasMetadata ? token.metadata!.name : formatAddress(token.mint);
                const displaySymbol = hasMetadata ? token.metadata!.symbol : 'Unknown';
                const hasLogo = token.metadata?.image && token.metadata.image.trim() !== '';

                return (
                  <div
                    key={token.account}
                    className="bg-white/5 hover:bg-white/10 rounded-xl p-4 transition-all hover:scale-[1.02] transform"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        {hasLogo ? (
                          <div className="w-12 h-12 rounded-xl overflow-hidden bg-white/10 flex items-center justify-center flex-shrink-0">
                            <img
                              src={token.metadata!.image!}
                              alt={displayName}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                const parent = e.currentTarget.parentElement;
                                if (parent) {
                                  parent.innerHTML = `<div class="w-full h-full bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center text-white font-bold text-xs">${displaySymbol.slice(0, 3).toUpperCase()}</div>`;
                                }
                              }}
                            />
                          </div>
                        ) : (
                          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                            {displaySymbol.slice(0, 3).toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-semibold text-base truncate">{displayName}</p>
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            <span className="font-mono truncate">{formatAddress(token.mint)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xl font-bold text-white">
                          {parseFloat(token.uiAmountString).toLocaleString(undefined, {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 6
                          })}
                        </p>
                        <p className="text-gray-400 text-xs font-medium">{displaySymbol}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="text-center text-gray-500 text-sm">
          <p>Showing all SPL tokens and native SOL balance</p>
        </div>
      </div>
    </main>
  );
}
