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

def collect_memory_usage(router: str) -> dict:

    threshold = 75
    #Calculate memory usage
    promql = f"""
    100 * (
        1 - (
            node_memory_MemAvailable_bytes{{router="{router}"}}
            /
            node_memory_MemTotal_bytes{{router="{router}"}}
        )
    )
    """
    results = query_prometheus(promql)

    if not results:
        return {
            "check_type": "memory_usage",
            "status": "error",
            "result": {
                "router": router,
                "error": "no memory data returned by Prometheus",
            },
        }

    #Extract memory usage
    memory_usage = float(results[0]["value"][1])
    status = "warning" if memory_usage > threshold else "success"

    return {
        "check_type": "memory_usage",
        "status": status,
        "result": {
            "router": router,
            "usage_percent": round(memory_usage, 2), #round it...
            "threshold_percent": threshold,
            "window": "instant",
        },
    }

def collect_disk_usage(router: str) -> dict:

    threshold = 85

    # Calculate root filesystem usage
    promql = f"""
    100 * (
        1 - (
            node_filesystem_avail_bytes{{router="{router}", mountpoint="/"}}
            /
            node_filesystem_size_bytes{{router="{router}", mountpoint="/"}}
        )
    )
    """

    results = query_prometheus(promql)

    # Check if Prometheus returned data
    if not results:
        return {
            "check_type": "disk_usage",
            "status": "error",
            "result": {
                "router": router,
                "mountpoint": "/",
                "error": "no disk data returned by Prometheus",
            },
        }

    # Extract disk usage
    disk_usage = float(results[0]["value"][1])

    # Determine status based on threshold
    status = "warning" if disk_usage > threshold else "success"

    return {
        "check_type": "disk_usage",
        "status": status,
        "result": {
            "router": router,
            "mountpoint": "/",
            "usage_percent": round(disk_usage, 2),
            "threshold_percent": threshold,
            "window": "instant",
        },
    }

def collect_network_interfaces(router: str) -> dict:

    # Check network interfaces status
    promql = f'node_network_up{{router="{router}", device!="lo"}}'
    results = query_prometheus(promql)

    if not results:
        return {
            "check_type": "network_interfaces",
            "status": "error",
            "result": {
                "router": router,
                "error": "no network interface data returned by Prometheus",
            },
        }

    # Extract interface information
    interfaces = []

    for item in results:

        interface_up = int(float(item["value"][1]))
        device = item["metric"]["device"]

        interfaces.append({
            "device": device,
            "up": interface_up,
            "status": "success" if interface_up == 1 else "warning",
        })

    # Determine overall status
    status = "success"

    for interface in interfaces:
        if interface["up"] == 0:
            status = "warning"
            break

    # Return evidence
    return {
        "check_type": "network_interfaces",
        "status": status,
        "result": {
            "router": router,
            "interface_count": len(interfaces),
            "interfaces": interfaces,
        },
    }

def collect_network_errors(router: str) -> dict:

    window = "5m"

    # Query receive errors
    rx_promql = f"""
    sum by (router, device) (
        rate(node_network_receive_errs_total{{router="{router}", device!="lo"}}[{window}])
    )
    """
    # Query transmit errors
    tx_promql = f"""
    sum by (router, device) (
        rate(node_network_transmit_errs_total{{router="{router}", device!="lo"}}[{window}])
    )
    """
    rx_results = query_prometheus(rx_promql)
    tx_results = query_prometheus(tx_promql)

    if not rx_results or not tx_results:
        return {
            "check_type": "network_errors",
            "status": "error",
            "result": {
                "router": router,
                "error": "no network error data returned by Prometheus",
            },
        }

    #Extract interface errors
    interfaces = {}

    for item in rx_results:

        device = item["metric"]["device"]

        interfaces.setdefault(device, {
            "device": device,
            "receive_errors_per_second": 0,
            "transmit_errors_per_second": 0,
        })

        interfaces[device]["receive_errors_per_second"] = float(
            item["value"][1]
        )

    for item in tx_results:

        device = item["metric"]["device"]

        interfaces.setdefault(device, {
            "device": device,
            "receive_errors_per_second": 0,
            "transmit_errors_per_second": 0,
        })

        interfaces[device]["transmit_errors_per_second"] = float(
            item["value"][1]
        )

    # Determine status for each interface
    for interface in interfaces.values():

        rx_errors = interface["receive_errors_per_second"]
        tx_errors = interface["transmit_errors_per_second"]

        if rx_errors > 0 or tx_errors > 0:
            interface["status"] = "warning"
        else:
            interface["status"] = "success"

        interface["receive_errors_per_second"] = round(rx_errors, 6)
        interface["transmit_errors_per_second"] = round(tx_errors, 6)

    # Determine overall status
    status = "success"

    for interface in interfaces.values():
        if interface["status"] == "warning":
            status = "warning"
            break

    # Return evidence
    return {
        "check_type": "network_errors",
        "status": status,
        "result": {
            "router": router,
            "interface_count": len(interfaces),
            "window": window,
            "interfaces": list(interfaces.values()),
        },
    }