console.log('=== Script loaded ===');

// Prevent Phantom wallet connection attempts
window.addEventListener('message', (event) => {
    if (event.source !== window) {
        console.log('Blocking connection attempt from:', event.origin);
        return;
    }
});

// Prevent Phantom wallet initialization
window.phantom = null;
window.solana = null;

// Test function to verify script is working
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded and parsed');
    console.log('Script.js is active');
});

// Event handler for transfer form
const transferForm = document.getElementById('transferForm');
const transferButton = transferForm.querySelector('button');
const addressInput = document.getElementById('address');
const amountInput = document.getElementById('amount');

async function handleTransferSubmit(e) {
    e.preventDefault();
    
    const address = addressInput.value;
    const amount = amountInput.value;
    console.log('Button clicked with:', { address, amount });

    try {
        // Send transfer request directly to server
        console.log('Sending transfer request...');
        const response = await fetch('/api/transfer', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                address: address,
                amount: amount
            })
        });
        console.log('API response status:', response.status);

        const data = await response.json();
        console.log('API response data:', data);

        if (response.ok) {
            showResponse(`Transaction successful! Signature: ${data.signature}`, 'success');
        } else {
            showResponse(`Error: ${data.error}`, 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showResponse(`Error: ${error.message}`, 'error');
    }
}

// Add event listeners for transfer form
transferForm.addEventListener('submit', handleTransferSubmit);
transferButton.addEventListener('click', handleTransferSubmit);

// Event handler for claim functionality
const userAddressInput = document.getElementById('userAddress');
const claimAmountInput = document.getElementById('claimAmount');
const claimButton = document.getElementById('claimButton');
const solBalanceElement = document.getElementById('solBalance');
const claimResponseElement = document.getElementById('claimResponse');

// Initialize Solana connection
let connection;

async function initializeSolana() {
    try {
        connection = new window.solana.Connection('https://api.devnet.solana.com', 'confirmed');
        console.log('Solana connection initialized');
        
        // Update SOL balance every 5 seconds
        setInterval(updateSolBalance, 5000);
    } catch (error) {
        console.error('Error initializing Solana:', error);
    }
}

async function updateSolBalance() {
    try {
        if (!userAddressInput.value) {
            solBalanceElement.textContent = 'Please enter your Solana address';
            claimButton.disabled = true;
            return;
        }

        const publicKey = new window.solana.PublicKey(userAddressInput.value);
        const balance = await connection.getBalance(publicKey);
        const balanceSol = window.solana.LAMPORTS_PER_SOL;
        
        solBalanceElement.textContent = `SOL Balance: ${balance / balanceSol} SOL`;
        
        // Enable claim button if address is valid and amount is entered
        claimButton.disabled = !claimAmountInput.value;
    } catch (error) {
        console.error('Error updating SOL balance:', error);
        solBalanceElement.textContent = 'Invalid Solana address or error checking balance';
        claimButton.disabled = true;
    }
}

async function handleClaim() {
    try {
        const amount = claimAmountInput.value;
        const userAddress = userAddressInput.value;
        
        if (!amount || amount <= 0) {
            showResponse('Please enter a valid amount greater than 0', 'error');
            return;
        }

        if (!userAddress) {
            showResponse('Please enter your Solana address', 'error');
            return;
        }

        // Send claim request
        const response = await fetch('/api/claim', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userAddress: userAddress,
                amount: amount
            })
        });

        const data = await response.json();
        
        if (data.success) {
            showResponse(`Claim recorded! Waiting for 0.01 SOL...`, 'claim');
            claimAmountInput.value = '';
            userAddressInput.value = '';
        } else {
            showResponse(`Error: ${data.error}`, 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showResponse(`Error: ${error.message}`, 'error');
    }
}

// Add event listeners
claimButton.addEventListener('click', handleClaim);
claimAmountInput.addEventListener('input', updateSolBalance);
userAddressInput.addEventListener('input', updateSolBalance);

// Helper function to show response messages
function showResponse(message, type) {
    const responseElement = type === 'claim' ? claimResponseElement : document.getElementById('response');
    responseElement.className = `response ${type}`;
    responseElement.textContent = message;
    responseElement.style.display = 'block';
    
    // Hide response after 5 seconds
    setTimeout(() => {
        responseElement.style.display = 'none';
    }, 5000);
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeSolana();
});
        console.log('API response data:', data);
        
        if (data.success) {
            showResponse(`Tokens minted successfully! Signature: ${data.signature}`, 'success');
        } else {
            showResponse(`Error: ${data.error}`, 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showResponse(`Error: ${error.message}`, 'error');
    }
}

// Add event listeners for mint form
mintForm.addEventListener('submit', handleMintSubmit);
mintButton.addEventListener('click', handleMintSubmit);

// Event handler for burn form
const burnForm = document.getElementById('burnForm');
const burnButton = burnForm.querySelector('button');
const burnAmountInput = document.getElementById('burnAmount');

async function handleBurnSubmit(e) {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('Form submit event caught');
    
    const amount = burnAmountInput.value;
    console.log('Amount from form:', amount);
    
    if (!amount || amount <= 0) {
        console.error('Invalid amount:', amount);
        showResponse('Please enter a valid amount greater than 0', 'error');
        return;
    }

    console.log('Sending burn request...');
    try {
        const response = await fetch('/api/burn', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                amount: amount
            })
        });
        console.log('API response status:', response.status);
        
        const data = await response.json();
        console.log('API response data:', data);
        
        if (data.success) {
            showResponse(`Tokens burned successfully!`, 'success');
        } else {
            showResponse(`Error: ${data.error}`, 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showResponse(`Error: ${error.message}`, 'error');
    }
}

// Add event listeners for burn form
burnForm.addEventListener('submit', handleBurnSubmit);
burnButton.addEventListener('click', handleBurnSubmit);

// Function to validate Solana address
function isValidAddress(address) {
    // Basic Solana address validation
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

// Function to show response message
function showResponse(message, type = 'success') {
    const responseDiv = document.getElementById('response');
    responseDiv.className = `response ${type}`;
    responseDiv.textContent = message;
    responseDiv.style.display = 'block';
    setTimeout(() => {
        responseDiv.style.display = 'none';
    }, 5000);
}
