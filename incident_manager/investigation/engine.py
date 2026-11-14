
from database import get_incident_router, create_investigation, save_evidence, finish_investigation

from .collectors.prometheus import collect_node_status , collect_cpu_usage , collect_memory_usage

def run_investigation(incident_id: int) -> dict:

    #Identify the affected router
    router_name = get_incident_router(incident_id)

    if router_name is None:
        return {
            "success": False,
            "error": "incident_router_not_found"
        }

    #Create investigation
    investigation_id = create_investigation(incident_id)

    if investigation_id is None:
        return {
            "success": False,
            "error": "incident_not_found"
        }

    try:
        evidence_ids = []

        #Check router availability
        node_status_data = collect_node_status(router_name)

        #Save Node Status evidence
        evidence_id = save_evidence(
            investigation_id=investigation_id,
            check_type=node_status_data["check_type"],
            status=node_status_data["status"],
            result=node_status_data["result"]
        )

        evidence_ids.append(evidence_id)

        #Define metric collectors
        metric_collectors = [
            collect_cpu_usage,
            collect_memory_usage
        ]

        skipped_collectors = []

        #Run metric collectors only if router is UP
        if node_status_data["status"] == "success":

            for collector in metric_collectors:

                evidence_data = collector(router_name)

                evidence_id = save_evidence(
                    investigation_id=investigation_id,
                    check_type=evidence_data["check_type"],
                    status=evidence_data["status"],
                    result=evidence_data["result"]
                )

                evidence_ids.append(evidence_id)

        else:
            for collector in metric_collectors:
                skipped_collectors.append(collector.__name__)

        #Finish investigation
        finished = finish_investigation(
            investigation_id,
            "completed"
        )

        if not finished["success"]:
            raise RuntimeError(
                f"Cannot finish investigation: {finished}"
            )

        #Return investigation summary
        return {
            "success": True,
            "investigation_id": investigation_id,
            "incident_id": incident_id,
            "router": router_name,
            "status": "completed",
            "evidence_ids": evidence_ids,
            "evidence_count": len(evidence_ids),
            "skipped_collectors": skipped_collectors
        }

    except Exception:

        #Mark investigation as failed if possible
        try:
            finish_investigation(investigation_id, "failed")
        except Exception:
            pass

        raise