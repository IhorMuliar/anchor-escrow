use crate::state::Offer;
use crate::constants::*;
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(id: u64)]
pub struct GetOffer<'info> {
    /// CHECK: Validated through PDA derivation
    pub maker: AccountInfo<'info>,

    #[account(
        seeds = [OFFER_SEED, maker.key().as_ref(), id.to_le_bytes().as_ref()],
        bump
    )]
    pub offer_details: Account<'info, Offer>,
}

pub fn handler(
    ctx: Context<GetOffer>,
    _id: u64,
) -> Result<()> {
    let offer = &ctx.accounts.offer_details;
    
    msg!("Offer ID: {}", offer.id);
    msg!("Maker: {}", offer.maker);
    msg!("Token Mint A: {}", offer.token_mint_a);
    msg!("Token Mint B: {}", offer.token_mint_b);
    msg!("Token A Offered Amount: {}", offer.token_a_offered_amount);
    msg!("Token B Wanted Amount: {}", offer.token_b_wanted_amount);
    
    Ok(())
} 