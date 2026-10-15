import BigNumber from 'bignumber.js';

export const bn = (v: any): BigNumber => new BigNumber(v || 0);

export const somaPrecisa = (...nums: (number | string | null | undefined)[]): number => {
  return nums.reduce((acc: BigNumber, n) => acc.plus(n || 0), new BigNumber(0)).toNumber();
};

export const subPrecisa = (a: number | string | null | undefined, b: number | string | null | undefined): number => {
  return new BigNumber(a || 0).minus(b || 0).toNumber();
};

export const multPrecisa = (a: number | string | null | undefined, b: number | string | null | undefined): number => {
  return new BigNumber(a || 0).times(b || 0).toNumber();
};

export const divPrecisa = (a: number | string | null | undefined, b: number | string | null | undefined): number => {
  if (!b || new BigNumber(b).isZero()) return 0;
  return new BigNumber(a || 0).dividedBy(b).toNumber();
};

export const arredondarFinanceiro = (v: number | string | null | undefined, c: number = 2): number => {
  return new BigNumber(v || 0).decimalPlaces(c, BigNumber.ROUND_HALF_UP).toNumber();
};

export const somaLista = <T>(lista: T[] | null | undefined, fn?: (item: T) => number | string | null | undefined): number => {
  if (!lista || !lista.length) return 0;
  const fnVal = typeof fn === 'function' ? fn : ((x: any) => x);
  return lista.reduce((acc: BigNumber, item: T) => acc.plus(fnVal(item) || 0), new BigNumber(0)).toNumber();
};
