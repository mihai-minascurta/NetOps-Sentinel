
from incident_manager.AI_part import diagnosis_queries
from mcp.server import MCPServer
from mcp.server.mcpserver.exceptions import ToolError

mcp = MCPServer("NetOps Sentinel")


@mcp.tool()
def get_investigation(investigation_id: int) -> dict:
    
    """Get an investigation by its ID (incident ID, status, start and end time)."""

    if investigation_id <= 0:
        raise ToolError("investigation_id must be a positive integer.")

    investigation = diagnosis_queries.get_investigation(investigation_id)

    if investigation is None:
        raise ToolError(f"Investigation {investigation_id} was not found.")

    return investigation


@mcp.tool()
def get_incident(incident_id: int) -> dict:

    """Get an incident by its ID (status, severity, open and close time, root cause)."""

    if incident_id <= 0:
        raise ToolError("incident_id must be a positive integer.")

    incident = diagnosis_queries.get_incident(incident_id)

    if incident is None:
        raise ToolError(f"Incident {incident_id} was not found.")

    return incident


if __name__ == "__main__":
    mcp.run()