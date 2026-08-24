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
  const padded =
    str +
    "=".repeat((4 - (str.length % 4)) % 4);

  const base64 = padded
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const binary = atob(base64);

  return Uint8Array.from(
    [...binary].map((c) => c.charCodeAt(0))
  );
}

/* =========================================================
   VAPID JWT (RFC 8292)
   ========================================================= */

async function createVapidJwt(
  keys: VapidKeys,
  endpoint: string
): Promise<string> {
  const audience = new URL(endpoint).origin;

  const header = {
    typ: "JWT",
    alg: "ES256"
  };

  const payload = {
    aud: audience,
    exp:
      Math.floor(Date.now() / 1000) +
      12 * 60 * 60,
    sub: keys.subject
  };

  const enc = new TextEncoder();

  const headerB64 = base64UrlEncode(
    enc.encode(
      JSON.stringify(header)
    ).buffer as ArrayBuffer
  );

  const payloadB64 = base64UrlEncode(
    enc.encode(
      JSON.stringify(payload)
    ).buffer as ArrayBuffer
  );

  const unsignedToken =
    `${headerB64}.${payloadB64}`;

  const privateKeyBytes =
    base64UrlDecode(keys.privateKey);

  if (privateKeyBytes.length !== 32) {
    throw new Error(
      `Invalid VAPID private key length: ${privateKeyBytes.length} bytes`
    );
  }

  const pkcs8Der =
    buildPkcs8FromRawScalar(
      privateKeyBytes
    );

  const cryptoKey =
    await crypto.subtle.importKey(
      "pkcs8",
      pkcs8Der,
      {
        name: "ECDSA",
        namedCurve: "P-256"
      },
      false,
      ["sign"]
    );

  const signature =
    await crypto.subtle.sign(
      {
        name: "ECDSA",
        hash: "SHA-256"
      },
      cryptoKey,
      enc.encode(unsignedToken)
    );

  return (
    `${unsignedToken}.` +
    base64UrlEncode(signature)
  );
}

/**
 * Build a PKCS#8 DER envelope around
 * a 32-byte P-256 raw private scalar.
 */
function buildPkcs8FromRawScalar(
  scalar: Uint8Array
): ArrayBuffer {
  const prefix = new Uint8Array([
    0x30, 0x3c,
    0x02, 0x01, 0x00,
    0x30, 0x10,
    0x06, 0x07,
    0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01,
    0x06, 0x05,
    0x2b, 0x81, 0x04, 0x00, 0x22,
    0x04, 0x27,
    0x30, 0x25,
    0x02, 0x01, 0x01,
    0x04, 0x20
  ]);

  const result =
    new Uint8Array(
      prefix.length + scalar.length
    );

  result.set(prefix, 0);
  result.set(scalar, prefix.length);

  return result.buffer;
}

/* =========================================================
   HKDF-SHA-256
   ========================================================= */

async function hkdfExtract(
  salt: Uint8Array,
  ikm: Uint8Array
): Promise<ArrayBuffer> {
  const saltKey =
    await crypto.subtle.importKey(
      "raw",
      salt,
      {
        name: "HMAC",
        hash: "SHA-256"
      },
      false,
      ["sign"]
    );

  return crypto.subtle.sign(
    "HMAC",
    saltKey,
    ikm
  );
}

async function hkdfExpand(
  prk: ArrayBuffer,
  info: Uint8Array,
  length: number
): Promise<Uint8Array> {
  if (length > 32) {
    throw new Error(
      "This HKDF implementation supports outputs up to 32 bytes."
    );
  }

  const prkKey =
    await crypto.subtle.importKey(
      "raw",
      prk,
      {
        name: "HMAC",
        hash: "SHA-256"
      },
      false,
      ["sign"]
    );

  const input =
    new Uint8Array(
      info.length + 1
    );

  input.set(info, 0);

  // First HKDF expansion block.
  input[info.length] = 0x01;

  const output =
    await crypto.subtle.sign(
      "HMAC",
      prkKey,
      input
    );

  return new Uint8Array(
    output.slice(0, length)
  );
}

/* =========================================================
   AES128GCM CONTENT ENCRYPTION (RFC 8291)
   ========================================================= */

