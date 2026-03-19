/* AnonyMark Marketplace - Web3 Frontend */
// Ethers v6 integration with smart contract

// Contract Configuration
const DEFAULT_CONTRACT_ADDRESS = "0x854D1A9962f609EC89ACc63310fDda7621498577";
let contractAddress = localStorage.getItem("market_contract_address") || DEFAULT_CONTRACT_ADDRESS;

const ABI = [
    {
        "inputs": [
            { "internalType": "string", "name": "_name", "type": "string" },
            { "internalType": "uint256", "name": "_price", "type": "uint256" },
            { "internalType": "uint256", "name": "_stock", "type": "uint256" },
            { "internalType": "uint256", "name": "_categoryID", "type": "uint256" },
            { "internalType": "string", "name": "_ipfsCID", "type": "string" },
            { "internalType": "bytes32", "name": "_contentHash", "type": "bytes32" }
        ],
        "name": "addProduct",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "uint256", "name": "_id", "type": "uint256" }],
        "name": "buyProduct",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "uint256", "name": "_id", "type": "uint256" }],
        "name": "deleteProduct",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "admin",
        "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "uint256", "name": "tokenId", "type": "uint256" },
            { "internalType": "bytes32", "name": "contentHash", "type": "bytes32" }
        ],
        "name": "verifyContent",
        "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "anonymous": false,
        "inputs": [
            { "indexed": true, "internalType": "address", "name": "from", "type": "address" },
            { "indexed": true, "internalType": "address", "name": "to", "type": "address" },
            { "indexed": true, "internalType": "uint256", "name": "tokenId", "type": "uint256" }
        ],
        "name": "Transfer",
        "type": "event"
    },
    {
        "inputs": [],
        "name": "getAllCategoriesWithNames",
        "outputs": [
            { "internalType": "bytes32[]", "name": "", "type": "bytes32[]" },
            { "internalType": "enum Marketplace.Categories[]", "name": "", "type": "uint8[]" }
        ],
        "stateMutability": "pure",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "uint256", "name": "_id", "type": "uint256" }],
        "name": "getIndex",
        "outputs": [{ "internalType": "int256", "name": "", "type": "int256" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "getProducts",
        "outputs": [{
            "components": [
                { "internalType": "uint256", "name": "id", "type": "uint256" },
                { "internalType": "bytes32", "name": "name", "type": "bytes32" },
                { "internalType": "uint256", "name": "price", "type": "uint256" },
                { "internalType": "uint256", "name": "stock", "type": "uint256" },
                { "internalType": "address", "name": "seller", "type": "address" },
                { "internalType": "uint8", "name": "category", "type": "uint8" },
                { "internalType": "bytes32", "name": "ipfsCID", "type": "bytes32" },
                { "internalType": "bytes32", "name": "contentHash", "type": "bytes32" }
            ],
            "internalType": "struct Marketplace.Product[]",
            "name": "",
            "type": "tuple[]"
        }],
        "stateMutability": "view",
        "type": "function"
    }
]

const EMOJIS = ["🎮", "📷", "🎸", "🧢", "👟", "⌚", "💻", "📱", "🎨", "🧳", "🎧", "📚", "🛹", "🎯", "🏋️", "🌿", "💎", "🔭", "🚀", "🎺"];

function productEmoji(name) {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return EMOJIS[h % EMOJIS.length];
}

// Categories
const CATEGORIES = [
    { id: 0, name: "IT", emoji: "💻", color: "#3b82f6" },
    { id: 1, name: "Drug", emoji: "💊", color: "#22c55e" },
    { id: 2, name: "Weapon", emoji: "🔫", color: "#ef4444" },
    { id: 3, name: "Credentials", emoji: "🔑", color: "#f59e0b" },
    { id: 4, name: "Misc", emoji: "📦", color: "#8b5cf6" },
];

function categoryInfo(id) {
    return CATEGORIES[id] ?? { id, name: "Misc", emoji: "📦", color: "#8b5cf6" };
}

