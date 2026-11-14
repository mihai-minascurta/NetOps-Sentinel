import requests

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

def collect_cpu_usage(router: str) -> dict:

    threshold = 90
    window = "5m"

    node_status = collect_node_status(router)

    if node_status["status"] != "success":
        return {
            "check_type": "cpu_usage",
            "status": node_status["status"],
            "result": {
                "router": router,
                "error": "CPU collection skipped because router is unavailable",
            },
        }

    #Calculate CPU usage
    promql = f"""
    100 * (
        1 - avg by (router) (
            rate(node_cpu_seconds_total{{router="{router}", mode="idle"}}[{window}])
        )
    )
    """

    results = query_prometheus(promql)

    if not results:
        return {
            "check_type": "cpu_usage",
            "status": "error",
            "result": {
                "router": router,
                "error": "no CPU data returned by Prometheus",
            },
        }

    cpu_usage = float(results[0]["value"][1])

    #Determine status based on threshold
    status = "warning" if cpu_usage >= threshold else "success"

    return {
        "check_type": "cpu_usage",
        "status": status,
        "result": {
            "router": router,
            "usage_percent": round(cpu_usage, 2),
            "threshold_percent": threshold,
            "window": window,
        },
    }