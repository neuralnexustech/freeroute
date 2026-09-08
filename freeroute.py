#!/usr/bin/env python3
"""
Freeroute AI Gateway Validation Script
Tests both Combos (Intelligent Fallback Routing) and Normal Models via OpenAI-compatible endpoints.
Usage:
    python freeroute.py
    python freeroute.py --combo smart-coding-fallback
    python freeroute.py --model gemini-2.5-flash
"""

import os
import sys
import time
import json
import argparse
import urllib.request
import urllib.error
from pathlib import Path

# Ensure Windows PowerShell consoles handle unicode replies gracefully
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def get_gateway_url():
    """Detects the port from .env or environment variable."""
    port = os.environ.get("PORT")
    if not port:
        candidates = [
            Path(".env"),
            Path("freeroute/.env"),
            Path(__file__).parent / ".env",
            Path(__file__).parent / "freeroute" / ".env",
        ]
        for c in candidates:
            if c.is_file():
                try:
                    with open(c, "r", encoding="utf-8") as f:
                        for line in f:
                            line = line.strip()
                            if line.startswith("PORT="):
                                port = line.split("=", 1)[1].strip()
                                break
                    if port:
                        break
                except Exception:
                    pass
    port = port or "20129"
    return f"http://127.0.0.1:{port}"


def http_request(url, method="GET", headers=None, body=None, timeout=35):
    """Simple robust HTTP helper using urllib."""
    headers = headers or {}
    data = None
    if body is not None:
        if isinstance(body, (dict, list)):
            data = json.dumps(body).encode("utf-8")
            headers["Content-Type"] = "application/json"
        elif isinstance(body, str):
            data = body.encode("utf-8")
        elif isinstance(body, bytes):
            data = body

    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    start_time = time.time()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            elapsed_ms = int((time.time() - start_time) * 1000)
            status = resp.status
            content = resp.read().decode("utf-8", errors="replace")
            try:
                parsed = json.loads(content)
            except Exception:
                parsed = content
            return status, parsed, elapsed_ms, None
    except urllib.error.HTTPError as e:
        elapsed_ms = int((time.time() - start_time) * 1000)
        status = e.code
        err_content = e.read().decode("utf-8", errors="replace")
        try:
            parsed = json.loads(err_content)
        except Exception:
            parsed = err_content
        return status, parsed, elapsed_ms, f"HTTP {status}"
    except Exception as e:
        elapsed_ms = int((time.time() - start_time) * 1000)
        return 0, None, elapsed_ms, str(e)


def get_or_create_api_key(base_url):
    """Retrieves an existing API key or provisions a temporary test key."""
    # 1. Environment variable override
    env_key = os.environ.get("FREEROUTE_API_KEY")
    if env_key:
        return env_key, None

    # 2. Try to reveal an existing vaulted key from the dashboard
    status, data, _, _ = http_request(f"{base_url}/api/api-keys")
    if status == 200 and isinstance(data, dict) and data.get("keys"):
        for k in data["keys"]:
            if not k.get("revoked"):
                key_id = k.get("id")
                r_status, r_data, _, _ = http_request(f"{base_url}/api/api-keys/{key_id}/reveal")
                if r_status == 200 and isinstance(r_data, dict) and r_data.get("secret"):
                    return r_data["secret"], None

    # 3. Provision a test key via API
    status, data, _, _ = http_request(
        f"{base_url}/api/api-keys",
        method="POST",
        body={"name": "freeroute-py-verifier", "expire": "never"},
    )
    if status == 200 and isinstance(data, dict) and data.get("secret"):
        return data["secret"], data.get("id")

    # Fallback to standard local gateway token
    return "xpl_gateway_key", None


def delete_api_key(base_url, key_id):
    """Deletes temporary API key if one was created."""
    if key_id:
        http_request(f"{base_url}/api/api-keys/{key_id}", method="DELETE")


