"""
BundleForge AI microservice (M-124).

Lightweight Flask app exposing:

    GET  /health
    POST /recommendations

`/recommendations` accepts:
    {
      "baskets": [["sku-1","sku-2"], ...],
      "target": "sku-1",
      "top_n": 5
    }

and returns the FBT ranking from `recommender.recommend_for`.
"""
from __future__ import annotations

import os
from typing import Tuple

from flask import Flask, jsonify, request

from recommender import recommend_for

app = Flask(__name__)
EXPECTED_KEY = os.environ.get("AI_SERVICE_API_KEY", "")


def _check_auth() -> Tuple[bool, str]:
    if not EXPECTED_KEY:
        return True, ""
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return False, "missing bearer token"
    token = header[len("Bearer ") :]
    if token != EXPECTED_KEY:
        return False, "invalid token"
    return True, ""


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "bundleforge-ai"})


@app.route("/recommendations", methods=["POST"])
def recommendations():
    ok, reason = _check_auth()
    if not ok:
        return jsonify({"error": reason}), 401
    payload = request.get_json(silent=True) or {}
    baskets = payload.get("baskets") or []
    target = payload.get("target")
    top_n = int(payload.get("top_n") or 5)
    if not isinstance(target, str) or not target:
        return jsonify({"error": "target is required"}), 400
    if not isinstance(baskets, list):
        return jsonify({"error": "baskets must be a list"}), 400
    out = recommend_for(baskets, target, top_n=top_n)
    return jsonify({"target": target, "recommendations": out})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5001"))
    app.run(host="0.0.0.0", port=port, debug=False)
