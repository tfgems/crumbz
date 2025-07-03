const fs = require('fs');
const path = require('path');
const { Connection, PublicKey, Keypair, LAMPORTS_PER_SOL, Transaction } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID, createBurnInstruction, getOrCreateAssociatedTokenAccount, getAccount, getAssociatedTokenAddress } = require('@solana/spl-token');

// Helper functions
function formatTokenAmount(amount, decimals) {
    // Convert amount to number if it's a BigInt
    const amountNum = typeof amount === 'bigint' ? Number(amount) : amount;
    // Handle potential undefined decimals
    const decimalsNum = decimals || 0;
    return (amountNum / Math.pow(10, decimalsNum)).toFixed(2);
}

function validateTokenAmount(amount, decimals) {
    // Convert to number if it's a BigInt
    if (typeof amount === 'bigint') {
        return Number(amount);
    }
    
    if (typeof amount === 'number') {
        return Math.round(amount * Math.pow(10, decimals));
    }
    
    throw new Error('Invalid token amount type. Must be number or bigint.');
}

// Load config
const config = require('./config-devnet.json');
const { Console } = require('console');
if (!config.mint_address) {
    throw new Error('Mint address not found in config');
}

const MINT_ADDRESS = new PublicKey(config.mint_address);
const TOKEN_SYMBOL = config.symbol || 'CRUMBZ';
const TOKEN_DECIMALS = config.decimals || 6;
const RPC_URL = config.rpc_url || 'https://api.mainnet-beta.solana.com'; // Reliable RPC endpoint

// Load game wallet
const walletData = JSON.parse(fs.readFileSync('game-wallet.json', 'utf8'));
const gameWallet = Keypair.fromSecretKey(Uint8Array.from(walletData.privateKey));

// Initialize connection
const connection = new Connection(RPC_URL, 'confirmed');
console.log('Connection commitment:', connection._commitment);

// Helper function to get user's burn record file path
function getUserRecordPath(sender) {
    return `user_records/${sender.toString()}.json`;
}

// Helper function to load user's burn record
async function loadUserRecord(sender) {
    console.log(' * Loading user record for:', sender.toString());
    const filePath = getUserRecordPath(sender);
    try {
        console.log(' * exists');
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
        console.log(' * does not exist');
        // If file doesn't exist, return empty record
        return { inGameTokens: '0' };
    }
}

// Helper function to save user's burn record
async function saveUserRecord(sender, record) {
    const filePath = getUserRecordPath(sender);
    fs.writeFileSync(filePath, JSON.stringify(record, null, 2));
}

// Helper function to log final balances
async function logFinalBalances(tokenAccount, sender) {
    try {
        // Get token account balance
        const account = await getAccount(connection, tokenAccount);
        const tokenBalance = Number(account.amount) / Math.pow(10, TOKEN_DECIMALS);
        
        // Get the JSON file path for the sender
        const filePath = path.join('user_records', sender.toString() + '.json');
        
        // Read the JSON file directly
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const userRecord = JSON.parse(fileContent);
        
        // Log raw values for debugging
        console.log('Raw inGameTokens value from JSON:', userRecord.inGameTokens);
        
        // Convert the inGameTokens string to number and format
        const inGameTokens = Number(BigInt(userRecord.inGameTokens)) / Math.pow(10, TOKEN_DECIMALS);
        
        console.log('\n=== Final Balances ===');
        console.log(`Game Wallet Token Balance: ${formatTokenAmount(tokenBalance, TOKEN_DECIMALS)} ${TOKEN_SYMBOL}`);
        console.log(`Total In-Game Tokens: ${formatTokenAmount(inGameTokens, TOKEN_DECIMALS)} ${TOKEN_SYMBOL}`);
        console.log('======================\n');
    } catch (error) {
        console.error('Error logging final balances:', error);
    }
}

