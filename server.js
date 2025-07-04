const express = require('express');
const { Connection, PublicKey, Keypair, Transaction, SystemProgram } = require('@solana/web3.js');
const { 
    TOKEN_PROGRAM_ID, 
    createTransferInstruction, 
    getOrCreateAssociatedTokenAccount, 
    createBurnInstruction,
    createMintToInstruction
} = require('@solana/spl-token');
const path = require('path');
const http = require('http');
const helmet = require('helmet');
const fs = require('fs');

// Configure helmet with custom CSP
const csp = helmet.contentSecurityPolicy({
    directives: {
        defaultSrc: ["'none'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"]
    }
});

// Load configuration
const config = require('./config-devnet.json');
console.log('Loaded config:', config);

// Configuration
const MINT_ADDRESS = config.mint_address;
const TOKEN_DECIMALS = config.decimals;
const TOKEN_SYMBOL = config.symbol;
const TOKEN_NAME = config.name;

console.log('Using config:', {
    mintAddress: MINT_ADDRESS,
    decimals: TOKEN_DECIMALS,
    symbol: TOKEN_SYMBOL,
    name: TOKEN_NAME
});

// Remove duplicate config loading
if (typeof config === 'undefined') {
    console.error('Config file not found or invalid');
    process.exit(1);
}

// Initialize Solana connection and game wallet
const connection = new Connection(config.rpc_url || 'https://api.devnet.solana.com', 'confirmed');
const walletData = JSON.parse(fs.readFileSync('game-wallet.json', 'utf8'));
const gameWallet = Keypair.fromSecretKey(Uint8Array.from(walletData.privateKey));
const gameWalletPublicKey = new PublicKey(walletData.publicKey);

// Load your keypair
let keypair;
try {
    const keypairData = require('./.keys/crumbz_token-keypair.json');
    console.log('Key data loaded successfully');
    
    // Convert keypair data to Uint8Array
    const uint8Array = new Uint8Array(keypairData);
    console.log('Converted key data to Uint8Array');
    
    // Create keypair
    keypair = Keypair.fromSecretKey(uint8Array);
    console.log('Keypair created successfully');
    console.log('Using keypair:', keypair.publicKey.toString());
    
    if (!keypair.publicKey) {
        console.error('Failed to load keypair: Invalid keypair data');
        process.exit(1);
    }
    
    console.log('Keypair loaded successfully');
} catch (error) {
    console.error('Error loading keypair:', error);
    console.error('Make sure the .keys/crumbz_token-keypair.json file exists and contains valid key data');
    process.exit(1);
}

// Initialize server and middleware
const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);

// Middleware
app.use(express.json());
app.use(csp);
app.use(express.static(path.join(__dirname, 'frontend'), {
    setHeaders: (res, path, stat) => {
        if (path.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        }
    }
}));

// Serve static files from frontend directory

// Handle root path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// Handle claim endpoint
app.post('/api/claim', async (req, res) => {
    try {
        console.log('=== Claim Transaction Started ===');
        console.log('Request received:', { body: req.body });
        const { userAddress, amount } = req.body;

        if (!userAddress) {
            return res.status(400).json({ error: 'User address is required' });
        }

        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Invalid amount' });
        }

        // Get user's token account
        const userTokenAccount = await getOrCreateAssociatedTokenAccount(
            connection,
            gameWallet,
            new PublicKey(config.mint_address),
            new PublicKey(userAddress)
        );

        // Load user's record
        const userRecordPath = getUserRecordPath(new PublicKey(userAddress));
        let userRecord = await loadUserRecord(new PublicKey(userAddress));

        // Add to pending claims
        userRecord.pendingClaims = userRecord.pendingClaims || [];
        userRecord.pendingClaims.push({
            address: userAddress,
            amount: parseFloat(amount)
        });

        // Save updated record
        await saveUserRecord(new PublicKey(userAddress), userRecord);

        res.json({ success: true, message: 'Claim recorded. Waiting for 0.01 SOL...' });
    } catch (error) {
        console.error('Error in claim:', error);
        res.status(500).json({ error: error.message });
    }
});

