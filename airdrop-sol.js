const { Connection, PublicKey, LAMPORTS_PER_SOL } = require('@solana/web3.js');

// Initialize connection
const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
const targetWallet = new PublicKey(config.wallet_addresses.test_wallet);

async function airdropSol(amount) {
    try {
        console.log(`Requesting airdrop of ${amount} SOL to wallet: ${targetWallet.toString()}`);
        
        // Convert amount to lamports
        const lamports = amount * LAMPORTS_PER_SOL; // 1 SOL = 1,000,000,000 lamports
        
        // Request airdrop
        const signature = await connection.requestAirdrop(targetWallet, lamports);
        
        console.log('Airdrop signature:', signature);
        
        // Confirm transaction
        await connection.confirmTransaction(signature);
        
        // Check balance
        const balance = await connection.getBalance(targetWallet);
        console.log(`Wallet balance: ${balance / LAMPORTS_PER_SOL} SOL`);
        
        return { success: true, signature, balance };
    } catch (error) {
        console.error('Error requesting airdrop:', error);
        return { success: false, error: error.message };
    }
}

// Airdrop 2 SOL
airdropSol(2).then(result => {
    if (result.success) {
        console.log('Airdrop successful!');
    } else {
        console.error('Airdrop failed:', result.error);
    }
});
