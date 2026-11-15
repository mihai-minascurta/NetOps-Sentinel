import asyncio
import sys
import json
from pathlib import Path

from mcp import Client, StdioServerParameters
from mcp.types import TextContent

# Path to the MCP Server
PROJECT_ROOT = Path(__file__).resolve().parents[2]

server_params = StdioServerParameters(
    command=sys.executable,
    args=["-m", "incident_manager.AI_part.mcp_server"],
    cwd=str(PROJECT_ROOT),
)

async def main():

    print("Starting MCP Client...")

    # Connect to the MCP Server
    async with Client(server_params) as client:

        print("Connected to MCP Server!")

        # Discover available tools
        tools_result = await client.list_tools()

        print("\nAvailable tools:")

        for tool in tools_result.tools:
            print(f"- {tool.name}")
            print(f"  Description: {tool.description}")

        # Call the first tool
        print("\nCalling get_investigation...")

        result = await client.call_tool(
            "get_investigation",
            {"investigation_id": 1},
        )

        # Handle tool errors
        if result.is_error:
            print("\nTool execution failed:")

            for block in result.content:
                if isinstance(block, TextContent):
                    print(block.text)

        else:
            print("\nInvestigation retrieved successfully:")

            if result.structured_content is not None:
                print(
                    json.dumps(
                        result.structured_content,
                        indent=4,
                        ensure_ascii=False,
                    )
                )
            else:
                for block in result.content:
                    if isinstance(block, TextContent):
                        print(block.text)

    print("\nMCP connection closed.")

if __name__ == "__main__":
    asyncio.run(main())