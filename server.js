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

// Initialize server and middleware
const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);

// Middleware
app.use(express.json());
app.use(csp);

// Serve static files from frontend directory
app.use(express.static(path.join(__dirname, 'frontend'), {
    setHeaders: (res, path, stat) => {
        if (path.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        }
    }
}));

// Serve static files from frontend directory
app.use(express.static(path.join(__dirname, 'frontend'), {
    setHeaders: (res, path, stat) => {
        if (path.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        }
    }
}));

// Handle root path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// Load your keypair
let keypair;
try {
    //const keypairData = require('/Users/fastindemand/Documents/Projects/2025/SOLANA/.keys/crumbz_token-keypair.json');
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

// Load configuration
const config = require('./config.json');
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

// Initialize Solana connection
const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

// Middleware
app.use(express.json());
app.use(express.static(__dirname));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Get keypair balance
app.get('/api/balance', async (req, res) => {
    try {
        const balance = await connection.getBalance(keypair.publicKey);
        res.json({
            balance: balance / 1e9, // Convert lamports to SOL
            address: keypair.publicKey.toString()
        });
    } catch (error) {
        console.error('Error getting balance:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get token balance
app.get('/api/token-balance', async (req, res) => {
    try {
        const tokenAccount = await getOrCreateAssociatedTokenAccount(
            connection,
            keypair,
            new PublicKey(MINT_ADDRESS),
            keypair.publicKey
        );
        const balance = await connection.getTokenAccountBalance(tokenAccount.address);
        res.json({
            balance: balance.value.uiAmount,
            address: keypair.publicKey.toString(),
            mint: MINT_ADDRESS
        });
    } catch (error) {
        console.error('Error getting token balance:', error);
        res.status(500).json({ error: error.message });
    }
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
