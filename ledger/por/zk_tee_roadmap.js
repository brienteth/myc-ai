/**
 * ZK and TEE Future Roadmap Interfaces
 * 
 * Strict Specification Invariant §1.5:
 * ZK and TEE are NOT implemented in the current production release.
 * Do NOT simulate or fake ZK/TEE correctness.
 * These interfaces exist solely to define future integration hooks and MUST return NOT_IMPLEMENTED.
 */

export const ZK_STATUS = "ROADMAP ONLY";
export const TEE_STATUS = "ROADMAP ONLY";

export class ZkProofVerifierRoadmap {
  constructor() {
    this.status = ZK_STATUS;
    this.isImplemented = false;
  }

  verifyZkProof(proofData) {
    return {
      success: false,
      status: "NOT_IMPLEMENTED",
      backend: "ZK-SNARK / STARK",
      roadmapPhase: "Phase 10 (Advanced Verification)",
      message: "Zero-Knowledge verification is explicitly reserved for future roadmap. Use Proof-of-Resonance (PoR) for current production verification."
    };
  }
}

export class TeeAttestationVerifierRoadmap {
  constructor() {
    this.status = TEE_STATUS;
    this.isImplemented = false;
  }

  verifyAttestation(attestationReport) {
    return {
      success: false,
      status: "NOT_IMPLEMENTED",
      backend: "Intel SGX / ARM TrustZone / AWS Nitro",
      roadmapPhase: "Phase 10 (Advanced Verification)",
      message: "TEE Hardware Attestation is explicitly reserved for future roadmap. Use Proof-of-Resonance (PoR) for current production verification."
    };
  }
}
