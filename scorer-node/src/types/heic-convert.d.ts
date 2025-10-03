declare module "heic-convert" {
    const convert: (args: { buffer: Buffer; format: "JPEG" | "PNG"; quality?: number }) => Promise<Uint8Array | ArrayBuffer | Buffer>;
    export default convert;
  }
  