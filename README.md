# CRUMBZ - Solana Token Burn Tracker

CRUMBZ is a Solana-based token burn tracking system that monitors token transfers to a game wallet and automatically burns received tokens. It maintains a record of burned tokens for each user in a decentralized manner.

## Features

- Real-time token transfer monitoring using WebSocket
- Automatic token burning upon receipt
- Persistent burn record tracking per user
- Local JSON file storage for burn records (working on decentralized storage)
- Simple and efficient implementation using JavaScript

## Project Structure

```
crumbz/
├── .keys/              # Contains private key files
├── assets/             # Design assets (not tracked in git)
├── frontend/           # Frontend UI files
├── user_records/       # User-specific burn records
├── burn-tracker-client.js   # Main burn tracking implementation
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
