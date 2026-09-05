// Card Checker Application
class CardChecker {
    constructor() {
        this.isRunning = false;
        this.liveCount = 0;
        this.deadCount = 0;
        this.unknownCount = 0;
        this.currentRequests = [];
        
        this.initializeElements();
        this.attachEventListeners();
    }
    
    initializeElements() {
        this.cardInput = document.getElementById('cardInput');
        this.fileUpload = document.getElementById('fileUpload');
        this.threadsInput = document.getElementById('threads');
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.liveCountEl = document.getElementById('liveCount');
        this.deadCountEl = document.getElementById('deadCount');
        this.unknownCountEl = document.getElementById('unknownCount');
        this.resultLiveEl = document.getElementById('resultLive');
        this.resultDeadEl = document.getElementById('resultDead');
        this.resultUnknownEl = document.getElementById('resultUnknown');
        this.resultsContainer = document.getElementById('resultsContainer');
    }
    
    attachEventListeners() {
        this.fileUpload.addEventListener('change', (e) => this.handleFileUpload(e));
        this.startBtn.addEventListener('click', () => this.startChecking());
        this.stopBtn.addEventListener('click', () => this.stopChecking());
    }
    
    handleFileUpload(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                this.cardInput.value = e.target.result;
            };
            reader.readAsText(file);
        }
    }
    
    parseCards(input) {
        const lines = input.split('\n').filter(line => line.trim());
        const cards = [];
        
        for (const line of lines) {
            const parts = line.split('|').map(part => part.trim());
            if (parts.length >= 4) {
                cards.push({
                    card: parts[0],
                    month: parts[1],
                    year: parts[2],
                    cvv: parts[3],
                    full: line.trim()
                });
            }
        }
        
        return cards;
    }
    
    async startChecking() {
        const input = this.cardInput.value.trim();
        if (!input) {
            alert('Please enter card data or upload a file');
            return;
        }
        
        const cards = this.parseCards(input);
        if (cards.length === 0) {
            alert('No valid cards found. Please use format: cardnumber|month|year|cvv');
            return;
        }
        
        this.isRunning = true;
        this.startBtn.disabled = true;
        this.stopBtn.disabled = false;
        this.cardInput.disabled = true;
        this.threadsInput.disabled = true;
        
        this.clearResults();
        this.resultsContainer.innerHTML = '';
        
        const threads = parseInt(this.threadsInput.value) || 1;
        const batchSize = Math.ceil(cards.length / threads);
        
        for (let i = 0; i < threads && i < cards.length; i++) {
            const start = i * batchSize;
            const end = Math.min(start + batchSize, cards.length);
            const batch = cards.slice(start, end);
            
            this.currentRequests.push(this.processBatch(batch));
        }
        
        await Promise.all(this.currentRequests);
        this.stopChecking();
    }
    
    async processBatch(cards) {
        for (const cardData of cards) {
            if (!this.isRunning) break;
            
            try {
                const result = await this.checkCardWithRetry(cardData);
                this.displayResult(result);
                this.updateStats(result);
            } catch (error) {
                console.error('Error checking card:', error);
                this.displayError(cardData, error.message);
            }
            
            // Respect rate limit: 5 requests per 10 seconds = 2 seconds minimum between requests
            // Adding extra buffer to be safe
            await new Promise(resolve => setTimeout(resolve, 2500));
        }
    }
    
    async checkCardWithRetry(cardData, maxRetries = 3) {
        let lastError;
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                return await this.checkCard(cardData);
            } catch (error) {
                lastError = error;
                
                // If it's a 429 error (rate limit), wait and retry
                if (error.message.includes('429')) {
                    const waitTime = Math.pow(2, attempt) * 5000; // Exponential backoff: 5s, 10s, 20s
                    console.log(`Rate limited. Waiting ${waitTime / 1000}s before retry ${attempt + 1}/${maxRetries}`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    continue;
                }
                
                // For other errors, don't retry
                throw error;
            }
        }
        
        throw lastError;
    }
    
    async checkCard(cardData) {
        const apiUrl = 'https://api.chkr.cc/';
        const requestBody = JSON.stringify({
            data: `${cardData.card}|${cardData.month}|${cardData.year}|${cardData.cvv}`,
            charge: false
        });
        
        // Try multiple CORS proxy approaches
        const proxyMethods = [
            // Method 1: Direct request (might work with some browsers)
            async () => {
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Host': 'api.chkr.cc',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:154.0) Gecko/20100101 Firefox/154.0',
                        'Accept': '*/*',
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Accept-Encoding': 'gzip, deflate, br, zstd',
                        'Referer': 'https://chkr.cc/',
                        'Content-Type': 'application/json; charset=utf-8',
                        'Content-Length': requestBody.length.toString(),
                        'Origin': 'https://chkr.cc',
                        'Connection': 'keep-alive',
                        'Sec-Fetch-Dest': 'empty',
                        'Sec-Fetch-Mode': 'cors',
                        'Sec-Fetch-Site': 'same-site',
                        'Priority': 'u=0',
                        'TE': 'trailers'
                    },
                    body: requestBody
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                return await response.json();
            },
            
            // Method 2: Try corsproxy.io
            async () => {
                const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(apiUrl)}`;
                const response = await fetch(proxyUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    body: requestBody
                });
                
                if (!response.ok) {
                    throw new Error(`Proxy HTTP error! status: ${response.status}`);
                }
                
                return await response.json();
            },
            
            // Method 3: Try allorigins
            async () => {
                const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(apiUrl)}`;
                const response = await fetch(proxyUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: requestBody
                });
                
                if (!response.ok) {
                    throw new Error(`Proxy HTTP error! status: ${response.status}`);
                }
                
                return await response.json();
            }
        ];
        
        // Try each method
        for (const method of proxyMethods) {
            try {
                const data = await method();
                return this.formatResponse(cardData, data);
            } catch (error) {
                console.log('Method failed:', error.message);
                continue;
            }
        }
        
        throw new Error('All connection methods failed. The API strictly only accepts requests from https://chkr.cc domain. You need to use a CORS bypass browser extension or host this on the chkr.cc domain.');
    }
    
    formatResponse(cardData, data) {
        return {
            card: cardData.full,
            status: this.determineStatus(data),
            bank: data.card?.bank || 'Unknown',
            type: data.card?.type || 'Unknown',
            category: data.card?.category || 'Unknown',
            brand: data.card?.brand || 'Unknown',
            country: data.card?.country?.name || 'Unknown',
            message: data.message || 'No message'
        };
    }
    
    determineStatus(data) {
        const status = (data.status || '').toLowerCase();
        if (['die', 'dead', 'declined', 'failed'].includes(status)) {
            return 'dead';
        } else if (['live', 'approved', 'charged', 'ccn', 'success'].includes(status)) {
            return 'live';
        } else {
            return 'unknown';
        }
    }
    
    displayResult(result) {
        const resultItem = document.createElement('div');
        resultItem.className = `result-item ${result.status}`;
        
        resultItem.innerHTML = `
            <div class="result-card">${this.maskCard(result.card)}</div>
            <div class="result-info">
                <span>Bank: ${result.bank}</span>
                <span>Type: ${result.type}</span>
                <span>Category: ${result.category}</span>
                <span>Brand: ${result.brand}</span>
                <span>Country: ${result.country}</span>
            </div>
            <div class="result-status ${result.status}">${result.status.toUpperCase()}</div>
            <div class="result-message">${result.message}</div>
        `;
        
        this.resultsContainer.appendChild(resultItem);
        this.resultsContainer.scrollTop = this.resultsContainer.scrollHeight;
    }
    
    displayError(cardData, errorMessage) {
        const resultItem = document.createElement('div');
        resultItem.className = 'result-item unknown';
        
        resultItem.innerHTML = `
            <div class="result-card">${this.maskCard(cardData.full)}</div>
            <div class="result-info">
                <span>Error: ${errorMessage}</span>
            </div>
            <div class="result-status unknown">ERROR</div>
        `;
        
        this.resultsContainer.appendChild(resultItem);
        this.resultsContainer.scrollTop = this.resultsContainer.scrollHeight;
    }
    
    maskCard(card) {
        const parts = card.split('|');
        if (parts.length >= 1) {
            const cardNumber = parts[0];
            const masked = cardNumber.substring(0, 6) + 'XXXX' + cardNumber.substring(cardNumber.length - 4);
            parts[0] = masked;
            return parts.join('|');
        }
        return card;
    }
    
    updateStats(result) {
        if (result.status === 'live') {
            this.liveCount++;
        } else if (result.status === 'dead') {
            this.deadCount++;
        } else {
            this.unknownCount++;
        }
        
        this.updateStatDisplay();
    }
    
    updateStatDisplay() {
        this.liveCountEl.textContent = this.liveCount;
        this.deadCountEl.textContent = this.deadCount;
        this.unknownCountEl.textContent = this.unknownCount;
        
        this.resultLiveEl.textContent = this.liveCount;
        this.resultDeadEl.textContent = this.deadCount;
        this.resultUnknownEl.textContent = this.unknownCount;
    }
    
    clearResults() {
        this.liveCount = 0;
        this.deadCount = 0;
        this.unknownCount = 0;
        this.updateStatDisplay();
    }
    
    stopChecking() {
        this.isRunning = false;
        this.currentRequests = [];
        
        this.startBtn.disabled = false;
        this.stopBtn.disabled = true;
        this.cardInput.disabled = false;
        this.threadsInput.disabled = false;
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new CardChecker();
});