# CRUMBZ - Solana Token Burn Tracker

CRUMBZ is a Solana-based token burn tracking system that monitors token transfers to a game wallet and automatically burns received tokens. It maintains a record of burned tokens for each user in a decentralized manner.

## Features

- Real-time token transfer monitoring using WebSocket
- Automatic token minting when 0.01 SOL is received
- Testnet SOL airdrop functionality (1 SOL)
- Pending claim tracking for token requests
- Local JSON file storage for user records
- Simple and efficient implementation using JavaScript

## Solana Devnet Airdrop

The system now includes a Solana devnet airdrop feature that allows users to request 1 SOL for testing purposes. Key features include:

- User-friendly interface for requesting 1 SOL airdrop
- Real-time transaction status updates via WebSocket
- Automatic transaction confirmation monitoring
- Rate limiting error handling
- No frontend Solana Web3.js dependency
- Clean error handling and status updates

To use the airdrop:
1. Enter a valid Solana devnet address
2. Click "Get 1 SOL (Devnet)"
3. Monitor transaction status in real-time
4. Note: Airdrop may be rate-limited by the Solana devnet faucet

## Project Structure

```
crumbz/
├── .keys/              # Contains private key files
├── assets/             # Design assets (not tracked in git)
├── frontend/           # Frontend UI files
├── user_records/       # User-specific token records
├── token-monitor.js    # Main token monitoring implementation
├── config-devnet.json  # Configuration file
├── server.js           # Express server for frontend
├── mint-tokens.js      # Token minting script
├── airdrop-sol.js      # SOL airdrop script
├── send-sol.js         # SOL transfer script
└── create-game-wallet.js # Game wallet creation script
```

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment:
- Copy `.env.example` to `.env` and configure your environment variables
- Update `config-devnet.json` with your token and wallet information

3. Create game wallet:
```bash
node create-game-wallet.js
```

4. Start the server:
```bash
node server.js
```

5. Start the burn tracker:
```bash
node burn-tracker-client.js
```

## Configuration

The main configuration is stored in `config-devnet.json`:
- `mint_address`: The token mint address
- `decimals`: Token decimals
- `symbol`: Token symbol
- `name`: Token name
- `rpc_url`: Solana RPC endpoint
- `wallet_addresses`: Contains game and test wallet addresses

## Security

- Private keys are stored in `.keys/` directory
- Wallet addresses are stored in `config-devnet.json`
- Burn records are stored locally in `user_records/`
- All sensitive files are properly ignored in `.gitignore`

## License

This project is licensed under the MIT License - see the LICENSE file for details.
