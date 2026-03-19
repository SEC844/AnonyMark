<div align="center">
  
# ⬡AnonyMark
  
</div>

# AnonyMark - Décentralized Marketplace

A secure, privacy-focused Web3 marketplace built on Ethereum (Sepolia testnet) using Ethers.js v6.

## Features

- **Wallet Integration**: MetaMask connection for account management
- **Product Management**: Browse, buy, and sell digital products
- **Admin Controls**: Product deletion 
- **Transaction History**: Track all purchase and sale transactions
- **File Verification**: Verify purchased file integrity using NFT receipts
- **Real-time Sync**: Block listener for instant data updates
- **Responsive Design**: Mobile-friendly interface

## Smart Contract

- **Language**: Solidity
- **Network**: Sepolia Testnet
- **Contract**: ERC721-based Marketplace
- **Functions**: addProduct, buyProduct, deleteProduct, getProducts, getCategories

Reference contact code included in `marketContract.sol`.

## Getting Started

### Requirements
- Modern browser with MetaMask extension
- Ganache CLI/GUI

### Running Locally

1. Open a `live-server` in your terminal
2. Connect your MetaMask wallet
3. Browse, buy, or list products

No build step or installation required.

## File Structure

```
anonymark-dapp/
├── index.html          # Application layout
├── style.css           # Styling and responsive design
├── app.js              # Web3 logic and interactions
├── marketContract.sol  # Smart contract reference
└── README.md           # Documentation
```

## Technical Stack

- **Frontend**: Vanilla HTML5 + CSS3 + JavaScript
- **Web3 Library**: Ethers.js v6 (CDN)
- **Contract Interaction**: ABI-based contract calls
- **Data Storage**: Browser localStorage for history tracking
- **External API**: CoinGecko for ETH/EUR price conversion

## Implementation Notes

- File hashes are computed locally using keccak256
- No external file upload service required
- Transaction history stored in browser (localStorage)
- All private keys remain in MetaMask (never exposed)
