/**
 * Web Push Protocol implementation for Cloudflare Workers.
 *
 * Implements:
 * - VAPID JWT signing (RFC 8292)
 * - Web Push payload encryption (RFC 8291)
 * - Push message delivery
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

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(value: string): Uint8Array {
  const padded =
    value + "=".repeat((4 - (value.length % 4)) % 4);

  const base64 = padded
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const binary = atob(base64);

  return Uint8Array.from(
    Array.from(binary).map(char =>
      char.charCodeAt(0)
    )
  );
}

/* =========================================================
   VAPID JWT
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

  const encoder = new TextEncoder();

  const headerB64 = base64UrlEncode(
    encoder.encode(
      JSON.stringify(header)
    ).buffer as ArrayBuffer
  );

  const payloadB64 = base64UrlEncode(
    encoder.encode(
      JSON.stringify(payload)
    ).buffer as ArrayBuffer
  );

  const unsignedToken =
    `${headerB64}.${payloadB64}`;

  const privateKeyBytes =
    base64UrlDecode(keys.privateKey);

  if (privateKeyBytes.length !== 32) {
    throw new Error(
      `Invalid VAPID private key length: ${privateKeyBytes.length}`
    );
  }

  const pkcs8Der =
    buildPkcs8FromRawScalar(
      privateKeyBytes
    );

  const privateKey =
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
      privateKey,
      encoder.encode(unsignedToken)
    );

  return (
    unsignedToken +
    "." +
    base64UrlEncode(signature)
  );
}

/* =========================================================
   PKCS8 PRIVATE KEY BUILDER
   ========================================================= */

