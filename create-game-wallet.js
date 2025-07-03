const { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID, getOrCreateAssociatedTokenAccount } = require('@solana/spl-token');
require('dotenv').config();

// Initialize connection
const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');

// Load config
const config = require('./config.json');
const MINT_ADDRESS = new PublicKey(config.mint_address);

async function createGameWallet() {
    try {
        // 1. Create a new keypair for the game wallet
        const gameWallet = Keypair.generate();
        console.log('Game wallet created');
        console.log('Public key:', gameWallet.publicKey.toString());
        
        // 2. Save the private key to a file (for secure storage)
        const fs = require('fs');
        fs.writeFileSync('game-wallet.json', JSON.stringify({
            publicKey: gameWallet.publicKey.toString(),
            privateKey: Array.from(gameWallet.secretKey)
        }));
        console.log('Game wallet saved to game-wallet.json');

        // 3. Load the funding wallet keypair
        const fs = require('fs');
        const fundingKeypair = Keypair.fromSecretKey(
            Uint8Array.from(JSON.parse(fs.readFileSync(process.env.FUNDING_WALLET_KEY, 'utf8')))
        );

        // 4. Fund the wallet with some SOL (0.01 SOL should be enough)
        const tx = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: fundingKeypair.publicKey,
                toPubkey: gameWallet.publicKey,
                lamports: LAMPORTS_PER_SOL * 0.01 // 0.01 SOL
            })
        );

        // 5. Sign and send the transaction
        const signature = await connection.sendTransaction(tx, [fundingKeypair]);
        await connection.confirmTransaction(signature);
        console.log('Wallet funded with 0.01 SOL');

        // 4. Create a token account for the game wallet
        const gameTokenAccount = await getOrCreateAssociatedTokenAccount(
            connection,
            gameWallet, // We'll use the game wallet to pay for creation
            MINT_ADDRESS,
            gameWallet.publicKey
        );
        console.log('Token account created:', gameTokenAccount.address.toString());

        // 5. Print instructions for users
        console.log('\nInstructions for users:');
        console.log('To send CRUMBZ to the game, use this address:');
        console.log(gameTokenAccount.address.toString());
        console.log('\nSecurity note: Keep game-wallet.json secure as it contains the private key.');
        console.log('You will need to fund the wallet with 0.01 SOL before creating the token account.');

    } catch (error) {
        console.error('Error creating game wallet:', error);
        throw error;
    }
}

createGameWallet().catch(console.error);
