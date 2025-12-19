export interface PasskeyCredential {
  publicKey: Uint8Array;
  credentialId: Uint8Array;
}

export interface StoredCredential {
  credentialId: number[];
  publicKey: number[];
  owner: string;
}

export async function createPasskey(username: string): Promise<PasskeyCredential> {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: {
        name: "Keystore",
        id: window.location.hostname,
      },
      user: {
        id: new TextEncoder().encode(username),
        name: username,
        displayName: username,
      },
      pubKeyCredParams: [{ alg: -7, type: "public-key" }],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "required",
      },
      timeout: 60000,
    },
  }) as PublicKeyCredential;
  
  const response = credential.response as AuthenticatorAttestationResponse;
  const publicKey = extractPublicKey(response.getPublicKey()!);
  
  return {
    publicKey,
    credentialId: new Uint8Array(credential.rawId),
  };
}

export async function signWithPasskey(
  credentialId: Uint8Array,
  message: Uint8Array
): Promise<{ signature: Uint8Array; authenticatorData: Uint8Array; clientDataJSON: Uint8Array }> {
  // Hash the message to 32 bytes for the challenge
  const msgHash = await crypto.subtle.digest("SHA-256", message);
  
  const credential = await navigator.credentials.get({
    publicKey: {
      challenge: new Uint8Array(msgHash),
      rpId: window.location.hostname,
      allowCredentials: [{
        id: credentialId,
        type: "public-key",
      }],
      userVerification: "required",
      timeout: 60000,
    },
  }) as PublicKeyCredential;
  
  const response = credential.response as AuthenticatorAssertionResponse;
  
  return {
    signature: derToRaw(new Uint8Array(response.signature)),
    authenticatorData: new Uint8Array(response.authenticatorData),
    clientDataJSON: new Uint8Array(response.clientDataJSON),
  };
}

function extractPublicKey(spki: ArrayBuffer): Uint8Array {
  const raw = new Uint8Array(spki);
  // SPKI for P-256: skip 26-byte header, get 65-byte uncompressed point
  const uncompressed = raw.slice(-65);
  // Compress: 0x02 if y even, 0x03 if odd
  const x = uncompressed.slice(1, 33);
  const y = uncompressed.slice(33, 65);
  const prefix = (y[31] & 1) === 0 ? 0x02 : 0x03;
  const compressed = new Uint8Array(33);
  compressed[0] = prefix;
  compressed.set(x, 1);
  return compressed;
}

function derToRaw(der: Uint8Array): Uint8Array {
  // DER: 0x30 [len] 0x02 [rLen] [r] 0x02 [sLen] [s]
  let offset = 2;
  const rLen = der[offset + 1];
  const r = der.slice(offset + 2, offset + 2 + rLen);
  offset += 2 + rLen;
  const sLen = der[offset + 1];
  const s = der.slice(offset + 2, offset + 2 + sLen);
  
  const raw = new Uint8Array(64);
  // Pad/trim r and s to 32 bytes each
  if (r.length > 32) {
    raw.set(r.slice(-32), 0);
  } else {
    raw.set(r, 32 - r.length);
  }
  if (s.length > 32) {
    raw.set(s.slice(-32), 32);
  } else {
    raw.set(s, 64 - s.length);
  }
  return raw;
}

export function storeCredential(cred: StoredCredential) {
  localStorage.setItem("keystore_credential", JSON.stringify(cred));
}

export function getStoredCredential(): StoredCredential | null {
  const stored = localStorage.getItem("keystore_credential");
  return stored ? JSON.parse(stored) : null;
}

