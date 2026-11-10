import requests
from fastapi import HTTPException

PROMETHEUS_URL = "http://localhost:9090"

def query_prometheus(promql: str) -> list:

    url = f"{PROMETHEUS_URL}/api/v1/query"

    #Prmoetheus response through a query 
    response = requests.get(
        url,
        params={"query": promql},
        timeout=5
    )

    response.raise_for_status()

    payload = response.json()

    if payload.get("status") != "success":
        raise ValueError("Prometheus query failed")

    return payload["data"]["result"]

def collect_node_status(router: str) -> dict:

    promql = f'up{{router="{router}"}}'

    results = query_prometheus(promql)

    if not results:
        return {
            "check_type": "prometheus_up",
            "status": "error",
            "result": {
                "router": router,
                "error": "no data returned by Prometheus",
            },
        }

    up_value = int(results[0]["value"][1])  # the value arrives as a string, so convert it to int

    status = "success" if up_value == 1 else "failed"

    return {
        "check_type": "prometheus_up",
        "status": status,
        "result": {
            "router": router,
            "up": up_value,
        },
    }