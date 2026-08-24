/**
 * Web Push Protocol implementation for Cloudflare Workers.
 *
 * Implements:
 * - VAPID JWT signing (RFC 8292) using Web Crypto API
 * - AES128GCM content encryption (RFC 8291) using Web Crypto API
 * - Push message delivery to subscription endpoints
 */

type PushSubscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

type VapidKeys = {
  publicKey: string;
  privateKey: string;
  subject: string;
};

/* =========================================================
   BASE64 HELPERS
   ========================================================= */

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(str: string): Uint8Array {
  const padded = str + "=".repeat((4 - (str.length % 4)) % 4);
  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  return Uint8Array.from([...binary].map((c) => c.charCodeAt(0)));
}

function base64Decode(str: string): Uint8Array {
  const binary = atob(str);
  return Uint8Array.from([...binary].map((c) => c.charCodeAt(0)));
}

/* =========================================================
   VAPID JWT (RFC 8292)
   ========================================================= */

async function createVapidJwt(
  keys: VapidKeys,
  endpoint: string
): Promise<string> {
  const audience = new URL(endpoint).origin;

  const header = { typ: "JWT", alg: "ES256" };
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: keys.subject,
  };

  const enc = new TextEncoder();
  const headerB64 = base64UrlEncode(
    enc.encode(JSON.stringify(header)).buffer as ArrayBuffer
  );
  const payloadB64 = base64UrlEncode(
    enc.encode(JSON.stringify(payload)).buffer as ArrayBuffer
  );
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Import the VAPID private key (P-256, raw or PKCS8).
  // VAPID private keys are typically stored as base64url
  // of the 32-byte raw scalar. We reconstruct it as a
  // PKCS8 DER so Web Crypto can import it.
  const privateKeyBytes = base64UrlDecode(keys.privateKey);

  const pkcs8Der = buildPkcs8FromRawScalar(privateKeyBytes);

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    pkcs8Der,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    cryptoKey,
    enc.encode(unsignedToken)
  );

  const signatureB64 = base64UrlEncode(signature);

  return `${unsignedToken}.${signatureB64}`;
}

/**
 * Build a PKCS8 DER envelope around a 32-byte P-256
 * raw private scalar. This lets us feed it to Web
 * Crypto's importKey with format "pkcs8".
 */
function buildPkcs8FromRawScalar(scalar: Uint8Array): ArrayBuffer {
  // The P-256 PKCS8 prefix for a raw private key
  // structure: SEQUENCE { AlgorithmIdentifier, OCTET STRING {
  //   SEQUENCE { INTEGER 1, OCTET STRING <32 bytes> } } }
  const prefix = new Uint8Array([
    0x30, 0x77, 0x02, 0x01, 0x00, 0x30, 0x10, 0x06, 0x07, 0x2a,
    0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, 0x06, 0x05, 0x2b, 0x81,
    0x04, 0x00, 0x22, 0x04, 0x62, 0x04, 0x60, 0x30, 0x57, 0x02,
    0x01, 0x01, 0x04, 0x20,
  ]);

  const result = new Uint8Array(prefix.length + scalar.length);
  result.set(prefix, 0);
  result.set(scalar, prefix.length);
  return result.buffer;
}

/* =========================================================
   AES128GCM CONTENT ENCRYPTION (RFC 8291)
   ========================================================= */

