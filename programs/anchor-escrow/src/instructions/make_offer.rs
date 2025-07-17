#![allow(unexpected_cfgs)]

use super::shared::transfer_tokens;
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
pub struct MakeOffer<'info> {
    #[account(mut)]
    pub maker: Signer<'info>,

    #[account(mint::token_program = token_program)]
    pub token_mint_a: InterfaceAccount<'info, Mint>,
    
    #[account(mint::token_program = token_program)]
    pub token_mint_b: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = token_mint_a,
        associated_token::authority = maker,
        associated_token::token_program = token_program,
    )]
    pub maker_token_account_a: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init,
        payer = maker,
        space = Offer::DISCRIMINATOR.len() + Offer::INIT_SPACE,
        seeds = [OFFER_SEED, maker.key().as_ref(), id.to_le_bytes().as_ref()],
        bump
    )]
    pub offer_details: Account<'info, Offer>,

    #[account(
        init,
        payer = maker,
        associated_token::mint = token_mint_a,
        associated_token::authority = offer_details,
        associated_token::token_program = token_program,
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn handler(
    ctx: Context<MakeOffer>,
    id: u64,
    token_a_offered_amount: u64,
    token_b_wanted_amount: u64,
) -> Result<()> {
    // Validate token mints are different
    require!(
        ctx.accounts.token_mint_a.key() != ctx.accounts.token_mint_b.key(),
        ErrorCode::InvalidTokenMint
    );

    // Validate amounts meet minimum requirements
    require!(
        token_a_offered_amount >= MIN_TRANSFER_AMOUNT,
        ErrorCode::InvalidAmount
    );
    
    require!(
        token_b_wanted_amount >= MIN_TRANSFER_AMOUNT,
        ErrorCode::InvalidAmount
    );

    // Check maker has sufficient balance
    require!(
        ctx.accounts.maker_token_account_a.amount >= token_a_offered_amount,
        ErrorCode::InsufficientMakerBalance
    );

    // Transfer tokens from maker to vault
    transfer_tokens(
        &ctx.accounts.maker_token_account_a,
        &ctx.accounts.vault,
        &token_a_offered_amount,
        &ctx.accounts.token_mint_a,
        &ctx.accounts.maker.to_account_info(),
        &ctx.accounts.token_program,
        None
    )?;

    // Save offer details
    ctx.accounts.offer_details.set_inner(Offer {
        id,
        maker: ctx.accounts.maker.key(),
        token_mint_a: ctx.accounts.token_mint_a.key(),
        token_mint_b: ctx.accounts.token_mint_b.key(),
        token_a_offered_amount,
        token_b_wanted_amount,
        bump: ctx.bumps.offer_details,
    });

    msg!("Offer created with ID: {}", id);
    Ok(())
}


