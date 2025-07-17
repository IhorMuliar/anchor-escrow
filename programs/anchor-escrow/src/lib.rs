#![allow(unexpected_cfgs)]
#![allow(deprecated)]

pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("86VPk6tP21iYFLVTfJRg8NHjmuK6svgGcaijmk73YzrH");

#[program]
pub mod anchor_escrow {
    use super::*;

    /// Creates a new escrow offer
    pub fn make_offer(
        ctx: Context<MakeOffer>, 
        id: u64, 
        token_a_offered_amount: u64, 
        token_b_wanted_amount: u64
    ) -> Result<()> {
        make_offer::handler(
            ctx,
            id, 
            token_a_offered_amount,
            token_b_wanted_amount,
        )
    }

    /// Takes an existing escrow offer
    pub fn take_offer(
        ctx: Context<TakeOffer>, 
        id: u64,
    ) -> Result<()> {
        take_offer::handler(
            ctx,
            id,
        )
    }

    /// Refunds an escrow offer back to the maker
    pub fn refund_offer(
        ctx: Context<RefundOffer>, 
        id: u64, 
    ) -> Result<()> {
        refund_offer::handler(
            ctx,
            id,
        )
    }

    /// Cancels an escrow offer (similar to refund but with additional checks)
    pub fn cancel_offer(
        ctx: Context<CancelOffer>, 
        id: u64, 
    ) -> Result<()> {
        cancel_offer::handler(
            ctx,
            id,
        )
    }

    /// Gets details of an existing offer (read-only)
    pub fn get_offer(
        ctx: Context<GetOffer>, 
        id: u64, 
    ) -> Result<()> {
        get_offer::handler(
            ctx,
            id,
        )
    }
}
