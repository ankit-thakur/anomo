declare module 'react-native-get-random-values' {
  export function getRandomValues<T extends ArrayBufferView | null>(array: T): T;
}

declare global {
  interface Crypto {
    getRandomValues(array: Uint8Array): Uint8Array;
    subtle?: {
      digest(algorithm: string, data: Uint8Array): Promise<ArrayBuffer>;
    };
  }

  interface BigInteger {
    toString(radix?: number): string;
    modPow(exponent: BigInteger, modulus: BigInteger): BigInteger;
  }

  var BigInteger: {
    new (value: string | number, radix?: number): BigInteger;
  };

  var crypto: Crypto;
  var btoa: (data: string) => string;
  var atob: (data: string) => string;
}

export {};