// State
let provider = null;
let signer = null;
let contract = null;
let userAddr = null;
let allProducts = [];
let pendingBuy = null;
let activeFilter = "all";
let activeCategoryFilter = null; // null = toutes catégories
let ethPriceEur = null;
let isAdmin = false;
let adminAddress = null;
let realtimeBlockHandler = null;
let realtimeRefreshTimer = null;
let realtimeRefreshInFlight = false;
let realtimeRefreshQueued = false;
let lastRealtimeRefreshAt = 0;
let realtimeBlockPollTimer = null;
let lastKnownBlockNumber = null;
let presenceChannel = null;
let presenceHeartbeatTimer = null;
let presenceSnapshotTimer = null;
const presenceTabId = `tab-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
const PRESENCE_STORAGE_KEY = "anonymark_presence_v1";
const PRESENCE_TTL_MS = 9000;
const PRESENCE_HEARTBEAT_MS = 2000;

// DOM References
const connectBtn = document.getElementById("connectBtn");
const connectText = document.getElementById("connectText");
const disconnectBtn = document.getElementById("disconnectBtn");
const historyBtn = document.getElementById("historyBtn");
const sellBtn = document.getElementById("openSellModal");
const refreshBtn = document.getElementById("refreshBtn");
const productGrid = document.getElementById("productGrid");
const emptyState = document.getElementById("emptyState");
const countBadge = document.getElementById("productCount");
const searchInput = document.getElementById("searchInput");
const walletInfo = document.getElementById("walletInfo");
const walletBalanceEl = document.getElementById("walletBalance");
const contractAddressInput = document.getElementById("contractAddressInput");
const saveContractBtn = document.getElementById("saveContractBtn");
const contractDrawer = document.getElementById("contractDrawer");
const diagNetwork = document.getElementById("diagNetwork");
const diagAddress = document.getElementById("diagAddress");
const headerRoleBadge = document.getElementById("headerRoleBadge");
const filterAllBtn = document.getElementById("filterAll");
const filterMineBtn = document.getElementById("filterMine");
const productCategorySelect = document.getElementById("productCategory");
const productFileInput = document.getElementById("productFile");
const fileUploadBox = document.getElementById("fileUploadBox");
const fileUploadName = document.getElementById("fileUploadName");
const sellFileMeta = document.getElementById("sellFileMeta");

const historyPanel = document.getElementById("historyPanel");
const historyList = document.getElementById("historyList");
const historyWalletTag = document.getElementById("historyWalletTag");
const closeHistoryBtn = document.getElementById("closeHistoryBtn");

const sellModal = document.getElementById("sellModal");
const closeSellBtn = document.getElementById("closeSellModal");
const sellForm = document.getElementById("sellForm");
const sellSubmit = document.getElementById("sellSubmit");
const sellBtnText = document.getElementById("sellBtnText");
const sellSpinner = document.getElementById("sellSpinner");
const sellEurPreview = document.getElementById("sellEurPreview");
const productPriceInput = document.getElementById("productPrice");
const sellUploadProgressWrap = document.getElementById("sellUploadProgressWrap");
const sellUploadProgressFill = document.getElementById("sellUploadProgressFill");
const sellUploadProgressPct = document.getElementById("sellUploadProgressPct");
const sellUploadProgressLabel = document.getElementById("sellUploadProgressLabel");

const buyModal = document.getElementById("buyModal");
const closeBuyBtn = document.getElementById("closeBuyModal");
const confirmBuyBtn = document.getElementById("confirmBuyBtn");
const buyBtnText = document.getElementById("buyBtnText");
const buySpinner = document.getElementById("buySpinner");
const buyProductName = document.getElementById("buyProductName");
const buyProductPrice = document.getElementById("buyProductPrice");

const toast = document.getElementById("toast");

// Utility Functions
function showToast(msg, type = "info", duration = 4000) {
    toast.textContent = msg;
    toast.className = `toast ${type}`;
    toast.classList.remove("hidden");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toast.classList.add("hidden"), duration);
}

function shortAddr(addr) {
    if (!addr) return "—";
    return addr.slice(0, 6) + "…" + addr.slice(-4);
}

function setLoading(btn, textEl, spinnerEl, loading, label) {
    btn.disabled = loading;
    textEl.textContent = loading ? (label || "En cours…") : textEl.dataset.default;
    spinnerEl.classList.toggle("hidden", !loading);
}

function getActiveContractAddress() {
    return contractAddress;
}

function updateHeaderWalletState(isConnected) {
    disconnectBtn.classList.toggle("hidden", !isConnected);
}

function setActiveFilter(filterKey) {
    activeFilter = filterKey;
    filterAllBtn.classList.toggle("active", activeFilter === "all");
    filterMineBtn.classList.toggle("active", activeFilter === "mine");
}

function setActiveCategoryFilter(catId) {
    activeCategoryFilter = catId; // null = toutes, sinon 0-4
    document.querySelectorAll(".cat-chip").forEach(btn => {
        const val = btn.dataset.cat === "" ? null : Number(btn.dataset.cat);
        btn.classList.toggle("active", val === catId);
    });
}

function syncContractAddressInput() {
    if (contractAddressInput) contractAddressInput.value = getActiveContractAddress();
}

function setDiag(el, text, kind = "") {
    if (!el) return;
    el.className = "diag-item diag-dot" + (kind ? ` ${kind}` : "");
    el.textContent = "";
    el.setAttribute("data-tip", text);
    el.removeAttribute("title");
    el.tabIndex = 0;
    el.setAttribute("aria-label", text);
}

function updateRoleDiag() {
    if (!headerRoleBadge) return;
    if (!userAddr) {
        headerRoleBadge.textContent = "Rôle: visiteur";
        headerRoleBadge.className = "role-badge role-guest";
        return;
    }
    if (isAdmin) {
        headerRoleBadge.textContent = "Rôle: admin";
        headerRoleBadge.className = "role-badge role-admin";
    } else {
        headerRoleBadge.textContent = "Rôle: utilisateur";
        headerRoleBadge.className = "role-badge role-user";
    }
}

function setSellUploadProgress(percent, label = "") {
    if (!sellUploadProgressWrap || !sellUploadProgressFill || !sellUploadProgressPct || !sellUploadProgressLabel) return;
    const safePct = Math.max(0, Math.min(100, Number(percent) || 0));
    sellUploadProgressWrap.classList.remove("hidden");
    sellUploadProgressFill.style.width = `${safePct}%`;
    sellUploadProgressPct.textContent = `${Math.round(safePct)}%`;
    if (label) sellUploadProgressLabel.textContent = label;
}

function resetSellUploadProgress() {
    if (!sellUploadProgressWrap || !sellUploadProgressFill || !sellUploadProgressPct || !sellUploadProgressLabel) return;
    sellUploadProgressWrap.classList.add("hidden");
    sellUploadProgressFill.style.width = "0%";
    sellUploadProgressPct.textContent = "0%";
    sellUploadProgressLabel.textContent = "Préparation du fichier…";
}

function animateSellUploadProgress(start = 8, max = 88, label = "Import du fichier…") {
    setSellUploadProgress(start, label);
    let value = start;
    const timer = setInterval(() => {
        value = Math.min(max, value + Math.max(1, Math.round((max - value) / 8)));
        setSellUploadProgress(value, label);
        if (value >= max) clearInterval(timer);
    }, 90);
    return timer;
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitNextPaint() {
    return new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
}

async function loadUserRole() {
    if (!contract || !userAddr) {
        isAdmin = false;
        adminAddress = null;
        updateRoleDiag();
        return;
    }
    try {
        if (typeof contract.admin === "function") {
            const admin = await contract.admin();
            adminAddress = admin;
            isAdmin = normalizeAddress(admin) === normalizeAddress(userAddr);
        } else {
            isAdmin = false;
            adminAddress = null;
        }
    } catch {
        isAdmin = false;
        adminAddress = null;
    }
    updateRoleDiag();
}

function stopRealtimeSync() {
    if (realtimeRefreshTimer) {
        clearTimeout(realtimeRefreshTimer);
        realtimeRefreshTimer = null;
    }
    if (realtimeBlockPollTimer) {
        clearInterval(realtimeBlockPollTimer);
        realtimeBlockPollTimer = null;
    }
    if (provider && realtimeBlockHandler) {
        provider.off("block", realtimeBlockHandler);
    }
    realtimeBlockHandler = null;
    realtimeRefreshQueued = false;
    realtimeRefreshInFlight = false;
    lastKnownBlockNumber = null;
}

async function runRealtimeRefresh() {
    if (!contract || !provider) return;

    if (realtimeRefreshInFlight) {
        realtimeRefreshQueued = true;
        return;
    }

    const now = Date.now();
    const minIntervalMs = 320;
    const waitMs = Math.max(0, minIntervalMs - (now - lastRealtimeRefreshAt));

    realtimeRefreshInFlight = true;
    try {
        if (waitMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, waitMs));
        }

        await Promise.allSettled([
            loadProducts({ silent: true, showSpinner: false }),
            updateWalletBalance()
        ]);

        lastRealtimeRefreshAt = Date.now();
    } finally {
        realtimeRefreshInFlight = false;
        if (realtimeRefreshQueued) {
            realtimeRefreshQueued = false;
            void runRealtimeRefresh();
        }
    }
}

function scheduleRealtimeRefresh() {
    if (!contract || !provider) return;
    if (realtimeRefreshTimer) clearTimeout(realtimeRefreshTimer);
    realtimeRefreshTimer = setTimeout(() => {
        realtimeRefreshTimer = null;
        void runRealtimeRefresh();
    }, 90);
}

function startRealtimeSync() {
    if (!provider || !contract) return;
    stopRealtimeSync();
    realtimeBlockHandler = (blockNumber) => {
        if (typeof blockNumber === "number") {
            lastKnownBlockNumber = blockNumber;
        }
        scheduleRealtimeRefresh();
    };
    provider.on("block", realtimeBlockHandler);
    void provider.getBlockNumber().then((blockNumber) => {
        lastKnownBlockNumber = blockNumber;
    }).catch(() => {
        lastKnownBlockNumber = null;
    });

    realtimeBlockPollTimer = setInterval(async () => {
        if (!provider || !contract) return;
        try {
            const blockNumber = await provider.getBlockNumber();
            if (lastKnownBlockNumber === null) {
                lastKnownBlockNumber = blockNumber;
                return;
            }
            if (blockNumber > lastKnownBlockNumber) {
                lastKnownBlockNumber = blockNumber;
                scheduleRealtimeRefresh();
            }
        } catch {
        }
    }, 850);

    scheduleRealtimeRefresh();
}

function decodeBytes32ToText(value) {
    if (!value) return "";
    if (typeof value !== "string") return String(value);
    if (!value.startsWith("0x") || value.length !== 66) return value;
    try {
        return ethers.decodeBytes32String(value);
    } catch {
        const hex = value.slice(2);
        let out = "";
        for (let i = 0; i < hex.length; i += 2) {
            const byte = parseInt(hex.slice(i, i + 2), 16);
            if (byte === 0) break;
            if (byte >= 32 && byte <= 126) {
                out += String.fromCharCode(byte);
            } else {
                try {
                    const decoded = ethers.toUtf8String("0x" + hex.slice(0, i + 2));
                    if (decoded) out = decoded;
                } catch {
                }
                break;
            }
        }
        return out || value;
    }
}

function shortHash(hash) {
    if (!hash || typeof hash !== "string") return "";
    return hash.slice(0, 10) + "…" + hash.slice(-8);
}

function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(2)} MB`;
}

