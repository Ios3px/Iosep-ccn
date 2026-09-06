// Card Checker Application with Flask Backend
class CardChecker {
    constructor() {
        this.liveCount = 0;
        this.deadCount = 0;
        this.unknownCount = 0;
        
        this.initializeElements();
        this.attachEventListeners();
    }
    
    initializeElements() {
        this.cardInput = document.getElementById('cardInput');
        this.threadsInput = document.getElementById('threads');
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.generateBtn = document.getElementById('generateBtn');
        this.liveCountEl = document.getElementById('liveCount');
        this.deadCountEl = document.getElementById('deadCount');
        this.unknownCountEl = document.getElementById('unknownCount');
        this.liveContainer = document.getElementById('liveContainer');
        this.deadContainer = document.getElementById('deadContainer');
        this.unknownContainer = document.getElementById('unknownContainer');
        this.generatorModal = document.getElementById('generatorModal');
        this.closeModal = document.querySelector('.close');
        this.generateCardsBtn = document.getElementById('generateCardsBtn');
        this.clearCardsBtn = document.getElementById('clearCardsBtn');
        this.copyGeneratedBtn = document.getElementById('copyGeneratedBtn');
        this.addToCheckerBtn = document.getElementById('addToCheckerBtn');
        this.binInput = document.getElementById('binInput');
        this.quantityInput = document.getElementById('quantity');
        this.monthInput = document.getElementById('monthInput');
        this.yearInput = document.getElementById('yearInput');
        this.cvvInput = document.getElementById('cvvInput');
        this.formatSelect = document.getElementById('formatSelect');
        this.cardLengthSelect = document.getElementById('cardLength');
        this.generatedOutput = document.getElementById('generatedOutput');
        this.generatedCountEl = document.getElementById('generatedCount');
        this.notificationPopup = document.getElementById('notificationPopup');
        this.notificationIcon = document.getElementById('notificationIcon');
        this.notificationMessage = document.getElementById('notificationMessage');
        this.notificationClose = document.getElementById('notificationClose');
        this.progressSection = document.getElementById('progressSection');
        this.progressFill = document.getElementById('progressFill');
        this.progressText = document.getElementById('progressText');
        this.progressPercent = document.getElementById('progressPercent');
        this.copyAllResultsBtn = document.getElementById('copyAllResultsBtn');

        
        this.generatedCards = [];
        this.isChecking = false;
        this.totalCards = 0;
        this.checkedCards = 0;
        this.allResults = [];
    }
    
