import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AnchorEscrow } from "../target/types/anchor_escrow";
import { 
  TOKEN_PROGRAM_ID, 
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  getAccount,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";
import { assert, expect } from "chai";
import { 
  PublicKey, 
  Keypair, 
  SystemProgram, 
  LAMPORTS_PER_SOL, 
  Transaction, 
  sendAndConfirmTransaction
} from "@solana/web3.js";

describe("anchor-escrow", () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.AnchorEscrow as Program<AnchorEscrow>;

  // Test accounts
  let maker: Keypair;
  let taker: Keypair;
  let tokenMintA: PublicKey;
  let tokenMintB: PublicKey;
  let makerTokenAccountA: PublicKey;
  let makerTokenAccountB: PublicKey;
  let takerTokenAccountA: PublicKey;
  let takerTokenAccountB: PublicKey;

  // Test constants
  const OFFER_SEED = "offer";
  const OFFER_ID = new anchor.BN(1);
  const TOKEN_A_OFFERED_AMOUNT = new anchor.BN(1000);
  const TOKEN_B_WANTED_AMOUNT = new anchor.BN(2000);
  const INITIAL_MINT_AMOUNT = new anchor.BN(10000);

  before(async () => {
    // Create test keypairs
    maker = Keypair.generate();
    taker = Keypair.generate();

    // Airdrop SOL to test accounts
    await airdropSol(maker.publicKey, 2);
    await airdropSol(taker.publicKey, 2);

    // Create token mints
    tokenMintA = await createMint(
      provider.connection,
      maker,
      maker.publicKey,
      null,
      6 // decimals
    );

    tokenMintB = await createMint(
      provider.connection,
      maker,
      maker.publicKey,
      null,
      6 // decimals
    );

    // Create associated token accounts
    makerTokenAccountA = await createAssociatedTokenAccount(
      provider.connection,
      maker,
      tokenMintA,
      maker.publicKey
    );

    makerTokenAccountB = await createAssociatedTokenAccount(
      provider.connection,
      maker,
      tokenMintB,
      maker.publicKey
    );

    takerTokenAccountA = await createAssociatedTokenAccount(
      provider.connection,
      taker,
      tokenMintA,
      taker.publicKey
    );

    takerTokenAccountB = await createAssociatedTokenAccount(
      provider.connection,
      taker,
      tokenMintB,
      taker.publicKey
    );

    // Mint tokens to accounts
    await mintTo(
      provider.connection,
      maker,
      tokenMintA,
      makerTokenAccountA,
      maker.publicKey,
      INITIAL_MINT_AMOUNT.toNumber()
    );

    await mintTo(
      provider.connection,
      maker,
      tokenMintB,
      takerTokenAccountB,
      maker.publicKey,
      INITIAL_MINT_AMOUNT.toNumber()
    );
  });

  // Helper function to airdrop SOL
  async function airdropSol(publicKey: PublicKey, amount: number) {
    const signature = await provider.connection.requestAirdrop(
      publicKey,
      amount * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(signature);
  }

  // Helper function to get offer PDA
  function getOfferPDA(maker: PublicKey, id: anchor.BN): [PublicKey, number] {
    return anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from(OFFER_SEED),
        maker.toBuffer(),
        id.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );
  }

  // Helper function to get associated token account
  function getAssociatedTokenAccount(mint: PublicKey, owner: PublicKey): PublicKey {
    return anchor.utils.token.associatedAddress({
      mint,
      owner,
    });
  }

  describe("make_offer", () => {
    it("Successfully creates an offer", async () => {
      const [offerPDA] = getOfferPDA(maker.publicKey, OFFER_ID);
      const vaultPDA = getAssociatedTokenAccount(tokenMintA, offerPDA);

      const tx = await program.methods
        .makeOffer(
          OFFER_ID,
          TOKEN_A_OFFERED_AMOUNT,
          TOKEN_B_WANTED_AMOUNT
        )
        .accounts({
          maker: maker.publicKey,
          tokenMintA,
          tokenMintB,
          makerTokenAccountA,
          offerDetails: offerPDA,
          vault: vaultPDA,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .signers([maker])
        .rpc();

      // Verify the offer was created
      const offerAccount = await program.account.offer.fetch(offerPDA);
      assert.equal(offerAccount.id.toString(), OFFER_ID.toString());
      assert.equal(offerAccount.maker.toString(), maker.publicKey.toString());
      assert.equal(offerAccount.tokenMintA.toString(), tokenMintA.toString());
      assert.equal(offerAccount.tokenMintB.toString(), tokenMintB.toString());
      assert.equal(
        offerAccount.tokenAOfferedAmount.toString(),
        TOKEN_A_OFFERED_AMOUNT.toString()
      );
      assert.equal(
        offerAccount.tokenBWantedAmount.toString(),
        TOKEN_B_WANTED_AMOUNT.toString()
      );

      // Verify tokens were transferred to vault
      const vaultAccount = await getAccount(provider.connection, vaultPDA);
      assert.equal(vaultAccount.amount.toString(), TOKEN_A_OFFERED_AMOUNT.toString());

      // Verify maker's token account was debited
      const makerAccountAfter = await getAccount(provider.connection, makerTokenAccountA);
      const expectedBalance = INITIAL_MINT_AMOUNT.sub(TOKEN_A_OFFERED_AMOUNT);
      assert.equal(makerAccountAfter.amount.toString(), expectedBalance.toString());
    });

    it("Fails with identical token mints", async () => {
      const [offerPDA] = getOfferPDA(maker.publicKey, new anchor.BN(2));
      const vaultPDA = getAssociatedTokenAccount(tokenMintA, offerPDA);

      try {
        await program.methods
          .makeOffer(
            new anchor.BN(2),
            TOKEN_A_OFFERED_AMOUNT,
            TOKEN_B_WANTED_AMOUNT
          )
          .accounts({
            maker: maker.publicKey,
            tokenMintA,
            tokenMintB: tokenMintA, // Same mint
            makerTokenAccountA,
            offerDetails: offerPDA,
            vault: vaultPDA,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          })
          .signers([maker])
          .rpc();
        
        assert.fail("Should have failed with identical token mints");
      } catch (err) {
        assert.include(err.message, "InvalidTokenMint");
      }
    });

    it("Fails with insufficient balance", async () => {
      const [offerPDA] = getOfferPDA(maker.publicKey, new anchor.BN(3));
      const vaultPDA = getAssociatedTokenAccount(tokenMintA, offerPDA);

      try {
        await program.methods
          .makeOffer(
            new anchor.BN(3),
            new anchor.BN(100000), // More than available
            TOKEN_B_WANTED_AMOUNT
          )
          .accounts({
            maker: maker.publicKey,
            tokenMintA,
            tokenMintB,
            makerTokenAccountA,
            offerDetails: offerPDA,
            vault: vaultPDA,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          })
          .signers([maker])
          .rpc();
        
        assert.fail("Should have failed with insufficient balance");
      } catch (err) {
        assert.include(err.message, "InsufficientMakerBalance");
      }
    });

    it("Fails with zero amount", async () => {
      const [offerPDA] = getOfferPDA(maker.publicKey, new anchor.BN(4));
      const vaultPDA = getAssociatedTokenAccount(tokenMintA, offerPDA);

      try {
        await program.methods
          .makeOffer(
            new anchor.BN(4),
            new anchor.BN(0), // Zero amount
            TOKEN_B_WANTED_AMOUNT
          )
          .accounts({
            maker: maker.publicKey,
            tokenMintA,
            tokenMintB,
            makerTokenAccountA,
            offerDetails: offerPDA,
            vault: vaultPDA,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          })
          .signers([maker])
          .rpc();
        
        assert.fail("Should have failed with zero amount");
      } catch (err) {
        assert.include(err.message, "InvalidAmount");
      }
    });
  });

  describe("get_offer", () => {
    it("Successfully retrieves offer details", async () => {
      const [offerPDA] = getOfferPDA(maker.publicKey, OFFER_ID);

      const tx = await program.methods
        .getOffer(OFFER_ID)
        .accounts({
          maker: maker.publicKey,
          offerDetails: offerPDA,
        })
        .rpc();

      // The get_offer instruction logs the offer details
      // We can verify it completed successfully
      assert.isString(tx);
    });
  });

  describe("take_offer", () => {
    it("Successfully takes an existing offer", async () => {
      const [offerPDA] = getOfferPDA(maker.publicKey, OFFER_ID);
      const vaultPDA = getAssociatedTokenAccount(tokenMintA, offerPDA);

      // Get initial balances
      const takerTokenBBefore = await getAccount(provider.connection, takerTokenAccountB);
      const makerTokenBBefore = await getAccount(provider.connection, makerTokenAccountB);

      const tx = await program.methods
        .takeOffer(OFFER_ID)
        .accounts({
          taker: taker.publicKey,
          maker: maker.publicKey,
          tokenMintA,
          tokenMintB,
          takerTokenAccountA,
          takerTokenAccountB,
          makerTokenAccountB,
          offerDetails: offerPDA,
          vault: vaultPDA,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([taker])
        .rpc();

      // Verify taker received token A
      const takerTokenAAfter = await getAccount(provider.connection, takerTokenAccountA);
      assert.equal(takerTokenAAfter.amount.toString(), TOKEN_A_OFFERED_AMOUNT.toString());

      // Verify taker's token B was debited
      const takerTokenBAfter = await getAccount(provider.connection, takerTokenAccountB);
      const expectedTakerBalance = new anchor.BN(takerTokenBBefore.amount.toString())
        .sub(TOKEN_B_WANTED_AMOUNT);
      assert.equal(takerTokenBAfter.amount.toString(), expectedTakerBalance.toString());

      // Verify maker received token B
      const makerTokenBAfter = await getAccount(provider.connection, makerTokenAccountB);
      const expectedMakerBalance = new anchor.BN(makerTokenBBefore.amount.toString())
        .add(TOKEN_B_WANTED_AMOUNT);
      assert.equal(makerTokenBAfter.amount.toString(), expectedMakerBalance.toString());

      // Verify offer account was closed
      try {
        await program.account.offer.fetch(offerPDA);
        assert.fail("Offer account should have been closed");
      } catch (err) {
        assert.include(err.message, "Account does not exist");
      }
    });

    it("Fails when taker has insufficient balance", async () => {
      // Create a new offer first
      const newOfferId = new anchor.BN(10);
      const [offerPDA] = getOfferPDA(maker.publicKey, newOfferId);
      const vaultPDA = getAssociatedTokenAccount(tokenMintA, offerPDA);

      await program.methods
        .makeOffer(
          newOfferId,
          TOKEN_A_OFFERED_AMOUNT,
          new anchor.BN(100000) // More than taker has
        )
        .accounts({
          maker: maker.publicKey,
          tokenMintA,
          tokenMintB,
          makerTokenAccountA,
          offerDetails: offerPDA,
          vault: vaultPDA,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .signers([maker])
        .rpc();

      // Try to take the offer
      try {
        await program.methods
          .takeOffer(newOfferId)
          .accounts({
            taker: taker.publicKey,
            maker: maker.publicKey,
            tokenMintA,
            tokenMintB,
            takerTokenAccountA,
            takerTokenAccountB,
            makerTokenAccountB,
            offerDetails: offerPDA,
            vault: vaultPDA,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([taker])
          .rpc();
        
        assert.fail("Should have failed with insufficient taker balance");
      } catch (err) {
        assert.include(err.message, "InsufficientTakerBalance");
      }
    });
  });

  describe("refund_offer", () => {
    let refundOfferId: anchor.BN;
    let refundOfferPDA: PublicKey;
    let refundVaultPDA: PublicKey;

    before(async () => {
      // Create a new offer for refund testing
      refundOfferId = new anchor.BN(20);
      [refundOfferPDA] = getOfferPDA(maker.publicKey, refundOfferId);
      refundVaultPDA = getAssociatedTokenAccount(tokenMintA, refundOfferPDA);

      await program.methods
        .makeOffer(
          refundOfferId,
          TOKEN_A_OFFERED_AMOUNT,
          TOKEN_B_WANTED_AMOUNT
        )
        .accounts({
          maker: maker.publicKey,
          tokenMintA,
          tokenMintB,
          makerTokenAccountA,
          offerDetails: refundOfferPDA,
          vault: refundVaultPDA,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .signers([maker])
        .rpc();
    });

    it("Successfully refunds an offer", async () => {
      // Get initial balance
      const makerTokenABefore = await getAccount(provider.connection, makerTokenAccountA);

      const tx = await program.methods
        .refundOffer(refundOfferId)
        .accounts({
          maker: maker.publicKey,
          makerTokenAccountA,
          tokenMintA,
          offerDetails: refundOfferPDA,
          vault: refundVaultPDA,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([maker])
        .rpc();

      // Verify maker received tokens back
      const makerTokenAAfter = await getAccount(provider.connection, makerTokenAccountA);
      const expectedBalance = new anchor.BN(makerTokenABefore.amount.toString())
        .add(TOKEN_A_OFFERED_AMOUNT);
      assert.equal(makerTokenAAfter.amount.toString(), expectedBalance.toString());

      // Verify offer account was closed
      try {
        await program.account.offer.fetch(refundOfferPDA);
        assert.fail("Offer account should have been closed");
      } catch (err) {
        assert.include(err.message, "Account does not exist");
      }
    });
  });

  describe("cancel_offer", () => {
    let cancelOfferId: anchor.BN;
    let cancelOfferPDA: PublicKey;
    let cancelVaultPDA: PublicKey;

    before(async () => {
      // Create a new offer for cancel testing
      cancelOfferId = new anchor.BN(30);
      [cancelOfferPDA] = getOfferPDA(maker.publicKey, cancelOfferId);
      cancelVaultPDA = getAssociatedTokenAccount(tokenMintA, cancelOfferPDA);

      await program.methods
        .makeOffer(
          cancelOfferId,
          TOKEN_A_OFFERED_AMOUNT,
          TOKEN_B_WANTED_AMOUNT
        )
        .accounts({
          maker: maker.publicKey,
          tokenMintA,
          tokenMintB,
          makerTokenAccountA,
          offerDetails: cancelOfferPDA,
          vault: cancelVaultPDA,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .signers([maker])
        .rpc();
    });

    it("Successfully cancels an offer", async () => {
      // Get initial balance
      const makerTokenABefore = await getAccount(provider.connection, makerTokenAccountA);

      const tx = await program.methods
        .cancelOffer(cancelOfferId)
        .accounts({
          maker: maker.publicKey,
          makerTokenAccountA,
          tokenMintA,
          offerDetails: cancelOfferPDA,
          vault: cancelVaultPDA,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([maker])
        .rpc();

      // Verify maker received tokens back
      const makerTokenAAfter = await getAccount(provider.connection, makerTokenAccountA);
      const expectedBalance = new anchor.BN(makerTokenABefore.amount.toString())
        .add(TOKEN_A_OFFERED_AMOUNT);
      assert.equal(makerTokenAAfter.amount.toString(), expectedBalance.toString());

      // Verify offer account was closed
      try {
        await program.account.offer.fetch(cancelOfferPDA);
        assert.fail("Offer account should have been closed");
      } catch (err) {
        assert.include(err.message, "Account does not exist");
      }
    });
  });

  describe("Edge cases and additional validation", () => {
    it("Cannot take a non-existent offer", async () => {
      const nonExistentId = new anchor.BN(999);
      const [offerPDA] = getOfferPDA(maker.publicKey, nonExistentId);
      const vaultPDA = getAssociatedTokenAccount(tokenMintA, offerPDA);

      try {
        await program.methods
          .takeOffer(nonExistentId)
          .accounts({
            taker: taker.publicKey,
            maker: maker.publicKey,
            tokenMintA,
            tokenMintB,
            takerTokenAccountA,
            takerTokenAccountB,
            makerTokenAccountB,
            offerDetails: offerPDA,
            vault: vaultPDA,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([taker])
          .rpc();
        
        assert.fail("Should have failed with non-existent offer");
      } catch (err) {
        assert.include(err.message, "AnchorError caused by account: offer_");
      }
    });

    it("Can create multiple offers with different IDs", async () => {
      const offerId1 = new anchor.BN(100);
      const offerId2 = new anchor.BN(101);
      
      const [offerPDA1] = getOfferPDA(maker.publicKey, offerId1);
      const [offerPDA2] = getOfferPDA(maker.publicKey, offerId2);
      
      const vaultPDA1 = getAssociatedTokenAccount(tokenMintA, offerPDA1);
      const vaultPDA2 = getAssociatedTokenAccount(tokenMintA, offerPDA2);

      // Create first offer
      await program.methods
        .makeOffer(
          offerId1,
          new anchor.BN(100),
          new anchor.BN(200)
        )
        .accounts({
          maker: maker.publicKey,
          tokenMintA,
          tokenMintB,
          makerTokenAccountA,
          offerDetails: offerPDA1,
          vault: vaultPDA1,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .signers([maker])
        .rpc();

      // Create second offer
      await program.methods
        .makeOffer(
          offerId2,
          new anchor.BN(150),
          new anchor.BN(300)
        )
        .accounts({
          maker: maker.publicKey,
          tokenMintA,
          tokenMintB,
          makerTokenAccountA,
          offerDetails: offerPDA2,
          vault: vaultPDA2,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .signers([maker])
        .rpc();

      // Verify both offers exist
      const offer1 = await program.account.offer.fetch(offerPDA1);
      const offer2 = await program.account.offer.fetch(offerPDA2);
      
      assert.equal(offer1.id.toString(), offerId1.toString());
      assert.equal(offer2.id.toString(), offerId2.toString());
      assert.equal(offer1.tokenAOfferedAmount.toString(), "100");
      assert.equal(offer2.tokenAOfferedAmount.toString(), "150");
    });

    it("Cannot make offer with same ID twice", async () => {
      const duplicateId = new anchor.BN(200);
      const [offerPDA] = getOfferPDA(maker.publicKey, duplicateId);
      const vaultPDA = getAssociatedTokenAccount(tokenMintA, offerPDA);

      // Create first offer
      await program.methods
        .makeOffer(
          duplicateId,
          new anchor.BN(100),
          new anchor.BN(200)
        )
        .accounts({
          maker: maker.publicKey,
          tokenMintA,
          tokenMintB,
          makerTokenAccountA,
          offerDetails: offerPDA,
          vault: vaultPDA,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .signers([maker])
        .rpc();

      // Try to create second offer with same ID
      try {
        await program.methods
          .makeOffer(
            duplicateId,
            new anchor.BN(150),
            new anchor.BN(300)
          )
          .accounts({
            maker: maker.publicKey,
            tokenMintA,
            tokenMintB,
            makerTokenAccountA,
            offerDetails: offerPDA,
            vault: vaultPDA,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          })
          .signers([maker])
          .rpc();
        
        assert.fail("Should have failed with duplicate offer ID");
      } catch (err) {
        // Should fail because the account already exists
        assert.isTrue(err.message.includes("already in use"));
      }
    });
  });
});