function buildPkcs8FromRawScalar(
  scalar: Uint8Array
): ArrayBuffer {
  const prefix = new Uint8Array([
    0x30, 0x77,
    0x02, 0x01, 0x00,
    0x30, 0x10,
    0x06, 0x07,
    0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01,
    0x06, 0x05,
    0x2b, 0x81, 0x04, 0x00, 0x22,
    0x04, 0x62,
    0x04, 0x60,
    0x30, 0x57,
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
   HKDF
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
      "HKDF expand length greater than 32 is not supported."
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
  input[info.length] = 1;

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
   WEB PUSH ENCRYPTION
   RFC 8291
   ========================================================= */

async function encryptPayload(
  payload: string,
  subscription: PushSubscription
): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();

  const userPublicKey =
    base64UrlDecode(
      subscription.p256dh
    );

  const authSecret =
    base64UrlDecode(
      subscription.auth
    );

  if (userPublicKey.length !== 65) {
    throw new Error(
      `Invalid p256dh key length: ${userPublicKey.length}`
    );
  }

  if (authSecret.length !== 16) {
    throw new Error(
      `Invalid auth secret length: ${authSecret.length}`
    );
  }

  /*
   * The browser subscription public key
   * is the user's P-256 ECDH public key.
   */

  const userPublicCryptoKey =
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
   * Generate a NEW ephemeral P-256 key pair
   * for every push message.
   */

  const serverKeyPair =
    await crypto.subtle.generateKey(
      {
        name: "ECDH",
        namedCurve: "P-256"
      },
      true,
      ["deriveBits"]
    );

  /*
   * Derive ECDH shared secret.
   */

  const sharedSecret =
    new Uint8Array(
      await crypto.subtle.deriveBits(
        {
          name: "ECDH",
          public: userPublicCryptoKey
        },
        serverKeyPair.privateKey,
        256
      )
    );

  /*
   * Export our ephemeral public key.
   *
   * This becomes the "keyid" in the
   * aes128gcm record header.
   */

  const serverPublicKey =
    new Uint8Array(
      await crypto.subtle.exportKey(
        "raw",
        serverKeyPair.publicKey
      )
    );

  if (serverPublicKey.length !== 65) {
    throw new Error(
      "Invalid generated server public key."
    );
  }

  /*
   * -------------------------------------------------------
   * RFC 8291 KEY DERIVATION
   * -------------------------------------------------------
   *
   * PRK_key =
   *   HKDF-Extract(auth_secret, ecdh_secret)
   */

  const prkKey =
    await hkdfExtract(
      authSecret,
      sharedSecret
    );

  /*
   * key_info =
   *   "WebPush: info"
   *   || 0x00
   *   || ua_public
   *   || as_public
   */

  const webPushInfoPrefix =
    encoder.encode(
      "WebPush: info"
    );

  const keyInfo =
    new Uint8Array(
      webPushInfoPrefix.length +
      1 +
      userPublicKey.length +
      serverPublicKey.length
    );

  let keyInfoOffset = 0;

  keyInfo.set(
    webPushInfoPrefix,
    keyInfoOffset
  );

  keyInfoOffset +=
    webPushInfoPrefix.length;

  keyInfo[keyInfoOffset] = 0;

  keyInfoOffset += 1;

  keyInfo.set(
    userPublicKey,
    keyInfoOffset
  );

  keyInfoOffset +=
    userPublicKey.length;

  keyInfo.set(
    serverPublicKey,
    keyInfoOffset
  );

  /*
   * IKM =
   *   HKDF-Expand(
   *     PRK_key,
   *     key_info,
   *     32
   *   )
   */

  const ikm =
    await hkdfExpand(
      prkKey,
      keyInfo,
      32
    );

  /*
   * Generate a fresh random 16-byte salt.
   */

  const salt =
    crypto.getRandomValues(
      new Uint8Array(16)
    );

  /*
   * PRK =
   *   HKDF-Extract(
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
   * CEK information.
   *
   * RFC 8291 requires:
   *
   * "Content-Encoding: aes128gcm"
   * || 0x00
   */

  const cekInfoPrefix =
    encoder.encode(
      "Content-Encoding: aes128gcm"
    );

  const cekInfo =
    new Uint8Array(
      cekInfoPrefix.length + 1
    );

  cekInfo.set(
    cekInfoPrefix,
    0
  );

  cekInfo[
    cekInfoPrefix.length
  ] = 0;

  /*
   * Nonce information.
   *
   * "Content-Encoding: nonce"
   * || 0x00
   */

  const nonceInfoPrefix =
    encoder.encode(
      "Content-Encoding: nonce"
    );

  const nonceInfo =
    new Uint8Array(
      nonceInfoPrefix.length + 1
    );

  nonceInfo.set(
    nonceInfoPrefix,
    0
  );

  nonceInfo[
    nonceInfoPrefix.length
  ] = 0;

  /*
   * Derive the 16-byte AES-128 key.
   */

  const cek =
    await hkdfExpand(
      prk,
      cekInfo,
      16
    );

  /*
   * Derive the 12-byte AES-GCM nonce.
   */

  const nonce =
    await hkdfExpand(
      prk,
      nonceInfo,
      12
    );

  /*
   * Import AES key.
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
   * RFC 8291 requires the plaintext to end
   * with a 0x02 padding delimiter.
   */

  const plaintext =
    encoder.encode(payload);

  const paddedPlaintext =
    new Uint8Array(
      plaintext.length + 1
    );

  paddedPlaintext.set(
    plaintext,
    0
  );

  paddedPlaintext[
    plaintext.length
  ] = 0x02;

  /*
   * Encrypt using AES-128-GCM.
   *
   * The authentication tag is automatically
   * appended by Web Crypto.
   */

  const ciphertext =
    new Uint8Array(
      await crypto.subtle.encrypt(
        {
          name: "AES-GCM",
          iv: nonce,
          tagLength: 128
        },
        aesKey,
        paddedPlaintext
      )
    );

  /*
   * aes128gcm record size.
   *
   * The full push body must stay under
   * the commonly supported 4096-byte limit.
   *
   * Header:
   *   16 bytes salt
   *   4 bytes record size
   *   1 byte keyid length
   *   65 bytes keyid
   *
   * Total header = 86 bytes.
   *
   * Ciphertext includes:
   *   plaintext
   *   + 1 padding delimiter
   *   + 16-byte GCM tag
   */

  const headerSize =
    16 + 4 + 1 + 65;

  const totalSize =
    headerSize +
    ciphertext.length;

  if (totalSize > 4096) {
    throw new Error(
      "Push payload is too large. Maximum Web Push payload is approximately 3993 bytes."
    );
  }

  /*
   * rs must be greater than the sum of:
   *
   * plaintext
   * + padding delimiter
   * + padding
   * + authentication tag
   *
   * 4096 is a safe record size.
   */

  const recordSize = 4096;

  const result =
    new Uint8Array(totalSize);

  /*
   * salt
   */

  result.set(
    salt,
    0
  );

  /*
   * rs
   */

  const dataView =
    new DataView(
      result.buffer
    );

  dataView.setUint32(
    16,
    recordSize,
    false
  );

  /*
   * keyid length
   *
   * The server's ephemeral public key
   * is exactly 65 bytes.
   */

  result[20] = 65;

  /*
   * keyid
   */

  result.set(
    serverPublicKey,
    21
  );

  /*
   * ciphertext
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
    /*
     * Create VAPID JWT.
     */

    const jwt =
      await createVapidJwt(
        vapidKeys,
        subscription.endpoint
      );

    /*
     * Encrypt notification payload.
     */

    const encrypted =
      await encryptPayload(
        JSON.stringify(payload),
        subscription
      );

    /*
     * Send to browser push service.
     */

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

    /*
     * 201 Created is a successful push
     * response and is commonly returned
     * by push services.
     */

    if (
      response.ok ||
      response.status === 201
    ) {
      return true;
    }

    console.error(
      `Push delivery failed: ${response.status} ${response.statusText}`
    );

    /*
     * 404 and 410 generally mean the
     * subscription is no longer valid.
     *
     * Returning false allows the caller
     * to remove it from the database.
     */

    return false;
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
