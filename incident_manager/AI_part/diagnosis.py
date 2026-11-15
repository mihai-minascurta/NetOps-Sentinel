import asyncio
import sys
from pathlib import Path

from mcp import Client, StdioServerParameters

PROJECT_ROOT = Path(__file__).resolve().parents[2]

server_params = StdioServerParameters(
    command=sys.executable,
    args=["-m", "incident_manager.AI_part.mcp_server"],
    cwd=str(PROJECT_ROOT),
)

async def main():

    async with Client(server_params) as client:

        print("Connected to MCP Server!")

        tools_result = await client.list_tools()

        for tool in tools_result.tools:
            print(tool.name)


if __name__ == "__main__":
    asyncio.run(main())

