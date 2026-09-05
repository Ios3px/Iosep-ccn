import requests
import json
import time
import threading
from queue import Queue
import sys
import gzip

class CardChecker:
    def __init__(self):
        self.live_count = 0
        self.dead_count = 0
        self.unknown_count = 0
        self.is_running = False
        self.stop_event = threading.Event()
        self.update_queue = Queue()
        
    def print_header(self):
        print("\n" + "="*60)
        print("           CARD CHECKER")
        print("="*60 + "\n")
    
    def parse_cards(self, input_text):
        lines = input_text.strip().split('\n')
        cards = []
        
        for line in lines:
            line = line.strip()
            if line:
                parts = line.split('|')
                if len(parts) >= 4:
                    cards.append({
                        'card': parts[0].strip(),
                        'month': parts[1].strip(),
                        'year': parts[2].strip(),
                        'cvv': parts[3].strip(),
                        'full': line
                    })
        
        return cards
    
    def check_card(self, card_data):
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
                    print(f"Rate limited. Waiting {wait_time}s before retry...")
                    time.sleep(wait_time)
                    continue
                
                response.raise_for_status()
                
                # Handle compressed response
                content = response.content
                try:
                    # Try to decompress if it's gzip compressed
                    if response.headers.get('content-encoding') == 'gzip':
                        content = gzip.decompress(content)
                    result = json.loads(content.decode('utf-8'))
                except:
                    # If decompression fails, try direct JSON parsing
                    try:
                        result = response.json()
                    except json.JSONDecodeError:
                        raise Exception(f"Invalid JSON response: {response.text[:100]}")
                
                return {
                    'card': card_data['full'],
                    'status': self.determine_status(result),
                    'bank': result.get('card', {}).get('bank', 'Unknown'),
                    'type': result.get('card', {}).get('type', 'Unknown'),
                    'category': result.get('card', {}).get('category', 'Unknown'),
                    'brand': result.get('card', {}).get('brand', 'Unknown'),
                    'country': result.get('card', {}).get('country', {}).get('name', 'Unknown'),
                    'message': result.get('message', 'No message')
                }
                
            except requests.exceptions.RequestException as e:
                if attempt == max_retries - 1:
                    raise
                time.sleep(2)
        
        raise Exception("Max retries exceeded")
    
    def determine_status(self, result):
        status = result.get('status', '').lower()
        # Dead statuses
        if status in ['die', 'dead', 'declined', 'failed']:
            return 'dead'
        # Live / approved statuses
        elif status in ['live', 'approved', 'charged', 'ccn', 'success']:
            return 'live'
        else:
            return 'unknown'
    
    def mask_card(self, card):
        parts = card.split('|')
        if len(parts) >= 1:
            card_number = parts[0]
            masked = card_number[:6] + 'XXXX' + card_number[-4:]
            parts[0] = masked
            return '|'.join(parts)
        return card
    
    def print_result(self, result):
        status_colors = {
            'live': '\033[92m',  # Green
            'dead': '\033[91m',  # Red
            'unknown': '\033[93m'  # Yellow
        }
        reset = '\033[0m'
        
        color = status_colors.get(result['status'], '')
        
        print(f"\n{color}Card: {self.mask_card(result['card'])}{reset}")
        print(f"Bank: {result['bank']} | Type: {result['type']} | Category: {result['category']}")
        print(f"Brand: {result['brand']} | Country: {result['country']}")
        print(f"{color}Status: {result['status'].upper()} | Message: {result['message']}{reset}")
        print("-" * 60)
    
    def print_error(self, card_data, error_message):
        print(f"\n\033[93mCard: {self.mask_card(card_data['full'])}")
        print(f"Error: {error_message}\033[0m")
        print("-" * 60)
    
    def print_stats(self):
        print(f"\n\033[92mLIVE: {self.live_count}\033[0m | \033[91mDEAD: {self.dead_count}\033[0m | \033[93mUNKNOWN: {self.unknown_count}\033[0m")
    
    def process_cards(self, cards):
        for card_data in cards:
            if self.stop_event.is_set():
                break
            
            try:
                result = self.check_card(card_data)
                self.update_queue.put(('result', result))
            except Exception as e:
                self.update_queue.put(('error', card_data, str(e)))
            
            # Rate limiting - respect API limits (5 requests per 10 seconds)
            time.sleep(2.5)
        
        self.update_queue.put(('thread_done',))
    
    def run_interactive(self):
        self.print_header()
        
        # Check for command line arguments
        if len(sys.argv) > 1:
            file_path = sys.argv[1]
            try:
                with open(file_path, 'r') as file:
                    input_text = file.read()
                print(f"Auto-loaded cards from: {file_path}")
            except Exception as e:
                print(f"Error reading file: {e}")
                return
        else:
            print("Choose input method:")
            print("1. Paste cards manually")
            print("2. Load from file")
            
            choice = input("\nEnter choice (1 or 2): ").strip()
            
            if choice == '1':
                print("\nPaste your cards (format: cardnumber|month|year|cvv)")
                print("Press Enter twice when done:")
                
                lines = []
                while True:
                    line = input()
                    if line == "":
                        break
                    lines.append(line)
                
                input_text = '\n'.join(lines)
                
            elif choice == '2':
                file_path = input("\nEnter file path: ").strip()
                try:
                    with open(file_path, 'r') as file:
                        input_text = file.read()
                except Exception as e:
                    print(f"Error reading file: {e}")
                    return
            else:
                print("Invalid choice")
                return
        
        cards = self.parse_cards(input_text)
        if not cards:
            print("No valid cards found. Use format: cardnumber|month|year|cvv")
            return
        
        print(f"\nFound {len(cards)} cards to check")
        
        # Use default thread count if running from command line
        if len(sys.argv) > 1:
            threads = 1
        else:
            threads = int(input("Number of threads (1-2): ").strip() or "1")
        threads = min(max(threads, 1), 2)
        
        self.is_running = True
        self.stop_event.clear()
        
        # Split cards among threads
        batch_size = max(1, len(cards) // threads)
        worker_threads = []
        
        for i in range(threads):
            start = i * batch_size
            end = start + batch_size if i < threads - 1 else len(cards)
            batch = cards[start:end]
            
            if batch:
                thread = threading.Thread(target=self.process_cards, args=(batch,))
                thread.daemon = True
                thread.start()
                worker_threads.append(thread)
        
        print("\nStarting card check... (Press Ctrl+C to stop)")
        print("="*60)
        
        # Process updates from queue
        active_threads = len(worker_threads)
        while active_threads > 0:
            try:
                item = self.update_queue.get(timeout=1)
                
                if item[0] == 'result':
                    result = item[1]
                    if result['status'] == 'live':
                        self.live_count += 1
                    elif result['status'] == 'dead':
                        self.dead_count += 1
                    else:
                        self.unknown_count += 1
                    
                    self.print_result(result)
                    self.print_stats()
                
                elif item[0] == 'error':
                    card_data, error_message = item[1], item[2]
                    self.unknown_count += 1
                    self.print_error(card_data, error_message)
                    self.print_stats()
                
                elif item[0] == 'thread_done':
                    active_threads -= 1
                    
            except:
                # Timeout: check if all threads have actually finished
                alive = sum(1 for t in worker_threads if t.is_alive())
                if alive == 0 and self.update_queue.empty():
                    break
                continue
        
        print("\n" + "="*60)
        print("Card checking completed!")
        self.print_stats()
        print("="*60 + "\n")

def main():
    checker = CardChecker()
    
    # If no arguments provided, use default cards.txt file
    if len(sys.argv) == 1:
        import os
        default_file = "cards.txt"
        if os.path.exists(default_file):
            sys.argv.append(default_file)
    
    try:
        checker.run_interactive()
    except KeyboardInterrupt:
        print("\n\nStopped by user")
        checker.print_stats()
    except Exception as e:
        print(f"\nError: {e}")

if __name__ == "__main__":
    main()