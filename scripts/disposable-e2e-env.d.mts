export type DisposableE2EEnvironment = {
  appUrl: string;
  appHost: string;
  appPort: number;
  supabaseWorkdir: string;
  supabaseUrl: string;
  supabaseHost: "127.0.0.1";
  supabasePort: number;
  projectId: string;
  environment: Record<string, string>;
};

export function validateDisposableE2EEnvironment(
  env: Record<string, string | undefined>,
  options?: { configText?: string },
): DisposableE2EEnvironment;
