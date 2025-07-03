const { Connection, PublicKey, Keypair, Transaction } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID, createMintToInstruction, getOrCreateAssociatedTokenAccount } = require('@solana/spl-token');
const config = require('./config.json');

// Load keypair
let keypair;
try {
    const keypairData = require('./.keys/crumbz_token-keypair.json');
    const uint8Array = new Uint8Array(keypairData);
    keypair = Keypair.fromSecretKey(uint8Array);
} catch (error) {
    console.error('Error loading keypair:', error);
    process.exit(1);
}

// Initialize connection
const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

// Configuration
const MINT_ADDRESS = config.mint_address;
const TOKEN_DECIMALS = config.decimals;
const AMOUNT_TO_MINT = BigInt(1000000); // 1 million tokens
const AMOUNT_WITH_DECIMALS = AMOUNT_TO_MINT * BigInt(10 ** TOKEN_DECIMALS);

async function mintTokens() {
    try {
        // Get token account
        console.log('Getting token account...');
        const tokenAccount = await getOrCreateAssociatedTokenAccount(
            connection,
            keypair,
            new PublicKey(MINT_ADDRESS),
            keypair.publicKey,
            TOKEN_PROGRAM_ID
        );
        console.log('Token account:', tokenAccount.address.toString());

        // Create mint instruction
        console.log('Creating mint instruction...');
        const instruction = createMintToInstruction(
            new PublicKey(MINT_ADDRESS),
            tokenAccount.address,
            keypair.publicKey,
            AMOUNT_WITH_DECIMALS,
            [],
            TOKEN_PROGRAM_ID
        );

        // Create transaction
        console.log('Creating transaction...');
        const transaction = new Transaction().add(instruction);

        // Sign and send transaction
        console.log('Sending transaction...');
        const signature = await connection.sendTransaction(transaction, [keypair]);
        console.log('Transaction sent, signature:', signature);
        
        // Confirm transaction
        console.log('Confirming transaction...');
        await connection.confirmTransaction(signature);
        console.log('Transaction confirmed');

        // Get final balance
        const balance = await connection.getTokenAccountBalance(tokenAccount.address);
        console.log('Final balance:', balance.value.uiAmount, 'CRUMBZ');

        console.log('Successfully minted 1,000,000 CRUMBZ!');
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

// Run the minting process
mintTokens();
