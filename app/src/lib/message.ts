import { PublicKey } from "@solana/web3.js";

// Action types matching the Rust enum
export type Action = 
    | { type: "send"; to: PublicKey; lamports: number }
    | { type: "setThreshold"; threshold: number };

/**
 * Build message that matches Rust's build_message function
 * Message = action.try_to_vec() + nonce.to_le_bytes()
 * 
 * This is used on the frontend to build the message that will be signed by the passkey
 */
export function buildMessage(action: Action, nonce: number): Uint8Array {
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
