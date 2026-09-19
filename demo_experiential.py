"""
Experiential Labs API & Free Models Demonstration Script
Run: python demo_experiential.py
"""
import urllib.request
import urllib.error
import json
import ssl

API_KEY = "xpl_ee8b805e5f57a1dc887ddd045d7f89a41ed43e1a"
BASE_URL = "https://api.experientiallabs.ai/v1"
ctx = ssl.create_default_context()

def check_models():
    print("=" * 75)
    print("1. Validating API Key via GET /v1/models")
    print("=" * 75)
    url = f"{BASE_URL}/models"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {API_KEY}"})
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            models = [m["id"] for m in data.get("data", [])]
            print(f"  [SUCCESS 200 OK] Key is VALID!")
            print(f"  Total models available: {len(models)}")
            print(f"  Sample models: {models[:6]}")
            return models
    except urllib.error.HTTPError as e:
        print(f"  [FAIL HTTP {e.code}]: {e.read().decode()}")
        return []

def test_completion(model_id: str):
    url = f"{BASE_URL}/chat/completions"
    payload = json.dumps({
        "model": model_id,
        "messages": [{"role": "user", "content": "hi"}],
        "max_tokens": 5
    }).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json"
        },
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=10) as resp:
            data = resp.read().decode("utf-8")
            print(f"  [HTTP 200 OK] {model_id:<28} -> {data[:120]}")
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8", errors="replace")
        try:
            msg = json.loads(err).get("error", {}).get("message", err)
        except Exception:
            msg = err
        print(f"  [HTTP {e.code}]    {model_id:<28} -> {msg[:140]}")

def main():
    models = check_models()
    if not models:
        return

    print("\n" + "=" * 75)
    print("2. Testing Free / Promotional Models on Experiential Labs")
    print("=" * 75)
    
    test_models = [
        "gpt-5.6-luna",
        "nemotron-3-ultra-550b-a55b",
        "qwen3.8-27b",
        "deepseek-v3",
        "claude-3-haiku",
    ]
    for m in test_models:
        test_completion(m)

    print("\n" + "=" * 75)
    print("Policy Requirement Identified:")
    print("Experiential Labs requires a one-time $1 card verification on the account:")
    print("Link: https://platform.experientiallabs.ai/credits?add-card=1")
    print("(The $1 is credited directly to your balance, unlocking the free daily tiers).")
    print("=" * 75)

if __name__ == "__main__":
    main()
