import { Keystore } from "@/types/keystore";
import {
  AccountMeta,
  Connection,
  PublicKey,
  TransactionInstruction,
  Keypair,
  Transaction,
  SystemProgram,
  SYSVAR_INSTRUCTIONS_PUBKEY,
} from "@solana/web3.js";
import { Address, BN } from "@coral-xyz/anchor";
import keystoreIdl from "@/idl/keystore.json";
import { ProgramClient } from "./program-client";
import { buildSecp256r1Instruction } from "./secp256r1";

// Action types matching the Rust enum
export type Action = 
    | { type: "send"; to: PublicKey; lamports: number }
    | { type: "setThreshold"; threshold: number };

// Signature data matching the Rust struct
export interface SignatureData {
    keyIndex: number;
    signature: Uint8Array; // 64 bytes
    recoveryId: number;
}

export class KeystoreClient extends ProgramClient<Keystore> {
    constructor(connection: Connection) {
        super(connection, keystoreIdl);
    }

    // Funded Keypair
    private getFundedKeypair(): Keypair {
        const adminKeypair = Keypair.fromSecretKey(
            new Uint8Array(JSON.parse(process.env.ADMIN_WALLET ?? ""))
        );
        return adminKeypair;
    }
    
    // PDAs
    getIdentityPDA(pubkey: Uint8Array) : PublicKey {
        // Derive identity PDA using "identity" seed and the provided public key 
        // (excluding first byte)
        return PublicKey.findProgramAddressSync(
            [
                Buffer.from("identity"), 
                pubkey.slice(1)
            ],
            this.program.programId
        )[0];
    }

    getVaultPDA(identity: PublicKey): PublicKey {
        return PublicKey.findProgramAddressSync(
            [Buffer.from("vault"), identity.toBuffer()],
            this.program.programId
        )[0];
    }

    // Accounts
    async getIdentity(identityPda: PublicKey) {
        try {
            const account = await this.connection.getAccountInfo(identityPda);
            if (!account) return null;
            
            // Parse account data (simplified for demo)
            // In production, use Anchor's IDL-based deserialization
            const data = account.data;
            return {
                bump: data[8],
                vaultBump: data[9],
                threshold: data[10],
                nonce: Number(new DataView(data.buffer).getBigUint64(11, true)),
                keys: [], // TODO: Parse keys vector
            };
        } catch (e) {
            console.error("Failed to fetch identity:", e);
            return null;
        }
    }

    // Txs
    async createIdentityTx(pubkey: Uint8Array, deviceName: string, payer?: Keypair) {
        // Check if pubkey is 33 bytes
        if (pubkey.length !== 33) {
            throw new Error("Public key must be 33 bytes (secp256r1 compressed format)");
        } 
        try{
            // Get Payer Keypair
            const actualPayer = payer || this.getFundedKeypair();
            
            // Get Identity PDA
            const identityPDA = this.getIdentityPDA(pubkey);

            const createIx = await this.program.methods
                .createIdentity(
                    Array.from(pubkey) as unknown as number[],
                    deviceName,
                )
                .accounts({
                    payer: actualPayer.publicKey,
                    identity: identityPDA,
                })
                .instruction();

            const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash();
            const transaction = new Transaction({
                feePayer: actualPayer.publicKey, 
                recentBlockhash: blockhash
            }).add(createIx);
            
            transaction.sign(actualPayer);
            
            // Use sendRawTransaction + polling instead of sendAndConfirmTransaction
            // to avoid WebSocket issues in serverless environments (Vercel)
            const sig = await this.connection.sendRawTransaction(transaction.serialize());
            
            // Poll for confirmation instead of using WebSocket subscription
            await this.confirmTransactionPolling(sig, lastValidBlockHeight);
            
            return sig;
        } catch (error) {
            console.error("Error creating identity:", error);
            throw error;
        }
    }