async function computeFileHash(file) {
    const buffer = await file.arrayBuffer();
    return ethers.keccak256(new Uint8Array(buffer));
}

function normalizeAddress(addr) {
    try {
        return ethers.getAddress(addr).toLowerCase();
    } catch {
        return String(addr || "").toLowerCase();
    }
}

function isZeroAddress(addr) {
    return normalizeAddress(addr) === ethers.ZeroAddress.toLowerCase();
}

function readPresenceMap() {
    try {
        const raw = localStorage.getItem(PRESENCE_STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") return {};
        return parsed;
    } catch {
        return {};
    }
}

function writePresenceMap(map) {
    try {
        localStorage.setItem(PRESENCE_STORAGE_KEY, JSON.stringify(map));
    } catch {
    }
}

function prunePresenceMap(map) {
    const now = Date.now();
    let changed = false;
    const next = { ...map };
    Object.entries(next).forEach(([tabId, row]) => {
        const ts = Number(row?.ts || 0);
        if (!ts || now - ts > PRESENCE_TTL_MS) {
            delete next[tabId];
            changed = true;
        }
    });
    return { map: next, changed };
}

function countConnectedUsers(map) {
    let sessions = 0;
    Object.values(map).forEach((row) => {
        const addr = normalizeAddress(row?.addr || "");
        if (addr && addr !== normalizeAddress(ethers.ZeroAddress)) {
            sessions += 1;
        }
    });
    return sessions;
}

function renderOnlineUsers() {
}

function broadcastPresencePing() {
    if (!presenceChannel) return;
    try {
        presenceChannel.postMessage({ type: "presence:ping", tabId: presenceTabId, t: Date.now() });
    } catch {
    }
}

function refreshOnlineUsersBadge() {
    const raw = readPresenceMap();
    const { map, changed } = prunePresenceMap(raw);
    if (changed) writePresenceMap(map);
    renderOnlineUsers(countConnectedUsers(map));
}

function upsertMyPresence() {
    const raw = readPresenceMap();
    const { map } = prunePresenceMap(raw);

    if (userAddr) {
        map[presenceTabId] = {
            addr: normalizeAddress(userAddr),
            ts: Date.now()
        };
    } else {
        delete map[presenceTabId];
    }

    writePresenceMap(map);
    refreshOnlineUsersBadge();
    broadcastPresencePing();
}

function removeMyPresence() {
    const map = readPresenceMap();
    if (map[presenceTabId]) {
        delete map[presenceTabId];
        writePresenceMap(map);
    }
    refreshOnlineUsersBadge();
    broadcastPresencePing();
}

function startPresenceSync() {
    if (presenceHeartbeatTimer) clearInterval(presenceHeartbeatTimer);
    if (presenceSnapshotTimer) clearInterval(presenceSnapshotTimer);

    if (!presenceChannel && typeof BroadcastChannel !== "undefined") {
        try {
            presenceChannel = new BroadcastChannel("anonymark_presence_channel");
            presenceChannel.onmessage = () => {
                refreshOnlineUsersBadge();
            };
        } catch {
            presenceChannel = null;
        }
    }

    upsertMyPresence();
    presenceHeartbeatTimer = setInterval(() => {
        upsertMyPresence();
    }, PRESENCE_HEARTBEAT_MS);

    presenceSnapshotTimer = setInterval(() => {
        refreshOnlineUsersBadge();
    }, 1200);
}

function stopPresenceSync() {
    if (presenceHeartbeatTimer) {
        clearInterval(presenceHeartbeatTimer);
        presenceHeartbeatTimer = null;
    }
    if (presenceSnapshotTimer) {
        clearInterval(presenceSnapshotTimer);
        presenceSnapshotTimer = null;
    }
    removeMyPresence();
}

async function watchReceiptNftInWallet(tokenId) {
    if (!window.ethereum || tokenId === null || tokenId === undefined) {
        return { attempted: false, added: false, reason: "NO_WALLET_OR_TOKEN" };
    }
    try {
        const watched = await window.ethereum.request({
            method: "wallet_watchAsset",
            params: {
                type: "ERC721",
                options: {
                    address: getActiveContractAddress(),
                    tokenId: String(tokenId),
                    symbol: "MPR"
                }
            }
        });
        return { attempted: true, added: Boolean(watched), reason: watched ? "ADDED" : "ALREADY_TRACKED_OR_IGNORED" };
    } catch (e) {
        return { attempted: true, added: false, reason: e?.code || e?.message || "WATCH_FAILED" };
    }
}

async function extractMintedTokenIdFromReceipt(receipt) {
    const receiptHash = receipt?.hash || receipt?.transactionHash;

    for (const log of receipt?.logs || []) {
        try {
            const parsed = contract.interface.parseLog(log);
            if (!parsed || parsed.name !== "Transfer") continue;

            const from = parsed.args?.from;
            const to = parsed.args?.to;
            if (isZeroAddress(from) && normalizeAddress(to) === normalizeAddress(userAddr)) {
                return Number(parsed.args.tokenId);
            }
        } catch {
        }
    }

    try {
        const evts = await contract.queryFilter(
            contract.filters.Transfer(ethers.ZeroAddress, userAddr),
            receipt.blockNumber,
            receipt.blockNumber
        );
        const matched = evts.find((evt) => (evt.transactionHash || evt.log?.transactionHash) === receiptHash) || evts[0];
        if (matched?.args?.tokenId !== undefined) {
            return Number(matched.args.tokenId);
        }
    } catch {
    }

    return null;
}

async function uploadToIPFS(file, precomputedHash = "") {
    const suffix = precomputedHash ? precomputedHash.slice(2, 18) : Date.now().toString(16);
    return `local://${file.name.replace(/\s+/g, "_")}-${suffix}`;
}

function refreshCategoryLabelsUI() {
    document.querySelectorAll(".cat-chip").forEach((btn) => {
        if (btn.dataset.cat === "") {
            btn.textContent = "Toutes catégories";
            return;
        }
        const cat = categoryInfo(Number(btn.dataset.cat));
        btn.textContent = `${cat.emoji} ${cat.name}`;
    });

    if (productCategorySelect) {
        [...productCategorySelect.options].forEach((opt) => {
            const cat = categoryInfo(Number(opt.value));
            opt.textContent = `${cat.emoji} ${cat.name}`;
        });
    }
}

async function loadCategoriesFromContract() {
    if (!contract || typeof contract.getAllCategoriesWithNames !== "function") return;
    try {
        const res = await contract.getAllCategoriesWithNames();
        const names = res?.[0] || [];
        for (let i = 0; i < names.length; i++) {
            if (CATEGORIES[i]) {
                const decoded = decodeBytes32ToText(names[i]);
                if (decoded) CATEGORIES[i].name = decoded;
            }
        }
        refreshCategoryLabelsUI();
    } catch (e) {
        console.warn("Impossible de charger les catégories on-chain:", e);
    }
}

function formatEurFromEth(ethValue) {
    if (ethPriceEur === null || Number.isNaN(ethValue)) return null;
    return (ethValue * ethPriceEur).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

function formatEur(wei) {
    if (ethPriceEur === null || wei === undefined) return null;
    return formatEurFromEth(parseFloat(ethers.formatEther(wei)));
}

async function fetchEthPrice() {
    try {
        const resp = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=eur");
        const data = await resp.json();
        ethPriceEur = data?.ethereum?.eur ?? null;
    } catch (e) {
        console.warn("Cours ETH/EUR indisponible:", e);
        ethPriceEur = null;
    }
}

async function updateWalletBalance() {
    if (!provider || !userAddr || !walletBalanceEl) return;
    try {
        const balWei = await provider.getBalance(userAddr);
        const balEthFloat = parseFloat(ethers.formatEther(balWei));
        const balEth = balEthFloat.toFixed(4);
        const balEur = formatEurFromEth(balEthFloat);
        walletBalanceEl.textContent = `${balEth} ETH${balEur ? ` · ${balEur}` : ""}`;
    } catch (e) {
        console.warn("Balance fetch error:", e);
    }
}

function getHistoryKey(addr) {
    return `market_history_${addr.toLowerCase()}`;
}

function loadHistory() {
    if (!userAddr) return [];
    return JSON.parse(localStorage.getItem(getHistoryKey(userAddr)) || "[]");
}

function pushToHistory(entry) {
    if (!userAddr) return;
    const hist = loadHistory();
    hist.unshift(entry);
    if (hist.length > 200) hist.pop();
    localStorage.setItem(getHistoryKey(userAddr), JSON.stringify(hist));
}

function renderHistory() {
    if (!historyList) return;
    const hist = loadHistory();
    if (historyWalletTag) historyWalletTag.textContent = `Wallet : ${userAddr}`;

    if (hist.length === 0) {
        historyList.innerHTML = '<p class="history-empty">⚠️ Aucune transaction enregistrée pour ce wallet.<br/><small>Seules les transactions effectuées via cette interface sont sauvegardées.</small></p>';
        return;
    }

    historyList.innerHTML = hist.map((tx) => {
        const date = new Date(tx.timestamp).toLocaleString("fr-FR");
        const typeLabel = tx.type === "buy" ? "🛒 Achat" : "🏷 Vente";
        const typeClass = tx.type === "buy" ? "hist-buy" : "hist-sell";
        const eurLine = tx.priceEur ? `<span class="hist-eur">≈ ${tx.priceEur}</span>` : "";
        const catLine = tx.category ? `<span class="hist-cat">${tx.category}</span>` : "";
        const receiptLine = Number.isInteger(tx.tokenId) ? `<span class="hist-receipt">NFT #${tx.tokenId}</span>` : "";
        const txLink = tx.txHash
            ? `<a class="hist-tx" href="https://sepolia.etherscan.io/tx/${tx.txHash}" target="_blank" rel="noopener">↗ ${tx.txHash.slice(0, 14)}…</a>`
            : "";

        return `<div class="hist-item ${typeClass}">
          <div class="hist-top">
            <span class="hist-type">${typeLabel}</span>
            <span class="hist-date">${date}</span>
          </div>
                    ${receiptLine}
          <div class="hist-name-row"><p class="hist-name">${tx.name}</p>${catLine}</div>
          <div class="hist-price"><span>${tx.priceEth} ETH</span>${eurLine}</div>
          ${txLink}
        </div>`;
    }).join("");
}

async function updateNetworkDiag() {
    if (!provider) {
        setDiag(diagNetwork, "Réseau: non connecté", "warn");
        return;
    }
    const network = await provider.getNetwork();
    setDiag(diagNetwork, `Réseau: ${network.name} (chainId ${network.chainId})`, "ok");
}

async function ensureContractIsDeployed() {
    const code = await provider.getCode(getActiveContractAddress());
    if (!code || code === "0x") throw new Error("NO_CONTRACT_CODE");
    return code;
}

// Wallet Connection
async function connectWallet() {
    if (!window.ethereum) {
        showToast("MetaMask non détecté. Installez l'extension MetaMask.", "error");
        return;
    }

    try {
        provider = new ethers.BrowserProvider(window.ethereum);

        let accounts = [];
        try {
            await provider.send("wallet_requestPermissions", [{ eth_accounts: {} }]);
            accounts = await provider.send("eth_accounts", []);
        } catch (permErr) {
            const code = permErr?.code;
            const unsupported = code === -32601 || code === 4200 || /unsupported|not found|not support/i.test(String(permErr?.message || ""));
            if (!unsupported && code !== 4001) throw permErr;
        }

        if (!accounts || accounts.length === 0) {
            accounts = await provider.send("eth_requestAccounts", []);
        }

        if (!accounts || accounts.length === 0) {
            throw new Error("NO_ACCOUNT_SELECTED");
        }

        signer = await provider.getSigner(accounts[0]);
        userAddr = accounts[0];
        await updateNetworkDiag();

        contract = new ethers.Contract(getActiveContractAddress(), ABI, signer);
        await loadCategoriesFromContract();
        await loadUserRole();

        connectText.textContent = shortAddr(userAddr);
        connectBtn.classList.add("connected");
        connectBtn.title = "Changer de compte MetaMask";
        updateHeaderWalletState(true);
        sellBtn.disabled = false;
        if (walletInfo) walletInfo.classList.remove("hidden");

        await fetchEthPrice();
        await updateWalletBalance();
        clearInterval(window._ethPriceInterval);
        window._ethPriceInterval = setInterval(async () => {
            await fetchEthPrice();
            await updateWalletBalance();
            renderProducts(getVisibleProducts());
        }, 5 * 60 * 1000);

        showToast(`Connecté : ${shortAddr(userAddr)}`, "success");
        await loadProducts();
        startRealtimeSync();

        window.ethereum.removeListener("accountsChanged", handleAccountChange);
        window.ethereum.removeAllListeners?.("chainChanged");
        window.ethereum.on("accountsChanged", handleAccountChange);
        window.ethereum.on("chainChanged", () => {
            stopRealtimeSync();
            window.location.reload();
        });
    } catch (err) {
        console.error(err);
        const errMsg = String(err?.message || err?.reason || "");
        if (err?.code === 4001 || err?.code === "ACTION_REJECTED") {
            showToast("Connexion MetaMask refusée.", "error");
        } else if (String(err?.message || "") === "NO_ACCOUNT_SELECTED") {
            showToast("Aucun compte sélectionné dans MetaMask.", "error");
        } else if (err?.code === -32002 || /too many errors|could not coalesce error|RPC endpoint returned too many errors/i.test(errMsg)) {
            showToast("RPC MetaMask saturé: ouvrez MetaMask > Réseau > remplacez le RPC par un endpoint stable, puis reconnectez.", "error", 9000);
        } else {
            showToast("Connexion MetaMask impossible. Vérifiez que l'extension est déverrouillée.", "error", 6000);
        }
    }
}

async function handleAccountChange(accounts) {
    if (accounts.length === 0) {
        disconnect();
    } else {
        userAddr = accounts[0];
        signer = await provider.getSigner();
        contract = new ethers.Contract(getActiveContractAddress(), ABI, signer);
        await loadUserRole();
        connectText.textContent = shortAddr(userAddr);
        await updateWalletBalance();
        showToast(`Compte changé : ${shortAddr(userAddr)}`, "info");
        await loadProducts();
        startRealtimeSync();
    }
}

function disconnect() {
    stopRealtimeSync();
    provider = signer = contract = userAddr = null;
    isAdmin = false;
    adminAddress = null;
    connectText.textContent = "Connecter MetaMask";
    connectBtn.classList.remove("connected");
    connectBtn.title = "";
    updateHeaderWalletState(false);
    setActiveFilter("all");
    sellBtn.disabled = true;
    if (walletInfo) walletInfo.classList.add("hidden");
    if (walletBalanceEl) walletBalanceEl.textContent = "— ETH · — €";
    clearInterval(window._ethPriceInterval);
    allProducts = [];
    renderProducts([]);
    document.getElementById("chainCountVal").textContent = "—";
    setDiag(diagNetwork, "Réseau: non connecté", "warn");
    setDiag(diagAddress, "Contrat: non vérifié", "warn");
    updateRoleDiag();
    setActiveCategoryFilter(null);
}

// Product Loading
async function loadProducts(options = {}) {
    const { silent = false, showSpinner = true } = options;

    if (!contract) {
        if (!silent) showToast("Connectez d'abord votre wallet.", "error");
        return;
    }

    if (showSpinner) refreshBtn.classList.add("spin");

    try {
        const code = await ensureContractIsDeployed();
        const codeBytes = Math.max(0, (code.length - 2) / 2);
        setDiag(diagAddress, `Contrat: bytecode détecté (${codeBytes} bytes)`, "ok");

        const raw = await contract.getProducts();
        const rows = Array.isArray(raw) ? raw : [];
        const total = rows.length;
        document.getElementById("chainCountVal").textContent = total;

        allProducts = rows.map((product) => ({
            id: Number(product.id ?? product[0]),
            name: decodeBytes32ToText(product.name ?? product[1]),
            price: product.price ?? product[2],
            stock: Number(product.stock ?? product[3]),
            seller: product.seller ?? product[4],
            category: Number(product.category ?? product[5]),
            ipfsCID: decodeBytes32ToText(product.ipfsCID ?? product[6]),
            contentHash: product.contentHash ?? product[7]
        })).filter((p) => p.seller !== ethers.ZeroAddress && p.name !== "");

        renderProducts(getVisibleProducts());
    } catch (err) {
        console.error(err);
        const errMsg = String(err?.message || err?.reason || "");
        if (err.message === "NO_CONTRACT_CODE") {
            document.getElementById("chainCountVal").textContent = "—";
            setDiag(diagAddress, "Contrat: aucun bytecode à cette adresse", "err");
            if (!silent) showToast("Aucun contrat à cette adresse sur CE réseau MetaMask.", "error", 8000);
        } else if (err?.code === -32002 || /too many errors|could not coalesce error|RPC endpoint returned too many errors/i.test(errMsg)) {
            setDiag(diagAddress, "Contrat: RPC saturé côté wallet", "err");
            if (!silent) showToast("RPC du réseau MetaMask saturé. Changez l'URL RPC du réseau, puis cliquez Rafraîchir.", "error", 9000);
        } else if (err.code === "BAD_DATA") {
            setDiag(diagAddress, "Contrat: ABI/réseau incompatible", "err");
            if (!silent) showToast("Réponse 0x — mauvais réseau ou mauvaise adresse.", "error", 8000);
        } else {
            setDiag(diagAddress, "Contrat: erreur de lecture", "err");
            if (!silent) showToast("Impossible de charger les produits : " + (err.reason || err.message || ""), "error");
        }
    } finally {
        if (showSpinner) refreshBtn.classList.remove("spin");
    }
}

// Filter Logic
function filterProducts(query) {
    if (!query.trim()) return allProducts;
    const q = query.toLowerCase();
    return allProducts.filter((p) => p.name.toLowerCase().includes(q));
}

function getVisibleProducts() {
    let filtered = filterProducts(searchInput.value);

    if (activeFilter === "mine" && userAddr) {
        filtered = filtered.filter((p) => p.seller.toLowerCase() === userAddr.toLowerCase());
    }

    if (activeCategoryFilter !== null) {
        filtered = filtered.filter((p) => p.category === activeCategoryFilter);
    }

    return filtered;
}

// Rendering
function renderProducts(products) {
    [...productGrid.querySelectorAll(".card")].forEach((c) => c.remove());

    countBadge.textContent = `${products.length} produit${products.length !== 1 ? "s" : ""} affiché${products.length !== 1 ? "s" : ""}`;

    if (products.length === 0) {
        emptyState.classList.remove("hidden");
        return;
    }

    emptyState.classList.add("hidden");

    products.forEach((p) => {
        const ethPrice = ethers.formatEther(p.price);
        const eurPrice = formatEur(p.price);
        const stockClass = p.stock === 0 ? "out" : p.stock <= 2 ? "low" : "";
        const stockLabel = p.stock === 0 ? "Épuisé" : `Stock : ${p.stock}`;
        const isMine = userAddr && p.seller.toLowerCase() === userAddr.toLowerCase();
        const canDelete = Boolean(userAddr) && (isAdmin || isMine);
        const cat = categoryInfo(p.category);

        const card = document.createElement("div");
        card.className = "card";
        card.innerHTML = `
      <div class="card-image">
        <span style="z-index:1">${productEmoji(p.name)}</span>
        <span class="cat-badge" style="--cat-color:${cat.color}" title="Catégorie : ${cat.name}">${cat.emoji} ${cat.name}</span>
      </div>
      <div class="card-body">
        <p class="card-name" title="${p.name}">${p.name}</p>
        <div class="card-meta">
          <span class="card-price">${parseFloat(ethPrice).toFixed(4)} ETH${eurPrice ? `<span class="card-price-eur">≈ ${eurPrice}</span>` : ""}</span>
          <span class="card-stock ${stockClass}">${stockLabel}</span>
        </div>
        <p class="card-seller" title="${p.seller}">
                    ${isMine ? "🟢 Votre article" : "Vendeur : " + shortAddr(p.seller)}
        </p>
            ${canDelete ? `<button class="btn-delete" data-delete-id="${p.id}" title="${isAdmin && !isMine ? "Supprimer (admin)" : "Supprimer mon produit"}" aria-label="Supprimer ce produit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14H6L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4h6v2"></path></svg></button>` : ""}
                    <button class="btn-buy"
                        data-id="${p.id}"
                        data-name="${p.name}"
                        data-price="${p.price.toString()}"
                        data-category="${p.category}"
                        ${p.stock === 0 || isMine || !userAddr ? "disabled" : ""}
                        ${!userAddr ? 'title="Connectez votre wallet"' : ""}
                        ${isMine ? 'title="Vous ne pouvez pas acheter votre propre article"' : ""}
                    >
                        ${isMine ? "Votre article" : p.stock === 0 ? "Épuisé" : "Acheter"}
                    </button>
      </div>
    `;

        productGrid.appendChild(card);
    });
}

async function deleteProductFromMarketplace(productId) {
    if (!contract || !userAddr) {
        showToast("Connectez votre wallet pour supprimer un produit.", "error");
        return;
    }

    const target = allProducts.find((product) => product.id === productId);
    if (!target) {
        showToast("Produit introuvable.", "error");
        return;
    }

    const mine = target.seller?.toLowerCase() === userAddr.toLowerCase();
    if (!mine && !isAdmin) {
        showToast("Suppression refusée : réservé au vendeur ou à l'admin.", "error");
        return;
    }

    const allowedLabel = isAdmin && !mine ? "admin" : "vendeur";
    const ok = window.confirm(`Supprimer \"${target.name}\" ? (${allowedLabel})`);
    if (!ok) return;

    try {
        showToast("Suppression en cours…", "info", 4000);
        const tx = await contract.deleteProduct(productId);
        await tx.wait();
        showToast(`Produit \"${target.name}\" supprimé.`, "success", 4500);
        await loadProducts();
    } catch (err) {
        console.error(err);
        if (err.code === 4001 || err.code === "ACTION_REJECTED") {
            showToast("Suppression annulée.", "error");
        } else {
            showToast("Échec suppression : " + (err.reason || err.message || "inconnue"), "error", 7000);
        }
    }
}

// Buy Flow
productGrid.addEventListener("click", (e) => {
    const deleteBtn = e.target.closest(".btn-delete");
    if (deleteBtn) {
        const id = Number(deleteBtn.dataset.deleteId);
        if (!Number.isInteger(id)) return;
        deleteProductFromMarketplace(id);
        return;
    }

    const btn = e.target.closest(".btn-buy");
    if (!btn || btn.disabled) return;

    pendingBuy = {
        id: Number(btn.dataset.id),
        name: btn.dataset.name,
        priceWei: BigInt(btn.dataset.price),
        category: Number(btn.dataset.category)
    };

    const cat = categoryInfo(pendingBuy.category);
    buyProductName.textContent = pendingBuy.name;
    const buyEur = formatEur(pendingBuy.priceWei);
    buyProductPrice.textContent = parseFloat(ethers.formatEther(pendingBuy.priceWei)).toFixed(6) + " ETH" + (buyEur ? ` ≈ ${buyEur}` : "");
    const catTagEl = document.getElementById("buyProductCategory");
    if (catTagEl) { catTagEl.textContent = `${cat.emoji} ${cat.name}`; catTagEl.style.setProperty("--cat-color", cat.color); catTagEl.className = "buy-cat-tag"; }
    buyModal.classList.remove("hidden");
});

confirmBuyBtn.addEventListener("click", async () => {
    if (!pendingBuy) return;

    buyBtnText.dataset.default = buyBtnText.textContent;
    setLoading(confirmBuyBtn, buyBtnText, buySpinner, true, "Transaction en cours…");

    try {
        const tx = await contract.buyProduct(pendingBuy.id, {
            value: pendingBuy.priceWei
        });
        showToast("Transaction soumise — en attente de confirmation…", "info", 8000);

        const receipt = await tx.wait();
        const mintedTokenId = await extractMintedTokenIdFromReceipt(receipt);

        pushToHistory({
            type: "buy",
            name: pendingBuy.name,
            priceEth: parseFloat(ethers.formatEther(pendingBuy.priceWei)).toFixed(6),
            priceEur: formatEur(pendingBuy.priceWei),
            category: categoryInfo(pendingBuy.category).name,
            tokenId: mintedTokenId,
            txHash: tx.hash,
            timestamp: Date.now()
        });

        await updateWalletBalance();

        if (mintedTokenId !== null) {
            watchReceiptNftInWallet(mintedTokenId).then((result) => {
                if (result.added) {
                    showToast(`NFT #${mintedTokenId} ajouté automatiquement au wallet.`, "success", 4500);
                } else {
                    showToast(`NFT #${mintedTokenId} minté on-chain. S'il n'apparaît pas, ouvrez MetaMask > NFTs puis actualisez.`, "info", 6500);
                }
            });
        } else {
            showToast("Achat validé, mais token NFT non détecté dans les logs. Réessayez après actualisation.", "info", 7000);
        }

        showToast(`Achat réussi : ${pendingBuy.name}${mintedTokenId !== null ? ` · Reçu NFT #${mintedTokenId}` : ""} 🎉`, "success", 6000);
        buyModal.classList.add("hidden");
        pendingBuy = null;
        await loadProducts();
    } catch (err) {
        console.error(err);
        if (err.code === 4001 || err.code === "ACTION_REJECTED") {
            showToast("Transaction refusée par l'utilisateur.", "error");
        } else {
            showToast("Erreur : " + (err.reason || err.message || "inconnue"), "error", 6000);
        }
    } finally {
        setLoading(confirmBuyBtn, buyBtnText, buySpinner, false);
    }
});

// Sell Flow
sellForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("productName").value.trim();
    const file = productFileInput?.files?.[0] || null;
    const price = document.getElementById("productPrice").value;
    const stock = parseInt(document.getElementById("productStock").value);
    const categoryId = parseInt(productCategorySelect ? productCategorySelect.value : "4");

    if (!name || !file || !price || !stock) {
        showToast("Veuillez remplir tous les champs (nom, fichier, prix, stock).", "error");
        return;
    }

    let priceWei;
    try {
        priceWei = ethers.parseEther(price);
    } catch {
        showToast("Prix invalide.", "error");
        return;
    }

    sellBtnText.dataset.default = sellBtnText.textContent;
    setLoading(sellSubmit, sellBtnText, sellSpinner, true, "Publication…");

    try {
        showToast("Préparation du fichier…", "info", 2500);
        const contentHash = await computeFileHash(file);

        showToast("Import du fichier en cours…", "info", 4000);
        const ipfsCid = await uploadToIPFS(file, contentHash);

        if (ipfsCid.startsWith("local://")) {
            showToast("Mode local automatique: CID généré pour la traçabilité.", "info", 4500);
        }

        const tx = await contract.addProduct(name, priceWei, stock, categoryId, ipfsCid, contentHash);
        showToast("Transaction soumise…", "info", 8000);
        await tx.wait();

        pushToHistory({
            type: "sell",
            name,
            priceEth: parseFloat(ethers.formatEther(priceWei)).toFixed(6),
            priceEur: formatEur(priceWei),
            category: categoryInfo(categoryId).name,
            fileName: file.name,
            ipfsCid: `${ipfsCid.slice(0, 14)}…`,
            contentHash: shortHash(contentHash),
            txHash: tx.hash,
            timestamp: Date.now()
        });

        await updateWalletBalance();

        showToast(`Produit "${name}" publié avec succès !`, "success", 5000);
        sellForm.reset();
        if (fileUploadName) fileUploadName.textContent = "Aucun fichier sélectionné";
        if (fileUploadBox) fileUploadBox.classList.remove("has-file");
        if (sellEurPreview) sellEurPreview.classList.add("hidden");
        if (sellFileMeta) sellFileMeta.classList.add("hidden");
        resetSellUploadProgress();
        sellModal.classList.add("hidden");
        await loadProducts();
    } catch (err) {
        console.error(err);
        if (err.code === 4001 || err.code === "ACTION_REJECTED") {
            showToast("Transaction refusée.", "error");
        } else if (String(err?.message || "") === "IPFS_UPLOAD_FAILED") {
            showToast("Upload impossible.", "error", 7000);
        } else {
            showToast("Erreur : " + (err.reason || err.message || "inconnue"), "error", 6000);
        }
    } finally {
        setLoading(sellSubmit, sellBtnText, sellSpinner, false);
    }
});

// Modal Management
sellBtn.addEventListener("click", () => sellModal.classList.remove("hidden"));
closeSellBtn.addEventListener("click", () => {
    resetSellUploadProgress();
    sellModal.classList.add("hidden");
});
sellModal.addEventListener("click", (e) => {
    if (e.target === sellModal) {
        resetSellUploadProgress();
        sellModal.classList.add("hidden");
    }
});

closeBuyBtn.addEventListener("click", () => { buyModal.classList.add("hidden"); pendingBuy = null; });
buyModal.addEventListener("click", (e) => { if (e.target === buyModal) { buyModal.classList.add("hidden"); pendingBuy = null; } });

// Search & Filters
searchInput.addEventListener("input", () => {
    renderProducts(getVisibleProducts());
});

filterAllBtn.addEventListener("click", () => {
    setActiveFilter("all");
    renderProducts(getVisibleProducts());
});

filterMineBtn.addEventListener("click", () => {
    if (!userAddr) {
        showToast("Connectez votre wallet pour voir vos produits.", "error");
        return;
    }
    setActiveFilter("mine");
    renderProducts(getVisibleProducts());
});

// Category Filters
document.querySelectorAll(".cat-chip").forEach(btn => {
    btn.addEventListener("click", () => {
        const val = btn.dataset.cat === "" ? null : Number(btn.dataset.cat);
        setActiveCategoryFilter(val);
        renderProducts(getVisibleProducts());
    });
});

// History Panel
if (historyBtn) {
    historyBtn.addEventListener("click", () => {
        if (!userAddr) {
            showToast("Connectez votre wallet pour voir l'historique.", "error");
            return;
        }
        renderHistory();
        historyPanel.classList.remove("hidden");
    });
}

if (closeHistoryBtn) {
    closeHistoryBtn.addEventListener("click", () => historyPanel.classList.add("hidden"));
}

// History Tabs
document.querySelectorAll(".hist-tab").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".hist-tab").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const tab = btn.dataset.tab;
        document.getElementById("histTabTxs").classList.toggle("hidden", tab !== "txs");
        document.getElementById("histTabVerify").classList.toggle("hidden", tab !== "verify");
    });
});

