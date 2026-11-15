import asyncio
import sys
import json
import os

from openai import AsyncOpenAI
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

BASE_URL = "https://integrate.api.nvidia.com/v1"
MODEL = "nvidia/nemotron-3.5-super-vl-120b-a12b"

llm_client = AsyncOpenAI(
    base_url=BASE_URL,

    api_key=os.environ["NVIDIA_API_KEY"],
)

def convert_mcp_tools(mcp_tools) -> list[dict]:

    llm_tools = []

    for tool in mcp_tools:

        llm_tool = {
            "type": "function",
            "function": {
                "name": tool.name,
                "description": tool.description,
                "parameters": tool.input_schema
            }
        }

        llm_tools.append(llm_tool)

    return llm_tools

async def test_llm():
    response = await llm_client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "user", "content": "What is Prometheus? Explain in one sentence."},
        ],
    )
    print(response)

async def main():

    async with Client(server_params) as client:

        # Discover MCP tools
        tools_result = await client.list_tools()

        # Convert MCP tools into LLM format
        llm_tools = convert_mcp_tools(
            tools_result.tools
        )

        # Inspect the converted tools
        print(json.dumps(llm_tools, indent=4))

if __name__ == "__main__":
    asyncio.run(main())