def test_chat_completion(base_url, api_key, model_identifier, prompt, is_combo=False):
    """Sends a chat completion request to /v1/chat/completions."""
    payload = {
        "model": model_identifier,
        "messages": [
            {"role": "system", "content": "You are a helpful and concise AI assistant. Respond in 1-2 short sentences."},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.3,
        "max_tokens": 120,
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "x-client-name": "freeroute-python-bench",
    }

    url = f"{base_url}/v1/chat/completions"
    status, data, latency_ms, err = http_request(url, method="POST", headers=headers, body=payload, timeout=45)

    result = {
        "model": model_identifier,
        "is_combo": is_combo,
        "status": status,
        "latency_ms": latency_ms,
        "success": False,
        "reply": "",
        "provider": "",
        "error": "",
    }

    if status == 200 and isinstance(data, dict):
        result["success"] = True
        result["provider"] = data.get("provider", "Gateway")
        choices = data.get("choices", [])
        if choices and len(choices) > 0:
            result["reply"] = choices[0].get("message", {}).get("content", "").strip()
        else:
            result["reply"] = str(data)
    else:
        result["success"] = False
        if isinstance(data, dict) and "error" in data:
            err_obj = data["error"]
            result["error"] = err_obj.get("message") if isinstance(err_obj, dict) else str(err_obj)
        elif err:
            result["error"] = err
        else:
            result["error"] = f"HTTP {status}"

    return result


def main():
    parser = argparse.ArgumentParser(
        description="Freeroute AI Gateway Validation Tool",
        epilog="Examples:\n  python freeroute.py\n  python freeroute.py --combo smart-coding-fallback message hi\n  python freeroute.py --combo smart-coding-fallback --message \"hi\"\n  python freeroute.py --model gemini-2.5-flash message \"hi\"",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--combo", "-c", type=str, help="Specific combo name to test")
    parser.add_argument("--model", type=str, help="Specific normal model slug to test")
    parser.add_argument("--message", "--prompt", "-m", "-p", type=str, default=None, help="Prompt/message to send")
    parser.add_argument("extra_words", nargs="*", help="Optional trailing message words (e.g. message hi)")
    args = parser.parse_args()

    # Resolve message from flag or positional arguments
    user_message = args.message
    if not user_message and args.extra_words:
        words = list(args.extra_words)
        if len(words) > 1 and words[0].lower() in ["message", "msg", "prompt", ":"]:
            user_message = " ".join(words[1:])
        else:
            user_message = " ".join(words)

    prompt = user_message if user_message else "Explain recursion in exactly two sentences."

    base_url = get_gateway_url()
    print("=" * 72)
    print("              FREEROUTE GATEWAY API VERIFICATION RUNNER               ")
    print("=" * 72)
    print(f"Target Gateway Endpoint: {base_url}/v1")

    # 1. Check Gateway Connectivity & Catalog
    print("\n[*] Checking Gateway health & catalog via GET /v1/models...")
    status, models_data, latency, err = http_request(f"{base_url}/v1/models", timeout=8)
    if status != 200:
        print(f"[-] ERROR: Gateway is not responding on {base_url} (HTTP {status}: {err})")
        print("    Ensure the Freeroute server is running with 'npm run dev' or 'npm start'.")
        sys.exit(1)

    all_models = models_data.get("data", []) if isinstance(models_data, dict) else []
    print(f"[+] Gateway is online! Found {len(all_models)} available models/combos in catalog.")

    # 2. Get or Provision API Key
    api_key, created_key_id = get_or_create_api_key(base_url)
    masked_key = api_key[:8] + "..." + api_key[-4:] if len(api_key) > 14 else api_key
    print(f"[+] Authenticating with API Key: {masked_key}")

    # 3. Discover Combos & Providers
    status, combos_data, _, _ = http_request(f"{base_url}/api/combos")
    combos_list = combos_data.get("combos", []) if isinstance(combos_data, dict) else []

    status, prov_data, _, _ = http_request(f"{base_url}/api/providers")
    connected_providers = [p for p in prov_data.get("providers", []) if p.get("connected")]
    connected_names = [f"{p['name']} ({p['_count']['models'] if '_count' in p else p.get('modelCount', 0)} models)" for p in connected_providers]
    print(f"[+] Connected Providers ({len(connected_providers)}): {', '.join(connected_names)}")

    results = []

    # Single-target mode vs Full batch mode
    testing_only_combo = bool(args.combo and not args.model)
    testing_only_model = bool(args.model and not args.combo)

    # =========================================================================
    # PART 1: TEST COMBOS (Virtual Multi-Tier Fallback Routing)
    # =========================================================================
    if not testing_only_model:
        print("\n" + "=" * 72)
        print(" 1. TESTING INTELLIGENT COMBOS (Virtual Multi-Tier Endpoints)")
        print("=" * 72)

        combos_to_test = []
        if args.combo:
            combos_to_test = [c for c in combos_list if c.get("name") == args.combo]
            if not combos_to_test:
                combos_to_test = [{"name": args.combo, "strategy": "failover", "targets": []}]
        else:
            # Default: test configured combos with targets
            combos_to_test = [c for c in combos_list if len(c.get("targets", [])) > 0]
            if not combos_to_test and combos_list:
                combos_to_test = [combos_list[0]]

        if not combos_to_test:
            print("[-] No combos configured yet. Create one under Dashboard -> Combos.")
        else:
            for c in combos_to_test:
                combo_name = c.get("name")
                strategy = c.get("strategy", "failover")
                targets = c.get("targets", [])
                target_desc = [f"Tier {t.get('priority', i)+1}: {t.get('model', {}).get('displayName') or t.get('modelId')}" for i, t in enumerate(targets)]

                print(f"\n[COMBO] '{combo_name}' | Strategy: {strategy}")
                if target_desc:
                    for td in target_desc:
                        print(f"        -> {td}")

                print(f"   Sending request to: POST {base_url}/v1/chat/completions ...")
                print(f"   User Message: \"{prompt}\"")
                res = test_chat_completion(
                    base_url=base_url,
                    api_key=api_key,
                    model_identifier=combo_name,
                    prompt=prompt,
                    is_combo=True,
                )
                results.append(res)

                if res["success"]:
                    print(f"   [SUCCESS] Status: {res['status']} OK (Latency: {res['latency_ms']}ms)")
                    if res["provider"]:
                        print(f"   Handled by: {res['provider']}")
                    print(f"   AI Response:\n   \"{res['reply']}\"")
                else:
                    print(f"   [FAILED] Status: {res['status']} (Latency: {res['latency_ms']}ms)")
                    print(f"   Error: {res['error']}")

    # =========================================================================
    # PART 2: TEST NORMAL INDIVIDUAL MODELS (Direct Model Slugs)
    # =========================================================================
    if not testing_only_combo:
        print("\n" + "=" * 72)
        print(" 2. TESTING NORMAL INDIVIDUAL MODELS (Direct Model Routing)")
        print("=" * 72)

        models_to_test = []
        if args.model:
            models_to_test = [args.model]
        else:
            # Pick reliable connected models from Google, OpenRouter, NVIDIA
            preferred = [
                "gemini-2.5-flash",
                "cohere/north-mini-code:free",
                "meta/llama-3.2-11b-vision-instruct",
            ]
            available_ids = {m.get("id") for m in all_models if not m.get("isCombo")}
            for p in preferred:
                if p in available_ids:
                    models_to_test.append(p)

            # If none of preferred found, pick first 2 normal models
            if not models_to_test:
                models_to_test = [m.get("id") for m in all_models if not m.get("isCombo")][:2]

        model_prompt = prompt if user_message else "What is 25 * 4? Return just the number."

        for model_id in models_to_test:
            model_meta = next((m for m in all_models if m.get("id") == model_id), {})
            owner = model_meta.get("owned_by") or "Unknown"

            print(f"\n[MODEL] '{model_id}' | Provider: {owner}")
            print(f"   Sending request to: POST {base_url}/v1/chat/completions ...")
            print(f"   User Message: \"{model_prompt}\"")

            res = test_chat_completion(
                base_url=base_url,
                api_key=api_key,
                model_identifier=model_id,
                prompt=model_prompt,
                is_combo=False,
            )
            res["provider_slug"] = owner
            results.append(res)

        if res["success"]:
            print(f"   [SUCCESS] Status: {res['status']} OK (Latency: {res['latency_ms']}ms)")
            print(f"   AI Response:\n   \"{res['reply']}\"")
        else:
            print(f"   [FAILED] Status: {res['status']} (Latency: {res['latency_ms']}ms)")
            print(f"   Error: {res['error']}")

    # =========================================================================
    # SUMMARY REPORT
    # =========================================================================
    print("\n" + "=" * 72)
    print("                        TEST RESULTS SUMMARY                          ")
    print("=" * 72)
    print(f"{'Type':<8} | {'Identifier':<32} | {'Status':<7} | {'Latency':<9} | Sample Output")
    print("-" * 72)

    for r in results:
        kind = "COMBO" if r["is_combo"] else "MODEL"
        ident = (r["model"][:29] + "...") if len(r["model"]) > 32 else r["model"]
        st = "200 OK" if r["success"] else f"ERR {r['status']}"
        lat = f"{r['latency_ms']}ms"
        note = (r["reply"][:32] + "...") if r["success"] else (r["error"][:32] + "...")
        print(f"{kind:<8} | {ident:<32} | {st:<7} | {lat:<9} | {note}")

    print("=" * 72)

    # Cleanup temporary key if one was created
    if created_key_id:
        delete_api_key(base_url, created_key_id)

    passed = sum(1 for r in results if r["success"])
    total = len(results)
    print(f"Result: {passed}/{total} tests passed.\n")


if __name__ == "__main__":
    main()