// NFT Verification
const verifyNftBtn = document.getElementById("verifyNftBtn");
const verifyTokenId = document.getElementById("verifyTokenId");
const verifyFile = document.getElementById("verifyFile");
const verifyResult = document.getElementById("verifyResult");

if (verifyNftBtn) {
    verifyNftBtn.addEventListener("click", async () => {
        if (!contract) {
            showToast("Connectez votre wallet pour vérifier.", "error");
            return;
        }

        const tokenIdRaw = verifyTokenId?.value;
        const file = verifyFile?.files?.[0];

        if (tokenIdRaw === "" || tokenIdRaw === undefined || !file) {
            showToast("Entrez un token ID et sélectionnez un fichier.", "error");
            return;
        }

        const tokenId = Number(tokenIdRaw);
        if (!Number.isInteger(tokenId) || tokenId < 0) {
            showToast("Token ID invalide.", "error");
            return;
        }

        verifyNftBtn.disabled = true;
        verifyNftBtn.textContent = "Vérification…";
        verifyResult.classList.add("hidden");

        try {
            const hash = await computeFileHash(file);
            const isValid = await contract.verifyContent(tokenId, hash);

            verifyResult.classList.remove("hidden", "verify-ok", "verify-fail");
            if (isValid) {
                verifyResult.className = "verify-result verify-ok";
                verifyResult.innerHTML = `<strong>✅ Fichier authentifié</strong><br/>
                    L'empreinte correspond au hash enregistré on-chain pour le reçu NFT #${tokenId}.<br/>
                    <code style="font-size:.75rem;word-break:break-all">${shortHash(hash)}</code>`;
            } else {
                verifyResult.className = "verify-result verify-fail";
                verifyResult.innerHTML = `<strong>❌ Fichier non authentifié</strong><br/>
                    L'empreinte ne correspond pas au hash stocké pour le NFT #${tokenId}.<br/>
                    <code style="font-size:.75rem;word-break:break-all">${shortHash(hash)}</code>`;
            }
        } catch (err) {
            verifyResult.classList.remove("hidden", "verify-ok");
            verifyResult.className = "verify-result verify-fail";
            verifyResult.innerHTML = `<strong>Erreur : </strong> ${err.reason || err.message || "inconnue"}`;
        } finally {
            verifyNftBtn.disabled = false;
            verifyNftBtn.textContent = "Vérifier l'intégrité";
        }
    });
}

