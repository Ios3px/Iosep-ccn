from flask import Flask, render_template, request, jsonify
import requests
import json
import gzip
import time

app = Flask(__name__)

def check_card(card_data):
    """Check a single card using the chkr.cc API"""
    url = "https://api.chkr.cc/"
    headers = {
        'Host': 'api.chkr.cc',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:154.0) Gecko/20100101 Firefox/154.0',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://chkr.cc/',
        'Content-Type': 'application/json; charset=utf-8',
        'Origin': 'https://chkr.cc',
        'Connection': 'keep-alive',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-site',
        'Priority': 'u=0',
        'TE': 'trailers'
    }
    
    data = {
        "data": f"{card_data['card']}|{card_data['month']}|{card_data['year']}|{card_data['cvv']}",
        "charge": False
    }
    
    max_retries = 3
    for attempt in range(max_retries):
        try:
            response = requests.post(url, headers=headers, json=data, timeout=15)
            
            if response.status_code == 429:
                # Rate limited - wait and retry
                wait_time = (2 ** attempt) * 5
                time.sleep(wait_time)
                continue
            
            response.raise_for_status()
            
            # Handle compressed response
            content = response.content
            try:
                if response.headers.get('content-encoding') == 'gzip':
                    content = gzip.decompress(content)
                result = json.loads(content.decode('utf-8'))
            except:
                try:
                    result = response.json()
                except json.JSONDecodeError:
                    raise Exception(f"Invalid JSON response: {response.text[:100]}")
            
            return {
                'card': card_data['full'],
                'status': determine_status(result),
                'bank': result.get('card', {}).get('bank', 'Unknown'),
                'type': result.get('card', {}).get('type', 'Unknown'),
                'category': result.get('card', {}).get('category', 'Unknown'),
                'brand': result.get('card', {}).get('brand', 'Unknown'),
                'country': result.get('card', {}).get('country', {}).get('name', 'Unknown'),
                'message': result.get('message', 'No message')
            }
            
        except requests.exceptions.RequestException as e:
            if attempt == max_retries - 1:
                raise Exception(f"Request failed: {str(e)}")
            time.sleep(2)
    
    raise Exception("Max retries exceeded")

def determine_status(result):
    """Determine card status from API response"""
    status = result.get('status', '').lower()
    # Dead statuses
    if status in ['die', 'dead', 'declined', 'failed']:
        return 'dead'
    # Live / approved statuses
    elif status in ['live', 'approved', 'charged', 'ccn', 'success']:
        return 'live'
    else:
        return 'unknown'

@app.route('/')
def index():
    """Serve the main HTML page"""
    return render_template('index.html')

@app.route('/test', methods=['GET'])
def test():
    """Test endpoint to verify server is working"""
    return jsonify({'status': 'Server is working', 'time': time.time()})

