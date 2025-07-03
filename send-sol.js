const { Connection, PublicKey, Keypair, Transaction, SystemProgram, LAMPORTS_PER_SOL } = require('@solana/web3.js');

// Initialize connection
const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

// Load our funded wallet (game wallet)
const fs = require('fs');
const walletData = JSON.parse(fs.readFileSync('game-wallet.json', 'utf8'));
const fromWallet = Keypair.fromSecretKey(Uint8Array.from(walletData.privateKey));

// Target wallet address
const toWallet = new PublicKey(config.wallet_addresses.test_wallet);

async function sendSol() {
    try {
        console.log('Sending 1 SOL from:', fromWallet.publicKey.toString());
        console.log('To:', toWallet.toString());

        // Create a new transaction
        const transaction = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: fromWallet.publicKey,
                toPubkey: toWallet,
                lamports: LAMPORTS_PER_SOL
            })
        );

        // Sign and send transaction
        const signature = await connection.sendTransaction(transaction, [fromWallet]);
        await connection.confirmTransaction(signature);

        console.log('Transaction confirmed:', signature);
        
        // Check balances
        const fromBalance = await connection.getBalance(fromWallet.publicKey);
        const toBalance = await connection.getBalance(toWallet);
        
        console.log(`From wallet balance: ${fromBalance / LAMPORTS_PER_SOL} SOL`);
        console.log(`To wallet balance: ${toBalance / LAMPORTS_PER_SOL} SOL`);
        
        return { success: true, signature, fromBalance, toBalance };
    } catch (error) {
        console.error('Error sending SOL:', error);
        return { success: false, error: error.message };
    }
}

// Execute
sendSol().then(result => {
    if (result.success) {
        console.log('Transfer successful!');
    } else {
        console.error('Transfer failed:', result.error);
    }
});
