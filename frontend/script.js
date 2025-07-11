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

// Event handler for claim functionality
const userAddressInput = document.getElementById('userAddress');
const statusDiv = document.getElementById('status');
const logsDiv = document.getElementById('logs');
const airdropButton = document.getElementById('airdropButton');
const airdropStatusDiv = document.getElementById('airdropStatus');

// Remove claim functionality since it's not in the HTML
// This function is no longer needed
function handleClaim() {
    // No-op since we don't have a claim button anymore
}

async function checkTransactionStatus(signature) {
    try {
        // Use backend API to check transaction status
        const response = await fetch(`/api/transaction-status?signature=${signature}`);
        const data = await response.json();
        
        if (data.status === 'confirmed') {
            return 'confirmed';
        }
        return 'pending';
    } catch (error) {
        console.error('Error checking transaction status:', error);
        return 'error';
    }
}

async function monitorTransaction(signature, address) {
    // Use WebSocket for real-time updates instead of polling
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'subscribe',
            signature: signature
        }));
    }
}

let ws = null;

function connectWebSocket() {
    if (ws) {
        ws.close();
    }
    
    ws = new WebSocket('ws://localhost:3000');
    
    ws.onopen = () => {
        console.log('WebSocket connected');
    };
    
    ws.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'transaction_update') {
            updateStatus(`Transaction confirmed! Slot: ${data.slot}`);
            addLog(`Transaction confirmed at slot ${data.slot}`, 'success');
        } else if (data.type === 'error') {
            updateStatus('Transaction error');
            addLog(`WebSocket error: ${data.message}`, 'error');
        }
    };
    
    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        addLog('WebSocket connection error', 'error');
    };
    
    ws.onclose = () => {
        console.log('WebSocket disconnected');
        // Try to reconnect after 5 seconds
        setTimeout(connectWebSocket, 5000);
    };
}

async function handleAirdrop() {
    try {
        const userAddress = userAddressInput.value;
        if (!userAddress) {
            updateStatus('Please enter your Solana address', 'error');
            addLog('Error: No address provided', 'error');
            airdropButton.disabled = false;
            return;
        }

        // Disable button while processing
        airdropButton.disabled = true;
        updateStatus('Requesting 1 SOL airdrop...');
        airdropStatusDiv.textContent = 'Requesting airdrop...';
        
        const response = await fetch('/api/airdrop', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address: userAddress })
        });
        
        const data = await response.json();
        
        if (data.success) {
            const signature = data.signature;
            updateStatus(`Airdrop initiated! Transaction: ${signature}`);
            airdropStatusDiv.textContent = `Airdrop initiated! Transaction: ${signature}`;
            addLog(`Airdrop initiated! Transaction: ${signature}`, 'success');
            
            // Subscribe to transaction updates
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'subscribe',
                    signature: signature
                }));
            }
        } else {
            updateStatus(`Error: ${data.error}`, 'error');
            airdropStatusDiv.textContent = `Error: ${data.error}`;
            addLog(`Airdrop failed: ${data.error}`, 'error');
            airdropButton.disabled = false;
        }
    } catch (error) {
        updateStatus(`Error: ${error.message}`, 'error');
        airdropStatusDiv.textContent = `Error: ${error.message}`;
        addLog(`Airdrop failed: ${error.message}`, 'error');
        airdropButton.disabled = false;
    }
}

// Add event listener for airdrop button
if (airdropButton) {
    airdropButton.addEventListener('click', handleAirdrop);
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize WebSocket connection
    connectWebSocket();
    
    // Initialize UI elements
    if (!airdropButton) {
        console.error('Airdrop button not found');
    }
    if (!userAddressInput) {
        console.error('Address input not found');
    }
});

// Function to validate Solana address
function isValidAddress(address) {
    // Basic Solana address validation
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

// Function to add log message
function addLog(message, type = 'info') {
    const logDiv = document.createElement('div');
    logDiv.className = `log-entry log-${type}`;
    logDiv.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    logsDiv.insertBefore(logDiv, logsDiv.firstChild);
    
    // Remove old logs if we have too many
    if (logsDiv.children.length > 20) {
        logsDiv.removeChild(logsDiv.lastChild);
    }
}

// Function to update status message
function updateStatus(message) {
    statusDiv.textContent = message;
}

// Function to show response message
function showResponse(message, type = 'success') {
    const responseDiv = document.createElement('div');
    responseDiv.className = `response ${type}`;
    responseDiv.textContent = message;
    document.body.appendChild(responseDiv);
    
    setTimeout(() => {
        responseDiv.remove();
    }, 5000);
}

// Remove duplicate DOMContentLoaded event handler since we already have one above
