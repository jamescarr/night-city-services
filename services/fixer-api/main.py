"""
Fixer's Inventory API - Night City Black Market

This API manages cyberware reservations for Night City's fixers.
It simulates a flaky service that rate-limits requests, demonstrating
Temporal's retry capabilities.

By default, the API returns 429 (Too Many Requests) for the first 3 attempts
before succeeding. Pass `skip_rate_limit=true` to bypass this behavior.
"""

from fastapi import FastAPI, HTTPException, Query, Header
from pydantic import BaseModel
from datetime import datetime, timedelta
from typing import Optional
import uuid
import time

app = FastAPI(
    title="Fixer's Inventory API",
    description="Night City Black Market Cyberware Reservations",
    version="2077.1.0"
)

# In-memory storage for reservations and request tracking
reservations: dict[str, dict] = {}
request_counts: dict[str, int] = {}  # Track retries per request

# Fixer catalog
FIXERS = {
    "Arasaka": {"id": "FIX-001", "name": "Wakako Okada", "specialty": "Corporate imports"},
    "Militech": {"id": "FIX-002", "name": "Rogue Amendiares", "specialty": "Military hardware"},
    "Zetatech": {"id": "FIX-003", "name": "Padre", "specialty": "Budget chrome"},
    "Kang Tao": {"id": "FIX-004", "name": "Mr. Hands", "specialty": "Eastern tech"},
    "default": {"id": "FIX-005", "name": "Dexter DeShawn", "specialty": "General fixer"},
}


class ReservationRequest(BaseModel):
    runner_id: str
    runner_handle: str
    cyberware_id: str
    cyberware_name: str
    manufacturer: str
    base_price: float
    runner_reputation: int = 0


class ReservationResponse(BaseModel):
    reservation_id: str
    cyberware_id: str
    fixer_id: str
    fixer_name: str
    runner_id: str
    reserved_at: str
    expires_at: str
    status: str
    unit_price: float
    quantity: int


class ReleaseRequest(BaseModel):
    reason: str


class ReleaseResponse(BaseModel):
    reservation_id: str
    released_at: str
    reason: str
    restock_fee: float


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "online", "location": "Night City", "year": 2077}


@app.post("/reservations", response_model=ReservationResponse)
async def create_reservation(
    request: ReservationRequest,
    x_request_id: Optional[str] = Header(None, alias="X-Request-ID"),
    skip_rate_limit: bool = Query(False, description="Skip rate limiting (for testing)")
):
    """
    Reserve cyberware from a fixer's inventory.
    
    By default, returns 429 for the first 3 attempts to simulate a flaky service.
    Pass skip_rate_limit=true to bypass this behavior.
    """
    # Generate or use provided request ID for tracking retries
    request_id = x_request_id or str(uuid.uuid4())
    
    if not skip_rate_limit:
        # Track this request
        if request_id not in request_counts:
            request_counts[request_id] = 0
        request_counts[request_id] += 1
        
        attempt = request_counts[request_id]
        
        # Fail with 429 for first 3 attempts
        if attempt <= 3:
            retry_after = 10  # seconds
            print(f"[FIXER API] Request {request_id}: Attempt {attempt}/3 - Rate limited")
            raise HTTPException(
                status_code=429,
                detail={
                    "error": "rate_limit_exceeded",
                    "message": f"Too many requests, choom. Cool down. (Attempt {attempt}/3)",
                    "retry_after": retry_after,
                    "request_id": request_id
                },
                headers={"Retry-After": str(retry_after)}
            )
        
        print(f"[FIXER API] Request {request_id}: Attempt {attempt} - Proceeding with reservation")
    
    # Select fixer based on manufacturer
    fixer = FIXERS.get(request.manufacturer, FIXERS["default"])
    
    # Calculate price with reputation discount
    discount = min(request.runner_reputation * 0.5, 20)  # Max 20% discount
    final_price = request.base_price * (1 - discount / 100)
    
    # Create reservation
    reservation_id = f"RSV-{int(time.time())}-{uuid.uuid4().hex[:8]}"
    now = datetime.utcnow()
    
    reservation = {
        "reservation_id": reservation_id,
        "cyberware_id": request.cyberware_id,
        "fixer_id": fixer["id"],
        "fixer_name": fixer["name"],
        "runner_id": request.runner_id,
        "reserved_at": now.isoformat() + "Z",
        "expires_at": (now + timedelta(hours=24)).isoformat() + "Z",
        "status": "active",
        "unit_price": round(final_price, 2),
        "quantity": 1
    }
    
    reservations[reservation_id] = reservation
    
    print(f"[FIXER API] ✓ Reservation created: {reservation_id} for {request.cyberware_name}")
    print(f"[FIXER API]   Fixer: {fixer['name']}, Price: €${final_price:.2f}")
    
    return ReservationResponse(**reservation)


@app.delete("/reservations/{reservation_id}", response_model=ReleaseResponse)
async def release_reservation(
    reservation_id: str,
    request: ReleaseRequest,
    skip_rate_limit: bool = Query(False, description="Skip rate limiting (for testing)")
):
    """
    Release a cyberware reservation back to inventory.
    Called as compensation when installation fails.
    """
    if reservation_id not in reservations:
        raise HTTPException(
            status_code=404,
            detail={"error": "not_found", "message": f"Reservation {reservation_id} not found. Wrong fixer?"}
        )
    
    reservation = reservations[reservation_id]
    
    # Calculate restocking fee based on reason
    if request.reason == "installation_failed":
        restock_fee = reservation["unit_price"] * 0.15  # 15% for failed installs
    elif request.reason == "cancelled":
        restock_fee = reservation["unit_price"] * 0.10  # 10% for cancellations
    else:
        restock_fee = 0
    
    # Update reservation status
    reservation["status"] = "released"
    
    release_response = {
        "reservation_id": reservation_id,
        "released_at": datetime.utcnow().isoformat() + "Z",
        "reason": request.reason,
        "restock_fee": round(restock_fee, 2)
    }
    
    print(f"[FIXER API] ✓ Reservation {reservation_id} released. Reason: {request.reason}")
    print(f"[FIXER API]   Restocking fee: €${restock_fee:.2f}")
    
    return ReleaseResponse(**release_response)


@app.get("/reservations/{reservation_id}")
async def get_reservation(reservation_id: str):
    """Get details of a specific reservation"""
    if reservation_id not in reservations:
        raise HTTPException(
            status_code=404,
            detail={"error": "not_found", "message": f"Reservation {reservation_id} not found"}
        )
    return reservations[reservation_id]


@app.get("/fixers")
async def list_fixers():
    """List all available fixers"""
    return {"fixers": list(FIXERS.values())}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
