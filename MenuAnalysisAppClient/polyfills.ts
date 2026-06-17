import 'react-native-get-random-values';
import { getRandomValues } from 'react-native-get-random-values';
import { Buffer } from 'buffer';
import { decode, encode } from 'base-64';
import { Sha256 } from '@aws-crypto/sha256-js';

// Ensure crypto.getRandomValues is available
if (typeof global.crypto !== 'object') {
  global.crypto = {} as any;
}

if (typeof global.crypto.getRandomValues !== 'function') {
  global.crypto.getRandomValues = getRandomValues;
}

// Base64 polyfills
global.btoa = global.btoa || encode;
global.atob = global.atob || decode;

// Buffer polyfill
global.Buffer = global.Buffer || Buffer;

// Create a more complete crypto.subtle implementation
if (!('subtle' in global.crypto)) {
  const subtleImpl = {
    digest: async (algorithm: string, data: Uint8Array) => {
      if (algorithm.toUpperCase() === 'SHA-256') {
        const hash = new Sha256();
        hash.update(data);
        return hash.digestSync();
      }
      throw new Error(`Unsupported algorithm: ${algorithm}`);
    }
  } as any;
  Object.defineProperty(global.crypto, 'subtle', {
    value: subtleImpl,
    configurable: true,
    writable: true,
  });
}

// Use jsbn BigInteger (compatible with amazon-cognito-identity-js)
/* eslint-disable @typescript-eslint/no-var-requires */
const JSBN = require('jsbn');
const BigInteger = JSBN.BigInteger;
(global as any).BigInteger = BigInteger;