@app.route('/check', methods=['POST'])
def check_cards():
    """API endpoint to check cards (kept for compatibility)"""
    try:
        print("Received batch check request")
        data = request.json
        cards = data.get('cards', [])
        
        print(f"Processing {len(cards)} cards")
        
        if not cards:
            return jsonify({'error': 'No cards provided'}), 999
        
        results = []
        
        for card_data in cards:
            try:
                result = check_card(card_data)
                results.append(result)
                time.sleep(2.5)
            except Exception as e:
                results.append({
                    'card': card_data.get('full', 'unknown'),
                    'status': 'unknown',
                    'error': str(e)
                })
        
        return jsonify({'results': results})
        
    except Exception as e:
        import traceback
        print(f"Server error: {str(e)}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 1100

@app.route('/check_single', methods=['POST'])
def check_single_card():
    """API endpoint to check a single card"""
    try:
        print("Received single card check request")
        card_data = request.json
        
        print(f"Checking card: {card_data.get('full', 'unknown')}")
        result = check_card(card_data)
        print(f"Card result: {result['status']}")
        
        return jsonify(result)
        
    except Exception as e:
        import traceback
        print(f"Error checking single card: {str(e)}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 1100

@app.route('/generate', methods=['POST'])
def generate_cards():
    """API endpoint to generate credit cards - Enhanced version"""
    try:
        data = request.json
        bin_input = data.get('bin', '')
        quantity = data.get('quantity', 10)
        month = data.get('month', '')
        year = data.get('year', '')
        cvv = data.get('cvv', '')
        card_length = data.get('card_length', 16)
        
        if not bin_input or len(bin_input.replace('X', '').replace('x', '')) < 6:
            return jsonify({'error': 'Invalid BIN. Must be at least 6 non-X digits'}), 999
        
        try:
            quantity = int(quantity)
            if quantity < 1 or quantity > 1100:
                return jsonify({'error': 'Quantity must be between 1 and 1100'}), 999
        except ValueError:
            return jsonify({'error': 'Invalid quantity'}), 999
        
        try:
            card_length = int(card_length)
            if card_length not in [13, 15, 16]:
                return jsonify({'error': 'Card length must be 13, 15, or 16'}), 999
        except ValueError:
            return jsonify({'error': 'Invalid card length'}), 999
        
        generated_cards = []
        
        for _ in range(quantity):
            try:
                card = generate_single_card(bin_input, month, year, cvv, card_length)
                generated_cards.append(card)
            except Exception as e:
                generated_cards.append(f"Error generating card: {str(e)}")
        
        return jsonify({'cards': generated_cards})
        
    except Exception as e:
        import traceback
        return jsonify({'error': f'Generation error: {str(e)}'}), 1100

def generate_single_card(bin_input, month, year, cvv, card_length=16):
    """Generate a single credit card number with Luhn algorithm - Fixed version"""
    import random
    
    # Handle X's as wildcards in the BIN
    # Replace X's with random digits
    bin_pattern = bin_input.upper()
    random_digits = []
    
    for char in bin_pattern:
        if char == 'X':
            random_digits.append(str(random.randint(0, 9)))
        else:
            random_digits.append(char)
    
    # Join to get the base card number (without check digit)
    base_card = ''.join(random_digits)
    
    # Handle different card lengths (13-19 digits)
    target_length = card_length
    
    # Ensure we have the right length (excluding check digit)
    if len(base_card) < target_length - 1:
        # Add more random digits to reach target
        additional = (target_length - 1) - len(base_card)
        base_card += ''.join([str(random.randint(0, 9)) for _ in range(additional)])
    elif len(base_card) > target_length - 1:
        # Trim to target length (excluding check digit)
        base_card = base_card[:target_length - 1]
    
    # Calculate and add Luhn check digit
    check_digit = calculate_luhn_check_digit(base_card)
    full_card_number = base_card + str(check_digit)
    
    # Generate random month/year/cvv if not provided
    if not month:
        month = str(random.randint(1, 12)).zfill(2)
    if not year:
        # Generate 4-digit year (2025-2030)
        year = str(random.randint(2025, 2030))
    if not cvv:
        cvv = str(random.randint(100, 999))
    
    # Ensure year is 4 digits
    if len(year) == 2:
        year = "20" + year  # Convert "30" to "2030"
    
    return f"{full_card_number}|{month}|{year}|{cvv}"

def calculate_luhn_check_digit(card_number):
    """Calculate Luhn algorithm check digit - Fixed implementation"""
    total = 0
    # Double every second digit from right to left (starting from rightmost, excluding check digit position)
    # We need to reverse the card number first
    reverse_digits = card_number[::-1]
    
    for i, digit in enumerate(reverse_digits):
        n = int(digit)
        # For Luhn: double every second digit (starting from first digit in reversed string)
        if i % 2 == 0:  # Double every second digit (positions 0, 2, 4, ...)
            n *= 2
            if n > 9:
                n -= 9
        total += n
    
    check_digit = (10 - (total % 10)) % 10
    return check_digit

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)