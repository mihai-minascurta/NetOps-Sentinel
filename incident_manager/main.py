from fastapi import FastAPI

app = FastAPI()

@app.post("/webhook/alerts")
def receive_alerts(data: dict):
    status = data.get("status")
    return {"received": True , "status": status}