import { BigInteger } from './utils/BigIntegerPolyfill';

declare global {
  var BigInteger: typeof BigInteger;
  var CryptoJS: any;
  interface Crypto {
    getRandomValues: (array: Uint8Array) => Uint8Array;
    subtle: {
      digest: (algorithm: string, data: Uint8Array) => Promise<ArrayBuffer>;
    };
  }
}

export {};