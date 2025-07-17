use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("The taker does not have enough balance to complete the trade")]
    InsufficientTakerBalance,
    
    #[msg("The maker does not have enough balance to create the offer")]
    InsufficientMakerBalance,
    
    #[msg("Cannot create an offer with identical token mints")]
    InvalidTokenMint,
    
    #[msg("Amount must be greater than zero")]
    InvalidAmount,
    
    #[msg("The offer has already been taken or cancelled")]
    OfferAlreadyTaken,
    
    #[msg("Only the maker can refund this offer")]
    UnauthorizedRefund,
    
    #[msg("The vault account is empty")]
    EmptyVault,
    
    #[msg("Token decimals do not match expected values")]
    InvalidTokenDecimals,
}