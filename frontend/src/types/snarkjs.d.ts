// Type declarations for snarkjs
declare module 'snarkjs' {
  export namespace groth16 {
    function fullProve(
      input: Record<string, unknown>,
      wasmFile: Uint8Array | string,
      zkeyFile: Uint8Array | string
    ): Promise<{
      proof: {
        pi_a: [string, string, string];
        pi_b: [[string, string], [string, string], [string, string]];
        pi_c: [string, string, string];
        protocol: string;
        curve: string;
      };
      publicSignals: string[];
    }>;

    function verify(
      verificationKey: unknown,
      publicSignals: string[],
      proof: unknown
    ): Promise<boolean>;

    function exportSolidityCallData(
      proof: unknown,
      publicSignals: string[]
    ): Promise<string>;
  }

  export namespace plonk {
    function fullProve(
      input: Record<string, unknown>,
      wasmFile: Uint8Array | string,
      zkeyFile: Uint8Array | string
    ): Promise<{
      proof: unknown;
      publicSignals: string[];
    }>;

    function verify(
      verificationKey: unknown,
      publicSignals: string[],
      proof: unknown
    ): Promise<boolean>;
  }

  export namespace zKey {
    function exportVerificationKey(
      zkeyFile: string | Uint8Array
    ): Promise<unknown>;

    function exportSolidityVerifier(
      zkeyFile: string | Uint8Array,
      templates?: unknown
    ): Promise<string>;
  }

  export namespace wtns {
    function calculate(
      input: Record<string, unknown>,
      wasmFile: Uint8Array | string,
      wtnsFile: string
    ): Promise<void>;
  }
}
