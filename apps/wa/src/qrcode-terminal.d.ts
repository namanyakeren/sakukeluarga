declare module "qrcode-terminal" {
  interface Options {
    small?: boolean;
  }
  export function generate(
    text: string,
    options?: Options,
    callback?: (qr: string) => void,
  ): void;
  const qrcode: { generate: typeof generate };
  export default qrcode;
}
