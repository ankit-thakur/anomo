// BigInteger polyfill for AWS Cognito's SRP implementation
export class BigInteger {
  constructor(value: string | number, radix?: number) {
    if (typeof value === 'number') {
      this.value = BigInt(value);
    } else {
      this.value = BigInt(`0${radix === 16 ? 'x' : ''}${value}`);
    }
  }

  private value: bigint;

  toString(radix = 10): string {
    if (radix === 16) {
      return this.value.toString(16);
    }
    return this.value.toString();
  }

  modPow(exponent: BigInteger, modulus: BigInteger): BigInteger {
    const result = new BigInteger('0');
    result.value = this.value ** exponent.value % modulus.value;
    return result;
  }
}