async function encryptPayload(
  payload: string,
  subscription: PushSubscription
): Promise<ArrayBuffer> {
  const enc = new TextEncoder();

  const plaintext =
    enc.encode(payload);

  const userPublicKey =
    base64UrlDecode(subscription.p256dh);

  const userAuthSecret =
    base64UrlDecode(subscription.auth);

  if (userPublicKey.length !== 65) {
    throw new Error(
      `Invalid subscription public key length: ${userPublicKey.length}`
    );
  }

  if (userAuthSecret.length !== 16) {
    throw new Error(
      `Invalid subscription auth secret length: ${userAuthSecret.length}`
    );
  }

  /*
   * Import the browser's P-256 ECDH public key.
   */
  const userCryptoKey =
    await crypto.subtle.importKey(
      "raw",
      userPublicKey,
      {
        name: "ECDH",
        namedCurve: "P-256"
      },
      false,
      []
    );

  /*
   * Generate a fresh ephemeral P-256
   * key pair for this notification.
   */
  const ephemeralKeyPair =
    await crypto.subtle.generateKey(
      {
        name: "ECDH",
        namedCurve: "P-256"
      },
      true,
      ["deriveBits"]
    );

  /*
   * ECDH shared secret.
   */
  const sharedSecret =
    new Uint8Array(
      await crypto.subtle.deriveBits(
        {
          name: "ECDH",
          public: userCryptoKey
        },
        ephemeralKeyPair.privateKey,
        256
      )
    );

  /*
   * Export the application server's
   * ephemeral public key in uncompressed
   * P-256 form.
   *
   * This is 65 bytes:
   * 0x04 || X || Y
   */
  const ephemeralPublicKey =
    new Uint8Array(
      await crypto.subtle.exportKey(
        "raw",
        ephemeralKeyPair.publicKey
      )
    );

  /*
   * RFC 8291:
   *
   * PRK_key =
   *   HMAC-SHA256(
   *     auth_secret,
   *     ecdh_secret
   *   )
   */
  const prkKey =
    await hkdfExtract(
      userAuthSecret,
      sharedSecret
    );

  /*
   * key_info =
   *   "WebPush: info" ||
   *   0x00 ||
   *   ua_public ||
   *   as_public
   */
  const webPushInfoPrefix =
    enc.encode("WebPush: info");

  const keyInfo =
    new Uint8Array(
      webPushInfoPrefix.length +
      1 +
      userPublicKey.length +
      ephemeralPublicKey.length
    );

  let keyInfoOffset = 0;

  keyInfo.set(
    webPushInfoPrefix,
    keyInfoOffset
  );

  keyInfoOffset +=
    webPushInfoPrefix.length;

  keyInfo[keyInfoOffset] = 0x00;
  keyInfoOffset++;

  keyInfo.set(
    userPublicKey,
    keyInfoOffset
  );

  keyInfoOffset +=
    userPublicKey.length;

  keyInfo.set(
    ephemeralPublicKey,
    keyInfoOffset
  );

  /*
   * IKM =
   * HKDF-Expand(
   *   PRK_key,
   *   key_info,
   *   32
   * )
   */
  const ikm =
    await hkdfExpand(
      prkKey,
      keyInfo,
      32
    );

  /*
   * Generate a fresh random 16-byte
   * content encryption salt.
   *
   * RFC 8291 requires a new random
   * salt for each encrypted message.
   */
  const salt =
    crypto.getRandomValues(
      new Uint8Array(16)
    );

  /*
   * PRK =
   *   HMAC-SHA256(
   *     salt,
   *     IKM
   *   )
   */
  const prk =
    await hkdfExtract(
      salt,
      ikm
    );

  /*
   * CEK info:
   *
   * "Content-Encoding: aes128gcm" ||
   * 0x00
   */
  const cekInfo =
    new Uint8Array(
      enc.encode(
        "Content-Encoding: aes128gcm"
      ).length + 1
    );

  const cekInfoText =
    enc.encode(
      "Content-Encoding: aes128gcm"
    );

  cekInfo.set(
    cekInfoText,
    0
  );

  cekInfo[cekInfo.length - 1] =
    0x00;

  /*
   * Nonce info:
   *
   * "Content-Encoding: nonce" ||
   * 0x00
   */
  const nonceInfo =
    new Uint8Array(
      enc.encode(
        "Content-Encoding: nonce"
      ).length + 1
    );

  const nonceInfoText =
    enc.encode(
      "Content-Encoding: nonce"
    );

  nonceInfo.set(
    nonceInfoText,
    0
  );

  nonceInfo[nonceInfo.length - 1] =
    0x00;

  /*
   * Derive the AES-128-GCM content
   * encryption key and 12-byte nonce.
   */
  const cek =
    await hkdfExpand(
      prk,
      cekInfo,
      16
    );

  const nonce =
    await hkdfExpand(
      prk,
      nonceInfo,
      12
    );

  /*
   * RFC 8188 requires the final record
   * to end with a padding delimiter.
   *
   * 0x02 = final record delimiter.
   */
  const paddedPlaintext =
    new Uint8Array(
      plaintext.length + 1
    );

  paddedPlaintext.set(
    plaintext,
    0
  );

  paddedPlaintext[
    paddedPlaintext.length - 1
  ] = 0x02;

  /*
   * Import CEK as AES-GCM key.
   */
  const aesKey =
    await crypto.subtle.importKey(
      "raw",
      cek,
      {
        name: "AES-GCM"
      },
      false,
      ["encrypt"]
    );

  /*
   * Encrypt plaintext + padding delimiter.
   */
  const ciphertext =
    new Uint8Array(
      await crypto.subtle.encrypt(
        {
          name: "AES-GCM",
          iv: nonce
        },
        aesKey,
        paddedPlaintext
      )
    );

  /*
   * RFC 8188 record size.
   *
   * Header:
   *   salt     = 16 bytes
   *   rs       = 4 bytes
   *   idlen    = 1 byte
   *   keyid    = 65 bytes
   *
   * Total header = 86 bytes.
   *
   * rs must be greater than:
   *
   * plaintext
   * + padding delimiter
   * + authentication tag
   */
  const recordSize = 4096;

  if (
    plaintext.length +
      1 +
      16 >=
    recordSize
  ) {
    throw new Error(
      "Push payload is too large."
    );
  }

  return buildRfc8291Record(
    salt,
    ephemeralPublicKey,
    ciphertext,
    recordSize
  );
}

