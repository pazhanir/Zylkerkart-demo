import os
import random
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from app.routers import payment, chaos
from app.config.database import get_pool

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize DB pool
    logger.info("Payment Service starting up...")
    get_pool()
    yield
    # Shutdown
    logger.info("Payment Service shutting down...")


app = FastAPI(
    title="ZylkerKart Payment Service",
    description="Mock payment processing with fraud scoring and chaos endpoints",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Random 500 chaos middleware
@app.middleware("http")
async def chaos_random_500_middleware(request: Request, call_next):
    if (
        chaos.chaos_state.get("random_500_active")
        and request.url.path.startswith("/payments")
        and random.random() < 0.5
    ):
        logger.error(f"[CHAOS] Random 500 triggered for {request.method} {request.url.path}")
        return Response(
            content='{"error": "Internal Server Error", "chaos": true}',
            status_code=500,
            media_type="application/json",
        )
    return await call_next(request)


# Routes
app.include_router(payment.router)
app.include_router(chaos.router)


@app.get("/health")
async def health():
    db_status = "UP"
    try:
        conn = get_pool().get_connection()
        conn.ping(reconnect=True)
        conn.close()
    except Exception as e:
        db_status = f"DOWN: {e}"

    status = "UP" if db_status == "UP" else "DEGRADED"
    return {
        "service": "payment-service",
        "status": status,
        "checks": {"mysql": {"status": db_status}},
    }


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "8084"))
    logger.info(f"💳 Payment Service running on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
