/// Seed prefix for offer PDA derivation
pub const OFFER_SEED: &[u8] = b"offer";

/// Maximum number of offers per maker (to prevent spam)
pub const MAX_OFFERS_PER_MAKER: u64 = 100;

/// Minimum amount for any token transfer (to prevent dust attacks)
pub const MIN_TRANSFER_AMOUNT: u64 = 1; 