if (historyPanel) {
    historyPanel.addEventListener("click", (e) => {
        if (e.target === historyPanel) historyPanel.classList.add("hidden");
    });
}

// EUR Price Preview
if (productPriceInput && sellEurPreview) {
    productPriceInput.addEventListener("input", () => {
        const val = parseFloat(productPriceInput.value);
        const eur = formatEurFromEth(val);
        if (!Number.isNaN(val) && val > 0 && eur) {
            sellEurPreview.textContent = `≈ ${eur}`;
            sellEurPreview.classList.remove("hidden");
        } else {
            sellEurPreview.classList.add("hidden");
        }
    });
}

if (productFileInput && sellFileMeta) {
    productFileInput.addEventListener("change", async () => {
        const file = productFileInput.files?.[0];
        if (!file) {
            if (fileUploadName) fileUploadName.textContent = "Aucun fichier sélectionné";
            if (fileUploadBox) fileUploadBox.classList.remove("has-file");
            sellFileMeta.classList.add("hidden");
            resetSellUploadProgress();
            return;
        }

        if (fileUploadName) fileUploadName.textContent = file.name;
        if (fileUploadBox) fileUploadBox.classList.add("has-file");

        sellFileMeta.textContent = `${file.name} · ${formatBytes(file.size)} · hash en cours…`;
        sellFileMeta.classList.remove("hidden");

        const progressTimer = animateSellUploadProgress(10, 86, "Import du fichier…");
        const progressStartedAt = Date.now();

        try {
            await waitNextPaint();
            const hash = await computeFileHash(file);

            const minVisibleMs = 950;
            const elapsedMs = Date.now() - progressStartedAt;
            if (elapsedMs < minVisibleMs) {
                await sleep(minVisibleMs - elapsedMs);
            }

            clearInterval(progressTimer);
            setSellUploadProgress(100, "Fichier prêt ✅");
            sellFileMeta.textContent = `${file.name} · ${formatBytes(file.size)} · ${shortHash(hash)}`;
        } catch {
            const minVisibleMs = 700;
            const elapsedMs = Date.now() - progressStartedAt;
            if (elapsedMs < minVisibleMs) {
                await sleep(minVisibleMs - elapsedMs);
            }

            clearInterval(progressTimer);
            setSellUploadProgress(100, "Fichier chargé");
            sellFileMeta.textContent = `${file.name} · ${formatBytes(file.size)}`;
        }
    });
}

