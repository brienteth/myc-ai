/**
 * MYCA Zero-Knowledge Proof Adapter
 * 
 * Strict Specification Invariant §1.5 & Phase 10 Roadmap:
 *  - ZK and TEE are NOT implemented in current production releases.
 *  - Never simulate or fake cryptographic ZK correctness.
 *  - Fallback is strictly Proof-of-Resonance (PoR).
 */

export async function verifyZKProof(proof) {
  return {
    status: 'NOT_IMPLEMENTED',
    roadmap: 'Phase 10',
    fallback: 'por'
  };
}

export async function verifyTEEAttestation(attestation) {
  return {
    status: 'NOT_IMPLEMENTED',
    roadmap: 'Phase 10',
    fallback: 'por'
  };
}
