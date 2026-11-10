
from database import get_incident_router, create_investigation, save_evidence, finish_investigation

from .collectors.prometheus import collect_node_status


def run_investigation(incident_id: int) -> dict:

    # 1. Identify the affected router
    router_name = get_incident_router(incident_id)

    if router_name is None:
        return {
            "success": False,
            "error": "incident_router_not_found"
        }

    # 2. Create investigation
    investigation_id = create_investigation(incident_id)

    if investigation_id is None:
        return {
            "success": False,
            "error": "incident_not_found"
        }

    try:
        # 3. Collect evidence from Prometheus
        evidence_data = collect_node_status(router_name)

        # 4. Save evidence in SQLite
        evidence_id = save_evidence(
            investigation_id=investigation_id,
            check_type=evidence_data["check_type"],
            status=evidence_data["status"],
            result=evidence_data["result"]
        )

        # 5. Finish investigation
        finished = finish_investigation(
            investigation_id,
            "completed"
        )

        if not finished["success"]:
            raise RuntimeError(
                f"Cannot finish investigation: {finished}"
            )

        # 6. Return investigation summary
        return {
            "success": True,
            "investigation_id": investigation_id,
            "incident_id": incident_id,
            "router": router_name,
            "status": "completed",
            "evidence_id": evidence_id
        }

    except Exception:
        # Mark investigation as failed if possible
        try:
            finish_investigation(investigation_id, "failed")
        except Exception:
            pass
        # Propagate the original error
        raise
