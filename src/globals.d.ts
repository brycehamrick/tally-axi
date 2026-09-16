declare const process: {
  argv: string[];
  env: Record<string, string | undefined>;
  stdin: { setEncoding(value: string): void; on(event: string, listener: (value?: string) => void): void };
  stdout: { write(value: string): void };
  exitCode?: number;
};

declare module "node:fs/promises" {
  export function readFile(path: unknown, encoding: string): Promise<string>;
}

declare module "node:url" {
  export function fileURLToPath(url: URL | string): string;
}