async function encryptPayload(
  payload: string,
  subscription: PushSubscription
): Promise<ArrayBuffer> {
  const enc = new TextEncoder();
  const plaintext = enc.encode(payload);

  // Decode subscription keys
  const userPublicKey = base64Decode(subscription.p256dh);
  const userAuthSecret = base64Decode(subscription.auth);

  // Import the user's P-256 ECDH public key
  const userCryptoKey = await crypto.subtle.importKey(
    "raw",
    userPublicKey,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  // Generate ephemeral ECDH key pair
  const ephemeralKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );

  // Derive shared secret via ECDH
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: "ECDH", public: userCryptoKey },
    ephemeralKeyPair.privateKey,
    256
  );

  // Export ephemeral public key (65 bytes, uncompressed)
  const ephemeralPublicKey = await crypto.subtle.exportKey(
    "raw",
    ephemeralKeyPair.publicKey
  );
  const ecdhPublicKeyBytes = new Uint8Array(ephemeralPublicKey);

  // RFC 8291 IKM = ECDH shared secret || auth secret
  const ikm = new Uint8Array(
    sharedSecret.byteLength + userAuthSecret.byteLength
  );
  ikm.set(new Uint8Array(sharedSecret), 0);
  ikm.set(userAuthSecret, sharedSecret.byteLength);

  // HKDF-SHA-256 to derive content encryption key (16 bytes) and nonce (12 bytes)
  const info = new Uint8Array([
    ..."WebPush: info".length,
    ...ecdhPublicKeyBytes,
    ...userPublicKey,
  ]);

  const cekInfo = new Uint8Array([
    0x00, 0x00, 0x00, 0x01, // record sequence (1)
    ...enc.encode("Content-Encoding: aes128gcm"),
    0x00, 0x10, // length: 16
  ]);

  const nonceInfo = new Uint8Array([
    0x00, 0x00, 0x00, 0x01,
    ...enc.encode("Content-Encoding: nonce"),
    0x00, 0x0c, // length: 12
  ]);

  const cek = await hkdfSha256(ikm, cekInfo, 16);
  const nonce = await hkdfSha256(ikm, nonceInfo, 12);

  // Import CEK for AES-GCM
  const aesKey = await crypto.subtle.importKey(
    "raw",
    cek,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  // Encrypt
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce },
    aesKey,
    plaintext
  );

  // Build RFC 8291 header
  const maxRecordSize = 4096;
  const headerSize = 21 + ecdhPublicKeyBytes.length;
  const paddingSize = maxRecordSize - headerSize - encrypted.byteLength;

  const encryptedBytes = new Uint8Array(encrypted);
  const padding = new Uint8Array(paddingSize);

  const result = new Uint8Array(
    headerSize + encryptedBytes.length + paddingSize
  );

  // Header
  result.set(ecdhPublicKeyBytes, 0);
  const dv = new DataView(result.buffer);
  dv.setUint32(65, maxRecordSize); // rs
  dv.setUint8(69, 1); // idlen (we use salt = 0, so 0)

  // Actually, RFC 8291 header is:
  // salt (16 bytes) || rs (4 bytes) || idlen (1 byte) || keyid (idlen bytes)
  // keyid = ephemeral public key, idlen = 65
  // Let me redo this properly.

  return buildRfc8291Record(
    ecdhPublicKeyBytes,
    encryptedBytes,
    maxRecordSize
  );
}

function buildRfc8291Record(
  ephemeralPublicKey: Uint8Array,
  ciphertext: Uint8Array,
  maxRecordSize: number
): ArrayBuffer {
  // RFC 8291 record:
  // salt (16 bytes, all zeros) | rs (4 bytes) | idlen (1 byte = 65) | keyid (65 bytes = ephemeral pubkey) | ciphertext
  const salt = new Uint8Array(16); // zeros
  const idlen = ephemeralPublicKey.length; // 65

  const headerSize = 16 + 4 + 1 + idlen;
  const recordSize = headerSize + ciphertext.length;

  const result = new Uint8Array(recordSize);

  // salt
  result.set(salt, 0);

  // rs (big-endian uint32)
  const dv = new DataView(result.buffer);
  dv.setUint32(16, maxRecordSize);

  // idlen
  result[20] = idlen;

  // keyid (ephemeral public key)
  result.set(ephemeralPublicKey, 21);

  // ciphertext
  result.set(ciphertext, headerSize);

  return result.buffer;
}

/**
 * HKDF-SHA-256 using Web Crypto.
 * Extract step uses a zero-byte salt, expand step
 * uses the provided info and produces `length` bytes.
 */
async function hkdfSha256(
  ikm: Uint8Array,
  info: Uint8Array,
  length: number
): Promise<ArrayBuffer> {
  // Extract: PRK = HMAC-SHA-256(salt=zeroes, IKM)
  const salt = new Uint8Array(32); // zero salt

  const saltKey = await crypto.subtle.importKey(
    "raw",
    salt,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const prk = await crypto.subtle.sign("HMAC", saltKey, ikm);

  // Expand: OKM = HMAC-PRK(info | 0x01) for first block
  const prkKey = await crypto.subtle.importKey(
    "raw",
    prk,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  // For lengths <= 32 (which is our case: 16 or 12), one block suffices
  const input = new Uint8Array(info.length + 1);
  input.set(info, 0);
  input[info.length] = 1; // counter byte

  const okm = await crypto.subtle.sign("HMAC", prkKey, input);

  // Return only the requested number of bytes
  return okm.slice(0, length);
}

/* =========================================================
   SEND PUSH NOTIFICATION
   ========================================================= */

export async function sendPushNotification(
  subscription: PushSubscription,
  payload: { title: string; body: string; url?: string },
  vapidKeys: VapidKeys
): Promise<boolean> {
  try {
    const jwt = await createVapidJwt(vapidKeys, subscription.endpoint);
    const encrypted = await encryptPayload(
      JSON.stringify(payload),
      subscription
    );

    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aes128gcm",
        "TTL": "2419200",
        "Authorization": `vapid t=${jwt}, k=${vapidKeys.publicKey}`,
      },
      body: encrypted,
    });

    if (!response.ok && response.status !== 201) {
      console.error(
        `Push delivery failed: ${response.status} ${response.statusText}`
      );

      // 404/410 = subscription expired, caller should remove it
      if (response.status === 404 || response.status === 410) {
        return false;
      }
    }

    return response.ok || response.status === 201;
  } catch (error) {
    console.error("Push delivery error:", error);
    return false;
  }
}

export type { PushSubscription, VapidKeys };