/* =========================================================
   RFC 8291 / RFC 8188 RECORD
   ========================================================= */

function buildRfc8291Record(
  salt: Uint8Array,
  ephemeralPublicKey: Uint8Array,
  ciphertext: Uint8Array,
  recordSize: number
): ArrayBuffer {
  if (salt.length !== 16) {
    throw new Error(
      "RFC 8291 salt must be 16 bytes."
    );
  }

  if (ephemeralPublicKey.length !== 65) {
    throw new Error(
      "RFC 8291 keyid must be 65 bytes."
    );
  }

  /*
   * aes128gcm header:
   *
   * salt 16
   * rs 4
   * idlen 1
   * keyid 65
   */
  const headerSize =
    16 + 4 + 1 +
    ephemeralPublicKey.length;

  const totalSize =
    headerSize +
    ciphertext.length;

  const result =
    new Uint8Array(totalSize);

  /*
   * Salt.
   */
  result.set(
    salt,
    0
  );

  /*
   * Record size, big endian.
   */
  const dataView =
    new DataView(
      result.buffer
    );

  dataView.setUint32(
    16,
    recordSize
  );

  /*
   * Key ID length.
   */
  result[20] =
    ephemeralPublicKey.length;

  /*
   * Application server's
   * ephemeral public key.
   */
  result.set(
    ephemeralPublicKey,
    21
  );

  /*
   * Encrypted payload.
   */
  result.set(
    ciphertext,
    headerSize
  );

  return result.buffer;
}

/* =========================================================
   SEND PUSH NOTIFICATION
   ========================================================= */

export async function sendPushNotification(
  subscription: PushSubscription,
  payload: {
    title: string;
    body: string;
    url?: string;
  },
  vapidKeys: VapidKeys
): Promise<boolean> {
  try {
    const jwt =
      await createVapidJwt(
        vapidKeys,
        subscription.endpoint
      );

    const encrypted =
      await encryptPayload(
        JSON.stringify(payload),
        subscription
      );

    const response =
      await fetch(
        subscription.endpoint,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/octet-stream",

            "Content-Encoding":
              "aes128gcm",

            TTL: "2419200",

            Authorization:
              `vapid t=${jwt}, k=${vapidKeys.publicKey}`
          },

          body: encrypted
        }
      );

    if (
      !response.ok &&
      response.status !== 201
    ) {
      console.error(
        `Push delivery failed: ${response.status} ${response.statusText}`
      );

      /*
       * 404 / 410 means the browser
       * subscription is no longer valid.
       */
      if (
        response.status === 404 ||
        response.status === 410
      ) {
        return false;
      }
    }

    return (
      response.ok ||
      response.status === 201
    );
  } catch (error) {
    console.error(
      "Push delivery error:",
      error
    );

    return false;
  }
}

export type {
  PushSubscription,
  VapidKeys
};
