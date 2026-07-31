from fastapi.testclient import TestClient
from app import app

client = TestClient(app)

def test_gpu_status():
    response = client.get("/api/status")
    assert response.status_code == 200
    data = response.json()
    assert "gpu_available" in data
