use anchor_lang::prelude::*;

/// Represents an escrow offer in the system
/// 
/// This struct stores all the necessary information for a token swap offer,
/// including the tokens involved, amounts, and the maker's information.
#[account]
#[derive(InitSpace)]
pub struct Offer {
    /// Unique identifier for this offer
    pub id: u64,
    
    /// Public key of the user who created this offer
    pub maker: Pubkey,
    
    /// Token mint that the maker is offering (token A)
    pub token_mint_a: Pubkey,
    
    /// Token mint that the maker wants in return (token B)
    pub token_mint_b: Pubkey,
    
    /// Amount of token A that the maker is offering
    pub token_a_offered_amount: u64,
    
    /// Amount of token B that the maker wants in return
    pub token_b_wanted_amount: u64,
    
    /// Bump seed for the PDA derivation
    pub bump: u8,
}