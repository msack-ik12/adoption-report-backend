"""
Fetch active district/organization names from Snowflake and cache them as JSON.

Uses the same key-pair auth as InformedK12_AI. Reads Snowflake credentials from
the InformedK12_AI .env file (or its own .env) and queries dim_organization.

Usage:
    python scripts/refresh_districts.py

The output is written to data/districts.json, which the backend reads
for GET /sigma/districts.
"""

import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
OUTPUT_FILE = PROJECT_ROOT / "data" / "districts.json"

# Try loading .env from the AI repo first (has Snowflake creds), then local
AI_REPO = Path(os.getenv("IK12_AI_REPO", r"C:\Users\msack\InformedK12_AI"))
AI_ENV = AI_REPO / "analyses" / "package_expansion_by_territory" / ".env"
if AI_ENV.exists():
    load_dotenv(AI_ENV)
load_dotenv(PROJECT_ROOT / ".env")  # local overrides

# ---------------------------------------------------------------------------
# Snowflake connection (adapted from InformedK12_AI/from_snowflake.py)
# ---------------------------------------------------------------------------

QUERY = """
SELECT DISTINCT organization_name
FROM PRODUCTION_DB.ANALYTICS.dim_organization
WHERE organization_name IS NOT NULL
  AND organization_name != ''
ORDER BY organization_name
"""

# Fallback: try staging layer if analytics layer not available
QUERY_FALLBACK = """
SELECT DISTINCT account_name AS organization_name
FROM PRODUCTION_DB.STAGING.stg_account
WHERE account_name IS NOT NULL
  AND LOWER(account_status) = '6. current client'
ORDER BY account_name
"""


def connect_snowflake():
    """Connect to Snowflake using key-pair auth."""
    try:
        import snowflake.connector
    except ImportError:
        print("ERROR: snowflake-connector-python not installed.")
        print("  pip install snowflake-connector-python cryptography")
        sys.exit(1)

    account = os.getenv("SNOWFLAKE_ACCOUNT")
    user = os.getenv("SNOWFLAKE_USER")
    if not account or not user:
        print("ERROR: SNOWFLAKE_ACCOUNT and SNOWFLAKE_USER must be set.")
        print(f"  Looked in: {AI_ENV}")
        sys.exit(1)

    connect_kwargs = {
        "account": account,
        "user": user,
        "role": os.getenv("SNOWFLAKE_ROLE", "PROD_ANALYST_ROLE"),
        "warehouse": os.getenv("SNOWFLAKE_WAREHOUSE", "COMPUTE_WH"),
        "database": os.getenv("SNOWFLAKE_DATABASE", "PRODUCTION_DB"),
        "schema": os.getenv("SNOWFLAKE_SCHEMA", "STAGING"),
    }

    key_path = os.getenv("SNOWFLAKE_PRIVATE_KEY_PATH", "snowflake_key.p8")
    key_file = Path(key_path)

    # Resolve relative paths — check AI repo root and walk up
    if not key_file.is_absolute():
        candidates = [
            AI_REPO / "analyses" / "package_expansion_by_territory" / key_file,
            AI_REPO / key_file.name,
            PROJECT_ROOT / key_file,
        ]
        for c in candidates:
            if c.exists():
                key_file = c
                break

    if not key_file.exists():
        print(f"ERROR: Private key not found. Tried: {key_path}")
        print(f"  Also checked: {AI_REPO / key_file.name}")
        sys.exit(1)

    from cryptography.hazmat.backends import default_backend
    from cryptography.hazmat.primitives import serialization

    passphrase = os.getenv("SNOWFLAKE_PRIVATE_KEY_PASSPHRASE", "")
    with open(key_file, "rb") as f:
        p_key = serialization.load_pem_private_key(
            f.read(),
            password=passphrase.encode() if passphrase else None,
            backend=default_backend(),
        )
    pkb = p_key.private_bytes(
        encoding=serialization.Encoding.DER,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    connect_kwargs["private_key"] = pkb
    print(f"  Auth: key-pair ({key_file.name})")

    return snowflake.connector.connect(**connect_kwargs)


def fetch_districts(conn) -> list[str]:
    """Run the district query, falling back to stg_account if needed."""
    cur = conn.cursor()
    try:
        print("  Querying dim_organization...")
        cur.execute(QUERY)
        rows = cur.fetchall()
        if rows:
            return [r[0] for r in rows if r[0]]
    except Exception as e:
        print(f"  dim_organization query failed: {e}")
        print("  Falling back to stg_account...")

    try:
        cur.execute(QUERY_FALLBACK)
        rows = cur.fetchall()
        return [r[0] for r in rows if r[0]]
    except Exception as e:
        print(f"  stg_account query also failed: {e}")
        return []
    finally:
        cur.close()


def main():
    print("Refreshing district list from Snowflake...")
    conn = connect_snowflake()
    try:
        districts = fetch_districts(conn)
    finally:
        conn.close()

    # Ensure output directory exists
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)

    # Write cache
    with open(OUTPUT_FILE, "w") as f:
        json.dump({"districts": districts, "count": len(districts)}, f, indent=2)

    print(f"  Wrote {len(districts)} districts to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
