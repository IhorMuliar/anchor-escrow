# Anchor Escrow

A decentralized escrow system built on Solana using the Anchor framework. This program enables secure token swaps between two parties through an automated escrow mechanism.

## Features

- **Make Offer**: Create an escrow offer by depositing tokens and specifying desired tokens in return
- **Take Offer**: Accept an existing offer by providing the requested tokens
- **Refund Offer**: Retrieve deposited tokens before the offer is taken
- **Cancel Offer**: Cancel an active offer and recover deposited tokens
- **Get Offer**: Query offer details and status

## Prerequisites

- Node.js v16 or higher
- Rust v1.70 or higher
- Solana CLI v1.16 or higher
- Anchor CLI v0.28 or higher

## Installation

1. Clone the repository
```bash
git clone <repository-url>
cd anchor-escrow
```

2. Install dependencies
```bash
npm install
```

3. Build the program
```bash
anchor build
```

## Usage

### Deploy to Localnet

1. Start local validator
```bash
solana-test-validator
```

2. Deploy the program
```bash
anchor deploy
```

### Program Instructions

#### Make Offer
Creates a new escrow offer where the maker deposits tokens and specifies what they want in return.

```typescript
await program.methods
  .makeOffer(offerId, tokenAAmount, tokenBAmount)
  .accounts({
    maker: makerPublicKey,
    tokenMintA: tokenMintA,
    tokenMintB: tokenMintB,
    // ... other accounts
  })
  .rpc();
```

#### Take Offer
Allows a taker to fulfill an existing offer by providing the requested tokens.

```typescript
await program.methods
  .takeOffer(offerId)
  .accounts({
    taker: takerPublicKey,
    maker: makerPublicKey,
    // ... other accounts
  })
  .rpc();
```

#### Refund/Cancel Offer
Allows the maker to retrieve their deposited tokens.

```typescript
await program.methods
  .refundOffer(offerId)
  .accounts({
    maker: makerPublicKey,
    // ... other accounts
  })
  .rpc();
```

## Testing

Run the comprehensive test suite:

```bash
anchor test
```

The tests cover:
- Successful offer creation and execution
- Input validation and error handling
- Token balance verification
- Account state management
- Edge cases and security scenarios

## Program Structure

```
programs/anchor-escrow/
├── src/
│   ├── lib.rs              # Main program entry point
│   ├── instructions/       # Instruction handlers
│   │   ├── make_offer.rs   # Create escrow offer
│   │   ├── take_offer.rs   # Accept offer
│   │   ├── refund_offer.rs # Refund tokens
│   │   ├── cancel_offer.rs # Cancel offer
│   │   └── get_offer.rs    # Query offer details
│   ├── state/             # Account structures
│   │   └── offer.rs       # Offer state definition
│   ├── error.rs           # Custom error types
│   └── constants.rs       # Program constants
```

## Security Features

- Input validation for all parameters
- Balance verification before token transfers
- Proper account ownership checks
- Protection against duplicate offers
- Secure token vault management using PDAs

## License

This project is licensed under the MIT License. 