// Refresh Button
refreshBtn.addEventListener("click", () => {
    if (!contract) {
        showToast("Connectez d'abord votre wallet.", "error");
        return;
    }
    loadProducts();
});

// Connect Button
connectBtn.addEventListener("click", async () => {
    // Toujours proposer le sélecteur de compte (wallet_requestPermissions)
    // pour permettre de changer facilement de portefeuille
    localStorage.removeItem("wallet_disconnected");
    await connectWallet();
});

disconnectBtn.addEventListener("click", () => {
    localStorage.setItem("wallet_disconnected", "1");
    disconnect();
    showToast("Déconnecté. Cliquez sur 'Connecter MetaMask' pour choisir un autre compte.", "success", 5000);
});

saveContractBtn.addEventListener("click", async () => {
    const value = contractAddressInput.value.trim();
    if (!ethers.isAddress(value)) {
        showToast("Adresse de contrat invalide.", "error");
        return;
    }

    contractAddress = value;
    localStorage.setItem("market_contract_address", value);
    setDiag(diagAddress, `Contrat: ${shortAddr(value)} (à vérifier)`, "warn");

    if (signer) {
        contract = new ethers.Contract(getActiveContractAddress(), ABI, signer);
        await loadUserRole();
        showToast("Adresse du contrat mise à jour.", "success");
        await loadProducts();
        startRealtimeSync();
        scheduleRealtimeRefresh();
    } else {
        showToast("Adresse enregistrée. Connectez MetaMask pour charger les produits.", "success");
    }

    if (contractDrawer) contractDrawer.open = false;
});

contractAddressInput.addEventListener("keydown", async (event) => {
    if (event.key === "Enter") {
        event.preventDefault();
        await saveContractBtn.click();
    }
});

// Auto-connect if wallet was previously connected
(async () => {
    if (contractDrawer) {
        document.addEventListener("click", (event) => {
            if (!contractDrawer.open) return;
            if (!contractDrawer.contains(event.target)) {
                contractDrawer.open = false;
            }
        });

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && contractDrawer.open) {
                contractDrawer.open = false;
            }
        });
    }

    syncContractAddressInput();
    refreshCategoryLabelsUI();
    setActiveFilter("all");
    updateHeaderWalletState(false);
    setDiag(diagAddress, `Contrat: ${shortAddr(getActiveContractAddress())} (à vérifier)`, "warn");
    updateRoleDiag();
    if (!window.ethereum) return;
    if (localStorage.getItem("wallet_disconnected") === "1") return;
    try {
        const accounts = await window.ethereum.request({ method: "eth_accounts" });
        if (accounts.length > 0) await connectWallet();
    } catch {
    }
})();
