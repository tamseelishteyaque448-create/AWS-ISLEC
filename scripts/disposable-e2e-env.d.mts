export type DisposableE2EEnvironment = {
  appUrl: string;
  appHost: string;
  appPort: number;
  supabaseUrl: string;
  supabaseHost: "127.0.0.1";
  supabasePort: number;
  environment: Record<string, string>;
};

export function validateDisposableE2EEnvironment(
  env: Record<string, string | undefined>,
): DisposableE2EEnvironment;