    // Execute Transaction with WebAuthn signature verification
    async executeTx(
        identity: PublicKey,
        action: Action,
        pubkey: Uint8Array,  // 33-byte secp256r1 pubkey that signed
        signatures: SignatureData[],
        authenticatorData: Uint8Array,  // WebAuthn authenticatorData
        clientDataJSON: Uint8Array,     // WebAuthn clientDataJSON
        payer?: Keypair
    ): Promise<string> {
        console.log("Checking inputs")
        // Validate inputs
        if (pubkey.length !== 33) {
            throw new Error("Public key must be 33 bytes (secp256r1 compressed format)");
        }
        if (signatures.length === 0) {
            throw new Error("At least one signature is required");
        }
        for (const sig of signatures) {
            if (sig.signature.length !== 64) {
                throw new Error("Each signature must be 64 bytes");
            }
        }

        try {
            const actualPayer = payer || this.getFundedKeypair();
            const vaultPDA = this.getVaultPDA(identity);

            // Get current nonce from identity account
            console.log("Fetching identity account for nonce...");
            const identityAccount = await this.getIdentity(identity);
            if (!identityAccount) {
                throw new Error("Identity account not found");
            }
            const nonce = identityAccount.nonce;

            // Build secp256r1 verify instructions for each signature
            // These must precede the execute instruction in the transaction
            // We use the WebAuthn authenticatorData and clientDataJSON to build the message
            console.log("Adding verify signatures ix");
            const verifyInstructions: TransactionInstruction[] = [];
            let signedData: Uint8Array | null = null;
            for (const sig of signatures) {
                const { instruction: verifyIx, signedData: sd } = buildSecp256r1Instruction(
                    pubkey,
                    authenticatorData,
                    clientDataJSON,
                    sig.signature
                );
                verifyInstructions.push(verifyIx);
                signedData = sd; // All signatures should have same signedData
            }

            if (!signedData) {
                throw new Error("No signed data generated");
            }

            // Build the execute instruction using Anchor
            // Convert action to Anchor-compatible format
            console.log("Building anchor signatures array");
            const anchorAction = this.buildAnchorAction(action);
            const anchorSigs = signatures.map(sig => ({
                keyIndex: sig.keyIndex,
                signature: Array.from(sig.signature) as unknown as number[],
                recoveryId: sig.recoveryId,
            }));

            // Determine recipient for Send action
            const recipient = action.type === "send" ? action.to : null;

            console.log("Fetching Program Instruction")
            const executeIx = await this.program.methods
                .execute(anchorAction, anchorSigs, Buffer.from(signedData))
                .accounts({
                    identity: identity,
                    vault: vaultPDA,
                    recipient: recipient,
                })
                .instruction();
            console.log(executeIx);

            // Build transaction: verify instructions first, then execute
            console.log("Creating Transaction")
            const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash();
            const transaction = new Transaction({
                feePayer: actualPayer.publicKey,
                recentBlockhash: blockhash,
            });

            // Add verify instructions BEFORE execute instruction
            for (const verifyIx of verifyInstructions) {
                transaction.add(verifyIx);
            }
            transaction.add(executeIx);

            transaction.sign(actualPayer);

            // Send and confirm using polling (serverless-compatible)
            console.log("Sending Transaction")
            const sig = await this.connection.sendRawTransaction(transaction.serialize());
            await this.confirmTransactionPolling(sig, lastValidBlockHeight);

            return sig;
        } catch (error) {
            console.error("Error executing transaction:", error);
            throw error;
        }
    }

    // Build message that matches Rust's build_message function
    // Message = action.try_to_vec() + nonce.to_le_bytes()
    buildMessage(action: Action, nonce: number): Uint8Array {
        const data: number[] = [];

        if (action.type === "send") {
            // Send variant = 0
            data.push(0);
            // to: Pubkey (32 bytes)
            data.push(...action.to.toBytes());
            // lamports: u64 (8 bytes, little-endian)
            const lamportBytes = new ArrayBuffer(8);
            new DataView(lamportBytes).setBigUint64(0, BigInt(action.lamports), true);
            data.push(...new Uint8Array(lamportBytes));
        } else {
            // SetThreshold variant = 1
            data.push(1);
            // threshold: u8 (1 byte)
            data.push(action.threshold);
        }

        // Append nonce (u64, little-endian)
        const nonceBytes = new ArrayBuffer(8);
        new DataView(nonceBytes).setBigUint64(0, BigInt(nonce), true);
        data.push(...new Uint8Array(nonceBytes));

        return new Uint8Array(data);
    }

    // Convert action to Anchor-compatible format
    private buildAnchorAction(action: Action): any {
        if (action.type === "send") {
            return {
                send: {
                    to: action.to,
                    lamports: new BN(action.lamports),
                },
            };
        } else {
            return {
                setThreshold: {
                    threshold: action.threshold,
                },
            };
        }
    }

    // Helper to confirm transaction via polling (serverless-compatible)
    private async confirmTransactionPolling(
        signature: string, 
        lastValidBlockHeight: number,
        maxRetries = 30
    ): Promise<void> {
        for (let i = 0; i < maxRetries; i++) {
            const status = await this.connection.getSignatureStatus(signature);
            
            if (status.value !== null) {
                if (status.value.err) {
                    throw new Error(`Transaction failed: ${JSON.stringify(status.value.err)}`);
                }
                if (status.value.confirmationStatus === 'confirmed' || 
                    status.value.confirmationStatus === 'finalized') {
                    return;
                }
            }
            
            // Check if blockhash expired
            const blockHeight = await this.connection.getBlockHeight();
            if (blockHeight > lastValidBlockHeight) {
                throw new Error('Transaction expired: blockhash no longer valid');
            }
            
            // Wait before next poll
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        throw new Error('Transaction confirmation timeout');
    }
}