// Helper function to record a burn
async function recordBurn(tokenAccount, amount, sender) {
    try {
        // If amount is a string, convert it to BigInt
        const bigAmount = typeof amount === 'string' ? BigInt(amount) : amount;
        
        // Get current balance
        const accountInfo = await getAccount(connection, tokenAccount);
        
        // Validate the amount
        const burnAmount = validateTokenAmount(bigAmount, TOKEN_DECIMALS);
        
        // Check if we have enough balance
        if (Number(accountInfo.amount) < Number(burnAmount)) {
            throw new Error(`Insufficient balance. Available: ${formatTokenAmount(accountInfo.amount, TOKEN_DECIMALS)} ${TOKEN_SYMBOL}, Required: ${formatTokenAmount(burnAmount, TOKEN_DECIMALS)} ${TOKEN_SYMBOL}`);
        }
        
        console.log(`Current ${TOKEN_SYMBOL} balance: ${formatTokenAmount(accountInfo.amount, TOKEN_DECIMALS)} ${TOKEN_SYMBOL}`);
        console.log(`Attempting to burn: ${formatTokenAmount(burnAmount, TOKEN_DECIMALS)} ${TOKEN_SYMBOL}`);
        
        // Convert amount back to BigInt for burn instruction
        const burnAmountBigInt = BigInt(burnAmount);
        
        // Create burn instruction
        const burnInstruction = createBurnInstruction(
            tokenAccount,
            MINT_ADDRESS,
            gameWallet.publicKey,
            burnAmountBigInt,
            [],
            TOKEN_PROGRAM_ID
        );
        
        // Create and send transaction
        const transaction = new Transaction().add(burnInstruction);
        
        // Send and confirm transaction
        const signature = await connection.sendTransaction(transaction, [gameWallet]);
        await connection.confirmTransaction(signature);
        
        console.log(`Burn transaction confirmed: ${signature}`);
        
        // Load and update user's record
        const userRecord = await loadUserRecord(sender);
        const currentTokens = BigInt(userRecord.inGameTokens || '0');
        const newTokens = currentTokens + BigInt(burnAmount);
        
        // Save updated record
        await saveUserRecord(sender, {
            inGameTokens: newTokens.toString()
        });

        console.log(await loadUserRecord(sender));

        return {
            success: true,
            inGameTokens: newTokens.toString()
        };

        

    } catch (error) {
        console.error('Error recording burn:', error);
        return { success: false, error: error.message };
    }
}

// Update the monitorTokenAccount function to use the new recordBurn function
async function checkStatus() {
    try {
        console.log('Checking current status...');
        console.log('Using RPC URL:', RPC_URL);
        console.log('Mint Address:', MINT_ADDRESS.toString());
        console.log('Token Symbol:', TOKEN_SYMBOL);
        console.log('Decimals:', TOKEN_DECIMALS);
        
        // Get the token account
        console.log('Getting token account...');
        const tokenAccount = await getAccount(connection, tokenAccountAddress);
        console.log('Token account info:', tokenAccount);
        
        // Get current balance
        const balance = Number(tokenAccount.amount) / Math.pow(10, TOKEN_DECIMALS);
        console.log(`Current token balance: ${formatTokenAmount(balance, TOKEN_DECIMALS)} ${TOKEN_SYMBOL}`);
        
        // Check if there are any burn records
        const burnRecordPath = getUserRecordPath(gameWallet.publicKey);
        try {
            const burnRecord = JSON.parse(fs.readFileSync(burnRecordPath, 'utf8'));
            console.log(`Total burned tokens: ${formatTokenAmount(burnRecord.inGameTokens, TOKEN_DECIMALS)} ${TOKEN_SYMBOL}`);
        } catch (error) {
            console.log('No burn records found yet');
        }
    } catch (error) {
        console.error('Error checking status:', error);
    }
}