// Middleware
app.use(express.json());
app.use(express.static(__dirname));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

app.post('/api/burn', async (req, res) => {
    try {
        console.log('=== Burn Transaction Started ===');
        console.log('Request received:', { body: req.body });
        const { amount } = req.body;
        console.log('Amount to burn:', amount);
        console.log('Current time:', new Date().toISOString());
        console.log('Initiating burn process...');
        
        // Get keypair balance and check if sufficient
        const balance = await connection.getBalance(keypair.publicKey);
        if (balance < 0.01 * 1e9) {
            throw new Error(`Insufficient SOL balance. Current balance: ${balance / 1e9} SOL, Required: 0.01 SOL`);
        }

        // Get source token account and check token balance
        const sourceTokenAccount = await getOrCreateAssociatedTokenAccount(
            connection,
            keypair,
            new PublicKey(MINT_ADDRESS),
            keypair.publicKey,
        );
        const sourceTokenBalance = await connection.getTokenAccountBalance(sourceTokenAccount.address);

        // Convert amount to smallest unit using token decimals
        const decimalMultiplier = BigInt(10 ** TOKEN_DECIMALS);
        const amountBN = BigInt(amount) * decimalMultiplier;
        
        if (amountBN > BigInt(sourceTokenBalance.value.amount)) {
            throw new Error(`Insufficient token balance. Available: ${sourceTokenBalance.value.uiAmount} CRUMBZ, Requested: ${amount}`);
        }

        // Log burn details
        console.log('Processing burn:', { 
            signer: keypair.publicKey.toString(),
            signerBalance: balance / 1e9 + ' SOL',
            tokenBalance: sourceTokenBalance.value.uiAmount,
            amount: amountBN.toString(), 
            amountHumanReadable: amount
        });

        // Create and send burn transaction
        const transaction = new Transaction().add(
            createBurnInstruction(
                sourceTokenAccount.address, // source account
                new PublicKey(MINT_ADDRESS), // mint
                keypair.publicKey, // owner
                amountBN, // amount
                [], // multi-sig signers
                TOKEN_PROGRAM_ID
            )
        );

        const signature = await connection.sendTransaction(transaction, [keypair]);
        await connection.confirmTransaction(signature);

        // Get updated balance
        const newBalance = await connection.getTokenAccountBalance(sourceTokenAccount.address);

        res.json({ 
            signature,
            success: true,
            message: 'Tokens burned successfully',
            previousBalance: sourceTokenBalance.value.uiAmount,
            newBalance: newBalance.value.uiAmount
        });
    } catch (error) {
        console.error('Error in burn transaction:', error);
        res.status(500).json({ 
            error: error.message,
            success: false
        });
    }
});