    attachEventListeners() {
        this.startBtn.addEventListener('click', () => this.startChecking());
        this.stopBtn.addEventListener('click', () => this.stopChecking());
        this.generateBtn.addEventListener('click', () => this.openGeneratorModal());
        this.closeModal.addEventListener('click', () => this.closeGeneratorModal());
        this.generateCardsBtn.addEventListener('click', () => this.generateCards());
        this.clearCardsBtn.addEventListener('click', () => this.clearGeneratedCards());
        this.copyGeneratedBtn.addEventListener('click', () => this.copyGeneratedCards());
        this.addToCheckerBtn.addEventListener('click', () => this.addToChecker());
        this.notificationClose.addEventListener('click', () => this.closeNotification());
        this.copyAllResultsBtn.addEventListener('click', () => this.copyAllResults());

        
        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target === this.generatorModal) {
                this.closeGeneratorModal();
            }
            if (e.target === this.notificationPopup) {
                this.closeNotification();
            }
        });
        
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });
    }
    
    parseCards(input) {
        const lines = input.split('\n').filter(line => line.trim());
        const cards = [];
        
        for (const line of lines) {
            const parts = line.split('|').map(part => part.trim());
            if (parts.length >= 4) {
                // Validate card number is numeric
                const cardNumber = parts[0].replace(/\s/g, '');
                if (cardNumber.length >= 13 && cardNumber.length <= 19 && /^\d+$/.test(cardNumber)) {
                    // Convert 4-digit year to 2-digit for API
                    let year = parts[2];
                    if (year.length === 4) {
                        year = year.slice(-2); // Convert "2030" to "30"
                    }
                    cards.push({
                        card: cardNumber,
                        month: parts[1],
                        year: year,
                        cvv: parts[3],
                        full: line.trim()
                    });
                }
            }
        }
        
        console.log('Parsed', cards.length, 'valid cards from input');
        return cards;
    }
    
    async startChecking() {
        try {
            const input = this.cardInput.value.trim();
            console.log('Input:', input);
            
            if (!input) {
                this.showNotification('Please enter card data', 'warning');
                return;
            }
            
            const cards = this.parseCards(input);
            console.log('Parsed cards:', cards);
            
            if (cards.length === 0) {
                this.showNotification('No valid cards found. Please use format: cardnumber|month|year|cvv', 'warning');
                return;
            }
            
            this.isChecking = true;
            this.totalCards = cards.length;
            this.checkedCards = 0;
            
            this.startBtn.disabled = true;
            this.stopBtn.disabled = false;
            this.cardInput.disabled = true;
            this.threadsInput.disabled = true;
            
            // Show progress section
            if (this.progressSection) {
                this.progressSection.style.display = 'block';
                this.updateProgress(0, this.totalCards);
            }
            
            this.allResults = [];
            this.clearResults();
            this.liveContainer.innerHTML = '<div class="results-container"><div class="no-results">No live cards yet</div></div>';
            this.deadContainer.innerHTML = '<div class="results-container"><div class="no-results">No dead cards yet</div></div>';
            this.unknownContainer.innerHTML = '<div class="results-container"><div class="no-results">No unknown cards yet</div></div>';
            
            console.log('Starting to check', cards.length, 'cards one by one');
            
            // Process cards one by one
            for (let i = 0; i < cards.length; i++) {
                if (!this.isChecking) {
                    console.log('Checking stopped by user');
                    break;
                }
                
                const cardData = cards[i];
                this.checkedCards = i + 1;
                console.log('Checking card:', cardData);
                
                if (this.progressSection) {
                    this.updateProgress(this.checkedCards, this.totalCards);
                }
                
                // Remove the current card from input box
                this.removeCardFromInput(cardData.full);
                
                try {
                    const result = await this.checkSingleCard(cardData);
                    console.log('Card result:', result);
                    
                    if (result.error) {
                        this.displayError({full: result.card}, result.error);
                        this.unknownCount++;
                        this.allResults.push({ card: result.card, status: 'unknown', error: result.error });
                    } else {
                        this.displayResult(result);
                        this.allResults.push(result);
                        if (result.status === 'live') {
                            this.liveCount++;
                        } else if (result.status === 'dead') {
                            this.deadCount++;
                        } else {
                            this.unknownCount++;
                        }
                    }
                    this.updateStatDisplay();
                    
                } catch (error) {
                    console.error('Error checking card:', error);
                    this.displayError(cardData, error.message);
                    this.unknownCount++;
                    this.allResults.push({ card: cardData.full, status: 'unknown', error: error.message });
                    this.updateStatDisplay();
                }
                
                // Small delay between cards to prevent overwhelming
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            this.stopChecking();
            const wasStopped = this.checkedCards < cards.length;
            if (wasStopped) {
                this.showNotification(`Stopped after checking ${this.checkedCards} of ${cards.length} cards.`, 'warning');
            } else {
                this.showNotification(`Checked all ${this.checkedCards} cards successfully!`, 'success');
            }
        } catch (error) {
            console.error('Error in startChecking:', error);
            this.showNotification('Error: ' + error.message, 'error');
            this.stopChecking();
        }
    }
    
    async checkSingleCard(cardData) {
        const response = await fetch('/check_single', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(cardData)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        return data;
    }
    
    stopChecking() {
        this.isChecking = false;
        this.startBtn.disabled = false;
        this.stopBtn.disabled = true;
        this.cardInput.disabled = false;
        this.threadsInput.disabled = false;
        
        // Hide progress section
        this.progressSection.style.display = 'none';
        
        // Reset start button text
        this.startBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            Start
        `;
    }
    
    updateProgress(current, total) {
        if (this.progressFill && this.progressText && this.progressPercent) {
            const percent = Math.round((current / total) * 100);
            this.progressFill.style.width = `${percent}%`;
            this.progressText.textContent = `Checking ${current}/${total}`;
            this.progressPercent.textContent = `${percent}%`;
        }
    }
    
    displayResult(result) {
        const resultItem = document.createElement('div');
        resultItem.className = `result-item ${result.status}`;
        
        // Convert status to display text
        const statusText = result.status.toUpperCase();
        
        // Format the message - use API message for dead/unknown, custom for live
        let customMessage;
        if (result.status === 'live') {
            customMessage = `LIVE OK. [GATE_@itsmeJY]`;
        } else {
            // Use the actual API message for dead and unknown
            customMessage = result.message || `UNKNOWN. [GATE_@itsmeJY]`;
        }
        
        // Get country flag emoji and currency
        const countryFlag = result.country ? this.getCountryFlag(result.country) : '🏳';
        const currency = result.country ? this.getCurrency(result.country) : 'N/A';
        
        resultItem.innerHTML = `
            <div class="result-card clickable" data-card="${result.card}" title="Click to copy">${result.card}</div>
            <div class="result-info">
                <span>Bank: ${result.bank}</span>
                <span>Type: ${result.type}</span>
                <span>Category: ${result.category}</span>
                <span>${countryFlag} ${result.country} (${currency})</span>
            </div>
            <div class="result-status ${result.status}">${statusText}</div>
            <div class="result-message">${customMessage}</div>
        `;
        
        // Add click-to-copy functionality
        const cardElement = resultItem.querySelector('.result-card');
        cardElement.addEventListener('click', () => this.copyToClipboard(result.card, cardElement));
        
        // Add to appropriate container based on status
        let container;
        if (result.status === 'live') {
            container = this.liveContainer;
            // Remove "no results" message if present
            const noResults = container.querySelector('.no-results');
            if (noResults) {
                noResults.remove();
            }
        } else if (result.status === 'dead') {
            container = this.deadContainer;
            const noResults = container.querySelector('.no-results');
            if (noResults) {
                noResults.remove();
            }
        } else {
            container = this.unknownContainer;
            const noResults = container.querySelector('.no-results');
            if (noResults) {
                noResults.remove();
            }
        }
        
        // Append result to the results-container
        const resultsContainer = container.querySelector('.results-container');
        if (resultsContainer) {
            resultsContainer.appendChild(resultItem);
        } else {
            container.appendChild(resultItem);
        }
        
        // Scroll to bottom
        container.scrollTop = container.scrollHeight;
    }
    
    getCountryFlag(countryName) {
        const flags = {
            'United States': '🇺🇸',
            'USA': '🇺🇸',
            'US': '🇺🇸',
            'United Kingdom': '🇬🇧',
            'UK': '🇬🇧',
            'GB': '🇬🇧',
            'Canada': '🇨🇦',
            'CA': '🇨🇦',
            'Australia': '🇦🇺',
            'AU': '🇦🇺',
            'Germany': '🇩🇪',
            'DE': '🇩🇪',
            'France': '🇫🇷',
            'FR': '🇫🇷',
            'Italy': '🇮🇹',
            'IT': '🇮🇹',
            'Spain': '🇪🇸',
            'ES': '🇪🇸',
            'Japan': '🇯🇵',
            'JP': '🇯🇵',
            'China': '🇨🇳',
            'CN': '🇨🇳',
            'India': '🇮🇳',
            'IN': '🇮🇳',
            'Brazil': '🇧🇷',
            'BR': '🇧🇷',
            'Mexico': '🇲🇽',
            'MX': '🇲🇽',
            'Russia': '🇷🇺',
            'RU': '🇷🇺',
            'South Korea': '🇰🇷',
            'KR': '🇰🇷',
            'Netherlands': '🇳🇱',
            'NL': '🇳🇱',
            'Switzerland': '🇨🇭',
            'CH': '🇨🇭',
            'Sweden': '🇸🇪',
            'SE': '🇸🇪',
            'Norway': '🇳🇴',
            'NO': '🇳🇴',
            'Denmark': '🇩🇰',
            'DK': '🇩🇰',
            'Belgium': '🇧🇪',
            'BE': '🇧🇪',
            'Austria': '🇦🇹',
            'AT': '🇦🇹',
            'Poland': '🇵🇱',
            'PL': '🇵🇱',
            'Turkey': '🇹🇷',
            'TR': '🇹🇷',
            'Argentina': '🇦🇷',
            'AR': '🇦🇷',
            'South Africa': '🇿🇦',
            'ZA': '🇿🇦',
            'Singapore': '🇸🇬',
            'SG': '🇸🇬',
            'Hong Kong': '🇭🇰',
            'HK': '🇭🇰',
            'United Arab Emirates': '🇦🇪',
            'UAE': '🇦🇪',
            'AE': '🇦🇪',
            'Saudi Arabia': '🇸🇦',
            'SA': '🇸🇦',
            'Israel': '🇮🇱',
            'IL': '🇮🇱',
            'Egypt': '🇪🇬',
            'EG': '🇪🇬',
            'Nigeria': '🇳🇬',
            'NG': '🇳🇬',
            'Kenya': '🇰🇪',
            'KE': '🇰🇪',
            'Thailand': '🇹🇭',
            'TH': '🇹🇭',
            'Vietnam': '🇻🇳',
            'VN': '🇻🇳',
            'Philippines': '🇵🇭',
            'PH': '🇵🇭',
            'Indonesia': '🇮🇩',
            'ID': '🇮🇩',
            'Malaysia': '🇲🇾',
            'MY': '🇲🇾',
            'Pakistan': '🇵🇰',
            'PK': '🇵🇰',
            'Bangladesh': '🇧🇩',
            'BD': '🇧🇩',
            'New Zealand': '🇳🇿',
            'NZ': '🇳🇿',
            'Ireland': '🇮🇪',
            'IE': '🇮🇪',
            'Portugal': '🇵🇹',
            'PT': '🇵🇹',
            'Greece': '🇬🇷',
            'GR': '🇬🇷',
            'Czech Republic': '🇨🇿',
            'CZ': '🇨🇿',
            'Hungary': '🇭🇺',
            'HU': '🇭🇺',
            'Romania': '🇷🇴',
            'RO': '🇷🇴',
            'Ukraine': '🇺🇦',
            'UA': '🇺🇦',
            'Finland': '🇫🇮',
            'FI': '🇫🇮',
            'Colombia': '🇨🇴',
            'CO': '🇨🇴',
            'Chile': '🇨🇱',
            'CL': '🇨🇱',
            'Peru': '🇵🇪',
            'PE': '🇵🇪',
            'Venezuela': '🇻🇪',
            'VE': '🇻🇪',
            'Unknown': '🏳',
            '': '🏳'
        };
        return flags[countryName] || '🏳';
    }
    
    getCurrency(countryName) {
        const currencies = {
            'United States': 'USD',
            'USA': 'USD',
            'US': 'USD',
            'United Kingdom': 'GBP',
            'UK': 'GBP',
            'GB': 'GBP',
            'Canada': 'CAD',
            'CA': 'CAD',
            'Australia': 'AUD',
            'AU': 'AUD',
            'Germany': 'EUR',
            'DE': 'EUR',
            'France': 'EUR',
            'FR': 'EUR',
            'Italy': 'EUR',
            'IT': 'EUR',
            'Spain': 'EUR',
            'ES': 'EUR',
            'Japan': 'JPY',
            'JP': 'JPY',
            'China': 'CNY',
            'CN': 'CNY',
            'India': 'INR',
            'IN': 'INR',
            'Brazil': 'BRL',
            'BR': 'BRL',
            'Mexico': 'MXN',
            'MX': 'MXN',
            'Russia': 'RUB',
            'RU': 'RUB',
            'South Korea': 'KRW',
            'KR': 'KRW',
            'Netherlands': 'EUR',
            'NL': 'EUR',
            'Switzerland': 'CHF',
            'CH': 'CHF',
            'Sweden': 'SEK',
            'SE': 'SEK',
            'Norway': 'NOK',
            'NO': 'NOK',
            'Denmark': 'DKK',
            'DK': 'DKK',
            'Belgium': 'EUR',
            'BE': 'EUR',
            'Austria': 'EUR',
            'AT': 'EUR',
            'Poland': 'PLN',
            'PL': 'PLN',
            'Turkey': 'TRY',
            'TR': 'TRY',
            'Argentina': 'ARS',
            'AR': 'ARS',
            'South Africa': 'ZAR',
            'ZA': 'ZAR',
            'Singapore': 'SGD',
            'SG': 'SGD',
            'Hong Kong': 'HKD',
            'HK': 'HKD',
            'United Arab Emirates': 'AED',
            'UAE': 'AED',
            'AE': 'AED',
            'Saudi Arabia': 'SAR',
            'SA': 'SAR',
            'Israel': 'ILS',
            'IL': 'ILS',
            'Egypt': 'EGP',
            'EG': 'EGP',
            'Nigeria': 'NGN',
            'NG': 'NGN',
            'Kenya': 'KES',
            'KE': 'KES',
            'Thailand': 'THB',
            'TH': 'THB',
            'Vietnam': 'VND',
            'VN': 'VND',
            'Philippines': 'PHP',
            'PH': 'PHP',
            'Indonesia': 'IDR',
            'ID': 'IDR',
            'Malaysia': 'MYR',
            'MY': 'MYR',
            'Pakistan': 'PKR',
            'PK': 'PKR',
            'Bangladesh': 'BDT',
            'BD': 'BDT',
            'New Zealand': 'NZD',
            'NZ': 'NZD',
            'Ireland': 'EUR',
            'IE': 'EUR',
            'Portugal': 'EUR',
            'PT': 'EUR',
            'Greece': 'EUR',
            'GR': 'EUR',
            'Czech Republic': 'CZK',
            'CZ': 'CZK',
            'Hungary': 'HUF',
            'HU': 'HUF',
            'Romania': 'RON',
            'RO': 'RON',
            'Ukraine': 'UAH',
            'UA': 'UAH',
            'Finland': 'EUR',
            'FI': 'EUR',
            'Colombia': 'COP',
            'CO': 'COP',
            'Chile': 'CLP',
            'CL': 'CLP',
            'Peru': 'PEN',
            'PE': 'PEN',
            'Venezuela': 'VES',
            'VE': 'VES',
            'Unknown': 'N/A',
            '': 'N/A'
        };
        return currencies[countryName] || 'N/A';
    }
    
    displayError(cardData, errorMessage) {
        const resultItem = document.createElement('div');
        resultItem.className = 'result-item unknown';
        
        resultItem.innerHTML = `
            <div class="result-card clickable" data-card="${cardData.full}" title="Click to copy">${cardData.full}</div>
            <div class="result-info">
                <span>Error: ${errorMessage}</span>
            </div>
            <div class="result-status unknown">ERROR</div>
        `;
        
        // Add click-to-copy functionality
        const cardElement = resultItem.querySelector('.result-card');
        cardElement.addEventListener('click', () => this.copyToClipboard(cardData.full, cardElement));
        
        // Add to unknown container
        const noResults = this.unknownContainer.querySelector('.no-results');
        if (noResults) {
            noResults.remove();
        }
        
        const resultsContainer = this.unknownContainer.querySelector('.results-container');
        if (resultsContainer) {
            resultsContainer.appendChild(resultItem);
        } else {
            this.unknownContainer.appendChild(resultItem);
        }
        
        this.unknownContainer.scrollTop = this.unknownContainer.scrollHeight;
    }
    
    switchTab(tabName) {
        // Remove active class from all tabs and contents
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        // Add active class to selected tab and content
        document.querySelector(`.tab-btn[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(`${tabName}Container`).classList.add('active');
    }
    
    openGeneratorModal() {
        this.generatorModal.style.display = 'block';
    }
    
    closeGeneratorModal() {
        this.generatorModal.style.display = 'none';
    }
    
    async generateCards() {
        const bin = this.binInput.value.trim();
        const quantity = this.quantityInput.value;
        const month = this.monthInput.value.trim();
        const year = this.yearInput.value.trim();
        const cvv = this.cvvInput.value.trim();
        const format = this.formatSelect.value;
        const cardLength = this.cardLengthSelect.value;
        
        if (!bin || bin.replace(/[Xx]/g, '').length < 6) {
            this.showNotification('Please enter a valid BIN (at least 6 non-X digits)', 'warning');
            return;
        }
        
        try {
            this.generateCardsBtn.textContent = 'Generating...';
            this.generateCardsBtn.disabled = true;
            
            const response = await fetch('/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    bin: bin,
                    quantity: quantity,
                    month: month,
                    year: year,
                    cvv: cvv,
                    card_length: cardLength
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            this.generatedCards = data.cards;
            
            // Format cards based on selected format
            let formattedCards = data.cards;
            if (format === 'space') {
                formattedCards = data.cards.map(card => card.replace(/\|/g, ' '));
            } else if (format === 'csv') {
                formattedCards = data.cards.map(card => card.replace(/\|/g, ','));
            } else if (format === 'json') {
                formattedCards = data.cards.map(card => {
                    const parts = card.split('|');
                    return JSON.stringify({
                        card: parts[0],
                        month: parts[1],
                        year: parts[2],
                        cvv: parts[3]
                    });
                });
            }
            
            // Display in generator output
            this.generatedOutput.value = formattedCards.join('\n');
            this.generatedCountEl.textContent = `Generated: ${data.cards.length}`;
            
            this.showNotification(`Successfully generated ${data.cards.length} cards!`, 'success');
            
        } catch (error) {
            console.error('Error generating cards:', error);
            this.showNotification('Error generating cards: ' + error.message, 'error');
        } finally {
            this.generateCardsBtn.textContent = 'Generate Cards';
            this.generateCardsBtn.disabled = false;
        }
    }
    
    clearGeneratedCards() {
        this.generatedOutput.value = '';
        this.generatedCards = [];
        this.generatedCountEl.textContent = 'Generated: 0';
        this.showNotification('Cleared all cards', 'success');
    }
    
    copyGeneratedCards() {
        const text = this.generatedOutput.value;
        if (!text) {
            this.showNotification('No cards to copy', 'warning');
            return;
        }
        
        navigator.clipboard.writeText(text).then(() => {
            this.showNotification('Copied all cards to clipboard!', 'success');
        }).catch(err => {
            this.showNotification('Failed to copy cards', 'error');
        });
    }
    
    addToChecker() {
        const text = this.generatedOutput.value;
        if (!text) {
            this.showNotification('No cards to add', 'warning');
            return;
        }
        
        const currentText = this.cardInput.value.trim();
        this.cardInput.value = currentText ? currentText + '\n' + text : text;
        
        this.showNotification('Added cards to checker!', 'success');
        this.closeGeneratorModal();
    }
    
    copyToClipboard(text, element) {
        navigator.clipboard.writeText(text).then(() => {
            // Show copy feedback
            const originalText = element.textContent;
            element.textContent = 'COPIED!';
            element.style.color = '#00ff88';
            
            setTimeout(() => {
                element.textContent = originalText;
                element.style.color = '';
            }, 1000);
        }).catch(err => {
            console.error('Failed to copy:', err);
            this.showNotification('Failed to copy to clipboard', 'error');
        });
    }
    
    showNotification(message, type = 'success') {
        this.notificationMessage.textContent = message;
        this.notificationIcon.className = 'notification-icon ' + type;
        
        // Set icon based on type
        if (type === 'success') {
            this.notificationIcon.textContent = '✓';
        } else if (type === 'error') {
            this.notificationIcon.textContent = '✕';
        } else if (type === 'warning') {
            this.notificationIcon.textContent = '⚠';
        }
        
        this.notificationPopup.style.display = 'block';
    }
    
    closeNotification() {
        this.notificationPopup.style.display = 'none';
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
    
    updateStatDisplay() {
        this.liveCountEl.textContent = this.liveCount;
        this.deadCountEl.textContent = this.deadCount;
        this.unknownCountEl.textContent = this.unknownCount;

        // Sync tab count badges
        const tl = document.getElementById('tabLiveCount');
        const td = document.getElementById('tabDeadCount');
        const tu = document.getElementById('tabUnknownCount');
        if (tl) tl.textContent = this.liveCount;
        if (td) td.textContent = this.deadCount;
        if (tu) tu.textContent = this.unknownCount;
    }
    
    clearResults() {
        this.liveCount = 0;
        this.deadCount = 0;
        this.unknownCount = 0;
        this.updateStatDisplay();
        
        // Reset containers to show "no results" messages
        this.liveContainer.innerHTML = '<div class="results-container"><div class="no-results">No live cards yet</div></div>';
        this.deadContainer.innerHTML = '<div class="results-container"><div class="no-results">No dead cards yet</div></div>';
        this.unknownContainer.innerHTML = '<div class="results-container"><div class="no-results">No unknown cards yet</div></div>';
    }
    
    removeCardFromInput(cardLine) {
        const lines = this.cardInput.value.split('\n');
        const filteredLines = lines.filter(line => line.trim() !== cardLine.trim());
        this.cardInput.value = filteredLines.join('\n');
    }
    
    copyAllResults() {
        if (this.allResults.length === 0) {
            this.showNotification('No results to copy', 'warning');
            return;
        }
        
        let resultsText = '';
        this.allResults.forEach(result => {
            if (result.error) {
                resultsText += `${result.card} - ERROR: ${result.error}\n`;
            } else {
                const status = result.status.toUpperCase();
                // Use actual API message for dead/unknown, custom for live
                const message = result.status === 'live' ? 'LIVE OK. [GATE_@itsmeJY]' :
                               result.message || 'UNKNOWN';
                resultsText += `${result.card} - ${status} - ${message}\n`;
            }
        });
        
        navigator.clipboard.writeText(resultsText).then(() => {
            this.showNotification(`Copied ${this.allResults.length} results to clipboard!`, 'success');
        }).catch(err => {
            this.showNotification('Failed to copy results', 'error');
        });
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new CardChecker();
});