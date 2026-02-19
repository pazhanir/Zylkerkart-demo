import os
import random
import logging
import threading
import time
from io import BytesIO

from fastapi import APIRouter, UploadFile, File

router = APIRouter(prefix="/simulate", tags=["chaos"])

logger = logging.getLogger(__name__)

# Chaos state
chaos_state = {
    "random_500_active": False,
    "log_flood_active": False,
}

_log_flood_thread = None


@router.post("/random-500")
async def start_random_500():
    """Enable random 500 errors on payment processing"""
    chaos_state["random_500_active"] = True
    logger.warning("[CHAOS] Random 500 errors enabled!")
    return {
        "chaos": "random-500",
        "status": "started",
        "message": "~50% of payment requests will now return 500 errors",
    }


@router.post("/random-500/stop")
async def stop_random_500():
    chaos_state["random_500_active"] = False
    logger.info("[CHAOS] Random 500 errors disabled")
    return {"chaos": "random-500", "status": "stopped"}


@router.post("/large-upload")
async def simulate_large_upload(file: UploadFile = File(None)):
    """
    Accept arbitrarily large file uploads to stress memory/bandwidth.
    If no file is sent, generate a 100MB in-memory blob.
    """
    logger.warning("[CHAOS] Large upload simulation!")

    if file:
        content = await file.read()
        size = len(content)
        logger.warning(f"[CHAOS] Received upload: {size} bytes")
        return {
            "chaos": "large-upload",
            "file_name": file.filename,
            "size_bytes": size,
            "size_mb": round(size / (1024 * 1024), 2),
        }
    else:
        # Generate 100MB in-memory
        blob_size = 100 * 1024 * 1024  # 100 MB
        logger.warning(f"[CHAOS] Generating {blob_size} byte in-memory blob")
        data = bytearray(os.urandom(1024) * (blob_size // 1024))
        return {
            "chaos": "large-upload",
            "generated_size_bytes": len(data),
            "generated_size_mb": round(len(data) / (1024 * 1024), 2),
            "message": "100MB blob generated in memory",
        }


@router.post("/bulk-insert")
async def simulate_bulk_insert():
    """Insert thousands of dummy transactions to stress the DB"""
    logger.warning("[CHAOS] Bulk insert storm started!")

    from app.config.database import get_connection

    conn = get_connection()
    inserted = 0
    try:
        cursor = conn.cursor()
        batch_size = 500
        total = 5000

        for batch_start in range(0, total, batch_size):
            values = []
            for i in range(batch_start, min(batch_start + batch_size, total)):
                txn_ref = f"CHAOS-BULK-{i:06d}"
                amount = round(random.uniform(100, 10000), 2)
                values.append(
                    f"('{txn_ref}', 0, 0, {amount}, 'USD', 'wallet', 'failed', 0.99, NOW())"
                )

            sql = f"""INSERT IGNORE INTO transactions 
                      (transaction_ref, order_id, user_id, amount, currency, method, 
                       status, fraud_score, created_at) 
                      VALUES {', '.join(values)}"""
            cursor.execute(sql)
            inserted += cursor.rowcount

        conn.commit()
        logger.warning(f"[CHAOS] Bulk insert complete: {inserted} rows")
    except Exception as e:
        conn.rollback()
        logger.error(f"[CHAOS] Bulk insert failed: {e}")
        return {"chaos": "bulk-insert", "error": str(e)}
    finally:
        cursor.close()
        conn.close()

    return {
        "chaos": "bulk-insert",
        "inserted": inserted,
        "target": 5000,
        "message": "Bulk insert storm complete - check DB performance",
    }


@router.post("/log-flood")
async def start_log_flood():
    """Flood stdout/stderr with log messages"""
    global _log_flood_thread

    if chaos_state["log_flood_active"]:
        return {"chaos": "log-flood", "status": "already-running"}

    chaos_state["log_flood_active"] = True
    logger.warning("[CHAOS] Log flood started!")

    def flood():
        count = 0
        while chaos_state["log_flood_active"]:
            count += 1
            level = random.choice(["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"])
            msg = f"[CHAOS-LOG-FLOOD] [{level}] Iteration {count} - " + "X" * random.randint(100, 500)

            if level == "ERROR":
                logger.error(msg)
            elif level == "WARNING":
                logger.warning(msg)
            elif level == "CRITICAL":
                logger.critical(msg)
            else:
                logger.info(msg)

            # ~1000 lines per second
            if count % 100 == 0:
                time.sleep(0.1)

    _log_flood_thread = threading.Thread(target=flood, daemon=True)
    _log_flood_thread.start()

    return {
        "chaos": "log-flood",
        "status": "started",
        "message": "Flooding logs at ~1000 lines/sec. Call POST /simulate/log-flood/stop to end.",
    }


@router.post("/log-flood/stop")
async def stop_log_flood():
    chaos_state["log_flood_active"] = False
    logger.info("[CHAOS] Log flood stopped")
    return {"chaos": "log-flood", "status": "stopped"}


@router.get("/status")
async def get_chaos_status():
    return {
        "random_500_active": chaos_state["random_500_active"],
        "log_flood_active": chaos_state["log_flood_active"],
    }