app.post('/api/transfer', async (req, res) => {
    try {
        const { address, amount } = req.body;
        
        // Get keypair balance and check if sufficient
        const balance = await connection.getBalance(keypair.publicKey);
        if (balance < 0.01 * 1e9) {
            throw new Error(`Insufficient SOL balance. Current balance: ${balance / 1e9} SOL, Required: 0.01 SOL`);
        }

        // Get source token account and check token balance
        const sourceTokenAccount = await getOrCreateAssociatedTokenAccount(
            connection,
            keypair,
            new PublicKey(MINT_ADDRESS),
            keypair.publicKey,
        );
        const sourceTokenBalance = await connection.getTokenAccountBalance(sourceTokenAccount.address);

        // Convert amount to smallest unit using token decimals
        const decimalMultiplier = BigInt(10 ** TOKEN_DECIMALS);
        const amountBN = BigInt(amount) * decimalMultiplier;
        
        if (amountBN > BigInt(sourceTokenBalance.value.amount)) {
            throw new Error(`Insufficient token balance. Available: ${sourceTokenBalance.value.uiAmount} CRUMBZ, Requested: ${amount}`);
        }

        // Get destination token account
        const destinationTokenAccount = await getOrCreateAssociatedTokenAccount(
            connection,
            keypair,
            new PublicKey(MINT_ADDRESS),
            new PublicKey(address),
        );

        // Create and send transfer transaction
        const transaction = new Transaction().add(
            createTransferInstruction(
                sourceTokenAccount.address, // source
                destinationTokenAccount.address, // destination
                keypair.publicKey, // owner
                amountBN, // amount
                [], // multi-sig signers
                TOKEN_PROGRAM_ID
            )
        );

        const signature = await connection.sendTransaction(transaction, [keypair]);
        await connection.confirmTransaction(signature);

        // Get updated balances
        const newSourceBalance = await connection.getTokenAccountBalance(sourceTokenAccount.address);
        const newDestinationBalance = await connection.getTokenAccountBalance(destinationTokenAccount.address);

        res.json({ 
            signature,
            success: true,
            message: 'Tokens transferred successfully',
            previousSourceBalance: sourceTokenBalance.value.uiAmount,
            newSourceBalance: newSourceBalance.value.uiAmount,
            previousDestinationBalance: newDestinationBalance.value.uiAmount,
            newDestinationBalance: newDestinationBalance.value.uiAmount
        });
    } catch (error) {
        console.error('Error in transfer transaction:', error);
        if (error.message.includes('custom program error: 0x1')) {
            res.status(400).json({ error: `Insufficient token balance. Available: ${sourceTokenBalance.value.uiAmount} CRUMBZ, Requested: ${amount}` });
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});

app.post('/api/mint', async (req, res) => {
    try {
        console.log('=== Mint Transaction Started ===');
        console.log('Request received:', { body: req.body });
        const { amount } = req.body;
        console.log('Amount to mint:', amount);
        console.log('Current time:', new Date().toISOString());
        console.log('Initiating mint process...');
        
        // Get keypair balance and check if sufficient
        const balance = await connection.getBalance(keypair.publicKey);
        if (balance < 0.01 * 1e9) {
            throw new Error(`Insufficient SOL balance. Current balance: ${balance / 1e9} SOL, Required: 0.01 SOL`);
        }

        // Get token account
        const tokenAccount = await getOrCreateAssociatedTokenAccount(
            connection,
            keypair,
            new PublicKey(MINT_ADDRESS),
            keypair.publicKey,
        );

        // Convert amount to smallest unit using token decimals
        const decimalMultiplier = BigInt(10 ** TOKEN_DECIMALS);
        const amountBN = BigInt(amount) * decimalMultiplier;

        // Log mint details
        console.log('Processing mint:', { 
            signer: keypair.publicKey.toString(),
            signerBalance: balance / 1e9 + ' SOL',
            amount: amountBN.toString(), 
            amountHumanReadable: amount
        });

        // Create and send mint transaction
        const transaction = new Transaction().add(
            createMintToInstruction(
                new PublicKey(MINT_ADDRESS), // mint
                tokenAccount.address, // destination
                keypair.publicKey, // authority
                amountBN, // amount
                [], // multi-sig signers
                TOKEN_PROGRAM_ID
            )
        );

        const signature = await connection.sendTransaction(transaction, [keypair]);
        await connection.confirmTransaction(signature);

        // Get updated balance
        const newBalance = await connection.getTokenAccountBalance(tokenAccount.address);

        res.json({ 
            signature,
            success: true,
            message: 'Tokens minted successfully',
            newBalance: newBalance.value.uiAmount
        });
    } catch (error) {
        console.error('Error in mint transaction:', error);
        res.status(500).json({ 
            error: error.message,
            success: false
        });
    }
});

// Start server
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