async function monitorTokenAccount() {
    try {
        console.log('Starting token account monitor...');
        console.log('Using RPC URL:', RPC_URL);
        console.log('Mint Address:', MINT_ADDRESS.toString());
        console.log('Token Symbol:', TOKEN_SYMBOL);
        console.log('Decimals:', TOKEN_DECIMALS);
        
        // Get the token account
        console.log('Getting or creating token account...');
        const tokenAccount = await getOrCreateAssociatedTokenAccount(
            connection,
            gameWallet,
            MINT_ADDRESS,
            gameWallet.publicKey
        );
        console.log('Token account address:', tokenAccount.address.toString());
        
        // Verify token account details
        console.log('Verifying token account details...');
        const accountInfo = await getAccount(connection, tokenAccount.address);
        console.log('Token account info:', {
            address: tokenAccount.address.toString(),
            mint: accountInfo.mint.toString(),
            owner: accountInfo.owner.toString(),
            amount: accountInfo.amount.toString(),
            decimals: accountInfo.decimals
        });
        
        // Get initial balance
        const initialAccount = await getAccount(connection, tokenAccount.address);
        console.log(`Initial token balance: ${formatTokenAmount(initialAccount.amount, TOKEN_DECIMALS)}`);
        
        // Monitor for incoming transfers using WebSocket
        console.log('Setting up WebSocket subscription...');
        
        // Initialize WebSocket connection with retry logic
        let subscriptionId = null;
        let retryCount = 0;
        const maxRetries = 5;
        const retryDelay = 5000; // 5 seconds

        const setupSubscription = async () => {
            try {
                console.log('Attempting to set up WebSocket subscription...');
                
                // First, unsubscribe if we have an existing subscription
                if (subscriptionId !== null) {
                    await connection.removeAccountChangeListener(subscriptionId);
                }
                
                // Set up new subscription
                subscriptionId = connection.onAccountChange(
                    tokenAccount.address,
                    async (accountInfo, context) => {
                        try {
                            console.log('Account updated:', accountInfo);
                            
                            // Parse the token account data
                            const account = await getAccount(connection, tokenAccount.address);
                            //console.log('Raw account data:', account);
                            
                            // Get the amount from the account info
                            const amount = account.amount;
                            
                            // Log the raw balance and calculate the current balance
                            //console.log(`Raw token balance: ${amount.toString()} (decimals: ${TOKEN_DECIMALS})`);
                            const currentBalance = Number(amount) / Math.pow(10, TOKEN_DECIMALS);
                            console.log(`GameWallet token balance: ${formatTokenAmount(currentBalance, TOKEN_DECIMALS)} ${TOKEN_SYMBOL}`);
                            
                            // Check if we need to burn
                            if (currentBalance > 0) {
                                console.log('Attempting to burn tokens...');
                                const result = await recordBurn(
                                    tokenAccount.address,
                                    amount, // Pass the raw amount as string
                                    gameWallet.publicKey
                                );
                                if (result.success) {
                                    console.log(`Successfully burned ${formatTokenAmount(result.inGameTokens, TOKEN_DECIMALS)} ${TOKEN_SYMBOL}`);
                                
                                try {
                                    // Get updated account info after burn
                                    const updatedAccount = await getAccount(connection, tokenAccount.address);
                                    const updatedBalance = Number(updatedAccount.amount) / Math.pow(10, TOKEN_DECIMALS);
                                    console.log(`GameWalletPost-burn token balance: ${formatTokenAmount(updatedBalance, TOKEN_DECIMALS)} ${TOKEN_SYMBOL}`);
                                    
                                    // Log final balances after successful burn
                                    await logFinalBalances(tokenAccount.address, gameWallet.publicKey);
                                } catch (error) {
                                    console.error('Error checking post-burn balance:', error);
                                }
                                } else {
                                    console.error('Failed to record burn:', result.error);
                                }
                            }
                        } catch (error) {
                            console.error('Error processing account update:', error);
                        }
                    },
                    { commitment: 'confirmed' }
                );
                
                console.log('WebSocket subscription successfully established');
                retryCount = 0;
            } catch (error) {
                console.error('Error setting up WebSocket subscription:', error);
                retryCount++;
                
                if (retryCount < maxRetries) {
                    console.log(`Retrying in ${retryDelay}ms... Attempt ${retryCount}/${maxRetries}`);
                    setTimeout(setupSubscription, retryDelay);
                } else {
                    console.error('Max retries reached. Failed to establish WebSocket connection.');
                }
            }
        };

        // Start initial subscription
        setupSubscription();
        

        
        console.log('Monitoring started. Press Ctrl+C to stop.');
        
        // Keep the process running
        await new Promise(resolve => {});
    } catch (error) {
        console.error('Error in monitorTokenAccount:', error);
    }
}

// Call the monitorTokenAccount function
monitorTokenAccount();
