/**
 * Night City Blockchain Service
 * 
 * Interfaces with the local Ethereum blockchain (Ganache) running on chain ID 2077.
 * Used for credstick transactions - all payments are recorded on-chain.
 * 
 * In Night City, eurodollars are just tokens on the blockchain.
 * Every transaction is immutable, traceable, and permanent.
 * The megacorps can see everything... unless you know how to hide.
 */

import { ethers, JsonRpcProvider, Wallet, TransactionReceipt } from 'ethers';

// Night City Blockchain configuration
const BLOCKCHAIN_RPC = process.env.BLOCKCHAIN_RPC || 'http://localhost:8545';
const CHAIN_ID = 2077; // Night City's chain

// Ganache default accounts (deterministic from mnemonic)
// In production, these would be securely managed
const GANACHE_ACCOUNTS = [
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', // Account 0 - Fixer escrow
  '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d', // Account 1 - Ripperdoc escrow
  '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a', // Account 2 - Runner V
  '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6', // Account 3 - Runner Jackie
  '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a', // Account 4 - Trauma Team
];

// Account aliases for readability
export const ACCOUNTS = {
  FIXER_ESCROW: 0,
  RIPPERDOC_ESCROW: 1,
  RUNNER_V: 2,
  RUNNER_JACKIE: 3,
  TRAUMA_TEAM: 4,
};

let provider: JsonRpcProvider | null = null;
let wallets: Map<number, Wallet> = new Map();

/**
 * Initialize connection to Night City blockchain
 */
export async function initBlockchain(): Promise<void> {
  try {
    provider = new JsonRpcProvider(BLOCKCHAIN_RPC);
    const network = await provider.getNetwork();
    
    console.log(`[BLOCKCHAIN] Connected to Night City Chain (ID: ${network.chainId})`);
    
    // Initialize wallets
    for (let i = 0; i < GANACHE_ACCOUNTS.length; i++) {
      wallets.set(i, new Wallet(GANACHE_ACCOUNTS[i], provider));
    }
    
    const balance = await provider.getBalance(wallets.get(ACCOUNTS.RUNNER_V)!.address);
    console.log(`[BLOCKCHAIN] Runner V balance: €$${ethers.formatEther(balance)}`);
  } catch (error) {
    console.log(`[BLOCKCHAIN] ⚠ Could not connect to blockchain at ${BLOCKCHAIN_RPC}`);
    console.log(`[BLOCKCHAIN] ⚠ Running in simulation mode (no actual blockchain transactions)`);
    provider = null;
  }
}

/**
 * Get wallet for an account
 */
export function getWallet(accountIndex: number): Wallet | null {
  return wallets.get(accountIndex) || null;
}

/**
 * Get provider
 */
export function getProvider(): JsonRpcProvider | null {
  return provider;
}

/**
 * Check if blockchain is connected
 */
export function isBlockchainConnected(): boolean {
  return provider !== null;
}

/**
 * Record a credstick payment on the blockchain
 * 
 * @param fromAccount - Sender account index
 * @param toAccount - Recipient account index  
 * @param amountEurodollars - Amount in eurodollars
 * @param memo - Transaction memo (stored in data field)
 * @returns Transaction hash and receipt
 */
export async function recordPayment(
  fromAccount: number,
  toAccount: number,
  amountEurodollars: number,
  memo: string
): Promise<{ txHash: string; blockNumber: number; gasUsed: string }> {
  if (!provider) {
    // Simulation mode
    return {
      txHash: `0x${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`,
      blockNumber: Math.floor(Math.random() * 1000000),
      gasUsed: '21000',
    };
  }
  
  const fromWallet = wallets.get(fromAccount);
  const toWallet = wallets.get(toAccount);
  
  if (!fromWallet || !toWallet) {
    throw new Error('Invalid account index');
  }
  
  // Convert eurodollars to wei (1 ED = 0.001 ETH for our demo)
  const amountWei = ethers.parseEther((amountEurodollars / 1000).toString());
  
  // Encode memo in transaction data
  const memoHex = ethers.hexlify(ethers.toUtf8Bytes(memo));
  
  const tx = await fromWallet.sendTransaction({
    to: toWallet.address,
    value: amountWei,
    data: memoHex,
  });
  
  const receipt = await tx.wait();
  
  return {
    txHash: tx.hash,
    blockNumber: receipt!.blockNumber,
    gasUsed: receipt!.gasUsed.toString(),
  };
}

/**
 * Record a refund on the blockchain
 */
export async function recordRefund(
  fromAccount: number,
  toAccount: number,
  amountEurodollars: number,
  originalTxHash: string,
  reason: string
): Promise<{ txHash: string; blockNumber: number }> {
  const memo = `REFUND:${originalTxHash.slice(0, 10)}:${reason}`;
  const result = await recordPayment(fromAccount, toAccount, amountEurodollars, memo);
  return { txHash: result.txHash, blockNumber: result.blockNumber };
}

/**
 * Get account balance in eurodollars
 */
export async function getBalance(accountIndex: number): Promise<number> {
  if (!provider) {
    return 1000000; // Simulation mode
  }
  
  const wallet = wallets.get(accountIndex);
  if (!wallet) {
    throw new Error('Invalid account index');
  }
  
  const balanceWei = await provider.getBalance(wallet.address);
  const balanceEth = parseFloat(ethers.formatEther(balanceWei));
  
  // Convert ETH to eurodollars (1 ETH = 1000 ED)
  return balanceEth * 1000;
}

/**
 * Get transaction details
 */
export async function getTransaction(txHash: string): Promise<{
  from: string;
  to: string;
  value: string;
  memo: string;
  blockNumber: number;
} | null> {
  if (!provider) {
    return null;
  }
  
  const tx = await provider.getTransaction(txHash);
  if (!tx) return null;
  
  const receipt = await provider.getTransactionReceipt(txHash);
  
  let memo = '';
  try {
    if (tx.data && tx.data !== '0x') {
      memo = ethers.toUtf8String(tx.data);
    }
  } catch {
    memo = tx.data;
  }
  
  return {
    from: tx.from,
    to: tx.to || '',
    value: ethers.formatEther(tx.value),
    memo,
    blockNumber: receipt?.blockNumber || 0,
  };
}

/**
 * Get recent transactions for an account
 */
export async function getRecentBlocks(count: number = 5): Promise<number[]> {
  if (!provider) {
    return [];
  }
  
  const currentBlock = await provider.getBlockNumber();
  const blocks: number[] = [];
  
  for (let i = 0; i < count && currentBlock - i >= 0; i++) {
    blocks.push(currentBlock - i);
  }
  
  return blocks;
}
