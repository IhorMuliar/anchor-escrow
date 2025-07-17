#![allow(unexpected_cfgs)]
#![allow(unused_imports)]

use super::shared::{transfer_tokens, close_token_account};
use crate::state::Offer;
use crate::error::ErrorCode;
use crate::constants::*;
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

#[derive(Accounts)]
#[instruction(id: u64)]
pub struct TakeOffer<'info> {
    #[account(mut)]
    pub taker: Signer<'info>,
    
    /// CHECK: Validated through has_one constraint and PDA derivation
    #[account(mut)]
    pub maker: AccountInfo<'info>,

    #[account(mut)]
    pub token_mint_a: InterfaceAccount<'info, Mint>,

    #[account(mut)]
    pub token_mint_b: InterfaceAccount<'info, Mint>,

    #[account(
        init_if_needed,
        payer = taker,
        associated_token::mint = token_mint_a,
        associated_token::authority = taker,
        associated_token::token_program = token_program,
    )]
    pub taker_token_account_a: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = token_mint_b,
        associated_token::authority = taker,
        associated_token::token_program = token_program,
    )]
    pub taker_token_account_b: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = taker,
        associated_token::mint = token_mint_b,
        associated_token::authority = maker,
        associated_token::token_program = token_program,
    )]
    pub maker_token_account_b: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        close = maker,
        has_one = maker,
        has_one = token_mint_a,
        has_one = token_mint_b,
        seeds = [OFFER_SEED, maker.key().as_ref(), id.to_le_bytes().as_ref()],
        bump
    )]
    pub offer_details: Account<'info, Offer>,

    #[account(
        mut,
        associated_token::mint = token_mint_a,
        associated_token::authority = offer_details,
        associated_token::token_program = token_program,
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<TakeOffer>,
    id: u64,
) -> Result<()> {
    // Validate vault is not empty
    require!(
        ctx.accounts.vault.amount > 0,
        ErrorCode::EmptyVault
    );

    // Validate taker has sufficient balance
    require!(
        ctx.accounts.taker_token_account_b.amount >= ctx.accounts.offer_details.token_b_wanted_amount,
        ErrorCode::InsufficientTakerBalance
    );

    // Generate PDA seeds for signing
    let id_bytes = id.to_le_bytes();
    let maker_key = ctx.accounts.maker.key();
    let offer_account_seeds = &[
        OFFER_SEED,
        maker_key.as_ref(),
        &id_bytes,
        &[ctx.accounts.offer_details.bump]
    ];
    let signers_seeds = Some(&offer_account_seeds[..]);

    // Transfer tokens from taker to maker (token B)
    transfer_tokens(
        &ctx.accounts.taker_token_account_b,
        &ctx.accounts.maker_token_account_b,
        &ctx.accounts.offer_details.token_b_wanted_amount,
        &ctx.accounts.token_mint_b,
        &ctx.accounts.taker.to_account_info(),
        &ctx.accounts.token_program,
        None
    )?;

    // Transfer tokens from vault to taker (token A)
    transfer_tokens(
        &ctx.accounts.vault,
        &ctx.accounts.taker_token_account_a,
        &ctx.accounts.vault.amount,
        &ctx.accounts.token_mint_a,
        &ctx.accounts.offer_details.to_account_info(),
        &ctx.accounts.token_program,
        signers_seeds,
    )?;

    // Close the vault account
    close_token_account(
        &ctx.accounts.vault,
        &ctx.accounts.maker.to_account_info(),
        &ctx.accounts.offer_details.to_account_info(),
        &ctx.accounts.token_program,
        signers_seeds,
    )?;

    msg!("Offer {} successfully taken", id);
    Ok(())
}