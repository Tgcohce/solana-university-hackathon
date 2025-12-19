import { Connection, PublicKey } from '@solana/web3.js';
import { getAccount, TOKEN_PROGRAM_ID, getMint } from '@solana/spl-token';
import { NextRequest, NextResponse } from 'next/server';

const METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

async function getMetadataPDA(mint: PublicKey): Promise<PublicKey> {
  const [metadataPDA] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('metadata'),
      METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    METADATA_PROGRAM_ID
  );
  return metadataPDA;
}

async function fetchImageFromUri(uri: string): Promise<string | null> {
  try {
    if (!uri || uri.trim() === '') {
      return null;
    }

    const response = await fetch(uri, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    const json = await response.json();
    return json.image || null;
  } catch (error) {
    console.error(`Error fetching image from URI ${uri}:`, error);
    return null;
  }
}

async function fetchTokenMetadata(connection: Connection, mintAddress: string) {
  try {
    const mintPublicKey = new PublicKey(mintAddress);
    const metadataPDA = await getMetadataPDA(mintPublicKey);
    
    const accountInfo = await connection.getAccountInfo(metadataPDA);
    
    if (!accountInfo) {
      return null;
    }

    const data = accountInfo.data;
    
    let name = '';
    let symbol = '';
    let uri = '';
    
    let offset = 1 + 32 + 32;
    
    const nameLength = data.readUInt32LE(offset);
    offset += 4;
    name = data.slice(offset, offset + nameLength).toString('utf8').replace(/\0/g, '');
    offset += nameLength;
    
    const symbolLength = data.readUInt32LE(offset);
    offset += 4;
    symbol = data.slice(offset, offset + symbolLength).toString('utf8').replace(/\0/g, '');
    offset += symbolLength;
    
    const uriLength = data.readUInt32LE(offset);
    offset += 4;
    uri = data.slice(offset, offset + uriLength).toString('utf8').replace(/\0/g, '');
    
    const trimmedUri = uri.trim();
    const image = await fetchImageFromUri(trimmedUri);
    
    return {
      name: name.trim(),
      symbol: symbol.trim(),
      uri: trimmedUri,
      image: image,
    };
  } catch (error) {
    console.error(`Error fetching metadata for ${mintAddress}:`, error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const walletAddress = searchParams.get('address');

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    const rpcUrl = process.env.SOLANA_RPC_URL;
    if (!rpcUrl) {
      return NextResponse.json(
        { error: 'SOLANA_RPC_URL not configured' },
        { status: 500 }
      );
    }

    let publicKey: PublicKey;
    try {
      publicKey = new PublicKey(walletAddress);
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid wallet address' },
        { status: 400 }
      );
    }

    const connection = new Connection(rpcUrl, 'confirmed');

    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      publicKey,
      { programId: TOKEN_PROGRAM_ID }
    );

    const balances = await Promise.all(
      tokenAccounts.value.map(async (accountInfo) => {
        const parsedInfo = accountInfo.account.data.parsed.info;
        const mintAddress = parsedInfo.mint;
        const tokenAmount = parsedInfo.tokenAmount;

        let mintInfo = null;
        try {
          const mintPublicKey = new PublicKey(mintAddress);
          const mintData = await getMint(connection, mintPublicKey);
          mintInfo = {
            decimals: mintData.decimals,
            supply: mintData.supply.toString(),
          };
        } catch (error) {
          console.error(`Error fetching mint info for ${mintAddress}:`, error);
        }

        const metadata = await fetchTokenMetadata(connection, mintAddress);

        return {
          mint: mintAddress,
          account: accountInfo.pubkey.toBase58(),
          amount: tokenAmount.amount,
          decimals: tokenAmount.decimals,
          uiAmount: tokenAmount.uiAmount,
          uiAmountString: tokenAmount.uiAmountString,
          mintInfo,
          metadata,
        };
      })
    );

    const solBalance = await connection.getBalance(publicKey);

    return NextResponse.json({
      wallet: walletAddress,
      solBalance: {
        lamports: solBalance,
        sol: solBalance / 1e9,
      },
      tokenBalances: balances,
      totalTokens: balances.length,
    });
  } catch (error) {
    console.error('Error fetching token balances:', error);
    return NextResponse.json(
      { error: 'Failed to fetch token balances', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/* 
Example Output:
{
  "wallet": "BmBq8NeDva9eLgpRJCnHTwHK2qtPBfTQYHXvBYWYp97",
  "solBalance": {
    "lamports": 65495008,
    "sol": 0.065495008
  },
  "tokenBalances": [
    {
      "mint": "BNso1VUJnh4zcfpZa6986Ea66P6TCp59hvtNJ8b1X85",
      "account": "296jUbhZCiS89gv3RLyFPBvP8duGAFg33sY4EXnv5B6U",
      "amount": "0",
      "decimals": 9,
      "uiAmount": 0,
      "uiAmountString": "0",
      "mintInfo": {
        "decimals": 9,
        "supply": "8708445248493824"
      },
      "metadata": {
        "name": "Binance Staked SOL",
        "symbol": "BNSOL",
        "uri": "https://arweave.net/27IIs9ILSTPBlDykcWdiM-8WwjXfudFZwnV34C7S2sA"
      }
    },
    {
      "mint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      "account": "2E8Mh7rsAkttn8BsF5vYf2RpC7FagGTVJh6uCyScbKov",
      "amount": "4299968",
      "decimals": 6,
      "uiAmount": 4.299968,
      "uiAmountString": "4.299968",
      "mintInfo": {
        "decimals": 6,
        "supply": "11942310291701574"
      },
      "metadata": {
        "name": "USD Coin",
        "symbol": "USDC",
        "uri": ""
      }
    },
    {
      "mint": "jupSoLaHXQiZZTSfEWMTRRgpnyFm8f6sZdosWBjx93v",
      "account": "3a6gFPVDzdddxngn9xnBKrW45EfxMSKpN2CWM1ypaB8w",
      "amount": "0",
      "decimals": 9,
      "uiAmount": 0,
      "uiAmountString": "0",
      "mintInfo": {
        "decimals": 9,
        "supply": "4162984845455793"
      },
      "metadata": {
        "name": "Jupiter Staked SOL",
        "symbol": "JupSOL",
        "uri": "https://static.jup.ag/jupSOL/metadata.json"
      }
    },
    {
      "mint": "5oVNBeEEQvYi1cX3ir8Dx5n1P7pdxydbGF2X4TxVusJm",
      "account": "4WxcCWrrinoMS7pKJDahMXR1WWQ9RD7A4vKnVC3KRfJd",
      "amount": "7275203",
      "decimals": 9,
      "uiAmount": 0.007275203,
      "uiAmountString": "0.007275203",
      "mintInfo": {
        "decimals": 9,
        "supply": "1424203944113490"
      },
      "metadata": {
        "name": "Infinity",
        "symbol": "INF",
        "uri": "https://arweave.net/O0ckxOiu_CCgjuxDdnloBwHKxFu-KH9kBJU0FemeGYI"
      }
    },
    {
      "mint": "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
      "account": "7hfpAgP7cbXonYYyT8RSGjryR7shYQmeS6shERwgCdY9",
      "amount": "0",
      "decimals": 6,
      "uiAmount": 0,
      "uiAmountString": "0",
      "mintInfo": {
        "decimals": 6,
        "supply": "2739917150594953"
      },
      "metadata": {
        "name": "USDT",
        "symbol": "USDT",
        "uri": ""
      }
    },
    {
      "mint": "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn",
      "account": "CVQRJsw6e5LcV4DB54YZ7NYUto5fNaPaZrpxFCwcyboZ",
      "amount": "0",
      "decimals": 9,
      "uiAmount": 0,
      "uiAmountString": "0",
      "mintInfo": {
        "decimals": 9,
        "supply": "11502600546313655"
      },
      "metadata": {
        "name": "Jito Staked SOL",
        "symbol": "JitoSOL",
        "uri": "https://storage.googleapis.com/token-metadata/JitoSOL.json"
      }
    }
  ],
  "totalTokens": 6
}
*/
