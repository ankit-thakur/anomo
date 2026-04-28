declare module 'react-native-quick-crypto' {
  interface Crypto {
    getRandomValues<T extends ArrayBufferView | null>(array: T): T;
    subtle: {
      digest(algorithm: string, data: Uint8Array): Promise<ArrayBuffer>;
    };
  }
  const crypto: Crypto;
  export default crypto;
}

declare module 'react-native-quick-base64' {
  const base64: {
    btoa(str: string): string;
    atob(str: string): string;
  };
  export default base64;
}