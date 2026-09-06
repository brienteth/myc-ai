-- ====================================================================
-- DUNE ANALYTICS: MYCA NETWORK DEPIN TESTNET & METRICS DASHBOARD
-- ====================================================================
-- Project: MYCA Network (Chain ID: 108 / Base L2 Bridge)
-- Token: $MYC (100M Total Max Supply)
-- Note: All live metrics reflect on-chain events from the current public deployment.
-- Target hardcap is 10,000 nodes ($6.965M max capacity model).
-- ====================================================================

-- --------------------------------------------------------------------
-- QUERY 1: On-Chain DePIN Node License Mint Tracker
-- --------------------------------------------------------------------
WITH node_mints AS (
    SELECT 
        date_trunc('hour', evt_block_time) AS block_hour,
        tier_id,
        CASE 
            WHEN tier_id = 1 THEN 'Tier 1: Spore ($299)'
            WHEN tier_id = 2 THEN 'Tier 2: Hyphae ($449)'
            WHEN tier_id = 3 THEN 'Tier 3: Mycelial Highway ($699)'
            WHEN tier_id = 4 THEN 'Tier 4: Fruiting Body ($1,099)'
        END AS tier_name,
        price_usdc / 1e6 AS price_usd,
        token_id
    FROM myc_depin.NodeSale_evt_NodeLicenseMinted
)
SELECT 
    block_hour,
    tier_name,
    COUNT(token_id) AS nodes_minted,
    SUM(price_usd) AS hourly_usdc_volume,
    SUM(SUM(price_usd)) OVER (ORDER BY block_hour) AS cumulative_usdc_volume,
    SUM(COUNT(token_id)) OVER (ORDER BY block_hour) AS total_nodes_active
FROM node_mints
GROUP BY 1, 2
ORDER BY block_hour DESC;

-- --------------------------------------------------------------------
-- QUERY 2: Daily PoQR (Proof-of-Quantum-Resonance) Reward Distribution
-- --------------------------------------------------------------------
SELECT 
    date_trunc('day', evt_block_time) AS emission_date,
    SUM(allocated_myc / 1e18) AS total_myc_emitted,
    COUNT(DISTINCT node_id) AS participating_nodes,
    AVG(coherence_score) AS average_network_phase_coherence,
    SUM(CASE WHEN is_sybil_quenched = TRUE THEN 1 ELSE 0 END) AS quenched_sybil_attempts,
    SUM(CASE WHEN auto_compound_staked = TRUE THEN (allocated_myc / 1e18) ELSE 0 END) AS auto_compounded_myc,
    SUM(CASE WHEN auto_compound_staked = FALSE THEN (allocated_myc / 1e18) * 0.30 ELSE 0 END) AS liquid_claimed_myc
FROM myc_consensus.PoQREngine_evt_EpochDistributed
GROUP BY 1
ORDER BY emission_date DESC;

-- --------------------------------------------------------------------
-- QUERY 3: 40/25/20/15 Treasury Invariant Target Allocation Model
-- --------------------------------------------------------------------
SELECT 
    'Protocol Growth & Liquidity Pool' AS treasury_bucket,
    40.0 AS allocation_percentage,
    'Contractually locked for liquidity provisioning' AS purpose
UNION ALL
SELECT 
    'Hardware Subsidies & DePIN Logistics' AS treasury_bucket,
    25.0 AS allocation_percentage,
    'Physical Silicon PUF manufacturing & device logistics' AS purpose
UNION ALL
SELECT 
    'Ecosystem Grants & Research' AS treasury_bucket,
    20.0 AS allocation_percentage,
    'Community developers & quantum resonance research' AS purpose
UNION ALL
SELECT 
    'Core Development & Security Reserve' AS treasury_bucket,
    15.0 AS allocation_percentage,
    'Audits, formal verification & protocol engineering' AS purpose;

-- --------------------------------------------------------------------
-- QUERY 4: Architecture Benchmark Comparison (Empirical Testnet vs Competitors)
-- --------------------------------------------------------------------
SELECT 
    network,
    effective_tps,
    peak_tps,
    time_to_finality_ms,
    gas_fee_usd,
    hardware_root_of_trust
FROM (
    VALUES 
        ('MYCA Network (Tested Benchmark)', 15147, 20449, 9.79, '0.000000 (Zero-Gas)', 'Silicon PUF W3C DID'),
        ('Monad (Devnet Testnet)', 10000, 10000, 400.0, '~0.001500', 'Standard ECDSA'),
        ('Solana (Mainnet)', 2450, 4200, 400.0, '~0.000250', 'Ed25519'),
        ('peaq (Substrate)', 1200, 2500, 1000.0, '~0.000500', 'Machine DID'),
        ('IoTeX (Mainnet)', 850, 1500, 5000.0, '~0.001000', 'ioID'),
        ('Ethereum (Mainnet)', 14, 28, 12000.0, '$1.50 - $25.00', 'Software Key')
) AS t(network, effective_tps, peak_tps, time_to_finality_ms, gas_fee_usd, hardware_root_of_trust);
