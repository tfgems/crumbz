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

// Event handler for mint form
const mintForm = document.getElementById('mintForm');
const mintButton = mintForm.querySelector('button');
const mintAmountInput = document.getElementById('mintAmount');

async function handleMintSubmit(e) {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('Form submit event caught');
    
    const amount = mintAmountInput.value;
    console.log('Amount from form:', amount);
    
    if (!amount || amount <= 0) {
        console.error('Invalid amount:', amount);
        showResponse('Please enter a valid amount greater than 0', 'error');
        return;
    }

    console.log('Sending mint request...');
    try {
        const response = await fetch('/api/mint', {
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
