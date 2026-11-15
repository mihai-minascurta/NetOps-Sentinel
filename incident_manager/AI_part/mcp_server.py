import diagnosis_queries
from mcp.server import MCPServer
from mcp.server.mcpserver.exceptions import ToolError

mcp = MCPServer("NetOps Sentinel")


@mcp.tool()
def get_investigation(investigation_id: int) -> dict:
    
    """Retrieve investigation details by ID, including
    its incident ID, status, and timestamps."""

    if investigation_id <= 0:
        raise ToolError("investigation_id must be a positive integer.")

    investigation = diagnosis_queries.get_investigation(investigation_id)

    if investigation is None:
        raise ToolError(f"Investigation {investigation_id} was not found.")

    return investigation


if __name__ == "__main__":
    mcp.run()